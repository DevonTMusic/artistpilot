import Link from "next/link";
import { redirect } from "next/navigation";
import Nav from "@/components/Nav";
import { GuitarArt, IdeaArt, MicArt, PianoArt, StudioArt } from "@/components/Art";
import { getCurrentSession } from "@/lib/auth/session";
import { getLocale, translate } from "@/lib/i18n/server";

const cta = "inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-violet-500 to-blue-500 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-violet-950/30 transition hover:brightness-110";

export default async function Home() {
  const { user } = (await getCurrentSession()) ?? {};
  if (user) redirect("/home");
  const locale = await getLocale();
  const t = (key: string) => translate(locale, key);
  const benefits = [
    ["public.benefitLessonsTitle", "public.benefitLessonsText"],
    ["public.benefitIdeasTitle", "public.benefitIdeasText"],
    ["public.benefitStudioTitle", "public.benefitStudioText"],
    ["public.benefitSharingTitle", "public.benefitSharingText"],
  ];

  return (
    <>
      <Nav />
      <main className="overflow-hidden">
        <section className="mx-auto max-w-6xl px-5 pt-10">
          <div className="rounded-2xl border border-white/10 bg-zinc-900/60 p-6 md:p-8">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-violet-300">{t("public.founderEyebrow")}</p>
            <h2 className="mt-2 text-2xl font-extrabold tracking-tight text-white md:text-3xl">{t("public.founderName")}</h2>
            <p className="mt-1 text-sm font-semibold text-sky-300">{t("public.founderRole")}</p>
            <p className="mt-3 max-w-3xl text-sm leading-relaxed text-zinc-300 md:text-base">{t("public.founderBio")}</p>
            <div className="mt-4 flex flex-wrap gap-4 text-sm font-semibold">
              <a href="https://artistpilot-sable.vercel.app" className="text-violet-300 underline-offset-4 hover:underline">{t("public.founderLive")}: artistpilot-sable.vercel.app</a>
              <a href="https://github.com/DevonTMusic/artistpilot" className="text-violet-300 underline-offset-4 hover:underline">{t("public.founderGithub")}: github.com/DevonTMusic/artistpilot</a>
            </div>
          </div>
        </section>
        <section className="relative mx-auto grid max-w-6xl items-center gap-8 px-5 pb-16 pt-14 md:grid-cols-[1.05fr_.95fr] md:gap-12 md:pb-24 md:pt-20">
          <div className="pointer-events-none absolute -left-40 -top-32 h-96 w-96 rounded-full bg-violet-600/15 blur-3xl" />
          <div className="relative">
            <span className="inline-flex items-center gap-2 rounded-full border border-violet-400/20 bg-violet-400/10 px-3 py-1.5 text-xs font-semibold text-violet-200">
              {t("public.tagline")}
            </span>
            <h1 className="mt-5 max-w-2xl text-4xl font-extrabold leading-[1.08] tracking-tight text-white sm:text-5xl md:text-6xl">
              {t("public.title")}
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-zinc-300 md:text-lg">
              {t("public.description")}
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link href="/signup" className={cta}>{t("public.proCta")}</Link>
              <Link href="/login" className="inline-flex items-center justify-center rounded-xl border border-zinc-700 bg-zinc-900/70 px-5 py-3 text-sm font-bold text-zinc-100 transition hover:border-zinc-500 hover:bg-zinc-800">{t("nav.login")}</Link>
            </div>
            <p className="mt-3 text-xs text-zinc-500">{t("public.planNote")}</p>
          </div>
          <div className="relative rounded-2xl border border-white/10 bg-gradient-to-br from-violet-500/10 via-zinc-900/80 to-blue-500/10 p-3 shadow-2xl shadow-violet-950/30">
            <StudioArt className="w-full" />
            <div className="absolute -bottom-4 left-5 rounded-xl border border-zinc-700 bg-[#15161c]/95 px-4 py-2.5 shadow-xl backdrop-blur">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">{t("public.nextIdea")}</p>
              <p className="mt-0.5 text-sm font-bold text-white">{t("public.startsHere")}</p>
            </div>
          </div>
        </section>

        <section className="border-y border-white/5 bg-zinc-950/50">
          <div className="mx-auto max-w-6xl px-5 py-14 md:py-16">
            <div className="max-w-2xl">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-sky-300">{t("public.progressLabel")}</p>
              <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-white md:text-4xl">{t("public.sectionTitle")}</h2>
              <p className="mt-3 text-sm leading-relaxed text-zinc-400 md:text-base">{t("public.sectionDescription")}</p>
            </div>
            <div className="mt-8 grid gap-4 md:grid-cols-3">
              {[
                { title: t("public.learnTitle"), text: t("public.learnText"), art: <GuitarArt className="mx-auto h-40 w-auto" /> },
                { title: t("public.ideaTitle"), text: t("public.ideaText"), art: <IdeaArt className="mx-auto h-40 w-auto" /> },
                { title: t("public.recordTitle"), text: t("public.recordText"), art: <MicArt className="mx-auto h-40 w-auto" /> },
              ].map((item) => (
                <article key={item.title} className="overflow-hidden rounded-2xl border border-zinc-800 bg-[#14151a] transition hover:-translate-y-1 hover:border-violet-500/60">
                  <div className="bg-gradient-to-br from-violet-900/20 to-blue-900/10 px-4 pt-3">{item.art}</div>
                  <div className="p-5">
                    <h3 className="text-lg font-bold text-white">{item.title}</h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-zinc-400">{item.text}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="pricing" className="mx-auto grid max-w-6xl gap-10 px-5 py-16 md:grid-cols-[.8fr_1.2fr] md:items-center md:py-20">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-violet-300">{t("public.planEyebrow")}</p>
            <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-white md:text-4xl">{t("public.planTitle")}</h2>
            <p className="mt-4 max-w-lg text-sm leading-relaxed text-zinc-400 md:text-base">{t("public.planDescription")}</p>
            <div className="mt-5 flex items-center gap-3">
              <PianoArt className="h-16 w-16 shrink-0" />
              <p className="text-xs leading-relaxed text-zinc-500">{t("public.deviceNote")}</p>
            </div>
          </div>

          <div className="rounded-2xl border border-violet-400/40 bg-gradient-to-br from-violet-950/30 to-zinc-900 p-6 shadow-xl shadow-violet-950/20 sm:p-8">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h3 className="text-xl font-bold text-white">{t("public.planName")}</h3>
                <p className="mt-1 text-xs text-zinc-400">{t("public.planDetail")}</p>
              </div>
              <p className="text-4xl font-extrabold text-white">$15<span className="text-sm font-medium text-zinc-400"> {t("public.month")}</span></p>
            </div>
            <ul className="mt-6 grid gap-x-6 gap-y-3 sm:grid-cols-2">
              {benefits.map(([title, description]) => (
                <li key={title} className="flex gap-2.5">
                  <span aria-hidden="true" className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full bg-emerald-400/15 text-[10px] font-bold text-emerald-300">✓</span>
                  <span>
                    <strong className="block text-xs font-semibold text-zinc-100">{t(title)}</strong>
                    <span className="mt-0.5 block text-[11px] leading-relaxed text-zinc-400">{t(description)}</span>
                  </span>
                </li>
              ))}
            </ul>
            <Link href="/signup" className={cta + " mt-7 w-full"}>{t("public.getStarted")}</Link>
            <p className="mt-3 text-center text-[11px] text-zinc-500">{t("public.planFinePrint")}</p>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-5 pb-16">
          <div className="flex flex-col items-start justify-between gap-5 rounded-2xl border border-zinc-800 bg-zinc-900/70 p-6 sm:flex-row sm:items-center sm:p-8">
            <div>
              <h2 className="text-xl font-bold text-white">{t("public.finalTitle")}</h2>
              <p className="mt-1 text-sm text-zinc-400">{t("public.finalText")}</p>
            </div>
            <Link href="/signup" className={cta}>{t("public.explore")}</Link>
          </div>
        </section>
      </main>
      <footer className="border-t border-zinc-800 py-7 text-center text-xs text-zinc-500">© {new Date().getFullYear()} ArtistPilot. {t("public.footer")}</footer>
    </>
  );
}
