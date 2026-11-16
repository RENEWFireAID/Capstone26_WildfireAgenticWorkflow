# FireAid

A research prototype for comparing burn severity and post-fire greenness in the 2019 Shovel Creek, Swan Lake and Nugget Creek fires in Alaska.

## Run the app

Clone the repository and open a terminal in its folder. Use Python 3.11 in a virtual environment or the existing `fireaidenv`.

```bash
python -m pip install -r requirements.txt
python -m solara run app.py
```

Open [localhost:8765](http://localhost:8765). Keep the terminal running; Ctrl+C stops the app.

The saved demo needs no Earth Engine account or field-data folder. The app checks file fingerprints and displayed calculations before loading results. Restart after changing saved files. Solara may download frontend assets on first use.

## What to look at

- **Imagery:** before-fire, after-fire and 2024 natural-color previews, dNBR, annual NDVI and usable image counts. Contrast choices use a shared range across fires and years and affect display brightness only.
- **Greenness:** sampled locations and annual NDVI curves. Click a location to inspect its trajectory. Group means describe the severity-stratified sample, not area-weighted fire averages.
- **Models:** train on two fires and test on the third. Compare environmental predictors, initial NDVI, both slope periods and a training-mean baseline.
- **Validation:** MTBS agreement, transfer diagnostics and aggregate comparisons with Santosh Panda's summer 2020 CBI surveys.

## Methods and current results

HLS summer composites use June 15 inclusive to August 15 exclusive. NDVI is calculated from median reflectance. dNBR is the 2018 minus 2020 NBR difference, multiplied by 1000. The fixed severity bins are provisional.

Recovery models fit an annual NDVI slope over 2020-2024 or 2021-2024. Predictors include dNBR, elevation, terrain slope, northness, pre-fire tree-class probability and summer climate anomalies. Climate summarizes 2020-2024 relative to 1991-2020, so these are retrospective comparisons.

Environmental-model results on each held-out fire:

| Fire | Sample locations | R², 2020-2024 | R², 2021-2024 |
| --- | ---: | ---: | ---: |
| Shovel Creek | 1,573 | -0.020 | -1.144 |
| Swan Lake | 1,708 | 0.314 | 0.102 |
| Nugget Creek | 1,053 | 0.027 | 0.233 |

Shovel Creek performs worse than the training-mean baseline in both periods. Swan Lake and Nugget Creek perform better. Negative R² means worse squared error than predicting the held-out fire's mean; it is not percent accuracy. Spatial dependence and climate extrapolation remain substantial.

The field severity check uses 52 Shovel Creek and 28 Nugget Creek plots, with a primary 15 m radius footprint. CBI-dNBR rank correlations are 0.805 and 0.876 including unburned controls, or 0.598 and 0.657 among burned plots. The current high-severity cutoff detects only 5 of 14 and 2 of 7 high-CBI plots. Exact survey dates are unavailable, and accessible plots do not represent the whole fire. Raw surveys and plot-level results remain local.

NDVI greening does not establish restored forest structure. MTBS comparison measures agreement between satellite products. Including initial 2020 NDVI in a model of the 2020-2024 slope creates shared-year coupling; the later period is a sensitivity check. Ordinary OLS significance and statewide forecasting accuracy are unestablished.

## Code and data

- `app.py` and `viewer/`: Solara interface and standalone HTML template.
- `src/`: Earth Engine imagery, severity, terrain, land-cover and climate processing; local sampling and OLS helpers.
- `notebooks/`: Shovel Creek prototype, three-fire comparison and local field validation.
- `scripts/`: exports, viewer generation and independent result verification.
- `demo/`: satellite samples, model results, preview images, original acquisition manifests and aggregate field statistics. Spatial predictions are gzip-compressed CSV.

New processing requires Earth Engine access to the project and boundary asset in `src/config.py`. Notebook 02 records source fingerprints; use a fresh output directory after scientific code changes. Notebook 03 requires local surveys and field-extraction results. Export scripts list options with `--help`.

The stack is Python, Earth Engine, NumPy, pandas, SciPy, statsmodels, scikit-learn, Plotly and Solara. Notebooks also use geemap, ipyleaflet, Matplotlib and PyShp.

## Checks

```bash
python -m unittest discover -s tests
python scripts/verify_results.py
```

The verifier independently refits all 18 transfer models and 6,822 spatial folds across 108 designs, checks sample/source fingerprints, reconstructs slopes and split distances, and verifies preview integrity. It checks aggregate field arithmetic; recomputing field correlations requires the private plot records. Six tests require live Earth Engine access and are skipped by default.

For an offline HTML viewer, run `python scripts/build_viewer.py` and open `fireaid_viewer.html`. This fallback uses the original natural-color previews.

## Sources

- [NASA HLS L30](https://developers.google.com/earth-engine/datasets/catalog/NASA_HLS_HLSL30_v002) and [S30](https://developers.google.com/earth-engine/datasets/catalog/NASA_HLS_HLSS30_v002): 30 m surface reflectance and QA flags.
- [Alaska Fire History](https://fire.ak.blm.gov/predsvcs/maps.php) and [MTBS](https://www.mtbs.gov/): boundaries, event metadata and satellite severity reference.
- [Dynamic World](https://developers.google.com/earth-engine/datasets/catalog/GOOGLE_DYNAMICWORLD_V1): pre-fire class probabilities, not tree-cover percentage.
- [USGS 3DEP](https://developers.google.com/earth-engine/datasets/catalog/USGS_3DEP_10m_collection): terrain. [Copernicus GLO-30](https://developers.google.com/earth-engine/datasets/catalog/COPERNICUS_DEM_GLO30_2024_1) is the configured fallback; a coverage check found it unnecessary inside the three current fire footprints.
- [TerraClimate](https://developers.google.com/earth-engine/datasets/catalog/IDAHO_EPSCOR_TERRACLIMATE): coarse monthly climate; sampled values are not independent 30 m climate observations.
- [Smith et al. (2021)](https://doi.org/10.3390/rs13101966): Alaska CBI field methods. Their imagery and assessment design differ from this pipeline.
- [Roberts et al. (2017)](https://doi.org/10.1111/ecog.02881): validation for structured data. Our 2/4 km blocks and 0/1/2 km buffers are exploratory sensitivities, not established independence distances.
- [Fiore et al. (2020)](https://doi.org/10.1088/1748-9326/ab9c4c): interpreting NDVI and vegetation composition in Alaska.

Copernicus DEM © DLR e.V. 2010-2014 and © Airbus Defence and Space GmbH 2014-2018, provided under COPERNICUS by the European Union and ESA; all rights reserved.
