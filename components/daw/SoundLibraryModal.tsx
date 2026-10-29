"use client";

import React, { useMemo, useState } from "react";
import { SOUND_LIBRARY, SoundCategory, SoundPreset, soundPresetSummary } from "@/lib/daw/soundLibrary";
import { useLanguage } from "@/components/LanguageProvider";

interface SoundLibraryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApply: (preset: SoundPreset) => void;
}

const categories: Array<{ id: SoundCategory | "all"; label: string }> = [
  { id: "all", label: "sound.all" },
  { id: "vocals", label: "sound.vocals" },
  { id: "guitar", label: "sound.guitar" },
  { id: "bass", label: "sound.bass" },
  { id: "keys", label: "sound.keys" },
  { id: "drums", label: "sound.drums" },
];

export function SoundLibraryModal({ isOpen, onClose, onApply }: SoundLibraryModalProps) {
  const { t } = useLanguage();
  const [category, setCategory] = useState<SoundCategory | "all">("all");
  const [query, setQuery] = useState("");
  const [appliedPresetId, setAppliedPresetId] = useState<string | null>(null);

  const results = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return SOUND_LIBRARY.filter((preset) => {
      const matchesCategory = category === "all" || preset.category === category;
      const searchable = `${preset.name} ${preset.description} ${preset.tags.join(" ")}`.toLowerCase();
      return matchesCategory && (!normalizedQuery || searchable.includes(normalizedQuery));
    });
  }, [category, query]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4">
      <section role="dialog" aria-modal="true" aria-label={t("sound.title")} className="flex max-h-[88vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-zinc-700 bg-[#13151a] text-white shadow-2xl">
        <header className="flex items-center justify-between border-b border-zinc-800 px-5 py-4">
          <div>
            <h2 className="text-base font-bold">{t("sound.title")}</h2>
            <p className="mt-1 text-xs text-zinc-400">{t("sound.description", { count: SOUND_LIBRARY.length })}</p>
          </div>
          <button onClick={onClose} aria-label={t("sound.close")} className="rounded px-2 py-1 text-zinc-400 hover:bg-zinc-800 hover:text-white">✕</button>
        </header>

        <div className="space-y-3 border-b border-zinc-800 p-4">
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("sound.search")}
            aria-label={t("sound.searchLabel")}
            className="w-full rounded-lg border border-zinc-700 bg-[#0c0d10] px-3 py-2 text-sm outline-none focus:border-sky-500"
          />
          <div className="flex gap-2 overflow-x-auto pb-1">
            {categories.map((item) => (
              <button
                key={item.id}
                onClick={() => setCategory(item.id)}
                aria-pressed={category === item.id}
                className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold ${category === item.id ? "bg-sky-500 text-black" : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"}`}
              >
                {t(item.label)}
              </button>
            ))}
          </div>
        </div>

        <div className="grid flex-1 grid-cols-1 gap-2 overflow-y-auto p-4 sm:grid-cols-2 lg:grid-cols-3">
          {results.map((preset) => (
            <article key={preset.id} className="flex min-h-28 flex-col justify-between rounded-xl border border-zinc-800 bg-[#1a1c22] p-3">
              <div>
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-sm font-semibold text-white">{preset.name}</h3>
                  <span className="rounded bg-zinc-800 px-2 py-0.5 text-[9px] tracking-wide text-zinc-400">{preset.category}</span>
                </div>
                <p className="mt-1 text-xs text-zinc-400">{preset.description}</p>
                <p className="mt-2 text-[10px] text-zinc-500">{soundPresetSummary(preset)}</p>
              </div>
              <button
                onClick={() => {
                  onApply(preset);
                  setAppliedPresetId(preset.id);
                }}
                className={`mt-3 rounded-lg px-3 py-1.5 text-xs font-bold ${appliedPresetId === preset.id ? "bg-emerald-700 text-white" : "bg-zinc-700 text-zinc-100 hover:bg-sky-600"}`}
              >
                {appliedPresetId === preset.id ? t("sound.applied") : t("sound.apply")}
              </button>
            </article>
          ))}
          {results.length === 0 && <p className="col-span-full py-10 text-center text-sm text-zinc-500">{t("sound.noResults")}</p>}
        </div>
      </section>
    </div>
  );
}
