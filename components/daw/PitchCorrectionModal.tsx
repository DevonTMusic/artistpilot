// components/daw/PitchCorrectionModal.tsx
"use client";
import React, { useEffect, useState } from "react";
import { useLanguage } from "@/components/LanguageProvider";
import type { PitchCorrectionOptions, PitchScale } from "@/lib/daw/pitchCorrect";

const NOTE_NAMES = ["C", "D♭", "D", "E♭", "E", "F", "F#", "G", "A♭", "A", "B♭", "B"];

interface PitchCorrectionModalProps {
  isOpen: boolean;
  clipName: string;
  defaultKeyIndex: number;
  defaultScale: PitchScale;
  busy: boolean;
  onClose: () => void;
  onApply: (options: PitchCorrectionOptions) => void;
  onManual?: () => void;
}

export function PitchCorrectionModal({
  isOpen,
  clipName,
  defaultKeyIndex,
  defaultScale,
  busy,
  onClose,
  onApply,
  onManual,
}: PitchCorrectionModalProps) {
  const { t } = useLanguage();
  const [keyIndex, setKeyIndex] = useState(defaultKeyIndex);
  const [scale, setScale] = useState<PitchScale>(defaultScale);
  const [strength, setStrength] = useState(0.8);
  const [retuneMs, setRetuneMs] = useState(60);

  useEffect(() => {
    if (!isOpen) return;
    setKeyIndex(defaultKeyIndex);
    setScale(defaultScale);
  }, [isOpen, defaultKeyIndex, defaultScale]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, busy, onClose]);

  if (!isOpen) return null;

  const presets = [
    { label: t("pitch.presetNatural"), strength: 0.6, retune: 150 },
    { label: t("pitch.presetModern"), strength: 0.85, retune: 40 },
    { label: t("pitch.presetHard"), strength: 1, retune: 0 },
  ];

  return (
    <div
      role="dialog"
      aria-label={t("pitch.title")}
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50"
      onClick={() => { if (!busy) onClose(); }}
    >
      <div
        className="w-[420px] max-w-[92vw] rounded-2xl border-2 border-[#20232c] bg-[#12141a] font-sans shadow-[0_25px_60px_rgba(0,0,0,0.9)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex h-10 items-center justify-between border-b border-[#3B3155] bg-[#1a1c24] px-4">
          <span className="text-xs font-bold text-white">
            {t("pitch.title")} <span className="font-semibold text-[#75DEFF]">({clipName})</span>
          </span>
          <button aria-label="Close" onClick={onClose} disabled={busy} className="text-xs font-bold text-zinc-400 hover:text-white disabled:opacity-40">✕</button>
        </div>
        <div className="space-y-4 p-4 text-[11px] text-zinc-300">
          <p className="text-zinc-400">{t("pitch.hint")}</p>
          <div className="flex gap-3">
            <label className="flex-1">
              <span className="mb-1 block font-bold">{t("pitch.key")}</span>
              <select
                value={keyIndex}
                onChange={(event) => setKeyIndex(Number(event.target.value))}
                className="w-full rounded border border-[#3B3155] bg-[#201933] px-2 py-1.5 text-white"
              >
                {NOTE_NAMES.map((name, index) => <option key={name} value={index}>{name}</option>)}
              </select>
            </label>
            <label className="flex-1">
              <span className="mb-1 block font-bold">{t("pitch.scale")}</span>
              <select
                value={scale}
                onChange={(event) => setScale(event.target.value as PitchScale)}
                className="w-full rounded border border-[#3B3155] bg-[#201933] px-2 py-1.5 text-white"
              >
                <option value="major">{t("pitch.major")}</option>
                <option value="minor">{t("pitch.minor")}</option>
                <option value="chromatic">{t("pitch.chromatic")}</option>
              </select>
            </label>
          </div>
          <div className="flex gap-2">
            {presets.map((preset) => (
              <button
                key={preset.label}
                onClick={() => { setStrength(preset.strength); setRetuneMs(preset.retune); }}
                className="flex-1 rounded border border-[#3B3155] bg-[#201933] py-1 font-bold hover:border-[#75DEFF] hover:text-white"
              >
                {preset.label}
              </button>
            ))}
          </div>
          <label className="block">
            <span className="mb-1 flex justify-between font-bold">
              {t("pitch.strength")}<span className="font-mono text-zinc-400">{Math.round(strength * 100)}%</span>
            </span>
            <input type="range" min={0} max={1} step={0.01} value={strength}
              onChange={(event) => setStrength(Number(event.target.value))} className="w-full accent-sky-500" />
          </label>
          <label className="block">
            <span className="mb-1 flex justify-between font-bold">
              {t("pitch.retune")}<span className="font-mono text-zinc-400">{retuneMs} ms</span>
            </span>
            <input type="range" min={0} max={400} step={5} value={retuneMs}
              onChange={(event) => setRetuneMs(Number(event.target.value))} className="w-full accent-sky-500" />
          </label>
          {onManual && (
            <button onClick={onManual} disabled={busy}
              className="w-full rounded border border-dashed border-[#75DEFF]/50 py-1.5 font-bold text-[#75DEFF] hover:bg-[#75DEFF]/10 disabled:opacity-40">
              {t("pitch.manual")}
            </button>
          )}
          <div className="flex justify-end gap-2 pt-1">
            <button onClick={onClose} disabled={busy}
              className="rounded px-3 py-1.5 font-bold text-zinc-400 hover:text-white disabled:opacity-40">
              {t("pitch.cancel")}
            </button>
            <button
              onClick={() => onApply({ keyIndex, scale, strength, retuneMs })}
              disabled={busy}
              className="rounded bg-sky-500 px-4 py-1.5 font-bold text-black hover:bg-sky-400 disabled:opacity-60"
            >
              {busy ? t("pitch.processing") : t("pitch.apply")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
