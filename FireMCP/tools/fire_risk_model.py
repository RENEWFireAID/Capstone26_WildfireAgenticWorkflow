from pathlib import Path
from typing import Any, Dict, List

import joblib
import pandas as pd

MODELS_DIR = Path(__file__).parent.parent / "models"
MODEL_NAMES = ["random_forest", "xgboost", "svm"]

_bundles = {name: joblib.load(MODELS_DIR / f"{name}.joblib") for name in MODEL_NAMES}
FEATURES: List[str] = _bundles["random_forest"]["features"]


INPUT_SPEC = {
    "weather": "Aggregates over the prior 7, 30 and 90 days. Celsius, millimetres, "
    "metres per second, solar radiation in W/m2, and humidity as a fraction 0-1.",
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
    features: Dict[str, float], model: str = "random_forest"
) -> Dict[str, Any]:
    """Predict a risk category from a full set of feature values."""
    if model not in _bundles:
        return {"ok": False, "error": "unknown model", "models": MODEL_NAMES}

    missing = [f for f in FEATURES if f not in features]
    if missing:
        return {
            "ok": False,
            "error": "missing features",
            "missing": missing,
            "input_spec": INPUT_SPEC,
        }

    bundle = _bundles[model]
    classes = bundle["classes"]
    row = pd.DataFrame([{f: features[f] for f in FEATURES}])
    probabilities = bundle["model"].predict_proba(row)[0]
    # The category comes from predict() because SVM's probabilities can
    # occasionally rank a different class first.
    best = int(bundle["model"].predict(row)[0])
    return {
        "ok": True,
        "model": model,
        "category": classes[best],
        "confidence": round(float(probabilities[best]), 4),
        "probabilities": {
            c: round(float(p), 4) for c, p in zip(classes, probabilities)
        },
    }
