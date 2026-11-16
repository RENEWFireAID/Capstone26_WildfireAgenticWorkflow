"""
Topographic covariate extraction (Elevation, Slope, Aspect, Northness) via USGS 3DEP.
"""

import math
import ee
from .config import ASSETS


def get_terrain_covariates(geom: ee.Geometry) -> ee.Image:
    """
    Extract topographic covariates from USGS 3DEP elevation data.
    
    Bands:
      - elevation: Elevation in meters
      - slope: Slope in degrees (0 to 90)
      - aspect: Aspect in degrees (0 to 360)
      - northness: Cosine of aspect (-1 = south-facing, +1 = north-facing)
    """
    # 3DEP coverage is incomplete in Alaska. Fill its gaps with global
    # Copernicus GLO-30 and preserve a native projection for terrain operations.
    fallback_collection = ee.ImageCollection(ASSETS["dem_fallback"])
    fallback = (
        fallback_collection.select("DEM")
        .mosaic()
        .setDefaultProjection(fallback_collection.first().select("DEM").projection())
    )
    dem_collection = ee.ImageCollection(ASSETS["dem"])
    dem = (
        dem_collection.select("elevation")
        .mosaic()
        .setDefaultProjection(dem_collection.first().select("elevation").projection())
        .unmask(fallback, sameFootprint=False)
        .rename("elevation")
    )

    slope = ee.Terrain.slope(dem).rename("slope")
    aspect = ee.Terrain.aspect(dem).rename("aspect")
    
    # Northness: cos(aspect * pi / 180) -> high values indicate cold, moist north-facing slopes
    northness = (
        aspect.multiply(math.pi / 180.0)
        .cos()
        .rename("northness")
    )

    # Neighborhood derivatives need elevation outside the requested boundary.
    # Clip only after calculating them to preserve edge pixels.
    return dem.addBands([slope, aspect, northness]).clip(geom)
