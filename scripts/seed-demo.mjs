// Creates the grader demo account in your REAL Supabase project (confirmed email, paid access).
import { createClient } from "@supabase/supabase-js";
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const email = "demo@demo.com", password = "password123!";
let id;
const { data, error } = await sb.auth.admin.createUser({ email, password, email_confirm: true });
if (error) {
  const { data: l } = await sb.auth.admin.listUsers({ perPage: 1000 });
  const u = l?.users.find((x) => x.email === email);
  if (!u) throw error;
  id = u.id;
  await sb.auth.admin.updateUserById(id, { password, email_confirm: true });
} else id = data.user.id;
const { error: e2 } = await sb.from("profiles").upsert({ id, is_paid: true });
if (e2) throw e2;
console.log("Demo account ready:", email);
