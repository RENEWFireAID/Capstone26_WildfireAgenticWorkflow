"""Protect field-score meanings, identifiers, units and class boundaries."""
import tempfile
import unittest
from pathlib import Path

import shapefile

from scripts.validate_field_cbi import SITES, audit_fields, cbi_class, dnbr_class, number

WKT = 'PROJCS["WGS_1984_UTM_Zone_6N",PARAMETER["Central_Meridian",-147],PARAMETER["False_Easting",500000],UNIT["Meter",1]]'


class FieldTests(unittest.TestCase):
    def fixture(self, directory, scores=('0', '2.5'), ids=('P1', 'P2'), wkt=WKT):
        for _, (relative, id_field, cbi_field) in SITES.items():
            path = Path(directory) / relative
            path.parent.mkdir(parents=True)
            with shapefile.Writer(str(path), shapeType=shapefile.POINT) as writer:
                writer.field(id_field, 'C', 20)
                writer.field(cbi_field, 'C', 10)
                writer.field('Ove_B', 'C', 10)
                for i, (plot, score) in enumerate(zip(ids, scores)):
                    writer.point(430000 + i * 30, 7200000)
                    writer.record(plot, score, '1000' if i else 'NA')
            path.with_suffix('.prj').write_text(wkt)

    def test_missing_is_not_unburned(self):
        for text in ['NA', 'na', '', ' ']:
            self.assertIsNone(number(text))
        self.assertEqual(number('00'), 0)
        self.assertEqual(number(' 1.808 '), 1.808)
        for text in ['NaN', 'inf', '23/9']:
            with self.assertRaises(ValueError):
                number(text)

    def test_classes_keep_field_and_satellite_scales_distinct(self):
        self.assertEqual([cbi_class(x) for x in [0, .01, 1.499, 1.5, 1.999, 2, 3]],
                         ['Unburned', 'Low', 'Low', 'Moderate', 'Moderate', 'High', 'High'])
        self.assertEqual([dnbr_class(x) for x in [-101, -100, 100, 101, 270, 271, 660, 661]],
                         ['Increased greenness', 'Unburned', 'Unburned', 'Low', 'Low', 'Moderate', 'Moderate', 'High'])
        for x in [-.01, 3.01]:
            with self.assertRaises(ValueError):
                cbi_class(x)

    def test_percentage_error_does_not_rewrite_valid_total_cbi(self):
        with tempfile.TemporaryDirectory() as directory:
            self.fixture(directory)
            frame, audit = audit_fields(Path(directory))
            self.assertEqual(frame.cbi.tolist(), [0, 2.5, 0, 2.5])
            for site in audit.values():
                self.assertTrue(any(w.get('value') == 1000 for w in site['warnings']))
                self.assertEqual(site['records'][1]['raw_attributes']['Ove_B'], '1000')

    def test_rejects_duplicate_ids_missing_scores_and_wrong_crs(self):
        for settings in [dict(ids=('P1', 'P1')), dict(scores=('0', 'NA')),
                         dict(scores=('0', '3.5')), dict(wkt='WGS 84 geographic degrees')]:
            with self.subTest(settings=settings), tempfile.TemporaryDirectory() as directory:
                self.fixture(directory, **settings)
                with self.assertRaises(ValueError):
                    audit_fields(Path(directory))


if __name__ == '__main__':
    unittest.main()
