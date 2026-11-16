"""Local Solara interface for the three saved, audited fire cases."""
from functools import lru_cache
from html import escape

import numpy as np
import plotly.graph_objects as go
import solara
import solara.lab

from scripts.build_viewer import load_payload, load_rasters, load_references, read_json
from scripts.export_rgb_stretches import load_stretches
from scripts.demo_data import DEMO, load_field_summary, verify_bundle
from src.config import DNBR_RAMP

# Page supplies its own responsive layout.
Layout = solara.Div

MODELS = {
    'Environmental predictors': 'full',
    'Initial NDVI only': 'initial_NDVI_only',
    'Environmental predictors + initial NDVI': 'full_plus_initial_NDVI',
}
LAYERS = {
    'Before fire (2018)': 'rgb_2018', 'After fire (2020)': 'rgb_2020',
    'Later landscape (2024)': 'rgb_2024', 'Burn-related change (dNBR)': 'dnbr',
    'Summer greenness (NDVI)': 'ndvi', 'Usable image inputs': 'observations',
}
COLORS = ['#357454', '#82964c', '#b4a047', '#ca873b', '#b4543b', '#793e44']
BINS = ['Below -100', '-100 to 100', '100 to 270', '270 to 440', '440 to 660', 'Above 660']
STYLE = """
.v-application {font-family:system-ui,sans-serif!important;color:#263c34!important;background:#f5f6f3!important;width:100%;min-width:0}
.v-application__wrap,.solara-autorouter-content {min-width:0;max-width:100%}
.v-application .primary {background-color:#294e40!important;border-color:#294e40!important}
.v-toolbar {box-shadow:none!important;background:#294e40!important}
.v-navigation-drawer {background:#fff!important}
.fireaid-header {background:#294e40;color:white;padding:20px 28px;font-size:22px;font-weight:600}
.fireaid-shell {display:grid;grid-template-columns:260px minmax(0,1fr);align-items:start;min-height:100vh;width:100%;min-width:0}
.fireaid-main {max-width:1280px;width:100%;min-width:0;margin:auto;padding:28px 32px 48px;gap:20px!important;background:#f5f6f3!important}
.fireaid-main .v-sheet,.fireaid-main .v-tabs {min-width:0;max-width:100%}
.fireaid-main .v-input,.fireaid-sidebar .v-input {flex:0 0 auto!important;min-width:0}
.fireaid-two,.fireaid-controls {display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:24px;min-width:0}
.fireaid-main h1 {font-size:32px;font-weight:600;line-height:1.2;margin:0 0 8px}
.fireaid-main h2 {font-size:21px;font-weight:600;margin:0 0 8px}
.fireaid-main p {margin:0 0 10px;line-height:1.6}
.fireaid-subtitle,.fireaid-caption {color:#607168;font-size:14px}
.fireaid-note {background:#ecefe7;padding:16px 20px;border:0;border-radius:5px;line-height:1.6}
.fireaid-warning {background:#f3ead8;color:#654d29;padding:16px 20px;border:0;border-radius:5px;line-height:1.6}
.fireaid-metrics {display:grid;grid-template-columns:repeat(3,1fr);gap:12px}
.fireaid-metric {background:white;padding:16px 20px;border-radius:5px}
.fireaid-metric span {display:block;font-size:12px;color:#607168;margin-bottom:4px}
.fireaid-metric strong {font-size:25px;font-weight:600}
.fireaid-image {text-align:center;background:white;padding:16px;border-radius:5px}
.fireaid-image img {max-width:100%;max-height:490px;object-fit:contain}
.fireaid-legend {max-width:480px;margin:12px auto 4px;text-align:left;font-size:13px}
.fireaid-legend-bar {height:12px;border-radius:2px}
.fireaid-legend-labels {display:flex;justify-content:space-between;margin-top:3px}
.fireaid-table {overflow-x:auto;background:white;border-radius:5px;padding:8px 16px}
.fireaid-table table {width:100%;border-collapse:collapse;font-size:14px}
.fireaid-table th,.fireaid-table td {text-align:left;padding:12px 10px;border-bottom:1px solid #e5e9e1;white-space:nowrap}
.fireaid-table th {font-weight:600;color:#607168}
.fireaid-sidebar {padding:28px 20px;gap:20px!important;background:white!important;min-height:100vh;position:sticky;top:0}
.fireaid-sidebar h2 {font-size:19px;font-weight:600}
.fireaid-main .js-plotly-plot {width:100%!important}
@media(max-width:700px){.fireaid-shell,.fireaid-two,.fireaid-controls {grid-template-columns:1fr}.fireaid-sidebar {position:static;min-height:0;padding:18px}.fireaid-main {padding:20px 14px}.fireaid-main h1 {font-size:26px}.fireaid-metrics {grid-template-columns:1fr}.fireaid-image {padding:6px}}
"""


@lru_cache(maxsize=1)
def load_data():
    """Reuse the viewer's integrity checks; never refit or request imagery."""
    root = verify_bundle()
    directory = root / 'models'
    data = load_payload(directory)
    data['references'] = load_references(root / 'references')
    data['rasters'] = load_rasters(root / 'rasters', directory)
    stretch_directory = root / 'rgb'
    data['rgb_stretches'] = load_stretches(stretch_directory,
        root / 'rasters', directory)
    data['field_summary'] = load_field_summary(root)
    expected = set(data['fires'])
    if set(data['references']) != expected or set(data['rasters']) != expected:
        raise ValueError('Expected complete reference and raster bundles for all three fires')
    for name, reference in data['references'].items():
        manifest = read_json(directory / f"{name.lower().replace(' ', '_')}.json")
        if reference['metadata'] != manifest['recipe']['mtbs'] or reference['event_id'] != manifest['recipe']['case']['event_id']:
            raise ValueError(f'Reference event differs from saved samples: {name}')
    return data


def text_html(content, class_name=''):
    solara.HTML(unsafe_innerHTML=content, classes=[class_name] if class_name else [])


def table(columns, rows):
    head = ''.join(f'<th>{escape(str(c))}</th>' for c in columns)
    body = ''.join('<tr>' + ''.join(f'<td>{escape(str(v))}</td>' for v in row) + '</tr>' for row in rows)
    text_html(f'<table><thead><tr>{head}</tr></thead><tbody>{body}</tbody></table>', 'fireaid-table')


def metrics(items):
    text_html(''.join(f'<div class="fireaid-metric"><span>{escape(label)}</span><strong>{escape(value)}</strong></div>'
                      for label, value in items), 'fireaid-metrics')


def figure(traces, x_title='', y_title='', height=390, **layout):
    fig = go.Figure(traces)
    fig.update_layout(template='plotly_white', height=height, margin=dict(l=65, r=25, t=25, b=65),
                      font=dict(family='system-ui', color='#263c34'),
                      xaxis_title=x_title, yaxis_title=y_title, **layout)
    return fig


@solara.component_vue('viewer/plot_width.vue')
def PlotWidth(width=320, on_width=None):
    pass


@solara.component
def ResponsivePlot(fig, on_click=None):
    width, set_width = solara.use_state(320)
    display = go.Figure(fig)
    display.update_layout(width=max(240, width))
    with solara.Column(gap='0px', style={'width': '100%', 'min-width': '0'}) as container:
        PlotWidth(width=width, on_width=set_width)
        solara.FigurePlotly(display, on_click=on_click)
    return container


def trajectory_plot(data, fire, selected):
    traces = [go.Scatter(x=data['years'], y=t['mean'], mode='lines+markers',
                        name=f"{BINS[t['severity']]} (n={t['n']})", line=dict(color=COLORS[t['severity']]))
              for t in fire['trajectory']]
    if selected is not None:
        traces.append(go.Scatter(x=data['years'], y=fire['ndvi'][selected], mode='lines+markers',
                                name=f'Sample {selected}', line=dict(color='#263c34', width=4)))
    fig = figure(traces, 'Summer', 'NDVI', height=460, legend=dict(orientation='h', y=-0.25))
    fig.update_layout(margin=dict(l=65, r=25, t=25, b=130))
    fig.update_xaxes(dtick=1)
    fig.update_yaxes(range=[-0.2, 1])
    return fig


def sample_plot(fire, case, layer, name):
    settings = {
        'Burn-related change': (fire['dnbr'], -100, 800,
                               [[i / (len(DNBR_RAMP) - 1), c] for i, c in enumerate(DNBR_RAMP)], 'dNBR x1000'),
        'Greenness in 2024': ([v[4] for v in fire['ndvi']], -0.2, 1,
                             [[0, '#e5d7b3'], [.5, '#aed581'], [1, '#1b5e20']], 'NDVI'),
        'Observed NDVI slope': (case['observed'], -0.08, 0.08, 'RdYlGn', 'NDVI/year'),
        'Prediction error': (np.subtract(case['predicted'], case['observed']), -0.08, 0.08, 'RdBu_r', 'NDVI/year'),
    }
    values, low, high, scale, title = settings[layer]
    trace = go.Scatter(x=fire['x'], y=fire['y'], mode='markers',
                       marker=dict(size=5, color=values, cmin=low, cmax=high, colorscale=scale,
                                   colorbar=dict(title=title, thickness=12)),
                       customdata=list(range(len(fire['x']))),
                       hovertemplate='Sample %{customdata}<br>E %{x:.2f} km<br>N %{y:.2f} km<br>' + title + ': %{marker.color:.4f}<extra></extra>')
    fig = figure([trace], 'UTM easting (km)', 'UTM northing (km)', uirevision=name)
    fig.update_yaxes(scaleanchor='x', scaleratio=1)
    return fig


@solara.component
def Imagery(data, name):
    layer, set_layer = solara.use_state('Burn-related change (dNBR)')
    year, set_year = solara.use_state('2024')
    stretch, set_stretch = solara.use_state('Shared 2-98% stretch')
    record = data['rasters'][name]
    key = LAYERS[layer]
    seasonal = key in ['ndvi', 'observations']
    with solara.Column():
        text_html('<h2>Landscape and satellite observations</h2><p class="fireaid-subtitle">Compare the fire scar and annual greenness using the saved HLS imagery.</p>')
        with solara.Div(classes=['fireaid-controls'], style={'grid-template-columns': '1fr'} if not seasonal else {}):
            solara.Select('Layer', list(LAYERS), value=layer, on_value=set_layer)
            if seasonal:
                solara.Select('Summer', ['2018', '2020', '2021', '2022', '2023', '2024'], value=year, on_value=set_year)
        image = record['layers'][f'{key}_{year}' if seasonal else key]
        if key.startswith('rgb_') and name in data['rgb_stretches']:
            solara.Select('Natural-color contrast', ['Shared 2-98% stretch', 'Brighter fixed stretch', 'Original fixed stretch'],
                          value=stretch, on_value=set_stretch)
            if stretch != 'Original fixed stretch':
                mode = 'percentile' if stretch == 'Shared 2-98% stretch' else 'brighter'
                image = data['rgb_stretches'][name]['layers'][f'{mode}_{key.split("_")[1]}']
            text_html('Contrast changes the picture only. The percentile option clips the darkest and brightest sampled RGB values using one range across all fires and years. NDVI, dNBR and model values are unchanged.', 'fireaid-note')
        text_html(f'<img src="{image["url"]}" alt="{escape(name + ": " + image["description"], quote=True)}">', 'fireaid-image')
        if 'palette' in image['visualization']:
            settings = image['visualization']
            palette = ','.join('#' + c.lstrip('#') for c in settings['palette'])
            unit = {'dnbr': 'dNBR x1000', 'ndvi': 'NDVI', 'observations': 'QA-screened image inputs'}[key]
            text_html(f'<div class="fireaid-legend-bar" style="background:linear-gradient(to right,{palette})"></div>'
                      f'<div class="fireaid-legend-labels"><span>{settings["min"]}</span><span>{escape(unit)}</span><span>{settings["max"]}</span></div>', 'fireaid-legend')
        text_html(f'<p>{escape(image["description"])}</p><p>Grid north is up. Every preview uses the same extent for this fire. Pictures are display-resampled; statistics use the 30 m grid. Blank areas are masked or outside the boundary.</p>', 'fireaid-caption')
        corners = np.asarray(record['projected_bounds']['coordinates'][0]) / 1000
        text_html(f"{escape(record['crs'])}: easting {corners[:, 0].min():.1f} to {corners[:, 0].max():.1f} km; northing {corners[:, 1].min():.1f} to {corners[:, 1].max():.1f} km.", 'fireaid-caption')
        with solara.Details('Imagery support by summer'):
            table(['Summer', 'Median image inputs', 'No inputs', '1-2 inputs', 'Valid NDVI'],
                  [[y, f"{s['counts']['observations_p50']:.1f}",
                    *[f'{100*s[k]:.2f}%' for k in ['zero_fraction', 'one_or_two_fraction', 'ndvi_valid_fraction']]]
                   for y, s in record['years'].items()])
            text_html('Counts are QA-screened image inputs with jointly available red, NIR and SWIR2 bands. They are not unique dates or independent observations. Counts include zeros; the low-count flag is descriptive.', 'fireaid-caption')


@solara.component
def Greenness(data, name, period, model):
    selection, set_selection = solara.use_state(None)
    selected = selection[1] if selection is not None and selection[0] == name else None
    solara.use_effect(lambda: set_selection(None), [name])
    layer, set_layer = solara.use_state('Burn-related change')
    fire = data['fires'][name]
    case = fire['cases'][f'{period}:{MODELS[model]}']

    def select(event):
        points = event.get('points', {}).get('point_indexes', [])
        if points and 0 <= points[0] < len(fire['x']):
            set_selection((name, int(points[0])))

    text_html('<h2>Annual greenness</h2><p class="fireaid-subtitle">Click a sampled location to compare its NDVI with the severity-group curves.</p>')
    text_html(f'Observed slopes use {period}-2024. Prediction errors use {escape(model.lower())}, selected in Models.', 'fireaid-caption')
    with solara.Div(classes=['fireaid-two']):
        with solara.Column():
            solara.Select('Color locations by', ['Burn-related change', 'Greenness in 2024', 'Observed NDVI slope', 'Prediction error'], value=layer, on_value=set_layer)
            ResponsivePlot(sample_plot(fire, case, layer, name), on_click=select)
            text_html(f"{escape(fire['context']['crs'])}. Points are sampled values at nominal 200 m scale. Prediction error is predicted minus observed. Color limits stay fixed across fires.", 'fireaid-caption')
        with solara.Column():
            ResponsivePlot(trajectory_plot(data, fire, selected))
            solara.Button('Clear selected sample', on_click=lambda: set_selection(None), disabled=selected is None)
            if selected is not None:
                slope = case['observed'][selected]
                text_html(f'Sample {selected}: fitted {period}-2024 slope is {slope:+.4f} NDVI/year.', 'fireaid-note')
    text_html('Curves are sample means within provisional dNBR bins, using the same locations every year. They are not area-weighted fire averages. Increasing NDVI indicates spectral greening; it does not establish tree recovery or restored forest structure.', 'fireaid-note')


@solara.component
def Models(data, name, period, set_period, model, set_model):
    fire = data['fires'][name]
    case = fire['cases'][f'{period}:{MODELS[model]}']
    text_html('<h2>Can a model trained on two fires predict the third?</h2>')
    with solara.Div(classes=['fireaid-controls']):
        solara.Select('NDVI slope period', ['2020', '2021'], value=period, on_value=set_period)
        solara.Select('Predictors', list(MODELS), value=model, on_value=set_model)
    text_html(f'Target: annual NDVI slope from {period} through 2024. Trained on {escape(case["training_fires"])}.', 'fireaid-caption')
    metrics([('Held-out-fire R²', f"{case['r2']:.3f}"), ('Model RMSE (NDVI/year)', f"{case['rmse']:.4f}"),
             ('Baseline RMSE (NDVI/year)', f"{case['baseline_rmse']:.4f}")])
    better = case['rmse'] < case['baseline_rmse']
    text_html(('This model has lower error than the training-mean baseline.' if better else
               'This model has higher error than the training-mean baseline on this fire.') +
              ' Negative R² means worse squared error than predicting the held-out fire\'s mean. R² is not percent accuracy.',
              'fireaid-note' if better else 'fireaid-warning')
    with solara.Div(classes=['fireaid-two']):
        bounds = [min(case['observed'] + case['predicted']), max(case['observed'] + case['predicted'])]
        ResponsivePlot(figure([
            go.Scatter(x=case['observed'], y=case['predicted'], mode='markers', marker=dict(size=5, color='#357454', opacity=.5), name='Held-out samples'),
            go.Scatter(x=bounds, y=bounds, mode='lines', line=dict(color='#8a7760', dash='dash'), name='Perfect prediction')],
            'Observed slope (NDVI/year)', 'Predicted slope (NDVI/year)', showlegend=False))
        ResponsivePlot(figure([go.Bar(x=['Selected model', 'Training-mean baseline'], y=[case['rmse'], case['baseline_rmse']],
                                         marker_color=['#357454', '#abb8a8'])], y_title='RMSE (NDVI/year)'))
    text_html(f"{100*case['outside_fraction']:.1f}% of test samples have at least one predictor outside its training range. Marginal ranges can miss gaps in joint predictor combinations. All fits remain spatially dependent. Climate describes the completed recovery period; these models are retrospective.", 'fireaid-note')
    if MODELS[model] != 'full':
        text_html('Initial NDVI comes from 2020. It is also part of the 2020-2024 slope calculation. Compare the later window to inspect this shared-year sensitivity; a higher earlier score does not establish independent forecasting skill.', 'fireaid-warning')
    with solara.Details('Environmental predictors'):
        text_html('dNBR, elevation, terrain slope, northness, pre-fire tree-class probability, temperature anomaly and precipitation anomaly. Tree probability is not tree-cover percentage. Coarse climate values are not independent 30 m observations.')


@solara.component
def Validation(data, name):
    diagnostic, set_diagnostic = solara.use_state('Held-out residual maps')
    ref = data['references'][name]
    text_html('<h2>Severity comparison with MTBS</h2><p class="fireaid-subtitle">Agreement between satellite products, evaluated on the same valid pixels.</p>')
    table(['HLS imagery', 'High cutoff', 'High vs other agreement', 'High-severity IoU'],
          [['Summer composites' if r['method'] == 'summer_2018_2020' else 'MTBS calendar dates', r['threshold'],
            f"{100*r['agreement']:.2f}%", 'Undefined' if r['high_iou'] is None else f"{100*r['high_iou']:.2f}%"]
           for r in ref['comparisons']])
    text_html(f"Common support covers {100*ref['support']['common_m2']/ref['support']['intersection_m2']:.2f}% of the boundary intersection. Reference dates: {escape(ref['dates']['Pre_ID'][0])} to {escape(ref['dates']['Post_ID'][0])}. IoU is the intersection divided by the union of high-severity areas.", 'fireaid-caption')
    text_html('MTBS and HLS share satellite inputs. Date matching does not reproduce identical processing or establish field accuracy. Swan Lake also changes the reference baseline from 2018 to 2017.', 'fireaid-note')
    text_html('<h2>What the diagnostics show</h2>')
    if name == 'Shovel Creek':
        text_html('Shovel transfer failure is reproducible. About 79% of its sample locations lie outside the training fires\' joint climate hull. Training climate predictors are strongly correlated. Errors remain spatially structured, and slopes change with the recovery window. These are diagnostic leads, not a proven ecological cause.', 'fireaid-warning')
        images = {'Held-out residual maps': 'shovel_residual_maps.png', 'Joint climate support': 'joint_climate_support.png',
                  'Recovery-window sensitivity': 'slope_stability.png', 'MTBS class comparison': 'mtbs_class_iou.png'}
        solara.Select('Diagnostic figure', list(images), value=diagnostic, on_value=set_diagnostic)
        path = DEMO / 'diagnostics' / images[diagnostic]
        if path.is_file():
            solara.Image(path.read_bytes(), width='100%')
            text_html('Saved diagnostics use the environmental model and the periods printed in each figure; they do not change with the Models selectors. Residuals use observed minus predicted, the opposite sign from the greenness-tab error layer.', 'fireaid-caption')
    else:
        text_html('Full environmental models outperform the training-mean baseline in both windows for this fire, but all test locations have climate predictors outside training ranges. Residual spatial dependence remains. This does not establish reliable statewide prediction.', 'fireaid-note')
    text_html('<h2>Field burn-severity check</h2>')
    field = data['field_summary']
    rows = [r for r in field['comparisons'] if r['fire'] == name and r['mode'] == 'plot_15m']
    if rows:
        row = rows[0]
        high = row['high_class']
        table(['Survey plots', 'CBI vs dNBR rank correlation', 'Fixed-class agreement', 'High-CBI plots detected'],
              [[row['n_valid'], f"{row['spearman']['dnbr_mean']:.3f}", f"{100*row['fixed_class_agreement']:.1f}%",
                f"{high['tp']} of {high['tp'] + high['fn']}"]])
        text_html('Santosh\'s summer 2020 CBI scores are compared with HLS means within a 15 m radius, matching the reported 30 m plot diameter. Correlations include unburned controls and describe ordering, not accuracy. Existing dNBR thresholds miss many high-CBI plots and remain uncalibrated.', 'fireaid-warning')
        text_html('Plots were selected for access and severity coverage. Exact survey dates are unavailable. This checks severity at selected plots, not fire-wide accuracy or later ecological recovery. Only aggregate statistics are included; raw field records stay local.', 'fireaid-caption')
        with solara.Details('Plot-footprint sensitivity'):
            table(['Footprint', 'Rank correlation', 'Fixed-class agreement'],
                  [[r['mode'], f"{r['spearman']['dnbr_mean']:.3f}", f"{100*r['fixed_class_agreement']:.1f}%"]
                   for r in field['comparisons'] if r['fire'] == name])
    else:
        text_html('The supplied field surveys cover Shovel Creek and Nugget Creek. No Swan Lake field-reference comparison is included.', 'fireaid-note')
    with solara.Details('Sources and interpretation'):
        solara.Markdown('''
- [NASA HLS L30/S30 v002](https://hls.gsfc.nasa.gov/): 30 m reflectance, QA-screened summer composites, dNBR and NDVI.
- [Alaska Fire History](https://fire.ak.blm.gov/predsvcs/maps.php): saved fire boundaries through the shared Earth Engine asset. Swan's boundary incorporates MTBS.
- [USFS/USGS MTBS](https://www.mtbs.gov/): severity reference and event metadata.
- [Dynamic World](https://developers.google.com/earth-engine/datasets/catalog/GOOGLE_DYNAMICWORLD_V1): pre-fire class probabilities.
- [USGS 3DEP](https://developers.google.com/earth-engine/datasets/catalog/USGS_3DEP_10m_collection) and [Copernicus GLO-30](https://developers.google.com/earth-engine/datasets/catalog/COPERNICUS_DEM_GLO30_2024_1): terrain.
- [TerraClimate](https://developers.google.com/earth-engine/datasets/catalog/IDAHO_EPSCOR_TERRACLIMATE): summer climate anomalies versus 1991-2020.

Summer imagery uses June 15 inclusive to August 15 exclusive. Severity compares 2018 and 2020; recovery uses NDVI from 2020 through 2024. Coverage measures availability, not accuracy. Ordinary OLS significance, ecological recovery and Alaska-wide accuracy remain unestablished.

Copernicus DEM © DLR e.V. 2010-2014 and © Airbus Defence and Space GmbH 2014-2018, provided under COPERNICUS by the European Union and ESA; all rights reserved.
''')
        text_html(f"Notebook run completed {escape(data['run_completed_utc'])}. Local files are checked for source/sample fingerprints, slopes, displayed metrics and raster integrity when loaded. No model refit or new imagery is requested.", 'fireaid-caption')


@solara.component
def Page():
    name, set_name = solara.use_state('Shovel Creek')
    period, set_period = solara.use_state('2020')
    model, set_model = solara.use_state('Environmental predictors')
    tab, set_tab = solara.use_state(0)
    try:
        data = load_data()
    except (OSError, ValueError, AssertionError, KeyError) as error:
        solara.Error('Saved results could not be opened or failed verification. See the terminal and README for setup instructions.')
        print(f'FireAid data error: {error}')
        return
    with solara.Column(gap='0px') as layout:
        solara.Title('FireAid | Alaska fire recovery')
        solara.Style(STYLE)
        text_html('FireAid', 'fireaid-header')
        with solara.Div(classes=['fireaid-shell']):
            with solara.Column(classes=['fireaid-sidebar']):
                text_html('<h2>Alaska fire recovery</h2>')
                solara.Select('Fire', list(data['fires']), value=name, on_value=set_name)
                text_html('Three fires from 2019. Satellite observations through 2024.', 'fireaid-caption')
                text_html('Research prototype using saved notebook results.', 'fireaid-note')
            with solara.Column(classes=['fireaid-main']):
                text_html(f'<h1>{escape(name)}</h1><p class="fireaid-subtitle">Burn-related spectral change and post-fire greenness</p>')
                fire = data['fires'][name]
                metrics([('Sampled locations', f"{len(fire['x']):,}"),
                         ('Complete input coverage', f"{100*fire['context']['coverage_30m']:.2f}%"), ('Recovery period', '2020-2024')])
                with solara.lab.Tabs(value=tab, on_value=set_tab, slider_color='#294e40'):
                    for title in ['Imagery', 'Greenness', 'Models', 'Validation']:
                        solara.lab.Tab(title)
                # Keep widget communications alive while changing tabs.
                with solara.Div(classes=['fireaid-tab-panel'], style={'display': 'block' if tab == 0 else 'none'}):
                    Imagery(data, name)
                with solara.Div(classes=['fireaid-tab-panel'], style={'display': 'block' if tab == 1 else 'none'}):
                    Greenness(data, name, period, model)
                with solara.Div(classes=['fireaid-tab-panel'], style={'display': 'block' if tab == 2 else 'none'}):
                    Models(data, name, period, set_period, model, set_model)
                with solara.Div(classes=['fireaid-tab-panel'], style={'display': 'block' if tab == 3 else 'none'}):
                    Validation(data, name)
    return layout
