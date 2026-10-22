"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { INSTRUMENTS } from "@/lib/lessons";
type Init = { displayName: string; instrument: string; bpm: number; goal: number; reminders: boolean; news: boolean; isDemo: boolean };
const card = "rounded-2xl border border-zinc-800 bg-zinc-900 p-6";
const input = "mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2.5 font-normal";
const btn = "rounded-lg border border-zinc-700 px-4 py-2.5 font-bold hover:border-violet-500 disabled:opacity-60";
const pri = "rounded-lg bg-gradient-to-r from-violet-500 to-blue-500 px-4 py-2.5 font-bold disabled:opacity-60";
async function post(url: string, body: unknown) {
  const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  return { ok: r.ok, error: (j as { error?: string }).error };
}
export default function SettingsPanels({ init, billing }: { init: Init; billing: React.ReactNode }) {
  const router = useRouter();
  const [f, setF] = useState(init); const [msg, setMsg] = useState("");
  const [cur, setCur] = useState(""); const [nxt, setNxt] = useState(""); const [pmsg, setPmsg] = useState("");
  const [conf, setConf] = useState(""); const [dmsg, setDmsg] = useState("");
  async function save(e: React.FormEvent) {
    e.preventDefault(); setMsg("Saving...");
    const r = await post("/api/settings", { display_name: f.displayName, main_instrument: f.instrument, default_bpm: Number(f.bpm), weekly_goal: Number(f.goal), notify_reminders: f.reminders, notify_news: f.news });
    setMsg(r.ok ? "Saved." : r.error || "Could not save."); if (r.ok) router.refresh();
  }
  async function pw(e: React.FormEvent) {
    e.preventDefault(); setPmsg("Updating...");
    const r = await post("/api/account", { action: "password", current: cur, next: nxt });
    setPmsg(r.ok ? "Password updated." : r.error || "Could not update."); if (r.ok) { setCur(""); setNxt(""); }
  }
  async function del(e: React.FormEvent) {
    e.preventDefault(); setDmsg("Deleting...");
    const r = await post("/api/account", { action: "delete", confirm: conf });
    if (r.ok) window.location.href = "/"; else setDmsg(r.error || "Could not delete.");
  }
  return (<div className="space-y-5">
    <form onSubmit={save} className={card}>
      <h2 className="text-xl font-bold">Profile and preferences</h2>
      <label className="mt-4 block text-sm font-bold">Display name<input className={input} maxLength={40} value={f.displayName} onChange={(e) => setF({ ...f, displayName: e.target.value })} /></label>
      <label className="mt-4 block text-sm font-bold">Main instrument
        <select className={input} value={f.instrument} onChange={(e) => setF({ ...f, instrument: e.target.value })}>{INSTRUMENTS.map((i) => <option key={i}>{i}</option>)}</select></label>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-bold">Studio starting tempo (BPM)<input className={input} type="number" min={50} max={200} value={f.bpm} onChange={(e) => setF({ ...f, bpm: Number(e.target.value) })} /></label>
        <label className="block text-sm font-bold">Weekly practice goal (hours)<input className={input} type="number" min={1} max={40} value={f.goal} onChange={(e) => setF({ ...f, goal: Number(e.target.value) })} /></label>
      </div>
      <h3 className="mt-6 font-bold">Notifications</h3>
      <label className="mt-2 flex items-center gap-2"><input type="checkbox" checked={f.reminders} onChange={(e) => setF({ ...f, reminders: e.target.checked })} />Practice reminders</label>
      <label className="mt-2 flex items-center gap-2"><input type="checkbox" checked={f.news} onChange={(e) => setF({ ...f, news: e.target.checked })} />Product updates and new features</label>
      <p className="mt-2 text-sm text-zinc-500">Your choices are saved now. Emails will start once reminders are built.</p>
      <div className="mt-5 flex items-center gap-4"><button className={pri}>Save changes</button><span role="status" className="text-sm text-emerald-400">{msg}</span></div>
    </form>
    {billing}
    <form onSubmit={pw} className={card}>
      <h2 className="text-xl font-bold">Security</h2>
      {init.isDemo ? <p className="mt-2 text-zinc-400">The shared demo account's password can't be changed.</p> : (<>
        <label className="mt-4 block text-sm font-bold">Current password<input className={input} type="password" autoComplete="current-password" value={cur} onChange={(e) => setCur(e.target.value)} required /></label>
        <label className="mt-4 block text-sm font-bold">New password (8+ characters)<input className={input} type="password" autoComplete="new-password" minLength={8} value={nxt} onChange={(e) => setNxt(e.target.value)} required /></label>
        <div className="mt-5 flex items-center gap-4"><button className={btn}>Change password</button><span role="status" className="text-sm text-emerald-400">{pmsg}</span></div>
      </>)}
    </form>
    <form onSubmit={del} className={card + " border-red-900"}>
      <h2 className="text-xl font-bold text-red-300">Delete account</h2>
      {init.isDemo ? <p className="mt-2 text-zinc-400">The shared demo account can't be deleted.</p> : (<>
        <p className="mt-2 text-zinc-400">This cancels your subscription and permanently removes your account and lesson progress. Recordings are never stored, so there is nothing else to lose.</p>
        <label className="mt-4 block text-sm font-bold">Type DELETE to confirm<input className={input} value={conf} onChange={(e) => setConf(e.target.value)} /></label>
        <div className="mt-5 flex items-center gap-4"><button className={btn + " border-red-700 text-red-300"} disabled={conf !== "DELETE"}>Delete my account</button><span role="alert" className="text-sm text-amber-300">{dmsg}</span></div>
      </>)}
    </form>
  </div>);
}
