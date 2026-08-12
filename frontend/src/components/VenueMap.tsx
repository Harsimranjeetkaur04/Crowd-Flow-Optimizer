import type { VenueLayout, NodeSnapshot, EdgeSnapshot } from "../types";

const NODE_R = 14;

const TYPE_META: Record<string, { color: string; glow: string; icon: string }> = {
  gate:       { color: "#3b82f6", glow: "rgba(59,130,246,0.5)",  icon: "G" },
  exit:       { color: "#10b981", glow: "rgba(16,185,129,0.5)",  icon: "E" },
  concession: { color: "#f97316", glow: "rgba(249,115,22,0.5)",  icon: "C" },
  walkway:    { color: "#94a3b8", glow: "rgba(148,163,184,0.3)", icon: "W" },
};

const densityColor = (d: number) => {
  if (d > 0.9) return { fill: "#7f1d1d", glow: "rgba(127,29,29,0.8)", text: "#fca5a5" };
  if (d > 0.8) return { fill: "#dc2626", glow: "rgba(220,38,38,0.6)", text: "#fee2e2" };
  if (d > 0.6) return { fill: "#f97316", glow: "rgba(249,115,22,0.5)", text: "#fed7aa" };
  if (d > 0.4) return { fill: "#fbbf24", glow: "rgba(251,191,36,0.4)", text: "#fef3c7" };
  if (d > 0.2) return { fill: "#34d399", glow: "rgba(52,211,153,0.3)", text: "#d1fae5" };
  return { fill: "#10b981", glow: "rgba(16,185,129,0.25)", text: "#d1fae5" };
};

interface VenueMapProps {
  layout: VenueLayout;
  nodeSnapshots?: NodeSnapshot[];
  edgeSnapshots?: EdgeSnapshot[];
  highlightedBottlenecks?: Set<string>;
}

export function VenueMap({
  layout,
  nodeSnapshots,
  edgeSnapshots,
  highlightedBottlenecks,
}: VenueMapProps) {
  if (!layout.nodes.length) {
    return (
      <div
        className="flex flex-col items-center justify-center h-full gap-4 rounded-2xl"
        style={{
          background: "rgba(5,10,20,0.5)",
          border: "1px dashed rgba(30,58,95,0.8)",
          color: "var(--text-muted)",
        }}
      >
        <span className="text-5xl">🏟️</span>
        <p className="font-semibold text-sm">No venue layout loaded</p>
        <p className="text-xs">Add nodes and corridors to get started</p>
      </div>
    );
  }

  const xs = layout.nodes.map((n) => n.x);
  const ys = layout.nodes.map((n) => n.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const pad = 60;
  const W = Math.max(maxX - minX + pad * 2, 480);
  const H = Math.max(maxY - minY + pad * 2, 320);
  const rangeX = maxX - minX || 1;
  const rangeY = maxY - minY || 1;
  const scaleRange = Math.min(W - pad * 2, H - pad * 2);
  const sx = (x: number) => ((x - minX) / rangeX) * scaleRange + pad;
  const sy = (y: number) => ((y - minY) / rangeY) * scaleRange + pad;

  const nodeSnapshotMap = new Map(nodeSnapshots?.map((n) => [n.node_id, n]) ?? []);
  const edgeSnapshotMap = new Map(
    edgeSnapshots?.map((e) => [`${e.from_node}->${e.to_node}`, e]) ?? []
  );

  return (
    <div
      className="rounded-2xl overflow-hidden h-full flex flex-col"
      style={{
        background: "rgba(5,10,20,0.7)",
        border: "1px solid rgba(30,58,95,0.5)",
      }}
    >
      <svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="xMidYMid meet"
        style={{ flex: 1 }}
      >
        <defs>
          {/* Glow filter for bottlenecks */}
          <filter id="glow-hot" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="glow-soft" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          {/* Grid pattern */}
          <pattern id="map-grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path
              d="M 40 0 L 0 0 0 40"
              fill="none"
              stroke="rgba(30,58,95,0.2)"
              strokeWidth="0.5"
            />
          </pattern>
        </defs>

        {/* Background grid */}
        <rect width={W} height={H} fill="url(#map-grid)" />

        {/* Edges */}
        {layout.edges.map((edge, i) => {
          const from = layout.nodes.find((n) => n.id === edge.from_node);
          const to   = layout.nodes.find((n) => n.id === edge.to_node);
          if (!from || !to) return null;

          const x1 = sx(from.x), y1 = sy(from.y);
          const x2 = sx(to.x),   y2 = sy(to.y);
          const snap = edgeSnapshotMap.get(`${edge.from_node}->${edge.to_node}`);
          const density = snap?.density ?? 0;
          const dc = densityColor(density);
          const isBottleneck = highlightedBottlenecks?.has(`${edge.from_node}->${edge.to_node}`) ?? false;
          const strokeW = Math.max(2, Math.min(10, edge.width * 1.2));

          return (
            <g key={`edge-${i}`}>
              {/* Shadow/glow line */}
              <line
                x1={x1} y1={y1} x2={x2} y2={y2}
                stroke={snap ? dc.fill : (isBottleneck ? "#ef4444" : "rgba(30,58,95,0.6)")}
                strokeWidth={strokeW + 4}
                opacity={0.15}
                strokeLinecap="round"
              />
              {/* Main line */}
              <line
                x1={x1} y1={y1} x2={x2} y2={y2}
                stroke={snap ? dc.fill : (isBottleneck ? "#ef4444" : "rgba(59,130,246,0.35)")}
                strokeWidth={strokeW}
                strokeLinecap="round"
                opacity={0.85}
                filter={isBottleneck || (snap && density > 0.6) ? "url(#glow-soft)" : undefined}
              />
              {/* Density label midpoint */}
              {snap && density > 0.3 && (
                <text
                  x={(x1 + x2) / 2}
                  y={(y1 + y2) / 2 - 6}
                  textAnchor="middle"
                  fontSize="8"
                  fontWeight="600"
                  fill={dc.fill}
                  opacity={0.9}
                >
                  {Math.min(100, Math.round(density * 100))}%
                </text>
              )}
            </g>
          );
        })}

        {/* Nodes */}
        {layout.nodes.map((node) => {
          const x = sx(node.x);
          const y = sy(node.y);
          const snap = nodeSnapshotMap.get(node.id);
          const density = snap?.density ?? 0;
          const isBottleneck = highlightedBottlenecks?.has(node.id) ?? false;
          const meta = TYPE_META[node.type] ?? TYPE_META.walkway;
          const dc = snap ? densityColor(Math.min(density, 1.0)) : null;
          const fill = dc ? dc.fill : meta.color;
          const glow = dc ? dc.glow : meta.glow;

          return (
            <g key={node.id}>
              {/* Outer glow ring */}
              <circle
                cx={x} cy={y} r={NODE_R + 6}
                fill={glow}
                opacity={isBottleneck ? 0.5 : 0.2}
                filter="url(#glow-hot)"
              />
              {/* Bottleneck pulse ring */}
              {isBottleneck && (
                <circle
                  cx={x} cy={y} r={NODE_R + 10}
                  fill="none"
                  stroke="#ef4444"
                  strokeWidth={1.5}
                  opacity={0.4}
                />
              )}
              {/* Node circle */}
              <circle
                cx={x} cy={y} r={NODE_R}
                fill={fill}
                stroke={isBottleneck ? "#ef4444" : "rgba(255,255,255,0.15)"}
                strokeWidth={isBottleneck ? 2.5 : 1.5}
                filter={snap && density > 0.5 ? "url(#glow-soft)" : undefined}
              />
              {/* Icon / density text */}
              <text
                x={x} y={y}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={snap ? "8" : "9"}
                fontWeight="700"
                fill="white"
                pointerEvents="none"
              >
                {snap ? `${Math.min(100, Math.round(density * 100))}%` : meta.icon}
              </text>
              {/* Node label below */}
              <text
                x={x} y={y + NODE_R + 10}
                textAnchor="middle"
                fontSize="7"
                fontWeight="500"
                fill="rgba(148,163,184,0.8)"
                pointerEvents="none"
              >
                {node.id.replace(/_/g, " ")}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Legend */}
      <div
        className="px-4 py-3 flex flex-wrap gap-4 text-xs"
        style={{
          borderTop: "1px solid rgba(30,58,95,0.4)",
          background: "rgba(5,10,20,0.6)",
        }}
      >
        {Object.entries(TYPE_META).map(([type, meta]) => (
          <div key={type} className="flex items-center gap-1.5">
            <div
              className="w-3 h-3 rounded-full"
              style={{
                background: meta.color,
                boxShadow: `0 0 6px ${meta.glow}`,
              }}
            />
            <span
              className="capitalize font-medium"
              style={{ color: "var(--text-secondary)" }}
            >
              {type}
            </span>
          </div>
        ))}
        <div className="section-divider" style={{ width: "1px", height: "auto", margin: "0 4px" }} />
        {[
          { label: "Low", color: "#10b981" },
          { label: "Medium", color: "#fbbf24" },
          { label: "High", color: "#f97316" },
          { label: "Critical", color: "#dc2626" },
        ].map((d) => (
          <div key={d.label} className="flex items-center gap-1.5">
            <div
              className="w-3 h-3 rounded-full"
              style={{
                background: d.color,
                boxShadow: `0 0 6px ${d.color}55`,
              }}
            />
            <span style={{ color: "var(--text-secondary)" }}>{d.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
