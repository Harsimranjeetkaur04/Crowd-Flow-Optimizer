import { useState, useEffect, useCallback } from "react";
import { ControlPanel } from "./components/ControlPanel";
import { VenueMap } from "./components/VenueMap";
import { LayoutEditor } from "./components/LayoutEditor";
import { HeatmapOverlay } from "./components/HeatmapOverlay";
import { RouteOverlay } from "./components/RouteOverlay";
import { useSimulationSocket } from "./hooks/useSimulationSocket";
import {
  runSimulation,
  saveLayout,
  getVenues,
  runCounterfactual,
  loginUser,
  registerUser,
} from "./api/client";
import { DEMO_STADIUM_LAYOUT } from "./demoData";
import type {
  VenueLayout,
  EventSchedule,
  SimulationResponse,
  Snapshot,
} from "./types";

type View = "layout" | "simulate" | "results";

const NavStep = ({
  num,
  label,
  active,
  done,
  onClick,
}: {
  num: number;
  label: string;
  active: boolean;
  done: boolean;
  onClick?: () => void;
}) => (
  <button
    onClick={onClick}
    className={`flex items-center gap-3 px-5 py-2.5 rounded-xl border text-sm font-semibold transition-all duration-300 ${
      active
        ? "bg-blue-600/20 border-blue-500/50 text-blue-300 shadow-[0_0_20px_rgba(59,130,246,0.2)]"
        : done
        ? "bg-green-600/10 border-green-500/30 text-green-400 cursor-pointer hover:bg-green-600/20"
        : "bg-transparent border-white/5 text-slate-500 cursor-default"
    }`}
    disabled={!done && !active}
  >
    <span
      className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
        done
          ? "bg-green-500 text-white"
          : active
          ? "bg-blue-500 text-white"
          : "bg-slate-700 text-slate-400"
      }`}
    >
      {done ? "✓" : num}
    </span>
    {label}
  </button>
);

export default function App() {
  const [view, setView] = useState<View>("layout");
  const [layout, setLayout] = useState<VenueLayout>(DEMO_STADIUM_LAYOUT);
  const [isSimulationRunning, setIsSimulationRunning] = useState(false);
  const [simulationResult, setSimulationResult] =
    useState<SimulationResponse | null>(null);
  const [simulationId, setSimulationId] = useState<string | null>(null);
  const [currentSnapshot, setCurrentSnapshot] = useState<Snapshot | null>(null);
  const [currentTimestep, setCurrentTimestep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [bottleneckSet, setBottleneckSet] = useState<Set<string>>(new Set());
  const [activeResultTab, setActiveResultTab] = useState<
    "heatmap" | "reroutes" | "bottlenecks" | "counterfactual"
  >("heatmap");
  const [simProgress, setSimProgress] = useState(0);

  // Auth state
  const [userToken, setUserToken] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [authEmailInput, setAuthEmailInput] = useState("");
  const [authPasswordInput, setAuthPasswordInput] = useState("");
  const [authMsg, setAuthMsg] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);

  // Venues Modal state
  const [showVenuesModal, setShowVenuesModal] = useState(false);
  const [savedVenuesList, setSavedVenuesList] = useState<Array<{ id: string; name: string; layout: VenueLayout }>>([]);
  const [loadingVenues, setLoadingVenues] = useState(false);

  // Counterfactual state
  const [cfResult, setCfResult] = useState<any | null>(null);
  const [isCfRunning, setIsCfRunning] = useState(false);

  // Last run params
  const [lastCrowdSize, setLastCrowdSize] = useState(2000);
  const [lastSchedule, setLastSchedule] = useState<EventSchedule[]>([{ time: 0, arrival_rate: 80 }]);

  useEffect(() => {
    if (simulationResult?.bottlenecks) {
      const s = new Set<string>();
      simulationResult.bottlenecks.forEach((b) => s.add(b.id));
      setBottleneckSet(s);
    }
  }, [simulationResult]);

  useEffect(() => {
    if (isSimulationRunning) {
      const target = simulationResult ? 100 : Math.min(currentTimestep * 5, 90);
      setSimProgress(target);
    } else if (simulationResult) {
      setSimProgress(100);
    }
  }, [isSimulationRunning, currentTimestep, simulationResult]);

  const handleSocketSnapshot = useCallback((snapshot: Snapshot, timestep: number) => {
    setCurrentSnapshot(snapshot);
    setCurrentTimestep(timestep);
  }, []);

  const handleSocketCompleted = useCallback(() => {
    setIsSimulationRunning(false);
  }, []);

  const handleSocketError = useCallback((msg: string) => {
    setError(msg);
    setIsSimulationRunning(false);
  }, []);

  useSimulationSocket({
    simulationId: simulationId || "",
    onSnapshot: handleSocketSnapshot,
    onCompleted: handleSocketCompleted,
    onError: handleSocketError,
  });

  const handleRunSimulation = async (
    crowdSize: number,
    schedule: EventSchedule[]
  ) => {
    setError(null);
    setIsSimulationRunning(true);
    setView("simulate");
    setCurrentSnapshot(null);
    setCurrentTimestep(0);
    setSimProgress(0);
    setCfResult(null);
    setLastCrowdSize(crowdSize);
    setLastSchedule(schedule);

    try {
      const result = await runSimulation({
        layout,
        expected_crowd_size: crowdSize,
        event_schedule: schedule,
        duration_seconds: 20,
      });
      setSimulationResult(result);
      setSimulationId(result.simulation_id);
    } catch (err: any) {
      setError(err?.message ?? `Failed to run simulation: ${err}`);
      setIsSimulationRunning(false);
    }
  };

  const handleSaveVenueLayout = async () => {
    try {
      await saveLayout(layout);
    } catch (err: any) {
      setError(err?.message ?? "Failed to save layout to server.");
      throw err;
    }
  };

  const handleFetchSavedVenues = async () => {
    setLoadingVenues(true);
    try {
      const venues = await getVenues();
      setSavedVenuesList(venues);
      setShowVenuesModal(true);
    } catch (err: any) {
      setError(err?.message ?? "Failed to fetch saved venues.");
    } finally {
      setLoadingVenues(false);
    }
  };

  const handleRunCounterfactual = async () => {
    if (!simulationResult || !simulationResult.bottlenecks.length) return;
    setIsCfRunning(true);
    try {
      const primaryBottleneck = simulationResult.bottlenecks[0];
      const res = await runCounterfactual(
        {
          layout,
          expected_crowd_size: lastCrowdSize,
          event_schedule: lastSchedule,
          duration_seconds: 20,
        },
        primaryBottleneck
      );
      setCfResult(res);
      setActiveResultTab("counterfactual");
    } catch (err: any) {
      setError(err?.message ?? "Failed to run counterfactual scenario.");
    } finally {
      setIsCfRunning(false);
    }
  };

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthMsg(null);
    setAuthLoading(true);
    try {
      if (authMode === "login") {
        const res = await loginUser(authEmailInput, authPasswordInput);
        setUserToken(res.access_token);
        setUserEmail(authEmailInput);
        setShowAuthModal(false);
        setAuthEmailInput("");
        setAuthPasswordInput("");
      } else {
        const res = await registerUser(authEmailInput, authPasswordInput);
        setAuthMsg(res.message ?? "Registration successful! You can now log in.");
        setAuthMode("login");
      }
    } catch (err: any) {
      setAuthMsg(err?.message ?? "Authentication failed.");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLoadDemo = () => {
    setLayout(DEMO_STADIUM_LAYOUT);
    setView("layout");
    setSimulationResult(null);
    setError(null);
    setSimProgress(0);
    setCfResult(null);
  };

  const rawMaxSeverity =
    simulationResult?.bottlenecks.reduce(
      (m, b) => Math.max(m, b.severity),
      0
    ) ?? 0;
  const maxSeverity = Math.min(rawMaxSeverity, 1.0);

  const riskLevel =
    rawMaxSeverity > 0.8 ? "critical" : rawMaxSeverity > 0.5 ? "warning" : "safe";

  return (
    <div
      className="min-h-screen bg-grid"
      style={{ background: "var(--bg-base)" }}
    >
      {/* ── Header ─────────────────────────────────────────── */}
      <header
        className="sticky top-0 z-50"
        style={{
          background:
            "linear-gradient(180deg, rgba(5,10,20,0.98) 0%, rgba(5,10,20,0.85) 100%)",
          backdropFilter: "blur(24px)",
          borderBottom: "1px solid rgba(30,58,95,0.5)",
        }}
      >
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          {/* Brand */}
          <div className="flex items-center gap-4">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
              style={{
                background: "linear-gradient(135deg, #1d4ed8, #0891b2)",
                boxShadow: "0 0 20px rgba(59,130,246,0.4)",
              }}
            >
              🏟️
            </div>
            <div>
              <h1
                className="text-xl font-extrabold tracking-tight gradient-text"
                style={{ letterSpacing: "-0.02em" }}
              >
                CrowdFlow AI
              </h1>
              <p
                className="text-xs font-medium"
                style={{ color: "var(--text-muted)" }}
              >
                Real-time crowd dynamics & safety optimisation
              </p>
            </div>
          </div>

          {/* Step Nav */}
          <nav className="hidden md:flex items-center gap-2">
            <NavStep
              num={1}
              label="Venue Layout"
              active={view === "layout"}
              done={view !== "layout"}
              onClick={() => setView("layout")}
            />
            <div
              className="w-6 h-px"
              style={{ background: "var(--border)" }}
            />
            <NavStep
              num={2}
              label="Simulation"
              active={view === "simulate"}
              done={view === "results"}
              onClick={
                view === "results" ? () => setView("simulate") : undefined
              }
            />
            <div
              className="w-6 h-px"
              style={{ background: "var(--border)" }}
            />
            <NavStep
              num={3}
              label="Results"
              active={view === "results"}
              done={false}
              onClick={
                simulationResult ? () => setView("results") : undefined
              }
            />
          </nav>

          {/* Header Action Buttons */}
          <div className="flex items-center gap-2">
            {simulationResult && (
              <span
                className={`badge ${
                  riskLevel === "critical"
                    ? "badge-red"
                    : riskLevel === "warning"
                    ? "badge-amber"
                    : "badge-green"
                }`}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{
                    background:
                      riskLevel === "critical"
                        ? "#ef4444"
                        : riskLevel === "warning"
                        ? "#f59e0b"
                        : "#10b981",
                    animation: riskLevel !== "safe" ? "pulse 2s infinite" : "",
                  }}
                />
                {riskLevel === "critical"
                  ? "Critical Risk"
                  : riskLevel === "warning"
                  ? "Elevated Risk"
                  : "All Clear"}
              </span>
            )}

            <button
              onClick={handleFetchSavedVenues}
              disabled={loadingVenues}
              className="btn-ghost text-xs py-2 px-3 flex items-center gap-1.5"
            >
              📂 Saved Venues
            </button>

            <button onClick={handleLoadDemo} className="btn-ghost text-xs py-2 px-3">
              🏟 Demo Stadium
            </button>

            {userToken ? (
              <div className="flex items-center gap-2">
                <span className="text-xs px-2.5 py-1.5 rounded-lg font-mono font-semibold" style={{ background: "rgba(59,130,246,0.1)", color: "#60a5fa" }}>
                  👤 {userEmail}
                </span>
                <button
                  onClick={() => { setUserToken(null); setUserEmail(null); }}
                  className="text-xs text-red-400 hover:underline px-1"
                >
                  Sign Out
                </button>
              </div>
            ) : (
              <button
                onClick={() => { setShowAuthModal(true); setAuthMsg(null); }}
                className="btn-primary text-xs py-2 px-3 flex items-center gap-1"
              >
                🔑 Sign In
              </button>
            )}
          </div>
        </div>
      </header>

      {/* ── Error Banner ───────────────────────────────────── */}
      {error && (
        <div className="max-w-7xl mx-auto px-6 pt-4" role="alert">
          <div
            className="flex items-center justify-between p-4 rounded-xl text-sm"
            style={{
              background: "rgba(239,68,68,0.1)",
              border: "1px solid rgba(239,68,68,0.3)",
              color: "#fca5a5",
            }}
          >
            <span>
              <strong>⚠ Alert:</strong> {error}
            </span>
            <button
              onClick={() => setError(null)}
              className="ml-4 px-3 py-1 rounded-lg text-xs font-semibold"
              style={{
                background: "rgba(239,68,68,0.2)",
                color: "#fca5a5",
              }}
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* ── Main Content ───────────────────────────────────── */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* ── LAYOUT VIEW ──────────────────────────────────── */}
        {view === "layout" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>
                  Venue Configuration
                </h2>
                <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
                  Configure nodes and corridors, then launch the AI simulation
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="badge badge-blue">
                  {layout.nodes.length} nodes
                </span>
                <span className="badge badge-purple">
                  {layout.edges.length} corridors
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Editor */}
              <div className="lg:col-span-2">
                <LayoutEditor
                  layout={layout}
                  onLayoutChange={setLayout}
                  onSaveLayout={handleSaveVenueLayout}
                />
              </div>

              {/* Control Panel */}
              <div>
                <ControlPanel
                  layout={layout}
                  onRunSimulation={handleRunSimulation}
                  isRunning={isSimulationRunning}
                />
              </div>
            </div>

            {/* Venue Preview */}
            <div className="glass-card overflow-hidden">
              <div
                className="px-5 py-4 flex items-center justify-between"
                style={{ borderBottom: "1px solid rgba(30,58,95,0.5)" }}
              >
                <h3 className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>
                  Live Venue Preview
                </h3>
                <span className="badge badge-blue">Interactive</span>
              </div>
              <div style={{ height: "420px", padding: "16px" }}>
                <VenueMap layout={layout} />
              </div>
            </div>
          </div>
        )}

        {/* ── SIMULATE VIEW ────────────────────────────────── */}
        {view === "simulate" && (
          <div className="space-y-6">
            {/* Progress Header */}
            <div className="gradient-border glass-card p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-4">
                  <div
                    className="w-12 h-12 rounded-2xl flex items-center justify-center"
                    style={{
                      background: "linear-gradient(135deg, rgba(37,99,235,0.3), rgba(8,145,178,0.3))",
                      border: "1px solid rgba(59,130,246,0.3)",
                    }}
                  >
                    {isSimulationRunning ? (
                      <div className="dot-bounce">
                        <span /><span /><span />
                      </div>
                    ) : (
                      <span className="text-2xl">✅</span>
                    )}
                  </div>
                  <div>
                    <h2 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>
                      {isSimulationRunning
                        ? "Simulation In Progress"
                        : "Simulation Complete"}
                    </h2>
                    <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                      {isSimulationRunning
                        ? `Processing timestep ${currentTimestep}s — AI model analysing crowd dynamics…`
                        : "All timesteps processed. Analysing bottlenecks & generating reroute recommendations."}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setView("results")}
                  className="btn-primary"
                  disabled={isSimulationRunning || !simulationResult}
                  style={{
                    opacity: isSimulationRunning || !simulationResult ? 0.5 : 1,
                    cursor: isSimulationRunning || !simulationResult ? "not-allowed" : "pointer",
                  }}
                >
                  {isSimulationRunning ? "Simulating Frames..." : "View Results →"}
                </button>
              </div>

              {/* Progress Bar */}
              <div
                className="w-full rounded-full overflow-hidden"
                style={{
                  height: "8px",
                  background: "rgba(30,58,95,0.6)",
                }}
              >
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${simProgress}%`,
                    backgroundImage: isSimulationRunning
                      ? "linear-gradient(90deg, #1d4ed8, #2563eb, #60a5fa, #2563eb, #1d4ed8)"
                      : "linear-gradient(90deg, #059669, #10b981)",
                    backgroundSize: "200% 100%",
                    animation: isSimulationRunning
                      ? "shimmer 2s linear infinite"
                      : "none",
                  }}
                />
              </div>
              <div
                className="flex justify-between text-xs mt-2"
                style={{ color: "var(--text-muted)" }}
              >
                <span>Timestep: {currentTimestep}s</span>
                <span>{Math.round(simProgress)}%</span>
              </div>
            </div>

            {/* Live Heatmap */}
            {currentSnapshot && (
              <div className="glass-card overflow-hidden">
                <div
                  className="px-5 py-4 flex items-center gap-3"
                  style={{ borderBottom: "1px solid rgba(30,58,95,0.5)" }}
                >
                  <span className="text-lg">🔥</span>
                  <h3
                    className="font-semibold"
                    style={{ color: "var(--text-primary)" }}
                  >
                    Live Density Heatmap
                  </h3>
                  <span
                    className="ml-auto text-xs font-mono px-3 py-1 rounded-lg"
                    style={{
                      background: "rgba(59,130,246,0.1)",
                      color: "#60a5fa",
                      border: "1px solid rgba(59,130,246,0.2)",
                    }}
                  >
                    T = {currentTimestep}s
                  </span>
                </div>
                <div style={{ padding: "16px", height: "420px" }}>
                  <HeatmapOverlay
                    layout={layout}
                    nodeSnapshots={currentSnapshot.nodes}
                    edgeSnapshots={currentSnapshot.edges}
                    timestep={currentTimestep}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── RESULTS VIEW ─────────────────────────────────── */}
        {view === "results" && simulationResult && (
          <div className="space-y-6">
            {/* KPI Strip */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                {
                  label: "Crowd Size",
                  value: simulationResult.expected_crowd_size.toLocaleString(),
                  icon: "👥",
                  accent: "#3b82f6",
                  sub: `${simulationResult.injected_crowd_size} injected`,
                },
                {
                  label: "Duration",
                  value: `${simulationResult.duration_seconds}s`,
                  icon: "⏱",
                  accent: "#8b5cf6",
                  sub: "simulation time",
                },
                {
                  label: "Bottlenecks",
                  value: simulationResult.bottlenecks.length,
                  icon: "⚠️",
                  accent:
                    simulationResult.bottlenecks.length > 3
                      ? "#ef4444"
                      : simulationResult.bottlenecks.length > 0
                      ? "#f59e0b"
                      : "#10b981",
                  sub: "detected hotspots",
                },
                {
                  label: "Reroutes",
                  value: simulationResult.reroutes.length,
                  icon: "🔀",
                  accent: "#10b981",
                  sub: "paths recommended",
                },
              ].map((kpi) => (
                <div
                  key={kpi.label}
                  className="metric-card"
                  style={{ "--accent-color": kpi.accent } as React.CSSProperties}
                >
                  <div className="text-2xl mb-2" style={{ lineHeight: 1 }}>
                    {kpi.icon}
                  </div>
                  <div
                    className="text-3xl font-extrabold"
                    style={{ color: kpi.accent, letterSpacing: "-0.02em" }}
                  >
                    {kpi.value}
                  </div>
                  <div
                    className="text-xs font-semibold mt-1"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    {kpi.label}
                  </div>
                  <div
                    className="text-xs mt-0.5"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {kpi.sub}
                  </div>
                </div>
              ))}
            </div>

            {/* Risk Alert */}
            {riskLevel !== "safe" && (
              <div
                className="flex items-center gap-4 p-4 rounded-2xl"
                style={{
                  background:
                    riskLevel === "critical"
                      ? "rgba(239,68,68,0.08)"
                      : "rgba(245,158,11,0.08)",
                  border: `1px solid ${
                    riskLevel === "critical"
                      ? "rgba(239,68,68,0.3)"
                      : "rgba(245,158,11,0.3)"
                  }`,
                }}
              >
                <span className="text-3xl">
                  {riskLevel === "critical" ? "🚨" : "⚠️"}
                </span>
                <div>
                  <div
                    className="font-bold"
                    style={{
                      color: riskLevel === "critical" ? "#f87171" : "#fbbf24",
                    }}
                  >
                    {riskLevel === "critical"
                      ? "Critical crowd density detected"
                      : "Elevated crowd density warning"}
                  </div>
                  <div
                    className="text-sm mt-0.5"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    AI model detected {simulationResult.bottlenecks.length} bottleneck
                    {simulationResult.bottlenecks.length !== 1 ? "s" : ""} with max severity{" "}
                    {(maxSeverity * 100).toFixed(0)}%. Immediate rerouting recommended.
                  </div>
                </div>
              </div>
            )}

            {/* Tabbed Analysis Panel */}
            <div className="glass-card overflow-hidden">
              {/* Tab Header */}
              <div
                className="px-5 py-4 flex items-center justify-between"
                style={{ borderBottom: "1px solid rgba(30,58,95,0.5)" }}
              >
                <h3 className="font-semibold" style={{ color: "var(--text-primary)" }}>
                  Simulation Analysis
                </h3>
                <div className="tab-nav">
                  {(
                    [
                      { id: "heatmap", label: "🔥 Heatmap" },
                      { id: "reroutes", label: "🔀 Reroutes" },
                      { id: "bottlenecks", label: "⚠️ Bottlenecks" },
                    ] as const
                  ).map((t) => (
                    <button
                      key={t.id}
                      className={`tab-btn ${activeResultTab === t.id ? "active" : ""}`}
                      onClick={() => setActiveResultTab(t.id)}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Heatmap Tab */}
              {activeResultTab === "heatmap" && (
                <div style={{ padding: "16px", height: "460px" }}>
                  {simulationResult.snapshots.length > 0 && (
                    <HeatmapOverlay
                      layout={layout}
                      nodeSnapshots={
                        simulationResult.snapshots[
                          simulationResult.snapshots.length - 1
                        ].nodes
                      }
                      edgeSnapshots={
                        simulationResult.snapshots[
                          simulationResult.snapshots.length - 1
                        ].edges
                      }
                      timestep={simulationResult.snapshots.length - 1}
                    />
                  )}
                </div>
              )}

              {/* Reroutes Tab */}
              {activeResultTab === "reroutes" && (
                <div className="p-5 space-y-4" style={{ maxHeight: "460px", overflowY: "auto" }}>
                  {simulationResult.reroutes.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 gap-3" style={{ color: "var(--text-muted)" }}>
                      <span className="text-5xl">✅</span>
                      <p className="font-semibold">No reroutes needed — crowd flow is optimal</p>
                    </div>
                  ) : (
                    simulationResult.reroutes.map((reroute, idx) => {
                      const savedPct =
                        reroute.congested_baseline_time > 0
                          ? ((reroute.estimated_time_saved / reroute.congested_baseline_time) * 100).toFixed(0)
                          : "0";

                      return (
                        <div key={idx} className="glass-card-hover rounded-2xl p-5" style={{ background: "rgba(5,10,20,0.6)", border: "1px solid rgba(30,58,95,0.6)" }}>
                          <div className="flex items-start justify-between mb-3">
                            <div>
                              <div className="font-bold text-base" style={{ color: "var(--text-primary)" }}>
                                {reroute.gate_id}
                                <span className="mx-2 font-normal" style={{ color: "var(--text-muted)" }}>→</span>
                                {reroute.destination_id}
                              </div>
                              <div className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>
                                Avoids <span className="badge badge-red" style={{ fontSize: "10px" }}>{reroute.avoids}</span>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-2xl font-extrabold" style={{ color: "#34d399", letterSpacing: "-0.02em" }}>
                                -{savedPct}%
                              </div>
                              <div className="text-xs" style={{ color: "var(--text-muted)" }}>time saved</div>
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-2">
                            {reroute.path.map((step, i) => (
                              <span key={i} className="flex items-center gap-2">
                                <span className="px-2.5 py-1 rounded-lg text-xs font-mono font-semibold" style={{ background: "rgba(59,130,246,0.12)", color: "#60a5fa", border: "1px solid rgba(59,130,246,0.2)" }}>
                                  {step}
                                </span>
                                {i < reroute.path.length - 1 && <span style={{ color: "var(--text-muted)" }}>→</span>}
                              </span>
                            ))}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}

              {/* Bottlenecks Tab */}
              {activeResultTab === "bottlenecks" && (
                <div className="p-5 space-y-3" style={{ maxHeight: "460px", overflowY: "auto" }}>
                  {simulationResult.bottlenecks.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 gap-3" style={{ color: "var(--text-muted)" }}>
                      <span className="text-5xl">✅</span>
                      <p className="font-semibold">No bottlenecks detected</p>
                    </div>
                  ) : (
                    simulationResult.bottlenecks.map((bn, idx) => {
                      const sevPct = Math.min(100, Math.round(bn.severity * 100));
                      const sevColor = bn.severity > 0.8 ? "#ef4444" : bn.severity > 0.5 ? "#f59e0b" : "#10b981";

                      return (
                        <div key={idx} className="flex items-center gap-4 p-4 rounded-xl" style={{ background: "rgba(5,10,20,0.6)", border: "1px solid rgba(30,58,95,0.5)" }}>
                          <span className={`badge ${bn.kind === "node" ? "badge-blue" : "badge-purple"}`} style={{ minWidth: 60 }}>
                            {bn.kind}
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-sm truncate" style={{ color: "var(--text-primary)" }}>{bn.id}</div>
                            <div className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>@ {bn.timestep}s</div>
                          </div>
                          <div className="flex items-center gap-3" style={{ minWidth: 140 }}>
                            <div className="severity-bar flex-1">
                              <div className="severity-fill" style={{ width: `${Math.min(100, sevPct)}%`, background: sevColor, boxShadow: `0 0 6px ${sevColor}` }} />
                            </div>
                            <span className="text-xs font-bold font-mono w-8 text-right" style={{ color: sevColor }}>{sevPct}%</span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}

            </div>

            {/* Route Overlay Card */}
            {simulationResult.reroutes.length > 0 && (
              <div className="glass-card overflow-hidden">
                <div className="px-5 py-4 flex items-center gap-3" style={{ borderBottom: "1px solid rgba(30,58,95,0.5)" }}>
                  <span className="text-lg">🗺️</span>
                  <h3 className="font-semibold" style={{ color: "var(--text-primary)" }}>Recommended Routes Overlay</h3>
                  <span className="badge badge-green ml-auto">{simulationResult.reroutes.length} active routes</span>
                </div>
                <div style={{ padding: "16px", height: "520px" }}>
                  <RouteOverlay layout={layout} reroutes={simulationResult.reroutes} animate={true} />
                </div>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex gap-3">
              <button onClick={() => setView("layout")} className="btn-ghost flex-1">✏️ Edit Layout</button>
              <button onClick={() => { setSimulationResult(null); setView("layout"); setSimProgress(0); }} className="btn-success flex-1">🔄 New Simulation</button>
            </div>
          </div>
        )}
      </main>

      {/* ── Saved Venues Modal ───────────────────────────────────── */}
      {showVenuesModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)" }}>
          <div className="glass-card max-w-lg w-full p-6 space-y-4 rounded-2xl" style={{ background: "rgba(12,21,36,0.95)", border: "1px solid rgba(30,58,95,0.8)" }}>
            <div className="flex items-center justify-between pb-3" style={{ borderBottom: "1px solid rgba(30,58,95,0.5)" }}>
              <h3 className="font-bold text-lg text-white">📂 Saved Venues</h3>
              <button onClick={() => setShowVenuesModal(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {savedVenuesList.length === 0 ? (
                <p className="text-xs text-slate-400 py-6 text-center">No saved venues found in server database. Save your current venue from the editor!</p>
              ) : (
                savedVenuesList.map((v) => (
                  <div key={v.id} className="p-3 rounded-xl flex items-center justify-between border transition-all hover:bg-blue-600/10 cursor-pointer" style={{ background: "rgba(5,10,20,0.6)", borderColor: "rgba(30,58,95,0.5)" }} onClick={() => { setLayout(v.layout); setShowVenuesModal(false); setView("layout"); }}>
                    <div>
                      <div className="font-bold text-sm text-blue-400">{v.name}</div>
                      <div className="text-xs text-slate-400">{v.layout?.nodes?.length ?? 0} nodes · {v.layout?.edges?.length ?? 0} corridors</div>
                    </div>
                    <span className="btn-primary text-xs py-1 px-3">Load Layout</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Auth Modal ───────────────────────────────────────────── */}
      {showAuthModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)" }}>
          <div className="glass-card max-w-md w-full p-6 space-y-4 rounded-2xl" style={{ background: "rgba(12,21,36,0.95)", border: "1px solid rgba(30,58,95,0.8)" }}>
            <div className="flex items-center justify-between pb-3" style={{ borderBottom: "1px solid rgba(30,58,95,0.5)" }}>
              <h3 className="font-bold text-lg text-white">{authMode === "login" ? "🔑 User Login" : "📝 Create Account"}</h3>
              <button onClick={() => setShowAuthModal(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            {authMsg && (
              <div className="p-3 rounded-lg text-xs" style={{ background: "rgba(59,130,246,0.1)", border: "1px solid rgba(59,130,246,0.3)", color: "#60a5fa" }}>
                {authMsg}
              </div>
            )}

            <form onSubmit={handleAuthSubmit} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase">Email Address</label>
                <input
                  type="email"
                  required
                  value={authEmailInput}
                  onChange={(e) => setAuthEmailInput(e.target.value)}
                  className="input-field mt-1"
                  placeholder="user@example.com"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase">Password</label>
                <input
                  type="password"
                  required
                  value={authPasswordInput}
                  onChange={(e) => setAuthPasswordInput(e.target.value)}
                  className="input-field mt-1"
                  placeholder="••••••••"
                />
              </div>

              <button type="submit" disabled={authLoading} className="btn-primary w-full py-2.5 font-bold text-sm mt-2">
                {authLoading ? "Processing..." : authMode === "login" ? "Sign In" : "Register Account"}
              </button>
            </form>

            <div className="text-center pt-2 text-xs text-slate-400">
              {authMode === "login" ? (
                <span>Don't have an account? <button onClick={() => { setAuthMode("register"); setAuthMsg(null); }} className="text-blue-400 underline font-semibold">Register here</button></span>
              ) : (
                <span>Already registered? <button onClick={() => { setAuthMode("login"); setAuthMsg(null); }} className="text-blue-400 underline font-semibold">Sign in here</button></span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Footer ─────────────────────────────────────────── */}
      <footer className="mt-16 py-6 text-center text-xs" style={{ borderTop: "1px solid rgba(30,58,95,0.4)", color: "var(--text-muted)" }}>
        <p>🏟️ CrowdFlow AI — Crowd Safety Intelligence Platform &nbsp;·&nbsp; Built with React + FastAPI + AI</p>
      </footer>
    </div>
  );
}
