// src/app/autopilot/page.tsx
"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface Blueprint {
  id: string;
  strain_name: string;
  is_custom: boolean;
  incubation_days: number;
  incubation_temp: number;
  incubation_humidity: number;
  incubation_co2: number;
  pinning_days: number;
  pinning_temp: number;
  pinning_humidity: number;
  pinning_co2: number;
  fruiting_days: number;
  fruiting_temp: number;
  fruiting_humidity: number;
  fruiting_co2: number;
}

export default function AutopilotPage() {
  const [blueprints, setBlueprints] = useState<Blueprint[]>([]);
  const [activeStrain, setActiveStrain] = useState<string>("None");
  const [currentStage, setCurrentStage] = useState<string>("OFF");
  const [loading, setLoading] = useState<boolean>(true);

  // Modal Display Triggers
  const [pendingStage, setPendingStage] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);

  // Form Field State Core Matrix
  const [newStrainName, setNewStrainName] = useState("");

  // Phase 1 Handles (Incubation defaults)
  const [incDays, setIncDays] = useState(14);
  const [incTemp, setIncTemp] = useState(24.0);
  const [incHumidity, setIncHumidity] = useState(90.0);
  const [incCo2, setIncCo2] = useState(2000);

  // Phase 2 Handles (Pinning defaults)
  const [pinDays, setPinDays] = useState(4);
  const [pinTemp, setPinTemp] = useState(18.0);
  const [pinHumidity, setPinHumidity] = useState(95.0);
  const [pinCo2, setPinCo2] = useState(800);

  // Phase 3 Handles (Fruiting defaults)
  const [frtDays, setFrtDays] = useState(7);
  const [frtTemp, setFrtTemp] = useState(21.0);
  const [frtHumidity, setFrtHumidity] = useState(85.0);
  const [frtCo2, setFrtCo2] = useState(900);

  const loadBlueprintsAndState = async () => {
    const { data: stateData } = await supabase
      .from("autopilot_status")
      .select("*")
      .eq("id", 1)
      .single();
    if (stateData) {
      setActiveStrain(stateData.strain_name);
      setCurrentStage(stateData.current_stage);
    }

    const { data: blueprintData } = await supabase
      .from("growth_blueprints")
      .select("*")
      .order("is_custom", { ascending: true });
    if (blueprintData) setBlueprints(blueprintData as Blueprint[]);

    setLoading(false);
  };

  useEffect(() => {
    loadBlueprintsAndState();
  }, []);

  const createCustomRecipe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStrainName.trim())
      return alert("Please specify a unique strain name.");

    const { error } = await supabase.from("growth_blueprints").insert([
      {
        strain_name: newStrainName,
        is_custom: true,
        incubation_days: incDays,
        incubation_temp: incTemp,
        incubation_humidity: incHumidity,
        incubation_co2: incCo2,
        pinning_days: pinDays,
        pinning_temp: pinTemp,
        pinning_humidity: pinHumidity,
        pinning_co2: pinCo2,
        fruiting_days: frtDays,
        fruiting_temp: frtTemp,
        fruiting_humidity: frtHumidity,
        fruiting_co2: frtCo2,
      },
    ]);

    if (error) {
      alert(`Failed to save profile configuration: ${error.message}`);
    } else {
      setNewStrainName("");
      setIsCreateModalOpen(false);
      loadBlueprintsAndState();
    }
  };

  const deleteRecipe = async (id: string, name: string) => {
    if (activeStrain === name)
      return alert(
        "Cannot delete a profile that is currently active inside the chamber layout!",
      );
    if (
      !confirm(
        `Are you sure you want to permanently delete the profile for ${name}?`,
      )
    )
      return;

    const { error } = await supabase
      .from("growth_blueprints")
      .delete()
      .eq("id", id);
    if (error) alert(error.message);
    else loadBlueprintsAndState();
  };

  const engageAutopilot = async (strainName: string) => {
    setActiveStrain(strainName);
    setCurrentStage("INCUBATION");
    await supabase.from("autopilot_status").upsert({
      id: 1,
      strain_name: strainName,
      current_stage: "INCUBATION",
      started_at: new Date().toISOString(),
    });
  };

  const disengageAutopilot = async () => {
    setActiveStrain("None");
    setCurrentStage("OFF");
    await supabase.from("autopilot_status").upsert({
      id: 1,
      strain_name: "None",
      current_stage: "OFF",
      started_at: null,
    });
  };

  const confirmStageJump = async () => {
    if (!pendingStage) return;
    setCurrentStage(pendingStage);
    await supabase.from("autopilot_status").upsert({
      id: 1,
      strain_name: activeStrain,
      current_stage: pendingStage,
      started_at: new Date().toISOString(),
    });
    setPendingStage(null);
  };

  const selectedBlueprint = blueprints.find(
    (b) => b.strain_name === activeStrain,
  );

  if (loading)
    return (
      <div className="text-sm p-6 text-zinc-500 font-mono">
        Assembling matrix configurations...
      </div>
    );

  return (
    <div className="space-y-8 relative">
      {/* MODAL 1: PHASE JUMP OVERRIDE CONFIRMATION */}
      {pendingStage && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <Card className="bg-zinc-900 border-zinc-800 max-w-sm w-full p-6 space-y-4 shadow-2xl">
            <div>
              <h3 className="text-base font-bold text-zinc-100">
                ⚠️ Confirm Phase Shift Override
              </h3>
              <p className="text-xs text-zinc-400 mt-2">
                Force change engine to{" "}
                <span className="text-amber-400 font-mono font-bold">
                  {pendingStage}
                </span>
                ?
              </p>
            </div>
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => setPendingStage(null)}
                className="px-3 py-1.5 text-xs text-zinc-400 bg-zinc-800 rounded-md"
              >
                Cancel
              </button>
              <button
                onClick={confirmStageJump}
                className="px-3 py-1.5 text-xs font-bold bg-amber-600 rounded-md text-white"
              >
                Yes, Force Advance
              </button>
            </div>
          </Card>
        </div>
      )}

      {/* MODAL 2: RESPONSIVE 3-COLUMN FULL-SPECTRUM RECIPE CREATOR */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <Card className="bg-zinc-900 border-zinc-800 max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl animate-in zoom-in-95 duration-150">
            {/* Header Area (Stays static at the top) */}
            <div className="flex items-center justify-between border-b border-zinc-800 p-6 shrink-0">
              <div>
                <CardTitle className="text-xl font-bold text-zinc-100">
                  Create Custom Growth Blueprint
                </CardTitle>
                <CardDescription className="text-xs text-zinc-500 mt-0.5">
                  Configure target thresholds for all three execution profiles
                </CardDescription>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="text-zinc-500 hover:text-zinc-200 text-lg p-1 font-mono"
              >
                ✕
              </button>
            </div>

            {/* Scrollable Form Workspace (Prevents mobile viewport clipping) */}
            <form
              onSubmit={createCustomRecipe}
              className="flex-1 overflow-y-auto p-6 space-y-6 text-xs custom-scrollbar"
            >
              <div className="space-y-1.5 max-w-md">
                <Label className="text-zinc-400 text-xs">
                  Strain / Cultivation Name
                </Label>
                <input
                  required
                  type="text"
                  value={newStrainName}
                  onChange={(e) => setNewStrainName(e.target.value)}
                  placeholder="e.g., Golden Wine Cap"
                  className="w-full bg-zinc-950 border border-zinc-800 p-2.5 rounded-lg text-sm text-zinc-100 outline-none focus:border-zinc-700"
                />
              </div>

              {/* 3-Column Phase Parameter Breakdown Grid */}
              <div className="grid gap-4 md:grid-cols-3">
                {/* COLUMN A: INCUBATION BLOCKS */}
                <div className="bg-black/20 p-4 rounded-xl border border-zinc-800/60 space-y-3.5">
                  <div className="font-bold text-zinc-300 flex items-center space-x-2 text-[13px] border-b border-zinc-800 pb-2">
                    <span>🧫</span> <span>Phase 1: Incubation</span>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-zinc-500">Duration (Days)</Label>
                    <input
                      type="number"
                      min="1"
                      value={incDays}
                      onChange={(e) => setIncDays(+e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-800 p-2 rounded font-mono text-zinc-200"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-zinc-500">Temperature (°C)</Label>
                    <input
                      type="number"
                      step="0.1"
                      value={incTemp}
                      onChange={(e) => setIncTemp(+e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-800 p-2 rounded font-mono text-zinc-200"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-zinc-500">
                      Relative Humidity (%)
                    </Label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={incHumidity}
                      onChange={(e) => setIncHumidity(+e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-800 p-2 rounded font-mono text-zinc-200"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-zinc-500">
                      Target CO₂ Limit (PPM)
                    </Label>
                    <input
                      type="number"
                      min="0"
                      value={incCo2}
                      onChange={(e) => setIncCo2(+e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-800 p-2 rounded font-mono text-zinc-200"
                    />
                  </div>
                </div>

                {/* COLUMN B: PINNING BLOCKS */}
                <div className="bg-black/20 p-4 rounded-xl border border-zinc-800/60 space-y-3.5">
                  <div className="font-bold text-zinc-300 flex items-center space-x-2 text-[13px] border-b border-zinc-800 pb-2">
                    <span>🌱</span> <span>Phase 2: Pinning</span>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-zinc-500">Duration (Days)</Label>
                    <input
                      type="number"
                      min="1"
                      value={pinDays}
                      onChange={(e) => setPinDays(+e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-800 p-2 rounded font-mono text-zinc-200"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-zinc-500">Temperature (°C)</Label>
                    <input
                      type="number"
                      step="0.1"
                      value={pinTemp}
                      onChange={(e) => setPinTemp(+e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-800 p-2 rounded font-mono text-zinc-200"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-zinc-500">
                      Relative Humidity (%)
                    </Label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={pinHumidity}
                      onChange={(e) => setPinHumidity(+e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-800 p-2 rounded font-mono text-zinc-200"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-zinc-500">
                      Target CO₂ Limit (PPM)
                    </Label>
                    <input
                      type="number"
                      min="0"
                      value={pinCo2}
                      onChange={(e) => setPinCo2(+e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-800 p-2 rounded font-mono text-zinc-200"
                    />
                  </div>
                </div>

                {/* COLUMN C: FRUITING BLOCKS */}
                <div className="bg-black/20 p-4 rounded-xl border border-zinc-800/60 space-y-3.5">
                  <div className="font-bold text-zinc-300 flex items-center space-x-2 text-[13px] border-b border-zinc-800 pb-2">
                    <span>🍄</span> <span>Phase 3: Fruiting</span>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-zinc-500">Duration (Days)</Label>
                    <input
                      type="number"
                      min="1"
                      value={frtDays}
                      onChange={(e) => setFrtDays(+e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-800 p-2 rounded font-mono text-zinc-200"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-zinc-500">Temperature (°C)</Label>
                    <input
                      type="number"
                      step="0.1"
                      value={frtTemp}
                      onChange={(e) => setFrtTemp(+e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-800 p-2 rounded font-mono text-zinc-200"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-zinc-500">
                      Relative Humidity (%)
                    </Label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={frtHumidity}
                      onChange={(e) => setFrtHumidity(+e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-800 p-2 rounded font-mono text-zinc-200"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-zinc-500">
                      Target CO₂ Limit (PPM)
                    </Label>
                    <input
                      type="number"
                      min="0"
                      value={frtCo2}
                      onChange={(e) => setFrtCo2(+e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-800 p-2 rounded font-mono text-zinc-200"
                    />
                  </div>
                </div>
              </div>

              {/* Sticky Controls Footer Panel */}
              <div className="flex items-center justify-end space-x-3 pt-4 border-t border-zinc-800 sticky bottom-0 bg-zinc-900 mt-4 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 text-zinc-400 bg-zinc-800 hover:bg-zinc-750 font-medium rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg transition-colors shadow shadow-emerald-600/10"
                >
                  💾 Save Climate Recipe
                </button>
              </div>
            </form>
          </Card>
        </div>
      )}

      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          🚀 Autopilot Co-Pilot
        </h1>
        <p className="text-sm text-zinc-400">
          Dynamic lifecycle state machine for autonomous crop management
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* SIDEBAR COMPONENT BLOCK: RECIPES SELECTOR & ENTRY LAUNCHER BUTTON */}
        <div className="lg:col-span-1 space-y-4">
          <Card className="bg-zinc-900 border-zinc-800 shadow-xl flex flex-col justify-between h-full min-h-[350px]">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-semibold text-zinc-200">
                Strain Profiles
              </CardTitle>
              <CardDescription className="text-xs text-zinc-500">
                Deploy an autonomous climate matrix
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 flex-1 overflow-y-auto max-h-[400px]">
              {blueprints.map((bp) => (
                <div
                  key={bp.id}
                  className="group flex items-center justify-between gap-2 p-3 rounded-lg border bg-black/20 border-zinc-800/80 hover:bg-black/40 transition-all"
                >
                  <button
                    disabled={currentStage !== "OFF"}
                    onClick={() => engageAutopilot(bp.strain_name)}
                    className={`flex-1 text-left text-sm font-medium ${activeStrain === bp.strain_name ? "text-emerald-400 font-bold" : "text-zinc-400"}`}
                  >
                    <div>
                      {bp.strain_name}{" "}
                      {bp.is_custom && (
                        <span className="text-[9px] font-normal bg-zinc-800 text-zinc-400 px-1 rounded ml-1">
                          Custom
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-zinc-500 font-mono mt-0.5">
                      Total Cycle:{" "}
                      {bp.incubation_days + bp.pinning_days + bp.fruiting_days}{" "}
                      Days
                    </div>
                  </button>

                  {bp.is_custom && (
                    <button
                      onClick={() => deleteRecipe(bp.id, bp.strain_name)}
                      className="text-xs p-1 text-zinc-600 hover:text-rose-400 transition-colors"
                      title="Delete profile"
                    >
                      🗑️
                    </button>
                  )}
                </div>
              ))}
            </CardContent>

            {/* Launcher Trigger Actions Footer Panel Section */}
            <div className="p-6 border-t border-zinc-800/60 bg-black/10 space-y-3">
              <button
                onClick={() => setIsCreateModalOpen(true)}
                className="w-full py-2 bg-zinc-950 border border-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-900 text-xs font-bold rounded-lg font-mono tracking-tight shadow transition-all flex items-center justify-center space-x-1"
              >
                <span>➕</span> <span>Add Custom Strain</span>
              </button>

              {currentStage !== "OFF" && (
                <button
                  onClick={disengageAutopilot}
                  className="w-full py-2 bg-rose-950/40 border border-rose-800 text-rose-400 text-xs font-semibold font-mono rounded-lg transition-all shadow"
                >
                  🛑 Emergency Stop Autopilot
                </button>
              )}
            </div>
          </Card>
        </div>

        {/* TIMELINE REGION: DISPLAYS COMPLETE 4-VARIABLE PARAMETER BLUEPRINTS */}
        <Card className="lg:col-span-2 bg-zinc-900 border-zinc-800 shadow-xl p-6 h-fit">
          <div className="pb-6">
            <h3 className="text-lg font-semibold text-zinc-200">
              Active Pipeline Tracking
            </h3>
            <p className="text-xs text-zinc-500">
              Current automation parameters for {activeStrain}
            </p>
          </div>

          <div className="relative border-l border-zinc-800 ml-4 space-y-6 py-2">
            {[
              {
                stage: "INCUBATION",
                title: "Phase 1: Incubation / Colonization",
                icon: "🧫",
                desc: "High CO₂ setup favoring active mycelial growth runs.",
              },
              {
                stage: "PINNING",
                title: "Phase 2: Primordia / Pin Induction",
                icon: "🌱",
                desc: "Thermal shift and humidity spike shocks pin structures awake.",
              },
              {
                stage: "FRUITING",
                title: "Phase 3: Mature Fruiting Body",
                icon: "🍄",
                desc: "High oxygen exchange and steady ambient moisture levels.",
              },
            ].map((phase, index) => {
              const isCurrent = currentStage === phase.stage;
              const isPast =
                currentStage !== "OFF" &&
                !isCurrent &&
                (phase.stage === "INCUBATION" ||
                  (phase.stage === "PINNING" && currentStage === "FRUITING"));

              // Resolve all 4 target tracking matrix boundaries dynamically from database parameters
              const targetDays = selectedBlueprint
                ? selectedBlueprint[
                    `${phase.stage.toLowerCase()}_days` as keyof Blueprint
                  ]
                : 0;
              const targetTemp = selectedBlueprint
                ? selectedBlueprint[
                    `${phase.stage.toLowerCase()}_temp` as keyof Blueprint
                  ]
                : 0;
              const targetHum = selectedBlueprint
                ? selectedBlueprint[
                    `${phase.stage.toLowerCase()}_humidity` as keyof Blueprint
                  ]
                : 0;
              const targetCo2 = selectedBlueprint
                ? selectedBlueprint[
                    `${phase.stage.toLowerCase()}_co2` as keyof Blueprint
                  ]
                : 0;

              return (
                <div key={phase.stage} className="relative pl-8">
                  <div
                    className={`absolute -left-[13px] top-1.5 w-6 h-6 rounded-full border flex items-center justify-center text-xs transition-all ${
                      isCurrent
                        ? "bg-emerald-500 border-emerald-400 text-black scale-110 font-bold shadow-lg shadow-emerald-500/10"
                        : isPast
                          ? "bg-zinc-800 border-zinc-700 text-zinc-400"
                          : "bg-zinc-950 border-zinc-800 text-zinc-600"
                    }`}
                  >
                    {isPast ? "✓" : index + 1}
                  </div>

                  <div
                    onClick={() =>
                      currentStage !== "OFF" &&
                      !isCurrent &&
                      setPendingStage(phase.stage)
                    }
                    className={`space-y-1 p-4 rounded-xl border text-left transition-all relative ${
                      isCurrent
                        ? "bg-zinc-950 border-zinc-800 ring-1 ring-emerald-500/20"
                        : currentStage !== "OFF"
                          ? "bg-black/10 border-zinc-900 opacity-60 hover:opacity-100 hover:border-zinc-700 cursor-pointer"
                          : "opacity-30"
                    }`}
                  >
                    <div className="flex items-center space-x-2">
                      <span className="text-sm">{phase.icon}</span>
                      <h4 className="text-sm font-semibold">{phase.title}</h4>
                      {isCurrent && (
                        <span className="text-[10px] bg-emerald-500/10 text-emerald-400 font-mono px-1.5 rounded animate-pulse font-bold">
                          ACTIVE
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-zinc-500 leading-relaxed max-w-xl">
                      {phase.desc}
                    </p>

                    {activeStrain !== "None" && selectedBlueprint && (
                      <div className="text-[10px] font-mono mt-3 pt-2 border-t border-zinc-950 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                        <div className="flex flex-wrap gap-x-3 gap-y-1 text-zinc-400">
                          <span>
                            ⏱️{" "}
                            <span className="text-zinc-200 font-bold">
                              {targetDays} Days
                            </span>
                          </span>
                          <span>
                            🔥{" "}
                            <span className="text-amber-400 font-bold">
                              {targetTemp}°C
                            </span>
                          </span>
                          <span>
                            💧{" "}
                            <span className="text-blue-400 font-bold">
                              {targetHum}% RH
                            </span>
                          </span>
                          <span>
                            💨{" "}
                            <span className="text-emerald-400 font-bold">
                              {targetCo2} PPM
                            </span>
                          </span>
                        </div>
                        {currentStage !== "OFF" && !isCurrent && (
                          <span className="text-amber-500 text-[9px] tracking-tight font-bold self-end sm:self-auto">
                            ⚡ Advance Here
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </div>
  );
}

function Label({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`block font-medium mb-1 ${className}`}>{children}</label>
  );
}
