"use client";

import Link from "next/link";
import { useLanguage } from "@/components/LanguageProvider";
import { authClient } from "@/lib/auth/client";

export default function Nav({ signedIn }: { signedIn?: boolean }) {
  const { locale, setLocale, t } = useLanguage();
  const link = "text-zinc-300 hover:text-white";
  return (
    <header className="border-b border-zinc-800">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-5 py-3">
        <Link href={signedIn ? "/home" : "/"} className="flex items-center gap-2 rounded text-xl font-extrabold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sky-400">
          ArtistPilot
        </Link>
        <nav aria-label={t("nav.main")} className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm sm:text-base">
          {signedIn ? (<>
            <Link className={link} href="/home">{t("nav.home")}</Link>
            <Link className={link} href="/academy">{t("nav.academy")}</Link>
            <Link className={link} href="/studio">{t("nav.studio")}</Link>
            <Link className={link} href="/dashboard">{t("nav.ideas")}</Link>
            <Link className={link} href="/settings">{t("nav.settings")}</Link>
            <button className={link} onClick={() => void authClient.signOut().then(() => window.location.assign("/"))}>{t("nav.logout")}</button>
          </>) : (<>
            <Link className={link} href="/#how">{t("nav.how")}</Link>
            <Link className={link} href="/#pricing">{t("nav.pricing")}</Link>
            <Link className={link} href="/login">{t("nav.login")}</Link>
            <Link href="/signup" className="rounded-lg bg-[#1DB954] text-black hover:bg-[#3ddc78] px-4 py-2 font-bold ">{t("nav.signup")}</Link>
          </>)}
          <label className="flex items-center gap-2 text-xs text-zinc-400">
            <span>{t("language.label")}</span>
            <select
              aria-label={t("language.label")}
              value={locale}
              onChange={(event) => setLocale(event.target.value === "es" ? "es" : "en")}
              className="rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-sm text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400"
            >
              <option value="en">{t("language.english")}</option>
              <option value="es">{t("language.spanish")}</option>
            </select>
          </label>
        </nav>
      </div>
    </header>
  );
}
