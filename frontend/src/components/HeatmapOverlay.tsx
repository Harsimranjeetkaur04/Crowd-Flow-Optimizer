import type { NodeSnapshot, EdgeSnapshot, VenueLayout } from "../types";

const densityToColor = (d: number) => {
  if (d > 0.9) return { fill: "#7f1d1d", edge: "#991b1b", glow: "rgba(127,29,29,0.9)" };
  if (d > 0.8) return { fill: "#dc2626", edge: "#b91c1c", glow: "rgba(220,38,38,0.7)" };
  if (d > 0.6) return { fill: "#f97316", edge: "#ea580c", glow: "rgba(249,115,22,0.6)" };
  if (d > 0.4) return { fill: "#fbbf24", edge: "#d97706", glow: "rgba(251,191,36,0.5)" };
  if (d > 0.2) return { fill: "#34d399", edge: "#059669", glow: "rgba(52,211,153,0.4)" };
  return { fill: "#10b981", edge: "#047857", glow: "rgba(16,185,129,0.3)" };
};

interface HeatmapOverlayProps {
  layout: VenueLayout;
  nodeSnapshots: NodeSnapshot[];
  edgeSnapshots: EdgeSnapshot[];
  timestep: number;
}

export function HeatmapOverlay({
  layout,
  nodeSnapshots,
  edgeSnapshots,
  timestep,
}: HeatmapOverlayProps) {
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

  const nodeMap = new Map(nodeSnapshots.map((n) => [n.node_id, n]));
  const edgeMap = new Map(edgeSnapshots.map((e) => [`${e.from_node}->${e.to_node}`, e]));

  // Summary stats
  const allNodeDensities = nodeSnapshots.map((n) => n.density);
  const avgDensity = allNodeDensities.length
    ? allNodeDensities.reduce((a, b) => a + b, 0) / allNodeDensities.length
    : 0;
  const maxNodeDensity = allNodeDensities.length ? Math.max(...allNodeDensities) : 0;
  const hotspotCount = allNodeDensities.filter((d) => d > 0.7).length;

  return (
    <div
      className="h-full rounded-2xl overflow-hidden flex flex-col"
      style={{
        background: "rgba(5,10,20,0.8)",
        border: "1px solid rgba(30,58,95,0.5)",
      }}
    >
      {/* Stats Row */}
      <div
        className="flex items-center gap-4 px-4 py-2.5 text-xs"
        style={{
          borderBottom: "1px solid rgba(30,58,95,0.4)",
          background: "rgba(5,10,20,0.5)",
        }}
      >
        <div className="flex items-center gap-2">
          <span style={{ color: "var(--text-muted)" }}>Timestep</span>
          <span
            className="font-bold font-mono px-2 py-0.5 rounded"
            style={{
              background: "rgba(59,130,246,0.1)",
              color: "#60a5fa",
              border: "1px solid rgba(59,130,246,0.2)",
            }}
          >
            T={timestep}s
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span style={{ color: "var(--text-muted)" }}>Avg density</span>
          <span
            className="font-bold"
            style={{ color: densityToColor(avgDensity).fill }}
          >
            {Math.min(100, Math.round(avgDensity * 100))}%
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span style={{ color: "var(--text-muted)" }}>Peak</span>
          <span
            className="font-bold"
            style={{ color: densityToColor(maxNodeDensity).fill }}
          >
            {Math.min(100, Math.round(maxNodeDensity * 100))}%
          </span>
        </div>
        {hotspotCount > 0 && (
          <div className="ml-auto flex items-center gap-1.5">
            <span
              className="w-2 h-2 rounded-full"
              style={{
                background: "#ef4444",
                animation: "pulse 1.5s ease-in-out infinite",
              }}
            />
            <span style={{ color: "#f87171", fontWeight: 600 }}>
              {hotspotCount} hotspot{hotspotCount > 1 ? "s" : ""}
            </span>
          </div>
        )}
      </div>

      {/* SVG */}
      <svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="xMidYMid meet"
        style={{ flex: 1 }}
      >
        <defs>
          <filter id="hm-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="hm-soft" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <radialGradient id="node-vignette" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="white" stopOpacity="0.2" />
            <stop offset="100%" stopColor="white" stopOpacity="0" />
          </radialGradient>
          {/* Grid */}
          <pattern id="hm-grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path
              d="M 40 0 L 0 0 0 40"
              fill="none"
              stroke="rgba(30,58,95,0.15)"
              strokeWidth="0.5"
            />
          </pattern>
        </defs>

        {/* Grid background */}
        <rect width={W} height={H} fill="url(#hm-grid)" />

        {/* Edges */}
        {layout.edges.map((edge, i) => {
          const from = layout.nodes.find((n) => n.id === edge.from_node);
          const to   = layout.nodes.find((n) => n.id === edge.to_node);
          if (!from || !to) return null;

          const x1 = sx(from.x), y1 = sy(from.y);
          const x2 = sx(to.x),   y2 = sy(to.y);
          const snap = edgeMap.get(`${edge.from_node}->${edge.to_node}`);
          const density = snap?.density ?? 0;
          const dc = densityToColor(density);
          const sw = Math.max(3, Math.min(12, edge.width * 1.5));

          return (
            <g key={`he-${i}`}>
              {/* Halo */}
              <line
                x1={x1} y1={y1} x2={x2} y2={y2}
                stroke={dc.fill}
                strokeWidth={sw + 8}
                opacity={0.08 + density * 0.15}
                strokeLinecap="round"
                filter="url(#hm-soft)"
              />
              {/* Main */}
              <line
                x1={x1} y1={y1} x2={x2} y2={y2}
                stroke={dc.fill}
                strokeWidth={sw}
                strokeLinecap="round"
                opacity={0.7 + density * 0.2}
              />
            </g>
          );
        })}

        {/* Nodes */}
        {layout.nodes.map((node) => {
          const x = sx(node.x);
          const y = sy(node.y);
          const snap = nodeMap.get(node.id);
          const density = snap?.density ?? 0;
          const clampedDensity = Math.min(density, 1.0);
          const dc = densityToColor(clampedDensity);
          const r = 14 + clampedDensity * 6; // radius swells with density

          return (
            <g key={node.id}>
              {/* Outer corona */}
              <circle
                cx={x} cy={y} r={r + 10}
                fill={dc.glow}
                opacity={0.2 + clampedDensity * 0.3}
                filter="url(#hm-glow)"
              />
              {/* Main node */}
              <circle
                cx={x} cy={y} r={r}
                fill={dc.fill}
                stroke="rgba(255,255,255,0.15)"
                strokeWidth={1.5}
                filter={clampedDensity > 0.6 ? "url(#hm-soft)" : undefined}
              />
              {/* Highlight vignette */}
              <circle
                cx={x} cy={y} r={r}
                fill="url(#node-vignette)"
              />
              {/* Density % */}
              <text
                x={x} y={y}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={clampedDensity > 0.5 ? "9" : "8"}
                fontWeight="700"
                fill="white"
                pointerEvents="none"
              >
                {Math.min(100, Math.round(density * 100))}%
              </text>
              {/* Node ID label */}
              <text
                x={x} y={y + r + 10}
                textAnchor="middle"
                fontSize="7"
                fontWeight="500"
                fill="rgba(148,163,184,0.7)"
                pointerEvents="none"
              >
                {node.id.replace(/_/g, " ")}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Density Scale */}
      <div
        className="px-4 py-2.5 flex items-center gap-4"
        style={{
          borderTop: "1px solid rgba(30,58,95,0.4)",
          background: "rgba(5,10,20,0.5)",
        }}
      >
        <span
          className="text-xs font-semibold"
          style={{ color: "var(--text-muted)" }}
        >
          Density:
        </span>
        <div className="flex items-center gap-0.5 flex-1">
          {[
            { label: "0%", color: "#10b981" },
            { label: "20%", color: "#34d399" },
            { label: "40%", color: "#fbbf24" },
            { label: "60%", color: "#f97316" },
            { label: "80%", color: "#dc2626" },
            { label: "90%+", color: "#7f1d1d" },
          ].map((s) => (
            <div key={s.label} className="flex items-center gap-1 mr-3">
              <div
                className="w-3 h-3 rounded-sm"
                style={{
                  background: s.color,
                  boxShadow: `0 0 4px ${s.color}88`,
                }}
              />
              <span
                className="text-xs"
                style={{ color: "var(--text-muted)", fontSize: "10px" }}
              >
                {s.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
