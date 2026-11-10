"""Google Earth Engine vegetation-trend logic, ported from Forest Trend Mapper.

Source:  https://github.com/Sumana18/Forest-trend-mapper (file: app_v1.0.0.py)
Author:  Sumana Sahoo
DOI:     10.5281/zenodo.19860349
Article: https://www.mdpi.com/1999-4907/16/5/777

Only the Earth Engine computation is reused here; the Solara/geemap UI layer of
the original application is not included. The functions below are kept verbatim
so they stay easy to diff against upstream.

---------------------------------------------------------------------------
MIT License

Copyright (c) 2026 Sumana Sahoo

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
---------------------------------------------------------------------------
"""

import ee

CLIMATE_BANDS = {
    "Summer Max Temp (°C)": "Temp",
    "Summer Max Temp (°C)(1-yr Lag)": "Temp_Lag1",
    "Summer Total Precip (mm)": "Precip",
    "Summer Total Precip (mm)(1-yr Lag)": "Precip_Lag1",
    "Spring Snow Water Equiv (mm)": "SWE",
    "Summer Soil Moisture (mm)": "Soil",
}


def apply_scale_factors(img):
    optical = img.select("SR_B.*").multiply(0.0000275).add(-0.2)
    return img.addBands(optical, None, True)


def fmask(img):
    qa = img.select("QA_PIXEL")
    cloud = qa.bitwiseAnd(1 << 3).neq(0)
    shadow = qa.bitwiseAnd(1 << 4).neq(0)
    snow = qa.bitwiseAnd(1 << 5).neq(0)
    water = qa.bitwiseAnd(1 << 7).neq(0)

    mask = cloud.Or(shadow).Or(snow).Or(water).Not()
    return img.updateMask(mask)


def add_all_indices(img):
    ndvi = img.normalizedDifference(["NIR", "Red"]).rename("NDVI")
    nbr = img.normalizedDifference(["NIR", "SWIR2"]).rename("NBR")
    ndmi = img.normalizedDifference(["NIR", "SWIR1"]).rename("NDMI")
    return img.addBands([ndvi, nbr, ndmi])


def prep_oli(img):
    img = apply_scale_factors(img)
    renamed = img.select(
        ["SR_B2", "SR_B3", "SR_B4", "SR_B5", "SR_B6", "SR_B7", "QA_PIXEL"],
        ["Blue", "Green", "Red", "NIR", "SWIR1", "SWIR2", "QA_PIXEL"],
    )
    renamed = fmask(renamed)
    return add_all_indices(renamed).toFloat()


def prep_etm(img):
    img = apply_scale_factors(img)
    renamed = img.select(
        ["SR_B1", "SR_B2", "SR_B3", "SR_B4", "SR_B5", "SR_B7", "QA_PIXEL"],
        ["Blue", "Green", "Red", "NIR", "SWIR1", "SWIR2", "QA_PIXEL"],
    )
    renamed = fmask(renamed)
    return add_all_indices(renamed).toFloat()


def get_landsat_jja(roi, start_year, end_year):
    start = ee.Date.fromYMD(start_year, 1, 1)
    end = ee.Date.fromYMD(end_year, 12, 31)

    # Define the summer filter first!
    summer_filter = ee.Filter.calendarRange(6, 8, "month")

    # Apply the summer filter BEFORE calling .map(prep_oli) to avoid winter crashes
    l9 = (
        ee.ImageCollection("LANDSAT/LC09/C02/T1_L2")
        .filterBounds(roi)
        .filterDate(start, end)
        .filter(summer_filter)
        .map(prep_oli)
    )
    l8 = (
        ee.ImageCollection("LANDSAT/LC08/C02/T1_L2")
        .filterBounds(roi)
        .filterDate(start, end)
        .filter(summer_filter)
        .map(prep_oli)
    )
    l7 = (
        ee.ImageCollection("LANDSAT/LE07/C02/T1_L2")
        .filterBounds(roi)
        .filterDate(start, end)
        .filter(summer_filter)
        .map(prep_etm)
    )
    l5 = (
        ee.ImageCollection("LANDSAT/LT05/C02/T1_L2")
        .filterBounds(roi)
        .filterDate(start, end)
        .filter(summer_filter)
        .map(prep_etm)
    )

    return l9.merge(l8).merge(l7).merge(l5)


def get_annual_composites(col, roi, start_year, end_year, reducer_type):
    years = ee.List.sequence(start_year, end_year)

    # Climate Data including 1-year lag
    climate_col = (
        ee.ImageCollection("IDAHO_EPSCOR/TERRACLIMATE")
        .filterBounds(roi)
        .filterDate(
            ee.Date.fromYMD(start_year - 1, 1, 1), ee.Date.fromYMD(end_year, 12, 31)
        )
    )

    def create_annual(y):
        y = ee.Number(y)
        y_prev = y.subtract(1)

        # Landsat Summer Composite
        yc = col.filter(ee.Filter.calendarRange(y, y, "year")).select(
            ["NDVI", "NBR", "NDMI"]
        )
        empty_veg = ee.Image(0).selfMask().select([0, 0, 0], ["NDVI", "NBR", "NDMI"])

        # Handling the reducer type (median vs max)
        if reducer_type == "median":
            reduced_yc = yc.median()
        elif reducer_type == "mean":
            reduced_yc = yc.mean()
        else:
            reduced_yc = yc.max()

        veg_comp = (
            ee.Image(ee.Algorithms.If(yc.size().gt(0), reduced_yc, empty_veg))
            .rename(["NDVI", "NBR", "NDMI"])
            .clip(roi)
        )

        # Climate Bands
        y_clim = climate_col.filter(ee.Filter.calendarRange(y, y, "year"))
        y_clim_lag = climate_col.filter(ee.Filter.calendarRange(y_prev, y_prev, "year"))
        empty_clim = (
            ee.Image(0)
            .selfMask()
            .select([0, 0, 0, 0, 0, 0], list(CLIMATE_BANDS.values()))
        )

        def get_clim_bands():
            temp = (
                y_clim.filter(ee.Filter.calendarRange(6, 8, "month"))
                .select("tmmx")
                .mean()
                .multiply(0.1)
                .rename("Temp")
            )
            precip = (
                y_clim.filter(ee.Filter.calendarRange(6, 8, "month"))
                .select("pr")
                .sum()
                .rename("Precip")
            )
            swe = (
                y_clim.filter(ee.Filter.calendarRange(3, 5, "month"))
                .select("swe")
                .mean()
                .rename("SWE")
            )
            soil = (
                y_clim.filter(ee.Filter.calendarRange(6, 8, "month"))
                .select("soil")
                .mean()
                .multiply(0.1)
                .rename("Soil")
            )

            temp_lag = (
                y_clim_lag.filter(ee.Filter.calendarRange(6, 8, "month"))
                .select("tmmx")
                .mean()
                .multiply(0.1)
                .rename("Temp_Lag1")
            )
            precip_lag = (
                y_clim_lag.filter(ee.Filter.calendarRange(6, 8, "month"))
                .select("pr")
                .sum()
                .rename("Precip_Lag1")
            )
            return ee.Image([temp, precip, swe, soil, temp_lag, precip_lag])

        clim_comp = ee.Image(
            ee.Algorithms.If(y_clim.size().gt(0), get_clim_bands(), empty_clim)
        ).clip(roi)
        year_band = ee.Image.constant(y).rename("year").toFloat()

        return (
            veg_comp.addBands(clim_comp)
            .addBands(year_band)
            .set({"year": y, "system:time_start": ee.Date.fromYMD(y, 7, 15).millis()})
            .toFloat()
        )

    return ee.ImageCollection.fromImages(years.map(create_annual))
