"""Portable demo integrity and honest aggregate field reporting."""
import hashlib
import json
import tempfile
import unittest
from pathlib import Path

from scripts.demo_data import load_field_summary, verify_bundle


class DemoTests(unittest.TestCase):
    def fixture(self, directory):
        root = Path(directory)
        (root / 'scores.csv').write_text('rmse\n0.02\n')
        digest = hashlib.sha256((root / 'scores.csv').read_bytes()).hexdigest()
        (root / 'manifest.json').write_text(json.dumps({'files': {'scores.csv': digest}}))
        return root

    def test_rejects_changed_missing_and_unexpected_files(self):
        for mode in ['changed', 'missing', 'unexpected']:
            with self.subTest(mode=mode), tempfile.TemporaryDirectory() as directory:
                root = self.fixture(directory)
                verify_bundle(root)
                if mode == 'changed':
                    (root / 'scores.csv').write_text('rmse\n0.001\n')
                elif mode == 'missing':
                    (root / 'scores.csv').unlink()
                else:
                    (root / 'field_plots.csv').write_text('private records')
                with self.assertRaises(ValueError):
                    verify_bundle(root)

    def test_packaged_demo_contains_complete_fingerprint_checked_results(self):
        root = verify_bundle()
        self.assertTrue((root / 'models/within_predictions.csv.gz').is_file())
        self.assertFalse(any(root.rglob('*.shp')))
        self.assertFalse(any(root.rglob('field_plots.csv')))
        self.assertFalse(any(root.rglob('field_satellite.csv')))

    def test_aggregate_field_check_preserves_high_severity_misses(self):
        record = load_field_summary()
        rows = {r['fire']: r for r in record['comparisons'] if r['mode'] == 'plot_15m'}
        self.assertEqual(rows['Shovel Creek']['n_valid'], 52)
        self.assertEqual(rows['Shovel Creek']['high_class']['fn'], 9)
        self.assertEqual(rows['Nugget Creek']['n_valid'], 28)
        self.assertEqual(rows['Nugget Creek']['high_class']['fn'], 5)

    def test_rejects_an_inconsistent_field_confusion_matrix(self):
        record = load_field_summary()
        record['comparisons'][0]['fixed_class_agreement'] = 1
        with tempfile.TemporaryDirectory() as directory:
            (Path(directory) / 'field_summary.json').write_text(json.dumps(record))
            with self.assertRaises(AssertionError):
                load_field_summary(Path(directory))
