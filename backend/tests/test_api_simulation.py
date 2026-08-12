from fastapi.testclient import TestClient

from app.main import app


def _simulation_payload() -> dict:
    return {
        "layout": {
            "nodes": [
                {"id": "gate", "type": "gate", "x": 0, "y": 0, "capacity": 100},
                {"id": "lobby", "type": "walkway", "x": 1, "y": 0, "capacity": 100},
                {"id": "pinch", "type": "walkway", "x": 2, "y": 0, "capacity": 10},
                {"id": "upper", "type": "walkway", "x": 2, "y": 1, "capacity": 50},
                {"id": "exit", "type": "exit", "x": 3, "y": 0, "capacity": 100},
                {"id": "food", "type": "concession", "x": 3, "y": 1, "capacity": 50},
            ],
            "edges": [
                {"from_node": "gate", "to_node": "lobby", "width": 3, "max_flow_rate": 30},
                {"from_node": "lobby", "to_node": "pinch", "width": 2, "max_flow_rate": 20},
                {"from_node": "pinch", "to_node": "exit", "width": 1, "max_flow_rate": 5},
                {"from_node": "lobby", "to_node": "upper", "width": 1, "max_flow_rate": 10},
                {"from_node": "upper", "to_node": "food", "width": 1, "max_flow_rate": 10},
            ],
        },
        "expected_crowd_size": 100,
        "event_schedule": [{"time": 0, "arrival_rate": 20}],
        "duration_seconds": 6,
    }


def test_layout_endpoint_saves_layout() -> None:
    client = TestClient(app)
    response = client.post("/layout", json=_simulation_payload()["layout"])

    assert response.status_code == 200
    payload = response.json()
    assert payload["layout_id"]
    assert payload["layout"]["nodes"][0]["id"] == "gate"


def test_simulate_returns_status_bottlenecks_and_reroutes() -> None:
    client = TestClient(app)
    response = client.post("/simulate", json=_simulation_payload())

    assert response.status_code == 200
    payload = response.json()
    assert payload["simulation_id"]
    assert payload["status"] == "completed"
    assert len(payload["snapshots"]) == 6
    assert any(item["id"] == "pinch" for item in payload["bottlenecks"])
    assert payload["reroutes"]

    status = client.get(f"/simulate/{payload['simulation_id']}/status")
    assert status.status_code == 200
    assert status.json()["frames_total"] == 6


def test_simulation_websocket_streams_frames() -> None:
    client = TestClient(app)
    simulation = client.post("/simulate", json=_simulation_payload()).json()

    with client.websocket_connect(f"/ws/simulate/{simulation['simulation_id']}") as websocket:
        first = websocket.receive_json()
        assert first["status"] == "streaming"
        assert first["timestep"] == 0
        for _ in range(5):
            websocket.receive_json()
        final = websocket.receive_json()
        assert final["status"] == "completed"


def test_simulate_is_rate_limited_per_ip() -> None:
    client = TestClient(app)
    statuses = [client.post("/simulate", json=_simulation_payload()).status_code for _ in range(6)]

    assert statuses[-1] == 429
