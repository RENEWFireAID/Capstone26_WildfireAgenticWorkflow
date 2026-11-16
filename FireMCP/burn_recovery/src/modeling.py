"""
Statistical modeling of post-fire recovery: spatial subsampling, OLS regression,
Variance Inflation Factor (VIF) collinearity tests, and Moran's I residual diagnostic.
"""

from typing import Dict, Any, Tuple
import numpy as np
import pandas as pd
import statsmodels.api as sm
from statsmodels.stats.outliers_influence import variance_inflation_factor
from scipy.spatial.distance import cdist
import ee

from .config import SPATIAL_SAMPLE_SCALE_METERS, MAX_SAMPLE_POINTS


def sample_fire_scar(
    composite_stack: ee.Image,
    geom: ee.Geometry,
    scale: int = SPATIAL_SAMPLE_SCALE_METERS,
    max_points: int = MAX_SAMPLE_POINTS,
    *,
    projection: ee.Projection,
    tile_scale: float = 1,
) -> pd.DataFrame:
    """
    Draw a severity-stratified sample on an explicit metric projection.
    Values are evaluated at the nominal scale, not averaged over cell areas.
    Projected coordinates are retained for spatial validation within a fire.
    tile_scale controls Earth Engine aggregation memory, not sampling resolution.
    """
    points_per_class = max(1, max_points // 6)
    samples = composite_stack.stratifiedSample(
        numPoints=points_per_class,
        classBand="severity_class",
        region=geom,
        scale=scale,
        projection=projection,
        seed=0,
        tileScale=tile_scale,
        geometries=True
    )
    def add_xy(feature):
        # Strip the grid's affine scale: geometry coordinates must be CRS
        # meters, not 30 m pixel coordinates, for distances and buffers.
        xy = feature.geometry().transform(ee.Projection(projection.crs()), 1).coordinates()
        return feature.set({"easting": xy.get(0), "northing": xy.get(1)})

    fc = samples.map(add_xy).getInfo() or {}
    
    rows = []
    for feat in fc.get("features", []):
        props = feat.get("properties", {})
        coords = feat.get("geometry", {}).get("coordinates", [np.nan, np.nan])
        props["longitude"] = coords[0]
        props["latitude"] = coords[1]
        rows.append(props)
        
    df = pd.DataFrame(rows).dropna()
    return df


def calculate_recovery_slopes(
    df: pd.DataFrame,
    years: list
) -> pd.Series:
    """
    Calculate the linear recovery rate (slope = delta NDVI / year)
    for each subsampled point across the post-fire time series.
    """
    selected_years = [yr for yr in years if f"NDVI_{yr}" in df.columns]
    ndvi_cols = [f"NDVI_{yr}" for yr in selected_years]
    if len(ndvi_cols) < 2:
        raise ValueError("Need at least 2 post-fire years to compute recovery slope.")
        
    x = np.array(selected_years) - selected_years[0]
    x_mean = np.mean(x)
    denom = np.sum((x - x_mean) ** 2)
    
    y = df[ndvi_cols].values
    y_mean = np.mean(y, axis=1, keepdims=True)
    
    slopes = np.sum((x - x_mean) * (y - y_mean), axis=1) / denom
    return pd.Series(slopes, index=df.index, name="recovery_slope")


def fit_recovery_ols(
    df: pd.DataFrame,
    independent_vars: list,
    target_var: str = "recovery_slope"
) -> Tuple[sm.regression.linear_model.RegressionResultsWrapper, pd.DataFrame]:
    """
    Fit an Ordinary Least Squares (OLS) regression model.
    Also calculates Variance Inflation Factors (VIF) for multicollinearity diagnosis.
    """
    cols = [c for c in [target_var] + independent_vars if c in df.columns]
    clean_df = df[cols].dropna()
    
    # Drop zero-variance columns to prevent singular matrices
    valid_vars = [c for c in independent_vars if c in clean_df.columns and clean_df[c].std() > 1e-6]
    if not valid_vars:
        raise ValueError("No valid independent variables with variance > 0.")
        
    X = clean_df[valid_vars].astype(float)
    X_with_const = sm.add_constant(X)
    y = clean_df[target_var].astype(float)
    
    model = sm.OLS(y, X_with_const).fit()
    
    # Compute Variance Inflation Factors (VIF) defensively
    vif_data = []
    for i, col in enumerate(X_with_const.columns):
        if col == "const":
            continue
        try:
            vif_val = variance_inflation_factor(X_with_const.values, i)
            vif_data.append({"variable": col, "VIF": round(float(vif_val), 2)})
        except Exception:
            vif_data.append({"variable": col, "VIF": np.nan})
            
    vif_df = pd.DataFrame(vif_data)
    return model, vif_df


def buffered_spatial_cv(
    df: pd.DataFrame,
    independent_vars: list,
    block_size_m: float,
    buffer_m: float,
    target_var: str = "recovery_slope",
) -> Tuple[pd.DataFrame, pd.DataFrame]:
    """Leave one projected square block out; buffer its held-out observations.

    The grid is anchored at the metric CRS origin. This evaluates within-fire
    prediction, not coefficient inference or transfer to another fire. Block
    and buffer sizes require sensitivity analysis; neither is fitted here.
    Returns predictions in input row order and per-block training diagnostics.
    """
    if not np.isfinite([block_size_m, buffer_m]).all() or block_size_m <= 0 or buffer_m < 0:
        raise ValueError("Block size must be positive and buffer nonnegative.")
    columns = [target_var, *independent_vars, "easting", "northing"]
    if not df.index.is_unique or not np.isfinite(df[columns].to_numpy(dtype=float)).all():
        raise ValueError("Spatial validation requires unique row IDs and finite complete data.")
    xy = df[["easting", "northing"]].to_numpy(dtype=float)
    blocks = np.floor(xy / block_size_m).astype(int)
    unique_blocks = np.unique(blocks, axis=0)
    if len(unique_blocks) < 2:
        raise ValueError("Need at least two occupied spatial blocks.")
    result = pd.DataFrame(index=df.index, columns=["observed", "predicted", "baseline", "block"], dtype=float)
    result["observed"] = df[target_var]
    diagnostics = []
    for block_id, block in enumerate(unique_blocks):
        test = np.all(blocks == block, axis=1)
        distance = cdist(xy, xy[test]).min(axis=1)
        train = ~test & (distance >= buffer_m)
        training = df.iloc[np.flatnonzero(train)]
        if len(training) <= len(independent_vars) + 1:
            raise ValueError(f"Too few training rows after buffering block {block_id}.")
        model, _ = fit_recovery_ols(training, independent_vars, target_var)
        variables = [v for v in model.model.exog_names if v != "const"]
        design = sm.add_constant(df.iloc[np.flatnonzero(test)][variables], has_constant="add")
        result.loc[test, "predicted"] = model.predict(design).to_numpy()
        result.loc[test, "baseline"] = training[target_var].mean()
        result.loc[test, "block"] = block_id
        diagnostics.append({
            "block": block_id, "block_x": int(block[0]), "block_y": int(block[1]),
            "n_train": int(train.sum()), "n_test": int(test.sum()),
            "min_train_test_m": float(distance[train].min()),
        })
    return result, pd.DataFrame(diagnostics)


def compute_morans_i(
    residuals: Any,
    coords: Any,
    k_neighbors: int = 8,
    permutations: int = 999,
    seed: int = 0
) -> Dict[str, Any]:
    """
    Compute Moran's I with a two-sided permutation p-value.
    """
    res_arr = np.asarray(residuals)
    coord_arr = np.asarray(coords)
    n = len(res_arr)
    if n < 10:
        raise ValueError("At least 10 observations are required for Moran's I.")
    if len(coord_arr) != n:
        raise ValueError("Residual and coordinate counts must match.")
    if not 1 <= k_neighbors < n:
        raise ValueError("k_neighbors must be between 1 and n - 1.")
        
    z = res_arr - np.mean(res_arr)
    
    # Convert lon/lat to a local equirectangular approximation in meters before
    # finding neighbors. This is accurate enough within a single fire scar.
    lon = np.deg2rad(coord_arr[:, 0])
    lat = np.deg2rad(coord_arr[:, 1])
    radius = 6_371_008.8
    xy = np.column_stack((radius * lon * np.cos(lat.mean()), radius * lat))
    distances = cdist(xy, xy)
    np.fill_diagonal(distances, np.inf)
    neighbors = np.argpartition(distances, k_neighbors, axis=1)[:, :k_neighbors]
    neighbor_distances = np.take_along_axis(distances, neighbors, axis=1)
    weights = 1.0 / np.maximum(neighbor_distances, 1e-6)
    weights /= weights.sum(axis=1, keepdims=True)

    def statistic(values: np.ndarray) -> float:
        numerator = np.sum(weights * values[:, None] * values[neighbors])
        return float(numerator / np.sum(values ** 2))

    denominator = np.sum(z ** 2)
    if denominator == 0:
        raise ValueError("Moran's I is undefined for constant residuals.")
    morans_i = statistic(z)
    expected_i = -1.0 / (n - 1)
    rng = np.random.default_rng(seed)
    simulated = np.array([statistic(rng.permutation(z)) for _ in range(permutations)])
    p_value = (np.count_nonzero(np.abs(simulated - expected_i) >= abs(morans_i - expected_i)) + 1) / (permutations + 1)

    return {
        "morans_i": round(float(morans_i), 4),
        "expected_i": round(float(expected_i), 4),
        "p_value": round(float(p_value), 4),
        "permutations": permutations,
    }
