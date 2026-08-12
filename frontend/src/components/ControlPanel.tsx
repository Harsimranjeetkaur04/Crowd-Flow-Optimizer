import { useState } from "react";
import type { EventSchedule, VenueLayout } from "../types";

interface ControlPanelProps {
  layout: VenueLayout;
  onRunSimulation: (crowdSize: number, schedule: EventSchedule[]) => void;
  isRunning?: boolean;
}

const PRESETS = [
  { label: "Small Event", crowd: 500,   rate: 30 },
  { label: "Medium",      crowd: 2000,  rate: 80 },
  { label: "Large Event", crowd: 10000, rate: 250 },
  { label: "Stadium Full",crowd: 40000, rate: 800 },
];

export function ControlPanel({
  layout,
  onRunSimulation,
  isRunning = false,
}: ControlPanelProps) {
  const [crowdSize, setCrowdSize] = useState(2000);
  const [schedule, setSchedule] = useState<EventSchedule[]>([
    { time: 0, arrival_rate: 80 },
  ]);

  const handleAddRow = () => {
    const last = schedule[schedule.length - 1];
    setSchedule([...schedule, { time: (last?.time ?? 0) + 5, arrival_rate: 40 }]);
  };

  const handleRemoveRow = (i: number) =>
    setSchedule(schedule.filter((_, idx) => idx !== i));

  const handleChange = (i: number, field: keyof EventSchedule, val: string) => {
    const updated = [...schedule];
    updated[i] = { ...updated[i], [field]: parseFloat(val) || 0 };
    setSchedule(updated);
  };

  const applyPreset = (p: typeof PRESETS[0]) => {
    setCrowdSize(p.crowd);
    setSchedule([{ time: 0, arrival_rate: p.rate }]);
  };

  const totalCapacity = layout.nodes.reduce((sum, n) => sum + n.capacity, 0);
  const loadFactor = totalCapacity > 0 ? (crowdSize / totalCapacity) * 100 : 0;

  return (
    <div
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
          background: "linear-gradient(135deg, rgba(37,99,235,0.08), rgba(8,145,178,0.05))",
        }}
      >
        <div
          className="w-8 h-8 rounded-xl flex items-center justify-center text-base"
          style={{
            background: "linear-gradient(135deg, #1d4ed8, #0891b2)",
            boxShadow: "0 0 12px rgba(59,130,246,0.3)",
          }}
        >
          ⚙️
        </div>
        <div>
          <h2
            className="font-bold text-sm"
            style={{ color: "var(--text-primary)" }}
          >
            Simulation Config
          </h2>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            Configure parameters
          </p>
        </div>
      </div>

      <div className="p-5 space-y-5">
        {/* Quick Presets */}
        <div>
          <label
            className="block text-xs font-semibold mb-2 uppercase tracking-widest"
            style={{ color: "var(--text-muted)" }}
          >
            Quick Presets
          </label>
          <div className="grid grid-cols-2 gap-2">
            {PRESETS.map((p) => (
              <button
                key={p.label}
                onClick={() => applyPreset(p)}
                disabled={isRunning}
                className="text-xs py-2 px-3 rounded-lg text-left font-medium transition-all duration-200"
                style={{
                  background: "rgba(5,10,20,0.6)",
                  border: `1px solid ${
                    crowdSize === p.crowd
                      ? "rgba(59,130,246,0.5)"
                      : "rgba(30,58,95,0.5)"
                  }`,
                  color:
                    crowdSize === p.crowd
                      ? "#60a5fa"
                      : "var(--text-secondary)",
                  boxShadow:
                    crowdSize === p.crowd
                      ? "0 0 12px rgba(59,130,246,0.15)"
                      : "none",
                }}
              >
                <div className="font-semibold">{p.label}</div>
                <div style={{ color: "var(--text-muted)", fontSize: "10px" }}>
                  {p.crowd.toLocaleString()} people
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Crowd Size */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label
              className="text-xs font-semibold uppercase tracking-widest"
              style={{ color: "var(--text-muted)" }}
            >
              Expected Crowd Size
            </label>
            <span
              className="text-sm font-bold font-mono"
              style={{ color: "#60a5fa" }}
            >
              {crowdSize.toLocaleString()}
            </span>
          </div>
          <input
            type="number"
            value={crowdSize}
            onChange={(e) =>
              setCrowdSize(Math.max(1, parseInt(e.target.value) || 1))
            }
            min="1"
            className="input-field"
            disabled={isRunning}
          />
          {/* Load Factor Bar */}
          <div className="mt-2">
            <div
              className="flex justify-between text-xs mb-1"
              style={{ color: "var(--text-muted)" }}
            >
              <span>Venue load factor</span>
              <span
                style={{
                  color:
                    loadFactor > 100
                      ? "#ef4444"
                      : loadFactor > 70
                      ? "#f59e0b"
                      : "#10b981",
                  fontWeight: 600,
                }}
              >
                {loadFactor.toFixed(0)}%
              </span>
            </div>
            <div
              className="w-full rounded-full overflow-hidden"
              style={{ height: "5px", background: "rgba(30,58,95,0.6)" }}
            >
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${Math.min(100, loadFactor)}%`,
                  background:
                    loadFactor > 100
                      ? "#ef4444"
                      : loadFactor > 70
                      ? "#f59e0b"
                      : "#10b981",
                }}
              />
            </div>
          </div>
        </div>

        {/* Event Schedule */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label
              className="text-xs font-semibold uppercase tracking-widest"
              style={{ color: "var(--text-muted)" }}
            >
              Arrival Schedule
            </label>
            <button
              onClick={handleAddRow}
              disabled={isRunning}
              className="text-xs px-3 py-1 rounded-lg font-semibold transition-all duration-200"
              style={{
                background: "rgba(59,130,246,0.1)",
                border: "1px solid rgba(59,130,246,0.3)",
                color: "#60a5fa",
              }}
            >
              + Add Phase
            </button>
          </div>

          <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
            {schedule.map((row, i) => (
              <div
                key={i}
                className="flex gap-2 items-center"
              >
                <div className="flex-1">
                  <input
                    type="number"
                    placeholder="Time (s)"
                    value={row.time}
                    onChange={(e) => handleChange(i, "time", e.target.value)}
                    className="input-field"
                    style={{ fontSize: "12px", padding: "7px 10px" }}
                    disabled={isRunning}
                  />
                </div>
                <div className="flex-1">
                  <input
                    type="number"
                    placeholder="Rate/s"
                    value={row.arrival_rate}
                    onChange={(e) =>
                      handleChange(i, "arrival_rate", e.target.value)
                    }
                    className="input-field"
                    style={{ fontSize: "12px", padding: "7px 10px" }}
                    disabled={isRunning}
                  />
                </div>
                <button
                  onClick={() => handleRemoveRow(i)}
                  disabled={schedule.length === 1 || isRunning}
                  className="text-xs w-7 h-7 flex-shrink-0 rounded-lg flex items-center justify-center transition-all"
                  style={{
                    background: "rgba(239,68,68,0.08)",
                    border: "1px solid rgba(239,68,68,0.2)",
                    color: "#f87171",
                    opacity: schedule.length === 1 || isRunning ? 0.3 : 1,
                    cursor:
                      schedule.length === 1 || isRunning
                        ? "not-allowed"
                        : "pointer",
                  }}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
          <div
            className="flex justify-between text-xs mt-2 px-1"
            style={{ color: "var(--text-muted)" }}
          >
            <span>⏱ Time (seconds)</span>
            <span>👥 Arrivals/second</span>
          </div>
        </div>

        {/* Section divider */}
        <div className="section-divider" />

        {/* Venue Stats */}
        <div
          className="grid grid-cols-2 gap-2 rounded-xl p-3"
          style={{ background: "rgba(5,10,20,0.5)" }}
        >
          <div className="text-center">
            <div className="text-xs" style={{ color: "var(--text-muted)" }}>
              Nodes
            </div>
            <div
              className="font-bold text-lg"
              style={{ color: "#60a5fa" }}
            >
              {layout.nodes.length}
            </div>
          </div>
          <div className="text-center">
            <div className="text-xs" style={{ color: "var(--text-muted)" }}>
              Corridors
            </div>
            <div
              className="font-bold text-lg"
              style={{ color: "#a78bfa" }}
            >
              {layout.edges.length}
            </div>
          </div>
          <div className="text-center">
            <div className="text-xs" style={{ color: "var(--text-muted)" }}>
              Max Capacity
            </div>
            <div
              className="font-bold text-lg"
              style={{ color: "#34d399" }}
            >
              {totalCapacity.toLocaleString()}
            </div>
          </div>
          <div className="text-center">
            <div className="text-xs" style={{ color: "var(--text-muted)" }}>
              Phases
            </div>
            <div
              className="font-bold text-lg"
              style={{ color: "#fbbf24" }}
            >
              {schedule.length}
            </div>
          </div>
        </div>

        {/* Run Button */}
        <button
          onClick={() => onRunSimulation(crowdSize, schedule)}
          disabled={isRunning || !layout.nodes.length}
          className="w-full py-3 rounded-xl font-bold text-base transition-all duration-300 relative overflow-hidden"
          style={{
            background: isRunning
              ? "rgba(30,58,95,0.4)"
              : "linear-gradient(135deg, #059669, #047857)",
            border: `1px solid ${isRunning ? "rgba(30,58,95,0.4)" : "#10b981"}`,
            color: isRunning ? "var(--text-muted)" : "#fff",
            cursor:
              isRunning || !layout.nodes.length ? "not-allowed" : "pointer",
            boxShadow: isRunning
              ? "none"
              : "0 0 24px rgba(16,185,129,0.3), 0 4px 16px rgba(0,0,0,0.3)",
          }}
        >
          {isRunning ? (
            <span className="flex items-center justify-center gap-3">
              <span className="dot-bounce">
                <span /><span /><span />
              </span>
              Simulating…
            </span>
          ) : (
            "▶ Run AI Simulation"
          )}
        </button>
      </div>
    </div>
  );
}
