"""Audit local CBI shapefiles and compare untuned HLS severity at field plots."""
import argparse
import hashlib
import json
import math
import sys
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd
import shapefile
from scipy.stats import spearmanr

REPO = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO))
SITES = {
    'Shovel Creek': ('Shovel_creek/Shovel_Creek_Burn_Severity_Survey.shp', 'Name', 'CBI_T'),
    'Nugget Creek': ('Nugget_creek/Nugget_Creek_Burn_Severity_Survey.shp', 'NAME', 'CBI'),
}
CLASSES = ['Unburned', 'Low', 'Moderate', 'High']
MODES = {'center': 0, 'plot_15m': 15, 'buffer_20m': 20, 'buffer_30m': 30}


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def save(path, value):
    path.write_text(json.dumps(value, indent=2, allow_nan=False) + '\n', encoding='utf-8')


def number(value):
    """Missing scores stay missing; malformed or nonfinite values fail visibly."""
    text = str(value).strip()
    if text.lower() in ['', 'na', 'n/a', 'none']:
        return None
    result = float(text)
    if not math.isfinite(result):
        raise ValueError(f'Nonfinite score: {text}')
    return result


def cbi_class(value):
    if not 0 <= value <= 3:
        raise ValueError('CBI must be between 0 and 3')
    return CLASSES[0 if value == 0 else 1 if value < 1.5 else 2 if value < 2 else 3]


def dnbr_class(value):
    # Same <= upper-bound convention as src/severity.py. Two moderate bins merge.
    if value < -100:
        return 'Increased greenness'
    return CLASSES[0 if value <= 100 else 1 if value <= 270 else 2 if value <= 660 else 3]


def audit_fields(directory):
    records, audit = [], {}
    for fire, (relative, id_field, score_field) in SITES.items():
        path = directory / relative
        wkt = path.with_suffix('.prj').read_text()
        required = ['WGS_1984_UTM_Zone_6N', 'Central_Meridian",-147', 'False_Easting",500000', 'UNIT["Meter",1']
        if not all(token.lower() in wkt.lower() for token in required):
            raise ValueError(f'Expected WGS84 UTM zone 6N in {path.name}')
        rows, warnings, ids, positions = [], [], set(), set()
        with shapefile.Reader(str(path), encoding='utf-8') as reader:
            for feature in reader.iterShapeRecords():
                raw = feature.record.as_dict()
                plot_id = str(raw[id_field]).strip()
                if not plot_id or plot_id in ids or feature.shape.shapeType != shapefile.POINT:
                    raise ValueError(f'Missing/duplicate plot ID or non-point geometry: {fire}/{plot_id}')
                ids.add(plot_id)
                x, y = map(float, feature.shape.points[0])
                if not (100000 <= x <= 900000 and 0 <= y <= 10000000) or (x, y) in positions:
                    raise ValueError(f'Invalid/duplicate projected coordinates: {fire}/{plot_id}')
                positions.add((x, y))
                cbi = number(raw[score_field])
                if cbi is None:
                    raise ValueError(f'Missing total CBI: {fire}/{plot_id}')
                row = dict(fire=fire, plot_id=plot_id, easting=x, northing=y,
                           cbi=cbi, cbi_class=cbi_class(cbi), total_cbi_field=score_field,
                           survey_period='summer 2020', exact_survey_date=None)
                measured = [number(raw.get(f'{s}_avg', '')) for s in 'ABCDE']
                if sum(v is not None for v in measured) < 2:
                    warnings.append(dict(plot_id=plot_id, issue='Few stratum averages; total CBI retained as supplied'))
                for field in ['Und_B', 'Ove_B']:
                    value = number(raw.get(field, ''))
                    if value is not None and not 0 <= value <= 100:
                        warnings.append(dict(plot_id=plot_id, field=field, value=value,
                                             issue='Percentage outside 0-100; not used in this comparison'))
                if raw.get('Class') and str(raw['Class']).strip().lower() != row['cbi_class'].lower():
                    raise ValueError(f'Supplied class disagrees with total CBI: {plot_id}')
                rows.append(dict(**row, raw_attributes=raw))
                records.append(row)
        audit[fire] = dict(n=len(rows), class_counts=dict(Counter(r['cbi_class'] for r in rows)),
            cbi_range=[min(r['cbi'] for r in rows), max(r['cbi'] for r in rows)],
            source_crs='EPSG:32606', source_wkt=wkt,
            files={p.name: sha(p) for p in sorted(path.parent.glob(path.stem + '.*'))},
            warnings=warnings, records=rows)
    return pd.DataFrame(records), audit


def extract(frame, output, samples):
    import ee
    from src.config import ASSETS, GEE_PROJECT
    from src.imagery import get_peak_summer_hls
    from src.observations import summer_collection, count_observations

    ee.Initialize(project=GEE_PROJECT)
    ee.data.setDeadline(180000)
    projection = ee.Projection('EPSG:32606').atScale(30)
    all_rows, geometry_rows = [], []
    for fire, plots in frame.groupby('fire', sort=False):
        print(f'{fire}: checking perimeter and plot locations', flush=True)
        saved = json.loads((samples / f"{fire.lower().replace(' ', '_')}.json").read_text())
        for module in ['config.py', 'imagery.py']:
            if sha(REPO / 'src' / module) != saved['recipe']['source_sha256'][module]:
                raise ValueError(f'{module} differs from the saved run')
        fires = ee.FeatureCollection(ASSETS['ak_fire_history']).filter(ee.Filter.eq('NAME', fire)).filter(ee.Filter.eq('FIREYEAR', '2019'))
        if fires.size().getInfo() != 1:
            raise ValueError(f'Expected one 2019 perimeter for {fire}')
        boundary = ee.Feature(fires.first())
        if boundary.toDictionary().getInfo() != saved['recipe']['fire']:
            raise ValueError('Fire metadata differs from saved case')
        features = []
        for row in plots.to_dict('records'):
            point = ee.Geometry.Point([row['easting'], row['northing']], 'EPSG:32606')
            coords = point.transform('EPSG:4326', 0.1).coordinates()
            features.append(ee.Feature(point, dict(plot_id=row['plot_id'],
                longitude=coords.get(0), latitude=coords.get(1),
                inside_perimeter=boundary.geometry().contains(point, 0.1))))
        points = ee.FeatureCollection(features)
        geo = points.getInfo()['features']
        geometry_rows.extend(dict(fire=fire, **f['properties']) for f in geo)
        # Include unburned controls outside the scar. Do not clip those away.
        region = boundary.geometry().bounds(30).union(points.geometry().bounds(30).buffer(60), 30)
        pre, post = [get_peak_summer_hls(region, y) for y in [2018, 2020]]
        dnbr = pre.select('NBR').subtract(post.select('NBR')).multiply(1000).rename('dnbr')
        indices = ee.Image.cat([pre.select('NBR').rename('nbr_2018'),
            post.select('NBR').rename('nbr_2020'), post.select('NDVI').rename('ndvi_2020'), dnbr])
        indices = indices.updateMask(indices.mask().reduce(ee.Reducer.min()))
        counts = ee.Image.cat([count_observations(summer_collection(region, y), region).rename(f'inputs_{y}') for y in [2018, 2020]])
        image = indices.addBands(counts)
        reducer = ee.Reducer.mean().combine(ee.Reducer.count(), sharedInputs=True)
        for mode, radius in MODES.items():
            print(f'{fire}: {mode} extraction', flush=True)
            areas = points.map(lambda f: ee.Feature(f.geometry().buffer(radius, 0.1), f.toDictionary())) if radius else points
            result = image.reduceRegions(collection=areas, reducer=reducer, crs=projection, scale=30, tileScale=4).getInfo()
            all_rows.extend(dict(fire=fire, mode=mode, radius_m=radius, **f['properties']) for f in result['features'])
            pd.DataFrame(all_rows).to_csv(output / 'satellite_partial.csv', index=False)
    satellite = pd.DataFrame(all_rows)
    for band in ['nbr_2018', 'nbr_2020', 'ndvi_2020', 'dnbr']:
        for suffix in ['mean', 'count']:
            key = f'{band}_{suffix}'
            if key not in satellite:
                satellite[key] = np.nan
    geometry = pd.DataFrame(geometry_rows)
    geometry.to_csv(output / 'plot_locations.csv', index=False)
    return satellite.merge(frame, on=['fire', 'plot_id'], validate='many_to_one')


def summarize(frame):
    results = []
    for (fire, mode), group in frame.groupby(['fire', 'mode']):
        valid = group.loc[group.dnbr_mean.notna()].copy()
        valid['satellite_class'] = valid.dnbr_mean.map(dnbr_class)
        matrix = pd.crosstab(valid.cbi_class, valid.satellite_class).reindex(
            index=CLASSES, columns=CLASSES + ['Increased greenness'], fill_value=0).fillna(0).astype(int)
        correlations = {}
        for band in ['dnbr_mean', 'nbr_2020_mean', 'ndvi_2020_mean']:
            correlations[band] = float(spearmanr(valid.cbi, valid[band]).statistic) if valid.cbi.nunique() > 1 and valid[band].nunique() > 1 else None
        high = valid.cbi.ge(2)
        predicted = valid.dnbr_mean.gt(660)
        results.append(dict(fire=fire, mode=mode, n_total=len(group), n_valid=len(valid),
            missing_plot_ids=group.loc[group.dnbr_mean.isna(), 'plot_id'].tolist(),
            inside_perimeter=int(group.inside_perimeter.sum()),
            spearman=correlations, fixed_class_agreement=float((valid.cbi_class == valid.satellite_class).mean()) if len(valid) else None,
            confusion_rows=CLASSES, confusion_columns=matrix.columns.tolist(), confusion_counts=matrix.values.tolist(),
            high_class=dict(tp=int((high & predicted).sum()), fn=int((high & ~predicted).sum()),
                            fp=int((~high & predicted).sum()), tn=int((~high & ~predicted).sum()))))
    return results


def run(field_directory, output, samples, audit_only=False):
    output.mkdir(parents=True, exist_ok=False)
    frame, audit = audit_fields(field_directory)
    save(output / 'field_audit.json', audit)
    frame.to_csv(output / 'field_plots.csv', index=False)
    manifest = dict(complete=False, generated_utc=datetime.now(timezone.utc).isoformat(),
        script_sha256=sha(Path(__file__)), source_sha256={m: sha(REPO / 'src' / m) for m in ['config.py', 'imagery.py', 'observations.py']},
        sample_manifests={f: sha(samples / f"{f.lower().replace(' ', '_')}.json") for f in SITES},
        field_directory=str(field_directory.resolve()), audit_only=audit_only,
        method=dict(product='NASA HLS L30/S30 v002 surface reflectance', crs='EPSG:32606', scale_m=30,
            years=[2018, 2020], summer_start='06-15 inclusive', summer_end='08-15 exclusive',
            dnbr='(NBR_2018 - NBR_2020) * 1000', primary='plot_15m', sensitivities=MODES,
            plot_size_source='Smith et al. 2021 reports 30 m diameter',
            support='Common valid pre/post NBR and post NDVI; no imputation',
            survey_dates='Summer 2020 per provider; exact plot dates not supplied',
            class_comparison='Untuned existing dNBR thresholds; merge two moderate bins. Increased greenness stays separate.'),
        limitations=['Accessible, clustered plots are not representative of fire area.',
            '30 m HLS pixels and circular field footprints differ; partial-pixel means are weighted.',
            'Exact survey timing is unknown; summer composites are not matched to survey day.',
            'No fitted calibration or ordinary correlation p-values; associations are descriptive.',
            'Legacy satellite columns and historical Training flags are excluded.',
            '2020 severity observations do not validate 2020-2024 ecological recovery.'])
    save(output / 'manifest.json', manifest)
    if not audit_only:
        data = extract(frame, output, samples)
        data.to_csv(output / 'field_satellite.csv', index=False)
        save(output / 'summary.json', summarize(data))
    manifest['files'] = {p.name: sha(p) for p in sorted(output.iterdir()) if p.name != 'manifest.json'}
    manifest['complete'] = True
    save(output / 'manifest.json', manifest)
    print(f'Completed: {output}', flush=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--fields', type=Path, default=REPO.parent / 'Burn_severity_Survey_SHP')
    parser.add_argument('--samples', type=Path, default=REPO.parent / 'validation/multi_fire_comparison')
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--audit-only', action='store_true')
    args = parser.parse_args()
    run(args.fields, args.output, args.samples, args.audit_only)
