"""Burn Severity Recovery: Muhammad Saffiullah's three-fire study, served over MCP.

burn_recovery/ is a byte-for-byte copy of saffi907/fireaid-burn-severity-recovery
(commit c434bea). Its own loaders check every file fingerprint and recompute the
displayed model metrics before anything is returned, so update it by replacing
the whole folder from that repository, never by editing files in place.
"""
import base64
import sys
from functools import lru_cache
from pathlib import Path
from typing import Optional

REPO = Path(__file__).resolve().parents[1] / "burn_recovery"

FIRES = ["Shovel Creek", "Swan Lake", "Nugget Creek"]
PERIODS = ["2020", "2021"]
# Model keys as stored in the saved results, with the names the original app shows.
MODELS = {
    "full": "Environmental predictors",
    "initial_NDVI_only": "Initial NDVI only",
    "full_plus_initial_NDVI": "Environmental predictors + initial NDVI",
}
LAYERS = ["rgb_2018", "rgb_2020", "rgb_2024", "dnbr", "ndvi", "observations"]
SEASONAL_LAYERS = {"ndvi", "observations"}
SUMMERS = ["2018", "2020", "2021", "2022", "2023", "2024"]
CONTRASTS = ["percentile", "brighter", "original"]
SEVERITY_BINS = ["Below -100", "-100 to 100", "100 to 270", "270 to 440", "440 to 660", "Above 660"]
DIAGNOSTICS = {
    "residual_maps": ("Held-out residual maps", "shovel_residual_maps.png"),
    "joint_climate_support": ("Joint climate support", "joint_climate_support.png"),
    "slope_stability": ("Recovery-window sensitivity", "slope_stability.png"),
    "mtbs_class_iou": ("MTBS class comparison", "mtbs_class_iou.png"),
}


@lru_cache(maxsize=1)
def _bundle() -> dict:
    """Load and verify the saved study once, exactly as the original app does."""
    if str(REPO) not in sys.path:
        sys.path.insert(0, str(REPO))
    from scripts.build_viewer import load_payload, load_rasters, load_references
    from scripts.demo_data import load_field_summary, verify_bundle
    from scripts.export_rgb_stretches import load_stretches

    root = verify_bundle()
    models = root / "models"
    data = load_payload(models)
    data["references"] = load_references(root / "references")
    data["rasters"] = load_rasters(root / "rasters", models)
    data["rgb_stretches"] = load_stretches(root / "rgb", root / "rasters", models)
    data["field_summary"] = load_field_summary(root)
    if set(data["references"]) != set(data["fires"]) or set(data["rasters"]) != set(data["fires"]):
        raise ValueError("Expected complete reference and raster bundles for all three fires")
    return data


def _fire(name: str) -> str:
    for fire in FIRES:
        if fire.lower() == str(name).strip().lower():
            return fire
    raise ValueError(f"Unknown fire {name!r}; choose one of {', '.join(FIRES)}")


def _choice(value, options, label):
    if value not in options:
        raise ValueError(f"Unknown {label} {value!r}; choose one of {', '.join(options)}")
    return value


def _case_summary(case: dict) -> dict:
    return {
        "r2": case["r2"],
        "rmse": case["rmse"],
        "baseline_rmse": case["baseline_rmse"],
        "beats_baseline": case["rmse"] < case["baseline_rmse"],
        "outside_training_range_fraction": case["outside_fraction"],
        "training_fires": case["training_fires"],
    }


def overview(fire: Optional[str] = None) -> dict:
    """Headline numbers for one fire or all three: no images or per-sample arrays."""
    data = _bundle()
    names = [_fire(fire)] if fire else FIRES
    fires = {}
    for name in names:
        record = data["fires"][name]
        reference = data["references"][name]
        field = [row for row in data["field_summary"]["comparisons"] if row["fire"] == name]
        fires[name] = {
            "sampled_locations": len(record["x"]),
            "complete_input_coverage": record["context"]["coverage_30m"],
            "crs": record["context"]["crs"],
            "recovery_period": "2020-2024",
            "severity_groups": [
                {"dnbr_bin": SEVERITY_BINS[t["severity"]], "samples": t["n"], "mean_ndvi_by_year": dict(zip(map(str, data["years"]), t["mean"]))}
                for t in record["trajectory"]
            ],
            "models": {
                f"{period}-2024 slope, {label}": _case_summary(record["cases"][f"{period}:{key}"])
                for period in PERIODS for key, label in MODELS.items()
            },
            "mtbs_comparison": {
                "reference_dates": [reference["dates"]["Pre_ID"][0], reference["dates"]["Post_ID"][0]],
                "common_support_fraction": reference["support"]["common_m2"] / reference["support"]["intersection_m2"],
                "rows": [
                    {
                        "hls_imagery": "Summer composites" if row["method"] == "summer_2018_2020" else "MTBS calendar dates",
                        "high_cutoff": row["threshold"],
                        "high_vs_other_agreement": row["agreement"],
                        "high_severity_iou": row["high_iou"],
                    }
                    for row in reference["comparisons"]
                ],
            },
            "field_cbi": [
                {
                    "footprint": row["mode"],
                    "survey_plots": row["n_valid"],
                    "cbi_dnbr_rank_correlation": row["spearman"]["dnbr_mean"],
                    "fixed_class_agreement": row["fixed_class_agreement"],
                    "high_cbi_plots_detected": row["high_class"]["tp"],
                    "high_cbi_plots": row["high_class"]["tp"] + row["high_class"]["fn"],
                }
                for row in field
            ],
            "diagnostics": [{"key": k, "title": t} for k, (t, _) in DIAGNOSTICS.items()] if name == "Shovel Creek" else [],
        }
    return {
        "study": "Burn severity and post-fire greenness of three 2019 Alaska fires (Muhammad Saffiullah, UAA)",
        "run_completed_utc": data["run_completed_utc"],
        "years": data["years"],
        "fires": fires,
        "notes": [
            "R² is for the held-out fire after training on the other two; negative R² means worse than predicting that fire's mean, not percent accuracy.",
            "Initial NDVI comes from 2020, which is also part of the 2020-2024 slope, so models using it share a year with their target. A high 2020-2024 score for them does not show forecasting skill; the 2021-2024 window is the check.",
            "NDVI greening is spectral; it does not establish restored forest structure.",
            "MTBS comparison measures agreement between satellite products, not field accuracy.",
            "Climate predictors cover 2020-2024, so the models are retrospective comparisons, not forecasts.",
        ],
    }


def imagery(fire: str, layer: str, year: Optional[str] = None, contrast: str = "percentile") -> dict:
    """One saved preview image as a PNG data URL, with its legend and caption."""
    data = _bundle()
    name = _fire(fire)
    _choice(layer, LAYERS, "layer")
    _choice(contrast, CONTRASTS, "contrast")
    record = data["rasters"][name]
    if layer in SEASONAL_LAYERS:
        image = record["layers"][f"{layer}_{_choice(str(year or '2024'), SUMMERS, 'summer')}"]
    else:
        image = record["layers"][layer]
    if layer.startswith("rgb_") and contrast != "original":
        image = data["rgb_stretches"][name]["layers"][f"{contrast}_{layer.split('_')[1]}"]
    settings = image["visualization"]
    legend = None
    if "palette" in settings:
        legend = {
            "min": settings["min"],
            "max": settings["max"],
            "palette": ["#" + c.lstrip("#") for c in settings["palette"]],
            "unit": {"dnbr": "dNBR x1000", "ndvi": "NDVI", "observations": "QA-screened image inputs"}[layer],
        }
    corners = record["projected_bounds"]["coordinates"][0]
    eastings, northings = [c[0] / 1000 for c in corners], [c[1] / 1000 for c in corners]
    return {
        "fire": name,
        "url": image["url"],
        "width": image["width"],
        "height": image["height"],
        "description": image["description"],
        "legend": legend,
        "extent": f"{record['crs']}: easting {min(eastings):.1f} to {max(eastings):.1f} km; northing {min(northings):.1f} to {max(northings):.1f} km.",
        "support_by_summer": [
            {
                "summer": summer,
                "median_image_inputs": stats["counts"]["observations_p50"],
                "no_inputs": stats["zero_fraction"],
                "one_or_two_inputs": stats["one_or_two_fraction"],
                "valid_ndvi": stats["ndvi_valid_fraction"],
            }
            for summer, stats in record["years"].items()
        ],
    }


def samples(fire: str, period: str = "2020", model: str = "full") -> dict:
    """Per-location values for the greenness map, NDVI curves and model scatter."""
    data = _bundle()
    name = _fire(fire)
    _choice(str(period), PERIODS, "period")
    _choice(model, list(MODELS), "model")
    record = data["fires"][name]
    case = record["cases"][f"{period}:{model}"]
    return {
        "fire": name,
        "years": data["years"],
        "crs": record["context"]["crs"],
        "x_km": record["x"],
        "y_km": record["y"],
        "dnbr": record["dnbr"],
        "ndvi": record["ndvi"],
        "trajectory": [
            {"severity": t["severity"], "label": SEVERITY_BINS[t["severity"]], "n": t["n"], "mean": t["mean"]}
            for t in record["trajectory"]
        ],
        "observed_slope": case["observed"],
        "predicted_slope": case["predicted"],
        **_case_summary(case),
    }


def diagnostic(figure: str) -> dict:
    """One of the saved Shovel Creek diagnostic figures as a PNG data URL."""
    _bundle()  # the figures are covered by the bundle's fingerprint check
    title, file = DIAGNOSTICS[_choice(figure, list(DIAGNOSTICS), "figure")]
    raw = (REPO / "demo" / "diagnostics" / file).read_bytes()
    return {"key": figure, "title": title, "url": "data:image/png;base64," + base64.b64encode(raw).decode()}
