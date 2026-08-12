"""Counterfactual simulation engine for evaluating crowd rerouting intervention strategies.

Instead of applying a naive reroute, this engine simulates the future consequences
of candidate strategies to ensure no secondary bottlenecks are created.
"""

from __future__ import annotations

from typing import Sequence
from app.models import SimulationRequest
from app.simulation.engine import run_simulation
from app.simulation.graph_builder import build_adjacency_list


class CounterfactualSimulator:
    """Simulates candidate rerouting interventions forward in time."""

    def __init__(self, request: SimulationRequest) -> None:
        self.request = request

    def generate_candidate_strategies(
        self,
        bottleneck_node: str,
        layout,
    ) -> list[dict]:
        """Generate candidate routing strategies around a bottleneck node/corridor."""
        adj = build_adjacency_list(layout)
        neighbors = [n for n in adj.get(bottleneck_node, []) if n != bottleneck_node]

        if not neighbors:
            return [{"id": "baseline", "name": "No Intervention", "policy": {}}]

        strategies: list[dict] = [
            {"id": "baseline", "name": "No Intervention", "policy": {}}
        ]

        # Strategy 1: Single alternative route 100% to neighbor 0
        if len(neighbors) >= 1:
            strategies.append(
                {
                    "id": f"redirect_100_{neighbors[0]}",
                    "name": f"Redirect 100% to {neighbors[0]}",
                    "policy": {bottleneck_node: {neighbors[0]: 1.0}},
                }
            )

        # Strategy 2: Single alternative route 100% to neighbor 1
        if len(neighbors) >= 2:
            strategies.append(
                {
                    "id": f"redirect_100_{neighbors[1]}",
                    "name": f"Redirect 100% to {neighbors[1]}",
                    "policy": {bottleneck_node: {neighbors[1]: 1.0}},
                }
            )

        # Strategy 3: Split traffic 50/50 across neighbor 0 and neighbor 1
        if len(neighbors) >= 2:
            strategies.append(
                {
                    "id": f"split_50_50_{neighbors[0]}_{neighbors[1]}",
                    "name": f"Split 50/50 between {neighbors[0]} and {neighbors[1]}",
                    "policy": {
                        bottleneck_node: {neighbors[0]: 0.5, neighbors[1]: 0.5}
                    },
                }
            )

        return strategies

    def run_counterfactual_simulations(
        self,
        bottleneck: dict,
        simulation_horizon_steps: int = 15,
    ) -> list[dict]:
        """Run candidate intervention strategies and measure future crowd consequences."""
        bottleneck_id = bottleneck.get("id", "")
        if "->" in bottleneck_id:
            bottleneck_node = bottleneck_id.split("->")[0]
        else:
            bottleneck_node = bottleneck_id

        candidates = self.generate_candidate_strategies(bottleneck_node, self.request.layout)
        results: list[dict] = []

        for candidate in candidates:
            # Clone request and run simulation with candidate routing policy
            cf_result = run_simulation(
                request=self.request,
                custom_routing_policy=candidate["policy"],
            )

            # Analyze snapshots for peak density & secondary critical zones
            max_density = 0.0
            critical_zones_count = 0
            secondary_bottlenecks: list[str] = []

            for snapshot in cf_result.get("snapshots", []):
                for node in snapshot.get("nodes", []):
                    dens = node["density"]
                    if dens > max_density:
                        max_density = dens
                    if dens >= 0.85 and node["node_id"] != bottleneck_node:
                        critical_zones_count += 1
                        if node["node_id"] not in secondary_bottlenecks:
                            secondary_bottlenecks.append(node["node_id"])

            has_secondary_bottleneck = len(secondary_bottlenecks) > 0

            results.append(
                {
                    "strategy_id": candidate["id"],
                    "strategy_name": candidate["name"],
                    "policy": candidate["policy"],
                    "predicted_max_density": round(max_density, 3),
                    "critical_zones_count": critical_zones_count,
                    "secondary_bottlenecks": secondary_bottlenecks,
                    "secondary_bottleneck_risk": has_secondary_bottleneck,
                    "completed_crowd": cf_result.get("completed_crowd_size", 0),
                    "simulation_result": cf_result,
                }
            )

        return results
