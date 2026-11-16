"""Build an offline visual review from notebook 02's saved, checked samples."""
import argparse
import base64
import hashlib
import json
import struct
import sys
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd
from plotly.offline import get_plotlyjs

REPO = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO))
MODELS = ['full', 'initial_NDVI_only', 'full_plus_initial_NDVI']
YEARS = list(range(2020, 2025))


def read_json(path):
    return json.loads(path.read_text(encoding='utf-8'))


def check_hash(path, expected):
    if hashlib.sha256(path.read_bytes()).hexdigest() != expected:
        raise ValueError(f'Changed input: {path.name}. Revalidate before building the viewer.')


def load_payload(directory):
    """Reject stale samples or mismatched model rows instead of silently plotting them."""
    report = read_json(directory / 'results.json')
    if not report['complete'] or report['failed_spatial_designs']:
        raise ValueError('The saved notebook run is incomplete')
    for name, digest in report['source_sha256'].items():
        check_hash(REPO / 'src' / name, digest)
    notebook = read_json(REPO / 'notebooks/02_fire_comparison.ipynb')
    code = ''.join(''.join(c['source']) for c in notebook['cells'] if c['cell_type'] == 'code')
    if hashlib.sha256(code.encode()).hexdigest() != report['notebook_code_sha256']:
        raise ValueError('Notebook code changed since the saved run')
    read = lambda name: pd.read_csv(directory / f'{name}.csv', float_precision='round_trip')
    predictions, scores = read('transfer_predictions'), read('transfer_scores')
    if not np.isfinite(predictions[['observed', 'predicted', 'baseline']].to_numpy()).all():
        raise ValueError('Nonfinite model predictions')
    if len(scores) != 18 or scores.duplicated(['fire', 'start_year', 'model']).any():
        raise ValueError('Expected 18 unique held-out-fire comparisons')
    payload = dict(generated_utc=datetime.now(timezone.utc).isoformat(),
        run_completed_utc=report['completed_utc'], years=YEARS, fires={})
    for context in report['case_context']:
        name = context['fire']
        slug = name.lower().replace(' ', '_')
        manifest = read_json(directory / f'{slug}.json')
        check_hash(directory / f'{slug}_samples.csv', manifest['sample_sha256'])
        frame = read(f'{slug}_samples')
        numeric = ['easting', 'northing', 'dNBR', 'severity_class'] + [f'NDVI_{y}' for y in YEARS]
        if not np.isfinite(frame[numeric].to_numpy()).all() or frame.duplicated(['easting', 'northing']).any():
            raise ValueError(f'Invalid or duplicated samples: {name}')
        if len(frame) != context['samples']:
            raise ValueError(f'Sample count changed for {name}')
        cases = {}
        for start in [2020, 2021]:
            years = np.arange(start, 2025)
            design = np.column_stack([np.ones(len(years)), years - start])
            observed = np.linalg.lstsq(design, frame[[f'NDVI_{y}' for y in years]].to_numpy().T, rcond=None)[0][1]
            for model in MODELS:
                group = predictions.loc[(predictions.fire == name) & (predictions.start_year == start)
                                        & (predictions.model == model)].sort_values('sample_id')
                if not np.array_equal(group.sample_id.to_numpy(), np.arange(len(frame))):
                    raise ValueError(f'Missing or duplicate predictions: {name}/{start}/{model}')
                np.testing.assert_allclose(group.observed, observed, rtol=0, atol=1e-12)
                row = scores.loc[(scores.fire == name) & (scores.start_year == start) & (scores.model == model)].iloc[0]
                rmse = np.sqrt(np.mean((group.predicted - observed) ** 2))
                baseline = np.sqrt(np.mean((group.baseline - observed) ** 2))
                r2 = 1 - np.sum((group.predicted - observed) ** 2) / np.sum((observed - observed.mean()) ** 2)
                np.testing.assert_allclose([row.rmse, row.baseline_rmse, row.pooled_r2], [rmse, baseline, r2], rtol=0, atol=1e-10)
                cases[f'{start}:{model}'] = dict(observed=observed.tolist(), predicted=group.predicted.tolist(),
                    rmse=float(rmse), baseline_rmse=float(baseline), r2=float(r2),
                    outside_fraction=float(row.fraction_outside_any_training_range), training_fires=row.training_fires)
        trajectory = []
        for severity, group in frame.groupby('severity_class'):
            trajectory.append(dict(severity=int(severity), n=len(group),
                mean=group[[f'NDVI_{y}' for y in YEARS]].mean().tolist()))
        payload['fires'][name] = dict(context=context, acquired_utc=manifest['acquired_utc'],
            x=(frame.easting / 1000).tolist(), y=(frame.northing / 1000).tolist(),
            dnbr=frame.dNBR.tolist(), ndvi=frame[[f'NDVI_{y}' for y in YEARS]].values.tolist(),
            trajectory=trajectory, cases=cases)
    # No NaNs/Infinity or executable strings may leak into the embedded JSON.
    json.dumps(payload, allow_nan=False)
    return payload


def load_references(directory):
    if not directory.is_dir():
        raise FileNotFoundError(directory)
    references = {}
    for path in sorted(directory.glob('*.json')):
        record = read_json(path)
        if not record['complete']:
            raise ValueError(f'Incomplete reference comparison: {path}')
        support = record['support']
        if not 0 < support['common_m2'] <= support['mtbs_mapped_m2'] <= support['intersection_m2']:
            raise ValueError(f'Invalid reference support: {path}')
        for row in record['comparisons']:
            neither, hls, mtbs, both = [row[k] for k in ['neither_m2', 'hls_only_m2', 'mtbs_only_m2', 'both_high_m2']]
            if min(neither, hls, mtbs, both) < 0:
                raise ValueError(f'Negative comparison area: {path}')
            total, union = neither + hls + mtbs + both, hls + mtbs + both
            np.testing.assert_allclose([total, row['paired_m2']], support['common_m2'], rtol=1e-8)
            np.testing.assert_allclose(row['agreement'], (neither + both) / total, rtol=0, atol=1e-12)
            if union:
                np.testing.assert_allclose(row['high_iou'], both / union, rtol=0, atol=1e-12)
        for module in ['config.py', 'imagery.py']:
            check_hash(REPO / 'src' / module, record['source_sha256'][module])
        check_hash(REPO / 'scripts/compare_mtbs.py', record['script_sha256'])
        if record['fire'] in references:
            raise ValueError(f'Duplicate reference fire: {path}')
        references[record['fire']] = record
    return references


def load_rasters(directory, samples):
    """Only embed complete, fingerprinted previews belonging to the saved cases."""
    if not directory.is_dir():
        raise FileNotFoundError(directory)
    rasters = {}
    for path in sorted(directory.glob('*/manifest.json')):
        record = read_json(path)
        if not record['complete']:
            raise ValueError(f'Incomplete raster export: {path}')
        check_hash(REPO / 'scripts/export_raster_review.py', record['script_sha256'])
        for module in ['observations', 'imagery', 'config']:
            check_hash(REPO / f'src/{module}.py', record[f'{module}_sha256'])
        slug = record['fire'].lower().replace(' ', '_')
        check_hash(samples / f'{slug}.json', record['sample_manifest_sha256'])
        years = ['2018', '2020', '2021', '2022', '2023', '2024']
        expected_layers = {f'{layer}_{year}' for year in years for layer in ['observations', 'ndvi']}
        expected_layers |= {'dnbr', 'rgb_2018', 'rgb_2020', 'rgb_2024'}
        if set(record['years']) != set(years) or set(record['layers']) != expected_layers:
            raise ValueError('Missing raster year or layer')
        record['years'] = {year: {k: v for k, v in summary.items() if k != 'candidate_ids'}
                           for year, summary in record['years'].items()}
        for layer in record['layers'].values():
            if Path(layer['file']).name != layer['file']:
                raise ValueError('Invalid raster path')
            image = path.parent / layer['file']
            check_hash(image, layer['sha256'])
            raw = image.read_bytes()
            if raw[:8] != b'\x89PNG\r\n\x1a\n' or struct.unpack('>II', raw[16:24]) != (layer['width'], layer['height']):
                raise ValueError('Invalid raster PNG or dimensions')
            layer['url'] = 'data:image/png;base64,' + base64.b64encode(raw).decode()
        if record['fire'] in rasters:
            raise ValueError('Duplicate raster fire')
        rasters[record['fire']] = record
    return rasters


def build(directory, output, reference_directory=None, raster_directory=None):
    payload = load_payload(directory)
    payload['references'] = load_references(reference_directory) if reference_directory else {}
    for name, record in payload['references'].items():
        manifest = read_json(directory / f"{name.lower().replace(' ', '_')}.json")
        if record['metadata'] != manifest['recipe']['mtbs'] or record['event_id'] != manifest['recipe']['case']['event_id']:
            raise ValueError(f'Reference event does not match samples: {name}')
    payload['rasters'] = load_rasters(raster_directory, directory) if raster_directory else {}
    template = (REPO / 'viewer/index.html').read_text(encoding='utf-8')
    serialized = json.dumps(payload, allow_nan=False).replace('<', '\\u003c')
    html = template.replace('/*__PLOTLY__*/', get_plotlyjs()).replace('/*__DATA__*/', serialized)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(html, encoding='utf-8')
    print(f'Viewer: {output.resolve()} ({len(html.encode()) / 1e6:.1f} MB; no server or Earth Engine login needed)')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--data', type=Path, default=REPO / 'demo/models')
    parser.add_argument('--output', type=Path, default=REPO / 'fireaid_viewer.html')
    parser.add_argument('--reference', type=Path, default=REPO / 'demo/references', help='Directory from compare_mtbs.py')
    parser.add_argument('--rasters', type=Path, default=REPO / 'demo/rasters', help='Directory from export_raster_review.py')
    args = parser.parse_args()
    if args.data.resolve() == REPO / 'demo/models':
        from scripts.demo_data import verify_bundle
        verify_bundle()
    build(args.data, args.output, args.reference, args.rasters)
