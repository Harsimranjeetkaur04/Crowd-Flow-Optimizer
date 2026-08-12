"""Crowd Group data structure and spawning logic for aggregated crowd simulation."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Sequence


DEFAULT_GROUP_SIZE = 100
BASE_WALKING_SPEED = 1.2  # meters / second


@dataclass
class CrowdGroup:
    """Represents an aggregated group of venue visitors (~100 people)."""

    group_id: int
    size: int = DEFAULT_GROUP_SIZE
    current_node: str = ""
    destination: str = ""
    speed: float = BASE_WALKING_SPEED
    route: list[str] = field(default_factory=list)
    route_index: int = 0
    progress: float = 0.0  # 0.0 to 1.0 along current route segment

    @property
    def next_node(self) -> str | None:
        if self.route_index + 1 < len(self.route):
            return self.route[self.route_index + 1]
        return None

    def advance_to_next_node(self) -> None:
        if self.route_index + 1 < len(self.route):
            self.route_index += 1
            self.current_node = self.route[self.route_index]
            self.progress = 0.0

    def to_dict(self) -> dict:
        return {
            "group_id": self.group_id,
            "size": self.size,
            "current_node": self.current_node,
            "destination": self.destination,
            "speed": round(self.speed, 2),
            "route": self.route,
            "route_index": self.route_index,
            "progress": round(self.progress, 2),
        }


def spawn_crowd_groups(
    count_people: int,
    group_size: int = DEFAULT_GROUP_SIZE,
    gate_nodes: Sequence[str] = (),
    destinations: Sequence[str] = (),
    start_group_id: int = 0,
) -> list[CrowdGroup]:
    """Break N people down into discrete CrowdGroup objects distributed across gates."""
    if count_people <= 0 or not gate_nodes or not destinations:
        return []

    target_group_size = max(1, min(group_size, count_people // 10)) if count_people >= 10 else count_people
    num_groups = max(1, count_people // target_group_size)
    actual_size = count_people // num_groups
    remainder = count_people % num_groups

    groups: list[CrowdGroup] = []
    for idx in range(num_groups):
        g_size = actual_size + (1 if idx < remainder else 0)
        gate = gate_nodes[idx % len(gate_nodes)]
        dest = destinations[idx % len(destinations)]
        groups.append(
            CrowdGroup(
                group_id=start_group_id + idx,
                size=g_size,
                current_node=gate,
                destination=dest,
                speed=BASE_WALKING_SPEED,
                route=[gate],
                route_index=0,
                progress=0.0,
            )
        )
    return groups
