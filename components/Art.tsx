"use client";

import { useLanguage } from "@/components/LanguageProvider";

// Original illustrations drawn as SVG. Swap any of these for real photos later (see README note).
const bars = (n: number, seed: number, amp: number) =>
  Array.from({ length: n }, (_, i) => Math.max(0.14, Math.abs(Math.sin(i * 0.9 + seed) * Math.cos(i * 0.31 + seed * 2))) * amp);
type P = { className?: string };
const Defs = ({ id }: { id: string }) => (
  <defs><linearGradient id={id} x1="0" x2="1" y1="0" y2="1"><stop offset="0" stopColor="#8b5cf6" /><stop offset="1" stopColor="#3b82f6" /></linearGradient></defs>
);

export function StudioArt({ className = "" }: P) {
  const { t } = useLanguage();
  const rows: [string, number][] = [["#a78bfa", 1], ["#8b5cf6", 2.3], ["#60a5fa", 3.1], ["#38bdf8", 4.7]];
  return (
    <svg viewBox="0 0 600 380" className={className} role="img" aria-label={t("art.studioTimeline")}>
      <Defs id="sa-g" />
      <rect x="4" y="4" width="592" height="372" rx="20" fill="#1b1b1f" stroke="#33333c" strokeWidth="2" />
      <rect x="4" y="4" width="592" height="44" rx="20" fill="#25252b" />
      <circle cx="28" cy="26" r="6" fill="#ef4444" /><circle cx="48" cy="26" r="6" fill="#eab308" /><circle cx="68" cy="26" r="6" fill="#22c55e" />
      <rect x="440" y="16" width="120" height="20" rx="10" fill="#121214" />
      <text x="500" y="31" textAnchor="middle" fontSize="12" fill="#a4a3b0" fontFamily="sans-serif">92 BPM</text>
      {rows.map(([c, s], r) => (
        <g key={r} transform={`translate(0 ${64 + r * 74})`}>
          <rect x="20" y="0" width="90" height="62" rx="10" fill="#25252b" />
          <circle cx="42" cy="31" r="10" fill={c} />
          <rect x="60" y="22" width="40" height="5" rx="2.5" fill="#44444d" /><rect x="60" y="34" width="28" height="5" rx="2.5" fill="#33333c" />
          <rect x="124" y="0" width="456" height="62" rx="10" fill="#121214" />
          {bars(76, s, 26).map((h, i) => <rect key={i} x={132 + i * 5.8} y={31 - h} width="3" height={h * 2} rx="1.5" fill={c} opacity=".9" />)}
        </g>
      ))}
      <rect x="330" y="58" width="3" height="298" fill="#fff" /><path d="M322 52h19l-9.5 12z" fill="url(#sa-g)" />
    </svg>
  );
}
export function MicArt({ className = "" }: P) {
  const { t } = useLanguage();
  return (
    <svg viewBox="0 0 300 300" className={className} role="img" aria-label={t("art.microphone")}>
      <Defs id="mi-g" />
      {[60, 90, 120].map((r) => <circle key={r} cx="150" cy="120" r={r} fill="none" stroke="url(#mi-g)" strokeOpacity={0.4 - r / 400} strokeWidth="2" />)}
      <rect x="112" y="50" width="76" height="110" rx="38" fill="#25252b" stroke="url(#mi-g)" strokeWidth="4" />
      {[75, 90, 105, 120, 135].map((y) => <line key={y} x1="122" x2="178" y1={y} y2={y} stroke="#55555f" strokeWidth="3" />)}
      <path d="M92 120a58 58 0 0 0 116 0" fill="none" stroke="url(#mi-g)" strokeWidth="6" strokeLinecap="round" />
      <rect x="146" y="178" width="8" height="56" fill="#55555f" /><rect x="110" y="234" width="80" height="10" rx="5" fill="url(#mi-g)" />
    </svg>
  );
}
export function GuitarArt({ className = "" }: P) {
  const { t } = useLanguage();
  return (
    <svg viewBox="0 0 300 300" className={className} role="img" aria-label={t("art.guitar")}>
      <Defs id="gu-g" />
      <g transform="translate(150 150) rotate(40) scale(0.85) translate(-150 -150)">
        <rect x="141" y="14" width="18" height="170" rx="4" fill="#44444d" />
        <path d="M137 14h26l4-26h-34z" fill="url(#gu-g)" />
        {[44, 74, 104, 134].map((y) => <line key={y} x1="141" x2="159" y1={y} y2={y} stroke="#a4a3b0" strokeWidth="2" />)}
        <circle cx="150" cy="196" r="44" fill="url(#gu-g)" /><circle cx="150" cy="244" r="54" fill="url(#gu-g)" />
        <rect x="126" y="192" width="48" height="9" rx="3" fill="#121214" /><rect x="126" y="218" width="48" height="9" rx="3" fill="#121214" />
        <rect x="134" y="256" width="32" height="6" rx="3" fill="#f2f1f6" />
        {[144, 150, 156].map((x) => <line key={x} x1={x} x2={x} y1="14" y2="259" stroke="#d4d3de" strokeWidth="1" />)}
      </g>
    </svg>
  );
}
export function PianoArt({ className = "" }: P) {
  const { t } = useLanguage();
  return (
    <svg viewBox="0 0 300 300" className={className} role="img" aria-label={t("art.piano")}>
      <Defs id="pi-g" />
      <rect x="14" y="60" width="272" height="30" rx="8" fill="url(#pi-g)" />
      {Array.from({ length: 7 }, (_, i) => <rect key={i} x={24 + i * 36} y="110" width="34" height="140" rx="5" fill="#f2f1f6" />)}
      {[0, 1, 3, 4, 5].map((i) => <rect key={i} x={24 + (i + 1) * 36 - 11} y="110" width="22" height="86" rx="4" fill="#121214" />)}
      <circle cx="60" cy="40" r="5" fill="#8b5cf6" /><circle cx="150" cy="32" r="5" fill="#3b82f6" /><circle cx="240" cy="40" r="5" fill="#a78bfa" />
    </svg>
  );
}
export function IdeaArt({ className = "" }: P) {
  const { t } = useLanguage();
  return (
    <svg viewBox="0 0 300 300" className={className} role="img" aria-label={t("art.idea")}>
      <Defs id="id-g" />
      <path d="M150 30L174 126 270 150 174 174 150 270 126 174 30 150 126 126Z" fill="url(#id-g)" />
      <path d="M232 36l7 21 21 7-21 7-7 21-7-21-21-7 21-7z" fill="#a78bfa" />
      <g fill="#f2f1f6"><ellipse cx="66" cy="240" rx="14" ry="10" transform="rotate(-20 66 240)" /><rect x="76" y="188" width="4" height="52" />
        <ellipse cx="108" cy="228" rx="14" ry="10" transform="rotate(-20 108 228)" /><rect x="118" y="176" width="4" height="52" /><rect x="76" y="176" width="46" height="8" /></g>
    </svg>
  );
}
