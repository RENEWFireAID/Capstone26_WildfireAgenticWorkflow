"""
Configuration constants, GEE asset IDs, thresholds, and visualization palettes.
"""

# Default Earth Engine Google Cloud Project
GEE_PROJECT = "epscor-ioc"

# Earth Engine Dataset Assets
ASSETS = {
    # Fire Perimeters
    "mtbs": "USFS/GTAC/MTBS/burned_area_boundaries/v1",
    "ak_fire_history": "projects/ee-ssahoo2/assets/AK_fire_history",
    # Harmonized Imagery (NASA HLS, 30m)
    "hls_l30": "NASA/HLS/HLSL30/v002",
    "hls_s30": "NASA/HLS/HLSS30/v002",
    # Legacy Landsat (Pre-2013 fallback)
    "landsat8": "LANDSAT/LC08/C02/T1_L2",
    "landsat7": "LANDSAT/LE07/C02/T1_L2",
    "landsat5": "LANDSAT/LT05/C02/T1_L2",
    # Land Cover & Topography
    "dynamic_world": "GOOGLE/DYNAMICWORLD/V1",
    "dem": "USGS/3DEP/10m_collection",
    "dem_fallback": "COPERNICUS/DEM/GLO30_2024_1",
    # Climate
    "terraclimate": "IDAHO_EPSCOR/TERRACLIMATE",
}

# Imagery window: June 15 inclusive to August 15 exclusive (not full JJA).
PEAK_SUMMER = {
    "start_month": 6,
    "start_day": 15,
    "end_month": 8,
    "end_day": 15,
}

# Provisional dNBR thresholds (scaled by 1000); not calibrated for this fire.
# Do not apply these bins to RdNBR or equate them with MTBS event classes.
# Bins: [-Inf, -100, 100, 270, 440, 660, Inf]
SEVERITY_BINS = [-100, 100, 270, 440, 660]
SEVERITY_CLASSES = [
    "Enhanced Regrowth",
    "Unburned",
    "Low Severity",
    "Moderate-Low",
    "Moderate-High",
    "High Severity",
]
SEVERITY_PALETTE = [
    "#006400",  # Enhanced Regrowth (Dark green)
    "#70a800",  # Unburned (Light green)
    "#ffff00",  # Low Severity (Yellow)
    "#fa8400",  # Moderate-Low (Orange)
    "#e60000",  # Moderate-High (Red)
    "#7a0000",  # High Severity (Dark maroon)
]

# Continuous dNBR Color Palette (for smooth raster rendering)
DNBR_RAMP = ["#006400", "#70a800", "#ffffb2", "#fecc5c", "#fd8d3c", "#f03b20", "#bd0026", "#7a0000"]

# Dynamic World Land Cover Classes & Official Palettes
DYNAMIC_WORLD_CLASSES = [
    "water",
    "trees",
    "grass",
    "flooded_vegetation",
    "crops",
    "shrub_and_scrub",
    "built",
    "bare",
    "snow_and_ice",
]
DYNAMIC_WORLD_PALETTE = [
    "#419BDF",  # water
    "#397D49",  # trees
    "#88B053",  # grass
    "#7A87C6",  # flooded_vegetation
    "#E49635",  # crops
    "#DFC35A",  # shrub_and_scrub
    "#C4281B",  # built
    "#A59B8F",  # bare
    "#B39FE1",  # snow_and_ice
]

# Spatial Subsampling Parameters (mitigate spatial autocorrelation)
SPATIAL_SAMPLE_SCALE_METERS = 200  # nominal sampling scale; not minimum spacing
MAX_SAMPLE_POINTS = 2500           # target point count per fire scar
