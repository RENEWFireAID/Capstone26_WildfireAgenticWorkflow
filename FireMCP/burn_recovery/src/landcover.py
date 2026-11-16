"""
Pre-fire land cover extraction using Google Dynamic World V1 (10m).
"""

import ee
from .config import ASSETS, PEAK_SUMMER, DYNAMIC_WORLD_CLASSES


def get_prefire_landcover(
    geom: ee.Geometry,
    pre_fire_year: int
) -> ee.Image:
    """
    Extract pre-fire land cover from Google Dynamic World V1.
    
    Computes:
      - prefire_landcover: Discrete mode classification (0-8)
      - Probability bands for dominant classes: trees, shrub_and_scrub, grass
    """
    start_date = f"{pre_fire_year}-{PEAK_SUMMER['start_month']:02d}-{PEAK_SUMMER['start_day']:02d}"
    end_date = f"{pre_fire_year}-{PEAK_SUMMER['end_month']:02d}-{PEAK_SUMMER['end_day']:02d}"

    dw_col = (
        ee.ImageCollection(ASSETS["dynamic_world"])
        .filterBounds(geom)
        .filterDate(start_date, end_date)
    )

    # Dominant mode label
    mode_label = (
        dw_col.select("label")
        .reduce(ee.Reducer.mode())
        .clip(geom)
        .rename("prefire_landcover")
    )

    # Mean probabilities for dominant vegetation classes
    veg_prob = (
        dw_col.select(["trees", "shrub_and_scrub", "grass"])
        .mean()
        .clip(geom)
    )

    return mode_label.addBands(veg_prob)
