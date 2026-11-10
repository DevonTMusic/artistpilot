"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Nav from "@/components/Nav";
import { useLanguage } from "@/components/LanguageProvider";
import { GLOSSARY, GLOSSARY_BY_ID, STUDIO_LESSONS } from "@/lib/learn/content";
import { LEARN_AUTO_KEY, LEARN_MANUAL_KEY, readIds } from "@/lib/learn/progress";

export default function LearnPage() {
  const { locale, t } = useLanguage();
  const [done, setDone] = useState<string[]>([]);
  const [auto, setAuto] = useState<string[]>([]);

  useEffect(() => {
    const load = () => {
      setDone(readIds(LEARN_MANUAL_KEY));
      setAuto(readIds(LEARN_AUTO_KEY));
    };
    load();
    window.addEventListener("storage", load);
    window.addEventListener("focus", load);
    return () => {
      window.removeEventListener("storage", load);
      window.removeEventListener("focus", load);
    };
  }, []);

  const toggle = (id: string) => {
    setDone((current) => {
      const next = current.includes(id) ? current.filter((item) => item !== id) : [...current, id];
      try {
        window.localStorage.setItem(LEARN_MANUAL_KEY, JSON.stringify(next));
      } catch (error) {
        console.warn("Could not save lesson progress:", error);
      }
      return next;
    });
  };

  const isComplete = (id: string) => done.includes(id) || auto.includes(id);
  const completed = STUDIO_LESSONS.filter((lesson) => isComplete(lesson.id)).length;

  return (
    <>
      <Nav signedIn />
      <main className="mx-auto max-w-5xl px-5 py-12">
        <h1 className="text-3xl font-extrabold">{t("learn.title")}</h1>
        <p className="mt-2 max-w-2xl text-zinc-400">{t("learn.intro")}</p>
        <div className="mt-5 flex flex-wrap items-center gap-4">
          <Link href="/studio" className="rounded-lg bg-[#986FEF] px-4 py-2.5 font-bold text-white hover:bg-[#B89CFF]">{t("learn.openStudio")}</Link>
          <span className="text-sm text-zinc-300" aria-live="polite">{t("learn.progress", { done: completed, total: STUDIO_LESSONS.length })}</span>
        </div>

        <div className="mt-8 grid gap-5 md:grid-cols-2">
          {STUDIO_LESSONS.map((lesson, index) => {
            const isDone = isComplete(lesson.id);
            const detected = auto.includes(lesson.id);
            return (
              <section key={lesson.id} className="rounded-2xl border border-[#3B3155] bg-[#241D3A] p-6" aria-labelledby={`lesson-${lesson.id}`}>
                <p className="text-xs font-semibold uppercase tracking-wide text-[#B89CFF]">{t("learn.lessonLabel", { n: index + 1, minutes: lesson.minutes })}</p>
                <h2 id={`lesson-${lesson.id}`} className="mt-1 text-xl font-bold">{lesson.title[locale]}</h2>
                <p className="mt-1 text-sm text-zinc-400">{lesson.goal[locale]}</p>
                <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm text-zinc-200">
                  {lesson.steps.map((step, stepIndex) => <li key={stepIndex}>{step[locale]}</li>)}
                </ol>
                <p className="mt-4 text-xs text-zinc-400">
                  {t("learn.concepts")}: {lesson.concepts.map((conceptId) => (
                    <a key={conceptId} href={`#term-${conceptId}`} className="mr-2 text-[#75DEFF] underline">{GLOSSARY_BY_ID[conceptId].term[locale]}</a>
                  ))}
                </p>
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <Link href={lesson.starter ? `/studio?starter=${lesson.starter}` : "/studio"} className="rounded-lg bg-[#986FEF] px-3 py-2 text-xs font-bold text-white hover:bg-[#B89CFF]">{t("learn.tryInStudio")}</Link>
                  <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-200">
                    <input type="checkbox" checked={isDone} disabled={detected && !done.includes(lesson.id)} onChange={() => toggle(lesson.id)} className="h-4 w-4 accent-[#4FE3C1]" />
                    {t("learn.markDone")}
                  </label>
                </div>
                <p className="mt-3 text-xs text-zinc-500">{detected ? t("learn.detected") : lesson.autoTick[locale]}</p>
              </section>
            );
          })}
        </div>

        <section id="glossary" className="mt-14 scroll-mt-6" aria-labelledby="glossary-title">
          <h2 id="glossary-title" className="text-2xl font-extrabold">{t("learn.glossaryTitle")}</h2>
          <p className="mt-1 text-zinc-400">{t("learn.glossaryIntro")}</p>
          <dl className="mt-5 grid gap-4 md:grid-cols-2">
            {GLOSSARY.map((entry) => (
              <div key={entry.id} id={`term-${entry.id}`} className="scroll-mt-6 rounded-xl border border-[#3B3155] bg-[#241D3A] p-4">
                <dt className="font-bold text-white">{entry.term[locale]}</dt>
                <dd className="mt-1 text-sm text-zinc-300">{entry.short[locale]}</dd>
                <dd className="mt-2 text-sm text-[#4FE3C1]">{t("learn.tryIt")}: {entry.tryIt[locale]}</dd>
              </div>
            ))}
          </dl>
        </section>
      </main>
    </>
  );
}
