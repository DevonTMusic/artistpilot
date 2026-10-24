"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabaseBrowser } from "@/lib/supabase/client";
import { MicArt } from "@/components/Art";
type OAuthProvider = "google" | "apple" | "azure";

export default function AuthForm({ mode }: { mode: "in" | "up" }) {
  const router = useRouter();
  const [email, setEmail] = useState(""); const [password, setPassword] = useState("");
  const [msg, setMsg] = useState(""); const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("error") === "oauth") {
      setMsg("Sign-in with that provider could not be completed. Please try again.");
    }
  }, []);

  async function signInWith(provider: OAuthProvider) {
    setBusy(true); setMsg("");
    try {
      const scopes = provider === "apple" ? "name email" : provider === "azure" ? "email" : undefined;
      const { error } = await supabaseBrowser().auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=%2Fhome`,
          ...(scopes ? { scopes } : {}),
        },
      });
      if (error) {
        setMsg(error.message);
        setBusy(false);
      }
    } catch (cause) {
      setMsg(cause instanceof Error ? cause.message : "Could not start provider sign-in.");
      setBusy(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setMsg("");
    const sb = supabaseBrowser();
    if (mode === "up") {
      const { data, error } = await sb.auth.signUp({ email, password });
      if (error) setMsg(error.message);
      else if (data.session) { router.push("/home"); router.refresh(); }
      else setMsg("Almost there. Check your email and click the confirmation link, then log in.");
    } else {
      const { error } = await sb.auth.signInWithPassword({ email, password });
      if (error) setMsg(error.message); else { router.push("/home"); router.refresh(); }
    }
    setBusy(false);
  }
  const input = "mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-3 font-normal";
  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      <section className="relative hidden flex-col justify-between overflow-hidden bg-gradient-to-br from-violet-700/50 via-zinc-900 to-blue-700/40 p-12 lg:flex">
        <Link href="/" className="text-xl font-extrabold">ArtistPilot</Link>
        <div>
          <MicArt className="mx-auto h-64 w-auto" />
          <h2 className="mt-8 text-4xl font-extrabold leading-tight">Your music, all in one place.</h2>
          <ul className="mt-4 space-y-2 text-lg text-zinc-300">
            <li>Learn guitar, piano, bass and drums</li><li>Write your own ideas with an AI coach</li><li>Record, mix and export your songs</li>
          </ul>
        </div>
        <p className="text-sm text-zinc-400">The AI coaches you. The music stays yours.</p>
      </section>
      <section className="flex items-center justify-center px-5 py-16">
        <div className="w-full max-w-sm">
          <Link href="/" className="text-xl font-extrabold lg:hidden">ArtistPilot</Link>
          <h1 className="mb-2 mt-6 text-3xl font-extrabold lg:mt-0">{mode === "in" ? "Welcome back" : "Start your music journey"}</h1>
          <p className="mb-6 text-zinc-400">{mode === "in" ? "Log in to pick up where you left off." : "Create your free account in a minute."}</p>
          <div className="space-y-2">
            <button type="button" disabled={busy} onClick={() => signInWith("google")} className="flex w-full items-center justify-center gap-3 rounded-lg border border-zinc-700 bg-zinc-900 py-3 font-semibold hover:bg-zinc-800 disabled:opacity-60">
              <span aria-hidden="true" className="font-extrabold text-blue-400">G</span> Continue with Google
            </button>
            <button type="button" disabled={busy} onClick={() => signInWith("apple")} className="flex w-full items-center justify-center gap-3 rounded-lg border border-zinc-700 bg-zinc-900 py-3 font-semibold hover:bg-zinc-800 disabled:opacity-60">
              Continue with Apple
            </button>
            <button type="button" disabled={busy} onClick={() => signInWith("azure")} className="flex w-full items-center justify-center gap-3 rounded-lg border border-zinc-700 bg-zinc-900 py-3 font-semibold hover:bg-zinc-800 disabled:opacity-60">
              <span aria-hidden="true" className="grid grid-cols-2 gap-0.5"><i className="h-2 w-2 bg-red-500" /><i className="h-2 w-2 bg-green-500" /><i className="h-2 w-2 bg-blue-500" /><i className="h-2 w-2 bg-yellow-400" /></span> Continue with Microsoft
            </button>
          </div>
          <div className="my-5 flex items-center gap-3 text-xs text-zinc-500"><span className="h-px flex-1 bg-zinc-800" /> OR WITH EMAIL <span className="h-px flex-1 bg-zinc-800" /></div>
          <form onSubmit={submit} className="space-y-4">
            <label className="block text-sm font-bold">Email<input className={input} type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
            <label className="block text-sm font-bold">Password<input className={input} type="password" required minLength={8} autoComplete={mode === "in" ? "current-password" : "new-password"} value={password} onChange={(e) => setPassword(e.target.value)} /></label>
            <button disabled={busy} className="w-full rounded-lg bg-gradient-to-r from-violet-500 to-blue-500 py-3 font-bold disabled:opacity-60">{mode === "in" ? "Log in" : "Create account"}</button>
            {msg && <p role="alert" className="text-sm text-amber-300">{msg}</p>}
          </form>
          <p className="mt-6 text-sm text-zinc-400">
            {mode === "in" ? <>New here? <Link className="underline" href="/signup">Create an account</Link></> : <>Already have an account? <Link className="underline" href="/login">Log in</Link></>}
          </p>
        </div>
      </section>
    </main>
  );
}
