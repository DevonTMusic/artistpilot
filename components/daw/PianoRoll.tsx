// components/daw/PianoRoll.tsx
"use client";
import React, { useState } from "react";

export interface MidiNote {
  id: string;
  pitch: number;    // MIDI note number (60 = C4)
  startStep: number; // 0 to 31 (16th note steps)
  length: number;    // Duration in steps
}

interface PianoRollProps {
  notes: MidiNote[];
  instrumentName: string;
  onAddNote: (note: MidiNote) => void;
  onDeleteNote: (id: string) => void;
  onPreviewNote: (pitch: number) => void;
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

const TOTAL_STEPS = 32; // 2 full bars of 16th notes

export function PianoRoll({
  notes,
  instrumentName,
  onAddNote,
  onDeleteNote,
  onPreviewNote,
}: PianoRollProps) {
  const [selectedPitch, setSelectedPitch] = useState<number | null>(null);

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
      });
    }
  };

  return (
    <div className="flex h-full w-full flex-col bg-[#14151a] text-zinc-300 select-none">
      {/* Header bar */}
      <div className="flex h-8 items-center justify-between border-b border-zinc-800 bg-[#1c1d24] px-4 text-xs font-semibold">
        <span className="text-zinc-200">
          🎹 Piano Roll — <span className="text-sky-400">{instrumentName}</span>
        </span>
        <span className="text-[11px] text-zinc-500">Click grid to insert/delete notes (32 steps / 2 bars)</span>
      </div>

      {/* Piano Keys Column + Note Grid */}
      <div className="flex-1 overflow-y-auto flex">
        {/* Left vertical piano keys */}
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

        {/* The 32-step note grid */}
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
                      isBarStart
                        ? "border-zinc-600"
                        : isBeatStart
                        ? "border-zinc-700/60"
                        : "border-zinc-800/40"
                    } ${
                      p.isBlack ? "bg-zinc-900/40" : "bg-transparent"
                    } hover:bg-sky-500/20 flex items-center p-0.5`}
                  >
                    {noteHere && (
                      <div className="h-full w-full rounded-sm bg-gradient-to-r from-sky-400 to-blue-500 shadow-sm border border-sky-300/80" />
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
