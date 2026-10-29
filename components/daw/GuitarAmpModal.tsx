"use client";
import React from "react";
import { GuitarAmpSettings } from "@/lib/daw/EffectsEngine";
import { useLanguage } from "@/components/LanguageProvider";

interface GuitarAmpModalProps {
  isOpen: boolean;
  onClose: () => void;
  trackName: string;
  settings: GuitarAmpSettings;
  enabled: boolean;
  onSettingsChange: (settings: GuitarAmpSettings) => void;
  onToggleEnabled: () => void;
}

const rangeClass = "w-full accent-[#3ddc78]";
const labelClass = "mb-1 block text-[10px] font-semibold tracking-wide text-zinc-400";

export function GuitarAmpModal({
  isOpen,
  onClose,
  trackName,
  settings,
  enabled,
  onSettingsChange,
  onToggleEnabled,
}: GuitarAmpModalProps) {
  const { t } = useLanguage();
  if (!isOpen) return null;

  const update = (key: keyof GuitarAmpSettings, value: number | boolean) =>
    onSettingsChange({ ...settings, [key]: value });

  const pedal = (
    title: string,
    key: "driveEnabled" | "delayEnabled" | "chorusEnabled" | "reverbEnabled",
    value: number,
    amountKey: "drive" | "delay" | "reverb" | null,
    color: string
  ) => (
    <section className="rounded-xl border border-zinc-700 bg-zinc-900/80 p-4">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-xs font-bold tracking-wide text-white">{title}</h3>
        <button
          onClick={() => update(key, !settings[key])}
          aria-pressed={settings[key]}
          className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${settings[key] ? `${color} text-black` : "bg-zinc-800 text-zinc-400"}`}
        >
          {settings[key] ? t("track.on") : t("amp.bypass")}
        </button>
      </div>
      {amountKey && amountKey !== "drive" && (
        <>
          <label className={labelClass}>{amountKey === "delay" ? t("amp.feedbackMix") : t("amp.wetDry")} · {Math.round(value * 100)}%</label>
          <input type="range" min={0} max={1} step={0.01} value={value} onChange={(event) => update(amountKey, Number(event.target.value))} className={rangeClass} />
        </>
      )}
    </section>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4">
      <section role="dialog" aria-modal="true" aria-label={t("amp.effectsLabel", { track: trackName })} className="max-h-[85vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-zinc-700 bg-[#17191f] text-white shadow-2xl">
        <header className="flex items-center justify-between border-b border-zinc-800 bg-[#22242c] px-5 py-3">
          <div>
            <h2 className="text-sm font-bold text-[#5ee38f]">{t("amp.title")}</h2>
            <p className="text-xs text-zinc-400">{t("amp.playbackNote", { track: trackName })}</p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={onToggleEnabled} aria-pressed={enabled} className={`rounded-full px-3 py-1.5 text-xs font-bold ${enabled ? "bg-emerald-400 text-black" : "bg-zinc-700 text-zinc-200"}`}>
              {t("amp.amp")} {enabled ? t("amp.on") : t("amp.off")}
            </button>
            <button onClick={onClose} aria-label={t("amp.close")} className="rounded px-2 py-1 text-zinc-400 hover:bg-zinc-700 hover:text-white">✕</button>
          </div>
        </header>
        <div className="space-y-5 p-5">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
            {([
              [t("amp.gain"), "drive", 0, 1, 0.01],
              [t("amp.bass"), "bass", -10, 10, 0.1],
              [t("amp.mid"), "mid", -10, 10, 0.1],
              [t("amp.treble"), "treble", -10, 10, 0.1],
              [t("amp.master"), "master", 0, 1, 0.01],
            ] as const).map(([label, key, min, max, step]) => (
              <label key={key}>
                <span className={labelClass}>{label} · {settings[key].toFixed(1)}</span>
                <input type="range" min={min} max={max} step={step} value={settings[key]} onChange={(event) => update(key, Number(event.target.value))} className={rangeClass} />
              </label>
            ))}
          </div>
          <label className="flex items-center gap-2 text-xs text-zinc-300">
            <input type="checkbox" checked={settings.cabSim} onChange={(event) => update("cabSim", event.target.checked)} className="accent-[#3ddc78]" />
            {t("amp.cabSim")}
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            {pedal(t("amp.overdrive"), "driveEnabled", settings.drive, "drive", "bg-emerald-300")}
            {pedal(t("amp.delay"), "delayEnabled", settings.delay, "delay", "bg-sky-300")}
            {pedal(t("amp.chorus"), "chorusEnabled", 0, null, "bg-[#5ee38f]")}
            {pedal(t("amp.reverb"), "reverbEnabled", settings.reverb, "reverb", "bg-rose-300")}
          </div>
        </div>
      </section>
    </div>
  );
}
