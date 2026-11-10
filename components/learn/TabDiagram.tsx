const STRINGS = ["e", "B", "G", "D", "A", "E"];

// columns: fret per string from high e to low E; null = not played
export function Tab({ columns, caption }: { columns: (number | null)[][]; caption?: string }) {
  const width = 50 + columns.length * 34;
  return (
    <figure className="my-3">
      <svg viewBox={`0 0 ${width} 120`} style={{ maxWidth: width * 2.5 }} className="w-full rounded-lg bg-[#F5F1FF]" role="img" aria-label={caption ?? "Guitar tablature"}>
        {STRINGS.map((name, i) => (
          <g key={name}>
            <text x="8" y={24 + i * 16 + 4} fontSize="12" fontWeight="700" fill="#5B3FC4">{name}</text>
            <line x1="24" x2={width - 6} y1={24 + i * 16} y2={24 + i * 16} stroke="#19152B" strokeWidth="1" />
          </g>
        ))}
        {columns.map((col, c) => col.map((fret, s) => fret === null ? null : (
          <g key={`${c}-${s}`}>
            <rect x={38 + c * 34 - 9} y={24 + s * 16 - 8} width="18" height="16" fill="#F5F1FF" />
            <text x={38 + c * 34} y={24 + s * 16 + 4} textAnchor="middle" fontSize="13" fontWeight="700" fill="#19152B">{fret}</text>
          </g>
        )))}
      </svg>
      {caption && <figcaption className="mt-1 text-xs text-zinc-400">{caption}</figcaption>}
    </figure>
  );
}

// frets: per string low E to high e; -1 = muted, 0 = open
export function ChordDiagram({ name, frets }: { name: string; frets: number[] }) {
  return (
    <figure className="inline-block text-center">
      <svg viewBox="0 0 80 100" className="h-28 w-24 rounded-lg bg-[#F5F1FF]" role="img" aria-label={`${name} chord: ${frets.map((f) => (f < 0 ? "x" : f)).join(" ")}`}>
        <text x="40" y="14" textAnchor="middle" fontSize="13" fontWeight="700" fill="#5B3FC4">{name}</text>
        {[0, 1, 2, 3, 4, 5].map((s) => <line key={s} x1={14 + s * 10.4} x2={14 + s * 10.4} y1="28" y2="92" stroke="#19152B" strokeWidth="1" />)}
        {[0, 1, 2, 3, 4].map((f) => <line key={f} x1="14" x2="66" y1={28 + f * 16} y2={28 + f * 16} stroke="#19152B" strokeWidth={f === 0 ? 3 : 1} />)}
        {frets.map((fret, s) => fret < 0
          ? <text key={s} x={14 + s * 10.4} y="24" textAnchor="middle" fontSize="10" fill="#19152B">x</text>
          : fret === 0
            ? <circle key={s} cx={14 + s * 10.4} cy="21" r="3" fill="none" stroke="#19152B" />
            : <circle key={s} cx={14 + s * 10.4} cy={28 + (fret - 0.5) * 16} r="4.5" fill="#5B3FC4" />)}
      </svg>
    </figure>
  );
}
