import { cookies } from "next/headers";
import { Locale, translate } from "@/lib/i18n/messages";

export async function getLocale(): Promise<Locale> {
  const stored = (await cookies()).get("artistpilot-language")?.value;
  return stored === "es" ? "es" : "en";
}

export { translate };
