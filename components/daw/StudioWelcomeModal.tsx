"use client";
import React, { useEffect, useRef, useState } from "react";
import { useLanguage } from "@/components/LanguageProvider";

interface StudioWelcomeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddTrack: () => void;
  onPlay: () => void;
  onSave: () => void;
}

export function StudioWelcomeModal({ isOpen, onClose, onAddTrack, onPlay, onSave }: StudioWelcomeModalProps) {
  const { t } = useLanguage();
  const [tab, setTab] = useState<"guide" | "first-song">("guide");
  const [step, setStep] = useState(0);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    try {
      const saved = Number(window.localStorage.getItem("artistpilot-first-song-step"));
      if (Number.isInteger(saved) && saved >= 0 && saved <= 4) setStep(saved);
    } catch (error) {
      console.warn("Could not read first-song guide progress:", error);
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeButtonRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      const dialog = closeButtonRef.current?.closest('[role="dialog"]');
      const focusable = Array.from(dialog?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ) ?? []);
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      previousFocusRef.current?.focus();
    };
  }, [isOpen]);

  const updateStep = (next: number) => {
    const bounded = Math.max(0, Math.min(4, next));
    setStep(bounded);
    try {
      window.localStorage.setItem("artistpilot-first-song-step", String(bounded));
    } catch (error) {
      console.warn("Could not save first-song guide progress:", error);
    }
  };

  if (!isOpen) return null;
  const guideSections = [
    ["studio.guide1Title", "studio.guide1Text"],
    ["studio.guide2Title", "studio.guide2Text"],
    ["studio.guide3Title", "studio.guide3Text"],
    ["studio.guide4Title", "studio.guide4Text"],
    ["studio.guide5Title", "studio.guide5Text"],
  ];
  const firstSongSteps = [
    { title: "studio.step1Title", text: "studio.step1Text", action: "studio.step1Action", run: onAddTrack },
    { title: "studio.step2Title", text: "studio.step2Text", action: "studio.step2Action", run: onAddTrack },
    { title: "studio.step3Title", text: "studio.step3Text", action: "studio.step3Action", run: onPlay },
    { title: "studio.step4Title", text: "studio.step4Text", action: "studio.step4Action", run: onSave },
  ];
  const current = firstSongSteps[Math.min(step, firstSongSteps.length - 1)];

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="studio-welcome-title"
        aria-describedby="studio-welcome-description"
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-[#51456F] bg-[#15171d] p-5 shadow-2xl sm:p-7"
      >
        <header className="mb-5 flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-bold tracking-normal text-[#75DEFF]">{t("studio.brand")}</p>
            <h2 id="studio-welcome-title" className="mt-1 text-xl font-bold text-white">{t("studio.welcome")}</h2>
            <p id="studio-welcome-description" className="mt-2 text-sm leading-relaxed text-zinc-300">{t("studio.guideIntro")}</p>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label={t("studio.closeGuide")}
            className="rounded-lg px-2 py-1 text-lg text-zinc-400 hover:bg-[#322849] hover:text-white"
          >
            ×
          </button>
        </header>

        <div className="mb-4 flex gap-2 border-b border-[#3B3155]" role="group" aria-label={t("studio.brand")}>
          {(["guide", "first-song"] as const).map((value) => (
            <button key={value} type="button" aria-pressed={tab === value} onClick={() => setTab(value)} className={`border-b-2 px-3 py-2 text-sm font-semibold focus-visible:outline ${tab === value ? "border-sky-400 text-white" : "border-transparent text-zinc-300 hover:text-white"}`}>
              {t(value === "guide" ? "studio.guideTab" : "studio.firstSongTab")}
            </button>
          ))}
        </div>

        {tab === "guide" ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {guideSections.map(([title, description]) => (
              <article key={title} className="rounded-xl border border-[#3B3155] bg-[#101116] p-4">
                <h3 className="text-sm font-semibold text-white">{t(title)}</h3>
                <p className="mt-2 text-sm leading-relaxed text-zinc-300">{t(description)}</p>
              </article>
            ))}
            <article className="rounded-xl border border-[#493578]/70 bg-[#34204D]/20 p-4">
              <h3 className="text-sm font-semibold text-[#b9f6d0]">{t("studio.guideAgain")}</h3>
              <p className="mt-2 text-sm leading-relaxed text-[#b9f6d0]/80">{t("studio.guideAgainHint")}</p>
            </article>
          </div>
        ) : (
          <div aria-live="polite" className="rounded-xl border border-[#3B3155] bg-[#101116] p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-white">{t("studio.beginnerPath")}</h3>
                <p className="mt-1 text-sm leading-relaxed text-zinc-300">{t("studio.beginnerIntro")}</p>
              </div>
              <span className="shrink-0 text-sm text-zinc-300">{t("studio.stepProgress", { current: Math.min(step + 1, 4), total: 4 })}</span>
            </div>
            <div className="mb-5 flex gap-2" role="progressbar" aria-label={t("studio.beginnerPath")} aria-valuemin={1} aria-valuemax={4} aria-valuenow={Math.min(step + 1, 4)}>
              {firstSongSteps.map((item, index) => <span key={item.title} className={`h-2 flex-1 rounded-full ${index <= step ? "bg-sky-400" : "bg-zinc-700"}`} />)}
            </div>
            <h4 className="text-base font-semibold text-white">{step >= 4 ? t("studio.finishedTitle") : t(current.title)}</h4>
            <p className="mt-2 text-sm leading-relaxed text-zinc-300">{step >= 4 ? t("studio.finishedText") : t(current.text)}</p>
            {step < 4 && (
              <button type="button" onClick={current.run} className="mt-4 rounded-lg bg-sky-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-sky-500">
                {t(current.action)}
              </button>
            )}
            <div className="mt-5 flex justify-between gap-3 border-t border-[#3B3155] pt-4">
              <button type="button" disabled={step === 0} onClick={() => updateStep(step - 1)} className="rounded-lg border border-[#51456F] px-4 py-2 text-sm font-semibold text-zinc-200 hover:bg-[#322849] disabled:opacity-40">{t("studio.previous")}</button>
              {step < 3 ? (
                <button type="button" onClick={() => updateStep(step + 1)} className="rounded-lg bg-[#986FEF] px-4 py-2 text-sm font-bold text-white hover:bg-[#B89CFF]">{t("studio.next")}</button>
              ) : (
                <button type="button" onClick={() => updateStep(4)} className="rounded-lg bg-[#986FEF] px-4 py-2 text-sm font-bold text-white hover:bg-[#B89CFF]">{t("studio.finishGuide")}</button>
              )}
            </div>
          </div>
        )}

        <footer className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-sky-600 px-4 py-2 text-xs font-bold text-white hover:bg-sky-500"
          >
            {t("studio.startCreating")}
          </button>
        </footer>
      </section>
    </div>
  );
}
