import Link from "next/link";
import { redirect } from "next/navigation";
import Nav from "@/components/Nav";
import { getCurrentSession } from "@/lib/auth/session";
import { getLocale, translate } from "@/lib/i18n/server";

const button = "inline-block rounded bg-amber-500 px-5 py-2.5 font-semibold text-zinc-950 hover:bg-amber-400";

export default async function Home() {
  const { user } = (await getCurrentSession()) ?? {};
  if (user) redirect("/home");
  const locale = await getLocale();
  const t = (key: string) => translate(locale, key);
  const features = [
    ["public.learnTitle", "public.learnText"],
    ["public.ideaTitle", "public.ideaText"],
    ["public.recordTitle", "public.recordText"],
  ];
  return (
    <>
      <Nav />
      <main>
        <section className="mx-auto max-w-3xl px-5 pb-14 pt-16 md:pt-24">
          <h1 className="text-4xl font-bold leading-tight text-white md:text-5xl">{t("public.title")}</h1>
          <p className="mt-5 max-w-xl text-lg text-zinc-300">{t("public.description")}</p>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Link href="/signup" className={button}>{t("public.startFree")}</Link>
            <Link href="/login" className="text-zinc-300 underline hover:text-white">{t("nav.login")}</Link>
          </div>
        </section>

        <section id="how" className="mx-auto max-w-3xl border-t border-zinc-800 px-5 py-12">
          <h2 className="text-2xl font-bold text-white">{t("public.sectionTitle")}</h2>
          <ul className="mt-6 space-y-6">
            {features.map(([title, text]) => (
              <li key={title}>
                <h3 className="text-lg font-semibold text-white">{t(title)}</h3>
                <p className="mt-1 text-zinc-400">{t(text)}</p>
              </li>
            ))}
          </ul>
        </section>

        <section id="pricing" className="mx-auto max-w-3xl border-t border-zinc-800 px-5 py-12">
          <h2 className="text-2xl font-bold text-white">{t("public.planTitle")}</h2>
          <div className="mt-6 grid gap-6 sm:grid-cols-2">
            <div className="border border-zinc-800 p-5">
              <h3 className="font-semibold text-white">{t("public.freeName")}</h3>
              <p className="mt-1 text-2xl font-bold text-white">$0</p>
              <ul className="mt-4 space-y-1.5 text-sm text-zinc-300">
                <li>{t("public.freeItem1")}</li>
                <li>{t("public.freeItem2")}</li>
              </ul>
              <Link href="/signup" className="mt-5 inline-block text-sm text-amber-400 underline">{t("public.startFree")}</Link>
            </div>
            <div className="border border-zinc-700 p-5">
              <h3 className="font-semibold text-white">{t("public.planName")}</h3>
              <p className="mt-1 text-2xl font-bold text-white">$12<span className="text-sm font-normal text-zinc-400"> {t("public.month")}</span></p>
              <ul className="mt-4 space-y-1.5 text-sm text-zinc-300">
                <li>{t("public.proItem1")}</li>
                <li>{t("public.proItem2")}</li>
                <li>{t("public.proItem3")}</li>
                <li>{t("public.proItem4")}</li>
              </ul>
              <Link href="/signup" className="mt-5 inline-block text-sm text-amber-400 underline">{t("public.getStarted")}</Link>
            </div>
          </div>
          <p className="mt-4 text-sm text-zinc-500">{t("public.planFinePrint")}</p>
        </section>

        <section className="mx-auto max-w-3xl border-t border-zinc-800 px-5 py-12">
          <h2 className="text-2xl font-bold text-white">{t("public.founderEyebrow")}</h2>
          <p className="mt-3 text-zinc-300">{t("public.founderBio")}</p>
          <p className="mt-3 text-sm text-zinc-500">{t("public.founderName")}, {t("public.founderRole")}</p>
        </section>
      </main>
      <footer className="border-t border-zinc-800 py-6 text-center text-xs text-zinc-500">&copy; {new Date().getFullYear()} ArtistPilot</footer>
    </>
  );
}
