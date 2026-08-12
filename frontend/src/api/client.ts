import type { SimulationRequest, SimulationResponse, VenueLayout } from "../types";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

export async function checkHealth() {
  const response = await fetch(`${API_URL}/health`);
  return response.json() as Promise<{ status: string }>;
}

export async function saveLayout(layout: VenueLayout) {
  const response = await fetch(`${API_URL}/layout`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ layout }),
  });
  return response.json() as Promise<{ layout_id: string; layout: VenueLayout }>;
}

export async function runSimulation(request: SimulationRequest) {
  const response = await fetch(`${API_URL}/simulate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });
  return response.json() as Promise<SimulationResponse>;
}

export async function getSimulationStatus(simulationId: string) {
  const response = await fetch(`${API_URL}/simulate/${simulationId}/status`);
  return response.json();
}

export function getWebSocketUrl(simulationId: string): string {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const host = import.meta.env.VITE_API_URL
    ? new URL(import.meta.env.VITE_API_URL).host
    : window.location.host.replace(":5173", ":8000");
  return `${protocol}//${host}/ws/simulate/${simulationId}`;
}
