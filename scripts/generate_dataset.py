"""Synthetic dataset generator for CrowdFlow AI congestion risk prediction model."""

import csv
import random
import sys
from pathlib import Path

# Add project root and backend directory to Python sys.path
ROOT_DIR = Path(__file__).resolve().parent.parent
BACKEND_DIR = ROOT_DIR / "backend"

if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

try:
    from backend.app.models import SimulationRequest
    from backend.app.simulation.engine import run_simulation
    from backend.app.simulation.movement import calculate_density, get_speed_multiplier
except ImportError:
    from app.models import SimulationRequest
    from app.simulation.engine import run_simulation
    from app.simulation.movement import calculate_density, get_speed_multiplier


def build_randomized_layout(gate_count: int = 2, walkway_count: int = 4) -> dict:
    nodes = []
    for g in range(gate_count):
        nodes.append({"id": f"gate_{g}", "type": "gate", "x": g * 10.0, "y": 0.0, "capacity": random.randint(100, 500)})
    for w in range(walkway_count):
        nodes.append({"id": f"corridor_{w}", "type": "walkway", "x": w * 10.0, "y": 10.0, "capacity": random.randint(50, 300)})
    nodes.append({"id": "exit_main", "type": "exit", "x": 20.0, "y": 20.0, "capacity": 1000})

    edges = []
    for g in range(gate_count):
        edges.append({"from_node": f"gate_{g}", "to_node": "corridor_0", "width": random.uniform(1.0, 3.0), "max_flow_rate": random.randint(30, 100)})
    for w in range(walkway_count - 1):
        edges.append({"from_node": f"corridor_{w}", "to_node": f"corridor_{w+1}", "width": random.uniform(1.0, 3.0), "max_flow_rate": random.randint(20, 80)})
    edges.append({"from_node": f"corridor_{walkway_count-1}", "to_node": "exit_main", "width": 2.0, "max_flow_rate": 50})

    return {"nodes": nodes, "edges": edges}


def generate_synthetic_samples(num_scenarios: int = 50) -> list[dict]:
    dataset: list[dict] = []

    for scenario_idx in range(num_scenarios):
        crowd_size = random.randint(1000, 20000)
        arrival_rate = random.uniform(20.0, 150.0)
        layout = build_randomized_layout()

        req = SimulationRequest.model_validate(
            {
                "layout": layout,
                "expected_crowd_size": crowd_size,
                "duration_seconds": 200,
                "event_schedule": [{"time": 0, "arrival_rate": arrival_rate}],
            }
        )

        res = run_simulation(req)
        snapshots = res.get("snapshots", [])
        horizon = len(snapshots)

        for step_idx, snap in enumerate(snapshots):
            # Look ahead 5 steps (50 seconds) for ground truth label
            future_step = min(step_idx + 5, horizon - 1)
            future_nodes = {n["node_id"]: n["density"] for n in snapshots[future_step].get("nodes", [])}

            prev_nodes = {n["node_id"]: n["density"] for n in snapshots[max(0, step_idx - 1)].get("nodes", [])}

            for node in snap.get("nodes", []):
                nid = node["node_id"]
                curr_dens = node["density"]
                prev_dens = prev_nodes.get(nid, curr_dens)
                density_change = round(curr_dens - prev_dens, 3)

                fut_dens = future_nodes.get(nid, 0.0)
                label = 1 if fut_dens >= 0.85 else 0  # 1 = Critical Congestion in 5 min

                dataset.append(
                    {
                        "current_density": curr_dens,
                        "density_change": density_change,
                        "occupancy": node["occupancy"],
                        "capacity": node["capacity"],
                        "average_speed_multiplier": node.get("speed_multiplier", 1.0),
                        "scenario_crowd_size": crowd_size,
                        "arrival_rate": arrival_rate,
                        "future_density_5step": round(fut_dens, 3),
                        "is_critical_risk": label,
                    }
                )

    return dataset


def main() -> None:
    output_dir = ROOT_DIR / "data"
    output_dir.mkdir(exist_ok=True)
    output_file = output_dir / "simulation_dataset.csv"

    print(f"Generating synthetic crowd simulation dataset...")
    samples = generate_synthetic_samples(num_scenarios=50)

    if samples:
        keys = list(samples[0].keys())
        with output_file.open("w", newline="", encoding="utf-8") as handle:
            writer = csv.DictWriter(handle, fieldnames=keys)
            writer.writeheader()
            writer.writerows(samples)

    print(f"Successfully generated {len(samples)} samples in {output_file}")


if __name__ == "__main__":
    main()
