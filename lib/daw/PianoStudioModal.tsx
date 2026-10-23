// components/daw/PianoStudioModal.tsx
"use client";
import React, { useEffect, useState, useRef, useCallback } from "react";
import { PianoEngine, PianoPresetType } from "@/lib/daw/PianoEngine";

interface PianoStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  ctx: AudioContext;
  trackName: string;
}

const PIANO_PRESETS: { name: PianoPresetType; desc: string; icon: string }[] = [
  { name: "Concert Grand", desc: "Acoustic concert grand with dynamic hammer strike", icon: "🎹" },
  { name: "Studio Upright", desc: "Warm intimate upright piano tone", icon: "🎙️" },
  { name: "Felt Piano", desc: "Soft cinematic muted felt piano", icon: "✨" },
  { name: "Classic Tine EP", desc: "Vintage bell-like electric piano", icon: "⚡" },
];

// Natural acoustic piano key layout across full octaves (C1 to C7)
const NATURAL_OCTAVES = [1, 2, 3, 4, 5, 6];
const WHITE_NOTES = ["C", "D", "E", "F", "G", "A", "B"];
// Pattern: C#(1), D#(2), gap, F#(4), G#(5), A#(6), gap
const BLACK_KEY_OFFSETS: Record<number, number> = { 0: 0, 1: 1, 3: 3, 4: 4, 5: 5 };

const KEYBOARD_MAP: Record<string, number> = {
  a: 48, w: 49, s: 50, e: 51, d: 52, f: 53, t: 54, g: 55, y: 56, h: 57, u: 58, j: 59,
  k: 60, o: 61, l: 62, p: 63, ";": 64, "'": 65,
};

export function PianoStudioModal({ isOpen, onClose, ctx, trackName }: PianoStudioModalProps) {
  const engine = useRef<PianoEngine>(PianoEngine.getInstance());
  const [selectedPreset, setSelectedPreset] = useState<PianoPresetType>("Concert Grand");
  const [currentOctave, setCurrentOctave] = useState<number>(3);
  const [sustainOn, setSustainOn] = useState<boolean>(false);
  const [activePitches, setActivePitches] = useState<Set<number>>(new Set());
  const [velocity, setVelocity] = useState<number>(105);

  const triggerNoteOn = useCallback((pitch: number) => {
    engine.current.noteOn(ctx, pitch, velocity, selectedPreset);
    setActivePitches((prev) => new Set(prev).add(pitch));
  }, [ctx, velocity, selectedPreset]);

  const triggerNoteOff = useCallback((pitch: number) => {
    engine.current.noteOff(ctx, pitch);
    setActivePitches((prev) => {
      const next = new Set(prev);
      next.delete(pitch);
      return next;
    });
  }, [ctx]);

  // Musical Typing Listeners (ISOLATED: Never triggers studio record keybinds)
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT") return;

      const key = e.key.toLowerCase();

      // Octave Shift
      if (key === "z") {
        setCurrentOctave((o) => Math.max(1, o - 1));
        return;
      }
      if (key === "x") {
        setCurrentOctave((o) => Math.min(6, o + 1));
        return;
      }

      // Sustain Pedal
      if (e.code === "Tab" || e.code === "ShiftLeft") {
        e.preventDefault();
        setSustainOn(true);
        engine.current.setSustainPedal(ctx, true);
        return;
      }

      // Note Playing
      if (KEYBOARD_MAP[key] !== undefined) {
        e.preventDefault();
        e.stopPropagation(); // Prevents 'r', 'c', 'space' from hitting the DAW transport!
        const basePitch = KEYBOARD_MAP[key];
        const octaveOffset = (currentOctave - 3) * 12;
        triggerNoteOn(basePitch + octaveOffset);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (e.code === "Tab" || e.code === "ShiftLeft") {
        setSustainOn(false);
        engine.current.setSustainPedal(ctx, false);
        return;
      }
      if (KEYBOARD_MAP[key] !== undefined) {
        e.preventDefault();
        e.stopPropagation();
        const basePitch = KEYBOARD_MAP[key];
        const octaveOffset = (currentOctave - 3) * 12;
        triggerNoteOff(basePitch + octaveOffset);
      }
    };

    window.addEventListener("keydown", handleKeyDown, { capture: true });
    window.addEventListener("keyup", handleKeyUp, { capture: true });
    return () => {
      window.removeEventListener("keydown", handleKeyDown, { capture: true });
      window.removeEventListener("keyup", handleKeyUp, { capture: true });
      engine.current.releaseAllNotes(ctx);
    };
  }, [isOpen, ctx, currentOctave, triggerNoteOn, triggerNoteOff]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 font-sans select-none">
      <div className="w-full max-w-4xl rounded-2xl border-2 border-[#20222a] bg-[#14151b] shadow-2xl overflow-hidden flex flex-col text-zinc-300">
        
        {/* HEADER */}
        <div className="flex h-11 items-center justify-between border-b border-zinc-800 bg-[#1c1e26] px-4">
          <div className="flex items-center gap-3">
            <span className="text-sm font-bold text-white flex items-center gap-1.5">
              <span>🎹</span> Piano Studio — <span className="text-[#d4af37]">{trackName}</span>
            </span>

            <select
              value={selectedPreset}
              onChange={(e) => setSelectedPreset(e.target.value as PianoPresetType)}
              className="bg-[#0e0f14] border border-zinc-700 text-xs font-semibold text-white rounded px-2.5 py-1 focus:outline-none focus:ring-1 focus:ring-[#d4af37]"
            >
              {PIANO_PRESETS.map((p) => (
                <option key={p.name} value={p.name}>{p.icon} {p.name}</option>
              ))}
            </select>
          </div>

          <button onClick={onClose} className="h-6 w-6 rounded hover:bg-red-500 text-zinc-400 hover:text-white flex items-center justify-center font-bold text-xs">
            ✕
          </button>
        </div>

        {/* CONTROLS */}
        <div className="p-3 bg-[#0d0e12] border-b border-zinc-800 flex items-center justify-between text-xs px-6">
          <div className="flex items-center gap-2">
            <span className="text-zinc-400">Octave:</span>
            <button onClick={() => setCurrentOctave((o) => Math.max(1, o - 1))} className="px-2 py-0.5 rounded bg-zinc-800 font-bold hover:bg-zinc-700 text-white">Z (-)</button>
            <span className="font-mono font-bold text-[#d4af37] px-1">C{currentOctave}</span>
            <button onClick={() => setCurrentOctave((o) => Math.min(6, o + 1))} className="px-2 py-0.5 rounded bg-zinc-800 font-bold hover:bg-zinc-700 text-white">X (+)</button>
          </div>

          <button
            onClick={() => {
              const next = !sustainOn;
              setSustainOn(next);
              engine.current.setSustainPedal(ctx, next);
            }}
            className={`px-3 py-1 rounded text-xs font-bold border transition ${
              sustainOn ? "border-amber-400 bg-amber-400/20 text-amber-300 shadow-[0_0_8px_#f59e0b]" : "border-zinc-700 bg-zinc-800 text-zinc-400"
            }`}
          >
            Sustain Pedal (Tab): {sustainOn ? "ON" : "OFF"}
          </button>
        </div>

        {/* ACCURATE ACOUSTIC 88-KEY STRIP WITH AUTHENTIC BLACK KEY GAPS */}
        <div className="p-4 bg-[#090a0d] overflow-x-auto flex justify-center">
          <div className="relative flex select-none bg-black p-1 rounded border border-zinc-800 shadow-2xl">
            {NATURAL_OCTAVES.map((octave) => (
              <div key={octave} className="relative flex">
                {/* 7 White Keys per octave */}
                {WHITE_NOTES.map((note, noteIdx) => {
                  const pitch = (octave + 1) * 12 + [0, 2, 4, 5, 7, 9, 11][noteIdx];
                  const isPressed = activePitches.has(pitch);

                  return (
                    <button
                      key={note}
                      onPointerDown={() => triggerNoteOn(pitch)}
                      onPointerUp={() => triggerNoteOff(pitch)}
                      className={`w-8 h-40 rounded-b border flex flex-col justify-end pb-1.5 items-center text-[8px] font-bold transition ${
                        isPressed
                          ? "bg-[#d4af37] text-black border-[#d4af37]"
                          : "border-zinc-400 bg-gradient-to-b from-zinc-100 to-zinc-300 text-zinc-800 hover:to-white"
                      }`}
                    >
                      {note === "C" && <span className="font-mono text-zinc-500">C{octave}</span>}
                    </button>
                  );
                })}

                {/* Black Keys with true physical spacing (2 black, gap, 3 black, gap) */}
                {[
                  { name: "C#", pitch: (octave + 1) * 12 + 1, left: 21 },
                  { name: "D#", pitch: (octave + 1) * 12 + 3, left: 53 },
                  // Gap between E and F
                  { name: "F#", pitch: (octave + 1) * 12 + 6, left: 117 },
                  { name: "G#", pitch: (octave + 1) * 12 + 8, left: 149 },
                  { name: "A#", pitch: (octave + 1) * 12 + 10, left: 181 },
                  // Gap between B and C
                ].map((bk) => {
                  const isPressed = activePitches.has(bk.pitch);
                  return (
                    <button
                      key={bk.name}
                      onPointerDown={() => triggerNoteOn(bk.pitch)}
                      onPointerUp={() => triggerNoteOff(bk.pitch)}
                      style={{ left: `${bk.left}px` }}
                      className={`absolute top-0 w-5 h-24 rounded-b border text-[7px] font-bold flex flex-col justify-end pb-1 items-center z-10 transition ${
                        isPressed
                          ? "bg-[#d4af37] text-black border-[#d4af37]"
                          : "border-black bg-gradient-to-b from-zinc-800 to-black text-zinc-400"
                      }`}
                    >
                      {bk.name}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
