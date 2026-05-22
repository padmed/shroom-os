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

export default function Dashboard() {
  const [latestData, setLatestData] = useState<TelemetryData | null>(null);
  const [historyData, setHistoryData] = useState<TelemetryData[]>([]);
  const [controls, setControls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [simCount, setSimCount] = useState<number>(0);

  // FIXED: Re-introduced the missing state hooks for the dashboard banner
  const [autopilotStrain, setAutopilotStrain] = useState<string>("None");
  const [autopilotStage, setAutopilotStage] = useState<string>("OFF");

  useEffect(() => {
    async function initDashboard() {
      try {
        // 1. Load initial 24h history for charts
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
        console.error("Historical baseline array load failure:", err);
      }

      try {
        // 2. Sync manual override controls states
        const { data: deviceStates } = await supabase
          .from("device_controls")
          .select("device_id, mode");
        if (deviceStates) {
          const mapped = deviceStates.reduce(
            (acc, curr) => {
              acc[curr.device_id] = curr.mode;
              return acc;
            },
            {} as Record<string, string>,
          );
          setControls(mapped);
        }
      } catch (err) {
        console.error("Switchboard sync error:", err);
      }

      try {
        // 3. Fetch active autopilot profile run status on startup
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
        console.error("Autopilot initial state fetch error:", err);
      }

      setLoading(false);
    }

    initDashboard();

    // Open WebSockets pipe configuration
    const channel = supabase.channel("tent_alpha_climate", {
      config: { broadcast: { self: true } },
    });

    channel
      .on("broadcast", { event: "telemetry-tick" }, (payload) => {
        setLatestData(payload.payload as TelemetryData);
      })
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "climate_logs" },
        (payload) => {
          const freshRow = payload.new as TelemetryData;
          setHistoryData((prev) => [...prev.slice(1), freshRow]);
        },
      )
      // Wildcard listener: catches both updates and initialization inserts perfectly
      // Replace JUST the autopilot_status block inside your src/app/page.tsx useEffect:
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "autopilot_status" },
        (payload) => {
          if (payload.new && "strain_name" in payload.new) {
            // Explicitly cast the payload to let TypeScript know these properties exist
            const freshRow = payload.new as {
              strain_name: string;
              current_stage: string;
            };
            setAutopilotStrain(freshRow.strain_name);
            setAutopilotStage(freshRow.current_stage);
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const sendHybridSimulationTick = async () => {
    const baseTime = Date.now();
    const freshPayload: TelemetryData = {
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

    await supabase.channel("tent_alpha_climate").send({
      type: "broadcast",
      event: "telemetry-tick",
      payload: freshPayload,
    });

    setSimCount((prevCount) => {
      const nextCount = prevCount + 1;
      if (nextCount % 5 === 0) {
        supabase
          .from("climate_logs")
          .insert([
            {
              device_id: "hybrid_simulation_node",
              temperature: freshPayload.temperature,
              humidity: freshPayload.humidity,
              co2_ppm: freshPayload.co2_ppm,
              recorded_at: freshPayload.recorded_at,
            },
          ])
          .then(() => console.log("DB Snapshot Row Saved."));
      }
      return nextCount;
    });
  };

  const handleModeChange = async (
    deviceId: string,
    targetMode: "AUTO" | "FORCE_ON" | "FORCE_OFF",
  ) => {
    setControls((prev) => ({ ...prev, [deviceId]: targetMode }));
    await supabase
      .from("device_controls")
      .update({ mode: targetMode })
      .eq("device_id", deviceId);
  };

  if (loading)
    return (
      <div className="text-sm p-6 text-zinc-500 font-mono">
        Syncing visual matrix layout...
      </div>
    );

  return (
    <div className="space-y-8">
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
              <span className="font-bold text-white underline decoration-emerald-500/50 decoration-2">
                {autopilotStrain}
              </span>
            </div>
          </div>
          <div className="flex items-center space-x-2 font-mono text-xs bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-md text-emerald-400 font-bold tracking-wide">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            CURRENT STAGE: {autopilotStage}
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Command Center</h1>
          <p className="text-sm text-zinc-400">
            Hybrid Real-Time Broadcast & Time-Series Engine
          </p>
        </div>

        <div className="flex items-center space-x-3 bg-zinc-900 border border-zinc-800 p-1.5 rounded-lg">
          <span className="text-[10px] font-mono text-zinc-400 px-2">
            Clicks until DB snapshot:{" "}
            <span className="text-emerald-400 font-bold">
              {5 - (simCount % 5)}
            </span>
          </span>
          <button
            onClick={sendHybridSimulationTick}
            className="px-3 py-1.5 bg-zinc-800 border border-zinc-700 hover:bg-zinc-700 text-zinc-100 text-xs font-semibold rounded font-mono shadow transition-all"
          >
            ⚡ Broadcast Tick
          </button>
        </div>
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

      {/* Charts + Switchboard Grid Area */}
      <div className="grid gap-6 md:grid-cols-3">
        <div className="md:col-span-2 space-y-6">
          <Card className="bg-zinc-900 border-zinc-800 p-4 shadow-xl">
            <div className="h-[180px] w-full text-xs font-mono">
              <ResponsiveContainer width="100%" height="100%">
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
              <ResponsiveContainer width="100%" height="100%">
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

        {/* Switchboard panel */}
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
                      onClick={() => handleModeChange(device.id, "AUTO")}
                      className={`py-1.5 rounded transition-all ${currentMode === "AUTO" ? "bg-zinc-800 text-emerald-400 font-bold" : "text-zinc-500"}`}
                    >
                      AUTO
                    </button>
                    <button
                      onClick={() => handleModeChange(device.id, "FORCE_ON")}
                      className={`py-1.5 rounded transition-all ${currentMode === "FORCE_ON" ? "bg-blue-600/20 text-blue-400 font-bold" : "text-zinc-500"}`}
                    >
                      ON
                    </button>
                    <button
                      onClick={() => handleModeChange(device.id, "FORCE_OFF")}
                      className={`py-1.5 rounded transition-all ${currentMode === "FORCE_OFF" ? "bg-rose-600/20 text-rose-400 font-bold" : "text-zinc-500"}`}
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
// export default function Dashboard() {
//   const [status, setStatus] = useState<string>("Connecting to data layer...");
//   const [isError, setIsError] = useState<boolean>(false);
//   const [loading, setLoading] = useState<boolean>(false);

//   useEffect(() => {
//     async function testConnection() {
//       try {
//         const { error } = await supabase
//           .from("climate_logs")
//           .select("id")
//           .limit(1);
//         if (
//           error &&
//           error.code !== "PGRST116" &&
//           !error.message.includes("policy")
//         ) {
//           setIsError(true);
//           setStatus(`Database Error: ${error.message}`);
//         } else {
//           setStatus("Connected! Handshake successful.");
//         }
//       } catch (err: any) {
//         setIsError(true);
//         setStatus(`Network Exception: ${err.message}`);
//       }
//     }
//     testConnection();
//   }, []);

//   // Magic function to simulate an ESP32 sending data over time
//   const seedMockData = async () => {
//     setLoading(true);
//     const logs = [];
//     const now = new Date();

//     // Generate 50 points, spaced 30 minutes apart going backward in time
//     for (let i = 0; i < 50; i++) {
//       const logTime = new Date(now.getTime() - i * 30 * 60 * 1000);

//       // Generate realistic fluctuating mushroom room values
//       const randomTemp = +(
//         20 +
//         Math.sin(i * 0.5) * 2 +
//         Math.random() * 0.5
//       ).toFixed(2); // 18°C - 22°C
//       const randomHumidity = +(
//         88 +
//         Math.cos(i * 0.3) * 5 +
//         Math.random() * 2
//       ).toFixed(2); // 83% - 95%
//       const randomCO2 = Math.floor(
//         600 + Math.sin(i * 0.2) * 300 + Math.random() * 100,
//       ); // 300ppm - 1000ppm

//       logs.push({
//         device_id: "tent_alpha_prototype",
//         recorded_at: logTime.toISOString(),
//         temperature: randomTemp,
//         humidity: randomHumidity,
//         co2_ppm: randomCO2,
//       });
//     }

//     const { error } = await supabase.from("climate_logs").insert(logs);

//     setLoading(false);
//     if (error) {
//       alert(`Failed to seed data: ${error.message}`);
//     } else {
//       alert("Successfully inserted 50 mock timeline entries into database!");
//     }
//   };

//   return (
//     <main className="flex min-h-screen flex-col items-center justify-center p-24 bg-zinc-950 text-white">
//       <div className="p-8 border border-zinc-800 rounded-xl bg-zinc-900 shadow-2xl max-w-md text-center space-y-6">
//         <div>
//           <h1 className="text-2xl font-bold tracking-tight mb-2">
//             🍄 ShroomOS Hub
//           </h1>
//           <p
//             className={`font-mono text-xs p-2 rounded bg-black/40 ${isError ? "text-rose-400" : "text-emerald-400"}`}
//           >
//             {status}
//           </p>
//         </div>

//         <div className="border-t border-zinc-800 pt-6 space-y-3">
//           <p className="text-xs text-zinc-400 text-left">
//             Before we build visual charts, we need data. Click below to simulate
//             24 hours of telemetry from a fake ESP32 device.
//           </p>
//           <button
//             onClick={seedMockData}
//             disabled={loading}
//             className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-white font-medium rounded-lg text-sm transition-all shadow-lg active:scale-[0.98]"
//           >
//             {loading
//               ? "Injecting telemetry streams..."
//               : "⚡ Seed 24h Telemetry Data"}
//           </button>
//         </div>
//       </div>
//     </main>
//   );
// }
