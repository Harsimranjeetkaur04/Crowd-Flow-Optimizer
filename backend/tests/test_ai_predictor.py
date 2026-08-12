from app.ai.predictor import (
    HF_MODEL_CARD_URL,
    HF_MODEL_ID,
    extract_node_features,
    predict_congestion_risk,
)
from app.main import app
from fastapi.testclient import TestClient


def test_extract_node_features_calculates_density_and_delta() -> None:
    snapshots = [
        {"nodes": [{"node_id": "pinch", "density": 0.2, "occupancy": 20, "capacity": 100}]},
        {"nodes": [{"node_id": "pinch", "density": 0.5, "occupancy": 50, "capacity": 100}]},
    ]

    feats = extract_node_features(snapshots, "pinch")
    assert feats["density"] == 0.5
    assert round(feats["delta"], 2) == 0.3
    assert feats["occupancy"] == 50.0


def test_predict_congestion_risk_returns_risk_and_model_card() -> None:
    snapshots = [
        {"nodes": [{"node_id": "pinch", "density": 0.25, "occupancy": 25, "capacity": 100}]},
        {"nodes": [{"node_id": "pinch", "density": 0.75, "occupancy": 75, "capacity": 100}]},
    ]

    result = predict_congestion_risk(snapshots, "pinch", force_fallback=True)

    assert result["node_id"] == "pinch"
    assert result["model_id"] == HF_MODEL_ID
    assert result["model_card_url"] == HF_MODEL_CARD_URL
    assert result["used_fallback"] is True
    assert "critical_probability" in result
    assert "risk_level" in result


def test_predict_endpoint_returns_predictions() -> None:
    response = TestClient(app).post(
        "/predict",
        json={
            "node_id": "pinch",
            "force_fallback": True,
            "snapshots": [
                {"nodes": [{"node_id": "pinch", "density": 0.25, "occupancy": 25, "capacity": 100}]},
                {"nodes": [{"node_id": "pinch", "density": 0.85, "occupancy": 85, "capacity": 100}]},
            ],
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["node_id"] == "pinch"
    assert payload["model_id"] == HF_MODEL_ID
    assert payload["model_card_url"] == HF_MODEL_CARD_URL
    assert payload["used_fallback"] is True
