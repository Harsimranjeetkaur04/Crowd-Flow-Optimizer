"""Fine-tuning sketch for the density forecaster.

This script is intentionally lightweight for the hackathon demo. It generates a
Chronos-style supervised dataset from simulated density trajectories and prints
the fine-tuning command path instead of starting a costly training run.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from app.ai.predictor import HF_MODEL_CARD_URL, HF_MODEL_ID
from app.models import SimulationRequest
from app.simulation.engine import run_simulation


def build_demo_request(arrival_rate: float, duration_seconds: int) -> SimulationRequest:
    return SimulationRequest.model_validate(
        {
            "expected_crowd_size": arrival_rate * duration_seconds,
            "duration_seconds": duration_seconds,
            "event_schedule": [{"time": 0, "arrival_rate": arrival_rate}],
            "layout": {
                "nodes": [
                    {"id": "gate", "type": "gate", "x": 0, "y": 0, "capacity": 100},
                    {"id": "lobby", "type": "walkway", "x": 1, "y": 0, "capacity": 80},
                    {"id": "pinch", "type": "walkway", "x": 2, "y": 0, "capacity": 18},
                    {"id": "exit", "type": "exit", "x": 3, "y": 0, "capacity": 100},
                ],
                "edges": [
                    {"from_node": "gate", "to_node": "lobby", "width": 3, "max_flow_rate": 30},
                    {"from_node": "lobby", "to_node": "pinch", "width": 2, "max_flow_rate": 18},
                    {"from_node": "pinch", "to_node": "exit", "width": 1, "max_flow_rate": 6},
                ],
            },
        }
    )


def make_examples(
    history_length: int = 12,
    prediction_length: int = 5,
    duration_seconds: int = 40,
) -> list[dict]:
    examples: list[dict] = []
    for arrival_rate in (8, 12, 16, 20, 24, 28):
        result = run_simulation(build_demo_request(arrival_rate, duration_seconds))
        series = [
            float(node["density"])
            for snapshot in result["snapshots"]
            for node in snapshot["nodes"]
            if node["node_id"] == "pinch"
        ]
        for start in range(0, len(series) - history_length - prediction_length + 1):
            split = start + history_length
            examples.append(
                {
                    "item_id": f"pinch-rate-{arrival_rate}",
                    "context": series[start:split],
                    "target": series[split : split + prediction_length],
                    "model_id": HF_MODEL_ID,
                    "model_card_url": HF_MODEL_CARD_URL,
                }
            )
    return examples


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate simulated density data for Chronos fine-tuning.")
    parser.add_argument("--output", default="simulated_density_windows.jsonl")
    parser.add_argument("--history-length", type=int, default=12)
    parser.add_argument("--prediction-length", type=int, default=5)
    args = parser.parse_args()

    examples = make_examples(args.history_length, args.prediction_length)
    output_path = Path(args.output)
    with output_path.open("w", encoding="utf-8") as handle:
        for example in examples:
            handle.write(json.dumps(example) + "\n")

    print(f"Wrote {len(examples)} simulated training windows to {output_path}")
    print(f"Base HF model: {HF_MODEL_ID}")
    print(f"Model card: {HF_MODEL_CARD_URL}")
    print("Fine-tuning path: convert JSONL windows to Chronos format and train with amazon-science/chronos-forecasting scripts.")


if __name__ == "__main__":
    main()
