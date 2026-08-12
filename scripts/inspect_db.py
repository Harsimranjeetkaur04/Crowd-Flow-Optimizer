"""CLI Database Inspector Script for CrowdFlow AI platform."""

from __future__ import annotations

import sys
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT_DIR / "backend"))

try:
    from backend.app.database import AlertModel, SessionLocal, SimulationModel, UserModel, VenueModel
except ImportError:
    # pyright: ignore [reportMissingImports]
    # type: ignore
    from app.database import AlertModel, SessionLocal, SimulationModel, UserModel, VenueModel  # type: ignore # pyright: ignore


def inspect_database() -> None:
    db = SessionLocal()
    try:
        print("=" * 60)
        print(" CROWDFLOW AI - DATABASE INSPECTOR")
        print("=" * 60)

        # 1. Registered Users
        users = db.query(UserModel).all()
        print(f"\n[REGISTERED USERS ({len(users)})]:")
        for u in users:
            print(f"  * ID: {u.id} | Email: {u.email} | Name: {u.name} | Created: {u.created_at}")

        # 2. Venues
        venues = db.query(VenueModel).all()
        print(f"\n[SAVED VENUES ({len(venues)})]:")
        for v in venues:
            nodes_cnt = len(v.layout_dict.get("nodes", []))
            edges_cnt = len(v.layout_dict.get("edges", []))
            print(f"  * ID: {v.id} | Name: {v.name} | Nodes: {nodes_cnt} | Edges: {edges_cnt}")

        # 3. Simulations
        simulations = db.query(SimulationModel).all()
        print(f"\n[SIMULATIONS ({len(simulations)})]:")
        for s in simulations:
            print(f"  * ID: {s.id} | Status: {s.status} | Crowd Size: {s.expected_crowd_size} | Duration: {s.duration_seconds}s")

        # 4. Alerts
        alerts = db.query(AlertModel).all()
        print(f"\n[BOTTLENECK ALERTS ({len(alerts)})]:")
        for a in alerts:
            print(f"  * ID: {a.id} | Sim ID: {a.simulation_id} | Node: {a.node_id} | Level: {a.level}")

        print("=" * 60)
    finally:
        db.close()


if __name__ == "__main__":
    inspect_database()
