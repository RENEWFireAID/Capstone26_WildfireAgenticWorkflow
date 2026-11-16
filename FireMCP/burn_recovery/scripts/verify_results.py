"""Independently refit the saved comparisons without Earth Engine access."""
import argparse
import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd
from scipy.spatial.distance import cdist
from sklearn.linear_model import LinearRegression
from sklearn.metrics import r2_score

REPO = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO))
from scripts.build_viewer import load_payload, load_rasters, load_references
from scripts.demo_data import DEMO, load_field_summary, verify_bundle
from scripts.export_rgb_stretches import load_stretches

ENVIRONMENT = ['dNBR', 'elevation', 'slope', 'northness', 'trees', 'temp_anomaly', 'precip_anomaly']
MODELS = {'full': ENVIRONMENT, 'initial_NDVI_only': ['NDVI_2020'],
          'full_plus_initial_NDVI': ENVIRONMENT + ['NDVI_2020']}
FIRES = ['Shovel Creek', 'Swan Lake', 'Nugget Creek']


def check_scores(row, observed, predicted, baseline):
    np.testing.assert_allclose([row.pooled_r2, row.rmse, row.baseline_rmse],
        [r2_score(observed, predicted), np.sqrt(np.mean((predicted - observed) ** 2)),
         np.sqrt(np.mean((baseline - observed) ** 2))], rtol=0, atol=1e-10)


def verify(directory=DEMO):
    root = verify_bundle(directory)
    saved = root / 'models'
    payload = load_payload(saved)
    references = load_references(root / 'references')
    rasters = load_rasters(root / 'rasters', saved)
    stretches = load_stretches(root / 'rgb', root / 'rasters', saved)
    field = load_field_summary(root)
    if set(payload['fires']) != set(FIRES) or set(references) != set(FIRES) or set(rasters) != set(FIRES):
        raise ValueError('Expected three complete fire cases')

    def read(name):
        path = saved / f'{name}.csv'
        if not path.exists():
            path = saved / f'{name}.csv.gz'
        return pd.read_csv(path, float_precision='round_trip')

    frames, targets = {}, {}
    for fire in FIRES:
        frame = read(fire.lower().replace(' ', '_') + '_samples')
        required = ENVIRONMENT + ['easting', 'northing'] + [f'NDVI_{y}' for y in range(2020, 2025)]
        if not np.isfinite(frame[required].to_numpy()).all() or frame.duplicated(['easting', 'northing']).any():
            raise ValueError('Invalid or duplicated satellite samples')
        frames[fire] = frame
        for start in [2020, 2021]:
            years = np.arange(start, 2025)
            design = np.column_stack([np.ones(len(years)), years - start])
            targets[fire, start] = np.linalg.lstsq(design,
                frame[[f'NDVI_{y}' for y in years]].to_numpy().T, rcond=None)[0][1]

    transfer, scores = read('transfer_predictions'), read('transfer_scores')
    max_difference = 0.0
    for row in scores.itertuples():
        training = [fire for fire in FIRES if fire != row.fire]
        if row.training_fires != '; '.join(training):
            raise ValueError('Held-out fire included in training')
        train = pd.concat([frames[fire] for fire in training], ignore_index=True)
        y = np.concatenate([targets[fire, row.start_year] for fire in training])
        variables = [v for v in MODELS[row.model] if train[v].std() > 1e-6]
        if row.active_predictors != '; '.join(variables) or (row.n_train, row.n_test) != (len(train), len(frames[row.fire])):
            raise ValueError('Saved training design differs from samples')
        test = frames[row.fire]
        group = transfer.loc[(transfer.fire == row.fire) & (transfer.start_year == row.start_year)
                             & (transfer.model == row.model)].sort_values('sample_id')
        predicted = LinearRegression().fit(train[variables], y).predict(test[variables])
        observed = targets[row.fire, row.start_year]
        np.testing.assert_allclose(group.observed, observed, rtol=0, atol=1e-12)
        np.testing.assert_allclose(group.baseline, y.mean(), rtol=0, atol=1e-12)
        np.testing.assert_allclose(group.predicted, predicted, rtol=0, atol=1e-10)
        max_difference = max(max_difference, float(np.max(np.abs(group.predicted - predicted))))
        check_scores(row, observed, predicted, y.mean())
        outside = ((test[variables] < train[variables].min()) | (test[variables] > train[variables].max())).any(axis=1)
        np.testing.assert_allclose(row.fraction_outside_any_training_range, outside.mean(), rtol=0, atol=1e-12)

    within, folds, spatial_scores = read('within_predictions'), read('within_folds'), read('within_scores')
    keys = ['fire', 'start_year', 'model', 'block_m', 'buffer_m']
    if len(spatial_scores) != 108 or spatial_scores.duplicated(keys).any() or not spatial_scores.status.eq('ok').all():
        raise ValueError('Incomplete spatial comparison')
    grouped = {key: group for key, group in within.groupby(keys)}
    fold_groups = {key: group for key, group in folds.groupby(keys)}
    if set(grouped) != set(fold_groups) or len(grouped) != 108:
        raise ValueError('Spatial folds and predictions disagree')
    split_count, refit_count = 0, 0
    for fire, frame in frames.items():
        xy = frame[['easting', 'northing']].to_numpy()
        for size in [2000, 4000]:
            blocks = np.floor(xy / size).astype(int)
            unique = np.unique(blocks, axis=0)
            for buffer in [0, 1000, 2000]:
                geometries = []
                for block_id, block in enumerate(unique):
                    test = np.all(blocks == block, axis=1)
                    distance = cdist(xy, xy[test]).min(axis=1)
                    train = ~test & (distance >= buffer)
                    if not train.any():
                        raise ValueError('No spatial training rows')
                    geometries.append((block_id, block, test, train, distance[train].min()))
                    split_count += 1
                for start in [2020, 2021]:
                    y = targets[fire, start]
                    for model, requested in MODELS.items():
                        key = (fire, start, model, size, buffer)
                        group = grouped[key].sort_values('sample_id')
                        np.testing.assert_array_equal(group.sample_id, np.arange(len(frame)))
                        np.testing.assert_allclose(group.observed, y, rtol=0, atol=1e-12)
                        saved_folds = fold_groups[key].set_index('block')
                        if not saved_folds.index.is_unique or len(saved_folds) != len(unique):
                            raise ValueError('Missing spatial fold')
                        predicted, baseline = np.empty(len(frame)), np.empty(len(frame))
                        for block_id, block, test, train, separation in geometries:
                            row = saved_folds.loc[block_id]
                            np.testing.assert_array_equal([row.n_train, row.n_test, row.block_x, row.block_y],
                                                          [train.sum(), test.sum(), *block])
                            np.testing.assert_allclose(row.min_train_test_m, separation, rtol=0, atol=1e-8)
                            np.testing.assert_array_equal(group.loc[test, 'block'], block_id)
                            variables = [v for v in requested if frame.loc[train, v].std() > 1e-6]
                            predicted[test] = LinearRegression().fit(frame.loc[train, variables], y[train]).predict(frame.loc[test, variables])
                            baseline[test] = y[train].mean()
                            refit_count += 1
                        np.testing.assert_allclose(group.predicted, predicted, rtol=0, atol=1e-10)
                        np.testing.assert_allclose(group.baseline, baseline, rtol=0, atol=1e-12)
                        max_difference = max(max_difference, float(np.max(np.abs(group.predicted - predicted))))
                        match = spatial_scores.loc[(spatial_scores[keys] == pd.Series(key, index=keys)).all(axis=1)].iloc[0]
                        check_scores(match, y, predicted, baseline)
    return dict(passed=True, transfer_models_refit=len(scores), spatial_designs=len(spatial_scores),
        geometric_splits=split_count, spatial_folds_refit=refit_count,
        max_prediction_difference=max_difference, previews_verified=sum(len(r['layers']) for r in rasters.values())
            + sum(len(r['layers']) for r in stretches.values()), aggregate_field_comparisons=len(field['comparisons']),
        scope='Saved-data computational verification. Field rank correlations cannot be refit without the private plot records; no ecological or statewide accuracy claim.')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--data', type=Path, default=DEMO)
    args = parser.parse_args()
    print(json.dumps(verify(args.data), indent=2, allow_nan=False))
