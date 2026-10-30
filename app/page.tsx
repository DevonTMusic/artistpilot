import Link from "next/link";
import { redirect } from "next/navigation";
import Nav from "@/components/Nav";
import { getCurrentSession } from "@/lib/auth/session";
import { getLocale, translate } from "@/lib/i18n/server";

const primary = "inline-block rounded-full bg-[#B89CFF] px-6 py-3 font-bold text-[#19152B] hover:bg-[#D0BCFF]";
const frame = "rounded-lg border-2 border-[#3B3155] bg-[#241D3A] shadow-[8px_8px_0_#FF72B6]";

export default async function Home() {
  const { user } = (await getCurrentSession().catch(() => null)) ?? {};
  if (user) redirect("/home");
  const locale = await getLocale();
  const t = (key: string) => translate(locale, key);
  const photos = [
    ["/img/mic.jpg", "public.photoVoice"],
    ["/img/piano.jpg", "public.photoPiano"],
    ["/img/stage.jpg", "public.photoShare"],
  ];
  return (
    <>
      <Nav />
      <main>
        <section className="relative flex min-h-[78vh] items-center">
          <img src="/img/room.jpg" alt="" className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-0 bg-black/60" />
          <div className="relative mx-auto w-full max-w-5xl px-5 py-24">
            <h1 className="max-w-2xl text-5xl font-extrabold leading-[1.05] text-white md:text-7xl">{t("public.title")}</h1>
            <p className="mt-6 max-w-xl text-lg text-zinc-100">{t("public.description")}</p>
            <div className="mt-9 flex flex-wrap items-center gap-5">
              <Link href="/signup" className={primary}>{t("public.startFree")}</Link>
              <Link href="/login" className="font-semibold text-white underline underline-offset-4">{t("nav.login")}</Link>
            </div>
          </div>
        </section>

        <section id="how" className="bg-[#241D3A] text-white">
          <div className="mx-auto grid max-w-5xl items-center gap-10 px-5 py-20 md:grid-cols-2">
            <div>
              <h2 className="text-3xl font-extrabold md:text-4xl">{t("public.studioHead")}</h2>
              <p className="mt-4 text-lg text-zinc-300">{t("public.studioText")}</p>
            </div>
            <figure>
              <img src="/img/shot-drums.png" alt={t("public.drumsCaption")} className={frame} />
              <figcaption className="mt-5 text-sm font-semibold text-zinc-400">{t("public.drumsCaption")}</figcaption>
            </figure>
          </div>
          <div className="mx-auto grid max-w-5xl items-center gap-10 px-5 pb-20 md:grid-cols-2">
            <figure className="md:order-1">
              <img src="/img/shot-pianoroll.png" alt={t("public.rollCaption")} className={frame} />
              <figcaption className="mt-5 text-sm font-semibold text-zinc-400">{t("public.rollCaption")}</figcaption>
            </figure>
            <div>
              <h2 className="text-3xl font-extrabold md:text-4xl">{t("public.recordTitle")}</h2>
              <p className="mt-4 text-lg text-zinc-300">{t("public.recordText")}</p>
            </div>
          </div>
        </section>

        <section className="grid md:grid-cols-3">
          {photos.map(([src, label]) => (
            <div key={src} className="relative h-72 md:h-96">
              <img src={src} alt="" className="absolute inset-0 h-full w-full object-cover" />
              <div className="absolute inset-0 bg-black/35" />
              <p className="absolute bottom-5 left-6 text-2xl font-extrabold text-white">{t(label)}</p>
            </div>
          ))}
        </section>

        <section className="bg-[#322849]">
          <div className="mx-auto grid max-w-5xl items-center gap-10 px-5 py-20 md:grid-cols-2">
            <div>
              <h2 className="text-3xl font-extrabold text-white md:text-4xl">{t("public.labHead")}</h2>
              <p className="mt-4 text-lg text-zinc-300">{t("public.labText")}</p>
            </div>
            <img src="/img/shot-idealab.png" alt={t("public.labHead")} className={frame} />
          </div>
          <div className="mx-auto grid max-w-5xl items-center gap-10 px-5 pb-20 md:grid-cols-2">
            <img src="/img/shot-academy.png" alt={t("public.academyHead")} className={`${frame} md:order-1`} />
            <div>
              <h2 className="text-3xl font-extrabold text-white md:text-4xl">{t("public.academyHead")}</h2>
              <p className="mt-4 text-lg text-zinc-300">{t("public.academyText")}</p>
            </div>
          </div>
        </section>

        <section id="pricing" className="bg-[#4FE3C1] text-[#19152B]">
          <div className="mx-auto max-w-5xl px-5 py-20">
            <h2 className="text-3xl font-extrabold md:text-4xl">{t("public.planTitle")}</h2>
            <div className="mt-8 grid gap-6 md:grid-cols-2">
              <div className="rounded-lg bg-white p-6">
                <h3 className="text-xl font-bold">{t("public.freeName")}</h3>
                <p className="mt-1 text-4xl font-extrabold">$0</p>
                <ul className="mt-5 space-y-2">
                  <li>{t("public.freeItem1")}</li>
                  <li>{t("public.freeItem2")}</li>
                </ul>
                <Link href="/signup" className="mt-6 inline-block rounded-full border-2 border-[#3B3155] px-5 py-2.5 font-bold hover:bg-[#241D3A] hover:text-white">{t("public.startFree")}</Link>
              </div>
              <div className="rounded-lg bg-[#241D3A] p-6 text-white">
                <h3 className="text-xl font-bold">{t("public.planName")}</h3>
                <p className="mt-1 text-4xl font-extrabold">$12<span className="text-base font-medium text-zinc-400"> {t("public.month")}</span></p>
                <ul className="mt-5 space-y-2">
                  <li>{t("public.proItem1")}</li>
                  <li>{t("public.proItem2")}</li>
                  <li>{t("public.proItem3")}</li>
                  <li>{t("public.proItem4")}</li>
                </ul>
                <Link href="/signup" className={`${primary} mt-6`}>{t("public.getStarted")}</Link>
              </div>
            </div>
            <p className="mt-5 text-sm font-medium">{t("public.planFinePrint")}</p>
          </div>
        </section>

        <section className="bg-[#171328] text-white">
          <div className="mx-auto max-w-3xl px-5 py-16">
            <h2 className="text-2xl font-extrabold">{t("public.founderEyebrow")}</h2>
            <p className="mt-3 text-lg text-zinc-300">{t("public.founderBio")}</p>
            <p className="mt-3 text-sm font-semibold text-zinc-400">{t("public.founderName")}, {t("public.founderRole")}</p>
          </div>
        </section>
      </main>
      <footer className="bg-black py-6 text-center text-xs text-zinc-500">&copy; {new Date().getFullYear()} ArtistPilot</footer>
    </>
  );
}
