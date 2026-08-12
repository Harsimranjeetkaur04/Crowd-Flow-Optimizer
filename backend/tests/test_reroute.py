from app.models import Layout
from app.routing.reroute import suggest_reroutes, suggested_neighbors


def _layout_with_alternates() -> Layout:
    return Layout.model_validate(
        {
            "nodes": [
                {"id": "gate-a", "type": "gate", "x": 0, "y": 0, "capacity": 100},
                {"id": "pinch", "type": "walkway", "x": 1, "y": 0, "capacity": 10},
                {"id": "upper", "type": "walkway", "x": 1, "y": 1, "capacity": 80},
                {"id": "lower", "type": "walkway", "x": 1, "y": -1, "capacity": 80},
                {"id": "exit", "type": "exit", "x": 2, "y": 0, "capacity": 100},
                {"id": "food", "type": "concession", "x": 2, "y": 1, "capacity": 50},
            ],
            "edges": [
                {"from_node": "gate-a", "to_node": "pinch", "width": 4, "max_flow_rate": 40},
                {"from_node": "pinch", "to_node": "exit", "width": 4, "max_flow_rate": 40},
                {"from_node": "gate-a", "to_node": "upper", "width": 2, "max_flow_rate": 20},
                {"from_node": "upper", "to_node": "food", "width": 2, "max_flow_rate": 20},
                {"from_node": "upper", "to_node": "exit", "width": 1, "max_flow_rate": 10},
                {"from_node": "gate-a", "to_node": "lower", "width": 2, "max_flow_rate": 20},
                {"from_node": "lower", "to_node": "exit", "width": 2, "max_flow_rate": 20},
            ],
        }
    )


def test_suggest_reroutes_avoids_bottleneck_node_and_returns_top_two() -> None:
    suggestions = suggest_reroutes(_layout_with_alternates(), {"kind": "node", "id": "pinch"})

    assert len(suggestions) == 2
    assert all("pinch" not in suggestion["path"] for suggestion in suggestions)
    assert suggestions[0]["gate_id"] == "gate-a"
    assert suggestions[0]["path"] == ["gate-a", "upper", "food"]
    assert suggestions[0]["estimated_time_saved"] > 0
    assert suggestions[1]["path"] == ["gate-a", "lower", "exit"]


def test_suggest_reroutes_avoids_bottleneck_edge() -> None:
    suggestions = suggest_reroutes(_layout_with_alternates(), "gate-a->pinch", top_k=1)

    assert len(suggestions) == 1
    assert suggestions[0]["avoids"] == "gate-a->pinch"
    assert suggestions[0]["path"] == ["gate-a", "upper", "food"]


def test_suggested_neighbors_keeps_legacy_helper() -> None:
    assert sorted(suggested_neighbors(_layout_with_alternates(), "gate-a")) == ["lower", "pinch", "upper"]
