import type { SimulationRequest, SimulationResponse, VenueLayout } from "../types";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    if (response.status === 429) {
      throw new Error("Rate limit exceeded (max 5 simulations/minute). Please wait a moment before trying again.");
    }
    let errorDetail = response.statusText;
    try {
      const data = await response.json();
      if (data.detail) {
        errorDetail = typeof data.detail === "string" ? data.detail : JSON.stringify(data.detail);
      }
    } catch {
      // ignore json parse error for non-json responses
    }
    throw new Error(`API Error (${response.status}): ${errorDetail}`);
  }
  return response.json() as Promise<T>;
}

export async function checkHealth() {
  const response = await fetch(`${API_URL}/health`);
  return handleResponse<{ status: string }>(response);
}

export async function saveLayout(layout: VenueLayout) {
  const response = await fetch(`${API_URL}/api/venues`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ layout }),
  });
  return handleResponse<{ venue_id: string; layout_id: string; layout: VenueLayout }>(response);
}

export async function getVenues() {
  const response = await fetch(`${API_URL}/api/venues`);
  return handleResponse<Array<{ id: string; name: string; layout: VenueLayout }>>(response);
}

export async function getVenue(id: string) {
  const response = await fetch(`${API_URL}/api/venues/${id}`);
  return handleResponse<{ id: string; name: string; layout: VenueLayout }>(response);
}

export async function runSimulation(request: SimulationRequest) {
  const response = await fetch(`${API_URL}/api/simulate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });
  return handleResponse<SimulationResponse>(response);
}

export async function getSimulationStatus(simulationId: string) {
  const response = await fetch(`${API_URL}/api/simulation/state?simulation_id=${simulationId}`);
  return handleResponse<any>(response);
}

export async function runCounterfactual(simulationRequest: SimulationRequest, bottleneck: any) {
  const response = await fetch(`${API_URL}/api/counterfactual`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      simulation_request: simulationRequest,
      bottleneck: bottleneck,
    }),
  });
  return handleResponse<{ bottleneck: any; decision: any; counterfactual_runs: any[] }>(response);
}

export async function registerUser(email: string, password: string) {
  const response = await fetch(`${API_URL}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  return handleResponse<{ message: string; user_id: string }>(response);
}

export async function loginUser(email: string, password: string) {
  const response = await fetch(`${API_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  return handleResponse<{ access_token: string; token_type: string }>(response);
}

export function getWebSocketUrl(simulationId: string): string {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const host = import.meta.env.VITE_API_URL
    ? new URL(import.meta.env.VITE_API_URL).host
    : window.location.host.replace(":5173", ":8000");
  return `${protocol}//${host}/ws/simulate/${simulationId}`;
}
