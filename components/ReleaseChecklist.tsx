"use client";

import { useEffect, useState } from "react";
import { useLanguage } from "@/components/LanguageProvider";

const KEY = "artistpilot-release-checklist";

type Item = { id: string; en: string; es: string };
type Phase = { id: string; en: string; es: string; items: Item[] };

const PHASES: Phase[] = [
  {
    id: "prep", en: "4+ weeks before", es: "4+ semanas antes",
    items: [
      { id: "master", en: "Finish and master the song", es: "Termina y masteriza la canción" },
      { id: "art", en: "Make the cover art (3000×3000 px)", es: "Crea la portada (3000×3000 px)" },
      { id: "distro", en: "Upload to a distributor and set the release date", es: "Sube a un distribuidor y fija la fecha de lanzamiento" },
      { id: "meta", en: "Check song title, credits and spelling", es: "Revisa título, créditos y ortografía" },
    ],
  },
  {
    id: "build", en: "2 to 3 weeks before", es: "2 a 3 semanas antes",
    items: [
      { id: "bio", en: "Write your artist bio", es: "Escribe tu biografía de artista" },
      { id: "presave", en: "Set up a pre-save link", es: "Crea un enlace de pre-guardado" },
      { id: "teasers", en: "Film 3 to 5 teaser clips", es: "Graba de 3 a 5 clips adelanto" },
      { id: "outreach", en: "Message playlists, blogs and friends who might share it", es: "Escribe a playlists, blogs y amigos que puedan compartirla" },
    ],
  },
  {
    id: "week", en: "Release week", es: "Semana de lanzamiento",
    items: [
      { id: "countdown", en: "Post a countdown every day", es: "Publica una cuenta regresiva cada día" },
      { id: "dayof", en: "Release day: post everywhere and thank your first listeners", es: "Día de lanzamiento: publica en todas partes y agradece a tus primeros oyentes" },
      { id: "reply", en: "Reply to every comment", es: "Responde a cada comentario" },
    ],
  },
  {
    id: "after", en: "After release", es: "Después del lanzamiento",
    items: [
      { id: "behind", en: "Share behind-the-scenes and the story of the song", es: "Comparte el detrás de cámaras y la historia de la canción" },
      { id: "review", en: "Check which posts worked and do more of those", es: "Revisa qué publicaciones funcionaron y haz más de esas" },
      { id: "next", en: "Start the next song", es: "Empieza la siguiente canción" },
    ],
  },
];

export default function ReleaseChecklist() {
  const { locale, t } = useLanguage();
  const [done, setDone] = useState<string[]>([]);

  useEffect(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem(KEY) ?? "[]");
      if (Array.isArray(saved)) setDone(saved.filter((id): id is string => typeof id === "string"));
    } catch {
      setDone([]);
    }
  }, []);

  const toggle = (id: string) => {
    setDone((current) => {
      const next = current.includes(id) ? current.filter((item) => item !== id) : [...current, id];
      try {
        window.localStorage.setItem(KEY, JSON.stringify(next));
      } catch (error) {
        console.warn("Could not save checklist:", error);
      }
      return next;
    });
  };

  const total = PHASES.reduce((sum, phase) => sum + phase.items.length, 0);
  const finished = PHASES.reduce((sum, phase) => sum + phase.items.filter((item) => done.includes(item.id)).length, 0);

  return (
    <section className="mt-12 max-w-2xl" aria-labelledby="checklist-title">
      <h2 id="checklist-title" className="text-2xl font-extrabold">{t("marketing.checklistTitle")}</h2>
      <p className="mb-4 mt-1 text-zinc-300">{t("marketing.checklistIntro")}</p>
      <p className="mb-4 text-sm text-[#4FE3C1]" aria-live="polite">{t("marketing.checklistProgress", { done: finished, total })}</p>
      <div className="space-y-4">
        {PHASES.map((phase) => (
          <fieldset key={phase.id} className="rounded-xl border border-[#3B3155] bg-[#241D3A] p-4">
            <legend className="px-2 text-sm font-bold text-[#B89CFF]">{phase[locale]}</legend>
            <ul className="space-y-2">
              {phase.items.map((item) => (
                <li key={item.id}>
                  <label className="flex cursor-pointer items-start gap-2 text-sm text-zinc-200">
                    <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[#4FE3C1]" checked={done.includes(item.id)} onChange={() => toggle(item.id)} />
                    <span className={done.includes(item.id) ? "text-zinc-500 line-through" : ""}>{item[locale]}</span>
                  </label>
                </li>
              ))}
            </ul>
          </fieldset>
        ))}
      </div>
    </section>
  );
}
