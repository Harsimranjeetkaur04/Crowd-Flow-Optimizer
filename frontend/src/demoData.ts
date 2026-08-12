import type { VenueLayout } from "./types";

export const DEMO_STADIUM_LAYOUT: VenueLayout = {
  nodes: [
    // Gates (entry points)
    { id: "gate_north", type: "gate", x: 50, y: 50, capacity: 150 },
    { id: "gate_south", type: "gate", x: 50, y: 330, capacity: 150 },
    { id: "gate_east", type: "gate", x: 450, y: 190, capacity: 120 },

    // Central walkways
    { id: "lobby", type: "walkway", x: 150, y: 190, capacity: 200 },
    { id: "main_hall", type: "walkway", x: 250, y: 190, capacity: 300 },
    { id: "upper_area", type: "walkway", x: 250, y: 85, capacity: 100 },
    { id: "lower_area", type: "walkway", x: 250, y: 295, capacity: 100 },

    // Concessions
    { id: "food", type: "concession", x: 350, y: 120, capacity: 80 },
    { id: "shop", type: "concession", x: 350, y: 260, capacity: 60 },

    // Exits
    { id: "exit_main", type: "exit", x: 450, y: 190, capacity: 200 },
    { id: "exit_side", type: "exit", x: 400, y: 50, capacity: 100 },
  ],
  edges: [
    // From north gate
    { from_node: "gate_north", to_node: "upper_area", width: 2, max_flow_rate: 30 },
    { from_node: "gate_north", to_node: "lobby", width: 3, max_flow_rate: 40 },

    // From south gate
    { from_node: "gate_south", to_node: "lower_area", width: 2, max_flow_rate: 30 },
    { from_node: "gate_south", to_node: "lobby", width: 3, max_flow_rate: 40 },

    // From east gate
    { from_node: "gate_east", to_node: "main_hall", width: 3, max_flow_rate: 45 },

    // Lobby to main
    { from_node: "lobby", to_node: "main_hall", width: 4, max_flow_rate: 60 },

    // Main hall distribution
    { from_node: "main_hall", to_node: "upper_area", width: 2, max_flow_rate: 25 },
    { from_node: "main_hall", to_node: "lower_area", width: 2, max_flow_rate: 25 },

    // To concessions
    { from_node: "upper_area", to_node: "food", width: 1.5, max_flow_rate: 20 },
    { from_node: "lower_area", to_node: "shop", width: 1.5, max_flow_rate: 15 },

    // To exits (main exit is the primary bottleneck)
    { from_node: "main_hall", to_node: "exit_main", width: 2.5, max_flow_rate: 35 },
    { from_node: "upper_area", to_node: "exit_side", width: 1.5, max_flow_rate: 15 },
    { from_node: "food", to_node: "exit_main", width: 1, max_flow_rate: 12 },
    { from_node: "shop", to_node: "exit_main", width: 1, max_flow_rate: 10 },
  ],
};
