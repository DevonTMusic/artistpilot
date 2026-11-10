import type { DrumPatternData, MidiNoteData } from "@/lib/AudioEngine";

export type StarterProject = {
  id: string;
  name: { en: string; es: string };
  blurb: { en: string; es: string };
  bpm: number;
  key: string;
  scale: "maj" | "min";
  drums: Required<Pick<DrumPatternData, "kick" | "snare" | "hat" | "openHat" | "clap" | "percussion" | "swing">>;
  chords: number[][];
};

const row = (pattern: string) => Array.from({ length: 16 }, (_, index) => pattern[index] === "x");

export const STARTER_PROJECTS: StarterProject[] = [
  {
    id: "pop-vocal",
    name: { en: "Pop vocal", es: "Voz pop" },
    blurb: {
      en: "Steady beat and a four-chord loop with an empty vocal track ready to record on.",
      es: "Ritmo estable y un bucle de cuatro acordes con una pista de voz lista para grabar.",
    },
    bpm: 118,
    key: "C",
    scale: "maj",
    drums: {
      kick: row("x...x...x...x..."),
      snare: row("....x.......x..."),
      hat: row("x.x.x.x.x.x.x.x."),
      openHat: row("................"),
      clap: row("....x.......x..."),
      percussion: row("................"),
      swing: 0,
    },
    chords: [[60, 64, 67], [55, 59, 62], [57, 60, 64], [53, 57, 60]],
  },
  {
    id: "lofi-hip-hop",
    name: { en: "Lo-fi hip-hop", es: "Hip-hop lo-fi" },
    blurb: {
      en: "A slow, swung groove with jazzy chords. Great for rapping, humming or writing over.",
      es: "Un ritmo lento con swing y acordes de jazz. Ideal para rapear, tararear o escribir encima.",
    },
    bpm: 80,
    key: "A",
    scale: "min",
    drums: {
      kick: row("x.....x...x....."),
      snare: row("....x.......x..."),
      hat: row("x.x.x.x.x.x.x.x."),
      openHat: row("..............x."),
      clap: row("................"),
      percussion: row("................"),
      swing: 0.25,
    },
    chords: [[57, 60, 64, 67], [53, 57, 60, 64], [60, 64, 67, 71], [55, 59, 62, 65]],
  },
  {
    id: "dance-floor",
    name: { en: "Dance floor", es: "Pista de baile" },
    blurb: {
      en: "Four-on-the-floor kick with off-beat hats and a moody minor loop.",
      es: "Bombo en cada tiempo con hi-hats a contratiempo y un bucle menor con carácter.",
    },
    bpm: 124,
    key: "F",
    scale: "min",
    drums: {
      kick: row("x...x...x...x..."),
      snare: row("................"),
      hat: row("................"),
      openHat: row("..x...x...x...x."),
      clap: row("....x.......x..."),
      percussion: row("..x..x..x..x..x."),
      swing: 0,
    },
    chords: [[53, 56, 60], [49, 53, 56], [56, 60, 63], [51, 55, 58]],
  },
];

export const STARTER_BARS = 4;

export function buildChordNotes(chords: number[][]): MidiNoteData[] {
  return chords.flatMap((pitches, bar) =>
    pitches.map((pitch, index) => ({
      id: `starter-${bar}-${index}-${pitch}`,
      pitch,
      startStep: bar * 16,
      length: 15,
      velocity: 0.7,
    })),
  );
}
