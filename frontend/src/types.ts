// Venue Layout Types (mirror backend schemas)
export interface Node {
  id: string;
  type: "gate" | "walkway" | "concession" | "exit";
  x: number;
  y: number;
  capacity: number;
}

export interface Edge {
  from_node: string;
  to_node: string;
  width: number;
  max_flow_rate: number;
}

export interface VenueLayout {
  nodes: Node[];
  edges: Edge[];
}

export interface EventSchedule {
  time: number;
  arrival_rate: number;
}

export interface SimulationRequest {
  layout: VenueLayout;
  expected_crowd_size: number;
  event_schedule: EventSchedule[];
  duration_seconds?: number;
}

// Simulation Response Types
export interface NodeSnapshot {
  node_id: string;
  occupancy: number;
  capacity: number;
  density: number;
}

export interface EdgeSnapshot {
  from_node: string;
  to_node: string;
  occupancy: number;
  capacity: number;
  density: number;
}

export interface Snapshot {
  timestep: number;
  nodes: NodeSnapshot[];
  edges: EdgeSnapshot[];
}

export interface SimulationResponse {
  simulation_id: string;
  status: string;
  duration_seconds: number;
  expected_crowd_size: number;
  injected_crowd_size: number;
  snapshots: Snapshot[];
  bottlenecks: Bottleneck[];
  reroutes: Reroute[];
}

export interface Bottleneck {
  kind: "node" | "edge";
  id: string;
  timestep: number;
  severity: number;
}

export interface Reroute {
  gate_id: string;
  destination_id: string;
  destination_type: string;
  path: string[];
  baseline_path: string[];
  baseline_time: number;
  congested_baseline_time: number;
  estimated_time: number;
  estimated_time_saved: number;
  avoids: string;
}

// WebSocket Message Types
export interface SimulationStreamMessage {
  simulation_id: string;
  status: "streaming" | "completed";
  timestep?: number;
  snapshot?: Snapshot;
  bottlenecks?: Bottleneck[];
  reroutes?: Reroute[];
}
