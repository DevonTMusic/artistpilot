import { query } from "@/lib/db";

export const isAdminEmail = (email?: string | null) => {
  const admins = (process.env.ADMIN_EMAILS ?? "").split(",").map((item) => item.trim().toLowerCase()).filter(Boolean);
  return !!email && admins.includes(email.toLowerCase());
};

export async function ensureFeedbackTable() {
  await query(`create table if not exists feedback (
    id bigserial primary key,
    user_id text,
    email text,
    category text not null default 'general',
    message text not null,
    created_at timestamptz not null default now()
  )`);
}
