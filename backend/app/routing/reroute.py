"""Reroute suggestions around detected crowd bottlenecks."""

from __future__ import annotations

import heapq
import math
from dataclasses import dataclass
from typing import Iterable

from app.models import Layout
from app.simulation.graph_builder import build_adjacency_list


@dataclass(frozen=True)
class BlockedBottleneck:
    node_id: str | None = None
    edge: tuple[str, str] | None = None

    @property
    def label(self) -> str:
        if self.node_id:
            return self.node_id
        if self.edge:
            return f"{self.edge[0]}->{self.edge[1]}"
        return "unknown"


def suggested_neighbors(layout: Layout, node_id: str) -> list[str]:
    return build_adjacency_list(layout).get(node_id, [])


def suggest_reroutes(
    layout: Layout,
    bottleneck: dict | str | tuple[str, str],
    active_gates: Iterable[str] | None = None,
    top_k: int = 2,
    bottleneck_penalty: float = 5.0,
) -> list[dict]:
    """Return top alternate paths from active gates to exits/concessions.

    Paths are scored by a simple travel-time proxy: Euclidean edge length divided
    by width. The bottlenecked node or edge is removed from the alternate search.
    """
    blocked = _parse_bottleneck(bottleneck)
    node_ids = {node.id for node in layout.nodes}
    destinations = [node for node in layout.nodes if node.type in {"exit", "concession"}]
    gates = list(active_gates) if active_gates is not None else [node.id for node in layout.nodes if node.type == "gate"]
    gates = [gate for gate in gates if gate in node_ids]

    suggestions: list[dict] = []
    for gate_id in gates:
        baseline = _shortest_path_to_any_destination(layout, gate_id, destinations)
        alternate_paths = _k_shortest_paths_to_any_destination(
            layout=layout,
            start=gate_id,
            destinations=destinations,
            blocked=blocked,
            top_k=top_k,
        )
        if baseline is None:
            continue
        congested_baseline_time = (
            baseline.cost * bottleneck_penalty
            if _path_crosses_bottleneck(baseline.path, blocked)
            else baseline.cost
        )
        for alternate in alternate_paths:
            if alternate.path == baseline.path:
                continue
            suggestions.append(
                {
                    "gate_id": gate_id,
                    "destination_id": alternate.destination_id,
                    "destination_type": alternate.destination_type,
                    "path": alternate.path,
                    "baseline_path": baseline.path,
                    "baseline_time": round(baseline.cost, 3),
                    "congested_baseline_time": round(congested_baseline_time, 3),
                    "estimated_time": round(alternate.cost, 3),
                    "estimated_time_saved": round(congested_baseline_time - alternate.cost, 3),
                    "avoids": blocked.label,
                }
            )
    return suggestions


@dataclass(frozen=True)
class _PathResult:
    path: list[str]
    cost: float
    destination_id: str
    destination_type: str


def _parse_bottleneck(bottleneck: dict | str | tuple[str, str]) -> BlockedBottleneck:
    if isinstance(bottleneck, tuple):
        return BlockedBottleneck(edge=bottleneck)
    if isinstance(bottleneck, str):
        if "->" in bottleneck:
            start, end = bottleneck.split("->", 1)
            return BlockedBottleneck(edge=(start, end))
        return BlockedBottleneck(node_id=bottleneck)

    kind = bottleneck.get("kind")
    if kind == "edge":
        if bottleneck.get("from_node") and bottleneck.get("to_node"):
            return BlockedBottleneck(edge=(bottleneck["from_node"], bottleneck["to_node"]))
        edge_id = bottleneck.get("id", "")
        if "->" in edge_id:
            start, end = edge_id.split("->", 1)
            return BlockedBottleneck(edge=(start, end))
    if bottleneck.get("from_node") and bottleneck.get("to_node"):
        return BlockedBottleneck(edge=(bottleneck["from_node"], bottleneck["to_node"]))
    return BlockedBottleneck(node_id=bottleneck.get("node_id") or bottleneck.get("id"))


def _edge_cost(edge, nodes_by_id: dict[str, object]) -> float:
    start, end = nodes_by_id[edge.from_node], nodes_by_id[edge.to_node]
    distance = max(math.hypot(start.x - end.x, start.y - end.y), 1.0)
    return distance / edge.width


def _is_blocked_edge(edge, blocked: BlockedBottleneck) -> bool:
    return blocked.edge == (edge.from_node, edge.to_node)


def _is_blocked_node(node_id: str, blocked: BlockedBottleneck, start: str) -> bool:
    return node_id != start and blocked.node_id == node_id


def _outgoing_edges(layout: Layout, node_id: str, blocked: BlockedBottleneck | None = None):
    for index, edge in enumerate(layout.edges):
        if edge.from_node != node_id:
            continue
        if blocked and _is_blocked_edge(edge, blocked):
            continue
        if blocked and blocked.node_id and edge.to_node == blocked.node_id:
            continue
        yield index, edge


def _shortest_path_to_any_destination(
    layout: Layout,
    start: str,
    destinations,
) -> _PathResult | None:
    paths = _k_shortest_paths_to_any_destination(layout, start, destinations, blocked=None, top_k=1)
    return paths[0] if paths else None


def _path_crosses_bottleneck(path: list[str], blocked: BlockedBottleneck) -> bool:
    if blocked.node_id and blocked.node_id in path:
        return True
    if blocked.edge:
        return any((path[index], path[index + 1]) == blocked.edge for index in range(len(path) - 1))
    return False


def _k_shortest_paths_to_any_destination(
    layout: Layout,
    start: str,
    destinations,
    blocked: BlockedBottleneck | None,
    top_k: int,
) -> list[_PathResult]:
    if top_k <= 0:
        return []
    destination_by_id = {node.id: node for node in destinations}
    if blocked and _is_blocked_node(start, blocked, start):
        return []

    nodes_by_id = {node.id: node for node in layout.nodes}
    queue: list[tuple[float, tuple[str, ...]]] = [(0.0, (start,))]
    results: list[_PathResult] = []
    seen_paths: set[tuple[str, ...]] = set()

    while queue and len(results) < top_k:
        cost, path_tuple = heapq.heappop(queue)
        if path_tuple in seen_paths:
            continue
        seen_paths.add(path_tuple)
        current = path_tuple[-1]

        if current in destination_by_id and current != start:
            destination = destination_by_id[current]
            results.append(
                _PathResult(
                    path=list(path_tuple),
                    cost=cost,
                    destination_id=destination.id,
                    destination_type=destination.type,
                )
            )
            continue

        for _, edge in _outgoing_edges(layout, current, blocked):
            next_node = edge.to_node
            if next_node in path_tuple:
                continue
            if blocked and _is_blocked_node(next_node, blocked, start):
                continue
            heapq.heappush(queue, (cost + _edge_cost(edge, nodes_by_id), (*path_tuple, next_node)))

    return results
