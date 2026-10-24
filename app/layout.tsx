import type { Metadata } from "next";
import { cookies } from "next/headers";
import { LanguageProvider } from "@/components/LanguageProvider";
import type { Locale } from "@/lib/i18n/messages";
import "./globals.css";
export const metadata: Metadata = {
  title: "ArtistPilot – Learn music, create your sound, grow your career",
  description: "Learn guitar, piano, bass and drums, develop original ideas with an AI coach, record your music and promote yourself as an independent artist.",
};
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const savedLocale = cookieStore.get("artistpilot-language")?.value;
  const locale: Locale = savedLocale === "es" ? "es" : "en";
  return (
    <html lang={locale}>
      <body>
        <LanguageProvider initialLocale={locale}>{children}</LanguageProvider>
      </body>
    </html>
  );
}
