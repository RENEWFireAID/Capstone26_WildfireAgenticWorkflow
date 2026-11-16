"""Shared RGB limits must not depend on fire area or hide missing images."""
import unittest

import numpy as np
import pandas as pd

from scripts.export_rgb_stretches import BANDS, FIRES, YEARS, shared_limits


class StretchTests(unittest.TestCase):
    def frame(self):
        return pd.DataFrame([dict(fire=f, year=y, **{b: x for b in BANDS})
            for f in FIRES for y in YEARS for x in np.linspace(.01, .2, 100)])

    def test_same_range_for_all_images_and_equal_weights(self):
        frame = self.frame()
        limits = shared_limits(frame)
        self.assertEqual(limits['equal_pixels_per_image'], 100)
        self.assertEqual(limits['channel_values'], 2700)
        self.assertAlmostEqual(limits['min'], .0138)
        self.assertAlmostEqual(limits['max'], .1962)

    def test_rejects_missing_image_or_nonfinite_reflectance(self):
        frame = self.frame()
        with self.assertRaises(ValueError):
            shared_limits(frame.loc[~((frame.fire == FIRES[0]) & (frame.year == YEARS[0]))])
        frame.loc[0, 'Red'] = np.inf
        with self.assertRaises(ValueError):
            shared_limits(frame)


if __name__ == '__main__':
    unittest.main()
