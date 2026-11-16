"""Per-pixel HLS input support, separate from the frozen model pipeline."""
import ee

from .config import ASSETS, PEAK_SUMMER
from .imagery import prep_hls_l30, prep_hls_s30


def summer_collection(geom: ee.Geometry, year: int) -> ee.ImageCollection:
    """Use the same dates and QA/band preparation as the analysis composite."""
    start = f"{year}-{PEAK_SUMMER['start_month']:02d}-{PEAK_SUMMER['start_day']:02d}"
    end = f"{year}-{PEAK_SUMMER['end_month']:02d}-{PEAK_SUMMER['end_day']:02d}"
    l30 = ee.ImageCollection(ASSETS['hls_l30']).filterBounds(geom).filterDate(start, end).map(prep_hls_l30)
    s30 = ee.ImageCollection(ASSETS['hls_s30']).filterBounds(geom).filterDate(start, end).map(prep_hls_s30)
    return l30.merge(s30)


def count_observations(collection: ee.ImageCollection, geom: ee.Geometry) -> ee.Image:
    """Count scenes with jointly unmasked Red/NIR/SWIR2, including true zeros.

    Counts describe QA-screened reflectance inputs, not independent observations,
    distinct dates, or guaranteed valid NDVI/NBR (indices can add masks). Negative
    reflectance remains eligible here because it also enters the band medians.
    """
    bands = ['Red', 'NIR', 'SWIR2']
    empty = ee.Image.constant([0, 0, 0]).rename(bands).updateMask(ee.Image(0))

    def joint_support(image):
        mask = image.select(bands).mask().reduce(ee.Reducer.min())
        return image.select('NIR').multiply(0).add(1).updateMask(mask).rename('observations')

    return (collection.merge(ee.ImageCollection([empty])).map(joint_support).sum()
            .unmask(0, sameFootprint=False).clip(geom).toUint16())
