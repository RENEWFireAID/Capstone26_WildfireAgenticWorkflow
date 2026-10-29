# This trains the fire risk classifiers used by the FireMCP predict_fire_risk tool.

# Saves one file per model in FireMCP/models/, plus feature_medians.json which the
# tool uses to fill in features a caller leaves out. The training CSV is not kept in the repo.

# python3 train.py <path to 2.training_data_OutputOfPrepareDataSet.csv>

import json
import sys
from pathlib import Path

import joblib
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import LabelEncoder, StandardScaler
from sklearn.svm import SVC
from xgboost import XGBClassifier

RANDOM_STATE = 42
# Months with fewer training fires than this fall back to the all-fires medians.
MIN_FIRES_PER_MONTH = 50
MODELS_DIR = Path(__file__).resolve().parents[2] / "FireMCP" / "models"
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

def train_random_forest(X_train, y_train):
    """Trains a Random Forest classifier."""
    model = RandomForestClassifier(
        n_estimators=300,
        min_samples_leaf=2,
        class_weight="balanced",
        random_state=RANDOM_STATE,
        n_jobs=-1,
    )
    model.fit(X_train, y_train)
    return model


def train_xgboost(X_train, y_train):
    """Trains an XGBoost classifier on integer-encoded labels."""
    model = XGBClassifier(
        n_estimators=300,
        max_depth=6,
        learning_rate=0.1,
        random_state=RANDOM_STATE,
        eval_metric="mlogloss",
        n_jobs=-1,
    )
    model.fit(X_train, y_train)
    return model


def train_svm(X_train, y_train):
    """Trains an SVM classifier. Features are scaled inside a pipeline since
    SVM is distance-based."""
    model = Pipeline(
        [
            ("scaler", StandardScaler()),
            (
                "svc",
                SVC(
                    kernel="rbf",
                    class_weight="balanced",
                    random_state=RANDOM_STATE,
                    probability=True,
                ),
            ),
        ]
    )
    model.fit(X_train, y_train)
    return model


def feature_medians(df, features):
    """Median of every feature across all fires, and for each discovery month
    with at least MIN_FIRES_PER_MONTH fires."""
    month = pd.to_datetime(df["DISCOVERYDATETIME"], format="mixed").dt.month
    by_month = {
        str(int(m)): group[features].median().round(4).to_dict()
        for m, group in df.groupby(month)
        if len(group) >= MIN_FIRES_PER_MONTH
    }
    return {"all": df[features].median().round(4).to_dict(), "by_month": by_month}

if len(sys.argv) != 2:
    sys.exit(
        "usage: python3 train.py <path to 2.training_data_OutputOfPrepareDataSet.csv>"
    )

df = pd.read_csv(Path(sys.argv[1]).expanduser())
features = [c for c in df.columns if c not in EXCLUDE_COLS]

x_train, x_test, y_train, y_test = train_test_split(
    df[features],
    df[TARGET],
    test_size=0.30,
    random_state=RANDOM_STATE,
    stratify=df[TARGET],
)
encoder = LabelEncoder().fit(y_train)
classes = [str(c) for c in encoder.classes_]
y_train_encoded = encoder.transform(y_train)

models = {
    "random_forest": train_random_forest(x_train, y_train_encoded),
    "xgboost": train_xgboost(x_train, y_train_encoded),
    "svm": train_svm(x_train, y_train_encoded),
}

MODELS_DIR.mkdir(exist_ok=True)
for name, model in models.items():
    out_path = MODELS_DIR / f"{name}.joblib"
    joblib.dump(
        {"model": model, "features": features, "classes": classes},
        out_path,
        compress=3,
    )
    accuracy = accuracy_score(y_test, encoder.inverse_transform(model.predict(x_test)))
    print(
        f"{name}: accuracy {accuracy:.4f} -> {out_path} "
        f"({out_path.stat().st_size / 1e6:.1f} MB)"
    )

medians_path = MODELS_DIR / "feature_medians.json"
medians_path.write_text(json.dumps(feature_medians(df, features), indent=2))
print(f"medians -> {medians_path}")
