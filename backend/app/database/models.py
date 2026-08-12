"""SQLAlchemy ORM database models for CrowdFlow AI storage."""

from __future__ import annotations

from datetime import datetime, timezone
import json
from sqlalchemy import Column, DateTime, Float, Integer, String, Text
from app.database.connection import Base


def utc_now():
    return datetime.now(timezone.utc)


class UserModel(Base):
    __tablename__ = "users"

    id = Column(String(36), primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    name = Column(String(255), nullable=False, default="Venue Operator")
    password_hash = Column(String(255), nullable=False)
    created_at = Column(DateTime, default=utc_now)


class VenueModel(Base):
    __tablename__ = "venues"

    id = Column(String(36), primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    layout_data = Column(Text, nullable=False)  # Stores JSON layout representation
    created_at = Column(DateTime, default=utc_now)

    @property
    def layout_dict(self) -> dict:
        return json.loads(self.layout_data) if self.layout_data else {}


class SimulationModel(Base):
    __tablename__ = "simulations"

    id = Column(String(36), primary_key=True, index=True)
    venue_id = Column(String(36), nullable=True)
    status = Column(String(50), default="completed")
    expected_crowd_size = Column(Float, default=100.0)
    duration_seconds = Column(Integer, default=300)
    result_data = Column(Text, nullable=False)  # Stores simulation snapshots & recommendations JSON
    created_at = Column(DateTime, default=utc_now)

    @property
    def result_dict(self) -> dict:
        return json.loads(self.result_data) if self.result_data else {}


class AlertModel(Base):
    __tablename__ = "alerts"

    id = Column(String(36), primary_key=True, index=True)
    simulation_id = Column(String(36), nullable=False, index=True)
    node_id = Column(String(255), nullable=False)
    severity = Column(Float, default=0.0)
    level = Column(String(50), default="CRITICAL")
    created_at = Column(DateTime, default=utc_now)
