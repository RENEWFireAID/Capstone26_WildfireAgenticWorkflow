"""Opt-in live EE tests: FIREAID_EE_TESTS=1 python -m unittest discover -s tests -v."""
import os
import unittest

import ee

from src.config import GEE_PROJECT
from src.imagery import mask_hls, prep_hls_l30, prep_hls_s30
from src.modeling import sample_fire_scar
from src.terrain import get_terrain_covariates


@unittest.skipUnless(os.environ.get("FIREAID_EE_TESTS") == "1", "requires Earth Engine access")
class ImageryTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        ee.Initialize(project=GEE_PROJECT)

    def values(self, image):
        return image.reduceRegion(
            ee.Reducer.first(), ee.Geometry.Point([-148.3, 65]), 30
        ).getInfo()

    def test_sampling_uses_requested_metric_grid(self):
        projection = ee.Projection("EPSG:32606").atScale(30)
        region = ee.Geometry.Rectangle([430000, 7200000, 432000, 7202000], "EPSG:32606", False)
        stack = ee.Image.constant([1, 0.25]).rename(["severity_class", "NBR"]).toFloat()
        stack = stack.addBands(stack.select("severity_class").toInt(), overwrite=True)
        for tile_scale in [1, 4]:
            with self.subTest(tile_scale=tile_scale):
                samples = sample_fire_scar(stack, region, scale=200, max_points=60,
                    projection=projection, tile_scale=tile_scale)
                self.assertEqual(len(samples), 10)
                for coordinate in ["easting", "northing"]:
                    for value in samples[coordinate]:
                        self.assertAlmostEqual(value % 200, 100, places=2)
                self.assertTrue(samples.NBR.eq(0.25).all())

    def test_terrain_derivatives_do_not_lose_boundary_neighbors(self):
        region = ee.Geometry.Rectangle([432000, 7200000, 434000, 7202000], "EPSG:32606", False)
        direct = get_terrain_covariates(region).select("slope")
        buffered = get_terrain_covariates(region.buffer(500)).select("slope").clip(region)
        difference = direct.unmask(-999).subtract(buffered.unmask(-999)).abs().reduceRegion(
            ee.Reducer.max(), region, 10, crs="EPSG:32606"
        ).getInfo()
        self.assertEqual(difference["slope"], 0)
        # A shared nodata region would be a vacuous pass.
        valid = direct.reduceRegion(ee.Reducer.count(), region, 10, crs="EPSG:32606").getInfo()
        self.assertGreater(valid["slope"], 35000)

    def test_mask_preserves_reflectance_and_rejects_contamination(self):
        bands = []
        # Bit 0 is reserved in v002; bits 1–5 flag unusable observations here.
        for flag in (0, 1, 2, 4, 8, 16, 32):
            scene = ee.Image.constant(0.25).rename("B4").addBands(
                ee.Image.constant(flag).rename("Fmask")
            )
            bands.append(mask_hls(scene).unmask(-999).rename(f"qa_{flag}"))
        values = self.values(ee.Image(bands))
        for flag in (0, 1):
            self.assertAlmostEqual(values[f"qa_{flag}"], 0.25)
        for flag in (2, 4, 8, 16, 32):
            self.assertEqual(values[f"qa_{flag}"], -999)

    def test_sensor_band_mapping_preserves_nir_and_swir2(self):
        l30 = ee.Image.constant([0.1, 0.15, 0.2, 0.6, 0.4, 0.3, 0]).rename(
            ["B2", "B3", "B4", "B5", "B6", "B7", "Fmask"]
        )
        s30 = l30.rename(["B2", "B3", "B4", "B8A", "B11", "B12", "Fmask"])
        for prepare, scene in ((prep_hls_l30, l30), (prep_hls_s30, s30)):
            prepared = prepare(scene)
            values = self.values(prepared.addBands(
                prepared.normalizedDifference(["NIR", "SWIR2"]).rename("NBR")
            ))
            self.assertAlmostEqual(values["NIR"], 0.6)
            self.assertAlmostEqual(values["SWIR2"], 0.3)
            self.assertAlmostEqual(values["NBR"], 1 / 3)
