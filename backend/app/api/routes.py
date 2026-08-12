"""Main API Router for CrowdFlow AI platform endpoints."""

import json
from uuid import uuid4
from fastapi import APIRouter, Body, HTTPException, Request, WebSocket, WebSocketDisconnect
from pydantic import BaseModel, Field
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.ai.predictor import HF_MODEL_CARD_URL, HF_MODEL_ID, HF_MODEL_NOTE, predict_congestion_risk
from app.auth.routes import router as auth_router
from app.database import AlertModel, SessionLocal, SimulationModel, VenueModel
from app.models import Layout, SimRequest, SimulationRequest

SimulationRequest.model_rebuild()
Layout.model_rebuild()
from app.routing.reroute import suggest_reroutes
from app.simulation.bottleneck import find_bottlenecks
from app.simulation.counterfactual import CounterfactualSimulator
from app.simulation.decision_engine import select_best_strategy
from app.simulation.engine import run_simulation


router = APIRouter()
router.include_router(auth_router)

limiter = Limiter(key_func=get_remote_address)

LAYOUT_STORE: dict[str, Layout] = {}
VENUE_STORE: dict[str, dict] = {}
SIMULATION_STORE: dict[str, dict] = {}


class PredictionRequest(BaseModel):
    snapshots: list[dict]
    node_id: str
    force_fallback: bool = False


class CounterfactualRequest(BaseModel):
    simulation_request: SimRequest
    bottleneck: dict


@router.get("/")
def root() -> dict:
    return {
        "name": "CrowdFlow AI API Service",
        "status": "online",
        "docs_url": "/docs",
        "health_check": "/health",
    }


@router.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


# Venue Management APIs
@router.post("/api/venues")
@router.post("/layout")
def save_layout(payload: dict = Body(...)) -> dict:
    if "layout" in payload and isinstance(payload["layout"], dict):
        layout_obj = Layout.model_validate(payload["layout"])
    else:
        layout_obj = Layout.model_validate(payload)

    venue_id = str(uuid4())
    layout_dump = layout_obj.model_dump()
    LAYOUT_STORE[venue_id] = layout_obj
    VENUE_STORE[venue_id] = {"id": venue_id, "name": f"Venue {venue_id[:6]}", "layout": layout_dump}

    # Persist in DB table
    db = SessionLocal()
    try:
        db_venue = VenueModel(id=venue_id, name=f"Venue {venue_id[:6]}", layout_data=json.dumps(layout_dump))
        db.add(db_venue)
        db.commit()
    except Exception:
        db.rollback()
    finally:
        db.close()

    return {"venue_id": venue_id, "layout_id": venue_id, "layout": layout_dump}


@router.get("/api/venues")
def list_venues() -> list[dict]:
    return list(VENUE_STORE.values())


@router.get("/api/venues/{venue_id}")
def get_venue(venue_id: str) -> dict:
    venue = VENUE_STORE.get(venue_id)
    if not venue:
        raise HTTPException(status_code=404, detail="Venue not found")
    return venue


# Simulation APIs
@router.post("/simulate")
@router.post("/api/simulate")
@router.post("/api/simulation/start")
@limiter.limit("5/minute")
def simulate(request: Request, simulation_request: SimulationRequest = Body(...)) -> dict:
    simulation_id = str(uuid4())
    result = _run_enriched_simulation(simulation_id, simulation_request)
    SIMULATION_STORE[simulation_id] = result
    return result


@router.get("/api/simulation/state")
@router.get("/simulate/{simulation_id}/status")
def simulation_status(simulation_id: str = "latest") -> dict:
    if simulation_id == "latest" and SIMULATION_STORE:
        simulation_id = list(SIMULATION_STORE.keys())[-1]

    result = SIMULATION_STORE.get(simulation_id)
    if result is None:
        return {
            "simulation_id": simulation_id,
            "status": "idle",
            "frames_total": 0,
            "frames_available": 0,
            "bottlenecks": [],
            "reroutes": [],
            "recommendation": {},
        }
    return {
        "simulation_id": simulation_id,
        "status": result.get("status", "completed"),
        "frames_total": len(result.get("snapshots", [])),
        "frames_available": len(result.get("snapshots", [])),
        "bottlenecks": result.get("bottlenecks", []),
        "reroutes": result.get("reroutes", []),
        "recommendation": result.get("recommendation", {}),
    }


# Intelligence & Counterfactual Simulation APIs
@router.post("/api/counterfactual")
def run_counterfactual(req: CounterfactualRequest) -> dict:
    cf_sim = CounterfactualSimulator(req.simulation_request)
    results = cf_sim.run_counterfactual_simulations(req.bottleneck)
    decision = select_best_strategy(results)
    return {
        "bottleneck": req.bottleneck,
        "decision": decision,
        "counterfactual_runs": results,
    }


@router.get("/api/bottlenecks")
def get_bottlenecks(simulation_id: str = "latest") -> list[dict]:
    status_data = simulation_status(simulation_id)
    return status_data.get("bottlenecks", [])


@router.get("/api/recommendation")
def get_recommendation(simulation_id: str = "latest") -> dict:
    status_data = simulation_status(simulation_id)
    return status_data.get("recommendation", {})


@router.get("/ai/model")
def ai_model() -> dict[str, str]:
    return {
        "model_id": HF_MODEL_ID,
        "model_card_url": HF_MODEL_CARD_URL,
        "note": HF_MODEL_NOTE,
    }


@router.post("/predict")
@router.post("/api/predict")
def predict(request: PredictionRequest) -> dict:
    return predict_congestion_risk(
        snapshots=request.snapshots,
        node_id=request.node_id,
        force_fallback=request.force_fallback,
    )


@router.websocket("/ws/simulate/{simulation_id}")
async def simulation_socket(websocket: WebSocket, simulation_id: str) -> None:
    await websocket.accept()
    result = SIMULATION_STORE.get(simulation_id)
    if result is None:
        await websocket.send_json({"simulation_id": simulation_id, "status": "not_found"})
        await websocket.close(code=1008)
        return
    try:
        for snapshot in result.get("snapshots", []):
            timestep = snapshot["timestep"]
            await websocket.send_json(
                {
                    "simulation_id": simulation_id,
                    "status": "streaming",
                    "timestep": timestep,
                    "snapshot": snapshot,
                    "bottlenecks": [item for item in result.get("bottlenecks", []) if item.get("timestep", 0) <= timestep],
                    "recommendation": result.get("recommendation"),
                }
            )
        await websocket.send_json({"simulation_id": simulation_id, "status": "completed"})
    except WebSocketDisconnect:
        pass


def _run_enriched_simulation(simulation_id: str, simulation_request: SimRequest) -> dict:
    simulation = run_simulation(simulation_request)
    bottlenecks = find_bottlenecks(simulation["snapshots"])
    reroutes = _build_reroute_suggestions(simulation_request.layout, bottlenecks)

    recommendation = {}
    if bottlenecks:
        primary_bottleneck = bottlenecks[0]
        cf_sim = CounterfactualSimulator(simulation_request)
        cf_results = cf_sim.run_counterfactual_simulations(primary_bottleneck)
        recommendation = select_best_strategy(cf_results)

    res = {
        "simulation_id": simulation_id,
        "status": "completed",
        **simulation,
        "bottlenecks": bottlenecks,
        "reroutes": reroutes,
        "recommendation": recommendation,
    }

    # Persist in DB tables
    db = SessionLocal()
    try:
        db_sim = SimulationModel(
            id=simulation_id,
            expected_crowd_size=simulation_request.expected_crowd_size,
            duration_seconds=simulation_request.duration_seconds or 300,
            result_data=json.dumps(res),
        )
        db.add(db_sim)

        for b in bottlenecks:
            db_alert = AlertModel(
                id=str(uuid4()),
                simulation_id=simulation_id,
                node_id=b.get("id", "unknown"),
                severity=float(b.get("severity", 0.0)),
                level=b.get("level", "CRITICAL"),
            )
            db.add(db_alert)

        db.commit()
    except Exception:
        db.rollback()
    finally:
        db.close()

    return res


def _build_reroute_suggestions(layout: Layout, bottlenecks: list[dict]) -> list[dict]:
    suggestions: list[dict] = []
    seen: set[tuple] = set()
    for bottleneck in bottlenecks:
        for suggestion in suggest_reroutes(layout, bottleneck, top_k=2):
            key = (
                bottleneck.get("kind"),
                bottleneck.get("id"),
                suggestion["gate_id"],
                tuple(suggestion["path"]),
            )
            if key in seen:
                continue
            seen.add(key)
            suggestions.append({"bottleneck": bottleneck, **suggestion})
    return suggestions
