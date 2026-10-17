import json
from pathlib import Path
from typing import Any, Dict, List, Optional

import joblib
import pandas as pd

MODELS_DIR = Path(__file__).parent.parent / "models"
MODEL_NAMES = ["random_forest", "xgboost", "svm"]

_bundles = {name: joblib.load(MODELS_DIR / f"{name}.joblib") for name in MODEL_NAMES}
FEATURES: List[str] = _bundles["random_forest"]["features"]

# Training medians, overall and per discovery month, written by train.py.
_medians = json.loads((MODELS_DIR / "feature_medians.json").read_text())

# SEASONAL_SCORE by discovery month (index 0 is January), from
# calculate_fire_weather_risk in the ANL bootcamp notebook 1.
MONTH_SCORES = [1, 1, 3, 9, 17, 20, 20, 15, 7, 3, 1, 1]


INPUT_SPEC = {
    "weather": "Aggregates over the prior 7, 30 and 90 days. Celsius, millimetres, "
    "metres per second, solar radiation in MJ/m2 per day, and humidity as a fraction 0-1.",
    "thresholds": "The three day counts cover the prior 7 days only: days above "
    "25C, days above 8 m/s wind, days below 0.25 humidity.",
    "scores": {
        "IGNITION_WEATHER_SCORE": "0-15, from the fire's recorded cause",
        "SEASONAL_SCORE": "1-20",
        "ASPECT_SCORE": "3-15",
        "ELEVATION_SCORE": "1-15",
        "SLOPE_WIND_SCORE": "2-10",
        "SPREAD_RATE_SCORE": "0-19, from acres burned per day",
    },
    "note": "IGNITION_WEATHER_SCORE and SPREAD_RATE_SCORE are only known after a "
    "fire has burned. Values outside these ranges are extrapolation.",
}


def predict_risk(
    features: Dict[str, float],
    model: str = "random_forest",
    month: Optional[int] = None,
) -> Dict[str, Any]:
    """Predict a risk category. Features left out are filled with the training
    median for that month, or across all fires if the month had too few."""
    if model not in _bundles:
        return {"ok": False, "error": "unknown model", "models": MODEL_NAMES}

    unknown = sorted(set(features) - set(FEATURES))
    if unknown:
        return {
            "ok": False,
            "error": "unknown features",
            "unknown": unknown,
            "features": FEATURES,
            "input_spec": INPUT_SPEC,
        }

    medians = dict(_medians["by_month"].get(str(month), _medians["all"]))
    if month in range(1, 13):
        medians["SEASONAL_SCORE"] = MONTH_SCORES[month - 1]
    defaulted = {f: medians[f] for f in FEATURES if f not in features}
    bundle = _bundles[model]
    classes = bundle["classes"]
    row = pd.DataFrame([{**defaulted, **features}])[FEATURES]
    probabilities = bundle["model"].predict_proba(row)[0]
    # The category is the most likely class, so it always matches the bars.
    # SVM's predict() can disagree with its own probabilities.
    best = int(probabilities.argmax())
    return {
        "ok": True,
        "model": model,
        "category": classes[best],
        "confidence": round(float(probabilities[best]), 4),
        "probabilities": {
            c: round(float(p), 4) for c, p in zip(classes, probabilities)
        },
        "medians_from": f"month {month}"
        if str(month) in _medians["by_month"]
        else "all fires (pass month for that month's typical values)"
        if month is None
        else f"all fires (month {month} had too few training fires)",
        "defaulted": defaulted,
    }
