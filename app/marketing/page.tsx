import Link from "next/link";
import Nav from "@/components/Nav";
import PromoTools from "@/components/PromoTools";
import ReleaseChecklist from "@/components/ReleaseChecklist";
import { requireUser } from "@/lib/access";
import { getLocale, translate } from "@/lib/i18n/server";

export default async function Marketing() {
  const { isPro } = await requireUser();
  const locale = await getLocale();
  const t = (key: string) => translate(locale, key);
  return (<>
    <Nav signedIn />
    <main className="mx-auto max-w-5xl px-5 py-12">
      <h1 className="text-3xl font-extrabold">{t("home.marketingTitle")}</h1>
      <p className="mt-2 max-w-xl text-zinc-300">{t("marketing.intro")}</p>
      {isPro ? <PromoTools /> : (
        <div className="mt-8 max-w-md rounded-2xl border border-[#B89CFF] bg-[#241D3A] p-6">
          <h2 className="text-lg font-bold">{t("marketing.proTitle")}</h2>
          <p className="mt-1 text-zinc-300">{t("marketing.proText")}</p>
          <Link href="/dashboard" className="mt-4 inline-block rounded-lg bg-[#B89CFF] px-4 py-2 font-bold text-[#19152B] hover:bg-[#D0BCFF]">{t("home.seePlan")}</Link>
        </div>
      )}
      <ReleaseChecklist />
    </main>
  </>);
}
