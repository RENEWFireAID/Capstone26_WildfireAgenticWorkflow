"""Live tests for input-support counts and parity with the analysis imagery."""
import os
import unittest

import ee

from src.config import GEE_PROJECT
from src.imagery import get_peak_summer_hls, prep_hls_l30
from src.observations import count_observations, summer_collection


@unittest.skipUnless(os.environ.get('FIREAID_EE_TESTS') == '1', 'requires Earth Engine access')
class ObservationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        ee.Initialize(project=GEE_PROJECT)

    def test_counts_joint_band_support_cloud_masks_and_true_zeros(self):
        geom = ee.Geometry.Point([-148.3, 65]).buffer(100)
        bands = ['Red', 'NIR', 'SWIR2']
        valid = ee.Image.constant([0.1, 0.2, 0.3]).rename(bands)
        missing_red = valid.updateMask(ee.Image.constant([0, 1, 1]))
        negative_red = ee.Image.constant([-0.1, 0.2, 0.3]).rename(bands)
        cloudy = prep_hls_l30(ee.Image.constant([0.1, 0.1, 0.1, 0.2, 0.2, 0.3, 2]).rename(
            ['B2', 'B3', 'B4', 'B5', 'B6', 'B7', 'Fmask'])).select(bands)
        scenes = ee.ImageCollection([valid, missing_red, negative_red, cloudy])
        values = ee.Image([
            count_observations(scenes, geom).rename('joint'),
            count_observations(ee.ImageCollection([]), geom).rename('empty'),
            count_observations(ee.ImageCollection([cloudy]), geom).rename('cloud_only'),
        ]).reduceRegion(ee.Reducer.first(), geom, 30).getInfo()
        # Negative reflectance remains input support; it does not guarantee a valid index.
        self.assertEqual(values, {'joint': 2, 'empty': 0, 'cloud_only': 0})

    def test_summer_collection_matches_existing_composite(self):
        geom = ee.Geometry.Rectangle([432000, 7200000, 433000, 7201000], 'EPSG:32606', False)
        bands = ['Red', 'NIR', 'SWIR2']
        existing = get_peak_summer_hls(geom, 2018).select(bands)
        rebuilt = summer_collection(geom, 2018).median().select(bands).clip(geom)
        difference = existing.unmask(-999).subtract(rebuilt.unmask(-999)).abs().reduceRegion(
            ee.Reducer.max(), geom, 30, crs='EPSG:32606').getInfo()
        self.assertEqual(difference, {b: 0 for b in bands})
        valid = existing.select('NIR').reduceRegion(ee.Reducer.count(), geom, 30, crs='EPSG:32606').getInfo()
        self.assertGreater(valid['NIR'], 100)
