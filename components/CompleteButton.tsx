"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/components/LanguageProvider";
export default function CompleteButton({ lessonId, done }: { lessonId: string; done: boolean }) {
  const { t } = useLanguage();
  const router = useRouter();
  const [busy, setBusy] = useState(false); const [err, setErr] = useState("");
  if (done) return <p className="font-bold text-emerald-400">{t("progress.completed")}</p>;
  async function go() {
    setBusy(true); setErr("");
    const r = await fetch("/api/progress", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ lessonId }) });
    if (r.ok) router.refresh(); else setErr(t("progress.saveError"));
    setBusy(false);
  }
  return (<div>
    <button onClick={go} disabled={busy} className="rounded-lg bg-[#1DB954] text-black hover:bg-[#3ddc78] px-5 py-3 font-bold disabled:opacity-60">{t("progress.markComplete")}</button>
    {err && <p role="alert" className="mt-2 text-sm text-[#5ee38f]">{err}</p>}
  </div>);
}
