// src/app/page.tsx
"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

interface TelemetryData {
  temperature: number;
  humidity: number;
  co2_ppm: number;
  recorded_at: string;
}

type OverrideMode = "AUTO" | "FORCE_ON" | "FORCE_OFF";

export default function Dashboard() {
  const [latestData, setLatestData] = useState<TelemetryData | null>(null);
  const [historyData, setHistoryData] = useState<TelemetryData[]>([]);
  const [controls, setControls] = useState<Record<string, OverrideMode>>({});
  const [loading, setLoading] = useState<boolean>(true);

  const [autopilotStrain, setAutopilotStrain] = useState<string>("None");
  const [autopilotStage, setAutopilotStage] = useState<string>("OFF");

  const [pendingOverride, setPendingOverride] = useState<{
    deviceId: string;
    mode: OverrideMode;
  } | null>(null);

  useEffect(() => {
    async function initDashboard() {
      try {
        const { data: history } = await supabase
          .from("climate_logs")
          .select("temperature, humidity, co2_ppm, recorded_at")
          .order("recorded_at", { ascending: false })
          .limit(24);

        if (history && history.length > 0) {
          setHistoryData([...history].reverse());
          setLatestData(history[0]);
        }
      } catch (err) {
        console.error("History build error:", err);
      }

      try {
        const { data: deviceStates } = await supabase
          .from("device_controls")
          .select("device_id, mode");
        if (deviceStates) {
          const mapped = deviceStates.reduce(
            (acc, curr) => {
              acc[curr.device_id] = curr.mode as OverrideMode;
              return acc;
            },
            {} as Record<string, OverrideMode>,
          );
          setControls(mapped);
        }
      } catch (err) {
        console.error(err);
      }

      try {
        const { data: autoState } = await supabase
          .from("autopilot_status")
          .select("*")
          .eq("id", 1)
          .single();
        if (autoState) {
          setAutopilotStrain(autoState.strain_name);
          setAutopilotStage(autoState.current_stage);
        }
      } catch (err) {
        console.error(err);
      }

      setLoading(false);
    }

    initDashboard();

    const dbTrackerChannel = supabase.channel("isolated_db_stream");

    dbTrackerChannel
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "climate_logs" },
        (payload) => {
          const freshRow = payload.new as TelemetryData;

          const typedRow: TelemetryData = {
            temperature: Number(freshRow.temperature),
            humidity: Number(freshRow.humidity),
            co2_ppm: Number(freshRow.co2_ppm),
            recorded_at: freshRow.recorded_at,
          };

          setHistoryData((prev) => {
            if (prev.some((row) => row.recorded_at === typedRow.recorded_at))
              return prev;
            if (prev.length >= 24) return [...prev.slice(1), typedRow];
            return [...prev, typedRow];
          });

          setLatestData(typedRow);
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "autopilot_status" },
        (payload) => {
          if (payload.new && "strain_name" in payload.new) {
            const freshRow = payload.new as {
              strain_name: string;
              current_stage: string;
            };
            setAutopilotStrain(freshRow.strain_name);
            setAutopilotStage(freshRow.current_stage);
          }
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "device_controls" },
        (payload) => {
          if (payload.new) {
            const row = payload.new as {
              device_id: string;
              mode: OverrideMode;
            };
            setControls((prev) => ({ ...prev, [row.device_id]: row.mode }));
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(dbTrackerChannel);
    };
  }, []);

  const handleModeChangeAttempt = (
    deviceId: string,
    targetMode: OverrideMode,
  ) => {
    const isManualOverride =
      targetMode === "FORCE_ON" || targetMode === "FORCE_OFF";
    const isAutopilotActive = autopilotStage !== "OFF";

    if (isAutopilotActive && isManualOverride) {
      setPendingOverride({ deviceId, mode: targetMode });
    } else {
      executeModeChange(deviceId, targetMode);
    }
  };

  const executeModeChange = async (
    deviceId: string,
    targetMode: OverrideMode,
  ) => {
    setControls((prev) => ({ ...prev, [deviceId]: targetMode }));
    setPendingOverride(null);
    await supabase
      .from("device_controls")
      .upsert({ device_id: deviceId, mode: targetMode });
  };

  const sendSimulationTick = async () => {
    const baseTime = Date.now();
    const freshPayload = {
      device_id: "hardware_simulation_node",
      temperature: +(
        20 +
        Math.sin(baseTime * 0.005) * 1.5 +
        Math.random() * 0.3
      ).toFixed(2),
      humidity: +(
        89 +
        Math.cos(baseTime * 0.003) * 3 +
        Math.random() * 1
      ).toFixed(2),
      co2_ppm: Math.floor(
        680 + Math.sin(baseTime * 0.004) * 200 + Math.random() * 50,
      ),
      recorded_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from("climate_logs")
      .insert([freshPayload]);
    if (error) console.error("Database rejection:", error.message);
  };

  if (loading)
    return (
      <div className="text-sm p-6 text-zinc-500 font-mono">
        Syncing visual matrix layout...
      </div>
    );

  return (
    <div className="space-y-8 relative">
      {/* OVERRIDE WARNING CONFIRMATION DIALOG MODAL */}
      {pendingOverride && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <Card className="bg-zinc-900 border-zinc-800 max-w-sm w-full p-6 space-y-4 shadow-2xl">
            <div>
              <h3 className="text-base font-bold text-zinc-100 flex items-center gap-2">
                ⚠️ Autopilot Loop Intercept
              </h3>
              <p className="text-xs text-zinc-400 mt-2 leading-relaxed">
                You are forcing the{" "}
                <span className="text-zinc-200 font-semibold uppercase">
                  {pendingOverride.deviceId.replace("_", " ")}
                </span>{" "}
                to{" "}
                <span className="text-amber-400 font-bold font-mono">
                  {pendingOverride.mode}
                </span>{" "}
                while{" "}
                <span className="text-emerald-400 font-bold">
                  {autopilotStrain}
                </span>{" "}
                automation is active.
              </p>
            </div>
            <div className="flex items-center justify-end space-x-2 pt-1">
              <button
                onClick={() => setPendingOverride(null)}
                className="px-3 py-1.5 text-xs text-zinc-400 bg-zinc-800 rounded-md"
              >
                Cancel
              </button>
              <button
                onClick={() =>
                  executeModeChange(
                    pendingOverride.deviceId,
                    pendingOverride.mode,
                  )
                }
                className="px-3 py-1.5 text-xs font-bold text-white bg-amber-600 rounded-md"
              >
                Force Override
              </button>
            </div>
          </Card>
        </div>
      )}

      {/* GLOBAL AUTOPILOT NOTIFICATION BANNER */}
      {autopilotStage !== "OFF" && (
        <div className="w-full p-4 border border-emerald-500/30 bg-emerald-950/20 rounded-xl flex items-center justify-between text-sm animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="flex items-center space-x-3">
            <span className="text-lg">🚀</span>
            <div>
              <span className="font-semibold text-emerald-400">
                Autopilot Engaged:
              </span>{" "}
              Now cultivating{" "}
              <span className="font-bold text-white underline decoration-emerald-500/50">
                {autopilotStrain}
              </span>
            </div>
          </div>
          <div className="flex items-center space-x-2 font-mono text-xs bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-md text-emerald-400 font-bold">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            CURRENT STAGE: {autopilotStage}
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Command Center</h1>
          <p className="text-sm text-zinc-400">
            Continuous Live Time-Series Engine
          </p>
        </div>

        <button
          onClick={sendSimulationTick}
          className="px-4 py-2 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-100 text-xs font-bold rounded-lg font-mono shadow transition-all active:scale-[0.98]"
        >
          🚀 Log Live Sensor Row
        </button>
      </div>

      {/* Metric Cards Grid */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="bg-zinc-900 border-zinc-800 shadow-xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
              Temperature
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold font-mono text-zinc-100">
              {latestData ? `${latestData.temperature}°C` : "0.00°C"}
            </div>
          </CardContent>
        </Card>
        <Card className="bg-zinc-900 border-zinc-800 shadow-xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
              Relative Humidity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold font-mono text-zinc-100">
              {latestData ? `${latestData.humidity}%` : "0.00%"}
            </div>
          </CardContent>
        </Card>
        <Card className="bg-zinc-900 border-zinc-800 shadow-xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
              Carbon Dioxide
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold font-mono text-zinc-100">
              {latestData ? `${latestData.co2_ppm} PPM` : "0 PPM"}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Layout Section */}
      <div className="grid gap-6 md:grid-cols-3">
        {/* FIXED CONTAINER: Appended "min-w-0" to force layout recalculations on data insertion loops */}
        <div className="md:col-span-2 space-y-6 min-w-0">
          <Card className="bg-zinc-900 border-zinc-800 p-4 shadow-xl">
            <div className="h-[180px] w-full text-xs font-mono">
              {/* FIXED: Shifted from height="100%" to a stable numeric height anchor */}
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={historyData} margin={{ left: -20, right: 10 }}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="#27272a"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="recorded_at"
                    tickFormatter={(t) =>
                      t
                        ? new Date(t).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : ""
                    }
                    stroke="#71717a"
                    tickLine={false}
                  />
                  <YAxis stroke="#71717a" domain={[10, 100]} tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#18181b",
                      borderColor: "#27272a",
                      borderRadius: "8px",
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="temperature"
                    stroke="#f59e0b"
                    strokeWidth={2.5}
                    dot={false}
                    isAnimationActive={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="humidity"
                    stroke="#3b82f6"
                    strokeWidth={2.5}
                    dot={false}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card className="bg-zinc-900 border-zinc-800 p-4 shadow-xl">
            <div className="h-[150px] w-full text-xs font-mono">
              {/* FIXED: Shifted from height="100%" to a stable numeric height anchor */}
              <ResponsiveContainer width="100%" height={150}>
                <LineChart data={historyData} margin={{ left: -10, right: 10 }}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="#27272a"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="recorded_at"
                    tickFormatter={(t) =>
                      t
                        ? new Date(t).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : ""
                    }
                    stroke="#71717a"
                    tickLine={false}
                  />
                  <YAxis stroke="#71717a" tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#18181b",
                      borderColor: "#27272a",
                      borderRadius: "8px",
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="co2_ppm"
                    stroke="#10b981"
                    strokeWidth={2.5}
                    dot={false}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>

        {/* Switchboard Panel */}
        <Card className="bg-zinc-900 border-zinc-800 shadow-xl h-fit">
          <CardHeader>
            <CardTitle className="text-lg font-semibold tracking-tight">
              Virtual Switchboard
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {[
              { id: "humidifier", label: "Humidifier Unit", icon: "💧" },
              { id: "exhaust_fan", label: "Exhaust System", icon: "🌪️" },
              { id: "intake_fan", label: "Fresh Air Intake", icon: "💨" },
              { id: "heater", label: "Thermal Element", icon: "🔥" },
            ].map((device) => {
              const currentMode = controls[device.id] || "AUTO";
              return (
                <div
                  key={device.id}
                  className="flex flex-col space-y-3 p-4 rounded-xl border border-zinc-800 bg-black/20"
                >
                  <div className="flex items-center space-x-3">
                    <span className="text-base">{device.icon}</span>
                    <Label className="text-sm font-medium">
                      {device.label}
                    </Label>
                  </div>
                  <div className="grid grid-cols-3 gap-1 bg-zinc-950 p-1 rounded-lg text-center text-xs font-mono">
                    <button
                      onClick={() => handleModeChangeAttempt(device.id, "AUTO")}
                      className={`py-1.5 rounded transition-all ${currentMode === "AUTO" ? "bg-zinc-800 text-emerald-400 font-bold border border-zinc-700/50" : "text-zinc-500"}`}
                    >
                      AUTO
                    </button>
                    <button
                      onClick={() =>
                        handleModeChangeAttempt(device.id, "FORCE_ON")
                      }
                      className={`py-1.5 rounded transition-all ${currentMode === "FORCE_ON" ? "bg-blue-600/20 text-blue-400 font-bold border border-blue-500/20" : "text-zinc-500"}`}
                    >
                      ON
                    </button>
                    <button
                      onClick={() =>
                        handleModeChangeAttempt(device.id, "FORCE_OFF")
                      }
                      className={`py-1.5 rounded transition-all ${currentMode === "FORCE_OFF" ? "bg-rose-600/20 text-rose-400 font-bold border border-rose-500/20" : "text-zinc-500"}`}
                    >
                      OFF
                    </button>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
