from app.models import SimulationRequest
from app.simulation.bottleneck import find_bottlenecks
from app.simulation.engine import run_simulation


def test_downstream_capacity_creates_persistent_bottleneck() -> None:
    """A 5-node venue queues at the narrow central walkway, not at the exit."""
    request = SimulationRequest.model_validate({
        "layout": {
            "nodes": [
                {"id": "gate", "type": "gate", "x": 0, "y": 0, "capacity": 100},
                {"id": "lobby", "type": "walkway", "x": 1, "y": 0, "capacity": 100},
                {"id": "pinch", "type": "walkway", "x": 2, "y": 0, "capacity": 10},
                {"id": "concession", "type": "concession", "x": 2, "y": 1, "capacity": 30},
                {"id": "exit", "type": "exit", "x": 3, "y": 0, "capacity": 100},
            ],
            "edges": [
                {"from_node": "gate", "to_node": "lobby", "width": 2, "max_flow_rate": 20},
                {"from_node": "lobby", "to_node": "pinch", "width": 2, "max_flow_rate": 20},
                {"from_node": "pinch", "to_node": "exit", "width": 1, "max_flow_rate": 5},
                {"from_node": "concession", "to_node": "pinch", "width": 1, "max_flow_rate": 5},
            ],
        },
        "expected_crowd_size": 100,
        "event_schedule": [{"time": 0, "arrival_rate": 20}],
        "duration_seconds": 6,
    })

    result = run_simulation(request)
    bottlenecks = find_bottlenecks(result["snapshots"])

    assert len(result["snapshots"]) == 6
    assert any(item["kind"] == "node" and item["id"] == "pinch" for item in bottlenecks)
    assert all(item["severity"] > 0.8 for item in bottlenecks)


def test_legacy_edge_names_are_accepted() -> None:
    request = SimulationRequest.model_validate({
        "layout": {
            "nodes": [
                {"id": "g", "type": "gate", "x": 0, "y": 0},
                {"id": "e", "type": "exit", "x": 1, "y": 0},
            ],
            "edges": [{"source": "g", "target": "e", "capacity": 10}],
        },
        "crowd_size": 10,
        "event_schedule": [{"time": 0, "arrival_rate": 5}],
    })
    assert request.layout.edges[0].max_flow_rate == 10
    assert request.expected_crowd_size == 10
