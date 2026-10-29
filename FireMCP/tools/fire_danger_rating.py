"""Alaska fire danger adjective ratings from the AICC charts.

Spring uses the Grass Adjective Rating (Apr 1 - May 31) and summer the Spruce
Adjective Rating (Jun 1 - Sep 30), per the Alaska Interagency Fire Danger
Operating Plan. Other months have no rating.
"""

from typing import Optional

LOW, MODERATE, HIGH, VERY_HIGH, EXTREME = "Low", "Moderate", "High", "Very High", "Extreme"
_BY_FWI = "by_fwi"  # Very High if FWI < 40, Extreme if FWI >= 40

_L, _M, _H, _V, _X = LOW, MODERATE, HIGH, VERY_HIGH, _BY_FWI

# Rows by FFMC (and temperature once FFMC >= 93); columns by BUI <40, 40-60,
# 60-90, 90-110, >=110.
_SPRUCE = [
    [_L, _L, _L, _L, _L],  # FFMC < 80
    [_L, _L, _L, _L, _M],  # 80-82
    [_L, _L, _L, _M, _M],  # 82-84
    [_L, _M, _M, _M, _H],  # 84-86
    [_M, _M, _H, _H, _H],  # 86-89
    [_H, _H, _H, _V, _V],  # 89-90
    [_H, _H, _V, _V, _V],  # 90-92
    [_H, _H, _V, _X, _X],  # 92-93
    [_H, _H, _X, _X, _X],  # >= 93, below 75F
    [_H, _X, _X, _X, _X],  # >= 93, 75-80F
    [_X, _X, _X, _X, _X],  # >= 93, 80F and up
]

# Rows by FFMC (and FWI once FFMC >= 92); columns by ISI <2, 2-6, 6-8, >=8.
# The chart's last header reads "ISI <= 8", taken as ">= 8". Its undefined grey
# cells take the next defined cell to the right in the same row.
_GRASS = [
    [LOW, MODERATE, MODERATE, VERY_HIGH],  # FFMC < 86
    [MODERATE, MODERATE, HIGH, VERY_HIGH],  # 86-92
    [VERY_HIGH, VERY_HIGH, VERY_HIGH, VERY_HIGH],  # >= 92, FWI < 36
    [VERY_HIGH, VERY_HIGH, VERY_HIGH, EXTREME],  # >= 92, FWI >= 36
]


def table_for(month: int) -> Optional[str]:
    if month in (4, 5):
        return "grass"
    if 6 <= month <= 9:
        return "spruce"
    return None


def _band(value: float, edges: list[float]) -> int:
    return sum(value >= edge for edge in edges)


def _spruce_row(ffmc: float, temp_f: float) -> int:
    row = _band(ffmc, [80, 82, 84, 86, 89, 90, 92, 93])
    return row if row < 8 else 8 + _band(temp_f, [75, 80])


def rate(table: str, *, ffmc: float, isi: float, bui: float, fwi: float, temp_f: float) -> str:
    if table == "spruce":
        cell = _SPRUCE[_spruce_row(ffmc, temp_f)][_band(bui, [40, 60, 90, 110])]
        if cell == _BY_FWI:
            return EXTREME if fwi >= 40 else VERY_HIGH
        return cell
    if table == "grass":
        row = _band(ffmc, [86, 92])
        if row == 2 and fwi >= 36:
            row = 3
        return _GRASS[row][_band(isi, [2, 6, 8])]
    raise ValueError(f"unknown rating table: {table}")
