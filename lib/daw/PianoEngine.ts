// lib/daw/PianoEngine.ts

import type { SynthSettings } from "@/lib/AudioEngine";

export type PianoPresetType =
  | "Concert Grand"
  | "Studio Upright"
  | "Felt Piano"
  | "Classic Tine EP"
  | "FM Digital Piano"
  | "Ambient Cinematic Piano";

export interface ActiveVoice {
  nodes: AudioNode[];
  gain: GainNode;
  pitch: number;
  release?: number;
}

export class PianoEngine {
  private static instance: PianoEngine;
  private activeVoices = new Map<number, ActiveVoice>();
  public sustainPedalDown = false;
  private sustainedNotes = new Set<number>();

  private constructor() {}

  public static getInstance(): PianoEngine {
    if (!PianoEngine.instance) {
      PianoEngine.instance = new PianoEngine();
    }
    return PianoEngine.instance;
  }

  // Realistic Acoustic Piano String Resonance & Hammer Model
  public noteOn(
    ctx: AudioContext,
    pitch: number,
    velocity: number = 105,
    preset: PianoPresetType = "Concert Grand",
    destNode?: AudioNode,
    synthSettings?: SynthSettings
  ) {
    this.noteOff(ctx, pitch, true);

    const freq = 440 * Math.pow(2, (pitch - 69) / 12);
    const destination = destNode || ctx.destination;
    const t = ctx.currentTime;
    const vel = Math.max(0.1, Math.min(1.0, velocity / 127));

    const masterGain = ctx.createGain();
    const nodesToClean: AudioNode[] = [masterGain];
    if (synthSettings) {
      const peak = 0.75 * vel;
      masterGain.gain.setValueAtTime(0.0001, t);
      masterGain.gain.linearRampToValueAtTime(peak, t + synthSettings.attack);
      masterGain.gain.linearRampToValueAtTime(peak * synthSettings.sustain, t + synthSettings.attack + synthSettings.decay);
    }

    // 1. Hammer Attack Transient (Short burst of wooden percussive noise)
    const hammerBuffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.025), ctx.sampleRate);
    const hammerData = hammerBuffer.getChannelData(0);
    for (let i = 0; i < hammerData.length; i++) {
      hammerData[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.005));
    }
    const hammerSource = ctx.createBufferSource();
    hammerSource.buffer = hammerBuffer;

    const hammerFilter = ctx.createBiquadFilter();
    hammerFilter.type = "bandpass";
    hammerFilter.frequency.setValueAtTime(freq * 3, t);
    hammerFilter.Q.value = 2.0;

    const hammerGain = ctx.createGain();
    hammerGain.gain.setValueAtTime(0.35 * vel, t);

    hammerSource.connect(hammerFilter);
    hammerFilter.connect(hammerGain);
    hammerGain.connect(masterGain);
    hammerSource.start(t);
    nodesToClean.push(hammerSource, hammerFilter, hammerGain);

    // 2. Coupled Acoustic Strings (Triple-string chorus effect)
    const detunes = [-1.5, 0, 1.8]; // Cents detuning found in acoustic pianos
    detunes.forEach((cents) => {
      const osc = ctx.createOscillator();
      const stringFilter = ctx.createBiquadFilter();
      const stringGain = ctx.createGain();

      osc.type = synthSettings?.waveform ?? (preset === "Classic Tine EP" ? "sine" : "triangle");
      osc.frequency.setValueAtTime(freq, t);
      osc.detune.setValueAtTime(cents, t);

      // Acoustic Soundboard Dispersion
      stringFilter.type = "lowpass";
      const cutoff = synthSettings?.cutoff ?? (preset === "Felt Piano" ? 900 : preset === "Studio Upright" ? 1800 : 4500);
      stringFilter.frequency.setValueAtTime(cutoff * vel, t);
      stringFilter.Q.value = synthSettings?.resonance ?? 0.7;
      if (!synthSettings) stringFilter.frequency.exponentialRampToValueAtTime(350, t + 2.0);

      // Piano String Decay Envelope
      const initialVol = (0.4 / detunes.length) * vel;
      stringGain.gain.setValueAtTime(0.0001, t);
      stringGain.gain.linearRampToValueAtTime(initialVol, t + 0.005);
      if (!synthSettings) {
        stringGain.gain.exponentialRampToValueAtTime(initialVol * 0.35, t + 0.3);
        stringGain.gain.exponentialRampToValueAtTime(0.0001, t + (preset === "Concert Grand" ? 3.5 : 2.2));
      }

      osc.connect(stringFilter);
      stringFilter.connect(stringGain);
      stringGain.connect(masterGain);

      osc.start(t);
      nodesToClean.push(osc, stringFilter, stringGain);
    });

    masterGain.connect(destination);
    this.activeVoices.set(pitch, { nodes: nodesToClean, gain: masterGain, pitch, release: synthSettings?.release });
  }

  public noteOff(ctx: AudioContext, pitch: number, immediate: boolean = false) {
    if (this.sustainPedalDown && !immediate) {
      this.sustainedNotes.add(pitch);
      return;
    }

    const voice = this.activeVoices.get(pitch);
    if (!voice) return;

    const t = ctx.currentTime;
    const releaseTime = immediate ? 0.01 : voice.release ?? 0.25;

    try {
      voice.gain.gain.cancelScheduledValues(t);
      voice.gain.gain.setValueAtTime(voice.gain.gain.value, t);
      voice.gain.gain.exponentialRampToValueAtTime(0.0001, t + releaseTime);

      setTimeout(() => {
        try {
          voice.nodes.forEach((n) => {
            if ("stop" in n) (n as AudioScheduledSourceNode).stop();
            n.disconnect();
          });
        } catch {}
      }, releaseTime * 1000 + 50);
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
