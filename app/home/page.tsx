import Link from "next/link";
import { redirect } from "next/navigation";
import Nav from "@/components/Nav";
import { IdeaArt, MicArt, PianoArt, StudioArt } from "@/components/Art";
import { getCurrentSession } from "@/lib/auth/session";
import { query } from "@/lib/db";
import { LESSONS } from "@/lib/lessons";
import { getLocale, translate } from "@/lib/i18n/server";
function Tile({ href, title, text, art, locked }: { href: string; title: string; text: string; art: React.ReactNode; locked: boolean }) {
  return (
    <Link href={locked ? "/dashboard" : href} className="overflow-hidden rounded-2xl border border-[#3B3155] bg-[#241D3A] transition hover:border-[#B89CFF]">
      <div className="p-5">
        <h2 className="text-xl font-bold">{title}{locked && <span className="ml-2 rounded bg-[#B89CFF]/20 px-2 py-0.5 text-xs text-[#D0BCFF]">Pro</span>}</h2>
        <p className="mt-1 text-zinc-400">{text}</p>
      </div>
    </Link>
  );
}
export default async function HomeHub() {
  const session = await getCurrentSession();
  const user = session?.user;
  if (!user) redirect("/login");
  const [{ rows: [profile] }, { rows: [{ count }] }] = await Promise.all([
    query<{ display_name: string | null; is_paid: boolean }>("select display_name, is_paid from profiles where id = $1", [user.id]),
    query<{ count: string }>("select count(*)::text as count from lesson_progress where user_id = $1", [user.id]),
  ]);
  const paid = !!profile?.is_paid;
  const name = profile?.display_name || user.email?.split("@")[0] || "there";
  const locale = await getLocale();
  const t = (key: string, values?: Record<string, string | number>) => translate(locale, key, values);
  const art = "mx-auto h-44 w-auto";
  return (<>
    <Nav signedIn />
    <main className="mx-auto max-w-5xl px-5 py-12">
      <h1 className="text-3xl font-extrabold md:text-4xl">{t("home.greeting", { name })}</h1>
      <p className="mt-2 text-zinc-400">{t("home.prompt")}</p>
      {!paid && (
        <div className="mt-6 rounded-2xl border border-[#B89CFF] bg-[#241D3A] p-5">
          <p className="font-bold">{t("home.unlock")}</p>
          <p className="text-zinc-400">{t("home.freePlan")}</p>
          <Link href="/dashboard" className="mt-3 inline-block rounded-lg bg-[#B89CFF] text-[#19152B] hover:bg-[#D0BCFF] px-4 py-2 font-bold">{t("home.seePlan")}</Link>
        </div>
      )}
      <div className="mt-8 grid gap-5 md:grid-cols-3">
        <Tile href="/studio" title={t("home.studioTitle")} text={t("home.studioText")} art={<MicArt className={art} />} locked={false} />
        <Tile href="/dashboard" title={t("home.ideaTitle")} text={t("home.ideaText")} art={<IdeaArt className={art} />} locked={!paid} />
        <Tile href="/academy" title={t("home.academyTitle")} text={t("home.lessonProgress", { done: Number(count ?? 0), total: LESSONS.length })} art={<PianoArt className={art} />} locked={false} />
      </div>
      <div className="mt-5 grid items-center gap-5 rounded-2xl border border-[#3B3155] bg-[#241D3A] p-5 md:grid-cols-[1fr_220px]">
        <div><h2 className="text-xl font-bold">{t("home.marketingTitle")}</h2><p className="mt-1 text-zinc-400">{t("home.marketingText")}</p></div>
        <StudioArt className="hidden h-24 w-full md:block" />
      </div>
    </main>
  </>);
}
