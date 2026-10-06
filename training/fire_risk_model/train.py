# This trains the fire risk classifier used by the FireMCP predict_fire_risk tool.

# Ported from notebook in ANL HPC BOOTCAMP code
# FireMCP/models/fire_risk_model.joblib; the training CSV is not kept in the repo.

# python3 train.py <path to 2.training_data_OutputOfPrepareDataSet.csv>

import sys
from pathlib import Path

import joblib
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score
from sklearn.model_selection import train_test_split

OUT_PATH = (
    Path(__file__).resolve().parents[2]
    / "FireMCP"
    / "models"
    / "fire_risk_model.joblib"
)
TARGET = "WEATHER_RISK_CATEGORY"

EXCLUDE_COLS = [
    "LATITUDE",
    "LONGITUDE",
    "NEAREST_WEATHER_LAT",
    "NEAREST_WEATHER_LON",
    "DISCOVERYDATETIME",
    "WEATHER_FIRE_RISK_SCORE",
    TARGET,
]

if len(sys.argv) != 2:
    sys.exit(
        "usage: python3 train.py <path to 2.training_data_OutputOfPrepareDataSet.csv>"
    )

df = pd.read_csv(Path(sys.argv[1]).expanduser())
features = [c for c in df.columns if c not in EXCLUDE_COLS]

x_train, x_test, y_train, y_test = train_test_split(
    df[features], df[TARGET], test_size=0.30, random_state=42, stratify=df[TARGET]
)
model = RandomForestClassifier(
    n_estimators=300,
    min_samples_leaf=2,
    class_weight="balanced",
    random_state=42,
    n_jobs=-1,
).fit(x_train, y_train)

OUT_PATH.parent.mkdir(exist_ok=True)
joblib.dump({"model": model, "features": features}, OUT_PATH, compress=3)

accuracy = accuracy_score(y_test, model.predict(x_test))
print(f"accuracy {accuracy:.4f} -> {OUT_PATH} ({OUT_PATH.stat().st_size / 1e6:.1f} MB)")
