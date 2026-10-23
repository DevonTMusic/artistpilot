// lib/daw/TrackProcessor.ts

export interface ProcessingSettings {
  inputGain: number;       // 0 to 2.0
  gateEnabled: boolean;
  gateThreshold: number;   // -60dB to 0dB
  compEnabled: boolean;
  compAmount: number;      // 0 to 1.0
  compAttack: number;
  compRelease: number;
  eqEnabled: boolean;
  lowGain: number;         // -12dB to +12dB
  midGain: number;         // -12dB to +12dB
  midFreq: number;         // 200Hz to 5000Hz
  highGain: number;        // -12dB to +12dB
  lowCut: boolean;         // 80Hz Highpass
  ambienceSend: number;    // 0 to 1.0
  reverbSend: number;      // 0 to 1.0
}

export const DEFAULT_TRACK_SETTINGS: ProcessingSettings = {
  inputGain: 1.0,
  gateEnabled: false,
  gateThreshold: -45,
  compEnabled: true,
  compAmount: 0.5,
  compAttack: 0.01,
  compRelease: 0.15,
  eqEnabled: true,
  lowGain: 0,
  midGain: 0,
  midFreq: 1200,
  highGain: 0,
  lowCut: true,
  ambienceSend: 0.15,
  reverbSend: 0.25,
};

export class TrackAudioNodeChain {
  public inputNode: GainNode;
  public outputNode: GainNode;
  public preGainNode: GainNode;
  public lowCutFilter: BiquadFilterNode;
  public lowShelfFilter: BiquadFilterNode;
  public midParametricFilter: BiquadFilterNode;
  public highShelfFilter: BiquadFilterNode;
  public dynamicsCompressor: DynamicsCompressorNode;
  public ambienceSendNode: GainNode;
  public reverbSendNode: GainNode;
  private ctx: AudioContext;

  constructor(ctx: AudioContext) {
    this.ctx = ctx;
    this.inputNode = ctx.createGain();
    this.outputNode = ctx.createGain();

    this.preGainNode = ctx.createGain();
    this.lowCutFilter = ctx.createBiquadFilter();
    this.lowCutFilter.type = "highpass";
    this.lowCutFilter.frequency.value = 80;

    this.lowShelfFilter = ctx.createBiquadFilter();
    this.lowShelfFilter.type = "lowshelf";
    this.lowShelfFilter.frequency.value = 100;

    this.midParametricFilter = ctx.createBiquadFilter();
    this.midParametricFilter.type = "peaking";
    this.midParametricFilter.frequency.value = 1200;
    this.midParametricFilter.Q.value = 0.8;

    this.highShelfFilter = ctx.createBiquadFilter();
    this.highShelfFilter.type = "highshelf";
    this.highShelfFilter.frequency.value = 8000;

    this.dynamicsCompressor = ctx.createDynamicsCompressor();

    this.ambienceSendNode = ctx.createGain();
    this.reverbSendNode = ctx.createGain();

    this.inputNode.connect(this.preGainNode);
    this.preGainNode.connect(this.lowCutFilter);
    this.lowCutFilter.connect(this.lowShelfFilter);
    this.lowShelfFilter.connect(this.midParametricFilter);
    this.midParametricFilter.connect(this.highShelfFilter);
    this.highShelfFilter.connect(this.dynamicsCompressor);
    this.dynamicsCompressor.connect(this.outputNode);

    this.dynamicsCompressor.connect(this.ambienceSendNode);
    this.dynamicsCompressor.connect(this.reverbSendNode);
  }

  public applySettings(s: ProcessingSettings) {
    const t = this.ctx.currentTime;
    this.preGainNode.gain.setValueAtTime(s.inputGain, t);
    this.lowCutFilter.frequency.setValueAtTime(s.lowCut ? 80 : 10, t);

    if (s.eqEnabled) {
      this.lowShelfFilter.gain.setValueAtTime(s.lowGain, t);
      this.midParametricFilter.gain.setValueAtTime(s.midGain, t);
      this.midParametricFilter.frequency.setValueAtTime(s.midFreq, t);
      this.highShelfFilter.gain.setValueAtTime(s.highGain, t);
    } else {
      this.lowShelfFilter.gain.setValueAtTime(0, t);
      this.midParametricFilter.gain.setValueAtTime(0, t);
      this.highShelfFilter.gain.setValueAtTime(0, t);
    }

    if (s.compEnabled) {
      const thresh = -40 * s.compAmount;
      const ratio = 1 + s.compAmount * 8;
      this.dynamicsCompressor.threshold.setValueAtTime(thresh, t);
      this.dynamicsCompressor.ratio.setValueAtTime(ratio, t);
    } else {
      this.dynamicsCompressor.threshold.setValueAtTime(0, t);
      this.dynamicsCompressor.ratio.setValueAtTime(1, t);
    }

    this.ambienceSendNode.gain.setValueAtTime(s.ambienceSend, t);
    this.reverbSendNode.gain.setValueAtTime(s.reverbSend, t);
  }
}
