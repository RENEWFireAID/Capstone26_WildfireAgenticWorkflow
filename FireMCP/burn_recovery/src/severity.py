"""
Burn severity index calculations (dNBR, RdNBR) and initial dNBR classification.
"""

import ee
from .config import SEVERITY_BINS


def compute_burn_severity(pre_fire_img: ee.Image, post_fire_img: ee.Image) -> ee.Image:
    """
    Compute Differenced Normalized Burn Ratio (dNBR) and Relativized dNBR (RdNBR).
    
    Equations:
      dNBR = (NBR_pre - NBR_post) * 1000
      RdNBR = dNBR / sqrt(|NBR_pre|)
      
    Also binned into initial dNBR severity categories requiring local validation:
      0: Enhanced Regrowth (< -100)
      1: Unburned (-100 to 100)
      2: Low Severity (101 to 270)
      3: Moderate-Low Severity (271 to 440)
      4: Moderate-High Severity (441 to 660)
      5: High Severity (> 660)
      
    Returns ee.Image with bands ['dNBR', 'RdNBR', 'severity_class'].
    """
    nbr_pre = pre_fire_img.select("NBR")
    nbr_post = post_fire_img.select("NBR")

    # Scaled dNBR (x1000 per USGS convention)
    dnbr = nbr_pre.subtract(nbr_post).multiply(1000).rename("dNBR")

    # RdNBR: adjusts for pre-fire vegetation density (Miller & Thode 2007)
    # Avoid divide by zero by clamping pre-fire NBR absolute value
    pre_abs_sqrt = nbr_pre.abs().sqrt().max(0.001)
    rdnbr = dnbr.divide(pre_abs_sqrt).rename("RdNBR")

    # Reclassify dNBR into discrete integer classes using SEVERITY_BINS
    # [-100, 100, 270, 440, 660]
    severity_class = (
        ee.Image(0)
        .where(dnbr.gte(SEVERITY_BINS[0]), 1)
        .where(dnbr.gt(SEVERITY_BINS[1]), 2)
        .where(dnbr.gt(SEVERITY_BINS[2]), 3)
        .where(dnbr.gt(SEVERITY_BINS[3]), 4)
        .where(dnbr.gt(SEVERITY_BINS[4]), 5)
        .rename("severity_class")
        .updateMask(dnbr.mask())
        .toInt8()
    )

    return dnbr.addBands([rdnbr, severity_class])
