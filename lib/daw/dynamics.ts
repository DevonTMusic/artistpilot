// lib/daw/dynamics.ts
// Shared per-track dynamics chain (gate -> compressor -> makeup -> de-esser) used by live playback and offline export.

export interface DynamicsSettings {
  gateEnabled: boolean;
  gateThreshold: number;
  compEnabled: boolean;
  compAmount: number;
  compAttack: number;
  compRelease: number;
  deEsserEnabled?: boolean;
  deEsserAmount?: number;
}

const WORKLET_SOURCE = `
class ApGate extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: "threshold", defaultValue: -120, minValue: -120, maxValue: 0, automationRate: "k-rate" },
      { name: "attack", defaultValue: 0.003, minValue: 0.0005, maxValue: 0.5, automationRate: "k-rate" },
      { name: "hold", defaultValue: 0.08, minValue: 0, maxValue: 1, automationRate: "k-rate" },
      { name: "release", defaultValue: 0.12, minValue: 0.005, maxValue: 2, automationRate: "k-rate" },
    ];
  }
  constructor() { super(); this.env = 0; this.gain = 1; this.holdLeft = 0; }
  process(inputs, outputs, params) {
    const input = inputs[0], output = outputs[0];
    if (!input || input.length === 0) return true;
    const thresholdDb = params.threshold[0];
    if (thresholdDb <= -119) {
      for (let c = 0; c < output.length; c++) output[c].set(input[c] || input[0]);
      this.gain = 1;
      return true;
    }
    const open = Math.pow(10, thresholdDb / 20);
    const close = open * 0.7;
    const aCoef = Math.exp(-1 / (params.attack[0] * sampleRate));
    const rCoef = Math.exp(-1 / (params.release[0] * sampleRate));
    const holdSamples = params.hold[0] * sampleRate;
    const length = input[0].length;
    for (let i = 0; i < length; i++) {
      let peak = 0;
      for (let c = 0; c < input.length; c++) peak = Math.max(peak, Math.abs(input[c][i]));
      this.env = peak > this.env ? peak : this.env * 0.9995 + peak * 0.0005;
      let target = this.gain >= 0.5 ? (this.env > close ? 1 : 0) : (this.env > open ? 1 : 0);
      if (target === 1) this.holdLeft = holdSamples;
      else if (this.holdLeft > 0) { this.holdLeft--; target = 1; }
      const coef = target > this.gain ? aCoef : rCoef;
      this.gain = target + (this.gain - target) * coef;
      for (let c = 0; c < output.length; c++) output[c][i] = (input[c] || input[0])[i] * this.gain;
    }
    return true;
  }
}
class ApDeEsser extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: "amount", defaultValue: 0, minValue: 0, maxValue: 1, automationRate: "k-rate" },
      { name: "frequency", defaultValue: 6500, minValue: 3000, maxValue: 10000, automationRate: "k-rate" },
    ];
  }
  constructor() {
    super();
    this.env = 0; this.gain = 1; this.freq = 0;
    this.states = [];
    this.hp = [0, 0, 0]; this.lp = [0, 0, 0]; this.a = [0, 0];
  }
  design(freq) {
    const w = 2 * Math.PI * freq / sampleRate, cos = Math.cos(w), alpha = Math.sin(w) / Math.SQRT2;
    const a0 = 1 + alpha;
    this.hp = [(1 + cos) / 2 / a0, -(1 + cos) / a0, (1 + cos) / 2 / a0];
    this.lp = [(1 - cos) / 2 / a0, (1 - cos) / a0, (1 - cos) / 2 / a0];
    this.a = [-2 * cos / a0, (1 - alpha) / a0];
    this.freq = freq;
  }
  biquad(b, z, offset, x) {
    const y = b[0] * x + z[offset];
    z[offset] = b[1] * x - this.a[0] * y + z[offset + 1];
    z[offset + 1] = b[2] * x - this.a[1] * y;
    return y;
  }
  process(inputs, outputs, params) {
    const input = inputs[0], output = outputs[0];
    if (!input || input.length === 0) return true;
    const amount = params.amount[0];
    if (amount <= 0.001) {
      for (let c = 0; c < output.length; c++) output[c].set(input[c] || input[0]);
      this.gain = 1;
      return true;
    }
    const freq = params.frequency[0];
    if (freq !== this.freq) this.design(freq);
    const thresholdLin = Math.pow(10, (-8 - amount * 24) / 20);
    const ratio = 3 + amount * 5;
    const channels = output.length;
    const length = input[0].length;
    const high = new Array(channels), low = new Array(channels);
    for (let i = 0; i < length; i++) {
      let peak = 0;
      for (let c = 0; c < channels; c++) {
        const x = (input[c] || input[0])[i];
        const z = this.states[c] || (this.states[c] = [0, 0, 0, 0, 0, 0, 0, 0]);
        high[c] = this.biquad(this.hp, z, 2, this.biquad(this.hp, z, 0, x));
        low[c] = this.biquad(this.lp, z, 6, this.biquad(this.lp, z, 4, x));
        peak = Math.max(peak, Math.abs(high[c]));
      }
      this.env = peak > this.env ? this.env + (peak - this.env) * 0.2 : this.env * 0.998 + peak * 0.002;
      let target = 1;
      if (this.env > thresholdLin) target = Math.pow(this.env / thresholdLin, 1 / ratio - 1);
      this.gain += (target - this.gain) * (target < this.gain ? 0.3 : 0.005);
      for (let c = 0; c < channels; c++) output[c][i] = low[c] + high[c] * this.gain;
    }
    return true;
  }
}
registerProcessor("ap-gate", ApGate);
registerProcessor("ap-deesser", ApDeEsser);
`;

const loadedContexts = new WeakMap<BaseAudioContext, Promise<boolean>>();

export function loadDynamicsWorklet(ctx: BaseAudioContext): Promise<boolean> {
  const existing = loadedContexts.get(ctx);
  if (existing) return existing;
  const worklet = (ctx as { audioWorklet?: AudioWorklet }).audioWorklet;
  if (!worklet || typeof Blob === "undefined" || typeof URL === "undefined") {
    return Promise.resolve(false);
  }
  const url = URL.createObjectURL(new Blob([WORKLET_SOURCE], { type: "application/javascript" }));
  const pending = worklet
    .addModule(url)
    .then(() => true)
    .catch((error) => {
      console.error("Dynamics worklet unavailable, using fallback processing:", error);
      return false;
    })
    .finally(() => URL.revokeObjectURL(url));
  loadedContexts.set(ctx, pending);
  return pending;
}

export function compressorParams(settings: DynamicsSettings) {
  if (!settings.compEnabled || settings.compAmount <= 0) {
    return { threshold: 0, ratio: 1, knee: 0, attack: 0.01, release: 0.15, makeupDb: 0 };
  }
  const threshold = -40 * settings.compAmount;
  const ratio = 1 + settings.compAmount * 8;
  const makeupDb = Math.min(12, -threshold * (1 - 1 / ratio) * 0.5);
  return {
    threshold,
    ratio,
    knee: 10,
    attack: Math.max(0.001, Math.min(1, settings.compAttack)),
    release: Math.max(0.01, Math.min(1, settings.compRelease)),
    makeupDb,
  };
}

export class TrackDynamics {
  public readonly input: GainNode;
  public readonly output: GainNode;
  public readonly nodes: AudioNode[];
  private readonly gate: AudioWorkletNode | null;
  private readonly deEsserWorklet: AudioWorkletNode | null;
  private readonly deEsserShelf: BiquadFilterNode;
  private readonly compressor: DynamicsCompressorNode;
  private readonly makeup: GainNode;

  constructor(private readonly ctx: BaseAudioContext, useWorklet: boolean) {
    this.input = ctx.createGain();
    this.output = ctx.createGain();
    this.compressor = ctx.createDynamicsCompressor();
    this.makeup = ctx.createGain();
    this.deEsserShelf = ctx.createBiquadFilter();
    this.deEsserShelf.type = "highshelf";
    this.deEsserShelf.frequency.value = 6500;
    this.gate = useWorklet ? new AudioWorkletNode(ctx, "ap-gate", { outputChannelCount: [2] }) : null;
    this.deEsserWorklet = useWorklet ? new AudioWorkletNode(ctx, "ap-deesser", { outputChannelCount: [2] }) : null;

    let tail: AudioNode = this.input;
    if (this.gate) {
      tail.connect(this.gate);
      tail = this.gate;
    }
    tail.connect(this.compressor);
    this.compressor.connect(this.makeup);
    tail = this.makeup;
    if (this.deEsserWorklet) {
      tail.connect(this.deEsserWorklet);
      tail = this.deEsserWorklet;
    } else {
      tail.connect(this.deEsserShelf);
      tail = this.deEsserShelf;
    }
    tail.connect(this.output);
    this.nodes = [this.input, this.output, this.compressor, this.makeup, this.deEsserShelf,
      ...(this.gate ? [this.gate] : []), ...(this.deEsserWorklet ? [this.deEsserWorklet] : [])];
  }

  public apply(settings: DynamicsSettings | undefined, smooth: boolean): void {
    const now = this.ctx.currentTime;
    const set = (param: AudioParam, value: number, tc = 0.02) => {
      if (smooth) param.setTargetAtTime(value, now, tc);
      else param.value = value;
    };
    const s = settings ?? {
      gateEnabled: false, gateThreshold: -120, compEnabled: false, compAmount: 0, compAttack: 0.01, compRelease: 0.15,
    };
    const comp = compressorParams(s);
    set(this.compressor.threshold, comp.threshold);
    set(this.compressor.ratio, comp.ratio);
    set(this.compressor.knee, comp.knee);
    this.compressor.attack.value = comp.attack;
    this.compressor.release.value = comp.release;
    set(this.makeup.gain, Math.pow(10, comp.makeupDb / 20));
    if (this.gate) {
      this.gate.parameters.get("threshold")!.value = s.gateEnabled ? s.gateThreshold : -120;
    }
    const amount = s.deEsserEnabled ? (s.deEsserAmount ?? 0) : 0;
    if (this.deEsserWorklet) this.deEsserWorklet.parameters.get("amount")!.value = amount;
    else set(this.deEsserShelf.gain, -12 * amount);
  }
}
