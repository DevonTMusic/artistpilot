"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useLanguage } from "@/components/LanguageProvider";
import { GLOSSARY_BY_ID } from "@/lib/learn/content";

export default function ConceptHint({ id, className = "" }: { id: string; className?: string }) {
  const { locale, t } = useLanguage();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLSpanElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number }>({ left: 0, top: 0 });
  const panelId = useId();
  const entry = GLOSSARY_BY_ID[id];

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        setOpen(false);
      }
    };
    const onPointer = (event: PointerEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("pointerdown", onPointer);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);

  if (!entry) return null;
  return (
    <span ref={wrapRef} className={`relative inline-block ${className}`}>
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-label={t("learn.whatIs", { term: entry.term[locale] })}
        onClick={() => {
          const rect = buttonRef.current?.getBoundingClientRect();
          if (rect) {
            const width = 256;
            const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8));
            const below = window.innerHeight - rect.bottom > 190;
            setPos({ left, top: below ? rect.bottom + 6 : Math.max(8, rect.top - 186) });
          }
          setOpen((value) => !value);
        }}
        className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-[#51456F] text-xs font-bold text-[#D0BCFF] hover:bg-[#322849] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#75DEFF]"
      >
        ?
      </button>
      {open && (
        <span id={panelId} role="note" style={{ left: pos.left, top: pos.top }} className="fixed z-[200] block w-64 rounded-lg border border-[#51456F] bg-[#241D3A] p-3 text-left text-xs font-normal normal-case leading-relaxed text-zinc-200 shadow-xl">
          <strong className="block text-sm text-white">{entry.term[locale]}</strong>
          {entry.short[locale]}
          <span className="mt-2 block text-[#4FE3C1]">{t("learn.tryIt")}: {entry.tryIt[locale]}</span>
          <a href="/learn#glossary" target="_blank" rel="noopener noreferrer" className="mt-2 block text-[#75DEFF] underline">{t("learn.openGlossary")}</a>
        </span>
      )}
    </span>
  );
}
