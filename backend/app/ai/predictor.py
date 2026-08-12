"""ML Congestion Predictor using Hugging Face metadata & Scikit-Learn trained risk model."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Iterable
import joblib
import numpy as np


import os

HF_MODEL_ID = os.getenv("HF_MODEL_ID", "crowdflow-ai/congestion-risk-classifier")
HF_MODEL_CARD_URL = f"https://huggingface.co/{HF_MODEL_ID}"
HF_MODEL_NOTE = (
    "Random Forest & Gradient Boosting Classifier trained on 50,000 synthetic crowd simulation states "
    "to predict 5-minute critical bottleneck probabilities (PS3)."
)

MODEL_PATH = Path(__file__).parent / "models" / "congestion_model.joblib"


@dataclass(frozen=True)
class CongestionRiskResult:
    node_id: str
    current_density: float
    density_change: float
    critical_probability: float
    risk_level: str
    eta_minutes: float
    model_id: str
    model_card_url: str
    used_fallback: bool
    reason: str | None = None

    def as_dict(self) -> dict:
        return {
            "node_id": self.node_id,
            "current_density": round(self.current_density, 3),
            "density_change": round(self.density_change, 3),
            "critical_probability": round(self.critical_probability, 3),
            "risk_level": self.risk_level,
            "eta_minutes": round(self.eta_minutes, 1),
            "model_id": self.model_id,
            "model_card_url": self.model_card_url,
            "used_fallback": self.used_fallback,
            "reason": self.reason,
        }


def extract_node_features(snapshots: Iterable[dict], node_id: str) -> dict:
    """Extract temporal density features for a node from simulation snapshots."""
    snap_list = list(snapshots)
    if not snap_list:
        return {"density": 0.0, "delta": 0.0, "occupancy": 0, "capacity": 100, "speed_mult": 1.0}

    last_snap = snap_list[-1]
    prev_snap = snap_list[-2] if len(snap_list) >= 2 else last_snap

    curr_node = next((n for n in last_snap.get("nodes", []) if n.get("node_id") == node_id), {})
    prev_node = next((n for n in prev_snap.get("nodes", []) if n.get("node_id") == node_id), {})

    curr_density = float(curr_node.get("density", 0.0))
    prev_density = float(prev_node.get("density", curr_density))

    return {
        "density": curr_density,
        "delta": curr_density - prev_density,
        "occupancy": float(curr_node.get("occupancy", 0.0)),
        "capacity": float(curr_node.get("capacity", 100.0)),
        "speed_mult": float(curr_node.get("speed_multiplier", 1.0)),
    }


class CongestionPredictor:
    """Lazy model wrapper for congestion risk inference."""

    def __init__(self) -> None:
        self._model = None
        self._load_error: str | None = None

    def predict_node_risk(
        self,
        snapshots: Iterable[dict],
        node_id: str,
        force_fallback: bool = False,
    ) -> CongestionRiskResult:
        feats = extract_node_features(snapshots, node_id)

        if force_fallback:
            return self._heuristic_fallback(node_id, feats, "fallback forced")

        try:
            prob = self._predict_with_model(feats)
        except Exception as exc:
            return self._heuristic_fallback(node_id, feats, str(exc))

        risk_level = "CRITICAL" if prob >= 0.75 else ("HIGH" if prob >= 0.50 else "SAFE")
        eta = max(1.0, (0.85 - feats["density"]) / max(0.01, feats["delta"])) if feats["delta"] > 0 else 5.0

        return CongestionRiskResult(
            node_id=node_id,
            current_density=feats["density"],
            density_change=feats["delta"],
            critical_probability=prob,
            risk_level=risk_level,
            eta_minutes=min(eta, 10.0),
            model_id=HF_MODEL_ID,
            model_card_url=HF_MODEL_CARD_URL,
            used_fallback=False,
        )

    def _predict_with_model(self, feats: dict) -> float:
        model_obj = self._load_model()
        clf = model_obj["model"]
        vec = np.array([[feats["density"], feats["delta"], feats["occupancy"], feats["capacity"], feats["speed_mult"], 50.0]])
        probs = clf.predict_proba(vec)[0]
        return float(probs[1]) if len(probs) > 1 else float(probs[0])

    def _load_model(self):
        if self._model is not None:
            return self._model
        if not MODEL_PATH.exists():
            from app.ai.model_trainer import train_and_save_model
            train_and_save_model()
        self._model = joblib.load(MODEL_PATH)
        return self._model

    def _heuristic_fallback(self, node_id: str, feats: dict, reason: str) -> CongestionRiskResult:
        dens = feats["density"]
        delta = feats["delta"]
        prob = min(1.0, max(0.0, dens + delta * 3.0))
        risk_level = "CRITICAL" if prob >= 0.75 else ("HIGH" if prob >= 0.50 else "SAFE")
        return CongestionRiskResult(
            node_id=node_id,
            current_density=dens,
            density_change=delta,
            critical_probability=prob,
            risk_level=risk_level,
            eta_minutes=4.0,
            model_id=HF_MODEL_ID,
            model_card_url=HF_MODEL_CARD_URL,
            used_fallback=True,
            reason=reason,
        )


def predict_congestion_risk(
    snapshots: Iterable[dict],
    node_id: str,
    force_fallback: bool = False,
) -> dict:
    """Public helper function for API endpoints."""
    return CongestionPredictor().predict_node_risk(
        snapshots=snapshots,
        node_id=node_id,
        force_fallback=force_fallback,
    ).as_dict()
