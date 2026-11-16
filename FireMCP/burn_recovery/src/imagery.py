"""
Imagery ingestion and preprocessing using NASA Harmonized Landsat-Sentinel (HLS).
Includes Fmask cloud/shadow/snow masking and spectral index calculations.
"""

import ee
from .config import ASSETS, PEAK_SUMMER


def mask_hls(img: ee.Image) -> ee.Image:
    """
    Mask clouds, cloud shadows, snow, and open water using the HLS Fmask band.
    Fmask bits: 1 cloud, 2 adjacent to cloud/shadow, 3 cloud shadow,
    4 snow/ice, and 5 water.
    Earth Engine HLS v002 bands are already in reflectance units. The 0.0001
    scale factor applies to NASA's packed files, not these ingested EE bands.
    https://developers.google.com/earth-engine/datasets/catalog/NASA_HLS_HLSL30_v002
    """
    qa = img.select("Fmask")
    bad_bits = sum(1 << bit for bit in range(1, 6))
    clear_mask = qa.bitwiseAnd(bad_bits).eq(0)
    
    return img.select(["B.*"]).updateMask(clear_mask)


def prep_hls_l30(img: ee.Image) -> ee.Image:
    """Prepare Landsat 8/9 HLS scene (L30) with standard band names."""
    m = mask_hls(img)
    # L30: B2=Blue, B3=Green, B4=Red, B5=NIR, B6=SWIR1, B7=SWIR2
    return m.select(
        ["B2", "B3", "B4", "B5", "B6", "B7"],
        ["Blue", "Green", "Red", "NIR", "SWIR1", "SWIR2"]
    )


def prep_hls_s30(img: ee.Image) -> ee.Image:
    """Prepare Sentinel-2 HLS scene (S30) with standard band names matching L30."""
    m = mask_hls(img)
    # S30: B2=Blue, B3=Green, B4=Red, B8A=Narrow NIR (matches L8 B5), B11=SWIR1, B12=SWIR2
    return m.select(
        ["B2", "B3", "B4", "B8A", "B11", "B12"],
        ["Blue", "Green", "Red", "NIR", "SWIR1", "SWIR2"]
    )


def get_peak_summer_hls(
    geom: ee.Geometry,
    year: int,
    start_date: str | None = None,
    end_date: str | None = None
) -> ee.Image:
    """
    Create a QA-masked median composite of NASA HLS (L30 + S30) for peak summer.
    Computes and appends NBR and NDVI bands.
    """
    s_date = start_date or f"{year}-{PEAK_SUMMER['start_month']:02d}-{PEAK_SUMMER['start_day']:02d}"
    e_date = end_date or f"{year}-{PEAK_SUMMER['end_month']:02d}-{PEAK_SUMMER['end_day']:02d}"

    l30_col = (
        ee.ImageCollection(ASSETS["hls_l30"])
        .filterBounds(geom)
        .filterDate(s_date, e_date)
        .map(prep_hls_l30)
    )
    s30_col = (
        ee.ImageCollection(ASSETS["hls_s30"])
        .filterBounds(geom)
        .filterDate(s_date, e_date)
        .map(prep_hls_s30)
    )

    merged = l30_col.merge(s30_col)
    composite = merged.median().clip(geom)

    # Compute Normalized Burn Ratio (NIR - SWIR2) / (NIR + SWIR2)
    nbr = composite.normalizedDifference(["NIR", "SWIR2"]).rename("NBR")
    # Compute Normalized Difference Vegetation Index (NIR - Red) / (NIR + Red)
    ndvi = composite.normalizedDifference(["NIR", "Red"]).rename("NDVI")

    return composite.addBands([nbr, ndvi])
