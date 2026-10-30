"use client";

import React from "react";
import { useLanguage } from "@/components/LanguageProvider";

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const NOTE_PITCH: Record<string, number> = {
  C: 0, "B#": 0, "C#": 1, Db: 1, "D#": 3, Eb: 3,
  D: 2, E: 4, Fb: 4, "E#": 5, F: 5, "F#": 6, Gb: 6,
  G: 7, "G#": 8, Ab: 8, A: 9, "A#": 10, Bb: 10,
  B: 11, Cb: 11,
};
const QUALITY_INTERVALS: Record<string, number[]> = {
  "": [0, 4, 7],
  m: [0, 3, 7],
  "7": [0, 4, 7, 10],
  maj7: [0, 4, 7, 11],
  m7: [0, 3, 7, 10],
  dim: [0, 3, 6],
  aug: [0, 4, 8],
  sus2: [0, 2, 7],
  sus4: [0, 5, 7],
};

const GUITAR_SHAPES: Record<string, number[]> = {
  C: [-1, 3, 2, 0, 1, 0],
  G: [3, 2, 0, 0, 3, 3],
  Am: [-1, 0, 2, 2, 1, 0],
  Em: [0, 2, 2, 0, 0, 0],
  D: [-1, -1, 0, 2, 3, 2],
  F: [1, 3, 3, 2, 1, 1],
};
const UKULELE_SHAPES: Record<string, number[]> = {
  C: [0, 0, 0, 3],
  G: [0, 2, 3, 2],
  Am: [2, 0, 0, 0],
  F: [2, 0, 1, 0],
  Em: [0, 4, 3, 2],
  Dm: [2, 2, 1, 0],
};

function parseChord(value: string) {
  const match = value.trim().match(/^([A-Ga-g](?:#|b|♯|♭)?)(maj7|m7|maj|major|min|minor|dim|aug|sus2|sus4|7|m)?$/i);
  if (!match) return null;
  const rootName = match[1].replace("♯", "#").replace("♭", "b");
  const pitch = NOTE_PITCH[rootName[0].toUpperCase() + rootName.slice(1)];
  if (pitch === undefined) return null;
  let quality = (match[2] ?? "").toLowerCase();
  if (quality === "major" || quality === "maj") quality = "";
  if (quality === "minor" || quality === "min") quality = "m";
  if (!QUALITY_INTERVALS[quality]) return null;
  return { root: pitch, rootName: NOTE_NAMES[pitch], quality, intervals: QUALITY_INTERVALS[quality] };
}

function PianoDiagram({ root, intervals, chordName }: { root: number; intervals: number[]; chordName: string }) {
  const { t } = useLanguage();
  const tones = new Set(intervals.map((interval) => (root + interval) % 12));
  const whiteNotes = [0, 2, 4, 5, 7, 9, 11];
  const blackNotes = [
    { pitch: 1, x: 32 }, { pitch: 3, x: 78 }, { pitch: 6, x: 170 }, { pitch: 8, x: 216 }, { pitch: 10, x: 262 },
  ];
  return (
    <svg viewBox="0 0 322 126" className="w-full max-w-sm" role="img" aria-label={t("chord.pianoAria", { chord: chordName })}>
      {whiteNotes.map((pitch, index) => (
        <g key={pitch}>
          <rect x={index * 46} y="5" width="46" height="116" rx="2" fill={tones.has(pitch) ? "#7dd3fc" : "#f4f4f5"} stroke="#71717a" />
          <text x={index * 46 + 23} y="110" textAnchor="middle" fontSize="11" fill="#18181b">{NOTE_NAMES[pitch]}</text>
        </g>
      ))}
      {blackNotes.map(({ pitch, x }) => (
        <g key={pitch}>
          <rect x={x} y="5" width="28" height="69" rx="2" fill={tones.has(pitch) ? "#a78bfa" : "#27272a"} stroke="#09090b" />
          {tones.has(pitch) && <text x={x + 14} y="62" textAnchor="middle" fontSize="8" fill="white">{NOTE_NAMES[pitch]}</text>}
        </g>
      ))}
    </svg>
  );
}

function FretboardDiagram({
  instrument,
  root,
  intervals,
  chordName,
}: {
  instrument: string;
  root: number;
  intervals: number[];
  chordName: string;
}) {
  const { t } = useLanguage();
  const isBass = instrument === "Bass";
  const strings = isBass ? ["G", "D", "A", "E"] : instrument === "Ukulele" ? ["A", "E", "C", "G"] : ["E", "B", "G", "D", "A", "E"];
  const openPitches = isBass ? [43, 38, 33, 28] : instrument === "Ukulele" ? [69, 64, 60, 67] : [64, 59, 55, 50, 45, 40];
  const knownShapes = isBass ? undefined : instrument === "Ukulele" ? UKULELE_SHAPES : GUITAR_SHAPES;
  const shape = knownShapes?.[chordName];
  const fretCount = 5;
  const width = 340;
  const height = strings.length * 27 + 38;
  const left = 42;
  const right = width - 12;
  const stringGap = 27;
  const fretGap = (right - left) / fretCount;
  const tones = new Set(intervals.map((interval) => (root + interval) % 12));

  return (
    <div>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full max-w-sm" role="img" aria-label={t("chord.fretAria", { chord: chordName, instrument: t(instrument === "Bass" ? "instrument.bass" : instrument === "Ukulele" ? "instrument.ukulele" : "instrument.guitar") })}>
        {strings.map((name, stringIndex) => {
          const y = 22 + stringIndex * stringGap;
          return (
            <g key={`${name}-${stringIndex}`}>
              <text x="8" y={y + 4} fontSize="10" fill="#a1a1aa">{name}</text>
              <line x1={left} y1={y} x2={right} y2={y} stroke="#a1a1aa" strokeWidth={Math.max(1, 3 - stringIndex * 0.35)} />
              {Array.from({ length: fretCount + 1 }, (_, fret) => (
                <line
                  key={fret}
                  x1={left + fret * fretGap}
                  y1={y - 11}
                  x2={left + fret * fretGap}
                  y2={y + 11}
                  stroke={fret === 0 ? "#f4f4f5" : "#52525b"}
                  strokeWidth={fret === 0 ? 3 : 1}
                />
              ))}
              {shape ? (
                shape[shape.length - 1 - stringIndex] < 0
                  ? <text x={left - 22} y={y + 4} fontSize="12" fill="#fda4af">×</text>
                  : shape[shape.length - 1 - stringIndex] === 0
                    ? <circle cx={left - 16} cy={y} r="4" fill="none" stroke="#a1a1aa" strokeWidth="1.5" />
                    : <circle cx={left + (shape[shape.length - 1 - stringIndex] - 0.5) * fretGap} cy={y} r="6" fill="#38bdf8" />
              ) : Array.from({ length: fretCount + 1 }, (_, fret) => {
                const pitch = (openPitches[stringIndex] + fret) % 12;
                if (!tones.has(pitch)) return null;
                const x = fret === 0 ? left - 16 : left + (fret - 0.5) * fretGap;
                return <circle key={fret} cx={x} cy={y} r="6" fill={pitch === root ? "#38bdf8" : "#a78bfa"} />;
              })}
            </g>
          );
        })}
        {Array.from({ length: fretCount }, (_, index) => (
          <text key={index} x={left + (index + 0.5) * fretGap} y={height - 2} textAnchor="middle" fontSize="8" fill="#71717a">{index + 1}</text>
        ))}
      </svg>
      {!shape && (
        <p className="mt-1 text-[10px] text-zinc-500">{t("chord.highlightHelp")}</p>
      )}
      {shape && <p className="mt-1 text-[10px] text-zinc-500">{t("chord.openStringHelp")}</p>}
    </div>
  );
}

export function ChordVisualizer({ instrument, chord }: { instrument: string; chord: string }) {
  const { t } = useLanguage();
  const parsed = parseChord(chord);
  if (!parsed) {
    return <p className="text-xs text-[#D0BCFF]">{t("chord.invalid")}</p>;
  }
  const chordName = `${parsed.rootName}${parsed.quality}`;
  const noteNames = parsed.intervals.map((interval) => NOTE_NAMES[(parsed.root + interval) % 12]);
  const displayInstrument = ["Guitar", "Bass", "Ukulele", "Piano"].includes(instrument) ? instrument : "Piano";
  const translatedInstrument = t(displayInstrument === "Bass" ? "instrument.bass" : displayInstrument === "Ukulele" ? "instrument.ukulele" : displayInstrument === "Piano" ? "instrument.piano" : "instrument.guitar");

  return (
    <section className="mt-4 rounded-xl border border-[#51456F] bg-[#101116] p-4">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h3 className="text-sm font-bold text-white">{t("chord.onInstrument", { chord: chordName, instrument: translatedInstrument })}</h3>
          <p className="mt-1 text-[11px] text-zinc-400">{t("chord.tones")} {noteNames.join(" · ")}</p>
        </div>
        <span className="text-[10px] text-zinc-500">{t("chord.visualReference")}</span>
      </div>
      {displayInstrument === "Piano"
        ? <PianoDiagram root={parsed.root} intervals={parsed.intervals} chordName={chordName} />
        : <FretboardDiagram instrument={displayInstrument} root={parsed.root} intervals={parsed.intervals} chordName={chordName} />}
    </section>
  );
}

export function normalizeChordName(value: string): string | null {
  const parsed = parseChord(value);
  return parsed ? `${parsed.rootName}${parsed.quality}` : null;
}
