import { notFound } from "next/navigation";
import Nav from "@/components/Nav";
import { getCurrentSession } from "@/lib/auth/session";
import { query } from "@/lib/db";
import { ensureFeedbackTable, isAdminEmail } from "@/lib/feedback";

export const dynamic = "force-dynamic";

export default async function FeedbackAdmin() {
  const session = await getCurrentSession();
  if (!isAdminEmail(session?.user?.email)) notFound();
  await ensureFeedbackTable();
  const { rows } = await query<{ id: string; email: string | null; category: string; message: string; created_at: Date }>(
    "select id, email, category, message, created_at from feedback order by created_at desc limit 500",
  );
  return (<>
    <Nav signedIn />
    <main className="mx-auto max-w-4xl px-5 py-12">
      <h1 className="text-3xl font-extrabold">Feedback ({rows.length})</h1>
      <div className="mt-6 space-y-3">
        {rows.length === 0 && <p className="text-zinc-400">No feedback yet.</p>}
        {rows.map((item) => (
          <article key={item.id} className="rounded-2xl border border-[#3B3155] bg-[#241D3A] p-4">
            <div className="flex flex-wrap gap-2 text-xs text-zinc-400">
              <span className="rounded bg-[#B89CFF]/20 px-2 py-0.5 text-[#D0BCFF]">{item.category}</span>
              <span>{item.email ?? "unknown"}</span>
              <span>{new Date(item.created_at).toLocaleString()}</span>
            </div>
            <p className="mt-2 whitespace-pre-wrap">{item.message}</p>
          </article>
        ))}
      </div>
    </main>
  </>);
}
