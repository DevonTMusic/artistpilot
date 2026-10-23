// lib/daw/EffectsEngine.ts

export interface GuitarAmpSettings {
  drive: number;      // 0 to 1.0 (Preamp gain)
  bass: number;       // -10 to +10 dB
  mid: number;        // -10 to +10 dB
  treble: number;     // -10 to +10 dB
  cabSim: boolean;    // Cabinet simulation filter
  reverb: number;     // 0 to 1.0 (Ambience mix)
  delay: number;      // 0 to 1.0 (Echo feedback)
}

export function makeDistortionCurve(amount: number = 20): any {
  const k = typeof amount === "number" ? amount : 20;
  const n_samples = 44100;
  const curve = new Float32Array(n_samples);
  const deg = Math.PI / 180;
  for (let i = 0; i < n_samples; ++i) {
    const x = (i * 2) / n_samples - 1;
    curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x));
  }
  return curve as any;
}

export class GuitarAmpDSP {
  public inputNode: GainNode;
  public outputNode: GainNode;
  private driveNode: WaveShaperNode;
  private bassNode: BiquadFilterNode;
  private midNode: BiquadFilterNode;
  private trebleNode: BiquadFilterNode;
  private cabNode: BiquadFilterNode;
  private delayNode: DelayNode;
  private delayFeedback: GainNode;

  constructor(ctx: AudioContext) {
    this.inputNode = ctx.createGain();
    this.outputNode = ctx.createGain();

    // 1. Preamp Drive
    this.driveNode = ctx.createWaveShaper();
    // @ts-ignore
    this.driveNode.curve = makeDistortionCurve(15);
    this.driveNode.oversample = "4x";

    // 2. 3-Band Tone Stack (Bass, Mid, Treble)
    this.bassNode = ctx.createBiquadFilter();
    this.bassNode.type = "lowshelf";
    this.bassNode.frequency.value = 250;

    this.midNode = ctx.createBiquadFilter();
    this.midNode.type = "peaking";
    this.midNode.frequency.value = 1000;
    this.midNode.Q.value = 0.7;

    this.trebleNode = ctx.createBiquadFilter();
    this.trebleNode.type = "highshelf";
    this.trebleNode.frequency.value = 3500;

    // 3. 4x12 Speaker Cabinet Simulation
    this.cabNode = ctx.createBiquadFilter();
    this.cabNode.type = "lowpass";
    this.cabNode.frequency.value = 4500;

    // 4. Stereo Echo Delay
    this.delayNode = ctx.createDelay(2.0);
    this.delayNode.delayTime.value = 0.3;
    this.delayFeedback = ctx.createGain();
    this.delayFeedback.gain.value = 0.25;

    this.delayNode.connect(this.delayFeedback);
    this.delayFeedback.connect(this.delayNode);

    // Audio Graph Chain:
    this.inputNode.connect(this.driveNode);
    this.driveNode.connect(this.bassNode);
    this.bassNode.connect(this.midNode);
    this.midNode.connect(this.trebleNode);
    this.trebleNode.connect(this.cabNode);
    this.cabNode.connect(this.outputNode);
  }

  public updateSettings(settings: GuitarAmpSettings) {
    // @ts-ignore
    this.driveNode.curve = makeDistortionCurve(settings.drive * 45);
    this.bassNode.gain.value = settings.bass;
    this.midNode.gain.value = settings.mid;
    this.trebleNode.gain.value = settings.treble;
    this.cabNode.frequency.value = settings.cabSim ? 4500 : 20000;
    this.delayFeedback.gain.value = settings.delay * 0.6;
  }
}
