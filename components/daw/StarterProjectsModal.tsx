"use client";

import React, { useEffect, useRef } from "react";
import { useLanguage } from "@/components/LanguageProvider";
import { STARTER_PROJECTS, type StarterProject } from "@/lib/daw/starters";

type Props = {
  isOpen: boolean;
  hasWork: boolean;
  onClose: () => void;
  onPick: (starter: StarterProject) => void;
};

export function StarterProjectsModal({ isOpen, hasWork, onClose, onPick }: Props) {
  const { locale, t } = useLanguage();
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={t("starter.title")} className="w-full max-w-2xl rounded-2xl border border-[#51456F] bg-[#241D3A] p-6 text-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-extrabold">{t("starter.title")}</h2>
            <p className="mt-1 text-sm text-zinc-300">{t("starter.intro")}</p>
          </div>
          <button ref={closeRef} type="button" aria-label={t("starter.close")} onClick={onClose} className="rounded px-2 text-zinc-400 hover:text-white">✕</button>
        </div>
        {hasWork && <p role="alert" className="mt-4 rounded-lg border border-amber-500/50 bg-amber-500/10 p-3 text-sm text-amber-200">{t("starter.replaceWarning")}</p>}
        <ul className="mt-4 grid gap-3 sm:grid-cols-3">
          {STARTER_PROJECTS.map((starter) => (
            <li key={starter.id} className="flex flex-col rounded-xl border border-[#3B3155] bg-[#1b1530] p-4">
              <h3 className="font-bold">{starter.name[locale]}</h3>
              <p className="mt-1 text-xs text-[#75DEFF]">{starter.bpm} BPM · {starter.key} {starter.scale === "min" ? t("starter.minor") : t("starter.major")}</p>
              <p className="mt-2 flex-1 text-sm text-zinc-300">{starter.blurb[locale]}</p>
              <button type="button" onClick={() => onPick(starter)} className="mt-4 rounded-lg bg-[#986FEF] px-3 py-2 text-sm font-bold text-white hover:bg-[#B89CFF]">
                {hasWork ? t("starter.replace") : t("starter.use")}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
