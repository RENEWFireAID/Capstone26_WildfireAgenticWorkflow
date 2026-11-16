import unittest

import numpy as np
import pandas as pd

from src.modeling import buffered_spatial_cv, calculate_recovery_slopes, compute_morans_i, fit_recovery_ols


class ModelingTests(unittest.TestCase):
    def test_spatial_validation_excludes_nearby_training_and_test_targets(self):
        x = np.arange(40, dtype=float)
        samples = pd.DataFrame({
            "x": x, "easting": x * 200, "northing": np.zeros(40),
            "recovery_slope": 2 + 3 * x,
        }, index=np.arange(40) + 100)
        predicted, folds = buffered_spatial_cv(samples, ["x"], 2000, 600)
        np.testing.assert_allclose(predicted.predicted, samples.recovery_slope)
        self.assertTrue((folds.min_train_test_m >= 600).all())
        self.assertEqual(folds.n_test.sum(), len(samples))
        # Perturb only the first held-out block: its predictions and baseline
        # must be independent of its targets, including any preprocessing.
        changed = samples.copy()
        held_out = predicted.block == 0
        changed.loc[held_out, "recovery_slope"] += 1000
        again, _ = buffered_spatial_cv(changed, ["x"], 2000, 600)
        np.testing.assert_allclose(again.loc[held_out, ["predicted", "baseline"]],
                                   predicted.loc[held_out, ["predicted", "baseline"]])
        self.assertAlmostEqual(predicted.loc[held_out, "baseline"].iloc[0],
                               samples.loc[samples.easting >= 2400, "recovery_slope"].mean())

    def test_spatial_validation_rejects_invalid_designs(self):
        samples = pd.DataFrame({"x": [1., 2.], "recovery_slope": [1., 2.],
                                "easting": [0., 1.], "northing": [0., 1.]})
        for block, buffer in [(0, 0), (10, -1), (10, 0), (1, 100)]:
            with self.assertRaises(ValueError):
                buffered_spatial_cv(samples, ["x"], block, buffer)

    def test_recovery_slopes_use_year_spacing(self):
        samples = pd.DataFrame({"NDVI_2020": [0.1, 0.5], "NDVI_2022": [0.3, 0.4]})
        slopes = calculate_recovery_slopes(samples, [2020, 2022])
        np.testing.assert_allclose(slopes, [0.1, -0.05])

    def test_ols_recovers_known_coefficients(self):
        x = np.arange(20, dtype=float)
        samples = pd.DataFrame({"x": x, "recovery_slope": 2 + 3 * x})
        model, vif = fit_recovery_ols(samples, ["x"])
        self.assertAlmostEqual(model.params["const"], 2)
        self.assertAlmostEqual(model.params["x"], 3)
        self.assertEqual(vif["variable"].tolist(), ["x"])

    def test_morans_i_returns_reproducible_permutation_result(self):
        coords = np.column_stack((np.linspace(-148.5, -148.4, 12), np.full(12, 65.0)))
        result = compute_morans_i(np.arange(12), coords, k_neighbors=2, permutations=99)
        self.assertGreater(result["morans_i"], 0)
        self.assertGreaterEqual(result["p_value"], 0.01)
        self.assertLessEqual(result["p_value"], 1)


if __name__ == "__main__":
    unittest.main()
