import { useState, useRef, MouseEvent } from "react";
import type { VenueLayout, Node, Edge } from "../types";

const NODE_RADIUS = 14;
const TYPE_META: Record<string, { color: string; glow: string; label: string }> = {
  gate:       { color: "#3b82f6", glow: "rgba(59,130,246,0.5)",  label: "Gate" },
  exit:       { color: "#10b981", glow: "rgba(16,185,129,0.5)",  label: "Exit" },
  concession: { color: "#f97316", glow: "rgba(249,115,22,0.5)",  label: "Concession" },
  walkway:    { color: "#94a3b8", glow: "rgba(148,163,184,0.3)", label: "Walkway" },
};

interface LayoutEditorProps {
  layout: VenueLayout;
  onLayoutChange: (layout: VenueLayout) => void;
}

export function LayoutEditor({ layout, onLayoutChange }: LayoutEditorProps) {
  const [nodeType, setNodeType] = useState<
    "gate" | "walkway" | "concession" | "exit"
  >("gate");
  const [connectingFrom, setConnectingFrom] = useState<string | null>(null);
  const [dragState, setDragState] = useState<{ id: string; moved: boolean; startX: number; startY: number } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const bounds = { width: 500, height: 380 };

  const scaleX = (x: number) => x;
  const scaleY = (y: number) => y;

  const unscaleX = (x: number) => x;
  const unscaleY = (y: number) => y;

  const handleSvgClick = (e: MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const svgX = ((e.clientX - rect.left) / rect.width) * bounds.width;
    const svgY = ((e.clientY - rect.top) / rect.height) * bounds.height;
    const x = unscaleX(svgX);
    const y = unscaleY(svgY);

    const newNode: Node = {
      id: `${nodeType}_${Date.now()}`,
      type: nodeType,
      x: Math.round(x * 10) / 10,
      y: Math.round(y * 10) / 10,
      capacity: 100,
    };

    onLayoutChange({
      ...layout,
      nodes: [...layout.nodes, newNode],
    });
  };

  const handleNodeClick = (nodeId: string) => {
    if (connectingFrom) {
      if (connectingFrom === nodeId) {
        setConnectingFrom(null);
        return;
      }
      const newEdge: Edge = {
        from_node: connectingFrom,
        to_node: nodeId,
        width: 2,
        max_flow_rate: 20,
      };
      onLayoutChange({
        ...layout,
        edges: [...layout.edges, newEdge],
      });
      setConnectingFrom(null);
    } else {
      setConnectingFrom(nodeId);
    }
  };

  const handleDeleteNode = (nodeId: string) => {
    const updatedLayout = {
      ...layout,
      nodes: layout.nodes.filter((n) => n.id !== nodeId),
      edges: layout.edges.filter((e) => e.from_node !== nodeId && e.to_node !== nodeId),
    };
    onLayoutChange(updatedLayout);
  };

  const handleDeleteEdge = (fromNode: string, toNode: string) => {
    onLayoutChange({
      ...layout,
      edges: layout.edges.filter(
        (e) => !(e.from_node === fromNode && e.to_node === toNode)
      ),
    });
  };

  const [isConfirmingClear, setIsConfirmingClear] = useState(false);

  const handleClearLayout = () => {
    if (isConfirmingClear) {
      onLayoutChange({ nodes: [], edges: [] });
      setConnectingFrom(null);
      setIsConfirmingClear(false);
    } else {
      setIsConfirmingClear(true);
      setTimeout(() => setIsConfirmingClear(false), 3000); // Reset after 3 seconds
    }
  };

  const selectedMeta = TYPE_META[nodeType] ?? TYPE_META.walkway;

  return (
    <section
      aria-label="Layout editor"
      className="rounded-2xl overflow-hidden"
      style={{
        background: "rgba(12,21,36,0.8)",
        border: "1px solid rgba(30,58,95,0.6)",
      }}
    >
      {/* Header */}
      <div
        className="px-5 py-4 flex items-center gap-3"
        style={{
          borderBottom: "1px solid rgba(30,58,95,0.5)",
          background: "linear-gradient(135deg, rgba(139,92,246,0.06), rgba(59,130,246,0.04))",
        }}
      >
        <div
          className="w-8 h-8 rounded-xl flex items-center justify-center text-base"
          style={{
            background: "linear-gradient(135deg, #7c3aed, #3b82f6)",
            boxShadow: "0 0 12px rgba(139,92,246,0.4)",
          }}
        >
          ✏️
        </div>
        <div className="flex-1">
          <h2
            className="font-bold text-sm"
            style={{ color: "var(--text-primary)" }}
          >
            Layout Editor
          </h2>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            Click canvas to place nodes · Click node → node to connect
          </p>
        </div>
      </div>

      <div className="p-5 space-y-4">
        {/* Toolbar Row */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Node type selector */}
          <div className="flex items-center gap-2 flex-1">
            <label
              className="text-xs font-semibold uppercase tracking-widest"
              style={{ color: "var(--text-muted)" }}
            >
              Place:
            </label>
            <div className="flex gap-1.5">
              {(Object.entries(TYPE_META) as [string, { color: string; glow: string; label: string }][]).map(
                ([type, meta]) => (
                  <button
                    key={type}
                    onClick={() =>
                      setNodeType(type as "gate" | "walkway" | "concession" | "exit")
                    }
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200"
                    style={{
                      background:
                        nodeType === type
                          ? `${meta.color}20`
                          : "rgba(5,10,20,0.5)",
                      border: `1px solid ${
                        nodeType === type
                          ? `${meta.color}80`
                          : "rgba(30,58,95,0.5)"
                      }`,
                      color: nodeType === type ? meta.color : "var(--text-secondary)",
                      boxShadow:
                        nodeType === type ? `0 0 8px ${meta.glow}` : "none",
                    }}
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ background: meta.color }}
                    />
                    {meta.label}
                  </button>
                )
              )}
            </div>
          </div>

          {/* Clear button */}
          <button
            onClick={handleClearLayout}
            className="text-xs px-3 py-1.5 rounded-lg font-semibold transition-all duration-200"
            style={{
              background: isConfirmingClear ? "rgba(239,68,68,0.2)" : "rgba(239,68,68,0.08)",
              border: "1px solid rgba(239,68,68,0.3)",
              color: isConfirmingClear ? "#fecaca" : "#f87171",
            }}
          >
            {isConfirmingClear ? "🗑 Are you sure?" : "🗑 Clear Layout"}
          </button>
        </div>

        {/* Connection status indicator */}
        {connectingFrom && (
          <div
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs"
            style={{
              background: "rgba(139,92,246,0.1)",
              border: "1px solid rgba(139,92,246,0.3)",
              color: "#a78bfa",
            }}
          >
            <span
              className="w-2 h-2 rounded-full"
              style={{
                background: "#8b5cf6",
                animation: "pulse 1.5s ease-in-out infinite",
              }}
            />
            <span>
              Connecting from <strong>{connectingFrom}</strong> — click another node to create edge, or click same node to cancel
            </span>
          </div>
        )}

        {/* SVG Canvas */}
        <div
          className="rounded-xl overflow-hidden"
          style={{
            border: "1px solid rgba(30,58,95,0.5)",
            background: "rgba(5,10,20,0.6)",
          }}
        >
          <svg
            ref={svgRef}
            width="100%"
            height="380"
            viewBox={`0 0 ${bounds.width} ${bounds.height}`}
            preserveAspectRatio="xMidYMid meet"
            onClick={handleSvgClick}
            style={{ cursor: "crosshair" }}
          >
            <defs>
              <pattern
                id="editor-grid"
                width="20"
                height="20"
                patternUnits="userSpaceOnUse"
              >
                <path
                  d="M 20 0 L 0 0 0 20"
                  fill="none"
                  stroke="rgba(30,58,95,0.25)"
                  strokeWidth="0.5"
                />
              </pattern>
              <filter id="editor-glow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            <rect width={bounds.width} height={bounds.height} fill="url(#editor-grid)" />

            {/* Edges */}
            {layout.edges.map((edge) => {
              const fromNode = layout.nodes.find((n) => n.id === edge.from_node);
              const toNode = layout.nodes.find((n) => n.id === edge.to_node);
              if (!fromNode || !toNode) return null;

              const x1 = scaleX(fromNode.x);
              const y1 = scaleY(fromNode.y);
              const x2 = scaleX(toNode.x);
              const y2 = scaleY(toNode.y);

              return (
                <g key={`edge-${edge.from_node}-${edge.to_node}`}>
                  {/* Hover hitbox (wider transparent line) */}
                  <line
                    x1={x1} y1={y1} x2={x2} y2={y2}
                    stroke="transparent"
                    strokeWidth={12}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteEdge(edge.from_node, edge.to_node);
                    }}
                    style={{ cursor: "pointer" }}
                  />
                  {/* Visible line */}
                  <line
                    x1={x1} y1={y1} x2={x2} y2={y2}
                    stroke="rgba(59,130,246,0.35)"
                    strokeWidth={2}
                    strokeLinecap="round"
                    pointerEvents="none"
                  />
                </g>
              );
            })}

            {/* Nodes */}
            {layout.nodes.map((node) => {
              const x = scaleX(node.x);
              const y = scaleY(node.y);
              const isConnecting = connectingFrom === node.id;
              const meta = TYPE_META[node.type] ?? TYPE_META.walkway;

              return (
                <g key={node.id}>
                  {/* Glow ring */}
                  <circle
                    cx={x} cy={y}
                    r={NODE_RADIUS + 5}
                    fill={isConnecting ? "rgba(139,92,246,0.3)" : meta.glow}
                    opacity={isConnecting ? 0.6 : 0.2}
                    filter="url(#editor-glow)"
                  />
                  {/* Connecting pulse */}
                  {isConnecting && (
                    <circle
                      cx={x} cy={y}
                      r={NODE_RADIUS + 10}
                      fill="none"
                      stroke="#8b5cf6"
                      strokeWidth={1.5}
                      opacity={0.5}
                    />
                  )}
                  {/* Main circle */}
                  <circle
                    cx={x} cy={y}
                    r={NODE_RADIUS}
                    fill={meta.color}
                    stroke={isConnecting ? "#a78bfa" : "rgba(255,255,255,0.15)"}
                    strokeWidth={isConnecting ? 2.5 : 1.5}
                    style={{ transition: "all 0.2s" }}
                  />
                  {/* Label */}
                  <text
                    x={x} y={y}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize="8"
                    fontWeight="700"
                    fill="white"
                    pointerEvents="none"
                  >
                    {node.id.slice(0, 3)}
                  </text>
                  {/* Name below */}
                  <text
                    x={x} y={y + NODE_RADIUS + 10}
                    textAnchor="middle"
                    fontSize="7"
                    fontWeight="500"
                    fill="rgba(148,163,184,0.7)"
                    pointerEvents="none"
                  >
                    {node.id.replace(/_/g, " ")}
                  </text>
                  {/* Hitbox (left-click to connect, drag to move, right-click to delete) */}
                  <circle
                    cx={x} cy={y}
                    r={NODE_RADIUS + 6}
                    fill="transparent"
                    stroke="transparent"
                    style={{ cursor: "pointer" }}
                    onClick={(e) => e.stopPropagation()}
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      if (e.target instanceof Element) {
                        try { e.target.setPointerCapture(e.pointerId); } catch (err) {}
                      }
                      setDragState({ id: node.id, moved: false, startX: e.clientX, startY: e.clientY });
                    }}
                    onPointerMove={(e) => {
                      if (dragState && dragState.id === node.id) {
                        if (!dragState.moved) {
                          const dx = Math.abs(e.clientX - dragState.startX);
                          const dy = Math.abs(e.clientY - dragState.startY);
                          if (dx > 3 || dy > 3) {
                            setDragState({ ...dragState, moved: true });
                          } else {
                            return; // Wait until moved > 3px
                          }
                        }
                        const rect = svgRef.current!.getBoundingClientRect();
                        const x = ((e.clientX - rect.left) / rect.width) * 500;
                        const y = ((e.clientY - rect.top) / rect.height) * 380;
                        onLayoutChange({
                          ...layout,
                          nodes: layout.nodes.map((n) =>
                            n.id === node.id
                              ? { ...n, x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 }
                              : n
                          ),
                        });
                      }
                    }}
                    onPointerUp={(e) => {
                      e.stopPropagation();
                      if (e.target instanceof Element) {
                        try { e.target.releasePointerCapture(e.pointerId); } catch (err) {}
                      }
                      if (dragState && dragState.id === node.id) {
                        if (!dragState.moved) {
                          handleNodeClick(node.id);
                        }
                        setDragState(null);
                      }
                    }}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleDeleteNode(node.id);
                    }}
                  />
                </g>
              );
            })}
          </svg>
        </div>

        {/* Bottom bar */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => {
              const json = JSON.stringify(layout, null, 2);
              navigator.clipboard.writeText(json);
            }}
            className="text-xs px-3 py-1.5 rounded-lg font-medium transition-all duration-200 flex items-center gap-1.5"
            style={{
              background: "rgba(59,130,246,0.08)",
              border: "1px solid rgba(59,130,246,0.25)",
              color: "#60a5fa",
            }}
          >
            📋 Copy Layout as JSON
          </button>
          <div
            className="text-xs font-medium"
            style={{ color: "var(--text-muted)" }}
          >
            Right-click node to delete · Click edge to remove
          </div>
        </div>
      </div>
    </section>
  );
}
