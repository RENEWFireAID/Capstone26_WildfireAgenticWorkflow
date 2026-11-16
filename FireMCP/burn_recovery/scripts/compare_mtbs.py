"""Compare HLS high severity to MTBS on common support; not field accuracy."""
import argparse
import hashlib
import json
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

import ee

REPO = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO))
from src.config import ASSETS, GEE_PROJECT
from src.imagery import get_peak_summer_hls


def compare(name, samples_dir):
    manifest = json.loads((samples_dir / f"{name.lower().replace(' ', '_')}.json").read_text())
    recipe = manifest['recipe']
    for module in ['config.py', 'imagery.py']:
        if hashlib.sha256((REPO / 'src' / module).read_bytes()).hexdigest() != recipe['source_sha256'][module]:
            raise ValueError(f'{module} changed since the saved sample: review before comparing')
    event_id = recipe['case']['event_id']
    fires = ee.FeatureCollection(ASSETS['ak_fire_history']).filter(ee.Filter.eq('NAME', name)).filter(ee.Filter.eq('FIREYEAR', '2019'))
    matches = ee.FeatureCollection(ASSETS['mtbs']).filter(ee.Filter.eq('Event_ID', event_id))
    if fires.size().getInfo() != 1 or matches.size().getInfo() != 1:
        raise ValueError('Expected exactly one fire and one reference event')
    fire, event = ee.Feature(fires.first()), ee.Feature(matches.first())
    metadata = event.toDictionary().getInfo()
    if metadata != recipe['mtbs'] or fire.toDictionary().getInfo() != recipe['fire']:
        raise ValueError('Source metadata changed since acquisition; review the new records')
    geom = fire.geometry().intersection(event.geometry(), 1)
    reference = ee.Image('USFS/GTAC/MTBS/annual_burn_severity_mosaics/v1/mtbs_AK_2019').select('Severity')
    # An annual mosaic does not identify individual events; reject overlapping events.
    overlaps = ee.FeatureCollection(ASSETS['mtbs']).filter(ee.Filter.gte('Ig_Date', ee.Date('2019-01-01').millis())).filter(ee.Filter.lt('Ig_Date', ee.Date('2020-01-01').millis())).filterBounds(geom).aggregate_array('Event_ID').getInfo()
    if set(overlaps) != {event_id}:
        raise ValueError(f'Annual mosaic attribution needs review: {overlaps}')
    dates = {}
    for key in ['Pre_ID', 'Post_ID']:
        # The final eight characters before the suffix are the acquisition date.
        date = datetime.strptime(metadata[key].split('_')[0][-8:], '%Y%m%d')
        dates[key] = (date.strftime('%Y-%m-%d'), (date + timedelta(days=1)).strftime('%Y-%m-%d'))
    g = fire.geometry()
    summer = get_peak_summer_hls(g, 2018).select('NBR').subtract(get_peak_summer_hls(g, 2020).select('NBR')).multiply(1000)
    pre = get_peak_summer_hls(g, int(dates['Pre_ID'][0][:4]), *dates['Pre_ID']).select('NBR')
    post = get_peak_summer_hls(g, int(dates['Post_ID'][0][:4]), *dates['Post_ID']).select('NBR')
    matched = pre.subtract(post).multiply(1000)
    mapped = reference.gte(1).And(reference.lte(5))
    common = mapped.And(summer.mask()).And(matched.mask())
    projection = ee.Projection(recipe['case']['crs']).atScale(30)
    kwargs = dict(geometry=geom, crs=projection, scale=30, maxPixels=1e8, tileScale=4)
    area = ee.Image.pixelArea()
    support = ee.Image([
        area.rename('intersection_m2'), area.updateMask(mapped).rename('mtbs_mapped_m2'),
        area.updateMask(mapped.And(summer.mask())).rename('summer_paired_m2'),
        area.updateMask(mapped.And(matched.mask())).rename('date_paired_m2'),
        area.updateMask(common).rename('common_m2'),
    ]).reduceRegion(ee.Reducer.sum(), **kwargs).getInfo()
    if not support['common_m2'] or support['common_m2'] <= 0:
        raise ValueError(f'No common valid pixels: {support}')
    rows = []
    # Retain both the pipeline's provisional cutoff and the event-specific cutoff.
    # No offset adjustment: its use is not independently established for HLS.
    for method, index in [('summer_2018_2020', summer), ('MTBS_calendar_dates', matched)]:
        for threshold in sorted({660, metadata['High_T']}):
            code = reference.eq(4).multiply(2).add(index.gt(threshold)).rename('pair')
            groups = area.rename('area').addBands(code).updateMask(common).reduceRegion(
                ee.Reducer.sum().group(1, 'pair'), **kwargs).getInfo().get('groups', [])
            values = {int(x['pair']): x['sum'] for x in groups}
            neither, hls_only, mtbs_only, both = [values.get(i, 0) for i in range(4)]
            total = sum(values.values())
            if abs(total - support['common_m2']) > max(1, total * 1e-8):
                raise ValueError('Comparison methods have different spatial support')
            union = both + hls_only + mtbs_only
            rows.append(dict(method=method, threshold=threshold, neither_m2=neither,
                hls_only_m2=hls_only, mtbs_only_m2=mtbs_only, both_high_m2=both,
                paired_m2=total, agreement=(neither + both) / total,
                high_iou=both / union if union else None))
    return dict(fire=name, event_id=event_id, crs=recipe['case']['crs'], scale_m=30,
        generated_utc=datetime.now(timezone.utc).isoformat(), source_sha256=recipe['source_sha256'],
        script_sha256=hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
        reference_asset=reference.get('system:id').getInfo(), metadata=metadata, dates=dates,
        support=support, comparisons=rows,
        limitations=['Reference-product agreement, not independent ground accuracy.',
            'Calendar-date HLS composites are not an exact replication of MTBS imagery or processing.',
            'MTBS classes 0 and 6 excluded; nearest-neighbor categorical sampling on explicit 30 m UTM grid.',
            'Shared support may exclude difficult areas; report it alongside agreement.',
            'Swan Lake reference baseline is 2017; the pipeline baseline remains 2018.'], complete=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--samples', type=Path, default=REPO.parent / 'validation/multi_fire_comparison')
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--fires', nargs='+', default=['Swan Lake', 'Nugget Creek'])
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    ee.Initialize(project=GEE_PROJECT)
    ee.data.setDeadline(180000)
    for name in args.fires:
        target = args.output / f"{name.lower().replace(' ', '_')}.json"
        if target.exists():
            raise FileExistsError(f'{target}: use a new output directory to preserve earlier results')
        print(f'Comparing {name}...', flush=True)
        result = compare(name, args.samples)
        target.write_text(json.dumps(result, indent=2, allow_nan=False) + '\n')
        print(json.dumps({'fire': name, 'support': result['support'], 'comparisons': result['comparisons']}), flush=True)


if __name__ == '__main__':
    main()
