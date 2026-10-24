import type { DrumPatternData, GuitarAmpSettings, SynthSettings, TrackProcessingSettings } from "@/lib/AudioEngine";

export type SoundCategory = "vocals" | "guitar" | "bass" | "keys" | "drums";

export interface SoundPreset {
  id: string;
  name: string;
  category: SoundCategory;
  description: string;
  tags: string[];
  processing?: Partial<TrackProcessingSettings>;
  synth?: Partial<SynthSettings>;
  amp?: Partial<GuitarAmpSettings>;
  drums?: Partial<DrumPatternData>;
}

const vocalPresets = [
  ["Narrator", "Clear, centered speech with gentle control", ["speech", "clean"]],
  ["Warm Narrator", "Rounded low mids and subtle compression", ["speech", "warm"]],
  ["Broadcast Voice", "Forward presence for spoken word", ["speech", "radio"]],
  ["Podcast Close", "Intimate, controlled close-mic voice", ["speech", "podcast"]],
  ["Airy Lead", "Open vocal top with restrained sibilance", ["lead", "airy"]],
  ["Fuzzy Vocal", "Dense, driven character for an edge-forward vocal", ["creative", "fuzzy"]],
  ["Dream Vocal", "Softened highs with a wide ambient feel", ["creative", "ambient"]],
  ["Chorus Voice", "Present vocal tone with a subtle modulated layer", ["creative", "chorus"]],
  ["Doubled Vocal", "Focused EQ and controlled dynamics for doubles", ["lead", "double"]],
  ["Intimate Lead", "Close, soft compression with restrained ambience", ["lead", "intimate"]],
  ["Power Lead", "Firm compression and clear upper mids", ["lead", "power"]],
  ["Soft Ballad", "Smooth dynamics and gentle reverb", ["lead", "ballad"]],
  ["Bright Pop Lead", "Polished presence with sibilance control", ["lead", "pop"]],
  ["Indie Vocal", "Natural tone with light ambience", ["lead", "indie"]],
  ["Lo-Fi Vocal", "Softened top end for a vintage texture", ["creative", "lo-fi"]],
  ["Choir Layer", "Gentle compression and spacious reverb", ["layer", "choir"]],
  ["Backing Vocal", "Tamed dynamics for supportive layers", ["layer", "backing"]],
  ["Rap Vocal", "Tight dynamics and crisp articulation", ["lead", "rap"]],
  ["Whisper", "Low compression and very light ambience", ["speech", "whisper"]],
  ["Sibilance Tamer", "Focused de-essing for sharp S sounds", ["repair", "de-esser"]],
  ["Room Vocal", "Natural room-style ambience", ["space", "room"]],
  ["Telephone Voice", "Narrowed mid-focused character", ["creative", "telephone"]],
  ["Vintage Tape Voice", "Warm mids and softened highs", ["creative", "vintage"]],
  ["Acoustic Singer", "Clear, gentle vocal chain for acoustic songs", ["lead", "acoustic"]],
  ["Stage Vocal", "Controlled live-style vocal with noise gate", ["live", "stage"]],
  ["Gentle Spoken Word", "Unobtrusive processing for narration", ["speech", "natural"]],
  ["Dramatic Voiceover", "Strong, forward dynamics for voiceover", ["speech", "cinematic"]],
  ["Breathy Pop", "Open, airy sound with sibilance management", ["lead", "breathy"]],
  ["Dark Alt Vocal", "Darker tone with a close, controlled feel", ["lead", "alternative"]],
  ["Wide Layer", "Bright, controlled backing vocal tone", ["layer", "wide"]],
].map(([name, description, tags], index): SoundPreset => ({
  id: `vocal-${index}`,
  name: name as string,
  category: "vocals",
  description: description as string,
  tags: tags as string[],
  processing: {
    compEnabled: index % 5 !== 19,
    compAmount: [0.12, 0.2, 0.3, 0.4, 0.52, 0.64][index % 6],
    eqEnabled: ![18, 19, 25].includes(index),
    lowGain: [0, -1, 1, -2, 0.5][index % 5],
    midGain: [0, 1, -1, 1.5, -0.5][index % 5],
    highGain: [0, 1, 2, -1, 0.5][index % 5],
    lowCut: ![1, 18, 25].includes(index),
    ambienceSend: [0, 0.04, 0.08, 0.12][index % 4],
    reverbSend: [0, 0.04, 0.1, 0.16, 0.22][index % 5],
    deEsserEnabled: [4, 6, 12, 18, 19, 23, 27].includes(index),
    deEsserAmount: [0.25, 0.4, 0.55, 0.7][index % 4],
  },
  ...([5, 6, 7, 15, 21, 22].includes(index) ? {
    amp: {
      drive: index === 5 ? 0.58 : index === 21 ? 0.25 : 0.08,
      bass: index === 22 ? 1 : 0,
      mid: index === 21 ? 2 : 0,
      treble: index === 22 ? -2 : 0,
      master: 0.8,
      cabSim: false,
      driveEnabled: index === 5 || index === 21 || index === 22,
      delay: index === 6 ? 0.12 : 0,
      delayEnabled: index === 6,
      chorusEnabled: index === 6 || index === 7 || index === 15,
      reverb: index === 6 || index === 15 ? 0.22 : 0.06,
      reverbEnabled: index === 6 || index === 15,
    },
  } : {}),
}));

const guitarNames = [
  ["Steel String Acoustic", "Natural acoustic tone with a gentle top-end trim"],
  ["Nylon Fingerstyle", "Soft, detailed response for fingerpicked parts"],
  ["Dreadnought Strum", "Full low end for broad acoustic strums"],
  ["Acoustic DI", "Clean, uncolored input with cabinet simulation bypassed"],
  ["90s Alternative Clean", "Bright, slightly driven alternative-rock tone"],
  ["90s Alternative Crunch", "Mid-forward crunch for 90s rhythm guitars"],
  ["90s Grunge", "Dense, heavy drive with a softened cabinet top"],
  ["Indie Jangle", "Bright, clean tone with a little modulation"],
  ["Classic Rock Crunch", "Balanced vintage crunch"],
  ["Modern Rhythm", "Tight, controlled rhythm-guitar drive"],
  ["Ambient Swell", "Clean tone with spacious modulation and reverb"],
  ["Blues Breakup", "Low-gain warmth and responsive mids"],
  ["Surf Clean", "Bright clean tone with space"],
  ["Fuzz Wall", "High-drive saturated guitar character"],
  ["Muted Funk", "Clear, percussive clean guitar tone"],
  ["Shoegaze Wash", "Driven, wide, reverberant guitar"],
  ["Studio Lead", "Present lead sound with moderate sustain"],
  ["Lo-Fi Guitar", "Soft, dark, vintage-style guitar"],
].map(([name, description], index): SoundPreset => ({
  id: `guitar-${index}`,
  name: name as string,
  category: "guitar",
  description: description as string,
  tags: ["guitar", index < 4 ? "acoustic" : "electric", index >= 4 && index <= 6 ? "90s" : "amp"],
  amp: {
    drive: [0, 0.08, 0.18, 0.12, 0.32, 0.55, 0.82, 0.15, 0.48, 0.58, 0.12, 0.28, 0.1, 0.95, 0.12, 0.7, 0.45, 0.38][index],
    bass: [0, -1, 2, 0, -1, 1, 2, 0, 1, 0, 0, 1, -1, 1, -2, 2, 0, 0][index],
    mid: [0, 0, -1, 0, 1, 2, 1, 0, 1, 0, -1, 2, 0, -1, 1, 1, 2, 0][index],
    treble: [-1, -2, -1, 0, 1, 0, -2, 2, 0, 1, 0, 0, 2, -2, 1, -2, 2, -2][index],
    master: 0.85,
    cabSim: index !== 3,
    driveEnabled: index >= 4 && index !== 7 && index !== 10 && index !== 12 && index !== 14,
    delay: index === 10 || index === 15 ? 0.25 : 0,
    delayEnabled: index === 10 || index === 15,
    chorusEnabled: [7, 10, 15].includes(index),
    reverb: [1, 10, 12, 15].includes(index) ? 0.25 : 0.08,
    reverbEnabled: [1, 10, 12, 15].includes(index),
  },
}));

const bassNames = [
  ["Fingerstyle Bass", "Round low end with a soft attack"],
  ["Picked Bass", "Focused mids for definition in dense mixes"],
  ["Upright Bass", "Warm, woody low-frequency response"],
  ["Vintage Electric Bass", "Full vintage tone with gentle saturation"],
  ["Modern Clean Bass", "Tight, clean low end"],
  ["90s Alternative Bass", "Forward midrange and gritty edge"],
  ["Sub Bass", "Deep, clean fundamentals"],
  ["Funk Bass", "Clear transients and lively upper mids"],
  ["Muted Bass", "Soft, controlled low end"],
  ["Bass Drive", "Saturated, assertive bass tone"],
  ["Dub Bass", "Deep tone with spacious echo"],
  ["Acoustic Bass", "Natural, restrained upright character"],
].map(([name, description], index): SoundPreset => ({
  id: `bass-${index}`,
  name: name as string,
  category: "bass",
  description: description as string,
  tags: ["bass", ["finger", "pick", "upright", "vintage", "modern", "90s", "sub", "funk", "muted", "drive", "dub", "acoustic"][index]],
  amp: {
    drive: [0.12, 0.24, 0.06, 0.28, 0.04, 0.55, 0, 0.15, 0.04, 0.65, 0.18, 0.05][index],
    bass: [2, 1, 2, 1, 0, 1, 3, 1, 0, 2, 3, 1][index],
    mid: [0, 2, -1, 0, 0, 2, -2, 1, -1, 1, -1, 0][index],
    treble: [-1, 1, -2, -1, 0, 0, -2, 2, -2, 0, -2, -1][index],
    master: 0.85,
    cabSim: index !== 6,
    driveEnabled: [3, 5, 9].includes(index),
    delay: index === 10 ? 0.2 : 0,
    delayEnabled: index === 10,
    chorusEnabled: false,
    reverb: index === 2 || index === 11 ? 0.1 : 0,
    reverbEnabled: index === 2 || index === 11,
  },
}));

const keyNames = [
  ["Concert Grand", "Bright, expressive grand piano"],
  ["Felt Piano", "Soft felted piano for intimate parts"],
  ["Studio Upright", "Compact, punchy upright piano"],
  ["Tine Electric", "Bell-like electric piano"],
  ["Glass Keys", "Bright, delicate digital keys"],
  ["Warm Analog Pad", "Slow, warm sustained chords"],
  ["Subtractive Bass", "Focused synth bass"],
  ["Mono Lead", "Direct monophonic-style lead"],
  ["Pluck Sequence", "Short-decay pluck for rhythmic parts"],
  ["Soft Organ", "Smooth sustained organ-like tone"],
  ["Bright Organ", "Bright, harmonically rich organ tone"],
  ["Dream Pad", "Slow-attack atmospheric pad"],
  ["Retro Square Lead", "Square-wave retro lead"],
  ["Saw Stack", "Rich sawtooth synth texture"],
  ["Muted Bell", "Soft, rounded bell-like sound"],
  ["Marimba Keys", "Percussive mallet-like synth"],
  ["Deep 808 Bass", "Low, rounded synthesized bass"],
  ["Warm EP", "Soft electric-piano style patch"],
  ["Glass Pad", "Airy sustained texture"],
  ["Pulse Bass", "Tight pulsing low-end patch"],
  ["Soft Pluck", "Gentle, rounded plucked patch"],
  ["Brass Synth", "Bright, brassy synth patch"],
  ["Ambient Keys", "Soft keys with a long release"],
  ["Chime Synth", "Clear high-register chime patch"],
].map(([name, description], index): SoundPreset => ({
  id: `keys-${index}`,
  name: name as string,
  category: "keys",
  description: description as string,
  tags: ["keys", ["piano", "piano", "piano", "electric", "digital", "pad", "bass", "lead", "pluck", "organ", "organ", "pad", "lead", "synth", "bell", "mallet", "bass", "electric", "pad", "bass", "pluck", "brass", "ambient", "chime"][index]],
  synth: {
    waveform: (["triangle", "triangle", "triangle", "sine", "sine", "sawtooth", "square", "sawtooth", "triangle", "sine", "square", "triangle", "square", "sawtooth", "sine", "triangle", "sine", "sine", "triangle", "square", "triangle", "sawtooth", "sine", "sine"] as OscillatorType[])[index],
    attack: [0.01, 0.08, 0.01, 0.005, 0.01, 0.6, 0.01, 0.01, 0.005, 0.02, 0.01, 0.8, 0.01, 0.04, 0.02, 0.005, 0.01, 0.01, 0.55, 0.005, 0.04, 0.02, 0.3, 0.005][index],
    decay: [0.2, 0.3, 0.2, 0.35, 0.4, 0.5, 0.15, 0.2, 0.12, 0.1, 0.1, 0.8, 0.1, 0.3, 0.6, 0.2, 0.15, 0.25, 0.8, 0.1, 0.35, 0.2, 0.5, 0.4][index],
    sustain: [0.65, 0.25, 0.55, 0.2, 0.2, 0.72, 0.7, 0.55, 0.2, 0.8, 0.85, 0.7, 0.55, 0.68, 0.25, 0.2, 0.72, 0.35, 0.6, 0.7, 0.3, 0.65, 0.55, 0.2][index],
    release: [0.2, 0.3, 0.2, 0.2, 0.3, 0.8, 0.12, 0.12, 0.1, 0.2, 0.2, 1.2, 0.12, 0.25, 0.5, 0.12, 0.15, 0.25, 0.8, 0.1, 0.2, 0.2, 0.65, 0.55][index],
    cutoff: [8500, 1800, 4000, 6000, 12000, 3200, 900, 5000, 4200, 8000, 12000, 2600, 3500, 4200, 5200, 3000, 700, 4800, 5000, 800, 3600, 6500, 4800, 10000][index],
    resonance: [0.7, 0.8, 0.7, 1.2, 1.8, 0.7, 1.1, 1.5, 0.9, 0.7, 0.7, 0.8, 1.6, 1.1, 1.4, 0.8, 0.8, 0.8, 1, 1.3, 0.8, 1.2, 0.8, 1.7][index],
  },
}));

const drumNames = [
  ["Four on the Floor", "Straight kick and backbeat"],
  ["Half-Time Beat", "Sparse half-time kick and snare"],
  ["Indie Rock", "Driving rock beat with open hats"],
  ["90s Breakbeat", "Syncopated breakbeat-inspired pattern"],
  ["Lo-Fi Dust", "Laid-back kick, snare, and sparse hats"],
  ["Trap Starter", "Sparse kick with fast hat pulse"],
  ["House Pulse", "Steady dance kick and bright hats"],
  ["Boom Bap", "Classic hip-hop kick and snare placement"],
  ["Funk Pocket", "Syncopated kick and snare with extra percussion"],
  ["Acoustic Pop", "Light pop beat with restrained percussion"],
  ["Disco Drive", "Four-on-floor kick with open hats"],
  ["Minimal Groove", "Sparse, spacious drum pattern"],
  ["Shuffle Feel", "Swung kick, snare, and hat groove"],
  ["Big Chorus", "Full backbeat with clap accents"],
].map(([name, description], index): SoundPreset => {
  const kickPatterns = [
    [0, 4, 8, 12], [0, 10], [0, 4, 8, 12], [0, 6, 10, 14], [0, 7, 10], [0, 6, 11], [0, 4, 8, 12], [0, 6, 10], [0, 3, 8, 11, 14], [0, 8], [0, 4, 8, 12], [0, 10], [0, 6, 10], [0, 4, 8, 12],
  ];
  const snarePatterns = [
    [4, 12], [8], [4, 12], [4, 12], [4, 12], [8], [4, 12], [4, 12], [4, 12], [4, 12], [4, 12], [12], [4, 12], [4, 12],
  ];
  const hatPatterns = [
    [0, 2, 4, 6, 8, 10, 12, 14], [0, 4, 8, 12], [0, 2, 4, 6, 8, 10, 12, 14], [0, 2, 5, 7, 8, 10, 13, 15], [2, 6, 10, 14], [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], [0, 2, 4, 6, 8, 10, 12, 14], [0, 2, 4, 6, 8, 10, 12, 14], [0, 3, 4, 7, 8, 11, 12, 15], [0, 4, 8, 12], [0, 2, 4, 6, 8, 10, 12, 14], [2, 6, 10, 14], [0, 2, 4, 6, 8, 10, 12, 14], [0, 2, 4, 6, 8, 10, 12, 14],
  ];
  const makeRow = (steps: number[]) => Array.from({ length: 16 }, (_, step) => steps.includes(step));
  return {
    id: `drums-${index}`,
    name: name as string,
    category: "drums",
    description: description as string,
    tags: ["drums", ["dance", "half-time", "rock", "breakbeat", "lo-fi", "trap", "house", "hip-hop", "funk", "pop", "disco", "minimal", "shuffle", "pop"][index]],
    drums: {
      kick: makeRow(kickPatterns[index]),
      snare: makeRow(snarePatterns[index]),
      hat: makeRow(hatPatterns[index]),
      openHat: makeRow(index === 2 || index === 6 || index === 10 ? [6, 14] : []),
      clap: makeRow(index === 5 || index === 6 || index === 7 || index === 13 ? [4, 12] : []),
      percussion: makeRow(index === 3 || index === 8 || index === 12 ? [3, 7, 11, 15] : []),
      swing: index === 12 ? 0.32 : index === 4 || index === 7 ? 0.12 : 0,
    },
  };
});

export const SOUND_LIBRARY: SoundPreset[] = [
  ...vocalPresets,
  ...guitarNames,
  ...bassNames,
  ...keyNames,
  ...drumNames,
];

export function soundPresetSummary(preset: SoundPreset): string {
  return `${preset.category} · ${preset.tags.slice(1).join(" · ")}`;
}
