"""Canadian Forest Fire Weather Index (FWI) System.

Van Wagner (1987) equations, as in the cffdrs reference implementation. Inputs
are the 14:00 local observation: temperature (C), relative humidity (%), 10 m
wind (km/h) and the 24 h rain ending then (mm). The three moisture codes also
take yesterday's value.
"""

import math

# Day-length factors by month (index 0 is January), standard tables for >= 30N.
DMC_DAY_LENGTH = [6.5, 7.5, 9.0, 12.8, 13.9, 13.9, 12.4, 10.9, 9.4, 8.0, 7.0, 6.0]
DC_DAY_LENGTH = [-1.6, -1.6, -1.6, 0.9, 3.8, 5.8, 6.4, 5.0, 2.4, 0.4, -1.6, -1.6]

# Yesterday's values on the first day after snowmelt.
START_FFMC, START_DMC, START_DC = 85.0, 6.0, 15.0


def ffmc(prev: float, temp: float, rh: float, wind: float, rain: float) -> float:
    rh = min(max(rh, 0.0), 100.0)
    mo = 147.2 * (101.0 - prev) / (59.5 + prev)
    if rain > 0.5:
        rf = rain - 0.5
        wetting = 42.5 * rf * math.exp(-100.0 / (251.0 - mo)) * (1.0 - math.exp(-6.93 / rf))
        if mo > 150.0:
            wetting += 0.0015 * (mo - 150.0) ** 2 * rf**0.5
        mo = min(mo + wetting, 250.0)
    ed = 0.942 * rh**0.679 + 11.0 * math.exp((rh - 100.0) / 10.0) + 0.18 * (21.1 - temp) * (1.0 - math.exp(-0.115 * rh))
    if mo > ed:
        ko = 0.424 * (1.0 - (rh / 100.0) ** 1.7) + 0.0694 * wind**0.5 * (1.0 - (rh / 100.0) ** 8)
        m = ed + (mo - ed) * 10.0 ** (-ko * 0.581 * math.exp(0.0365 * temp))
    else:
        ew = 0.618 * rh**0.753 + 10.0 * math.exp((rh - 100.0) / 10.0) + 0.18 * (21.1 - temp) * (1.0 - math.exp(-0.115 * rh))
        if mo < ew:
            k1 = 0.424 * (1.0 - ((100.0 - rh) / 100.0) ** 1.7) + 0.0694 * wind**0.5 * (1.0 - ((100.0 - rh) / 100.0) ** 8)
            m = ew - (ew - mo) * 10.0 ** (-k1 * 0.581 * math.exp(0.0365 * temp))
        else:
            m = mo
    return min(max(59.5 * (250.0 - m) / (147.2 + m), 0.0), 101.0)


def dmc(prev: float, temp: float, rh: float, rain: float, month: int) -> float:
    rh = min(max(rh, 0.0), 100.0)
    if rain > 1.5:
        rw = 0.92 * rain - 1.27
        wmi = 20.0 + 280.0 / math.exp(0.023 * prev)
        if prev <= 33.0:
            b = 100.0 / (0.5 + 0.3 * prev)
        elif prev <= 65.0:
            b = 14.0 - 1.3 * math.log(prev)
        else:
            b = 6.2 * math.log(prev) - 17.2
        wmr = wmi + 1000.0 * rw / (48.77 + b * rw)
        prev = max(43.43 * (5.6348 - math.log(wmr - 20.0)), 0.0)
    drying = 1.894 * (max(temp, -1.1) + 1.1) * (100.0 - rh) * DMC_DAY_LENGTH[month - 1] * 1e-4
    return max(prev + drying, 0.0)


def dc(prev: float, temp: float, rain: float, month: int) -> float:
    if rain > 2.8:
        rw = 0.83 * rain - 1.27
        smi = 800.0 * math.exp(-prev / 400.0)
        prev = max(prev - 400.0 * math.log(1.0 + 3.937 * rw / smi), 0.0)
    pe = max((0.36 * (max(temp, -2.8) + 2.8) + DC_DAY_LENGTH[month - 1]) / 2.0, 0.0)
    return prev + pe


def isi(ffmc_value: float, wind: float) -> float:
    fm = 147.2 * (101.0 - ffmc_value) / (59.5 + ffmc_value)
    fuel = 91.9 * math.exp(-0.1386 * fm) * (1.0 + fm**5.31 / 4.93e7)
    return 0.208 * fuel * math.exp(0.05039 * wind)


def bui(dmc_value: float, dc_value: float) -> float:
    if dmc_value == 0.0 and dc_value == 0.0:
        return 0.0
    if dmc_value <= 0.4 * dc_value:
        value = 0.8 * dc_value * dmc_value / (dmc_value + 0.4 * dc_value)
    else:
        value = dmc_value - (1.0 - 0.8 * dc_value / (dmc_value + 0.4 * dc_value)) * (0.92 + (0.0114 * dmc_value) ** 1.7)
    return max(value, 0.0)


def fwi(isi_value: float, bui_value: float) -> float:
    if bui_value <= 80.0:
        bb = 0.1 * isi_value * (0.626 * bui_value**0.809 + 2.0)
    else:
        bb = 0.1 * isi_value * (1000.0 / (25.0 + 108.64 * math.exp(-0.023 * bui_value)))
    return bb if bb <= 1.0 else math.exp(2.72 * (0.434 * math.log(bb)) ** 0.647)
