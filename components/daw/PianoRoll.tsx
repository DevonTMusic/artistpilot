// components/daw/PianoRoll.tsx
"use client";
import React, { useState } from "react";

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
  onAddNote: (note: MidiNote) => void;
  onDeleteNote: (id: string) => void;
  onPreviewNote: (pitch: number) => void;
  onUpdateNotes?: (notes: MidiNote[]) => void;
}

const PITCHES = [
  { pitch: 72, name: "C5", isBlack: false },
  { pitch: 71, name: "B4", isBlack: false },
  { pitch: 70, name: "A#4", isBlack: true },
  { pitch: 69, name: "A4", isBlack: false },
  { pitch: 68, name: "G#4", isBlack: true },
  { pitch: 67, name: "G4", isBlack: false },
  { pitch: 66, name: "F#4", isBlack: true },
  { pitch: 65, name: "F4", isBlack: false },
  { pitch: 64, name: "E4", isBlack: false },
  { pitch: 63, name: "D#4", isBlack: true },
  { pitch: 62, name: "D4", isBlack: false },
  { pitch: 61, name: "C#4", isBlack: true },
  { pitch: 60, name: "C4", isBlack: false },
  { pitch: 59, name: "B3", isBlack: false },
  { pitch: 58, name: "A#3", isBlack: true },
  { pitch: 57, name: "A3", isBlack: false },
  { pitch: 56, name: "G#3", isBlack: true },
  { pitch: 55, name: "G3", isBlack: false },
  { pitch: 54, name: "F#3", isBlack: true },
  { pitch: 53, name: "F3", isBlack: false },
  { pitch: 52, name: "E3", isBlack: false },
  { pitch: 51, name: "D#3", isBlack: true },
  { pitch: 50, name: "D3", isBlack: false },
  { pitch: 49, name: "C#3", isBlack: true },
  { pitch: 48, name: "C3", isBlack: false },
];

const TOTAL_STEPS = 32;

export function PianoRoll({
  notes,
  instrumentName,
  onAddNote,
  onDeleteNote,
  onPreviewNote,
  onUpdateNotes,
}: PianoRollProps) {
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);

  const handleCellClick = (pitch: number, step: number) => {
    const existing = notes.find((n) => n.pitch === pitch && n.startStep === step);
    if (existing) {
      onDeleteNote(existing.id);
    } else {
      onPreviewNote(pitch);
      onAddNote({
        id: `note-${Date.now()}-${pitch}-${step}`,
        pitch,
        startStep: step,
        length: 2,
        velocity: 100,
      });
    }
  };

  // Quantize: Snaps all notes to 16th or 8th intervals
  const quantizeNotes = (snapStep: number = 2) => {
    if (!onUpdateNotes) return;
    const quantized = notes.map((n) => ({
      ...n,
      startStep: Math.round(n.startStep / snapStep) * snapStep,
    }));
    onUpdateNotes(quantized);
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
          🎹 Piano Roll — <span className="text-[#d4af37]">{instrumentName}</span>
        </span>

        <div className="flex items-center gap-2">
          {/* Quantize */}
          <button
            onClick={() => quantizeNotes(2)}
            className="px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-[10px] text-white"
            title="Snap notes to 1/16th grid"
          >
            Quantize (1/16)
          </button>

          {/* Transpose */}
          <div className="flex items-center gap-1 border-l border-zinc-700 pl-2 text-[10px]">
            <span>Transpose:</span>
            <button onClick={() => transposeNotes(-1)} className="px-1.5 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700">-1</button>
            <button onClick={() => transposeNotes(1)} className="px-1.5 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700">+1</button>
            <button onClick={() => transposeNotes(12)} className="px-1.5 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700">+Oct</button>
          </div>
        </div>
      </div>

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
              {Array.from({ length: TOTAL_STEPS }, (_, step) => {
                const noteHere = notes.find((n) => n.pitch === p.pitch && n.startStep === step);
                const isBarStart = step % 16 === 0;
                const isBeatStart = step % 4 === 0;

                return (
                  <div
                    key={step}
                    onClick={() => handleCellClick(p.pitch, step)}
                    className={`h-full w-8 flex-none border-r cursor-pointer transition ${
                      isBarStart ? "border-zinc-600" : isBeatStart ? "border-zinc-700/60" : "border-zinc-800/40"
                    } ${p.isBlack ? "bg-zinc-900/40" : "bg-transparent"} hover:bg-amber-500/20 flex items-center p-0.5`}
                  >
                    {noteHere && (
                      <div className="h-full w-full rounded-sm bg-gradient-to-r from-amber-400 to-[#d4af37] shadow-sm border border-amber-300" />
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
        <span className="text-[9px] font-bold text-zinc-500 uppercase mr-3">Velocity Lane</span>
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
