// components/daw/TrackControlsPanel.tsx
"use client";
import React, { useState, useRef, useEffect } from "react";
import { ProcessingSettings } from "@/lib/daw/TrackProcessor";
import { DeviceInfo } from "@/lib/daw/AudioDeviceManager";

interface TrackControlsPanelProps {
  trackName: string;
  isMasterMode: boolean;
  onToggleMasterMode: (isMaster: boolean) => void;
  devices: DeviceInfo[];
  activeDeviceId: string;
  onSelectDevice: (deviceId: string) => void;
  isMonitoring: boolean;
  onToggleMonitoring: () => void;
  currentSettings: ProcessingSettings;
  onUpdateSettings: (newSettings: ProcessingSettings) => void;
  onOpenAdvancedEq: () => void;
  onClosePanel: () => void;
}

// Interactive Circular Rotary Knob
function RotaryKnob({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  color = "text-white",
  indicatorColor = "bg-white",
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (val: number) => void;
  color?: string;
  indicatorColor?: string;
}) {
  const isDragging = useRef(false);
  const startY = useRef(0);
  const startVal = useRef(value);

  const angle = ((value - min) / (max - min)) * 270 - 135;

  const handlePointerDown = (e: React.PointerEvent) => {
    isDragging.current = true;
    startY.current = e.clientY;
    startVal.current = value;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging.current) return;
    const deltaY = startY.current - e.clientY;
    const range = max - min;
    const stepVal = (deltaY / 120) * range;
    const newVal = Math.max(min, Math.min(max, startVal.current + stepVal));
    onChange(Number((Math.round(newVal / step) * step).toFixed(2)));
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    isDragging.current = false;
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}
  };

  return (
    <div className="flex flex-col items-center select-none">
      <div
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        className="h-12 w-12 rounded-full border-2 border-zinc-700 bg-gradient-to-b from-zinc-800 to-black shadow-lg flex items-center justify-center relative cursor-ns-resize active:scale-95 transition-transform"
      >
        <div
          style={{ transform: `rotate(${angle}deg)` }}
          className="h-full w-full absolute flex justify-center pt-1 pointer-events-none"
        >
          <div className={`h-2.5 w-0.5 ${indicatorColor} rounded-full`} />
        </div>
        <div className="h-3.5 w-3.5 rounded-full bg-zinc-700 border border-zinc-900 pointer-events-none" />
      </div>
      <span className={`text-[8px] mt-1 font-bold ${color}`}>{label}</span>
      <span className="text-[8px] font-mono text-zinc-400">{value}</span>
    </div>
  );
}

export function TrackControlsPanel({
  trackName,
  isMasterMode,
  onToggleMasterMode,
  devices,
  activeDeviceId,
  onSelectDevice,
  isMonitoring,
  onToggleMonitoring,
  currentSettings,
  onUpdateSettings,
  onOpenAdvancedEq,
  onClosePanel,
}: TrackControlsPanelProps) {
  const [activeSnapshot, setActiveSnapshot] = useState<"A" | "B">("A");
  const [snapshotA, setSnapshotA] = useState<ProcessingSettings>(currentSettings);
  const [snapshotB, setSnapshotB] = useState<ProcessingSettings>(currentSettings);
  const [activeTab, setActiveTab] = useState<"controls" | "eq">("controls");

  useEffect(() => {
    setSnapshotA(currentSettings);
    setSnapshotB(currentSettings);
    setActiveSnapshot("A");
  }, [trackName, isMasterMode]);

  const updateProp = <K extends keyof ProcessingSettings>(key: K, val: ProcessingSettings[K]) => {
    const updated = { ...currentSettings, [key]: val };
    onUpdateSettings(updated);
    if (activeSnapshot === "A") setSnapshotA(updated);
    else setSnapshotB(updated);
  };

  const handleToggleCompare = () => {
    if (activeSnapshot === "A") {
      setActiveSnapshot("B");
      onUpdateSettings(snapshotB);
    } else {
      setActiveSnapshot("A");
      onUpdateSettings(snapshotA);
    }
  };

  return (
    <div className="flex h-56 w-full flex-col border-t border-[#1a1c22] bg-[#22242a] font-sans select-none shadow-2xl z-20">
      
      {/* 1. TOP TOOLBAR */}
      <div className="flex h-8 flex-none items-center justify-between border-b border-[#18191f] bg-[#2d3038] px-4 text-xs">
        <div className="flex items-center gap-1.5">
          <div className="flex rounded bg-black/40 p-0.5">
            <button
              onClick={() => onToggleMasterMode(false)}
              className={`px-3 py-0.5 rounded text-[11px] font-bold transition ${
                !isMasterMode ? "bg-[#387ec7] text-white shadow-sm" : "text-zinc-400 hover:text-white"
              }`}
            >
              Track
            </button>
            <button
              onClick={() => onToggleMasterMode(true)}
              className={`px-3 py-0.5 rounded text-[11px] font-bold transition ${
                isMasterMode ? "bg-[#387ec7] text-white shadow-sm" : "text-zinc-400 hover:text-white"
              }`}
            >
              Master
            </button>
          </div>

          <button
            onClick={handleToggleCompare}
            className={`px-2.5 py-0.5 rounded text-[10px] font-bold border transition ${
              activeSnapshot === "B"
                ? "bg-amber-500/20 border-amber-500/60 text-amber-300"
                : "bg-black/20 border-zinc-700 text-zinc-300 hover:bg-zinc-700/50"
            }`}
          >
            Compare ({activeSnapshot})
          </button>
        </div>

        <div className="flex rounded bg-black/40 p-0.5">
          <button
            onClick={() => setActiveTab("controls")}
            className={`px-3 py-0.5 rounded text-[11px] font-bold transition ${
              activeTab === "controls" ? "bg-[#387ec7] text-white" : "text-zinc-400 hover:text-white"
            }`}
          >
            Controls
          </button>
          <button
            onClick={() => {
              setActiveTab("eq");
              onOpenAdvancedEq();
            }}
            className={`px-3 py-0.5 rounded text-[11px] font-bold transition ${
              activeTab === "eq" ? "bg-[#387ec7] text-white" : "text-zinc-400 hover:text-white"
            }`}
          >
            EQ
          </button>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-[11px] font-medium text-zinc-400">
            {isMasterMode ? "Master Bus" : trackName}
          </span>
          <button onClick={onClosePanel} className="text-zinc-400 hover:text-white text-xs font-bold">
            ✕
          </button>
        </div>
      </div>

      {/* 2. BODY */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* LEFT: Recording Settings (NOW FULLY SCROLLABLE) */}
        <div className="w-72 flex-none border-r border-[#1a1b22] p-3 flex flex-col bg-[#262830] overflow-y-auto">
          <div className="space-y-3 pb-4">
            <span className="text-[10px] font-black uppercase tracking-wider text-zinc-400 block">
              Recording Settings
            </span>

            {/* Record Level Slider */}
            <div>
              <div className="flex justify-between text-[10px] text-zinc-400 mb-0.5">
                <span>Record Level</span>
                <span className="font-mono text-white">{Math.round(currentSettings.inputGain * 100)}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={2}
                step={0.05}
                value={currentSettings.inputGain}
                onChange={(e) => updateProp("inputGain", Number(e.target.value))}
                className="w-full accent-[#3572b0] h-1 bg-zinc-800 rounded cursor-pointer"
              />
            </div>

            {/* Input selector */}
            <div>
              <label className="text-[9px] text-zinc-400 block mb-0.5">Input</label>
              <select
                value={activeDeviceId}
                onChange={(e) => onSelectDevice(e.target.value)}
                className="w-full bg-[#18191f] border border-zinc-700 text-[11px] text-white rounded p-1 focus:outline-none"
              >
                <option value="default">System Default Input</option>
                {devices.map((d) => (
                  <option key={d.deviceId} value={d.deviceId}>{d.label}</option>
                ))}
              </select>
            </div>

            {/* Monitoring toggle */}
            <div className="flex items-center justify-between pt-0.5">
              <span className="text-xs text-zinc-300">Monitoring</span>
              <button
                onClick={onToggleMonitoring}
                className={`px-3 py-1 rounded text-xs font-bold transition ${
                  isMonitoring ? "bg-sky-500 text-black shadow-sky-500/50" : "bg-zinc-800 text-zinc-400"
                }`}
              >
                {isMonitoring ? "ON" : "OFF"}
              </button>
            </div>

            {/* Noise Gate section */}
            <div className="pt-2 border-t border-zinc-800">
              <label className="mb-2 flex items-center gap-1.5 text-[10px] text-zinc-300">
                <input
                  type="checkbox"
                  checked={currentSettings.compEnabled}
                  onChange={(e) => updateProp("compEnabled", e.target.checked)}
                  className="accent-sky-500"
                />
                Compressor enabled
              </label>
              <div className="flex justify-between items-center text-[10px] mb-1">
                <label className="flex items-center gap-1.5 text-zinc-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={currentSettings.gateEnabled}
                    onChange={(e) => updateProp("gateEnabled", e.target.checked)}
                    className="accent-sky-500 rounded"
                  />
                  <span className="font-bold">Noise Gate</span>
                </label>
                <span className="font-mono text-zinc-400">{currentSettings.gateThreshold} dB</span>
              </div>
              <input
                type="range"
                min={-60}
                max={0}
                value={currentSettings.gateThreshold}
                onChange={(e) => updateProp("gateThreshold", Number(e.target.value))}
                disabled={!currentSettings.gateEnabled}
                className="w-full accent-[#3572b0] h-1 bg-zinc-800 rounded cursor-pointer disabled:opacity-40"
              />
            </div>
            <div className="border-t border-zinc-800 pt-2">
              <label className="mb-2 flex items-center gap-1.5 text-[10px] text-zinc-300">
                <input
                  type="checkbox"
                  checked={currentSettings.deEsserEnabled ?? false}
                  onChange={(event) => updateProp("deEsserEnabled", event.target.checked)}
                  className="accent-sky-500"
                />
                De-esser enabled
              </label>
              <div className="mb-1 flex items-center justify-between text-[10px] text-zinc-400">
                <span>Sibilance reduction</span>
                <span className="font-mono">{Math.round((currentSettings.deEsserAmount ?? 0) * 100)}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={currentSettings.deEsserAmount ?? 0}
                onChange={(event) => updateProp("deEsserAmount", Number(event.target.value))}
                disabled={!currentSettings.deEsserEnabled}
                className="w-full accent-sky-500 disabled:opacity-40"
              />
            </div>
          </div>
        </div>

        {/* CENTER & RIGHT: Blue Hardware Console with Rotating Circular Dials */}
        <div className="flex-1 bg-gradient-to-b from-[#244b78] via-[#1d3d63] to-[#142d4a] p-3 flex items-center justify-around border-l border-sky-950 shadow-inner overflow-x-auto">
          
          {/* COMPRESSOR */}
          <div className="flex flex-col items-center border-r border-sky-400/20 pr-6 flex-none">
            <span className="text-[10px] font-black tracking-wider text-sky-200 uppercase mb-1.5">COMPRESSOR</span>
            <div className="flex items-center gap-3">
              <RotaryKnob
                label="AMOUNT"
                value={Math.round(currentSettings.compAmount * 100)}
                min={0}
                max={100}
                step={1}
                onChange={(val) => updateProp("compAmount", val / 100)}
                color="text-sky-200"
                indicatorColor="bg-cyan-400"
              />

              {/* Dynamic Gain Reduction LED Meter */}
              <div className="flex flex-col gap-1 p-1 bg-black/60 rounded border border-sky-900/40">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div
                    key={i}
                    className={`h-1.5 w-1.5 rounded-full ${
                      currentSettings.compEnabled && currentSettings.compAmount * 6 >= i
                        ? i > 4 ? "bg-amber-400 shadow-sm" : "bg-emerald-400"
                        : "bg-zinc-800"
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* EQUALIZER (True Rotating Dials) */}
          <div className="flex flex-col items-center border-r border-sky-400/20 px-6 flex-none">
            <span className="text-[10px] font-black tracking-wider text-sky-200 uppercase mb-1.5">EQUALIZER</span>
            <div className="flex items-center gap-4">
              <RotaryKnob
                label="LOW"
                value={currentSettings.lowGain}
                min={-12}
                max={12}
                step={0.5}
                onChange={(val) => updateProp("lowGain", val)}
                color="text-sky-200"
              />
              <RotaryKnob
                label="MID"
                value={currentSettings.midGain}
                min={-12}
                max={12}
                step={0.5}
                onChange={(val) => updateProp("midGain", val)}
                color="text-sky-200"
                indicatorColor="bg-cyan-400"
              />
              <RotaryKnob
                label="HIGH"
                value={currentSettings.highGain}
                min={-12}
                max={12}
                step={0.5}
                onChange={(val) => updateProp("highGain", val)}
                color="text-sky-200"
              />

              {/* Low Cut Switch */}
              <div className="flex flex-col items-center pl-1">
                <button
                  onClick={() => updateProp("lowCut", !currentSettings.lowCut)}
                  className={`h-7 w-7 rounded-full border border-sky-400/40 text-[9px] font-bold transition flex items-center justify-center ${
                    currentSettings.lowCut ? "bg-sky-400 text-black shadow-sm" : "bg-black/40 text-zinc-400"
                  }`}
                  title="80Hz HPF"
                >
                  HPF
                </button>
                <span className="text-[7px] text-sky-200 mt-1 font-bold uppercase">LOW CUT</span>
              </div>
            </div>
          </div>

          {/* SENDS (Rotating Circular Dials) */}
          <div className="flex flex-col items-center pl-6 flex-none">
            <span className="text-[10px] font-black tracking-wider text-sky-200 uppercase mb-1.5">SENDS</span>
            <div className="flex items-center gap-4">
              <RotaryKnob
                label="AMBIENCE"
                value={Math.round(currentSettings.ambienceSend * 100)}
                min={0}
                max={100}
                step={1}
                onChange={(val) => updateProp("ambienceSend", val / 100)}
                color="text-sky-200"
              />
              <RotaryKnob
                label="REVERB"
                value={Math.round(currentSettings.reverbSend * 100)}
                min={0}
                max={100}
                step={1}
                onChange={(val) => updateProp("reverbSend", val / 100)}
                color="text-sky-200"
                indicatorColor="bg-cyan-400"
              />
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
