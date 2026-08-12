"""Tests for Counterfactual Simulation Engine and Decision Engine (Milestone 2)."""

from app.models import SimulationRequest
from app.simulation.counterfactual import CounterfactualSimulator
from app.simulation.decision_engine import select_best_strategy, score_strategy


def _sample_simulation_request() -> SimulationRequest:
    return SimulationRequest.model_validate(
        {
            "layout": {
                "nodes": [
                    {"id": "gate", "type": "gate", "x": 0, "y": 0, "capacity": 100},
                    {"id": "corridor_b", "type": "walkway", "x": 1, "y": 0, "capacity": 20},
                    {"id": "route_c", "type": "walkway", "x": 1, "y": 1, "capacity": 50},
                    {"id": "route_d", "type": "walkway", "x": 1, "y": -1, "capacity": 50},
                    {"id": "exit_a", "type": "exit", "x": 2, "y": 0, "capacity": 100},
                ],
                "edges": [
                    {"from_node": "gate", "to_node": "corridor_b", "width": 2, "max_flow_rate": 20},
                    {"from_node": "corridor_b", "to_node": "exit_a", "width": 1, "max_flow_rate": 5},
                    {"from_node": "gate", "to_node": "route_c", "width": 2, "max_flow_rate": 20},
                    {"from_node": "route_c", "to_node": "exit_a", "width": 2, "max_flow_rate": 20},
                    {"from_node": "gate", "to_node": "route_d", "width": 2, "max_flow_rate": 20},
                    {"from_node": "route_d", "to_node": "exit_a", "width": 2, "max_flow_rate": 20},
                ],
            },
            "expected_crowd_size": 100,
            "event_schedule": [{"time": 0, "arrival_rate": 20}],
            "duration_seconds": 60,
        }
    )


def test_counterfactual_simulations_generate_and_evaluate_candidates() -> None:
    req = _sample_simulation_request()
    simulator = CounterfactualSimulator(req)
    bottleneck = {"kind": "node", "id": "corridor_b", "density": 0.90}

    results = simulator.run_counterfactual_simulations(bottleneck)

    assert len(results) >= 2
    assert any(r["strategy_id"] == "baseline" for r in results)
    assert all("predicted_max_density" in r for r in results)


def test_decision_engine_selects_optimal_strategy_and_rejects_secondary_bottlenecks() -> None:
    counterfactual_results = [
        {
            "strategy_id": "strategy_a_100_c",
            "strategy_name": "Redirect 100% to C",
            "policy": {"corridor_b": {"route_c": 1.0}},
            "predicted_max_density": 0.96,
            "critical_zones_count": 1,
            "secondary_bottlenecks": ["route_c"],
            "secondary_bottleneck_risk": True,
        },
        {
            "strategy_id": "strategy_c_50_50",
            "strategy_name": "Split 50/50 C and D",
            "policy": {"corridor_b": {"route_c": 0.5, "route_d": 0.5}},
            "predicted_max_density": 0.67,
            "critical_zones_count": 0,
            "secondary_bottlenecks": [],
            "secondary_bottleneck_risk": False,
        },
    ]

    decision = select_best_strategy(counterfactual_results)

    assert decision["status"] == "optimal_strategy_selected"
    assert decision["selected_strategy"] == "strategy_c_50_50"
    assert decision["secondary_bottleneck"] is False
    assert decision["predicted_max_density"] == 0.67
