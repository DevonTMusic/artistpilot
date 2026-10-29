// components/daw/PianoRoll.tsx
"use client";
import React, { useEffect, useState } from "react";
import { SynthSettings } from "@/lib/AudioEngine";
import { useLanguage } from "@/components/LanguageProvider";

export interface MidiNote {
  id: string;
  pitch: number;    // MIDI note (60 = C4)
  startStep: number; // 0 to 31 (16th note steps)
  length: number;    // Duration in steps
  velocity?: number; // 1 to 127
}

interface PianoRollProps {
  notes: MidiNote[];
  instrumentName: string;
  projectKey?: string;
  scale?: "maj" | "min";
  onAddNote: (note: MidiNote) => void;
  onDeleteNote: (id: string) => void;
  onPreviewNote: (pitch: number) => void;
  onUpdateNotes?: (notes: MidiNote[]) => void;
  synthSettings?: SynthSettings;
  onSynthSettingsChange?: (settings: SynthSettings) => void;
}

const PITCH_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const PITCHES = Array.from({ length: 85 }, (_, index) => 108 - index).map((pitch) => ({
  pitch,
  name: `${PITCH_NAMES[pitch % 12]}${Math.floor(pitch / 12) - 1}`,
  isBlack: [1, 3, 6, 8, 10].includes(pitch % 12),
}));

export function PianoRoll({
  notes,
  instrumentName,
  projectKey = "C",
  scale = "maj",
  onAddNote,
  onDeleteNote,
  onPreviewNote,
  onUpdateNotes,
  synthSettings,
  onSynthSettingsChange,
}: PianoRollProps) {
  const { t } = useLanguage();
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [quantizeStep, setQuantizeStep] = useState(1);
  const [scaleLock, setScaleLock] = useState(false);
  const [chordMode, setChordMode] = useState(false);
  const [synthControlsOpen, setSynthControlsOpen] = useState(false);
  const [noteDrag, setNoteDrag] = useState<{
    id: string;
    mode: "move" | "resize";
    x: number;
    y: number;
    note: MidiNote;
  } | null>(null);
  const rootPitchClass = ({ C: 0, "D♭": 1, D: 2, "E♭": 3, E: 4, F: 5, "F#": 6, G: 7, "A♭": 8, A: 9, "B♭": 10, B: 11 } as Record<string, number>)[projectKey] ?? 0;
  const scaleIntervals = scale === "maj" ? [0, 2, 4, 5, 7, 9, 11] : [0, 2, 3, 5, 7, 8, 10];
  const scalePitchClasses = new Set(scaleIntervals.map((interval) => (rootPitchClass + interval) % 12));
  const totalSteps = Math.max(32, Math.ceil((Math.max(0, ...notes.map((note) => note.startStep + note.length)) + 1) / 16) * 16);

  useEffect(() => {
    if (!noteDrag || !onUpdateNotes) return;
    const move = (event: PointerEvent) => {
      const stepDelta = Math.round((event.clientX - noteDrag.x) / 32);
      if (noteDrag.mode === "resize") {
        const length = Math.max(1, noteDrag.note.length + stepDelta);
        onUpdateNotes(notes.map((note) => note.id === noteDrag.id ? { ...note, length } : note));
      } else {
        const pitchDelta = Math.round((noteDrag.y - event.clientY) / 24);
        onUpdateNotes(notes.map((note) => note.id === noteDrag.id ? {
          ...note,
          startStep: Math.max(0, noteDrag.note.startStep + stepDelta),
          pitch: Math.max(24, Math.min(108, noteDrag.note.pitch + pitchDelta)),
        } : note));
      }
    };
    const up = (event: PointerEvent) => {
      if (noteDrag.mode === "move" &&
        Math.abs(event.clientX - noteDrag.x) < 4 &&
        Math.abs(event.clientY - noteDrag.y) < 4) {
        onDeleteNote(noteDrag.id);
      }
      setNoteDrag(null);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up, { once: true });
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, [noteDrag, notes, onDeleteNote, onUpdateNotes]);

  const handleCellClick = (pitch: number, step: number) => {
    const playablePitch = scaleLock
      ? Array.from({ length: 13 }, (_, index) => pitch - 6 + index)
        .filter((candidate) => scalePitchClasses.has(candidate % 12))
        .sort((a, b) => Math.abs(a - pitch) - Math.abs(b - pitch))[0] ?? pitch
      : pitch;
    const existing = notes.find((n) => n.pitch === playablePitch && n.startStep === step);
    if (existing) {
      onDeleteNote(existing.id);
    } else {
      const rootOffset = (playablePitch - rootPitchClass + 120) % 12;
      const degree = scaleIntervals.reduce((closest, interval, index) =>
        Math.abs(interval - rootOffset) < Math.abs(scaleIntervals[closest] - rootOffset) ? index : closest, 0
      );
      const thirdDegree = degree + 2;
      const fifthDegree = degree + 4;
      const third = scaleIntervals[thirdDegree % 7] - scaleIntervals[degree] + (thirdDegree >= 7 ? 12 : 0);
      const fifth = scaleIntervals[fifthDegree % 7] - scaleIntervals[degree] + (fifthDegree >= 7 ? 12 : 0);
      const uniquePitches = chordMode
        ? [playablePitch, playablePitch + third, playablePitch + fifth]
        : [playablePitch];
      uniquePitches.forEach((notePitch, index) => {
        onPreviewNote(notePitch);
        if (!notes.some((note) => note.pitch === notePitch && note.startStep === step)) {
          onAddNote({
            id: `note-${Date.now()}-${notePitch}-${step}-${index}`,
            pitch: notePitch,
            startStep: step,
            length: 2,
            velocity: 100,
          });
        }
      });
    }
  };

  // A step represents one sixteenth note.
  const quantizeNotes = (snapStep: number = 1) => {
    if (!onUpdateNotes) return;
    const quantized = notes.map((note) => {
      const startStep = Math.max(0, Math.round(note.startStep / snapStep) * snapStep);
      const endStep = Math.max(startStep + snapStep, Math.round((note.startStep + note.length) / snapStep) * snapStep);
      return { ...note, startStep, length: endStep - startStep };
    });
    onUpdateNotes(quantized);
  };

  const correctNotePitches = () => {
    if (!onUpdateNotes) return;
    const corrected = notes.map((note) => {
      const nearest = Array.from({ length: 13 }, (_, index) => note.pitch - 6 + index)
        .filter((pitch) => scalePitchClasses.has(pitch % 12))
        .sort((a, b) => Math.abs(a - note.pitch) - Math.abs(b - note.pitch))[0];
      return nearest === undefined ? note : { ...note, pitch: nearest };
    });
    onUpdateNotes(corrected);
  };

  // Transpose: Shifts notes up/down by semitones
  const transposeNotes = (semitones: number) => {
    if (!onUpdateNotes) return;
    const transposed = notes.map((n) => ({
      ...n,
      pitch: Math.max(21, Math.min(108, n.pitch + semitones)),
    }));
    onUpdateNotes(transposed);
  };

  return (
    <div className="flex h-full w-full flex-col bg-[#14151a] text-zinc-300 select-none">
      
      {/* Header with Quantize & Transpose Toolbar */}
      <div className="flex h-8 items-center justify-between border-b border-zinc-800 bg-[#1c1d24] px-4 text-xs font-semibold">
        <span className="text-zinc-200">
          {t("pianoRoll.title")} <span className="text-[#d4af37]">{instrumentName}</span>
        </span>

        <div className="flex items-center gap-2">
          {/* Quantize */}
          <button
            onClick={() => quantizeNotes(quantizeStep)}
            className="px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-[10px] text-white"
            title={t("pianoRoll.align", { grid: quantizeStep === 1 ? "1/16" : "1/8" })}
          >
            {t("pianoRoll.quantize")} ({quantizeStep === 1 ? "1/16" : "1/8"})
          </button>
          <select
            aria-label={t("pianoRoll.quantize")}
            value={quantizeStep}
            onChange={(event) => setQuantizeStep(Number(event.target.value))}
            className="rounded border border-zinc-700 bg-zinc-900 px-1 py-0.5 text-[10px]"
          >
            <option value={1}>1/16</option>
            <option value={2}>1/8</option>
          </select>
          <button
            onClick={() => setScaleLock((enabled) => !enabled)}
            aria-pressed={scaleLock}
            className={`rounded px-2 py-0.5 text-[10px] ${scaleLock ? "bg-sky-700 text-white" : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"}`}
            title={t("pianoRoll.scaleTitle", { key: projectKey, scale: t(scale === "maj" ? "music.major" : "music.minor") })}
          >
            {t("pianoRoll.scale")} {scaleLock ? t("pianoRoll.on") : t("pianoRoll.off")}
          </button>
          <button
            onClick={correctNotePitches}
            disabled={!notes.length || !onUpdateNotes}
            className="rounded bg-sky-900/70 px-2 py-0.5 text-[10px] text-sky-200 hover:bg-sky-800 disabled:opacity-40"
            title={t("pianoRoll.pitchTitle", { key: projectKey, scale: t(scale === "maj" ? "music.major" : "music.minor") })}
          >
            {t("pianoRoll.pitchCorrect")}
          </button>
          <button
            onClick={() => setChordMode((enabled) => !enabled)}
            aria-pressed={chordMode}
            className={`rounded px-2 py-0.5 text-[10px] ${chordMode ? "bg-amber-700 text-white" : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"}`}
            title={t("pianoRoll.chordTitle")}
          >
            {t("pianoRoll.chord")} {chordMode ? t("pianoRoll.on") : t("pianoRoll.off")}
          </button>
          {synthSettings && onSynthSettingsChange && (
            <button
              onClick={() => setSynthControlsOpen((open) => !open)}
              aria-expanded={synthControlsOpen}
              className={`rounded px-2 py-0.5 text-[10px] ${synthControlsOpen ? "bg-emerald-700 text-white" : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"}`}
            >
              {t("pianoRoll.synth")} {synthControlsOpen ? t("pianoRoll.hide") : t("track.controls")}
            </button>
          )}

          {/* Transpose */}
          <div className="flex items-center gap-1 border-l border-zinc-700 pl-2 text-[10px]">
            <span>{t("pianoRoll.transpose")}</span>
            <button onClick={() => transposeNotes(-1)} className="px-1.5 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700">-1</button>
            <button onClick={() => transposeNotes(1)} className="px-1.5 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700">+1</button>
            <button onClick={() => transposeNotes(12)} className="px-1.5 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700">+Oct</button>
          </div>
        </div>
      </div>

      {synthControlsOpen && synthSettings && onSynthSettingsChange && (
        <div className="grid grid-cols-2 gap-3 border-b border-zinc-800 bg-[#191a21] px-4 py-3 text-[10px] sm:grid-cols-4">
          <label className="text-zinc-400">{t("pianoRoll.waveform")}
            <select value={synthSettings.waveform} onChange={(event) => onSynthSettingsChange({ ...synthSettings, waveform: event.target.value as OscillatorType })} className="mt-1 block w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-white">
              {["sine", "square", "sawtooth", "triangle"].map((wave) => <option key={wave} value={wave}>{wave}</option>)}
            </select>
          </label>
          {([
            [t("pianoRoll.attack"), "attack", 0.001, 2, 0.001],
            [t("pianoRoll.decay"), "decay", 0.001, 2, 0.001],
            [t("pianoRoll.sustain"), "sustain", 0, 1, 0.01],
            [t("pianoRoll.release"), "release", 0.001, 3, 0.001],
            [t("pianoRoll.cutoff"), "cutoff", 40, 20000, 10],
            [t("pianoRoll.resonance"), "resonance", 0.1, 20, 0.1],
          ] as const).map(([label, key, min, max, step]) => (
            <label key={key} className="text-zinc-400">{label} · {synthSettings[key].toFixed(key === "cutoff" ? 0 : 2)}
              <input type="range" min={min} max={max} step={step} value={synthSettings[key]} onChange={(event) => onSynthSettingsChange({ ...synthSettings, [key]: Number(event.target.value) })} className="mt-2 block w-full accent-emerald-400" />
            </label>
          ))}
        </div>
      )}

      {/* Grid */}
      <div className="flex-1 overflow-y-auto flex">
        <div className="w-16 flex-none border-r border-zinc-800 bg-[#17181f]">
          {PITCHES.map((p) => (
            <button
              key={p.pitch}
              onClick={() => onPreviewNote(p.pitch)}
              className={`h-6 w-full border-b text-[10px] font-bold flex items-center justify-end pr-2 transition ${
                p.isBlack
                  ? "bg-[#1f2029] text-zinc-400 border-zinc-900 hover:bg-zinc-800"
                  : "bg-zinc-200 text-zinc-900 border-zinc-300 hover:bg-white"
              }`}
            >
              {p.name}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-x-auto bg-[#0f1013]">
          {PITCHES.map((p) => (
            <div key={p.pitch} className="flex h-6 border-b border-zinc-800/40">
              {Array.from({ length: totalSteps }, (_, step) => {
                const noteHere = notes.find((n) => n.pitch === p.pitch && n.startStep === step);
                const isBarStart = step % 16 === 0;
                const isBeatStart = step % 4 === 0;

                return (
                  <div
                    key={step}
                    onClick={() => handleCellClick(p.pitch, step)}
                    className={`relative h-full w-8 flex-none border-r cursor-pointer transition ${
                      isBarStart ? "border-zinc-600" : isBeatStart ? "border-zinc-700/60" : "border-zinc-800/40"
                    } ${p.isBlack ? "bg-zinc-900/40" : "bg-transparent"} hover:bg-amber-500/20 flex items-center p-0.5`}
                  >
                    {noteHere && (
                      <div
                        role="button"
                        tabIndex={0}
                        aria-label={`MIDI note ${noteHere.pitch}, starts at step ${noteHere.startStep + 1}, length ${noteHere.length}. Drag to move; drag edge to resize; click to delete.`}
                        onPointerDown={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          setSelectedNoteId(noteHere.id);
                          setNoteDrag({
                            id: noteHere.id,
                              mode: event.clientX >= event.currentTarget.getBoundingClientRect().right - 10 ? "resize" : "move",
                            x: event.clientX,
                            y: event.clientY,
                            note: noteHere,
                          });
                        }}
                        onClick={(event) => event.stopPropagation()}
                        style={{ width: `${Math.max(1, noteHere.length) * 32}px` }}
                        className={`absolute left-0 top-0 z-10 h-full rounded-sm border shadow-sm ${
                          selectedNoteId === noteHere.id ? "border-white bg-amber-400" : "border-amber-300 bg-gradient-to-r from-amber-400 to-[#d4af37]"
                        }`}
                      >
                        <span className="absolute right-0 top-0 h-full w-2 cursor-ew-resize bg-black/20" aria-hidden="true" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Velocity Lane */}
      <div className="h-16 flex-none border-t border-zinc-800 bg-[#111217] flex items-center px-4">
        <span className="text-[9px] font-bold text-zinc-500 mr-3">{t("pianoRoll.velocity")}</span>
        <div className="flex-1 flex gap-1 h-10 items-end">
          {notes.map((n) => (
            <div key={n.id} className="flex flex-col items-center flex-1">
              <div
                style={{ height: `${Math.round(((n.velocity || 100) / 127) * 36)}px` }}
                className="w-2 bg-gradient-to-t from-emerald-500 to-[#d4af37] rounded-t-sm"
              />
              <span className="text-[7px] font-mono text-zinc-400 mt-0.5">{n.velocity || 100}</span>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
