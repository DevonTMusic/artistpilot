"use client";

import React from "react";
import { DrumPatternData } from "@/lib/AudioEngine";
import { useLanguage } from "@/components/LanguageProvider";

interface DrumPatternEditorProps {
  isOpen: boolean;
  pattern: DrumPatternData;
  onChange: (pattern: DrumPatternData) => void;
  onClose: () => void;
}

const rows: Array<{ key: "kick" | "snare" | "hat" | "openHat" | "clap" | "percussion"; label: string }> = [
  { key: "kick", label: "drums.kick" },
  { key: "snare", label: "drums.snare" },
  { key: "hat", label: "drums.closedHat" },
  { key: "openHat", label: "drums.openHat" },
  { key: "clap", label: "drums.clap" },
  { key: "percussion", label: "drums.percussion" },
];

interface DrumPatternEditorPropsExtended extends DrumPatternEditorProps {
  bpm?: number;
  playheadSec?: number;
  isPlaying?: boolean;
}

export function DrumPatternEditor({
  isOpen,
  pattern,
  onChange,
  onClose,
  bpm = 120,
  playheadSec = 0,
  isPlaying = false,
}: DrumPatternEditorPropsExtended) {
  const { t } = useLanguage();
  if (!isOpen) return null;
  const stepCount = Math.max(16, Math.min(64, ...[
    pattern.kick.length,
    pattern.snare.length,
    pattern.hat.length,
    pattern.openHat?.length ?? 0,
    pattern.clap?.length ?? 0,
    pattern.percussion?.length ?? 0,
  ]));
  const stepDuration = 60 / Math.max(1, bpm) / 4;
  const cycleDuration = stepCount * stepDuration;
  const cyclePosition = ((playheadSec % cycleDuration) + cycleDuration) % cycleDuration;
  const currentStep = Array.from({ length: stepCount }, (_, step) => step).reduce((current, step) =>
    cyclePosition >= step * stepDuration + (step % 2 === 1 ? (pattern.swing ?? 0) * stepDuration * 0.5 : 0) ? step : current, 0);

  const toggleStep = (row: "kick" | "snare" | "hat" | "openHat" | "clap" | "percussion", index: number) => {
    const steps = [...(pattern[row] ?? Array.from({ length: stepCount }, () => false))];
    steps[index] = !steps[index];
    onChange({ ...pattern, [row]: steps });
  };

  const changeLength = (length: number) => {
    const resized = Object.fromEntries(rows.map(({ key }) => [
      key,
      Array.from({ length }, (_, index) => pattern[key]?.[index] ?? false),
    ])) as Pick<DrumPatternData, "kick" | "snare" | "hat" | "openHat" | "clap" | "percussion">;
    onChange({ ...pattern, ...resized });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
      <section className="w-full max-w-3xl rounded-xl border border-[#51456F] bg-[#15161b] p-5 text-white shadow-2xl">
        <header className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="font-bold">{t("drums.title")}</h2>
            <p className="text-xs text-zinc-400">{t("drums.help")}</p>
          </div>
          <button onClick={onClose} className="rounded px-2 py-1 text-zinc-400 hover:bg-[#322849] hover:text-white" aria-label={t("drums.close")}>✕</button>
        </header>
        <div className="mb-4 flex flex-wrap items-center gap-4 text-xs">
          <label className="flex items-center gap-2 text-zinc-300">
            {t("drums.length")}
            <select value={stepCount} onChange={(event) => changeLength(Number(event.target.value))} className="rounded border border-[#51456F] bg-[#241D3A] px-2 py-1 text-white">
              {[16, 32, 64].map((length) => <option key={length} value={length}>{t(length === 16 ? "drums.barSingular" : "drums.barPlural", { count: length / 16 })}</option>)}
            </select>
          </label>
          <label className="flex items-center gap-2 text-zinc-300">
            {t("drums.swing")}
            <input type="range" min={0} max={0.5} step={0.01} value={pattern.swing ?? 0} onChange={(event) => onChange({ ...pattern, swing: Number(event.target.value) })} className="accent-[#D0BCFF]" />
            <span className="w-8 font-mono text-zinc-400">{Math.round((pattern.swing ?? 0) * 100)}%</span>
          </label>
          <span className="ml-auto text-zinc-500">{isPlaying ? `${bpm} BPM · ${t("drums.step")} ${currentStep + 1}` : `${bpm} BPM · ${t("drums.stopped")}`}</span>
        </div>
        <div className="space-y-2 overflow-x-auto">
          {rows.map(({ key, label }) => (
            <div key={key} className="grid min-w-[760px] grid-cols-[5rem_1fr] items-center gap-3">
              <span className="text-xs font-semibold text-zinc-300">{t(label)}</span>
                  <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${stepCount}, minmax(0, 1fr))` }}>
                {Array.from({ length: stepCount }, (_, index) => (
                  <button
                    key={index}
                    onClick={() => toggleStep(key, index)}
                    aria-label={t("drums.stepState", { row: t(label), step: index + 1, state: (pattern[key] ?? [])[index] ? t("pianoRoll.on") : t("pianoRoll.off") })}
                    aria-pressed={Boolean((pattern[key] ?? [])[index])}
                    className={`aspect-square rounded border text-[9px] transition ${
                      (pattern[key] ?? [])[index]
                        ? "border-[#D0BCFF] bg-[#D0BCFF] text-[#19152B]"
                        : "border-[#51456F] bg-[#241D3A] text-zinc-500 hover:border-zinc-500"
                    } ${index % 4 === 0 ? "ml-1" : ""} ${isPlaying && currentStep === index ? "ring-2 ring-white ring-offset-1 ring-offset-[#15161b]" : ""}`}
                  >
                    {index + 1}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
        <footer className="mt-5 flex justify-end">
          <button onClick={onClose} className="rounded bg-[#986FEF] px-4 py-2 text-xs font-bold hover:bg-[#B89CFF]">{t("drums.done")}</button>
        </footer>
      </section>
    </div>
  );
}
