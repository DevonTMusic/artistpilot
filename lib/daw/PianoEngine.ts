// lib/daw/PianoEngine.ts

export type PianoPresetType =
  | "Concert Grand"
  | "Studio Upright"
  | "Felt Piano"
  | "Classic Tine EP"
  | "FM Digital Piano"
  | "Ambient Cinematic Piano";

export interface PianoVoice {
  oscillators: OscillatorNode[];
  filters: BiquadFilterNode[];
  gain: GainNode;
  startTime: number;
}

export class PianoEngine {
  private static instance: PianoEngine;
  private activeVoices = new Map<number, PianoVoice>();
  public sustainPedalDown: boolean = false;
  private sustainedNotes = new Set<number>();

  private constructor() {}

  public static getInstance(): PianoEngine {
    if (!PianoEngine.instance) {
      PianoEngine.instance = new PianoEngine();
    }
    return PianoEngine.instance;
  }

  // Realistic Acoustic Multi-Harmonic Synthesis
  public noteOn(
    ctx: AudioContext,
    pitch: number,
    velocity: number = 105,
    preset: PianoPresetType = "Concert Grand",
    destNode?: AudioNode
  ) {
    this.noteOff(ctx, pitch, true);

    const freq = 440 * Math.pow(2, (pitch - 69) / 12);
    const destination = destNode || ctx.destination;
    const t = ctx.currentTime;
    const vel = Math.max(0.15, Math.min(1.0, velocity / 127));

    const masterGain = ctx.createGain();
    const oscs: OscillatorNode[] = [];
    const filters: BiquadFilterNode[] = [];

    if (preset === "Concert Grand") {
      // 1. Hammer Strike Transient (Noise burst simulation)
      const hammerOsc = ctx.createOscillator();
      const hammerGain = ctx.createGain();
      hammerOsc.type = "sine";
      hammerOsc.frequency.setValueAtTime(freq * 6, t);
      hammerGain.gain.setValueAtTime(0.3 * vel, t);
      hammerGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.04);
      hammerOsc.connect(hammerGain);
      hammerGain.connect(masterGain);
      hammerOsc.start(t);
      hammerOsc.stop(t + 0.05);

      // 2. Fundamental String
      const fund = ctx.createOscillator();
      fund.type = "triangle";
      fund.frequency.setValueAtTime(freq, t);

      // 3. Detuned Coupled String Resonance (Slightly sharp for acoustic chorus)
      const coupled = ctx.createOscillator();
      coupled.type = "sine";
      coupled.frequency.setValueAtTime(freq * 1.0015, t);

      // 4. Harmonic Overtone
      const overtone = ctx.createOscillator();
      overtone.type = "triangle";
      overtone.frequency.setValueAtTime(freq * 2, t);

      // Acoustic Soundboard Low-Pass Filter
      const soundboard = ctx.createBiquadFilter();
      soundboard.type = "lowpass";
      soundboard.frequency.setValueAtTime(1400 + vel * 5500, t);
      soundboard.frequency.exponentialRampToValueAtTime(650, t + 1.8);

      fund.connect(soundboard);
      coupled.connect(soundboard);
      overtone.connect(soundboard);
      soundboard.connect(masterGain);

      // Dynamic Acoustic Piano Envelope
      masterGain.gain.setValueAtTime(0.0001, t);
      masterGain.gain.linearRampToValueAtTime(0.6 * vel, t + 0.006);
      masterGain.gain.exponentialRampToValueAtTime(0.25 * vel, t + 0.4);
      masterGain.gain.exponentialRampToValueAtTime(0.0001, t + 3.2);

      fund.start(t);
      coupled.start(t);
      overtone.start(t);

      oscs.push(fund, coupled, overtone);
      filters.push(soundboard);
    } else if (preset === "Studio Upright" || preset === "Felt Piano") {
      // Muted felt hammer with warm body
      const fund = ctx.createOscillator();
      fund.type = "sine";
      fund.frequency.setValueAtTime(freq, t);

      const felt = ctx.createOscillator();
      felt.type = "triangle";
      felt.frequency.setValueAtTime(freq * 1.002, t);

      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(700 + vel * 1400, t);

      fund.connect(filter);
      felt.connect(filter);
      filter.connect(masterGain);

      masterGain.gain.setValueAtTime(0.0001, t);
      masterGain.gain.linearRampToValueAtTime(0.55 * vel, t + 0.012);
      masterGain.gain.exponentialRampToValueAtTime(0.0001, t + 2.4);

      fund.start(t);
      felt.start(t);
      oscs.push(fund, felt);
      filters.push(filter);
    } else {
      // Vintage Electric Piano / Tine
      const tine = ctx.createOscillator();
      const body = ctx.createOscillator();
      tine.type = "sine";
      body.type = "sine";
      tine.frequency.setValueAtTime(freq * 4, t);
      body.frequency.setValueAtTime(freq, t);

      const tineFilter = ctx.createBiquadFilter();
      tineFilter.type = "peaking";
      tineFilter.frequency.value = 2400;
      tineFilter.gain.value = 6 * vel;

      tine.connect(tineFilter);
      body.connect(tineFilter);
      tineFilter.connect(masterGain);

      masterGain.gain.setValueAtTime(0.0001, t);
      masterGain.gain.linearRampToValueAtTime(0.45 * vel, t + 0.005);
      masterGain.gain.exponentialRampToValueAtTime(0.0001, t + 1.8);

      tine.start(t);
      body.start(t);
      oscs.push(tine, body);
      filters.push(tineFilter);
    }

    masterGain.connect(destination);
    this.activeVoices.set(pitch, { oscillators: oscs, filters, gain: masterGain, startTime: t });
  }

  public noteOff(ctx: AudioContext, pitch: number, immediate: boolean = false) {
    if (this.sustainPedalDown && !immediate) {
      this.sustainedNotes.add(pitch);
      return;
    }

    const voice = this.activeVoices.get(pitch);
    if (!voice) return;

    const t = ctx.currentTime;
    const releaseTime = immediate ? 0.01 : 0.22;

    try {
      voice.gain.gain.cancelScheduledValues(t);
      voice.gain.gain.setValueAtTime(voice.gain.gain.value, t);
      voice.gain.gain.exponentialRampToValueAtTime(0.0001, t + releaseTime);

      setTimeout(() => {
        try {
          voice.oscillators.forEach((o) => { o.stop(); o.disconnect(); });
          voice.gain.disconnect();
        } catch {}
      }, releaseTime * 1000 + 40);
    } catch {}

    this.activeVoices.delete(pitch);
    this.sustainedNotes.delete(pitch);
  }

  public setSustainPedal(ctx: AudioContext, isDown: boolean) {
    this.sustainPedalDown = isDown;
    if (!isDown) {
      this.sustainedNotes.forEach((p) => this.noteOff(ctx, p));
      this.sustainedNotes.clear();
    }
  }

  public releaseAllNotes(ctx: AudioContext) {
    this.activeVoices.forEach((_, p) => this.noteOff(ctx, p, true));
    this.activeVoices.clear();
    this.sustainedNotes.clear();
  }
}
