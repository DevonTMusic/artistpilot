// components/daw/TrackControlsPanel.tsx
"use client";
import React, { useState } from "react";
import { ProcessingSettings } from "@/lib/daw/TrackProcessor";

interface TrackControlsPanelProps {
  trackName: string;
  isMasterMode: boolean;
  onToggleMasterMode: (isMaster: boolean) => void;
  devices: any[];
  activeDeviceId: string;
  onSelectDevice: (deviceId: string) => void;
  isMonitoring: boolean;
  onToggleMonitoring: () => void;
  currentSettings: ProcessingSettings;
  onUpdateSettings: (newSettings: ProcessingSettings) => void;
  onOpenAdvancedEq: () => void;
  onClosePanel: () => void;
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
            title="A/B Compare"
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
        
        {/* LEFT: Recording Settings */}
        <div className="w-72 flex-none border-r border-[#1a1b22] p-3.5 flex flex-col justify-between bg-[#262830]">
          <div className="space-y-2.5">
            <span className="text-[10px] font-black uppercase tracking-wider text-zinc-400 block">
              Recording Settings
            </span>

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

            <div>
              <label className="text-[9px] text-zinc-400 block mb-0.5">Input</label>
              <select
                value={activeDeviceId}
                onChange={(e) => onSelectDevice(e.target.value)}
                className="w-full bg-[#18191f] border border-zinc-700 text-[11px] text-white rounded p-1 focus:outline-none"
              >
                <option value="default">1 (Scarlett Solo USB)</option>
                {devices.map((d) => (
                  <option key={d.deviceId} value={d.deviceId}>{d.label}</option>
                ))}
              </select>
            </div>

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

            <div className="pt-1 border-t border-zinc-800/80">
              <div className="flex justify-between items-center text-[10px] mb-1">
                <label className="flex items-center gap-1.5 text-zinc-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={currentSettings.gateEnabled}
                    onChange={(e) => updateProp("gateEnabled", e.target.checked)}
                    className="accent-sky-500 rounded"
                  />
                  <span>Noise Gate</span>
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
          </div>
        </div>

        {/* CENTER & RIGHT: Blue Hardware Console */}
        <div className="flex-1 bg-gradient-to-b from-[#244b78] via-[#1d3d63] to-[#142d4a] p-3 flex items-center justify-around border-l border-sky-950 shadow-inner">
          
          {/* Compressor */}
          <div className="flex flex-col items-center border-r border-sky-400/20 pr-6">
            <span className="text-[10px] font-black tracking-wider text-sky-200 uppercase mb-1.5">COMPRESSOR</span>
            <div className="flex items-center gap-3">
              <div className="flex flex-col items-center">
                <div
                  onWheel={(e) => updateProp("compAmount", Math.max(0, Math.min(1, currentSettings.compAmount - e.deltaY * 0.001)))}
                  className="h-14 w-14 rounded-full border-2 border-zinc-700 bg-gradient-to-b from-zinc-800 to-black shadow-lg flex items-center justify-center relative cursor-ns-resize"
                >
                  <div
                    style={{ transform: `rotate(${(currentSettings.compAmount - 0.5) * 260}deg)` }}
                    className="h-full w-full absolute flex justify-center pt-1"
                  >
                    <div className="h-2 w-0.5 bg-cyan-400 rounded" />
                  </div>
                  <div className="h-4 w-4 rounded-full bg-zinc-700" />
                </div>
                <span className="text-[8px] text-sky-200 mt-1 font-bold">AMOUNT</span>
              </div>

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

          {/* Equalizer */}
          <div className="flex flex-col items-center border-r border-sky-400/20 px-6">
            <span className="text-[10px] font-black tracking-wider text-sky-200 uppercase mb-1.5">EQUALIZER</span>
            <div className="flex items-center gap-3">
              {/* Low */}
              <div className="flex flex-col items-center">
                <div
                  onWheel={(e) => updateProp("lowGain", Math.max(-12, Math.min(12, currentSettings.lowGain - e.deltaY * 0.05)))}
                  className="h-11 w-11 rounded-full border-2 border-zinc-700 bg-gradient-to-b from-zinc-800 to-black shadow flex items-center justify-center relative cursor-ns-resize"
                >
                  <div
                    style={{ transform: `rotate(${(currentSettings.lowGain / 12) * 130}deg)` }}
                    className="h-full w-full absolute flex justify-center pt-1"
                  >
                    <div className="h-2 w-0.5 bg-white rounded" />
                  </div>
                  <div className="h-3 w-3 rounded-full bg-zinc-700" />
                </div>
                <span className="text-[8px] text-sky-200 mt-1 font-bold">LOW</span>
              </div>

              {/* Mid */}
              <div className="flex flex-col items-center">
                <div
                  onWheel={(e) => updateProp("midGain", Math.max(-12, Math.min(12, currentSettings.midGain - e.deltaY * 0.05)))}
                  className="h-11 w-11 rounded-full border-2 border-zinc-700 bg-gradient-to-b from-zinc-800 to-black shadow flex items-center justify-center relative cursor-ns-resize"
                >
                  <div
                    style={{ transform: `rotate(${(currentSettings.midGain / 12) * 130}deg)` }}
                    className="h-full w-full absolute flex justify-center pt-1"
                  >
                    <div className="h-2 w-0.5 bg-cyan-400 rounded" />
                  </div>
                  <div className="h-3 w-3 rounded-full bg-zinc-700" />
                </div>
                <span className="text-[8px] text-sky-200 mt-1 font-bold">MID</span>
              </div>

              {/* High */}
              <div className="flex flex-col items-center">
                <div
                  onWheel={(e) => updateProp("highGain", Math.max(-12, Math.min(12, currentSettings.highGain - e.deltaY * 0.05)))}
                  className="h-11 w-11 rounded-full border-2 border-zinc-700 bg-gradient-to-b from-zinc-800 to-black shadow flex items-center justify-center relative cursor-ns-resize"
                >
                  <div
                    style={{ transform: `rotate(${(currentSettings.highGain / 12) * 130}deg)` }}
                    className="h-full w-full absolute flex justify-center pt-1"
                  >
                    <div className="h-2 w-0.5 bg-white rounded" />
                  </div>
                  <div className="h-3 w-3 rounded-full bg-zinc-700" />
                </div>
                <span className="text-[8px] text-sky-200 mt-1 font-bold">HIGH</span>
              </div>

              {/* Low Cut */}
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

          {/* SENDS */}
          <div className="flex flex-col items-center pl-6">
            <span className="text-[10px] font-black tracking-wider text-sky-200 uppercase mb-1.5">SENDS</span>
            <div className="flex items-center gap-4">
              <div className="flex flex-col items-center">
                <div
                  onWheel={(e) => updateProp("ambienceSend", Math.max(0, Math.min(1, currentSettings.ambienceSend - e.deltaY * 0.001)))}
                  className="h-11 w-11 rounded-full border-2 border-zinc-700 bg-gradient-to-b from-zinc-800 to-black shadow flex items-center justify-center relative cursor-ns-resize"
                >
                  <div
                    style={{ transform: `rotate(${(currentSettings.ambienceSend - 0.5) * 260}deg)` }}
                    className="h-full w-full absolute flex justify-center pt-1"
                  >
                    <div className="h-2 w-0.5 bg-white rounded" />
                  </div>
                  <div className="h-3 w-3 rounded-full bg-zinc-700" />
                </div>
                <span className="text-[8px] text-sky-200 mt-1 font-bold">AMBIENCE</span>
              </div>

              <div className="flex flex-col items-center">
                <div
                  onWheel={(e) => updateProp("reverbSend", Math.max(0, Math.min(1, currentSettings.reverbSend - e.deltaY * 0.001)))}
                  className="h-11 w-11 rounded-full border-2 border-zinc-700 bg-gradient-to-b from-zinc-800 to-black shadow flex items-center justify-center relative cursor-ns-resize"
                >
                  <div
                    style={{ transform: `rotate(${(currentSettings.reverbSend - 0.5) * 260}deg)` }}
                    className="h-full w-full absolute flex justify-center pt-1"
                  >
                    <div className="h-2 w-0.5 bg-cyan-400 rounded" />
                  </div>
                  <div className="h-3 w-3 rounded-full bg-zinc-700" />
                </div>
                <span className="text-[8px] text-sky-200 mt-1 font-bold">REVERB</span>
              </div>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
