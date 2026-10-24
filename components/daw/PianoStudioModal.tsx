// components/daw/PianoStudioModal.tsx
"use client";
import React, { useEffect, useState, useRef, useCallback } from "react";
import { PianoEngine, PianoPresetType } from "@/lib/daw/PianoEngine";
import { SynthSettings } from "@/lib/AudioEngine";

interface PianoStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  ctx: AudioContext;
  trackName: string;
  outputNode?: AudioNode;
  synthSettings?: SynthSettings;
  onRecordMidiNote?: (pitch: number, velocity: number, isNoteOn: boolean) => void;
}

const PIANO_PRESETS: { name: PianoPresetType; desc: string; icon: string }[] = [
  { name: "Concert Grand", desc: "Steinway D style grand piano with warm resonance", icon: "🎹" },
  { name: "Studio Upright", desc: "Intimate and punchy upright piano tone", icon: "🎙️" },
  { name: "Felt Piano", desc: "Ultra-soft muted felt hammers for cinematic music", icon: "✨" },
  { name: "Classic Tine EP", desc: "Vintage 1973 Rhodes bell-like electric piano", icon: "⚡" },
  { name: "FM Digital Piano", desc: "Crystalline 80s DX7 digital bell piano", icon: "🎛️" },
  { name: "Ambient Cinematic Piano", desc: "Long-decay reverberant atmospheric piano", icon: "🌌" },
];

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

const KEYBOARD_MAP: Record<string, number> = {
  a: 48, w: 49, s: 50, e: 51, d: 52, f: 53, t: 54, g: 55, y: 56, h: 57, u: 58, j: 59,
  k: 60, o: 61, l: 62, p: 63, ";": 64, "'": 65,
};

export function PianoStudioModal({
  isOpen,
  onClose,
  ctx,
  trackName,
  outputNode,
  synthSettings,
  onRecordMidiNote,
}: PianoStudioModalProps) {
  const engine = useRef<PianoEngine>(PianoEngine.getInstance());
  const [selectedPreset, setSelectedPreset] = useState<PianoPresetType>("Concert Grand");
  const [currentOctave, setCurrentOctave] = useState<number>(3);
  const [sustainOn, setSustainOn] = useState<boolean>(false);
  const [activePitches, setActivePitches] = useState<Set<number>>(new Set());
  const [velocity, setVelocity] = useState<number>(105);

  const pianoKeys = Array.from({ length: 88 }, (_, i) => {
    const pitch = i + 21;
    const noteIndex = pitch % 12;
    const octave = Math.floor(pitch / 12) - 1;
    const isBlack = NOTE_NAMES[noteIndex].includes("#");
    return {
      pitch,
      name: `${NOTE_NAMES[noteIndex]}${octave}`,
      isBlack,
      octave,
    };
  });

  const triggerNoteOn = useCallback((pitch: number) => {
    engine.current.noteOn(ctx, pitch, velocity, selectedPreset, outputNode, synthSettings);
    setActivePitches((prev) => new Set(prev).add(pitch));
    if (onRecordMidiNote) onRecordMidiNote(pitch, velocity, true);
  }, [ctx, velocity, selectedPreset, outputNode, synthSettings, onRecordMidiNote]);

  const triggerNoteOff = useCallback((pitch: number) => {
    engine.current.noteOff(ctx, pitch);
    if (onRecordMidiNote) onRecordMidiNote(pitch, velocity, false);
    setActivePitches((prev) => {
      const next = new Set(prev);
      next.delete(pitch);
      return next;
    });
  }, [ctx, velocity, onRecordMidiNote]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT") return;

      const key = e.key.toLowerCase();

      if (key === "z") {
        setCurrentOctave((o) => Math.max(1, o - 1));
        return;
      }
      if (key === "x") {
        setCurrentOctave((o) => Math.min(6, o + 1));
        return;
      }

      if (e.code === "Tab" || e.code === "ShiftLeft") {
        e.preventDefault();
        setSustainOn(true);
        engine.current.setSustainPedal(ctx, true);
        return;
      }

      if (KEYBOARD_MAP[key] !== undefined) {
        const basePitch = KEYBOARD_MAP[key];
        const octaveOffset = (currentOctave - 3) * 12;
        const finalPitch = basePitch + octaveOffset;
        triggerNoteOn(finalPitch);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;

      const key = e.key.toLowerCase();

      if (e.code === "Tab" || e.code === "ShiftLeft") {
        setSustainOn(false);
        engine.current.setSustainPedal(ctx, false);
        return;
      }

      if (KEYBOARD_MAP[key] !== undefined) {
        const basePitch = KEYBOARD_MAP[key];
        const octaveOffset = (currentOctave - 3) * 12;
        const finalPitch = basePitch + octaveOffset;
        triggerNoteOff(finalPitch);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      engine.current.releaseAllNotes(ctx);
    };
  }, [isOpen, ctx, currentOctave, triggerNoteOn, triggerNoteOff]);

  const playChord = (rootPitch: number, type: "maj" | "min" | "7th") => {
    const intervals = type === "maj" ? [0, 4, 7] : type === "min" ? [0, 3, 7] : [0, 4, 7, 10];
    intervals.forEach((interval) => {
      triggerNoteOn(rootPitch + interval);
    });
    setTimeout(() => {
      intervals.forEach((interval) => {
        triggerNoteOff(rootPitch + interval);
      });
    }, 700);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 font-sans select-none">
      <div className="w-full max-w-4xl rounded-2xl border-2 border-[#20222a] bg-[#14151b] shadow-2xl overflow-hidden flex flex-col text-zinc-300">
        
        {/* TOP HEADER */}
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
                <option key={p.name} value={p.name}>
                  {p.icon} {p.name}
                </option>
              ))}
            </select>
          </div>

          <button onClick={onClose} className="h-6 w-6 rounded hover:bg-red-500 text-zinc-400 hover:text-white flex items-center justify-center font-bold text-xs">
            ✕
          </button>
        </div>

        {/* MUSICAL TYPING COMPUTER KEYBOARD */}
        <div className="p-4 bg-[#0d0e12] border-b border-zinc-800/80 flex flex-col items-center">
          <div className="flex justify-between w-full max-w-2xl mb-2 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-zinc-400">Octave:</span>
              <button
                onClick={() => setCurrentOctave((o) => Math.max(1, o - 1))}
                className="px-2 py-0.5 rounded bg-zinc-800 font-bold hover:bg-zinc-700 text-white"
              >
                Z (-)
              </button>
              <span className="font-mono font-bold text-[#d4af37] px-1">C{currentOctave}</span>
              <button
                onClick={() => setCurrentOctave((o) => Math.min(6, o + 1))}
                className="px-2 py-0.5 rounded bg-zinc-800 font-bold hover:bg-zinc-700 text-white"
              >
                X (+)
              </button>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  const next = !sustainOn;
                  setSustainOn(next);
                  engine.current.setSustainPedal(ctx, next);
                }}
                className={`px-3 py-0.5 rounded text-[11px] font-bold border transition ${
                  sustainOn ? "border-amber-400 bg-amber-400/20 text-amber-300 shadow-[0_0_8px_#f59e0b]" : "border-zinc-700 bg-zinc-800 text-zinc-400"
                }`}
              >
                Sustain Pedal (Tab): {sustainOn ? "ON" : "OFF"}
              </button>

              <div className="flex items-center gap-1.5 text-[11px]">
                <span className="text-zinc-500">Velocity:</span>
                <input
                  type="range"
                  min={20}
                  max={127}
                  value={velocity}
                  onChange={(e) => setVelocity(Number(e.target.value))}
                  className="w-16 accent-[#d4af37] h-1 bg-zinc-800 rounded"
                />
              </div>
            </div>
          </div>

          <div className="p-2.5 rounded-xl border border-zinc-800 bg-[#14151c] flex flex-col gap-1 shadow-inner">
            <div className="flex justify-center gap-1 pl-4">
              {["w", "e", null, "t", "y", "u", null, "o", "p"].map((k, idx) =>
                k ? (
                  <div
                    key={idx}
                    className={`h-8 w-8 rounded flex flex-col items-center justify-center font-mono font-bold text-[10px] border shadow transition ${
                      activePitches.has((KEYBOARD_MAP[k] || 0) + (currentOctave - 3) * 12)
                        ? "bg-[#d4af37] text-black border-[#d4af37]"
                        : "bg-black text-zinc-400 border-zinc-700"
                    }`}
                  >
                    <span className="uppercase">{k}</span>
                  </div>
                ) : (
                  <div key={idx} className="w-8" />
                )
              )}
            </div>

            <div className="flex justify-center gap-1">
              {["a", "s", "d", "f", "g", "h", "j", "k", "l", ";"].map((k) => (
                <div
                  key={k}
                  className={`h-10 w-8 rounded flex flex-col items-center justify-end pb-1 font-mono font-bold text-[10px] border shadow transition ${
                    activePitches.has((KEYBOARD_MAP[k] || 0) + (currentOctave - 3) * 12)
                      ? "bg-[#d4af37] text-black border-[#d4af37]"
                      : "bg-zinc-200 text-zinc-800 border-zinc-400"
                  }`}
                >
                  <span className="uppercase">{k}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 88-KEY STRIP */}
        <div className="p-4 bg-[#090a0d] overflow-x-auto flex flex-col items-center">
          <p className="text-[10px] text-zinc-500 mb-1.5">Interactive Full-Range Piano (Scroll & click keys to play):</p>
          
          <div className="relative flex h-40 select-none bg-black p-1 rounded-b border border-zinc-800 shadow-2xl">
            {pianoKeys.map((k) => {
              if (k.isBlack) return null;
              const isPressed = activePitches.has(k.pitch);

              return (
                <button
                  key={k.pitch}
                  onPointerDown={() => triggerNoteOn(k.pitch)}
                  onPointerUp={() => triggerNoteOff(k.pitch)}
                  onPointerLeave={() => triggerNoteOff(k.pitch)}
                  className={`relative w-8 h-full rounded-b border flex flex-col justify-end pb-1.5 items-center text-[8px] font-bold transition shadow ${
                    isPressed
                      ? "bg-[#d4af37] text-black border-[#d4af37]"
                      : "border-zinc-400 bg-gradient-to-b from-zinc-100 to-zinc-300 text-zinc-800 hover:to-white"
                  }`}
                >
                  {k.pitch % 12 === 0 && <span className="font-mono text-zinc-500">{k.name}</span>}
                </button>
              );
            })}

            <div className="absolute top-1 left-1 flex pointer-events-none">
              {pianoKeys.map((k, idx) => {
                if (!k.isBlack) return <div key={idx} className="w-8 pointer-events-none" />;
                const isPressed = activePitches.has(k.pitch);

                return (
                  <button
                    key={k.pitch}
                    onPointerDown={() => triggerNoteOn(k.pitch)}
                    onPointerUp={() => triggerNoteOff(k.pitch)}
                    onPointerLeave={() => triggerNoteOff(k.pitch)}
                    style={{ marginLeft: "-13px", marginRight: "-13px" }}
                    className={`pointer-events-auto z-10 w-6 h-24 rounded-b border text-[7px] font-bold flex flex-col justify-end pb-1 items-center shadow-lg transition ${
                      isPressed
                        ? "bg-[#d4af37] text-black border-[#d4af37]"
                        : "border-black bg-gradient-to-b from-zinc-800 to-black text-zinc-400"
                    }`}
                  >
                    {k.name}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* CHORD ASSIST */}
        <div className="p-3 border-t border-zinc-800 bg-[#161720] flex items-center justify-between text-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Chord Assist</span>
          <div className="flex gap-2">
            {[
              { name: "C Major", root: 60, type: "maj" as const },
              { name: "G Major", root: 67, type: "maj" as const },
              { name: "A Minor", root: 57, type: "min" as const },
              { name: "F Major", root: 65, type: "maj" as const },
              { name: "D Minor 7", root: 62, type: "7th" as const },
            ].map((chord) => (
              <button
                key={chord.name}
                onClick={() => playChord(chord.root, chord.type)}
                className="px-2.5 py-1 rounded bg-[#22242e] border border-zinc-700 hover:border-[#d4af37] text-white text-[11px] font-semibold shadow-sm active:scale-95 transition"
              >
                {chord.name}
              </button>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
