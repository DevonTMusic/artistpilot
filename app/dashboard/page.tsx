import { redirect } from "next/navigation";
import Nav from "@/components/Nav";
import IdeaLab from "@/components/IdeaLab";
import { getCurrentSession } from "@/lib/auth/session";
import { query } from "@/lib/db";
import { getLocale, translate } from "@/lib/i18n/server";
export default async function Dashboard({ searchParams }: { searchParams: Promise<{ paid?: string; credits?: string }> }) {
  const { user } = (await getCurrentSession()) ?? {};
  if (!user) redirect("/login");
  const { rows: [p] } = await query<{ is_paid: boolean }>("select is_paid from profiles where id = $1", [user.id]);
  const sp = await searchParams;
  const locale = await getLocale();
  const t = (key: string) => translate(locale, key);
  return (<>
    <Nav signedIn />
    <main className="mx-auto max-w-5xl px-5 py-12">
      <h1 className="text-3xl font-extrabold">{t("ideas.title")}</h1>
      <p className="mb-8 mt-2 max-w-xl text-zinc-300">{t("ideas.intro")}</p>
      {sp.credits === "success" && <p role="status" className="mb-5 max-w-2xl rounded-lg border border-emerald-900 bg-emerald-950/30 p-3 text-sm text-emerald-100">{t("dashboard.paymentSuccess")}</p>}
      {sp.credits === "cancelled" && <p role="status" className="mb-5 max-w-2xl rounded-lg border border-zinc-800 bg-zinc-900 p-3 text-sm text-zinc-200">{t("dashboard.paymentCancelled")}</p>}
      {p?.is_paid ? <IdeaLab /> : (
        <div className="max-w-md rounded-2xl border border-violet-500 bg-zinc-900 p-8">
          {sp.paid ? <p className="mb-4 text-amber-200">{t("dashboard.subscriptionPending")}</p> : null}
          <h2 className="text-2xl font-bold">{t("dashboard.pro")}</h2>
          <p className="mt-2 text-zinc-300">{t("dashboard.subscribeText")}</p>
          <form action="/api/checkout" method="post"><button className="mt-6 w-full rounded-xl bg-gradient-to-r from-violet-500 to-blue-500 py-3 font-bold">{t("dashboard.getStarted")}</button></form>
        </div>
      )}
    </main>
  </>);
}
