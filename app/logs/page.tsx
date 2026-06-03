// app/logs/page.tsx
"use client";

import React, { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";

interface SystemEvent {
  id: string;
  timestamp: string;
  type: "ALARM" | "AUDIT" | "NORMAL";
  message: string;
  value?: string;
}

export default function LogsAndAlarmsPage() {
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);

  // Threshold States
  const [minTemp, setMinTemp] = useState<number>(15.0);
  const [maxTemp, setMaxTemp] = useState<number>(28.5);
  const [minHum, setMinHum] = useState<number>(70.0);
  const [maxHum, setMaxHum] = useState<number>(95.0);
  const [minCo2, setMinCo2] = useState<number>(400);
  const [maxCo2, setMaxCo2] = useState<number>(1800);

  // Core Channel States
  const [emailAddress, setEmailAddress] = useState<string>("");
  const [emailVerified, setEmailVerified] = useState<boolean>(false);
  const [emailEnabled, setEmailEnabled] = useState<boolean>(false);

  const [phoneNumber, setPhoneNumber] = useState<string>("");
  const [phoneVerified, setPhoneVerified] = useState<boolean>(false);
  const [smsEnabled, setSmsEnabled] = useState<boolean>(false);
  const [whatsappEnabled, setWhatsappEnabled] = useState<boolean>(false);

  // Virtual Handshake OTP Temporary Registers
  const [emailOtpSent, setEmailOtpSent] = useState<boolean>(false);
  const [emailInputOtp, setEmailInputOtp] = useState<string>("");
  const [emailGeneratedCode, setEmailGeneratedCode] = useState<string>("");

  const [phoneOtpSent, setPhoneOtpSent] = useState<boolean>(false);
  const [phoneInputOtp, setPhoneInputOtp] = useState<string>("");
  const [phoneGeneratedCode, setPhoneGeneratedCode] = useState<string>("");

  // Audit Log List State
  const [events, setEvents] = useState<SystemEvent[]>([
    {
      id: "1",
      timestamp: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
      type: "ALARM",
      message:
        "CRITICAL BREACH: Room humidity dropped below safety minimum target threshold",
      value: "64.2% RH",
    },
    {
      id: "2",
      timestamp: new Date(Date.now() - 1000 * 60 * 32).toISOString(),
      type: "ALARM",
      message:
        "CRITICAL BREACH: Room temperature exceeded safety maximum target threshold",
      value: "31.2°C",
    },
    {
      id: "3",
      timestamp: new Date(Date.now() - 1000 * 60 * 55).toISOString(),
      type: "AUDIT",
      message:
        "Chamber Switchboard Humidifier shifted to manual override: FORCE_ON",
      value: "FORCE_ON",
    },
    {
      id: "4",
      timestamp: new Date(Date.now() - 1000 * 60 * 140).toISOString(),
      type: "NORMAL",
      message:
        "Fresh air intake loop triggered: Carbon Dioxide successfully stabilized below maximum cap",
      value: "510 PPM",
    },
  ]);

  // Initial Data Fetch Loop
  useEffect(() => {
    async function loadSettings() {
      try {
        const { data, error } = await supabase
          .from("notification_settings")
          .select("*")
          .eq("id", 1)
          .single();

        if (data && !error) {
          setMinTemp(Number(data.min_temp));
          setMaxTemp(Number(data.max_temp));
          setMinHum(Number(data.min_hum));
          setMaxHum(Number(data.max_hum));
          setMinCo2(Number(data.min_co2));
          setMaxCo2(Number(data.max_co2));
          setEmailAddress(data.email_address || "");
          setEmailVerified(data.email_verified || false);
          setEmailEnabled(data.email_enabled || false);
          setPhoneNumber(data.phone_number || "");
          setPhoneVerified(data.phone_verified || false);
          setSmsEnabled(data.sms_enabled || false);
          setWhatsappEnabled(data.whatsapp_enabled || false);
        }
      } catch (err) {
        console.error("Error pulling configurations:", err);
      } finally {
        setLoading(false);
      }
    }

    loadSettings();
  }, []);

  // Collective Save Button for Threshold Sliders
  const handleSaveGuardrails = async () => {
    if (minTemp >= maxTemp)
      return alert(
        "Validation Error: Minimum temperature must be lower than maximum temperature.",
      );
    if (minHum >= maxHum)
      return alert(
        "Validation Error: Minimum humidity must be lower than maximum humidity.",
      );
    if (minCo2 >= maxCo2)
      return alert(
        "Validation Error: Minimum CO2 must be lower than maximum CO2.",
      );

    setSaving(true);
    const { error } = await supabase.from("notification_settings").upsert({
      id: 1,
      min_temp: minTemp,
      max_temp: maxTemp,
      min_hum: minHum,
      max_hum: maxHum,
      min_co2: minCo2,
      max_co2: maxCo2,
    });

    setSaving(false);
    if (error) alert("Database write rejected: " + error.message);
    else alert("Safety guardrail limits synchronized successfully!");
  };

  // Symmetrical Channel Toggle State Synchronizers
  const handleToggleEmailSwitch = async (checked: boolean) => {
    setEmailEnabled(checked);
    await supabase
      .from("notification_settings")
      .upsert({ id: 1, email_enabled: checked });
  };

  const handleToggleSmsSwitch = async (checked: boolean) => {
    setSmsEnabled(checked);
    await supabase
      .from("notification_settings")
      .upsert({ id: 1, sms_enabled: checked });
  };

  const handleToggleWhitespaceSwitch = async (checked: boolean) => {
    setWhatsappEnabled(checked);
    await supabase
      .from("notification_settings")
      .upsert({ id: 1, whatsapp_enabled: checked });
  };

  // --- EMAIL HANDSHAKE STATE MACHINE FLOWS ---
  const triggerEmailVerify = () => {
    if (!emailAddress.trim() || !emailAddress.includes("@")) {
      return alert("Please specify a valid email address first.");
    }
    const mockCode = Math.floor(100000 + Math.random() * 900000).toString();
    setEmailGeneratedCode(mockCode);
    setEmailOtpSent(true);
    alert(
      `[MOCK GATEWAY] OTP dispatched to ${emailAddress}.\nType this code into the verification box: ${mockCode}`,
    );
  };

  const confirmEmailOtp = async () => {
    if (emailInputOtp === emailGeneratedCode) {
      setEmailVerified(true);
      setEmailOtpSent(false);
      setEmailInputOtp("");
      await supabase.from("notification_settings").upsert({
        id: 1,
        email_address: emailAddress,
        email_verified: true,
      });
      alert("Email account verified and secured successfully!");
    } else {
      alert("Invalid verification passcode token. Please check your spelling.");
    }
  };

  const handleChangeEmail = async () => {
    if (
      confirm(
        "Changing email endpoint will automatically turn off active email alert logs. Proceed?",
      )
    ) {
      setEmailVerified(false);
      setEmailEnabled(false);
      setEmailOtpSent(false);
      setEmailAddress("");
      await supabase.from("notification_settings").upsert({
        id: 1,
        email_address: "",
        email_verified: false,
        email_enabled: false,
      });
    }
  };

  // --- PHONE HANDSHAKE STATE MACHINE FLOWS ---
  const triggerPhoneVerify = () => {
    if (!phoneNumber.trim())
      return alert("Please specify a contact phone number string.");
    const mockCode = Math.floor(100000 + Math.random() * 900000).toString();
    setPhoneGeneratedCode(mockCode);
    setPhoneOtpSent(true);
    alert(
      `[MOCK GATEWAY] OTP text dispatched to ${phoneNumber}.\nType this code into the verification box: ${mockCode}`,
    );
  };

  const confirmPhoneOtp = async () => {
    if (phoneInputOtp === phoneGeneratedCode) {
      setPhoneVerified(true);
      setPhoneOtpSent(false);
      setPhoneInputOtp("");
      await supabase.from("notification_settings").upsert({
        id: 1,
        phone_number: phoneNumber,
        phone_verified: true,
      });
      alert("Phone terminal link verified and secured successfully!");
    } else {
      alert("Invalid verification passcode token. Please check your spelling.");
    }
  };

  const handleChangePhone = async () => {
    if (
      confirm(
        "Changing phone endpoint will instantly disable active SMS and WhatsApp warning vectors. Proceed?",
      )
    ) {
      setPhoneVerified(false);
      setSmsEnabled(false);
      setWhatsappEnabled(false);
      setPhoneOtpSent(false);
      setPhoneNumber("");
      await supabase.from("notification_settings").upsert({
        id: 1,
        phone_number: "",
        phone_verified: false,
        sms_enabled: false,
        whatsapp_enabled: false,
      });
    }
  };

  // Chronological table ledger reset handler
  const clearLogLedger = () => {
    if (
      confirm(
        "Are you sure you want to clear the chronological audit log ledger?",
      )
    ) {
      setEvents([]);
    }
  };

  if (loading)
    return (
      <div className="text-sm p-6 text-zinc-500 font-mono">
        Syncing verification security schemas...
      </div>
    );

  return (
    <div className="space-y-8 max-w-6xl mx-auto p-1 text-zinc-100 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Alarms & Logs</h1>
          <p className="text-sm text-zinc-400">
            Just-In-Time secure communication validation and extreme climate
            safety thresholds
          </p>
        </div>
        <Button
          onClick={handleSaveGuardrails}
          disabled={saving}
          className="bg-emerald-600 hover:bg-emerald-500 font-bold text-xs h-9 tracking-wide px-4"
        >
          {saving ? "Syncing..." : "Flawless Sync Guardrails"}
        </Button>
      </div>

      {/* DUAL LIMIT PARAMETERS GRID */}
      <div className="grid gap-6 md:grid-cols-3">
        {/* TEMPERATURE THRESHOLDS CARD */}
        <Card className="bg-zinc-900 border-zinc-800 border-t-2 border-t-amber-500 shadow-xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold font-mono uppercase tracking-wider text-zinc-400 flex items-center justify-between">
              <span>🔥 Thermal Limits</span>
              <span className="text-[10px] bg-amber-500/10 text-amber-400 px-1.5 py-0.5 rounded">
                Guardrails
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1 bg-black/20 p-2.5 rounded-lg border border-zinc-800/60">
              <div className="flex justify-between text-[11px] font-mono text-zinc-500">
                <span>Min Floor Trigger</span>
                <span className="text-amber-500 font-bold">{minTemp}°C</span>
              </div>
              <input
                type="range"
                min="10"
                max="22"
                step="0.5"
                value={minTemp}
                onChange={(e) => setMinTemp(parseFloat(e.target.value))}
                className="w-full h-1 appearance-none cursor-pointer accent-amber-500"
              />
            </div>
            <div className="space-y-1 bg-black/20 p-2.5 rounded-lg border border-zinc-800/60">
              <div className="flex justify-between text-[11px] font-mono text-zinc-500">
                <span>Max Ceiling Trigger</span>
                <span className="text-amber-500 font-bold">{maxTemp}°C</span>
              </div>
              <input
                type="range"
                min="23"
                max="45"
                step="0.5"
                value={maxTemp}
                onChange={(e) => setMaxTemp(parseFloat(e.target.value))}
                className="w-full h-1 appearance-none cursor-pointer accent-amber-500"
              />
            </div>
          </CardContent>
        </Card>

        {/* HUMIDITY THRESHOLDS CARD */}
        <Card className="bg-zinc-900 border-zinc-800 border-t-2 border-t-blue-500 shadow-xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold font-mono uppercase tracking-wider text-zinc-400 flex items-center justify-between">
              <span>💧 Moisture Limits</span>
              <span className="text-[10px] bg-blue-500/10 text-blue-400 px-1.5 py-0.5 rounded">
                Guardrails
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1 bg-black/20 p-2.5 rounded-lg border border-zinc-800/60">
              <div className="flex justify-between text-[11px] font-mono text-zinc-500">
                <span>Min Floor Trigger</span>
                <span className="text-blue-400 font-bold">{minHum}%</span>
              </div>
              <input
                type="range"
                min="40"
                max="75"
                step="1"
                value={minHum}
                onChange={(e) => setMinHum(parseInt(e.target.value, 10))}
                className="w-full h-1 appearance-none cursor-pointer accent-blue-500"
              />
            </div>
            <div className="space-y-1 bg-black/20 p-2.5 rounded-lg border border-zinc-800/60">
              <div className="flex justify-between text-[11px] font-mono text-zinc-500">
                <span>Max Ceiling Trigger</span>
                <span className="text-blue-400 font-bold">{maxHum}%</span>
              </div>
              <input
                type="range"
                min="76"
                max="99"
                step="1"
                value={maxHum}
                onChange={(e) => setMaxHum(parseInt(e.target.value, 10))}
                className="w-full h-1 appearance-none cursor-pointer accent-blue-500"
              />
            </div>
          </CardContent>
        </Card>

        {/* CARBON DIOXIDE THRESHOLDS CARD */}
        <Card className="bg-zinc-900 border-zinc-800 border-t-2 border-t-emerald-500 shadow-xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold font-mono uppercase tracking-wider text-zinc-400 flex items-center justify-between">
              <span>💨 Gas Exchange Limits</span>
              <span className="text-[10px] bg-emerald-500/10 text-emerald-400 px-1.5 py-0.5 rounded">
                Guardrails
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1 bg-black/20 p-2.5 rounded-lg border border-zinc-800/60">
              <div className="flex justify-between text-[11px] font-mono text-zinc-500">
                <span>Min Target Floor</span>
                <span className="text-emerald-400 font-bold">{minCo2} PPM</span>
              </div>
              <input
                type="range"
                min="200"
                max="600"
                step="50"
                value={minCo2}
                onChange={(e) => setMinCo2(parseInt(e.target.value, 10))}
                className="w-full h-1 appearance-none cursor-pointer accent-emerald-400"
              />
            </div>
            <div className="space-y-1 bg-black/20 p-2.5 rounded-lg border border-zinc-800/60">
              <div className="flex justify-between text-[11px] font-mono text-zinc-500">
                <span>Max Critical Ceiling</span>
                <span className="text-emerald-400 font-bold">{maxCo2} PPM</span>
              </div>
              <input
                type="range"
                min="700"
                max="3000"
                step="50"
                value={maxCo2}
                onChange={(e) => setMaxCo2(parseInt(e.target.value, 10))}
                className="w-full h-1 appearance-none cursor-pointer accent-emerald-400"
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* JUST-IN-TIME VERIFICATION COMMUNICATION CARD BLOCK */}
      <Card className="bg-zinc-900 border-zinc-800 shadow-xl">
        <CardHeader>
          <CardTitle className="text-xs font-bold font-mono uppercase tracking-wider text-zinc-400">
            🛰️ Certified Routing Matrix
          </CardTitle>
          <CardDescription className="text-xs text-zinc-500">
            Endpoints must complete a secure handshake verification before
            unlocking system broadcast toggles
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 md:grid-cols-2">
          {/* EMAIL CHANNEL MATRIX CONTAINER */}
          <div className="p-4 border border-zinc-800 bg-black/10 rounded-xl space-y-4 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                  📧 Email Broadcast Dispatch
                </span>
                {emailVerified ? (
                  <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded font-bold">
                    ✓ VERIFIED
                  </span>
                ) : (
                  <span className="text-[10px] font-mono text-zinc-500 bg-zinc-800 px-1.5 py-0.5 rounded">
                    UNVERIFIED
                  </span>
                )}
              </div>

              <div className="flex gap-2">
                <input
                  disabled={emailVerified || emailOtpSent}
                  type="email"
                  placeholder="grower@shroomos.com"
                  value={emailAddress}
                  onChange={(e) => setEmailAddress(e.target.value)}
                  className="flex-1 bg-zinc-950 border border-zinc-800 p-2 rounded text-xs outline-none text-zinc-200 font-mono disabled:opacity-50"
                />
                {emailVerified ? (
                  <button
                    onClick={handleChangeEmail}
                    className="px-3 text-xs bg-zinc-800 border border-zinc-700 rounded text-zinc-400 hover:text-zinc-200 font-mono"
                  >
                    Change
                  </button>
                ) : !emailOtpSent ? (
                  <button
                    onClick={triggerEmailVerify}
                    className="px-3 text-xs bg-emerald-600 text-white rounded hover:bg-emerald-500 font-mono font-bold"
                  >
                    Verify
                  </button>
                ) : null}
              </div>

              {/* Email OTP Field Prompt */}
              {emailOtpSent && (
                <div className="bg-zinc-950 border border-zinc-800/80 p-3 rounded-lg space-y-2 animate-in slide-in-from-top-2 duration-200">
                  <Label className="text-zinc-400 text-[11px] font-mono">
                    Enter 6-Digit Handshake Passcode Token
                  </Label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="123456"
                      maxLength={6}
                      value={emailInputOtp}
                      onChange={(e) => setEmailInputOtp(e.target.value)}
                      className="flex-1 bg-black border border-zinc-800 text-center text-sm font-mono tracking-widest text-amber-400 py-1 rounded"
                    />
                    <button
                      onClick={confirmEmailOtp}
                      className="px-3 bg-zinc-800 border border-zinc-700 text-xs text-zinc-200 rounded hover:bg-zinc-700 font-mono"
                    >
                      Confirm
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between border-t border-zinc-800/60 pt-3 mt-2 text-xs font-mono">
              <span className="text-zinc-500">
                Allow Outbound Email Dispatches:
              </span>
              <Switch
                checked={emailEnabled}
                disabled={!emailVerified}
                onCheckedChange={handleToggleEmailSwitch}
                size="sm"
              />
            </div>
          </div>

          {/* TELEPHONE TERMINAL DISPATCH CONTAINER (SMS & WHATSAPP) */}
          <div className="p-4 border border-zinc-800 bg-black/10 rounded-xl space-y-4 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                  📱 Cellular Endpoint Integration
                </span>
                {phoneVerified ? (
                  <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded font-bold">
                    ✓ VERIFIED
                  </span>
                ) : (
                  <span className="text-[10px] font-mono text-zinc-500 bg-zinc-800 px-1.5 py-0.5 rounded">
                    UNVERIFIED
                  </span>
                )}
              </div>

              <div className="flex gap-2">
                <input
                  disabled={phoneVerified || phoneOtpSent}
                  type="tel"
                  placeholder="+995 555 12 34 56"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  className="flex-1 bg-zinc-950 border border-zinc-800 p-2 rounded text-xs outline-none text-zinc-200 font-mono disabled:opacity-50"
                />
                {phoneVerified ? (
                  <button
                    onClick={handleChangePhone}
                    className="px-3 text-xs bg-zinc-800 border border-zinc-700 rounded text-zinc-400 hover:text-zinc-200 font-mono"
                  >
                    Change
                  </button>
                ) : !phoneOtpSent ? (
                  <button
                    onClick={triggerPhoneVerify}
                    className="px-3 text-xs bg-emerald-600 text-white rounded hover:bg-emerald-500 font-mono font-bold"
                  >
                    Verify
                  </button>
                ) : null}
              </div>

              {/* Phone OTP Field Prompt */}
              {phoneOtpSent && (
                <div className="bg-zinc-950 border border-zinc-800/80 p-3 rounded-lg space-y-2 animate-in slide-in-from-top-2 duration-200">
                  <Label className="text-zinc-400 text-[11px] font-mono">
                    Enter 6-Digit Handshake Passcode Token
                  </Label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="123456"
                      maxLength={6}
                      value={phoneInputOtp}
                      onChange={(e) => setPhoneInputOtp(e.target.value)}
                      className="flex-1 bg-black border border-zinc-800 text-center text-sm font-mono tracking-widest text-amber-400 py-1 rounded"
                    />
                    <button
                      onClick={confirmPhoneOtp}
                      className="px-3 bg-zinc-800 border border-zinc-700 text-xs text-zinc-200 rounded hover:bg-zinc-700 font-mono"
                    >
                      Confirm
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-2 border-t border-zinc-800/60 pt-3 mt-2 text-xs font-mono">
              <div className="flex items-center justify-between">
                <span className="text-zinc-500">
                  💬 Forward Cellular SMS Alerts:
                </span>
                <Switch
                  checked={smsEnabled}
                  disabled={!phoneVerified}
                  onCheckedChange={handleToggleSmsSwitch}
                  size="sm"
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-zinc-500">
                  🟢 Mount Live WhatsApp Stream Node:
                </span>
                <Switch
                  checked={whatsappEnabled}
                  disabled={!phoneVerified}
                  onCheckedChange={handleToggleWhitespaceSwitch}
                  size="sm"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* SYSTEM EVENT LOG TABLE */}
      <Card className="bg-zinc-900 border-zinc-800 shadow-xl">
        <CardHeader className="flex flex-row items-center justify-between pb-4 space-y-0">
          <div>
            <CardTitle className="text-xs font-bold font-mono uppercase tracking-wider text-zinc-400">
              📋 Continuous Event Audit Ledger
            </CardTitle>
          </div>
          <button
            onClick={clearLogLedger}
            disabled={events.length === 0}
            className="text-xs text-zinc-500 hover:text-rose-400 font-mono transition-colors disabled:opacity-30"
          >
            Clear Ledger
          </button>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto border border-zinc-800 rounded-xl bg-black/20">
            <table className="w-full text-left text-xs font-mono border-collapse">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-900/50 text-zinc-400 font-bold">
                  <th className="p-3">Timestamp</th>
                  <th className="p-3">Classification</th>
                  <th className="p-3">System Message Log</th>
                  <th className="p-3 text-right">Captured State</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {events.map((evt) => (
                  <tr
                    key={evt.id}
                    className="hover:bg-zinc-900/30 transition-all text-zinc-300"
                  >
                    <td className="p-3 text-zinc-500 whitespace-nowrap">
                      {new Date(evt.timestamp).toLocaleString()}
                    </td>
                    <td className="p-3 whitespace-nowrap">
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        ℹ️ OK_SYS
                      </span>
                    </td>
                    <td className="p-3 max-w-xl truncate text-zinc-300">
                      {evt.message}
                    </td>
                    <td className="p-3 text-right text-zinc-400 font-semibold">
                      {evt.value}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
