"""Export brighter natural-color previews without changing scientific indices."""
import argparse
import base64
import hashlib
import json
import struct
import sys
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import urlopen

import numpy as np
import pandas as pd

REPO = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO))
FIRES = ['Shovel Creek', 'Swan Lake', 'Nugget Creek']
YEARS = [2018, 2020, 2024]
BANDS = ['Red', 'Green', 'Blue']


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def save(path, record):
    path.write_text(json.dumps(record, indent=2, allow_nan=False) + '\n', encoding='utf-8')


def shared_limits(frame):
    """Equal image weights; one scalar range preserves the shared RGB mapping."""
    groups = list(frame.groupby(['fire', 'year'], sort=True))
    if len(groups) != 9 or set(frame.fire) != set(FIRES) or set(frame.year) != set(YEARS):
        raise ValueError('Expected all nine fire/year RGB samples')
    count = min(len(g) for _, g in groups)
    if count < 100:
        raise ValueError('Insufficient RGB samples')
    values = np.concatenate([g.sample(n=count, random_state=20261003)[BANDS].to_numpy().ravel() for _, g in groups])
    if not np.isfinite(values).all():
        raise ValueError('Nonfinite reflectance sample')
    low, high = np.percentile(values, [2, 98])
    if not low < high:
        raise ValueError('Empty reflectance range')
    return dict(min=float(low), max=float(high), equal_pixels_per_image=count,
                channel_values=len(values), percentiles=[2, 98])


def load_stretches(directory, originals, samples):
    """Only offer complete previews tied to the original scientific/display inputs."""
    from scripts.build_viewer import check_hash, read_json
    path = directory / 'manifest.json'
    record = read_json(path)
    if not record['complete'] or set(record['fires']) != set(FIRES):
        raise ValueError('Incomplete RGB stretch bundle')
    check_hash(Path(__file__), record['script_sha256'])
    for module, digest in record['source_sha256'].items():
        check_hash(REPO / 'src' / module, digest)
    check_hash(directory / 'rgb_samples.csv', record['sample_sha256'])
    frame = pd.read_csv(directory / 'rgb_samples.csv', float_precision='round_trip')
    limits = shared_limits(frame)
    if limits != record['shared_limits']:
        raise ValueError('RGB limits disagree with reflectance samples')
    for fire, case in record['fires'].items():
        slug = fire.lower().replace(' ', '_')
        check_hash(originals / slug / 'manifest.json', case['original_manifest_sha256'])
        check_hash(samples / f'{slug}.json', case['sample_manifest_sha256'])
        if set(case['layers']) != {f'{mode}_{year}' for mode in ['brighter', 'percentile'] for year in YEARS}:
            raise ValueError('Missing RGB preview')
        for key, layer in case['layers'].items():
            image = directory / slug / layer['file']
            if Path(layer['file']).name != layer['file']:
                raise ValueError('Invalid preview path')
            settings = layer['visualization']
            expected = (0, 0.15) if key.startswith('brighter_') else (limits['min'], limits['max'])
            if settings['bands'] != BANDS or settings['gamma'] != 1.3 or (settings['min'], settings['max']) != expected:
                raise ValueError('Unexpected display stretch')
            check_hash(image, layer['sha256'])
            data = image.read_bytes()
            if data[:8] != b'\x89PNG\r\n\x1a\n' or struct.unpack('>II', data[16:24]) != (layer['width'], layer['height']):
                raise ValueError('Invalid PNG header or dimensions')
            original = read_json(originals / slug / 'manifest.json')['layers'][f"rgb_{key.rsplit('_', 1)[1]}"]
            if (layer['width'], layer['height']) != (original['width'], original['height']):
                raise ValueError('RGB preview extent/dimensions differ from original')
            layer['url'] = 'data:image/png;base64,' + base64.b64encode(data).decode()
    return record['fires']


def export(output, originals, samples):
    import ee
    from src.config import ASSETS, GEE_PROJECT
    from src.imagery import get_peak_summer_hls
    from scripts.build_viewer import load_rasters, read_json

    original = load_rasters(originals, samples)
    output.mkdir(parents=True, exist_ok=False)
    ee.Initialize(project=GEE_PROJECT)
    ee.data.setDeadline(180000)
    record = dict(complete=False, generated_utc=datetime.now(timezone.utc).isoformat(),
        script_sha256=sha(Path(__file__)), source_sha256={m: sha(REPO / 'src' / m) for m in ['config.py', 'imagery.py']},
        method='Pooled scalar 2nd/98th percentiles of RGB channel values, with equal sampled pixel counts from all nine fire/year images. One shared range and gamma for every image.',
        sampling=dict(scale_m=30, requested_pixels_per_image=5000, seed=20261003, drop_null_rgb=True),
        note='Display only. Fresh renders from original HLS reflectance; dNBR, NDVI, masks, model inputs and results stay unchanged.', fires={})
    manifest = output / 'manifest.json'
    save(manifest, record)
    sample_rows, images = [], {}
    for fire in FIRES:
        case = original[fire]
        slug = fire.lower().replace(' ', '_')
        boundary = ee.FeatureCollection(ASSETS['ak_fire_history']).filter(ee.Filter.eq('NAME', fire)).filter(ee.Filter.eq('FIREYEAR', '2019'))
        if boundary.size().getInfo() != 1:
            raise ValueError('Expected exactly one perimeter')
        feature = ee.Feature(boundary.first())
        if feature.toDictionary().getInfo() != case['fire_metadata']:
            raise ValueError('Fire metadata differs from original previews')
        geom = feature.geometry()
        region = ee.Geometry(case['projected_bounds'])
        projection = ee.Projection(case['crs']).atScale(30)
        (output / slug).mkdir()
        record['fires'][fire] = dict(original_manifest_sha256=sha(originals / slug / 'manifest.json'),
            sample_manifest_sha256=sha(samples / f'{slug}.json'), crs=case['crs'],
            projected_bounds=case['projected_bounds'], layers={})
        for year in YEARS:
            print(f'{fire} {year}: reflectance sample', flush=True)
            image = get_peak_summer_hls(geom, year).select(BANDS)
            features = image.sample(region=geom, projection=projection, scale=30, numPixels=5000,
                seed=20261003, dropNulls=True, geometries=False, tileScale=4).getInfo()['features']
            sample_rows.extend(dict(fire=fire, year=year, **f['properties']) for f in features)
            images[fire, year] = (image, region)
            pd.DataFrame(sample_rows).to_csv(output / 'rgb_samples_partial.csv', index=False)
    frame = pd.DataFrame(sample_rows)
    frame.to_csv(output / 'rgb_samples.csv', index=False)
    record['sample_sha256'] = sha(output / 'rgb_samples.csv')
    record['shared_limits'] = shared_limits(frame)
    save(manifest, record)
    limits = record['shared_limits']
    print(f"Shared reflectance range: {limits['min']:.5f} to {limits['max']:.5f}", flush=True)
    modes = {'brighter': dict(bands=BANDS, min=0, max=0.15, gamma=1.3),
             'percentile': dict(bands=BANDS, min=limits['min'], max=limits['max'], gamma=1.3)}
    for fire in FIRES:
        slug = fire.lower().replace(' ', '_')
        case = record['fires'][fire]
        for year in YEARS:
            image, region = images[fire, year]
            values = frame.loc[(frame.fire == fire) & (frame.year == year), BANDS].to_numpy()
            for mode, settings in modes.items():
                print(f'{fire} {year}: {mode} preview', flush=True)
                url = image.getThumbURL(dict(settings, region=region, crs=case['crs'], dimensions=900, format='png'))
                try:
                    with urlopen(url, timeout=180) as response:
                        data = response.read()
                except Exception:
                    raise RuntimeError(f'RGB download failed for {fire}/{year}/{mode}; no credentials logged') from None
                if data[:8] != b'\x89PNG\r\n\x1a\n':
                    raise ValueError('Expected PNG')
                path = output / slug / f'{mode}_{year}.png'
                path.write_bytes(data)
                width, height = struct.unpack('>II', data[16:24])
                description = (f'{year} summer median-reflectance natural color. ' +
                    ('Shared 2-98% sample stretch' if mode == 'percentile' else 'Brighter fixed stretch') +
                    f"; reflectance {settings['min']:.4f} to {settings['max']:.4f}, gamma 1.3. Identical range across all fires and years. Display only.")
                case['layers'][f'{mode}_{year}'] = dict(file=path.name, sha256=sha(path), width=width, height=height,
                    visualization=settings, description=description,
                    sample_channel_fraction_below=float((values < settings['min']).mean()),
                    sample_channel_fraction_above=float((values > settings['max']).mean()))
                save(manifest, record)
    record['complete'] = True
    save(manifest, record)
    load_stretches(output, originals, samples)
    print(f'Completed and verified: {output}', flush=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--originals', type=Path, default=REPO.parent / 'validation/raster_review_ready')
    parser.add_argument('--samples', type=Path, default=REPO.parent / 'validation/multi_fire_comparison')
    args = parser.parse_args()
    export(args.output, args.originals, args.samples)
