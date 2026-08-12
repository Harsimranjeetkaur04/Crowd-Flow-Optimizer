"""Graph builder utilities using NetworkX for layout analysis and path calculation."""

from __future__ import annotations

import math
import networkx as nx
from app.models import Layout


def build_networkx_graph(layout: Layout, edge_weights: dict[tuple[str, str], float] | None = None) -> nx.DiGraph:
    """Build a NetworkX DiGraph representing venue topology with physical weights."""
    nodes_by_id = {node.id: node for node in layout.nodes}
    graph = nx.DiGraph()

    for node in layout.nodes:
        graph.add_node(node.id, type=node.type, x=node.x, y=node.y, capacity=node.capacity)

    for edge in layout.edges:
        start_node = nodes_by_id.get(edge.from_node)
        end_node = nodes_by_id.get(edge.to_node)
        if start_node and end_node:
            distance = max(math.hypot(start_node.x - end_node.x, start_node.y - end_node.y), 1.0)
        else:
            distance = 1.0

        weight = edge_weights.get((edge.from_node, edge.to_node)) if edge_weights else (distance / max(edge.width, 0.1))
        graph.add_edge(
            edge.from_node,
            edge.to_node,
            width=edge.width,
            max_flow_rate=edge.max_flow_rate,
            distance=distance,
            weight=weight,
        )
    return graph


def build_adjacency_list(layout: Layout) -> dict[str, list[str]]:
    """Return an undirected/directed adjacency mapping of node connections."""
    graph: dict[str, list[str]] = {node.id: [] for node in layout.nodes}
    for edge in layout.edges:
        if edge.to_node not in graph.setdefault(edge.from_node, []):
            graph[edge.from_node].append(edge.to_node)
        if edge.from_node not in graph.setdefault(edge.to_node, []):
            graph[edge.to_node].append(edge.from_node)
    return graph


def find_shortest_path_nx(
    layout: Layout,
    start: str,
    destination: str,
    edge_penalties: dict[tuple[str, str], float] | None = None,
) -> list[str]:
    """Calculate shortest path from start to destination using Dijkstra on NetworkX graph."""
    graph = build_networkx_graph(layout, edge_weights=edge_penalties)
    try:
        return nx.shortest_path(graph, source=start, target=destination, weight="weight")
    except (nx.NetworkXNoPath, nx.NodeNotFound):
        return [start]
