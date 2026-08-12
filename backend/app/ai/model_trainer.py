"""Scikit-Learn ML Model Trainer for CrowdFlow AI Congestion Risk Prediction."""

from __future__ import annotations

import csv
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3]))
sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

import joblib
import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split


MODEL_DIR = Path(__file__).parent / "models"
MODEL_PATH = MODEL_DIR / "congestion_model.joblib"


FEATURE_COLUMNS = [
    "current_density",
    "density_change",
    "occupancy",
    "capacity",
    "average_speed_multiplier",
    "arrival_rate",
]


def train_and_save_model(data_path: Path | None = None) -> dict:
    """Train a Scikit-Learn Random Forest Classifier on simulation dataset."""
    if data_path is None:
        data_path = Path(__file__).parent.parent.parent / "data" / "simulation_dataset.csv"

    if not data_path.exists():
        # Generate inline synthetic data if dataset file does not exist
        from scripts.generate_dataset import generate_synthetic_samples
        samples = generate_synthetic_samples(num_scenarios=20)
    else:
        samples = []
        with data_path.open("r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                samples.append(
                    {
                        "current_density": float(row["current_density"]),
                        "density_change": float(row["density_change"]),
                        "occupancy": float(row["occupancy"]),
                        "capacity": float(row["capacity"]),
                        "average_speed_multiplier": float(row["average_speed_multiplier"]),
                        "arrival_rate": float(row["arrival_rate"]),
                        "is_critical_risk": int(row["is_critical_risk"]),
                    }
                )

    X = np.array([[s[col] for col in FEATURE_COLUMNS] for s in samples])
    y = np.array([s["is_critical_risk"] for s in samples])

    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

    clf = RandomForestClassifier(n_estimators=50, max_depth=8, random_state=42)
    clf.fit(X_train, y_train)

    accuracy = float(clf.score(X_test, y_test))

    MODEL_DIR.mkdir(exist_ok=True, parents=True)
    joblib.dump({"model": clf, "feature_columns": FEATURE_COLUMNS}, MODEL_PATH)

    return {
        "status": "model_trained_successfully",
        "sample_count": len(samples),
        "accuracy": round(accuracy, 4),
        "model_path": str(MODEL_PATH),
    }


if __name__ == "__main__":
    result = train_and_save_model()
    print("Training result:", result)
