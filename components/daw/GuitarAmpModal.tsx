// components/daw/GuitarAmpModal.tsx
"use client";
import React, { useState } from "react";
import { GuitarAmpSettings } from "@/lib/daw/EffectsEngine";

interface GuitarAmpModalProps {
  isOpen: boolean;
  onClose: () => void;
  trackName: string;
  settings: GuitarAmpSettings;
  enabled: boolean;
  onSettingsChange: (settings: GuitarAmpSettings) => void;
  onToggleEnabled: () => void;
}

export function GuitarAmpModal({
  isOpen,
  onClose,
  trackName,
  settings,
  enabled,
  onSettingsChange,
  onToggleEnabled,
}: GuitarAmpModalProps) {

  if (!isOpen) return null;

  return (
    <div className="absolute top-20 left-1/2 -translate-x-1/2 z-50 w-[720px] rounded-2xl border-2 border-[#1c1d22] bg-[#1a1b20] shadow-[0_20px_60px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col font-sans select-none">
      
      {/* 1. Header */}
      <div className="flex h-10 items-center justify-between border-b border-zinc-800 bg-[#282a32] px-4">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-amber-400">🎸 Amp Designer & Pedalboard</span>
          <span className="text-xs text-zinc-400">({trackName})</span>
        </div>
        <button
          onClick={onClose}
          className="h-6 w-6 rounded hover:bg-red-500 text-zinc-400 hover:text-white flex items-center justify-center font-bold text-xs"
        >
          ✕
        </button>
      </div>

      {/* 2. Vintage Hardware Amplifier Head (GarageBand Style) */}
      <div className="p-6 bg-gradient-to-b from-[#2d2f38] to-[#1e1f25] border-b border-zinc-900 shadow-inner flex flex-col items-center">
        {/* Amp Logo & Pilot Light */}
        <div className="flex w-full items-center justify-between px-6 mb-4">
          <span className="font-serif italic font-extrabold text-xl tracking-wider text-amber-200/90 drop-shadow">
            ArtistPilot Custom Combo
          </span>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-zinc-400 tracking-wider">POWER</span>
            <button
              onClick={onToggleEnabled}
              aria-pressed={enabled}
              className={`h-3.5 w-3.5 rounded-full border ${enabled ? "bg-emerald-500 shadow-[0_0_10px_#22c55e] border-emerald-300" : "bg-zinc-700 border-zinc-500"}`}
              aria-label={enabled ? "Disable amp processing" : "Enable amp processing"}
            />
          </div>
        </div>

        {/* Brushed Metal Knob Faceplate */}
        <div className="w-full rounded-lg bg-gradient-to-b from-[#e2e2e8] via-[#c4c4cc] to-[#9fa0a8] p-4 text-zinc-900 shadow-2xl flex items-center justify-around border-2 border-zinc-500">
          {[
            { label: "GAIN / DRIVE", val: Math.round(settings.drive * 10), min: 0, max: 1, step: 0.05, prop: "drive" },
            { label: "BASS", val: settings.bass, min: -10, max: 10, step: 1, prop: "bass" },
            { label: "MIDDLE", val: settings.mid, min: -10, max: 10, step: 1, prop: "mid" },
            { label: "TREBLE", val: settings.treble, min: -10, max: 10, step: 1, prop: "treble" },
            { label: "REVERB", val: Math.round(settings.reverb * 10), min: 0, max: 1, step: 0.05, prop: "reverb" },
          ].map((k) => (
            <div key={k.label} className="flex flex-col items-center gap-1">
              <span className="text-[9px] font-black tracking-tighter text-zinc-800">{k.label}</span>
              <div className="h-12 w-12 rounded-full border-2 border-zinc-600 bg-gradient-to-b from-zinc-800 to-black shadow-md flex items-center justify-center relative">
                <div className="h-2 w-0.5 bg-white absolute top-1 rounded" />
                <div className="h-4 w-4 rounded-full bg-zinc-700" />
              </div>
              <input
                type="range"
                min={k.min}
                max={k.max}
                step={k.step}
                value={settings[k.prop as keyof GuitarAmpSettings] as number}
                onChange={(e) => onSettingsChange({ ...settings, [k.prop]: Number(e.target.value) })}
                className="w-16 accent-zinc-800 h-1 bg-zinc-400 rounded cursor-pointer mt-1"
              />
              <span className="text-[10px] font-mono font-bold">{k.val}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 3. Stompbox Pedalboard Tray */}
      <div className="p-4 bg-[#141518] flex items-center justify-center gap-6">
        
        {/* Pedal 1: Vintage Overdrive (Green TubeScreamer style) */}
        <div className="w-40 h-52 rounded-xl bg-gradient-to-b from-emerald-600 to-emerald-800 border-2 border-emerald-400/50 shadow-2xl p-3 flex flex-col justify-between items-center text-white">
          <span className="text-[11px] font-black tracking-widest text-emerald-100">OVERDRIVE</span>
          <div className="flex gap-2">
            <div className="text-center">
              <div className="h-7 w-7 rounded-full bg-zinc-900 border border-zinc-600 mx-auto" />
              <span className="text-[8px] font-bold">DRIVE</span>
            </div>
            <div className="text-center">
              <div className="h-7 w-7 rounded-full bg-zinc-900 border border-zinc-600 mx-auto" />
              <span className="text-[8px] font-bold">TONE</span>
            </div>
          </div>
          {/* Metal Stomp Switch */}
          <button
            onClick={onToggleEnabled}
            aria-pressed={enabled}
            className={`h-10 w-10 rounded-full border-2 shadow-lg active:scale-95 flex items-center justify-center text-xs text-black font-bold ${enabled ? "border-emerald-200 bg-emerald-300" : "border-zinc-400 bg-gradient-to-b from-zinc-300 to-zinc-500"}`}
          >
            {enabled ? "ON" : "OFF"}
          </button>
        </div>

        {/* Pedal 2: Analog Delay (Blue Boss style) */}
        <div className="w-40 h-52 rounded-xl bg-gradient-to-b from-sky-600 to-sky-800 border-2 border-sky-400/50 shadow-2xl p-3 flex flex-col justify-between items-center text-white">
          <span className="text-[11px] font-black tracking-widest text-sky-100">ANALOG DELAY</span>
          <div className="flex gap-2">
            <div className="text-center">
              <div className="h-7 w-7 rounded-full bg-zinc-900 border border-zinc-600 mx-auto" />
              <span className="text-[8px] font-bold">TIME</span>
            </div>
            <div className="text-center">
              <div className="h-7 w-7 rounded-full bg-zinc-900 border border-zinc-600 mx-auto" />
              <span className="text-[8px] font-bold">REPEAT</span>
            </div>
          </div>
          <button
            onClick={() => onSettingsChange({ ...settings, delay: settings.delay > 0 ? 0 : 0.25 })}
            aria-pressed={settings.delay > 0}
            className={`h-10 w-10 rounded-full border-2 shadow-lg active:scale-95 flex items-center justify-center text-xs text-black font-bold ${settings.delay > 0 ? "border-sky-200 bg-sky-300" : "border-zinc-400 bg-gradient-to-b from-zinc-300 to-zinc-500"}`}
          >
            {settings.delay > 0 ? "ON" : "OFF"}
          </button>
        </div>

        {/* Speaker Cabinet Toggle */}
        <div className="flex flex-col items-center gap-2 p-3 bg-zinc-900/60 rounded-xl border border-zinc-800">
          <span className="text-[10px] font-bold text-zinc-400">4x12 CAB SIM</span>
          <button
            onClick={() => onSettingsChange({ ...settings, cabSim: !settings.cabSim })}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition shadow ${
              settings.cabSim ? "bg-amber-500 text-black shadow-amber-500/40" : "bg-zinc-800 text-zinc-500"
            }`}
          >
            {settings.cabSim ? "CAB: ON" : "CAB: BYPASS"}
          </button>
        </div>

      </div>

    </div>
  );
}
