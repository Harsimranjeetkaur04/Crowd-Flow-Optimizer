import type { Reroute, VenueLayout } from "../types";

interface RouteOverlayProps {
  layout: VenueLayout;
  reroutes: Reroute[];
  animate?: boolean;
}

const ROUTE_PALETTE = [
  { stroke: "#8b5cf6", glow: "rgba(139,92,246,0.5)",  label: "#a78bfa" },
  { stroke: "#06b6d4", glow: "rgba(6,182,212,0.5)",   label: "#67e8f9" },
  { stroke: "#ec4899", glow: "rgba(236,72,153,0.5)",  label: "#f9a8d4" },
  { stroke: "#f59e0b", glow: "rgba(245,158,11,0.5)",  label: "#fcd34d" },
  { stroke: "#10b981", glow: "rgba(16,185,129,0.5)",  label: "#6ee7b7" },
];

export function RouteOverlay({
  layout,
  reroutes,
  animate = true,
}: RouteOverlayProps) {
  if (!layout.nodes.length || !reroutes.length) {
    return (
      <div
        className="flex flex-col items-center justify-center h-full gap-3 rounded-2xl"
        style={{
          background: "rgba(5,10,20,0.5)",
          border: "1px dashed rgba(30,58,95,0.6)",
          color: "var(--text-muted)",
        }}
      >
        <span className="text-4xl">🔀</span>
        <p className="text-sm font-semibold">No reroutes to display</p>
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
  const H = Math.max(maxY - minY + pad * 2, 280);
  const rangeX = maxX - minX || 1;
  const rangeY = maxY - minY || 1;
  const scaleRange = Math.min(W - pad * 2, H - pad * 2);
  const sx = (x: number) => ((x - minX) / rangeX) * scaleRange + pad;
  const sy = (y: number) => ((y - minY) / rangeY) * scaleRange + pad;

  const nodeMap = new Map(layout.nodes.map((n) => [n.id, n]));

  return (
    <div
      className="h-full rounded-2xl overflow-hidden flex flex-col"
      style={{
        background: "rgba(5,10,20,0.8)",
        border: "1px solid rgba(30,58,95,0.5)",
      }}
    >
      <style>{`
        @keyframes routeDash {
          to { stroke-dashoffset: -30; }
        }
        .route-dash {
          animation: ${animate ? "routeDash 0.8s linear infinite" : "none"};
        }
      `}</style>

      <svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="xMidYMid meet"
        style={{ flex: 1 }}
      >
        <defs>
          <filter id="route-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <marker
            id="arrowhead-0"
            markerWidth="6" markerHeight="6"
            refX="3" refY="3" orient="auto"
          >
            <path d="M0,0 L0,6 L6,3 z" fill={ROUTE_PALETTE[0].stroke} opacity={0.8} />
          </marker>
          <marker
            id="arrowhead-1"
            markerWidth="6" markerHeight="6"
            refX="3" refY="3" orient="auto"
          >
            <path d="M0,0 L0,6 L6,3 z" fill={ROUTE_PALETTE[1].stroke} opacity={0.8} />
          </marker>
          <marker
            id="arrowhead-2"
            markerWidth="6" markerHeight="6"
            refX="3" refY="3" orient="auto"
          >
            <path d="M0,0 L0,6 L6,3 z" fill={ROUTE_PALETTE[2].stroke} opacity={0.8} />
          </marker>
          <pattern id="route-grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(30,58,95,0.15)" strokeWidth="0.5" />
          </pattern>
        </defs>

        {/* Background */}
        <rect width={W} height={H} fill="url(#route-grid)" />

        {/* Base layout edges (faint) */}
        {layout.edges.map((edge, i) => {
          const from = layout.nodes.find((n) => n.id === edge.from_node);
          const to   = layout.nodes.find((n) => n.id === edge.to_node);
          if (!from || !to) return null;
          return (
            <line
              key={`base-${i}`}
              x1={sx(from.x)} y1={sy(from.y)}
              x2={sx(to.x)}   y2={sy(to.y)}
              stroke="rgba(30,58,95,0.4)"
              strokeWidth={1.5}
              strokeLinecap="round"
              opacity={0.5}
            />
          );
        })}

        {/* Route paths */}
        {reroutes.map((reroute, routeIdx) => {
          const palette = ROUTE_PALETTE[routeIdx % ROUTE_PALETTE.length];
          const path = reroute.path;
          if (path.length < 2) return null;

          return (
            <g key={`route-${routeIdx}`}>
              {path.slice(0, -1).map((nodeId, segIdx) => {
                const from = nodeMap.get(nodeId);
                const to   = nodeMap.get(path[segIdx + 1]);
                if (!from || !to) return null;
                const x1 = sx(from.x), y1 = sy(from.y);
                const x2 = sx(to.x),   y2 = sy(to.y);
                const isLast = segIdx === path.length - 2;

                return (
                  <g key={`seg-${routeIdx}-${segIdx}`}>
                    {/* Glow trail */}
                    <line
                      x1={x1} y1={y1} x2={x2} y2={y2}
                      stroke={palette.stroke}
                      strokeWidth={8}
                      opacity={0.15}
                      strokeLinecap="round"
                      filter="url(#route-glow)"
                    />
                    {/* Animated dashed line */}
                    <line
                      x1={x1} y1={y1} x2={x2} y2={y2}
                      stroke={palette.stroke}
                      strokeWidth={3}
                      strokeDasharray="12 6"
                      strokeLinecap="round"
                      opacity={0.9}
                      className="route-dash"
                      markerEnd={isLast ? `url(#arrowhead-${routeIdx % 3})` : undefined}
                    />
                  </g>
                );
              })}

              {/* Route label on first segment midpoint */}
              {(() => {
                const from = nodeMap.get(path[0]);
                const to   = nodeMap.get(path[1]);
                if (!from || !to) return null;
                const mx = (sx(from.x) + sx(to.x)) / 2;
                const my = (sy(from.y) + sy(to.y)) / 2 - 14;
                const saved = Math.round(reroute.estimated_time_saved);

                return (
                  <g>
                    <rect
                      x={mx - 32} y={my - 11}
                      width={64} height={22}
                      rx={6}
                      fill={palette.stroke}
                      opacity={0.85}
                      filter="url(#route-glow)"
                    />
                    <text
                      x={mx} y={my}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fontSize="9"
                      fontWeight="700"
                      fill="white"
                    >
                      Route {routeIdx + 1} · -{saved}s
                    </text>
                  </g>
                );
              })()}
            </g>
          );
        })}

        {/* Base nodes */}
        {layout.nodes.map((node) => {
          const x = sx(node.x);
          const y = sy(node.y);
          const isOnRoute = reroutes.some((r) => r.path.includes(node.id));
          const isGate = node.type === "gate";
          const isExit = node.type === "exit";

          return (
            <g key={node.id}>
              <circle
                cx={x} cy={y}
                r={isOnRoute ? 12 : 8}
                fill={
                  isGate
                    ? "rgba(59,130,246,0.7)"
                    : isExit
                    ? "rgba(16,185,129,0.7)"
                    : "rgba(30,58,95,0.6)"
                }
                stroke={
                  isOnRoute
                    ? "rgba(255,255,255,0.4)"
                    : "rgba(30,58,95,0.8)"
                }
                strokeWidth={isOnRoute ? 2 : 1}
              />
              {isOnRoute && (
                <text
                  x={x} y={y}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize="7"
                  fontWeight="700"
                  fill="white"
                >
                  {node.id.slice(0, 3)}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      {/* Route Legend */}
      <div
        className="px-4 py-3 flex flex-wrap gap-4 text-xs"
        style={{
          borderTop: "1px solid rgba(30,58,95,0.4)",
          background: "rgba(5,10,20,0.6)",
        }}
      >
        {reroutes.map((r, i) => {
          const palette = ROUTE_PALETTE[i % ROUTE_PALETTE.length];
          return (
            <div key={i} className="flex items-center gap-2">
              <div
                className="w-8 h-1.5 rounded-full"
                style={{
                  background: palette.stroke,
                  boxShadow: `0 0 6px ${palette.glow}`,
                }}
              />
              <span style={{ color: palette.label, fontWeight: 600 }}>
                Route {i + 1}
              </span>
              <span style={{ color: "var(--text-muted)" }}>
                {r.gate_id} → {r.destination_id} (−{Math.round(r.estimated_time_saved)}s)
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
