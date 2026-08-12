"""Decision Engine for scoring, ranking, and selecting optimal rerouting intervention strategies."""

from __future__ import annotations


def score_strategy(result: dict) -> float:
    """Calculate strategy risk penalty score. Lower score is better.

    Score components:
    - Predicted Max Density: 100 * max_density
    - Critical Zones Penalty: 50 * critical_zones_count
    - Secondary Bottleneck Penalty: 1000 * (1 if secondary_bottleneck_risk else 0)
    """
    max_density_penalty = result.get("predicted_max_density", 0.0) * 100.0
    critical_penalty = result.get("critical_zones_count", 0) * 50.0
    secondary_penalty = 1000.0 if result.get("secondary_bottleneck_risk", False) else 0.0

    return round(max_density_penalty + critical_penalty + secondary_penalty, 2)


def select_best_strategy(counterfactual_results: list[dict]) -> dict:
    """Evaluate candidate counterfactual strategies and return the optimal recommendation.

    Rejects strategies that create secondary bottlenecks and picks the strategy with
    the lowest congestion risk score.
    """
    if not counterfactual_results:
        return {
            "selected_strategy": None,
            "status": "no_strategies_available",
            "evaluated_count": 0,
            "ranked_strategies": [],
        }

    scored_strategies = []
    for res in counterfactual_results:
        score = score_strategy(res)
        scored_strategies.append(
            {
                "strategy_id": res["strategy_id"],
                "strategy_name": res["strategy_name"],
                "policy": res["policy"],
                "score": score,
                "predicted_max_density": res["predicted_max_density"],
                "critical_zones_count": res["critical_zones_count"],
                "secondary_bottleneck": res["secondary_bottleneck_risk"],
                "secondary_bottlenecks_list": res["secondary_bottlenecks"],
                "accepted": not res["secondary_bottleneck_risk"],
                "rejection_reason": "Creates secondary bottleneck downstream" if res["secondary_bottleneck_risk"] else None,
            }
        )

    # Sort by score ascending (lowest risk first)
    scored_strategies.sort(key=lambda s: s["score"])

    # Pick best accepted strategy (or lowest overall score if all rejected)
    accepted = [s for s in scored_strategies if s["accepted"]]
    best = accepted[0] if accepted else scored_strategies[0]

    return {
        "status": "optimal_strategy_selected",
        "selected_strategy": best["strategy_id"],
        "recommended_action": best["strategy_name"],
        "policy": best["policy"],
        "predicted_max_density": best["predicted_max_density"],
        "critical_zones": best["critical_zones_count"],
        "secondary_bottleneck": best["secondary_bottleneck"],
        "evaluated_count": len(scored_strategies),
        "ranked_strategies": scored_strategies,
    }
