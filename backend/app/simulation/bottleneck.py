"""Bottleneck detection and severity classification for density snapshots."""

from __future__ import annotations


def classify_density_level(density: float) -> str:
    """Classify crowd density level according to venue safety thresholds.

    0-50%: SAFE
    50-70%: MODERATE
    70-85%: HIGH
    85%+: CRITICAL
    """
    if density >= 0.85:
        return "CRITICAL"
    elif density >= 0.70:
        return "HIGH"
    elif density >= 0.50:
        return "MODERATE"
    else:
        return "SAFE"


def find_bottlenecks(
    time_series: list[dict],
    threshold: float = 0.70,
    consecutive_steps: int = 2,
) -> list[dict]:
    """Flag nodes and edges whose density stays over the threshold and track trend."""
    runs: dict[tuple[str, str], int] = {}
    prev_densities: dict[tuple[str, str], float] = {}
    findings: list[dict] = []

    for snapshot in time_series:
        timestep = snapshot.get("timestep", 0)
        time_seconds = snapshot.get("time_seconds", timestep * 10)

        for node in snapshot.get("nodes", []):
            node_id = node["node_id"]
            density = node["density"]
            key = ("node", node_id)

            delta = round(density - prev_densities.get(key, density), 3)
            prev_densities[key] = density

            req_steps = 1 if density >= 0.85 else consecutive_steps
            runs[key] = runs.get(key, 0) + 1 if density >= threshold else 0
            if runs[key] >= req_steps:
                findings.append(
                    {
                        "kind": "node",
                        "id": node_id,
                        "timestep": timestep,
                        "time_seconds": time_seconds,
                        "density": density,
                        "severity": density,
                        "density_delta": delta,
                        "level": classify_density_level(density),
                        "occupancy": node.get("occupancy", 0),
                        "capacity": node.get("capacity", 1),
                    }
                )

        for edge in snapshot.get("edges", []):
            edge_id = f"{edge['from_node']}->{edge['to_node']}"
            density = edge["density"]
            key = ("edge", edge_id)

            delta = round(density - prev_densities.get(key, density), 3)
            prev_densities[key] = density

            runs[key] = runs.get(key, 0) + 1 if density >= threshold else 0
            if runs[key] >= consecutive_steps:
                findings.append(
                    {
                        "kind": "edge",
                        "id": edge_id,
                        "from_node": edge["from_node"],
                        "to_node": edge["to_node"],
                        "timestep": timestep,
                        "time_seconds": time_seconds,
                        "density": density,
                        "severity": density,
                        "density_delta": delta,
                        "level": classify_density_level(density),
                        "occupancy": edge.get("occupancy", 0),
                        "capacity": edge.get("capacity", 1),
                    }
                )

    return findings
