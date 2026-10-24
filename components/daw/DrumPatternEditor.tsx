"use client";

import React from "react";
import { DrumPatternData } from "@/lib/AudioEngine";

interface DrumPatternEditorProps {
  isOpen: boolean;
  pattern: DrumPatternData;
  onChange: (pattern: DrumPatternData) => void;
  onClose: () => void;
}

const rows: Array<{ key: keyof DrumPatternData; label: string }> = [
  { key: "kick", label: "Kick" },
  { key: "snare", label: "Snare" },
  { key: "hat", label: "Closed hat" },
];

export function DrumPatternEditor({ isOpen, pattern, onChange, onClose }: DrumPatternEditorProps) {
  if (!isOpen) return null;

  const toggleStep = (row: keyof DrumPatternData, index: number) => {
    const steps = [...pattern[row]];
    steps[index] = !steps[index];
    onChange({ ...pattern, [row]: steps });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
      <section className="w-full max-w-3xl rounded-xl border border-zinc-700 bg-[#15161b] p-5 text-white shadow-2xl">
        <header className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="font-bold">Drum pattern</h2>
            <p className="text-xs text-zinc-400">One bar, 16-step sequencer. Press Play to hear the pattern at the project tempo.</p>
          </div>
          <button onClick={onClose} className="rounded px-2 py-1 text-zinc-400 hover:bg-zinc-800 hover:text-white" aria-label="Close drum pattern editor">✕</button>
        </header>
        <div className="space-y-3">
          {rows.map(({ key, label }) => (
            <div key={key} className="grid grid-cols-[5rem_1fr] items-center gap-3">
              <span className="text-xs font-semibold text-zinc-300">{label}</span>
              <div className="grid grid-cols-[repeat(16,minmax(0,1fr))] gap-1">
                {Array.from({ length: 16 }, (_, index) => (
                  <button
                    key={index}
                    onClick={() => toggleStep(key, index)}
                    aria-label={`${label} step ${index + 1} ${pattern[key][index] ? "on" : "off"}`}
                    aria-pressed={Boolean(pattern[key][index])}
                    className={`aspect-square rounded border text-[9px] transition ${
                      pattern[key][index]
                        ? "border-amber-300 bg-amber-400 text-black"
                        : "border-zinc-700 bg-zinc-900 text-zinc-500 hover:border-zinc-500"
                    } ${index % 4 === 0 ? "ml-1" : ""}`}
                  >
                    {index + 1}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
        <footer className="mt-5 flex justify-end">
          <button onClick={onClose} className="rounded bg-violet-600 px-4 py-2 text-xs font-bold hover:bg-violet-500">Done</button>
        </footer>
      </section>
    </div>
  );
}
