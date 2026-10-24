import { headers } from "next/headers";
import { auth } from "@/lib/auth/server";

export async function getCurrentSession() {
  return auth.api.getSession({ headers: await headers() });
}
