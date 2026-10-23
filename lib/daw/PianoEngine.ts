// lib/daw/PianoEngine.ts

export type PianoPresetType =
  | "Concert Grand"
  | "Studio Upright"
  | "Felt Piano"
  | "Classic Tine EP"
  | "Stage Electric Piano"
  | "FM Digital Piano"
  | "Ambient Cinematic Piano";

export interface PianoVoice {
  osc1: OscillatorNode;
  osc2: OscillatorNode;
  filter: BiquadFilterNode;
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

  // Trigger Note-On with Velocity & Preset Sound Design
  public noteOn(
    ctx: AudioContext,
    pitch: number,
    velocity: number = 100, // 1 to 127
    preset: PianoPresetType = "Concert Grand",
    destNode?: AudioNode
  ) {
    // If voice already active, kill it cleanly first
    this.noteOff(ctx, pitch, true);

    const freq = 440 * Math.pow(2, (pitch - 69) / 12);
    const destination = destNode || ctx.destination;
    const t = ctx.currentTime;
    const velFactor = Math.max(0.1, velocity / 127);

    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();

    if (preset === "Concert Grand") {
      // Harmonic triangle + warm sine with percussive attack
      osc1.type = "triangle";
      osc2.type = "sine";
      osc1.frequency.setValueAtTime(freq, t);
      osc2.frequency.setValueAtTime(freq * 2, t);

      filter.type = "lowpass";
      filter.frequency.setValueAtTime(1200 + velFactor * 4000, t);
      filter.frequency.exponentialRampToValueAtTime(800, t + 1.2);

      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.linearRampToValueAtTime(0.5 * velFactor, t + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.18 * velFactor, t + 0.5);
    } else if (preset === "Felt Piano" || preset === "Studio Upright") {
      // Muted felt hammer with quick low-pass roll off
      osc1.type = "sine";
      osc2.type = "triangle";
      osc1.frequency.setValueAtTime(freq, t);
      osc2.frequency.setValueAtTime(freq * 1.002, t);

      filter.type = "lowpass";
      filter.frequency.setValueAtTime(800 + velFactor * 1200, t);

      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.linearRampToValueAtTime(0.45 * velFactor, t + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 2.0);
    } else if (preset === "Classic Tine EP" || preset === "Stage Electric Piano") {
      // Bell-like Rhodes electric piano tine
      osc1.type = "sine";
      osc2.type = "sine";
      osc1.frequency.setValueAtTime(freq, t);
      osc2.frequency.setValueAtTime(freq * 4.02, t); // Metallic bell harmonic

      filter.type = "peaking";
      filter.frequency.setValueAtTime(2400, t);
      filter.gain.setValueAtTime(6 * velFactor, t);

      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.linearRampToValueAtTime(0.4 * velFactor, t + 0.005);
      gain.gain.exponentialRampToValueAtTime(0.12 * velFactor, t + 0.8);
    } else if (preset === "FM Digital Piano") {
      // Crisp 80s FM Digital bells
      osc1.type = "sawtooth";
      osc2.type = "sine";
      osc1.frequency.setValueAtTime(freq, t);
      osc2.frequency.setValueAtTime(freq * 3, t);

      filter.type = "bandpass";
      filter.frequency.setValueAtTime(3000, t);
      filter.Q.value = 1.2;

      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.linearRampToValueAtTime(0.35 * velFactor, t + 0.004);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 1.8);
    } else {
      // Ambient Cinematic Piano with long decay
      osc1.type = "triangle";
      osc2.type = "sine";
      osc1.frequency.setValueAtTime(freq, t);
      osc2.frequency.setValueAtTime(freq * 1.005, t);

      filter.type = "lowpass";
      filter.frequency.setValueAtTime(2200, t);

      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.linearRampToValueAtTime(0.35 * velFactor, t + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 4.5);
    }

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(gain);
    gain.connect(destination);

    osc1.start(t);
    osc2.start(t);

    this.activeVoices.set(pitch, { osc1, osc2, filter, gain, startTime: t });
  }

  // Trigger Note-Off (Handles Sustain Pedal state)
  public noteOff(ctx: AudioContext, pitch: number, immediate: boolean = false) {
    if (this.sustainPedalDown && !immediate) {
      this.sustainedNotes.add(pitch);
      return;
    }

    const voice = this.activeVoices.get(pitch);
    if (!voice) return;

    const t = ctx.currentTime;
    const releaseTime = immediate ? 0.01 : 0.18;

    try {
      voice.gain.gain.cancelScheduledValues(t);
      voice.gain.gain.setValueAtTime(voice.gain.gain.value, t);
      voice.gain.gain.exponentialRampToValueAtTime(0.0001, t + releaseTime);

      setTimeout(() => {
        try {
          voice.osc1.stop();
          voice.osc2.stop();
          voice.osc1.disconnect();
          voice.osc2.disconnect();
          voice.gain.disconnect();
        } catch {}
      }, releaseTime * 1000 + 50);
    } catch {}

    this.activeVoices.delete(pitch);
    this.sustainedNotes.delete(pitch);
  }

  // Sustain Pedal Action
  public setSustainPedal(ctx: AudioContext, isDown: boolean) {
    this.sustainPedalDown = isDown;
    if (!isDown) {
      // Release all sustained notes that were held by pedal
      this.sustainedNotes.forEach((pitch) => {
        this.noteOff(ctx, pitch);
      });
      this.sustainedNotes.clear();
    }
  }

  public releaseAllNotes(ctx: AudioContext) {
    this.activeVoices.forEach((_, pitch) => {
      this.noteOff(ctx, pitch, true);
    });
    this.activeVoices.clear();
    this.sustainedNotes.clear();
  }
}
