"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { authClient } from "@/lib/auth/client";
import { useLanguage } from "@/components/LanguageProvider";

export default function AuthForm({ mode }: { mode: "in" | "up" }) {
  const router = useRouter();
  const { t } = useLanguage();
  const [email, setEmail] = useState(""); const [password, setPassword] = useState("");
  const [msg, setMsg] = useState(""); const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setMsg("");
    try {
      const result = mode === "up"
        ? await authClient.signUp.email({
          email,
          password,
          name: email.split("@")[0] || "Artist",
        })
        : await authClient.signIn.email({ email, password });
      if (result.error) setMsg(result.error.message || "Authentication failed. Please try again.");
      else { router.push("/home"); router.refresh(); }
    } catch {
      setMsg("Could not connect to ArtistPilot. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }
  const input = "mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-3 font-normal";
  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      <section className="hidden flex-col justify-between border-r border-zinc-800 bg-zinc-900 p-12 lg:flex">
        <Link href="/" className="text-xl font-extrabold">ArtistPilot</Link>
        <div>
          <h2 className="text-4xl font-extrabold leading-tight">{t("auth.sideTitle")}</h2>
          <ul className="mt-4 space-y-2 text-lg text-zinc-300">
            <li>{t("auth.lessonBlurb")}</li><li>{t("auth.ideaBlurb")}</li><li>{t("auth.studioBlurb")}</li>
          </ul>
        </div>
        <p className="text-sm text-zinc-400">{t("auth.tagline")}</p>
      </section>
      <section className="flex items-center justify-center px-5 py-16">
        <div className="w-full max-w-sm">
          <Link href="/" className="text-xl font-extrabold lg:hidden">ArtistPilot</Link>
          <h1 className="mb-2 mt-6 text-3xl font-extrabold lg:mt-0">{mode === "in" ? t("auth.welcome") : t("auth.start")}</h1>
          <p className="mb-6 text-zinc-400">{mode === "in" ? t("auth.loginPrompt") : t("auth.signupPrompt")}</p>
          <form onSubmit={submit} className="space-y-4">
            <label className="block text-sm font-bold">{t("auth.email")}<input className={input} type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
            <label className="block text-sm font-bold">{t("auth.password")}<input className={input} type="password" required minLength={8} autoComplete={mode === "in" ? "current-password" : "new-password"} value={password} onChange={(e) => setPassword(e.target.value)} /></label>
            <button disabled={busy} className="w-full rounded-lg bg-[#1DB954] text-black hover:bg-[#3ddc78] py-3 font-bold disabled:opacity-60">{mode === "in" ? t("auth.loginButton") : t("auth.signupButton")}</button>
            {msg && <p role="alert" className="text-sm text-[#5ee38f]">{msg}</p>}
          </form>
          <p className="mt-6 text-sm text-zinc-400">
            {mode === "in" ? <>{t("auth.newHere")} <Link className="underline" href="/signup">{t("auth.createAccount")}</Link></> : <>{t("auth.already")} <Link className="underline" href="/login">{t("auth.loginLink")}</Link></>}
          </p>
        </div>
      </section>
    </main>
  );
}
