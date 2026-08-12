"""Pydantic models used by the layout and crowd-flow API."""

from pydantic import AliasChoices, BaseModel, ConfigDict, Field, model_validator

# Security: DoS prevention limits
MAX_NODES = 500  # Prevent oversized venue layouts
MAX_EDGES = 2000  # Prevent overly complex edge graphs
MAX_TIMESTEPS = 3600  # Prevent excessively long simulations (1 hour max)
MAX_CROWD_SIZE = 100000  # Prevent nonsensical crowd sizes


class Node(BaseModel):
    id: str = Field(max_length=255)  # Prevent unbounded ID strings
    type: str = Field(default="walkway", pattern="^(gate|entry|walkway|junction|concession|restroom|attraction|exit|emergency_exit)$")
    x: float
    y: float
    capacity: float = Field(default=100, gt=0, le=1000000)  # Reasonable capacity bounds


class Edge(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    from_node: str = Field(validation_alias=AliasChoices("from_node", "source"), max_length=255)
    to_node: str = Field(validation_alias=AliasChoices("to_node", "target"), max_length=255)
    width: float = Field(default=1.0, gt=0, le=100)  # Reasonable width bounds
    max_flow_rate: float = Field(default=50, gt=0, le=100000, validation_alias=AliasChoices("max_flow_rate", "capacity"))  # Reasonable flow bounds


class VenueLayout(BaseModel):
    nodes: list[Node] = Field(max_length=MAX_NODES)
    edges: list[Edge] = Field(max_length=MAX_EDGES)

    @model_validator(mode="after")
    def edge_nodes_must_exist(self) -> "VenueLayout":
        node_ids = [node.id for node in self.nodes]
        if len(set(node_ids)) != len(node_ids):
            raise ValueError("node IDs must be unique")
        unknown = {endpoint for edge in self.edges for endpoint in (edge.from_node, edge.to_node) if endpoint not in node_ids}
        if unknown:
            raise ValueError(f"edges reference unknown node IDs: {sorted(unknown)}")
        return self


class ScheduleEntry(BaseModel):
    time: int = Field(ge=0, le=MAX_TIMESTEPS)
    arrival_rate: float = Field(ge=0, le=100000)  # Reasonable arrival rate bounds


class SimulationRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    layout: VenueLayout
    expected_crowd_size: float = Field(default=100, gt=0, le=MAX_CROWD_SIZE, validation_alias=AliasChoices("expected_crowd_size", "crowd_size"))
    event_schedule: list[ScheduleEntry] = Field(default_factory=list, max_length=1000)  # Prevent absurdly long schedules
    duration_seconds: int | None = Field(default=None, ge=1, le=MAX_TIMESTEPS)


Layout = VenueLayout
SimRequest = SimulationRequest

Node.model_rebuild()
Edge.model_rebuild()
VenueLayout.model_rebuild()
ScheduleEntry.model_rebuild()
SimulationRequest.model_rebuild()
