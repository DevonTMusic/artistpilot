// components/daw/PianoStudioModal.tsx
"use client";
import React, { useEffect, useState, useRef, useCallback } from "react";
import { PianoEngine, PianoPresetType } from "@/lib/daw/PianoEngine";
import { SynthSettings } from "@/lib/AudioEngine";
import { useLanguage } from "@/components/LanguageProvider";

interface PianoStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  ctx: AudioContext;
  trackName: string;
  outputNode?: AudioNode;
  synthSettings?: SynthSettings;
  projectKey?: string;
  scale?: "maj" | "min";
  onRecordMidiNote?: (pitch: number, velocity: number, isNoteOn: boolean) => void;
}

const PIANO_PRESETS: { name: PianoPresetType; desc: string }[] = [
  { name: "Concert Grand", desc: "Warm, resonant concert grand" },
  { name: "Studio Upright", desc: "Intimate, punchy upright tone" },
  { name: "Felt Piano", desc: "Soft muted felt tone" },
  { name: "Classic Tine EP", desc: "Bell-like electric piano" },
  { name: "FM Digital Piano", desc: "Bright digital piano" },
  { name: "Ambient Cinematic Piano", desc: "Long-decay atmospheric piano" },
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
  projectKey = "C",
  scale = "maj",
  onRecordMidiNote,
}: PianoStudioModalProps) {
  const { t } = useLanguage();
  const engine = useRef<PianoEngine>(PianoEngine.getInstance());
  const [selectedPreset, setSelectedPreset] = useState<PianoPresetType>("Concert Grand");
  const [currentOctave, setCurrentOctave] = useState<number>(3);
  const [sustainOn, setSustainOn] = useState<boolean>(false);
  const [activePitches, setActivePitches] = useState<Set<number>>(new Set());
  const [velocity, setVelocity] = useState<number>(105);
  const [scaleLock, setScaleLock] = useState(false);
  const [chordMode, setChordMode] = useState(false);
  const [chordQuality, setChordQuality] = useState<"triad" | "7th" | "9th">("triad");
  const activeChordNotes = useRef(new Map<number, number[]>());
  const rootPitchClass = ({ C: 0, "D♭": 1, D: 2, "E♭": 3, E: 4, F: 5, "F#": 6, G: 7, "A♭": 8, A: 9, "B♭": 10, B: 11 } as Record<string, number>)[projectKey] ?? 0;
  const scaleIntervals = scale === "maj" ? [0, 2, 4, 5, 7, 9, 11] : [0, 2, 3, 5, 7, 8, 10];
  const scalePitchClasses = new Set(scaleIntervals.map((interval) => (rootPitchClass + interval) % 12));

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
    const root = scaleLock
      ? Array.from({ length: 13 }, (_, index) => pitch - 6 + index)
        .filter((candidate) => scalePitchClasses.has(candidate % 12))
        .sort((left, right) => Math.abs(left - pitch) - Math.abs(right - pitch))[0] ?? pitch
      : pitch;
    const rootOffset = (root - rootPitchClass + 120) % 12;
    const degree = scaleIntervals.reduce((closest, interval, index) =>
      Math.abs(interval - rootOffset) < Math.abs(scaleIntervals[closest] - rootOffset) ? index : closest, 0);
    const diatonicSteps = chordQuality === "triad" ? [0, 2, 4] : chordQuality === "7th" ? [0, 2, 4, 6] : [0, 2, 4, 6, 8];
    const pitches = chordMode ? diatonicSteps.map((step) => {
      const targetDegree = degree + step;
      const semitones = scaleIntervals[targetDegree % 7] - scaleIntervals[degree] + Math.floor(targetDegree / 7) * 12;
      return root + semitones;
    }) : [root];
    activeChordNotes.current.set(pitch, pitches);
    pitches.forEach((notePitch) => {
      engine.current.noteOn(ctx, notePitch, velocity, selectedPreset, outputNode, synthSettings);
      if (onRecordMidiNote) onRecordMidiNote(notePitch, velocity, true);
    });
    setActivePitches((prev) => new Set([...prev, ...pitches]));
  }, [ctx, velocity, selectedPreset, outputNode, synthSettings, onRecordMidiNote, scaleLock, scalePitchClasses, rootPitchClass, scaleIntervals, chordMode, chordQuality]);

  const triggerNoteOff = useCallback((pitch: number) => {
    const pitches = activeChordNotes.current.get(pitch) ?? [pitch];
    pitches.forEach((notePitch) => {
      engine.current.noteOff(ctx, notePitch);
      if (onRecordMidiNote) onRecordMidiNote(notePitch, velocity, false);
    });
    activeChordNotes.current.delete(pitch);
    setActivePitches((prev) => {
      const next = new Set(prev);
      pitches.forEach((notePitch) => next.delete(notePitch));
      return next;
    });
  }, [ctx, velocity, onRecordMidiNote]);

  useEffect(() => {
    void engine.current.preload(ctx);
  }, [ctx]);

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

  const playChord = (degree: number) => {
    const rootPitch = 60 + rootPitchClass + scaleIntervals[degree];
    const steps = chordQuality === "triad" ? [0, 2, 4] : chordQuality === "7th" ? [0, 2, 4, 6] : [0, 2, 4, 6, 8];
    const pitches = steps.map((step) => {
      const targetDegree = degree + step;
      return rootPitch + scaleIntervals[targetDegree % 7] - scaleIntervals[degree] + Math.floor(targetDegree / 7) * 12;
    });
    pitches.forEach((pitch) => {
      engine.current.noteOn(ctx, pitch, velocity, selectedPreset, outputNode, synthSettings);
      if (onRecordMidiNote) onRecordMidiNote(pitch, velocity, true);
    });
    setTimeout(() => {
      pitches.forEach((pitch) => {
        engine.current.noteOff(ctx, pitch);
        if (onRecordMidiNote) onRecordMidiNote(pitch, velocity, false);
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
              {t("pianoStudio.title")} <span className="text-[#d4af37]">{trackName}</span>
            </span>

            <select
              value={selectedPreset}
              onChange={(e) => setSelectedPreset(e.target.value as PianoPresetType)}
              className="bg-[#0e0f14] border border-zinc-700 text-xs font-semibold text-white rounded px-2.5 py-1 focus:outline-none focus:ring-1 focus:ring-[#d4af37]"
            >
              {PIANO_PRESETS.map((p) => (
                <option key={p.name} value={p.name}>
                  {p.name}
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
              <span className="text-zinc-400">{t("pianoStudio.octave")}</span>
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
                {t("pianoStudio.sustain")} {sustainOn ? t("track.on") : t("track.off")}
              </button>

              <div className="flex items-center gap-1.5 text-[11px]">
                <span className="text-zinc-500">{t("pianoStudio.velocity")}</span>
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

          <div className="mb-2 flex w-full max-w-2xl flex-wrap items-center gap-2">
            <button
              onClick={() => setScaleLock((enabled) => !enabled)}
              aria-pressed={scaleLock}
              className={`rounded px-2 py-1 text-[10px] font-semibold ${scaleLock ? "bg-emerald-700 text-white" : "bg-zinc-800 text-zinc-300"}`}
              title={t("pianoStudio.scaleHelp", { key: projectKey, scale: t(scale === "maj" ? "music.major" : "music.minor") })}
            >
              {t("pianoStudio.scaleLock")} {scaleLock ? t("pianoRoll.on") : t("pianoRoll.off")}
            </button>
            <button
              onClick={() => setChordMode((enabled) => !enabled)}
              aria-pressed={chordMode}
              className={`rounded px-2 py-1 text-[10px] font-semibold ${chordMode ? "bg-violet-700 text-white" : "bg-zinc-800 text-zinc-300"}`}
            >
              {t("pianoStudio.chordMode")} {chordMode ? t("pianoRoll.on") : t("pianoRoll.off")}
            </button>
            <label className="flex items-center gap-1 text-[10px] text-zinc-400">
              {t("pianoStudio.chordSize")}
              <select value={chordQuality} onChange={(event) => setChordQuality(event.target.value as typeof chordQuality)} className="rounded bg-zinc-900 px-1.5 py-1 text-zinc-200">
                <option value="triad">{t("pianoStudio.triad")}</option>
                <option value="7th">{t("pianoStudio.seventh")}</option>
                <option value="9th">{t("pianoStudio.ninth")}</option>
              </select>
            </label>
            <span className="text-[10px] text-emerald-300 capitalize">{projectKey} {t(scale === "maj" ? "music.major" : "music.minor")}</span>
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

        {/* Full-range keyboard with standard white/black key geometry */}
        <div className="bg-[#090a0d] px-4 py-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[10px] text-zinc-500">{t("pianoStudio.pianoRange")}</p>
            <p className="text-[10px] text-zinc-600">{t("pianoStudio.clickPlay")}</p>
          </div>
          <div className="overflow-x-auto rounded-b border border-zinc-700 bg-[#050505] p-1 shadow-2xl">
            <div className="relative flex h-40 w-max touch-none">
              {pianoKeys.filter((key) => !key.isBlack).map((key) => {
                const isPressed = activePitches.has(key.pitch);
                return (
                  <button
                    key={key.pitch}
                    type="button"
                    aria-label={t("pianoStudio.playKey", { note: key.name })}
                    onPointerDown={(event) => {
                      event.currentTarget.setPointerCapture(event.pointerId);
                      triggerNoteOn(key.pitch);
                    }}
                    onPointerUp={() => triggerNoteOff(key.pitch)}
                    onPointerCancel={() => triggerNoteOff(key.pitch)}
                    onLostPointerCapture={() => triggerNoteOff(key.pitch)}
                    className={`relative h-full w-8 flex-none rounded-b border border-x-zinc-400 border-b-zinc-500 transition ${
                      isPressed
                        ? "bg-amber-300"
                        : scaleLock && !scalePitchClasses.has(key.pitch % 12)
                          ? "bg-zinc-400 opacity-30"
                          : scalePitchClasses.has(key.pitch % 12)
                            ? "bg-gradient-to-b from-emerald-50 via-white to-zinc-200"
                            : "bg-gradient-to-b from-white via-zinc-100 to-zinc-300 hover:from-white hover:to-white"
                    }`}
                  >
                    {key.pitch % 12 === 0 && (
                      <span className="pointer-events-none absolute bottom-1 left-0 w-full text-center font-mono text-[8px] font-semibold text-zinc-500">
                        {key.name}
                      </span>
                    )}
                  </button>
                );
              })}
              {pianoKeys.filter((key) => key.isBlack).map((key) => {
                const precedingWhiteKeys = pianoKeys.filter((candidate) => !candidate.isBlack && candidate.pitch < key.pitch).length;
                const isPressed = activePitches.has(key.pitch);
                return (
                  <button
                    key={key.pitch}
                    type="button"
                    aria-label={t("pianoStudio.playKey", { note: key.name })}
                    onPointerDown={(event) => {
                      event.currentTarget.setPointerCapture(event.pointerId);
                      triggerNoteOn(key.pitch);
                    }}
                    onPointerUp={() => triggerNoteOff(key.pitch)}
                    onPointerCancel={() => triggerNoteOff(key.pitch)}
                    onLostPointerCapture={() => triggerNoteOff(key.pitch)}
                    style={{ left: `${precedingWhiteKeys * 32 - 11}px` }}
                    className={`absolute top-0 z-10 h-[62%] w-[22px] rounded-b border border-black shadow-[0_3px_5px_rgba(0,0,0,0.55)] ${
                      isPressed
                        ? "bg-amber-400"
                        : scaleLock && !scalePitchClasses.has(key.pitch % 12)
                          ? "bg-black opacity-25"
                          : scalePitchClasses.has(key.pitch % 12)
                            ? "bg-gradient-to-b from-emerald-700 via-emerald-900 to-black"
                            : "bg-gradient-to-b from-zinc-700 via-zinc-900 to-black hover:from-zinc-600"
                    }`}
                  />
                );
              })}
            </div>
          </div>
        </div>

        {/* CHORD ASSIST */}
        <div className="p-3 border-t border-zinc-800 bg-[#161720] flex items-center justify-between text-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">{t("pianoStudio.chordPads")}</span>
          <div className="flex gap-2 overflow-x-auto">
            {scaleIntervals.slice(0, 5).map((interval, degree) => (
              <button
                key={degree}
                onClick={() => playChord(degree)}
                className="px-2.5 py-1 rounded bg-[#22242e] border border-zinc-700 hover:border-[#d4af37] text-white text-[11px] font-semibold shadow-sm active:scale-95 transition"
              >
                {["I", "II", "III", "IV", "V"][degree]} · {NOTE_NAMES[(rootPitchClass + interval) % 12]}
              </button>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
