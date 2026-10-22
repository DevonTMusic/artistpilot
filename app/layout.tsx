import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "ArtistPilot – Learn music, create your sound, grow your career",
  description: "Learn guitar, piano, bass and drums, develop original ideas with an AI coach, record your music and promote yourself as an independent artist.",
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (<html lang="en"><body>{children}</body></html>);
}
