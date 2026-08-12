"""Initialize tables and insert sample records on all local PostgreSQL ports (5432, 5433, 5434)."""

import sys
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT_DIR / "backend"))

import psycopg2
from app.database import Base, SessionLocal, AlertModel, SimulationModel, UserModel, VenueModel
from sqlalchemy import create_engine


ports = [5432, 5433, 5434]

for port in ports:
    url = f"postgresql://postgres:postgrespassword@localhost:{port}/crowdflow_db"
    try:
        engine = create_engine(url)
        # Create database if missing
        conn = psycopg2.connect(host="127.0.0.1", port=port, user="postgres", password="postgrespassword", dbname="postgres")
        conn.autocommit = True
        cur = conn.cursor()
        cur.execute("SELECT 1 FROM pg_database WHERE datname='crowdflow_db';")
        if not cur.fetchone():
            cur.execute("CREATE DATABASE crowdflow_db;")
            print(f"Created database crowdflow_db on port {port}.")
        cur.close()
        conn.close()

        # Initialize tables
        engine = create_engine(url)
        Base.metadata.create_all(bind=engine)
        print(f"Initialized tables on port {port}.")

        # Insert sample user
        from sqlalchemy.orm import sessionmaker
        Session = sessionmaker(bind=engine)
        db = Session()

        if not db.query(UserModel).filter_by(email="admin@crowdflow.ai").first():
            user = UserModel(id="sample-user-1", email="admin@crowdflow.ai", name="Chief Safety Operator", password_hash="hashedpass")
            db.add(user)

        if not db.query(VenueModel).filter_by(id="venue-sample-1").first():
            venue = VenueModel(id="venue-sample-1", name="Main Olympic Arena", layout_data='{"nodes": [{"id": "gate_1", "type": "gate"}], "edges": []}')
            db.add(venue)

        if not db.query(SimulationModel).filter_by(id="sim-sample-1").first():
            sim = SimulationModel(id="sim-sample-1", venue_id="venue-sample-1", status="completed", expected_crowd_size=40000.0, duration_seconds=300, result_data='{"status": "completed"}')
            db.add(sim)

        if not db.query(AlertModel).filter_by(id="alert-sample-1").first():
            alert = AlertModel(id="alert-sample-1", simulation_id="sim-sample-1", node_id="gate_1", severity=0.92, level="CRITICAL")
            db.add(alert)

        db.commit()
        db.close()
        print(f"Successfully populated sample data on port {port}!")
    except Exception as exc:
        print(f"Port {port} error: {exc}")
