const WHITE = ["C", "D", "E", "F", "G", "A", "B"];
const BLACK: Record<string, string> = { C: "C#", D: "D#", F: "F#", G: "G#", A: "A#" };

export function Keyboard() {
  return (
    <figure className="my-3">
      <svg viewBox="0 0 280 110" className="w-full max-w-md rounded-lg bg-[#F5F1FF]" role="img" aria-label="One octave of piano keys: C D E F G A B with sharps">
        {WHITE.map((n, i) => (
          <g key={n}>
            <rect x={10 + i * 38} y="8" width="38" height="94" fill="white" stroke="#19152B" />
            <text x={29 + i * 38} y="94" textAnchor="middle" fontSize="13" fontWeight="700" fill="#5B3FC4">{n}</text>
          </g>
        ))}
        {WHITE.map((n, i) => BLACK[n] && (
          <g key={BLACK[n]}>
            <rect x={10 + (i + 1) * 38 - 12} y="8" width="24" height="58" fill="#19152B" />
            <text x={10 + (i + 1) * 38} y="58" textAnchor="middle" fontSize="8" fill="white">{BLACK[n]}</text>
          </g>
        ))}
      </svg>
    </figure>
  );
}

export function NoteLengths({ labels }: { labels: string[] }) {
  const rows = [{ label: labels[0], beats: 4 }, { label: labels[1], beats: 2 }, { label: labels[2], beats: 1 }, { label: labels[3], beats: 0.5 }];
  return (
    <div className="my-3 max-w-md space-y-1.5" role="img" aria-label={labels.join(", ")}>
      {rows.map((row) => (
        <div key={row.label} className="flex items-center gap-2 text-xs text-zinc-300">
          <div className="h-5 rounded bg-[#986FEF]" style={{ width: `${row.beats * 25}%` }} />
          <span>{row.label}</span>
        </div>
      ))}
    </div>
  );
}
