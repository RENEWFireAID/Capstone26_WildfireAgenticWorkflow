"""Guard against misleading reference summaries and stale visual inputs."""
import hashlib
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from scripts.build_viewer import check_hash, load_references


class ViewerTests(unittest.TestCase):
    def reference(self):
        # High overall agreement can coexist with no high-class overlap.
        return dict(complete=True, fire='Example', support=dict(common_m2=100,
            mtbs_mapped_m2=110, intersection_m2=120), source_sha256={'config.py': '', 'imagery.py': ''},
            script_sha256='', comparisons=[dict(neither_m2=90, hls_only_m2=5,
                mtbs_only_m2=5, both_high_m2=0, paired_m2=100, agreement=0.9, high_iou=0)])

    def load(self, record):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory)
            (path / 'example.json').write_text(json.dumps(record))
            # Area/score consistency fixture; source hashing has its own test.
            with patch('scripts.build_viewer.check_hash'):
                return load_references(path)

    def test_overall_agreement_does_not_substitute_for_high_overlap(self):
        result = self.load(self.reference())['Example']['comparisons'][0]
        self.assertEqual(result['agreement'], 0.9)
        self.assertEqual(result['high_iou'], 0)

    def test_rejects_incorrect_overlap_or_changed_support(self):
        for change in ['overlap', 'support']:
            with self.subTest(change=change):
                record = self.reference()
                if change == 'overlap':
                    record['comparisons'][0]['high_iou'] = 0.9
                else:
                    record['comparisons'][0]['paired_m2'] = 99
                with self.assertRaises(AssertionError):
                    self.load(record)

    def test_rejects_changed_sample_bytes(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'samples.csv'
            path.write_bytes(b'NDVI\n0.5\n')
            digest = hashlib.sha256(path.read_bytes()).hexdigest()
            check_hash(path, digest)
            path.write_bytes(b'NDVI\n0.9\n')
            with self.assertRaisesRegex(ValueError, 'Changed input'):
                check_hash(path, digest)

    def test_missing_reference_directory_is_not_silently_ignored(self):
        with tempfile.TemporaryDirectory() as directory:
            with self.assertRaises(FileNotFoundError):
                load_references(Path(directory) / 'missing')
