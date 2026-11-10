export type Clef = "treble" | "bass";

const LETTERS = ["C", "D", "E", "F", "G", "A", "B"];
const BOTTOM_Y = 90;
const STEP = 5;
const BOTTOM_NOTE = { treble: 30, bass: 18 }; // E4 and G2 as diatonic numbers

export function diatonic(note: string): number {
  const match = /^([A-G])(\d)$/.exec(note);
  if (!match) throw new Error(`Bad note ${note}`);
  return LETTERS.indexOf(match[1]) + 7 * Number(match[2]);
}

export function noteLetter(note: string): string {
  return note[0];
}

export default function Staff({ clef, notes, labels = false, caption }: { clef: Clef; notes: string[]; labels?: boolean; caption?: string }) {
  const width = Math.max(200, 80 + notes.length * 38);
  const yOf = (note: string) => BOTTOM_Y - (diatonic(note) - BOTTOM_NOTE[clef]) * STEP;
  const lineYs = [0, 1, 2, 3, 4].map((i) => BOTTOM_Y - i * 10);
  return (
    <figure className="my-3">
      <svg viewBox={`0 0 ${width} 140`} style={{ maxWidth: width * 2 }} className="w-full rounded-lg bg-[#F5F1FF]" role="img" aria-label={caption ?? `${clef} clef staff showing ${notes.join(", ")}`}>
        {lineYs.map((y) => <line key={y} x1="6" x2={width - 6} y1={y} y2={y} stroke="#19152B" strokeWidth="1.2" />)}
        <text x="10" y={clef === "treble" ? 98 : 74} fontSize={clef === "treble" ? 62 : 46} fill="#19152B" fontFamily="'Noto Music','Apple Symbols','Segoe UI Symbol',serif">{clef === "treble" ? "\u{1D11E}" : "\u{1D122}"}</text>
        {notes.map((note, index) => {
          const x = 80 + index * 38;
          const y = yOf(note);
          const ledgers: number[] = [];
          for (let ly = BOTTOM_Y + 10; ly <= Math.max(y, BOTTOM_Y + 10); ly += 10) if (y >= ly) ledgers.push(ly);
          for (let ly = BOTTOM_Y - 50; ly >= Math.min(y, BOTTOM_Y - 50); ly -= 10) if (y <= ly) ledgers.push(ly);
          const stemUp = y >= BOTTOM_Y - 20;
          return (
            <g key={`${note}-${index}`}>
              {ledgers.map((ly) => <line key={ly} x1={x - 11} x2={x + 11} y1={ly} y2={ly} stroke="#19152B" strokeWidth="1.2" />)}
              <ellipse cx={x} cy={y} rx="6.5" ry="5" fill="#19152B" transform={`rotate(-20 ${x} ${y})`} />
              <line x1={stemUp ? x + 6 : x - 6} x2={stemUp ? x + 6 : x - 6} y1={y} y2={stemUp ? y - 30 : y + 30} stroke="#19152B" strokeWidth="1.4" />
              {labels && <text x={x} y="130" textAnchor="middle" fontSize="13" fontWeight="700" fill="#5B3FC4">{noteLetter(note)}</text>}
            </g>
          );
        })}
      </svg>
      {caption && <figcaption className="mt-1 text-xs text-zinc-400">{caption}</figcaption>}
    </figure>
  );
}
