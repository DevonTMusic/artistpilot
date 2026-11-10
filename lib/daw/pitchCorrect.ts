// lib/daw/pitchCorrect.ts
// Offline monophonic pitch correction: YIN pitch tracking + pitch-synchronous overlap-add.

export type PitchScale = "major" | "minor" | "chromatic";

export interface PitchCorrectionOptions {
  keyIndex: number;          // 0 = C ... 11 = B
  scale: PitchScale;
  strength: number;          // 0..1, how far to pull toward the target note
  retuneMs: number;          // 0 (hard/robotic) .. 400 (natural glide)
  minFreq?: number;
  maxFreq?: number;
}

export interface PitchFrame {
  time: number;
  freq: number;              // 0 when unvoiced
}

const SCALE_STEPS: Record<PitchScale, number[]> = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  chromatic: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
};

const FRAME = 2048;
const HOP = 512;

export function freqToMidi(freq: number): number {
  return 69 + 12 * Math.log2(freq / 440);
}

export function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

export function nearestScaleMidi(midi: number, keyIndex: number, scale: PitchScale): number {
  const allowed = new Set(SCALE_STEPS[scale].map((step) => (step + keyIndex) % 12));
  const base = Math.round(midi);
  let best = base;
  let bestDist = Infinity;
  for (let candidate = base - 2; candidate <= base + 2; candidate++) {
    if (!allowed.has(((candidate % 12) + 12) % 12)) continue;
    const dist = Math.abs(candidate - midi);
    if (dist < bestDist) {
      best = candidate;
      bestDist = dist;
    }
  }
  return best;
}

export function mixToMono(buffer: AudioBuffer): Float32Array {
  const mono = new Float32Array(buffer.length);
  for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
    const data = buffer.getChannelData(ch);
    for (let i = 0; i < data.length; i++) mono[i] += data[i] / buffer.numberOfChannels;
  }
  return mono;
}

function yinFrame(
  samples: Float32Array,
  start: number,
  sampleRate: number,
  minFreq: number,
  maxFreq: number,
  diff: Float32Array
): number {
  const maxLag = Math.min(Math.floor(sampleRate / minFreq), FRAME / 2 - 1);
  const minLag = Math.max(2, Math.floor(sampleRate / maxFreq));
  const half = FRAME / 2;
  let energy = 0;
  for (let i = 0; i < FRAME; i++) energy += samples[start + i] * samples[start + i];
  if (energy / FRAME < 1e-6) return 0;

  for (let lag = 1; lag <= maxLag; lag++) {
    let sum = 0;
    for (let i = 0; i < half; i++) {
      const delta = samples[start + i] - samples[start + i + lag];
      sum += delta * delta;
    }
    diff[lag] = sum;
  }
  let running = 0;
  diff[0] = 1;
  for (let lag = 1; lag <= maxLag; lag++) {
    running += diff[lag];
    diff[lag] = running === 0 ? 1 : (diff[lag] * lag) / running;
  }
  const threshold = 0.15;
  let found = -1;
  for (let lag = minLag; lag < maxLag; lag++) {
    if (diff[lag] < threshold) {
      while (lag + 1 < maxLag && diff[lag + 1] < diff[lag]) lag++;
      found = lag;
      break;
    }
  }
  if (found < 0) return 0;
  const a = diff[found - 1] ?? diff[found];
  const b = diff[found];
  const c = diff[found + 1] ?? diff[found];
  const denom = a - 2 * b + c;
  const shift = denom === 0 ? 0 : (a - c) / (2 * denom);
  return sampleRate / (found + shift);
}

function medianSmooth(values: number[]): number[] {
  return values.map((value, i) => {
    if (value === 0) return 0;
    const window = [values[i - 2], values[i - 1], value, values[i + 1], values[i + 2]]
      .filter((v): v is number => typeof v === "number" && v > 0)
      .sort((x, y) => x - y);
    return window[Math.floor(window.length / 2)];
  });
}

export function detectPitchTrack(
  samples: Float32Array,
  sampleRate: number,
  minFreq = 70,
  maxFreq = 1000
): PitchFrame[] {
  const diff = new Float32Array(FRAME / 2 + 1);
  const raw: number[] = [];
  for (let start = 0; start + FRAME <= samples.length; start += HOP) {
    raw.push(yinFrame(samples, start, sampleRate, minFreq, maxFreq, diff));
  }
  return medianSmooth(raw).map((freq, i) => ({
    time: (i * HOP + FRAME / 2) / sampleRate,
    freq,
  }));
}

export function computeRatios(
  track: PitchFrame[],
  options: PitchCorrectionOptions
): Float32Array {
  const ratios = new Float32Array(track.length).fill(1);
  const hopSec = track.length > 1 ? track[1].time - track[0].time : HOP / 44100;
  const smoothing = options.retuneMs <= 0
    ? 1
    : 1 - Math.exp(-hopSec / (options.retuneMs / 1000));
  let current = 0;
  for (let i = 0; i < track.length; i++) {
    const { freq } = track[i];
    if (freq <= 0) {
      current = 0;
      continue;
    }
    const midi = freqToMidi(freq);
    const target = nearestScaleMidi(midi, options.keyIndex, options.scale);
    const desired = (target - midi) * options.strength;
    current = current === 0 && i > 0 && track[i - 1].freq <= 0
      ? desired * Math.min(1, smoothing * 4)
      : current + (desired - current) * smoothing;
    ratios[i] = Math.pow(2, current / 12);
  }
  return ratios;
}

function lookup(values: Float32Array | number[], hopIndex: number): number {
  const i = Math.max(0, Math.min(values.length - 1, hopIndex));
  return values[i];
}

function shiftChannel(
  input: Float32Array,
  freqs: number[],
  ratios: Float32Array,
  sampleRate: number
): Float32Array<ArrayBuffer> {
  const output = new Float32Array(input.length);
  const norm = new Float32Array(input.length);
  const unvoicedPeriod = Math.round(sampleRate * 0.01);
  const frameOffset = FRAME / 2;
  const hopAt = (pos: number) => Math.round((pos - frameOffset) / HOP);

  let synth = 0;
  while (synth < input.length) {
    const hopIndex = hopAt(synth);
    const freq = freqs.length ? lookup(freqs, hopIndex) : 0;
    const voiced = freq > 0;
    const ratio = voiced ? lookup(ratios, hopIndex) : 1;
    const period = voiced ? Math.round(sampleRate / freq) : unvoicedPeriod;

    let center = synth;
    if (voiced) {
      const radius = Math.floor(period / 2);
      let best = center;
      let bestValue = -Infinity;
      for (let i = Math.max(0, center - radius); i <= Math.min(input.length - 1, center + radius); i++) {
        if (input[i] > bestValue) {
          bestValue = input[i];
          best = i;
        }
      }
      center = best;
    }

    const half = period;
    for (let n = -half; n <= half; n++) {
      const src = center + n;
      const dst = synth + n;
      if (src < 0 || src >= input.length || dst < 0 || dst >= input.length) continue;
      const w = 0.5 * (1 + Math.cos((Math.PI * n) / half));
      output[dst] += input[src] * w;
      norm[dst] += w;
    }
    synth += Math.max(1, Math.round(period / ratio));
  }
  for (let i = 0; i < output.length; i++) {
    output[i] = norm[i] > 0.05 ? output[i] / norm[i] : input[i];
  }
  return output;
}

export function correctPitch(
  buffer: AudioBuffer,
  ctx: BaseAudioContext,
  options: PitchCorrectionOptions
): AudioBuffer {
  const mono = mixToMono(buffer);
  const track = detectPitchTrack(mono, buffer.sampleRate, options.minFreq, options.maxFreq);
  const ratios = computeRatios(track, options);
  const freqs = track.map((frame) => frame.freq);
  const result = ctx.createBuffer(buffer.numberOfChannels, buffer.length, buffer.sampleRate);
  for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
    result.copyToChannel(shiftChannel(buffer.getChannelData(ch), freqs, ratios, buffer.sampleRate), ch);
  }
  return result;
}

export interface PitchNote {
  id: number;
  startFrame: number;        // inclusive
  endFrame: number;          // exclusive
  startTime: number;
  endTime: number;
  midi: number;              // detected pitch (median), fractional semitones
  targetMidi: number;        // where the user wants it
}

export interface ManualEditOptions {
  flatten: number;           // 0..1, how much natural drift/vibrato is removed in moved notes
  transitionMs: number;      // glide between notes
}

const MIN_NOTE_FRAMES = 4;
const NEW_NOTE_SEMITONES = 0.75;

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

/** Groups voiced frames into discrete notes the user can move. */
export function segmentNotes(track: PitchFrame[]): PitchNote[] {
  const mids = track.map((frame) => (frame.freq > 0 ? freqToMidi(frame.freq) : 0));
  const hop = track.length > 1 ? track[1].time - track[0].time : HOP / 44100;
  const notes: PitchNote[] = [];
  let i = 0;
  while (i < track.length) {
    if (mids[i] <= 0) {
      i++;
      continue;
    }
    const start = i;
    const members: number[] = [];
    let lastVoiced = i;
    let gap = 0;
    while (i < track.length) {
      if (mids[i] <= 0) {
        gap++;
        if (gap >= 3) break;
        i++;
        continue;
      }
      gap = 0;
      if (members.length >= 4) {
        const reference = median(members.slice(-8));
        const deviates = (index: number) => mids[index] > 0 && Math.abs(mids[index] - reference) > NEW_NOTE_SEMITONES;
        if (deviates(i) && i + 2 < track.length && deviates(i + 1) && deviates(i + 2)) break;
      }
      members.push(mids[i]);
      lastVoiced = i;
      i++;
    }
    const end = lastVoiced + 1;
    if (members.length >= MIN_NOTE_FRAMES) {
      const detected = median(members);
      notes.push({
        id: notes.length,
        startFrame: start,
        endFrame: end,
        startTime: track[start].time - hop / 2,
        endTime: track[end - 1].time + hop / 2,
        midi: detected,
        targetMidi: detected,
      });
    }
  }
  return notes;
}

/** Renders the clip with every note moved to its target pitch. Unedited notes are untouched. */
export function applyManualEdits(
  buffer: AudioBuffer,
  ctx: BaseAudioContext,
  track: PitchFrame[],
  notes: PitchNote[],
  options: ManualEditOptions
): AudioBuffer {
  const desired = new Float32Array(track.length);
  notes.forEach((note) => {
    const offset = note.targetMidi - note.midi;
    if (Math.abs(offset) < 0.005) return;
    for (let i = note.startFrame; i < note.endFrame; i++) {
      if (track[i].freq <= 0) continue;
      const toTarget = note.targetMidi - freqToMidi(track[i].freq);
      desired[i] = offset * (1 - options.flatten) + toTarget * options.flatten;
    }
  });
  const hopSec = track.length > 1 ? track[1].time - track[0].time : HOP / 44100;
  const alpha = options.transitionMs <= 0 ? 1 : 1 - Math.exp(-hopSec / (options.transitionMs / 1000));
  const ratios = new Float32Array(track.length).fill(1);
  let current = 0;
  for (let i = 0; i < track.length; i++) {
    if (track[i].freq <= 0) {
      current = 0;
      continue;
    }
    current = i > 0 && track[i - 1].freq > 0 ? current + (desired[i] - current) * alpha : desired[i];
    ratios[i] = Math.pow(2, current / 12);
  }
  const freqs = track.map((frame) => frame.freq);
  const result = ctx.createBuffer(buffer.numberOfChannels, buffer.length, buffer.sampleRate);
  for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
    result.copyToChannel(shiftChannel(buffer.getChannelData(ch), freqs, ratios, buffer.sampleRate), ch);
  }
  return result;
}
