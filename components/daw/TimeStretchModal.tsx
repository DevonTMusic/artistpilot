// components/daw/TimeStretchModal.tsx
"use client";
import React, { useEffect, useState } from "react";
import { useLanguage } from "@/components/LanguageProvider";
import { MAX_STRETCH, MIN_STRETCH } from "@/lib/daw/timeStretch";

interface TimeStretchModalProps {
  isOpen: boolean;
  clipName: string;
  projectBpm: number;
  busy: boolean;
  onClose: () => void;
  onApply: (factor: number) => void;
}

export function TimeStretchModal({ isOpen, clipName, projectBpm, busy, onClose, onApply }: TimeStretchModalProps) {
  const { t } = useLanguage();
  const [percent, setPercent] = useState(100);
  const [sourceBpm, setSourceBpm] = useState(projectBpm);

  useEffect(() => {
    if (!isOpen) return;
    setPercent(100);
    setSourceBpm(projectBpm);
  }, [isOpen, projectBpm]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, busy, onClose]);

  if (!isOpen) return null;

  const matchFactor = sourceBpm > 0 ? sourceBpm / projectBpm : 1;
  const factor = percent / 100;
  const validFactor = factor >= MIN_STRETCH && factor <= MAX_STRETCH;

  return (
    <div
      role="dialog"
      aria-label={t("stretch.title")}
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50"
      onClick={() => { if (!busy) onClose(); }}
    >
      <div
        className="w-[420px] max-w-[92vw] rounded-2xl border-2 border-[#20232c] bg-[#12141a] font-sans shadow-[0_25px_60px_rgba(0,0,0,0.9)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex h-10 items-center justify-between border-b border-[#504436] bg-[#1a1c24] px-4">
          <span className="text-xs font-bold text-white">
            {t("stretch.title")} <span className="font-semibold text-[#75DEFF]">({clipName})</span>
          </span>
          <button aria-label="Close" onClick={onClose} disabled={busy} className="text-xs font-bold text-zinc-400 hover:text-white disabled:opacity-40">✕</button>
        </div>
        <div className="space-y-4 p-4 text-[11px] text-zinc-300">
          <p className="text-zinc-400">{t("stretch.hint")}</p>
          <label className="block">
            <span className="mb-1 flex justify-between font-bold">
              {t("stretch.length")}<span className="font-mono text-zinc-400">{percent}%</span>
            </span>
            <input type="range" min={MIN_STRETCH * 100} max={MAX_STRETCH * 100} step={1} value={percent}
              onChange={(event) => setPercent(Number(event.target.value))} className="w-full accent-sky-500" />
          </label>
          <div className="flex items-end gap-2">
            <label className="flex-1">
              <span className="mb-1 block font-bold">{t("stretch.sourceBpm")}</span>
              <input type="number" min={30} max={300} value={sourceBpm}
                onChange={(event) => setSourceBpm(Number(event.target.value))}
                className="w-full rounded border border-[#504436] bg-[#2F271D] px-2 py-1.5 text-white" />
            </label>
            <button
              onClick={() => setPercent(Math.round(Math.min(MAX_STRETCH, Math.max(MIN_STRETCH, matchFactor)) * 100))}
              className="flex-1 rounded border border-[#504436] bg-[#2F271D] py-1.5 font-bold hover:border-[#75DEFF] hover:text-white"
            >
              {t("stretch.matchProject", { bpm: projectBpm })}
            </button>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button onClick={onClose} disabled={busy}
              className="rounded px-3 py-1.5 font-bold text-zinc-400 hover:text-white disabled:opacity-40">
              {t("pitch.cancel")}
            </button>
            <button
              onClick={() => onApply(factor)}
              disabled={busy || !validFactor || percent === 100}
              className="rounded bg-sky-500 px-4 py-1.5 font-bold text-black hover:bg-sky-400 disabled:opacity-60"
            >
              {busy ? t("stretch.processing") : t("pitch.apply")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
