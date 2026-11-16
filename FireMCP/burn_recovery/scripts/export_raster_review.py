"""Export fresh HLS raster previews and 30 m input-support audits; no model refit."""
import argparse
import hashlib
import json
import struct
import sys
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import urlopen

import ee

REPO = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO))
from src.config import ASSETS, GEE_PROJECT, DNBR_RAMP
from src.imagery import get_peak_summer_hls
from src.observations import summer_collection, count_observations

YEARS = [2018, 2020, 2021, 2022, 2023, 2024]


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def export_fire(name, samples, output):
    slug = name.lower().replace(' ', '_')
    saved = json.loads((samples / f'{slug}.json').read_text())
    recipe = saved['recipe']
    for module in ['config.py', 'imagery.py']:
        if sha(REPO / 'src' / module) != recipe['source_sha256'][module]:
            raise ValueError(f'{module} differs from the saved model run; review first')
    fires = ee.FeatureCollection(ASSETS['ak_fire_history']).filter(ee.Filter.eq('NAME', name)).filter(ee.Filter.eq('FIREYEAR', '2019'))
    if fires.size().getInfo() != 1:
        raise ValueError('Expected one fire')
    fire = ee.Feature(fires.first())
    if fire.toDictionary().getInfo() != recipe['fire']:
        raise ValueError('Fire metadata differs from the saved model run')
    geom = fire.geometry()
    crs = recipe['case']['crs']
    projection = ee.Projection(crs).atScale(30)
    region = geom.bounds(1, ee.Projection(crs))
    folder = output / slug
    folder.mkdir()  # Never mix a partial/old export with a new run.
    record = dict(fire=name, generated_utc=datetime.now(timezone.utc).isoformat(),
        script_sha256=sha(Path(__file__)), observations_sha256=sha(REPO / 'src/observations.py'),
        imagery_sha256=sha(REPO / 'src/imagery.py'), config_sha256=sha(REPO / 'src/config.py'),
        sample_manifest_sha256=sha(samples / f'{slug}.json'), fire_metadata=recipe['fire'],
        crs=crs, statistics_scale_m=30, display_max_pixels=900,
        projected_bounds=region.getInfo(), years={}, layers={}, complete=False,
        note='Fresh imagery export; model snapshots remain unchanged. Previews are display-resampled, not downloadable 30 m rasters. Counts are QA-screened Red/NIR/SWIR2 scene inputs, not distinct days or guaranteed index values.')
    manifest = folder / 'manifest.json'

    def checkpoint():
        manifest.write_text(json.dumps(record, indent=2, allow_nan=False) + '\n')

    def preview(key, image, settings, description):
        params = dict(settings, region=region, crs=crs, dimensions=900, format='png')
        url = image.getThumbURL(params)
        try:
            with urlopen(url, timeout=180) as response:
                data = response.read()
        except Exception:
            raise RuntimeError(f'Preview download failed for {name}/{key}; no credentials logged') from None
        if data[:8] != b'\x89PNG\r\n\x1a\n':
            raise ValueError(f'Expected PNG for {key}')
        width, height = struct.unpack('>II', data[16:24])
        path = folder / f'{key}.png'
        path.write_bytes(data)
        record['layers'][key] = dict(file=path.name, sha256=sha(path), width=width, height=height,
            description=description, visualization=settings)
        checkpoint()

    checkpoint()
    kwargs = dict(geometry=geom, crs=projection, scale=30, maxPixels=1e8, tileScale=4)
    area = ee.Image.pixelArea()
    composites = {}
    for year in YEARS:
        print(f'{name}: {year} observations...', flush=True)
        collection = summer_collection(geom, year)
        count = count_observations(collection, geom)
        composite = get_peak_summer_hls(geom, year)
        composites[year] = composite
        summary = ee.Image([
            area.rename('total_m2'), area.updateMask(count.eq(0)).rename('zero_m2'),
            area.updateMask(count.gte(1).And(count.lte(2))).rename('one_or_two_m2'),
            area.updateMask(composite.select('NDVI').mask()).rename('ndvi_valid_m2'),
        ]).reduceRegion(ee.Reducer.sum(), **kwargs)
        distribution = count.reduceRegion(ee.Reducer.percentile([5, 50, 95]).combine(
            ee.Reducer.minMax(), sharedInputs=True), **kwargs)
        result = ee.Dictionary(dict(areas=summary, counts=distribution,
            candidate_ids=collection.aggregate_array('system:index'))).getInfo()
        total = result['areas']['total_m2']
        if total <= 0:
            raise ValueError('No analysis area')
        for key in ['zero_m2', 'one_or_two_m2', 'ndvi_valid_m2']:
            result['areas'][key] = result['areas'][key] or 0
            fraction = result['areas'][key] / total
            if not 0 <= fraction <= 1 + 1e-10:
                raise ValueError('Invalid support fraction')
            result[key.replace('_m2', '_fraction')] = fraction
        result['candidate_note'] = 'Intersecting catalog IDs can include scenes with no usable pixels here; counts use actual per-pixel masks.'
        record['years'][str(year)] = result
        checkpoint()
        preview(f'observations_{year}', count, dict(min=0, max=30,
            palette=['eeeeee', 'd8c9a6', 'a6c98a', '438455', '164c35']),
            f'{year}: QA-screened Red/NIR/SWIR2 image inputs; 0–30 scene color scale, values above 30 saturate. Zero is light gray.')
        preview(f'ndvi_{year}', composite.select('NDVI'), dict(min=-0.2, max=1,
            palette=['e5d7b3', 'aed581', '1b5e20']), f'{year} summer NDVI; fixed −0.2 to 1 display scale. Transparent pixels are outside the fire or lack a valid index.')
        if year in [2018, 2020, 2024]:
            preview(f'rgb_{year}', composite, dict(bands=['Red', 'Green', 'Blue'], min=0, max=0.3, gamma=1.3),
                f'{year} summer median-reflectance natural-color composite; identical display stretch for all years/fires.')
    dnbr = composites[2018].select('NBR').subtract(composites[2020].select('NBR')).multiply(1000)
    preview('dnbr', dnbr, dict(min=-100, max=800, palette=DNBR_RAMP),
        '2018 minus 2020 NBR ×1000; continuous spectral severity, not a field-calibrated damage class. Green → red = −100 → 800; extreme values saturate.')
    record['complete'] = True
    checkpoint()
    print(f'{name}: export complete', flush=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--samples', type=Path, default=REPO.parent / 'validation/multi_fire_comparison')
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--fires', nargs='+', default=['Shovel Creek', 'Swan Lake', 'Nugget Creek'])
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    ee.Initialize(project=GEE_PROJECT)
    ee.data.setDeadline(180000)
    for name in args.fires:
        export_fire(name, args.samples, args.output)
