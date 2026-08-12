"""Discrete-step crowd simulation engine using aggregated crowd groups and density-aware movement models."""

from __future__ import annotations

import math
from typing import Sequence

from app.models import SimulationRequest
from app.simulation.crowd import CrowdGroup, spawn_crowd_groups
from app.simulation.graph_builder import find_shortest_path_nx
from app.simulation.movement import calculate_density, get_speed_multiplier


STEP_DURATION_SECONDS = 10  # 1 simulation step = 10 seconds


def _arrival_rate_at(timestep: int, schedule) -> float:
    """Schedule entries are rate change-points, persisting until the next entry."""
    applicable = [entry for entry in schedule if entry.time <= timestep * STEP_DURATION_SECONDS]
    return applicable[-1].arrival_rate if applicable else 0.0


def _get_destinations(layout) -> list[str]:
    """Find all exit, concession, and restroom nodes."""
    dests = [node.id for node in layout.nodes if node.type in {"exit", "concession", "restroom"}]
    if not dests:
        dests = [node.id for node in layout.nodes if node.type == "exit"]
    if not dests and layout.nodes:
        dests = [layout.nodes[-1].id]
    return dests


def _get_gates(layout) -> list[str]:
    """Find all gate / entry nodes."""
    gates = [node.id for node in layout.nodes if node.type in {"gate", "entry"}]
    if not gates and layout.nodes:
        gates = [layout.nodes[0].id]
    return gates


def run_simulation(
    request: SimulationRequest,
    custom_routing_policy: dict[str, dict[str, float]] | None = None,
) -> dict:
    """Run a discrete step crowd simulation with crowd groups and density-aware movement.

    Args:
        request: SimulationRequest with layout, expected crowd size, and event schedule.
        custom_routing_policy: Optional override policy mapping gate_id -> {next_node: split_ratio}
                               used during counterfactual simulation.
    """
    layout = request.layout
    nodes_by_id = {node.id: node for node in layout.nodes}
    gates = _get_gates(layout)
    destinations = _get_destinations(layout)

    duration = request.duration_seconds or 300
    step_duration = 1 if duration < 10 else STEP_DURATION_SECONDS
    total_steps = max(1, duration // step_duration)

    active_groups: list[CrowdGroup] = []
    next_group_id = 1
    total_injected_people = 0
    total_completed_people = 0

    snapshots: list[dict] = []

    # Pre-calculate baseline routes for each gate -> destination pair
    gate_routes: dict[tuple[str, str], list[str]] = {}
    for gate in gates:
        for dest in destinations:
            gate_routes[(gate, dest)] = find_shortest_path_nx(layout, gate, dest)

    for step in range(total_steps):
        current_time = step * step_duration

        # 1. Compute arrivals and spawn crowd groups
        remaining_crowd = max(0.0, request.expected_crowd_size - total_injected_people)
        desired_rate = _arrival_rate_at(step, request.event_schedule) * step_duration
        arrivals = min(desired_rate, remaining_crowd) if remaining_crowd > 0 else 0.0

        if arrivals > 0:
            new_groups = spawn_crowd_groups(
                count_people=int(arrivals),
                group_size=100,
                gate_nodes=gates,
                destinations=destinations,
                start_group_id=next_group_id,
            )
            for grp in new_groups:
                # Apply route to group
                route = list(gate_routes.get((grp.current_node, grp.destination), [grp.current_node]))
                
                # Apply custom routing policy override if provided (e.g. for counterfactual splits)
                if custom_routing_policy and grp.current_node in custom_routing_policy:
                    policy = custom_routing_policy[grp.current_node]
                    # Select alternative next node according to split ratio
                    import random
                    rand_val = random.random()
                    cumulative = 0.0
                    chosen_next = None
                    for alt_node, ratio in policy.items():
                        cumulative += ratio
                        if rand_val <= cumulative:
                            chosen_next = alt_node
                            break
                    if chosen_next and len(route) > 1:
                        # Re-route via chosen_next
                        alt_tail = find_shortest_path_nx(layout, chosen_next, grp.destination)
                        route = [grp.current_node] + alt_tail

                grp.route = route
                active_groups.append(grp)
                next_group_id += 1

            total_injected_people += int(arrivals)

        # 2. Compute current node & edge occupancies
        node_occupancy = {node.id: 0.0 for node in layout.nodes}
        edge_loads: dict[tuple[str, str], float] = {
            (e.from_node, e.to_node): 0.0 for e in layout.edges
        }

        for grp in active_groups:
            node_occupancy[grp.current_node] = node_occupancy.get(grp.current_node, 0.0) + grp.size
            if grp.next_node:
                edge_key = (grp.current_node, grp.next_node)
                edge_loads[edge_key] = edge_loads.get(edge_key, 0.0) + grp.size

        # 3. Compute node densities & movement speed multipliers
        node_densities = {
            n.id: calculate_density(node_occupancy[n.id], n.capacity) for n in layout.nodes
        }
        node_speed_mults = {
            n.id: get_speed_multiplier(node_densities[n.id]) for n in layout.nodes
        }

        # 4. Move active groups forward with edge flow capacity enforcement
        edge_flow_left = {
            (e.from_node, e.to_node): e.max_flow_rate * step_duration for e in layout.edges
        }
        remaining_groups: list[CrowdGroup] = []

        for grp in active_groups:
            if grp.current_node in destinations or nodes_by_id.get(grp.current_node, {}).type == "exit":
                total_completed_people += grp.size
                continue  # Group exited venue

            # Effective speed based on current node density
            speed_mult = node_speed_mults.get(grp.current_node, 1.0)
            effective_speed = grp.speed * speed_mult

            # Advance progress based on physical node coordinates
            step_distance = effective_speed * step_duration
            if grp.next_node:
                curr_obj = nodes_by_id.get(grp.current_node)
                next_obj = nodes_by_id.get(grp.next_node)
                dist = max(math.hypot(curr_obj.x - next_obj.x, curr_obj.y - next_obj.y), 1.0) if (curr_obj and next_obj) else 1.0
                grp.progress += step_distance / dist
            else:
                grp.progress += step_distance / 1.0

            if grp.progress >= 1.0 and grp.next_node:
                edge_key = (grp.current_node, grp.next_node)
                flow_cap = edge_flow_left.get(edge_key, 1000.0)

                if flow_cap >= grp.size:
                    edge_flow_left[edge_key] = max(0.0, flow_cap - grp.size)
                    grp.advance_to_next_node()
                elif flow_cap > 0:
                    passed_size = int(flow_cap)
                    stay_size = grp.size - passed_size
                    edge_flow_left[edge_key] = 0.0

                    passed_grp = CrowdGroup(
                        group_id=next_group_id,
                        size=passed_size,
                        current_node=grp.next_node,
                        destination=grp.destination,
                        speed=grp.speed,
                        route=list(grp.route),
                        route_index=grp.route_index + 1,
                        progress=0.0,
                    )
                    next_group_id += 1
                    remaining_groups.append(passed_grp)

                    grp.size = stay_size
                    grp.progress = 0.0
                else:
                    grp.progress = 0.0

            remaining_groups.append(grp)

        active_groups = remaining_groups

        # 5. Build snapshot record
        node_snapshots = []
        for n in layout.nodes:
            occ = node_occupancy[n.id]
            dens = node_densities[n.id]
            node_snapshots.append(
                {
                    "node_id": n.id,
                    "occupancy": occ,
                    "capacity": n.capacity,
                    "density": round(dens, 3),
                    "speed_multiplier": round(node_speed_mults[n.id], 2),
                }
            )

        edge_snapshots = []
        for e in layout.edges:
            key = (e.from_node, e.to_node)
            occ = edge_loads.get(key, 0.0)
            dens = calculate_density(occ, e.max_flow_rate)
            edge_snapshots.append(
                {
                    "from_node": e.from_node,
                    "to_node": e.to_node,
                    "occupancy": occ,
                    "capacity": e.max_flow_rate,
                    "density": round(dens, 3),
                }
            )

        snapshots.append(
            {
                "timestep": step,
                "time_seconds": current_time,
                "active_groups_count": len(active_groups),
                "nodes": node_snapshots,
                "edges": edge_snapshots,
            }
        )

    return {
        "duration_seconds": duration,
        "step_count": total_steps,
        "expected_crowd_size": request.expected_crowd_size,
        "injected_crowd_size": total_injected_people,
        "completed_crowd_size": total_completed_people,
        "snapshots": snapshots,
    }
