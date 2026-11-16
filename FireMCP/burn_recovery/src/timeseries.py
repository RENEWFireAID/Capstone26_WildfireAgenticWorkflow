"""
Multi-year vegetation recovery tracking and post-fire climate anomaly extraction.
"""

import ee
from .config import ASSETS, PEAK_SUMMER
from .imagery import get_peak_summer_hls


def get_multiyear_recovery_stack(
    geom: ee.Geometry,
    post_fire_start_year: int,
    end_year: int = 2024
) -> ee.Image:
    """
    Build annual NDVI from summer median-reflectance composites.
    This is not a median or maximum of individual-scene NDVI values.
    Bands: ['NDVI_2020', 'NDVI_2021', ...]
    """
    years = list(range(post_fire_start_year, end_year + 1))
    band_list = []

    for yr in years:
        summer_comp = get_peak_summer_hls(geom, yr)
        ndvi_band = summer_comp.select("NDVI").rename(f"NDVI_{yr}")
        band_list.append(ndvi_band)

    return ee.Image(band_list)


def get_terraclimate_anomalies(
    geom: ee.Geometry,
    post_fire_start_year: int,
    end_year: int = 2024
) -> ee.Image:
    """
    Compute post-fire mean summer maximum temperature (tmmx) and mean annual
    summer precipitation total (pr) anomalies relative to 1991-2020.
    
    Bands:
      - temp_anomaly: Mean summer max temp anomaly (°C)
      - precip_anomaly: Mean annual JJA precipitation-total anomaly (mm)
    """
    tc = ee.ImageCollection(ASSETS["terraclimate"]).filterBounds(geom)

    # 30-year baseline (1991-2020) summer months (June=6, July=7, August=8)
    summer_filter = ee.Filter.calendarRange(6, 8, "month")
    baseline_tc = (
        tc.filter(ee.Filter.calendarRange(1991, 2020, "year"))
        .filter(summer_filter)
    )
    base_tmmx = baseline_tc.select("tmmx").mean().multiply(0.1)  # Scale to °C
    # Three complete JJA months per year: mean monthly precipitation * 3 is the
    # mean annual JJA total.
    base_pr = baseline_tc.select("pr").mean().multiply(3)

    # Post-fire recovery window summer months
    post_tc = (
        tc.filter(ee.Filter.calendarRange(post_fire_start_year, end_year, "year"))
        .filter(summer_filter)
    )
    post_tmmx = post_tc.select("tmmx").mean().multiply(0.1)
    post_pr = post_tc.select("pr").mean().multiply(3)

    temp_anom = post_tmmx.subtract(base_tmmx).clip(geom).rename("temp_anomaly")
    precip_anom = post_pr.subtract(base_pr).clip(geom).rename("precip_anomaly")

    return temp_anom.addBands(precip_anom)
