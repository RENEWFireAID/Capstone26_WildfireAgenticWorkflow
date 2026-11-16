"""Check the portable demo, including files absent from acquisition manifests."""
from pathlib import Path

import numpy as np

from scripts.build_viewer import REPO, check_hash, read_json

DEMO = REPO / 'demo'


def verify_bundle(directory=DEMO):
    directory = Path(directory)
    manifest = read_json(directory / 'manifest.json')
    expected = set(manifest['files'])
    actual = {p.relative_to(directory).as_posix() for p in directory.rglob('*')
              if p.is_file() and p != directory / 'manifest.json'}
    if actual != expected:
        raise ValueError('Demo files are missing or unexpected; restore the saved bundle')
    for relative, digest in manifest['files'].items():
        path = Path(relative)
        if path.is_absolute() or '..' in path.parts:
            raise ValueError('Invalid demo file path')
        check_hash(directory / path, digest)
    return directory


def load_field_summary(directory=DEMO):
    """Validate aggregate arithmetic without exposing private plot records."""
    record = read_json(Path(directory) / 'field_summary.json')
    if not record['complete']:
        raise ValueError('Incomplete field comparison')
    check_hash(REPO / 'scripts/validate_field_cbi.py', record['script_sha256'])
    for name, digest in record['source_sha256'].items():
        check_hash(REPO / 'src' / name, digest)
    groups = {(row['fire'], row['mode']) for row in record['comparisons']}
    expected = {(fire, mode) for fire in ['Shovel Creek', 'Nugget Creek']
                for mode in ['center', 'plot_15m', 'buffer_20m', 'buffer_30m']}
    if groups != expected or len(record['comparisons']) != len(expected):
        raise ValueError('Missing or duplicate field comparison')
    for row in record['comparisons']:
        n = row['n_valid']
        if not 0 < n <= row['n_total']:
            raise ValueError('Invalid field support')
        counts = np.asarray(row['confusion_counts'])
        if counts.shape != (4, 5) or not np.issubdtype(counts.dtype, np.integer) or (counts < 0).any() or counts.sum() != n:
            raise ValueError('Invalid field confusion counts')
        np.testing.assert_allclose(row['fixed_class_agreement'], np.trace(counts[:, :4]) / n, rtol=0, atol=1e-12)
        high = row['high_class']
        expected_high = [counts[3, 3], counts[3].sum() - counts[3, 3], counts[:3, 3].sum(), counts[:3].sum() - counts[:3, 3].sum()]
        np.testing.assert_array_equal([high[k] for k in ['tp', 'fn', 'fp', 'tn']], expected_high)
        for rho in row['spearman'].values():
            if not np.isfinite(rho) or not -1 <= rho <= 1:
                raise ValueError('Invalid rank correlation')
    return record
