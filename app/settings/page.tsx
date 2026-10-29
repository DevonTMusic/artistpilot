import Link from "next/link";
import { redirect } from "next/navigation";
import Nav from "@/components/Nav";
import SettingsPanels from "@/components/SettingsPanels";
import { getCurrentSession } from "@/lib/auth/session";
import { query } from "@/lib/db";
import { getStripe } from "@/lib/stripe";
import { getLocale, translate } from "@/lib/i18n/server";
export default async function Settings() {
  const locale = await getLocale();
  const t = (key: string, values?: Record<string, string | number>) => translate(locale, key, values);
  const { user } = (await getCurrentSession()) ?? {};
  if (!user) redirect("/login");
  const { rows: [p] } = await query<{
    display_name: string | null;
    main_instrument: string;
    default_bpm: number;
    weekly_goal: number;
    notify_reminders: boolean;
    notify_news: boolean;
    is_paid: boolean;
    stripe_customer_id: string | null;
  }>("select * from profiles where id = $1", [user.id]);
  let card: { brand: string; last4: string; exp: string } | null = null;
  if (p?.stripe_customer_id) {
    try {
      const pms = await getStripe().paymentMethods.list({ customer: p.stripe_customer_id, type: "card", limit: 1 });
      const c = pms.data[0]?.card;
      if (c) card = { brand: c.brand, last4: c.last4, exp: `${String(c.exp_month).padStart(2, "0")}/${c.exp_year}` };
    } catch { /* show no card rather than failing the page */ }
  }
  const billing = (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
      <h2 className="text-xl font-bold">{t("settings.billingTitle")}</h2>
      <dl className="mt-4 space-y-3">
        <div><dt className="text-sm text-zinc-400">{t("settings.plan")}</dt><dd className="font-bold">{p?.is_paid ? t("settings.activePlan") : t("settings.noPlan")}</dd></div>
        <div><dt className="text-sm text-zinc-400">{t("settings.paymentMethod")}</dt>
          <dd className="font-bold">{card ? <span className="capitalize">{t("settings.cardEnding", { brand: card.brand, last4: card.last4, exp: card.exp })}</span> : p?.stripe_customer_id ? t("settings.noCard") : p?.is_paid ? t("settings.demoPayment") : t("settings.noneYet")}</dd></div>
      </dl>
      <div className="mt-5 flex flex-wrap gap-3">
        {p?.stripe_customer_id && (
          <form action="/api/portal" method="post"><button className="rounded-lg border border-zinc-700 px-4 py-2.5 font-bold hover:border-amber-500">{t("settings.billingAction")}</button></form>
        )}
        {!p?.is_paid && <Link href="/dashboard" className="rounded-lg bg-amber-500 text-zinc-950 hover:bg-amber-400 px-4 py-2.5 font-bold">{t("settings.getPlan")}</Link>}
      </div>
      <p className="mt-3 text-sm text-zinc-500">{t("settings.stripeNote")}</p>
    </section>
  );
  return (<>
    <Nav signedIn />
    <main className="mx-auto max-w-2xl px-5 py-12">
      <h1 className="text-3xl font-extrabold">{t("settings.title")}</h1>
      <p className="mb-6 mt-1 text-zinc-400">{t("settings.signedInAs", { email: user.email ?? "" })}</p>
      <SettingsPanels billing={billing} init={{
        displayName: p?.display_name ?? "", instrument: p?.main_instrument ?? "Guitar", bpm: p?.default_bpm ?? 92, goal: p?.weekly_goal ?? 5,
        reminders: !!p?.notify_reminders, news: !!p?.notify_news, isDemo: user.email === "demo@demo.com",
      }} />
    </main>
  </>);
}
