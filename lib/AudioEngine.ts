// lib/daw/AudioEngine.ts
import { PianoEngine, type PianoPresetType } from "@/lib/daw/PianoEngine";

export interface AudioRegion {
  id: string;
  name: string;
  buffer: AudioBuffer;
  startTime: number;    // Timeline start position in seconds
  duration: number;     // Active length in seconds
  offset: number;       // Trim start offset into original buffer
  gain?: number;        // Clip level (0 to 2.0)
  muted?: boolean;
}

export interface MidiNoteData {
  id: string;
  pitch: number;
  startStep: number;
  length: number;
  velocity?: number;
}

export interface DrumPatternData {
  kick: boolean[];
  snare: boolean[];
  hat: boolean[];
  openHat?: boolean[];
  clap?: boolean[];
  percussion?: boolean[];
  swing?: number;
}

export interface SynthSettings {
  waveform: OscillatorType;
  attack: number;
  decay: number;
  sustain: number;
  release: number;
  cutoff: number;
  resonance: number;
}

export interface AutomationPoint {
  id: string;
  time: number;
  value: number;
}

export interface TrackAutomation {
  volume?: AutomationPoint[];
  pan?: AutomationPoint[];
  reverbSend?: AutomationPoint[];
}

export interface ArrangerSection {
  id: string;
  name: string;
  color: string;
  startBar: number;
  endBar: number;
}

export interface MixerBus {
  id: string;
  name: string;
  volume: number;
  pan: number;
  reverbSend: number;
}

export interface MasterAutomationPoint {
  id: string;
  time: number;
  value: number;
}

export interface SamplerPad {
  id: string;
  name: string;
  key: string;
  startTime: number;
  endTime: number;
}

export interface SamplerData {
  sampleName: string;
  sample: AudioBuffer;
  pads: SamplerPad[];
}

export interface StudioScene {
  id: string;
  name: string;
  color: string;
  regionIdsByTrack: Record<number, string[]>;
  midiNotesByTrack?: Record<number, MidiNoteData[]>;
  drumPatternsByTrack?: Record<number, DrumPatternData>;
}

export interface GuitarAmpSettings {
  drive: number;
  bass: number;
  mid: number;
  treble: number;
  master: number;
  cabSim: boolean;
  reverb: number;
  delay: number;
  driveEnabled: boolean;
  delayEnabled: boolean;
  chorusEnabled: boolean;
  reverbEnabled: boolean;
}

export interface TrackProcessingSettings {
  inputGain: number;
  gateEnabled: boolean;
  gateThreshold: number;
  compEnabled: boolean;
  compAmount: number;
  compAttack: number;
  compRelease: number;
  eqEnabled: boolean;
  lowGain: number;
  midGain: number;
  midFreq: number;
  highGain: number;
  lowCut: boolean;
  ambienceSend: number;
  reverbSend: number;
  deEsserEnabled: boolean;
  deEsserAmount: number;
}

export interface TrackData {
  id: number;
  name: string;
  category?: "audio" | "midi" | "drum";
  instrument: string;
  color: string;
  volume: number;       // 0 to 1.0
  pan: number;          // -1.0 to 1.0
  mute: boolean;
  solo: boolean;
  armed: boolean;
  regions: AudioRegion[];
  settings?: TrackProcessingSettings;
  midiNotes?: MidiNoteData[];
  drumPattern?: DrumPatternData;
  synthSettings?: SynthSettings;
  pianoPreset?: PianoPresetType;
  ampSettings?: GuitarAmpSettings;
  ampEnabled?: boolean;
  inputDevice?: string;
  monitoring?: boolean;
  automation?: TrackAutomation;
  busId?: string;
  sampler?: SamplerData;
}

interface TrackMixNodes {
  input: GainNode;
  gain: GainNode;
  ampMaster: GainNode;
  pan: StereoPannerNode;
  routingNode: GainNode;
  routedBusId?: string;
  filters: BiquadFilterNode[];
  compressor: DynamicsCompressorNode;
  ampDrive: WaveShaperNode;
  deEsser: BiquadFilterNode;
  ampFilters: BiquadFilterNode[];
  chorusDelay: DelayNode;
  chorusWet: GainNode;
  chorusLfo: OscillatorNode;
  chorusDepth: GainNode;
  sends: Array<{ wet: GainNode; type: "reverb" | "ambience" | "delay" }>;
  currentDrive: number;
  audible: boolean;
}

interface BusMixNodes {
  input: GainNode;
  gain: GainNode;
  pan: StereoPannerNode;
  delay: DelayNode;
  reverbWet: GainNode;
}

export class AudioEngine {
  private static instance: AudioEngine;
  public ctx: AudioContext | null = null;
  public masterGain: GainNode | null = null;
  private activeSources: AudioScheduledSourceNode[] = [];
  private activeNodes: AudioNode[] = [];
  private sceneSources: AudioScheduledSourceNode[] = [];
  private sceneNodes: AudioNode[] = [];
  private sceneTimers: number[] = [];
  private masterNodes: AudioNode[] = [];
  private activeTrackMix = new Map<number, TrackMixNodes>();
  private activeBusMix = new Map<string, BusMixNodes>();

  private constructor() {}

  public static getInstance(): AudioEngine {
    if (!AudioEngine.instance) {
      AudioEngine.instance = new AudioEngine();
    }
    return AudioEngine.instance;
  }

  public init(): AudioContext {
    if (!this.ctx) {
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioContextClass({ latencyHint: "interactive" });
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(0.85, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);
    }
    if (this.ctx.state === "suspended") {
      this.ctx.resume();
    }
    return this.ctx;
  }

  public stopPlayback(): void {
    this.stopScene();
    this.activeSources.forEach((src) => {
      try {
        src.stop();
        src.disconnect();
      } catch {}
    });
    this.activeSources = [];
    this.activeNodes.forEach((node) => {
      try {
        node.disconnect();
      } catch {}
    });
    this.activeNodes = [];
    this.activeTrackMix.clear();
    this.activeBusMix.clear();
  }

  public stopScene(): void {
    this.sceneTimers.forEach((timer) => window.clearInterval(timer));
    this.sceneTimers = [];
    this.sceneSources.forEach((source) => {
      try {
        source.stop();
        source.disconnect();
      } catch {}
    });
    const sceneSourceSet = new Set(this.sceneSources);
    this.activeSources = this.activeSources.filter((source) => !sceneSourceSet.has(source));
    this.sceneSources = [];
    this.sceneNodes.forEach((node) => {
      try { node.disconnect(); } catch {}
    });
    this.sceneNodes = [];
  }

  public setMasterVolume(volume: number): void {
    if (!this.ctx || !this.masterGain) return;
    this.masterGain.gain.setTargetAtTime(Math.max(0, Math.min(1, volume)), this.ctx.currentTime, 0.015);
  }

  public playSamplerPad(track: TrackData, pad: SamplerPad): void {
    if (!track.sampler || pad.startTime < 0 || pad.endTime <= pad.startTime ||
      pad.endTime > track.sampler.sample.duration) return;
    const ctx = this.init();
    const source = ctx.createBufferSource();
    source.buffer = track.sampler.sample;
    source.connect(this.activeTrackMix.get(track.id)?.input ?? this.masterGain!);
    source.start(ctx.currentTime, pad.startTime, pad.endTime - pad.startTime);
    this.activeSources.push(source);
  }

  public launchScene(
    tracks: TrackData[],
    scene: StudioScene,
    bpm: number,
    timeSignature: string,
    delaySeconds = 0,
    buses: MixerBus[] = []
  ): void {
    const ctx = this.init();
    this.stopScene();
    const hasSolo = tracks.some((track) => track.solo);
    const startTime = ctx.currentTime + Math.max(0.05, delaySeconds);
    const beatDuration = 60 / Math.max(1, bpm);
    const stepDuration = beatDuration / 4;
    const [numerator, denominator] = timeSignature.split("/").map(Number);
    const barDuration = beatDuration * numerator * (4 / denominator);
    const fallbackBusInputs = new Map<string, GainNode>();
    const getTrackInput = (track: TrackData): AudioNode => {
      const activeMix = this.activeTrackMix.get(track.id);
      if (activeMix) return activeMix.input;
      const input = ctx.createGain();
      const gain = ctx.createGain();
      const pan = ctx.createStereoPanner();
      gain.gain.value = track.volume;
      pan.pan.value = track.pan;
      input.connect(gain);
      gain.connect(pan);
      const bus = track.busId ? buses.find((candidate) => candidate.id === track.busId) : undefined;
      if (bus) {
        let busInput = fallbackBusInputs.get(bus.id);
        if (!busInput) {
          busInput = ctx.createGain();
          const busGain = ctx.createGain();
          const busPan = ctx.createStereoPanner();
          busGain.gain.value = bus.volume;
          busPan.pan.value = bus.pan;
          busInput.connect(busGain);
          busGain.connect(busPan);
          busPan.connect(this.masterGain!);
          this.sceneNodes.push(busInput, busGain, busPan);
          fallbackBusInputs.set(bus.id, busInput);
        }
        pan.connect(busInput);
      } else {
        pan.connect(this.masterGain!);
      }
      this.sceneNodes.push(input, gain, pan);
      return input;
    };

    tracks.forEach((track) => {
      if (track.mute || (hasSolo && !track.solo)) return;
      const destination = getTrackInput(track);
      const regionIds = new Set(scene.regionIdsByTrack[track.id] ?? []);
      track.regions.filter((region) => regionIds.has(region.id) && !region.muted).forEach((region) => {
        const source = ctx.createBufferSource();
        source.buffer = region.buffer;
        source.loop = true;
        source.loopStart = region.offset;
        source.loopEnd = Math.min(region.buffer.duration, region.offset + region.duration);
        source.connect(destination);
        source.start(startTime, region.offset);
        this.activeSources.push(source);
        this.sceneSources.push(source);
      });
    });

    const repeatingEntries: Array<{ duration: number; schedule: (when: number) => void; nextTime: number }> = [];
    Object.entries(scene.midiNotesByTrack ?? {}).forEach(([trackId, notes]) => {
      const track = tracks.find((candidate) => candidate.id === Number(trackId));
      if (!track || track.mute || (hasSolo && !track.solo) || notes.length === 0) return;
      const destination = getTrackInput(track);
      const cycleDuration = Math.max(barDuration, barDuration * 4);
      const schedule = (when: number) => {
        const sourceStart = this.activeSources.length;
        const nodeStart = this.activeNodes.length;
        notes.forEach((note) => this.scheduleTone(
          destination,
          note.pitch,
          note.velocity ?? 100,
          note.startStep * stepDuration,
          Math.max(1, note.length) * stepDuration,
          0,
          when,
          track.synthSettings
        ));
        this.sceneSources.push(...this.activeSources.slice(sourceStart));
        this.sceneNodes.push(...this.activeNodes.splice(nodeStart));
      };
      repeatingEntries.push({ duration: cycleDuration, schedule, nextTime: startTime });
    });

    Object.entries(scene.drumPatternsByTrack ?? {}).forEach(([trackId, pattern]) => {
      const track = tracks.find((candidate) => candidate.id === Number(trackId));
      if (!track || track.mute || (hasSolo && !track.solo)) return;
      const destination = getTrackInput(track);
      const patternLength = Math.max(pattern.kick.length, pattern.snare.length, pattern.hat.length);
      if (patternLength < 1) return;
      const cycleDuration = patternLength * stepDuration;
      const swing = Math.max(0, Math.min(0.5, pattern.swing ?? 0));
      const schedule = (when: number) => {
        const sourceStart = this.activeSources.length;
        const nodeStart = this.activeNodes.length;
        for (let step = 0; step < patternLength; step++) {
          const stepTime = when + step * stepDuration + (step % 2 === 1 ? swing * stepDuration * 0.5 : 0);
          if (pattern.kick[step]) this.scheduleDrum(destination, "kick", stepTime);
          if (pattern.snare[step]) this.scheduleDrum(destination, "snare", stepTime);
          if (pattern.hat[step]) this.scheduleDrum(destination, "hat", stepTime);
          for (const kind of ["openHat", "clap", "percussion"] as const) {
            if (pattern[kind]?.[step]) this.scheduleDrum(destination, kind, stepTime);
          }
        }
        this.sceneSources.push(...this.activeSources.slice(sourceStart));
        this.sceneNodes.push(...this.activeNodes.splice(nodeStart));
      };
      repeatingEntries.push({ duration: cycleDuration, schedule, nextTime: startTime });
    });

    repeatingEntries.forEach((entry) => entry.schedule(entry.nextTime));
    if (repeatingEntries.length) {
      const timer = window.setInterval(() => {
        const horizon = ctx.currentTime + 0.12;
        repeatingEntries.forEach((entry) => {
          while (entry.nextTime <= horizon) {
            entry.nextTime += entry.duration;
            entry.schedule(entry.nextTime);
          }
        });
      }, 25);
      this.sceneTimers.push(timer);
    }
  }

  private configureMasterProcessing(settings?: TrackProcessingSettings): void {
    if (!this.ctx || !this.masterGain) return;
    if (!settings) {
      if (this.masterNodes.length > 0) {
        this.masterNodes.forEach((node) => {
          try { node.disconnect(); } catch {}
        });
        this.masterNodes = [];
        this.masterGain.disconnect();
        this.masterGain.connect(this.ctx.destination);
      }
      return;
    }
    let low = this.masterNodes[0] as BiquadFilterNode | undefined;
    let mid = this.masterNodes[1] as BiquadFilterNode | undefined;
    let high = this.masterNodes[2] as BiquadFilterNode | undefined;
    let compressor = this.masterNodes[3] as DynamicsCompressorNode | undefined;
    let limiter = this.masterNodes[4] as DynamicsCompressorNode | undefined;
    if (!low || !mid || !high || !compressor || !limiter) {
      this.masterGain.disconnect();
      low = this.ctx.createBiquadFilter();
      low.type = "lowshelf";
      mid = this.ctx.createBiquadFilter();
      mid.type = "peaking";
      mid.Q.value = 0.8;
      high = this.ctx.createBiquadFilter();
      high.type = "highshelf";
      compressor = this.ctx.createDynamicsCompressor();
      limiter = this.ctx.createDynamicsCompressor();
      limiter.threshold.value = -1;
      limiter.knee.value = 0;
      limiter.ratio.value = 20;
      limiter.attack.value = 0.001;
      limiter.release.value = 0.08;
      this.masterGain.connect(low);
      low.connect(mid);
      mid.connect(high);
      high.connect(compressor);
      compressor.connect(limiter);
      limiter.connect(this.ctx.destination);
      this.masterNodes = [low, mid, high, compressor, limiter];
    }
    low.frequency.value = 100;
    low.gain.setTargetAtTime(settings.eqEnabled ? settings.lowGain : 0, this.ctx.currentTime, 0.02);
    mid.frequency.value = settings.midFreq;
    mid.gain.setTargetAtTime(settings.eqEnabled ? settings.midGain : 0, this.ctx.currentTime, 0.02);
    high.frequency.value = 8000;
    high.gain.setTargetAtTime(settings.eqEnabled ? settings.highGain : 0, this.ctx.currentTime, 0.02);
    if (settings.compEnabled || settings.gateEnabled) {
      compressor.threshold.setTargetAtTime(settings.gateEnabled ? settings.gateThreshold : -40 * settings.compAmount, this.ctx.currentTime, 0.02);
      compressor.ratio.setTargetAtTime(settings.compEnabled ? 1 + settings.compAmount * 8 : 20, this.ctx.currentTime, 0.02);
      compressor.attack.value = settings.compAttack;
      compressor.release.value = settings.compRelease;
    } else {
      compressor.ratio.setTargetAtTime(1, this.ctx.currentTime, 0.02);
    }
  }

  private updateTrackMix(track: TrackData, nodes: TrackMixNodes, hasSolo: boolean): void {
    if (!this.ctx) return;
    const time = this.ctx.currentTime;
    const settings = track.settings;
    const amp = track.ampSettings;
    const audible = !track.mute && !(hasSolo && !track.solo);
    if (!track.automation?.volume?.length || !audible || !nodes.audible) {
      if (!audible && track.automation?.volume?.length) nodes.gain.gain.cancelScheduledValues(time);
      nodes.gain.gain.setTargetAtTime(audible ? track.volume : 0, time, 0.015);
    }
    nodes.audible = audible;
    nodes.ampMaster.gain.setTargetAtTime(track.ampEnabled ? amp?.master ?? 1 : 1, time, 0.015);
    if (!track.automation?.pan?.length) nodes.pan.pan.setTargetAtTime(track.pan, time, 0.015);
    nodes.filters[0].frequency.setTargetAtTime(settings?.lowCut ? 80 : 10, time, 0.02);
    nodes.filters[1].gain.setTargetAtTime(settings?.eqEnabled ? settings.lowGain : 0, time, 0.02);
    nodes.filters[2].frequency.setTargetAtTime(settings?.midFreq ?? 1200, time, 0.02);
    nodes.filters[2].gain.setTargetAtTime(settings?.eqEnabled ? settings.midGain : 0, time, 0.02);
    nodes.filters[3].gain.setTargetAtTime(settings?.eqEnabled ? settings.highGain : 0, time, 0.02);
    nodes.deEsser.gain.setTargetAtTime(
      settings?.deEsserEnabled ? -12 * (settings.deEsserAmount ?? 0) : 0,
      time,
      0.02
    );
    if (settings?.compEnabled || settings?.gateEnabled) {
      nodes.compressor.threshold.setTargetAtTime(
        settings.gateEnabled ? settings.gateThreshold : -40 * settings.compAmount,
        time,
        0.02
      );
      nodes.compressor.ratio.setTargetAtTime(settings.compEnabled ? 1 + settings.compAmount * 8 : 20, time, 0.02);
      nodes.compressor.attack.value = settings.compAttack;
      nodes.compressor.release.value = settings.compRelease;
    } else {
      nodes.compressor.ratio.setTargetAtTime(1, time, 0.02);
    }
    const drive = track.ampEnabled && amp?.driveEnabled !== false ? (amp?.drive ?? 0) : 0;
    if (drive !== nodes.currentDrive) {
      const curve = new Float32Array(44100);
      const amount = drive * 45;
      for (let i = 0; i < curve.length; i++) {
        const x = (i * 2) / curve.length - 1;
        curve[i] = drive === 0
          ? x
          : ((3 + amount) * x * 20 * (Math.PI / 180)) / (Math.PI + amount * Math.abs(x));
      }
      nodes.ampDrive.curve = curve;
      nodes.currentDrive = drive;
    }
    nodes.ampFilters[0].gain.setTargetAtTime(track.ampEnabled ? (amp?.bass ?? 0) : 0, time, 0.02);
    nodes.ampFilters[1].gain.setTargetAtTime(track.ampEnabled ? (amp?.mid ?? 0) : 0, time, 0.02);
    nodes.ampFilters[2].gain.setTargetAtTime(track.ampEnabled ? (amp?.treble ?? 0) : 0, time, 0.02);
    nodes.ampFilters[3].frequency.setTargetAtTime(track.ampEnabled && amp?.cabSim ? 4500 : 20000, time, 0.02);
    nodes.chorusWet.gain.setTargetAtTime(track.ampEnabled && amp?.chorusEnabled ? 0.35 : 0, time, 0.02);
    nodes.chorusLfo.frequency.setTargetAtTime(track.ampEnabled && amp?.chorusEnabled ? 0.8 : 0.01, time, 0.02);
    const sendLevels = {
      reverb: Math.max(settings?.reverbSend ?? 0, track.ampEnabled && amp?.reverbEnabled !== false ? (amp?.reverb ?? 0) : 0),
      ambience: settings?.ambienceSend ?? 0,
      delay: track.ampEnabled && amp?.delayEnabled ? (amp?.delay ?? 0) : 0,
    };
    nodes.sends.forEach(({ wet, type }) => {
      if (type === "reverb" && track.automation?.reverbSend?.length) return;
      const amount = sendLevels[type];
      wet.gain.setTargetAtTime(Math.min(0.45, amount * (type === "delay" ? 0.4 : 0.25)), time, 0.02);
    });
  }

  private scheduleAutomation(
    parameter: AudioParam,
    points: TrackAutomation["volume"],
    baseValue: number,
    startOffsetSec: number,
    scheduledTime: number,
    endOffsetSec: number
  ): void {
    const ordered = [...(points ?? [])].sort((a, b) => a.time - b.time);
    let left = { time: 0, value: baseValue };
    let right = ordered[0];
    for (let index = 0; index < ordered.length; index++) {
      if (ordered[index].time <= startOffsetSec) left = ordered[index];
      else {
        right = ordered[index];
        break;
      }
    }
    const progress = right && right.time > left.time
      ? Math.max(0, Math.min(1, (startOffsetSec - left.time) / (right.time - left.time)))
      : 0;
    const valueAtStart = right ? left.value + (right.value - left.value) * progress : left.value;
    parameter.setValueAtTime(valueAtStart, scheduledTime);
    ordered.forEach((point) => {
      if (point.time > startOffsetSec && point.time <= endOffsetSec) {
        parameter.linearRampToValueAtTime(point.value, scheduledTime + point.time - startOffsetSec);
      }
    });
  }

  public updateMix(
    tracks: TrackData[],
    masterVolume: number,
    masterSettings?: TrackProcessingSettings,
    buses: MixerBus[] = []
  ): void {
    this.setMasterVolume(masterVolume);
    this.configureMasterProcessing(masterSettings);
    const hasSolo = tracks.some((track) => track.solo);
    const currentTrackIds = new Set(tracks.map((track) => track.id));
    this.activeTrackMix.forEach((nodes, trackId) => {
      if (!currentTrackIds.has(trackId)) nodes.gain.gain.setTargetAtTime(0, this.ctx?.currentTime ?? 0, 0.015);
    });
    tracks.forEach((track) => {
      const nodes = this.activeTrackMix.get(track.id);
      if (nodes) {
        this.updateTrackMix(track, nodes, hasSolo);
        const busId = track.busId && this.activeBusMix.has(track.busId) ? track.busId : undefined;
        if (nodes.routedBusId !== busId) {
          nodes.routingNode.disconnect();
          nodes.routingNode.connect(busId
            ? this.activeBusMix.get(busId)!.input
            : this.masterGain!);
          nodes.routedBusId = busId;
        }
      }
    });
    buses.forEach((bus) => {
      const nodes = this.activeBusMix.get(bus.id);
      if (!nodes || !this.ctx) return;
      const now = this.ctx.currentTime;
      nodes.gain.gain.setTargetAtTime(bus.volume, now, 0.015);
      nodes.pan.pan.setTargetAtTime(bus.pan, now, 0.015);
      nodes.reverbWet.gain.setTargetAtTime(Math.min(0.45, bus.reverbSend * 0.25), now, 0.02);
    });
  }

  public schedulePlayback(
    tracks: TrackData[],
    startOffsetSec: number,
    bpm = 120,
    masterVolume = 1,
    masterSettings?: TrackProcessingSettings,
    endOffsetSec = Number.POSITIVE_INFINITY,
    buses: MixerBus[] = [],
    masterAutomation: MasterAutomationPoint[] = []
  ): void {
    const ctx = this.init();
    this.stopPlayback();
    this.setMasterVolume(masterVolume);
    this.configureMasterProcessing(masterSettings);

    const hasSolo = tracks.some((t) => t.solo);
    const scheduledTime = ctx.currentTime + 0.05;
    if (masterAutomation.length) {
      this.scheduleAutomation(this.masterGain!.gain, masterAutomation, masterVolume, startOffsetSec, scheduledTime, endOffsetSec);
    }
    const busNodes = new Map<string, BusMixNodes>();
    buses.forEach((bus) => {
      const input = ctx.createGain();
      const gain = ctx.createGain();
      const pan = ctx.createStereoPanner();
      const delay = ctx.createDelay(2);
      const feedback = ctx.createGain();
      const reverbWet = ctx.createGain();
      gain.gain.value = bus.volume;
      pan.pan.value = bus.pan;
      delay.delayTime.value = 0.32;
      feedback.gain.value = 0.18;
      reverbWet.gain.value = Math.min(0.45, bus.reverbSend * 0.25);
      input.connect(gain);
      gain.connect(pan);
      pan.connect(this.masterGain!);
      pan.connect(delay);
      delay.connect(feedback);
      feedback.connect(delay);
      delay.connect(reverbWet);
      reverbWet.connect(this.masterGain!);
      busNodes.set(bus.id, { input, gain, pan, delay, reverbWet });
      this.activeBusMix.set(bus.id, { input, gain, pan, delay, reverbWet });
      this.activeNodes.push(input, gain, pan, delay, feedback, reverbWet);
    });
    const piano = PianoEngine.getInstance();
    const stepDuration = 60 / Math.max(1, bpm) / 4;
    const effectiveEndOffset = Number.isFinite(endOffsetSec)
      ? Math.max(startOffsetSec, endOffsetSec)
      : Math.max(startOffsetSec + 8, ...tracks.flatMap((track) => [
        ...track.regions.map((region) => region.startTime + region.duration),
        ...(track.midiNotes ?? []).map((note) => (note.startStep + note.length) * stepDuration),
      ]));

    tracks.forEach((track) => {
      const input = ctx.createGain();
      const trackGain = ctx.createGain();
      const ampMaster = ctx.createGain();
      const trackPan = ctx.createStereoPanner();
      const routingNode = ctx.createGain();
      const filters = [
        ctx.createBiquadFilter(),
        ctx.createBiquadFilter(),
        ctx.createBiquadFilter(),
        ctx.createBiquadFilter(),
      ];
      filters[0].type = "highpass";
      filters[1].type = "lowshelf";
      filters[1].frequency.value = 100;
      filters[2].type = "peaking";
      filters[2].Q.value = 0.8;
      filters[3].type = "highshelf";
      filters[3].frequency.value = 8000;
      const compressor = ctx.createDynamicsCompressor();
      const ampDrive = ctx.createWaveShaper();
      const deEsser = ctx.createBiquadFilter();
      deEsser.type = "highshelf";
      deEsser.frequency.value = 6500;
      ampDrive.oversample = "4x";
      const ampFilters = [
        ctx.createBiquadFilter(),
        ctx.createBiquadFilter(),
        ctx.createBiquadFilter(),
        ctx.createBiquadFilter(),
      ];
      ampFilters[0].type = "lowshelf";
      ampFilters[0].frequency.value = 250;
      ampFilters[1].type = "peaking";
      ampFilters[1].frequency.value = 1000;
      ampFilters[1].Q.value = 0.7;
      ampFilters[2].type = "highshelf";
      ampFilters[2].frequency.value = 3500;
      ampFilters[3].type = "lowpass";
      input.connect(filters[0]);
      filters[0].connect(filters[1]);
      filters[1].connect(filters[2]);
      filters[2].connect(filters[3]);
      filters[3].connect(deEsser);
      deEsser.connect(compressor);
      compressor.connect(ampDrive);
      ampDrive.connect(ampFilters[0]);
      ampFilters[0].connect(ampFilters[1]);
      ampFilters[1].connect(ampFilters[2]);
      ampFilters[2].connect(ampFilters[3]);
      ampFilters[3].connect(trackGain);
      const chorusDelay = ctx.createDelay(0.05);
      const chorusWet = ctx.createGain();
      const chorusLfo = ctx.createOscillator();
      const chorusDepth = ctx.createGain();
      chorusDelay.delayTime.value = 0.02;
      chorusWet.gain.value = 0;
      chorusLfo.frequency.value = 0.01;
      chorusDepth.gain.value = 0.004;
      chorusLfo.connect(chorusDepth);
      chorusDepth.connect(chorusDelay.delayTime);
      chorusLfo.start();
      ampFilters[3].connect(chorusDelay);
      chorusDelay.connect(chorusWet);
      chorusWet.connect(trackGain);
      trackGain.connect(ampMaster);
      ampMaster.connect(trackPan);
      const bus = track.busId ? busNodes.get(track.busId) : undefined;
      trackPan.connect(routingNode);
      routingNode.connect(bus?.input ?? this.masterGain!);
      const sends: TrackMixNodes["sends"] = [];
      (["reverb", "ambience", "delay"] as const).forEach((type) => {
        const delay = ctx.createDelay(2);
        delay.delayTime.value = type === "ambience" ? 0.11 : type === "delay" ? 0.27 : 0.32;
        const feedback = ctx.createGain();
        feedback.gain.value = type === "delay" ? 0.25 : 0.18;
        const wet = ctx.createGain();
        wet.gain.value = 0;
        trackPan.connect(delay);
        delay.connect(feedback);
        feedback.connect(delay);
        delay.connect(wet);
        wet.connect(routingNode);
        sends.push({ wet, type });
        this.activeNodes.push(delay, feedback, wet);
      });
      const mixNodes: TrackMixNodes = {
        input,
        gain: trackGain,
        ampMaster,
        pan: trackPan,
        routingNode,
        routedBusId: bus ? track.busId : undefined,
        filters,
        compressor,
        ampDrive,
        deEsser,
        ampFilters,
        chorusDelay,
        chorusWet,
        chorusLfo,
        chorusDepth,
        sends,
        currentDrive: -1,
        audible: false,
      };
      this.activeTrackMix.set(track.id, mixNodes);
      this.updateTrackMix(track, mixNodes, hasSolo);
      if (track.automation?.volume?.length) {
        if (track.mute || (hasSolo && !track.solo)) {
          trackGain.gain.setValueAtTime(0, scheduledTime);
        } else {
          this.scheduleAutomation(trackGain.gain, track.automation.volume, track.volume, startOffsetSec, scheduledTime, effectiveEndOffset);
        }
      }
      if (track.automation?.pan?.length) {
        this.scheduleAutomation(trackPan.pan, track.automation.pan, track.pan, startOffsetSec, scheduledTime, effectiveEndOffset);
      }
      const reverbSend = Math.max(
        track.settings?.reverbSend ?? 0,
        track.ampEnabled && track.ampSettings?.reverbEnabled !== false ? (track.ampSettings?.reverb ?? 0) : 0
      );
      if (track.automation?.reverbSend?.length) {
        const reverbWet = sends.find((send) => send.type === "reverb")?.wet;
        if (reverbWet) {
          const scale = Math.min(0.45, 0.25);
          const scaledPoints = track.automation.reverbSend.map((point) => ({ ...point, value: point.value * scale }));
          this.scheduleAutomation(reverbWet.gain, scaledPoints, Math.min(0.45, reverbSend * 0.25), startOffsetSec, scheduledTime, effectiveEndOffset);
        }
      }
      this.activeNodes.push(input, trackGain, ampMaster, trackPan, routingNode, ...filters, compressor, ampDrive, deEsser, ...ampFilters, chorusDelay, chorusWet, chorusDepth);
      this.activeSources.push(chorusLfo);

      track.regions.forEach((region) => {
        if (!region.muted && region.startTime + region.duration > startOffsetSec && region.startTime < effectiveEndOffset) {
          const source = ctx.createBufferSource();
          source.buffer = region.buffer;

          const when = Math.max(0, region.startTime - startOffsetSec) + scheduledTime;
          const grainOffset = startOffsetSec > region.startTime
            ? (startOffsetSec - region.startTime) + region.offset
            : region.offset;
          const playDuration = Math.min(
            region.duration - Math.max(0, startOffsetSec - region.startTime),
            effectiveEndOffset - Math.max(startOffsetSec, region.startTime),
            region.buffer.duration - grainOffset
          );
          if (playDuration <= 0) return;

          const regionGain = ctx.createGain();
          regionGain.gain.value = region.gain ?? 1;
          source.connect(regionGain);
          regionGain.connect(input);
          this.activeNodes.push(regionGain);
          source.start(when, grainOffset, playDuration);
          this.activeSources.push(source);
        }
      });

      const midiNotes = track.midiNotes ?? [];
      midiNotes.forEach((note) => {
        const start = note.startStep * stepDuration;
        const duration = Math.min(Math.max(1, note.length) * stepDuration, effectiveEndOffset - start);
        if (start + duration <= startOffsetSec) return;
        const playedAsPiano = track.pianoPreset && piano.scheduleNote(
          ctx,
          note.pitch,
          note.velocity ?? 100,
          track.pianoPreset,
          input,
          scheduledTime + Math.max(0, start - startOffsetSec),
          duration - Math.max(0, startOffsetSec - start),
          track.synthSettings?.release,
        );
        if (!playedAsPiano) this.scheduleTone(input, note.pitch, note.velocity ?? 100, start, duration, startOffsetSec, scheduledTime, track.synthSettings);
      });

      if (track.category === "drum" && track.drumPattern) {
        const pattern = track.drumPattern;
        const rows = [pattern.kick, pattern.snare, pattern.hat, pattern.openHat ?? [], pattern.clap ?? [], pattern.percussion ?? []];
        const patternLength = Math.max(...rows.map((row) => row.length));
        const swing = Math.max(0, Math.min(0.5, pattern.swing ?? 0));
        if (patternLength === 0) return;
        for (let cycle = 0; ; cycle++) {
          let hasScheduledStep = false;
          for (let step = 0; step < patternLength; step++) {
            const when = (cycle * patternLength + step) * stepDuration + (step % 2 === 1 ? swing * stepDuration * 0.5 : 0);
            if (when >= effectiveEndOffset) return;
            if (when < startOffsetSec) continue;
            if (pattern.kick[step]) {
              this.scheduleDrum(input, "kick", scheduledTime + when - startOffsetSec);
              hasScheduledStep = true;
            }
            if (pattern.snare[step]) {
              this.scheduleDrum(input, "snare", scheduledTime + when - startOffsetSec);
              hasScheduledStep = true;
            }
            if (pattern.hat[step]) {
              this.scheduleDrum(input, "hat", scheduledTime + when - startOffsetSec);
              hasScheduledStep = true;
            }
            for (const kind of ["openHat", "clap", "percussion"] as const) {
              if (pattern[kind]?.[step]) {
                this.scheduleDrum(input, kind, scheduledTime + when - startOffsetSec);
                hasScheduledStep = true;
              }
            }
          }
          if (cycle * patternLength * stepDuration >= effectiveEndOffset || (!hasScheduledStep && cycle > 1)) break;
        }
      }
    });
  }

  private scheduleTone(
    destination: AudioNode,
    pitch: number,
    velocity: number,
    start: number,
    duration: number,
    offset: number,
    scheduledTime: number,
    settings?: SynthSettings
  ): void {
    const ctx = this.ctx!;
    const when = scheduledTime + Math.max(0, start - offset);
    const remaining = duration - Math.max(0, offset - start);
    if (remaining <= 0) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    osc.type = settings?.waveform ?? "triangle";
    osc.frequency.value = 440 * Math.pow(2, (pitch - 69) / 12);
    filter.type = "lowpass";
    filter.frequency.value = settings?.cutoff ?? 12000;
    filter.Q.value = settings?.resonance ?? 0.7;
    const attack = settings?.attack ?? 0.01;
    const decay = settings?.decay ?? 0.15;
    const sustain = settings?.sustain ?? 0.75;
    const release = settings?.release ?? 0.15;
    const peak = Math.max(0.02, velocity / 127) * 0.22;
    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.linearRampToValueAtTime(peak, when + attack);
    gain.gain.linearRampToValueAtTime(peak * sustain, when + attack + decay);
    gain.gain.setValueAtTime(peak * sustain, when + remaining);
    gain.gain.linearRampToValueAtTime(0.0001, when + remaining + release);
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(destination);
    osc.start(when);
    osc.stop(when + remaining + release + 0.02);
    this.activeNodes.push(filter, gain);
    this.activeSources.push(osc);
  }

  private scheduleDrum(destination: AudioNode, kind: "kick" | "snare" | "hat" | "openHat" | "clap" | "percussion", when: number): void {
    const ctx = this.ctx!;
    const gain = ctx.createGain();
    const osc = ctx.createOscillator();
    if (kind === "kick") {
      osc.type = "sine";
      osc.frequency.setValueAtTime(140, when);
      osc.frequency.exponentialRampToValueAtTime(42, when + 0.12);
      gain.gain.setValueAtTime(0.7, when);
      gain.gain.exponentialRampToValueAtTime(0.001, when + 0.28);
    } else {
      const noise = ctx.createBufferSource();
      const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.2), ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      noise.buffer = buffer;
      const filter = ctx.createBiquadFilter();
      filter.type = "highpass";
      filter.frequency.value = kind === "hat" ? 7000 : kind === "openHat" ? 5500 : kind === "percussion" ? 1800 : 1000;
      gain.gain.setValueAtTime(kind === "hat" ? 0.14 : kind === "openHat" ? 0.19 : kind === "clap" ? 0.28 : 0.25, when);
      gain.gain.exponentialRampToValueAtTime(0.001, when + (kind === "hat" ? 0.045 : kind === "openHat" ? 0.22 : kind === "percussion" ? 0.1 : 0.18));
      noise.connect(filter);
      filter.connect(gain);
      gain.connect(destination);
      noise.start(when);
      noise.stop(when + 0.2);
      this.activeSources.push(noise);
      this.activeNodes.push(filter, gain);
      return;
    }
    osc.connect(gain);
    gain.connect(destination);
    osc.start(when);
    osc.stop(when + 0.3);
    this.activeSources.push(osc);
    this.activeNodes.push(gain);
  }

  public async exportMasterWav(
    tracks: TrackData[],
    totalDurationSec: number,
    bpm = 120,
    masterVolume = 1,
    masterSettings?: TrackProcessingSettings,
    buses: MixerBus[] = [],
    masterAutomation: MasterAutomationPoint[] = []
  ): Promise<Blob> {
    const sampleRate = 44100;
    if (!Number.isFinite(totalDurationSec) || totalDurationSec <= 0 || totalDurationSec > 600) {
      throw new Error("Project duration must be between 0 and 10 minutes to export.");
    }
    const length = Math.ceil(sampleRate * totalDurationSec);
    const offlineCtx = new OfflineAudioContext(2, length, sampleRate);
    const piano = PianoEngine.getInstance();
    if (tracks.some((track) => track.pianoPreset && piano.isSampledPreset(track.pianoPreset))) await piano.preload(offlineCtx);
    const offlineMaster = offlineCtx.createGain();
    offlineMaster.gain.value = Math.max(0, Math.min(1, masterVolume));
    if (masterAutomation.length) {
      this.scheduleAutomation(offlineMaster.gain, masterAutomation, masterVolume, 0, 0, totalDurationSec);
    }
    const low = offlineCtx.createBiquadFilter();
    low.type = "lowshelf";
    low.frequency.value = 100;
    low.gain.value = masterSettings?.eqEnabled ? masterSettings.lowGain : 0;
    const mid = offlineCtx.createBiquadFilter();
    mid.type = "peaking";
    mid.frequency.value = masterSettings?.midFreq ?? 1200;
    mid.Q.value = 0.8;
    mid.gain.value = masterSettings?.eqEnabled ? masterSettings.midGain : 0;
    const high = offlineCtx.createBiquadFilter();
    high.type = "highshelf";
    high.frequency.value = 8000;
    high.gain.value = masterSettings?.eqEnabled ? masterSettings.highGain : 0;
    const compressor = offlineCtx.createDynamicsCompressor();
    if (masterSettings) {
      if (masterSettings.compEnabled || masterSettings.gateEnabled) {
        compressor.threshold.value = masterSettings.gateEnabled
          ? masterSettings.gateThreshold
          : -40 * masterSettings.compAmount;
        compressor.ratio.value = masterSettings.compEnabled ? 1 + masterSettings.compAmount * 8 : 20;
        compressor.attack.value = masterSettings.compAttack;
        compressor.release.value = masterSettings.compRelease;
      } else compressor.ratio.value = 1;
    }
    const limiter = offlineCtx.createDynamicsCompressor();
    limiter.threshold.value = -1;
    limiter.knee.value = 0;
    limiter.ratio.value = 20;
    limiter.attack.value = 0.001;
    limiter.release.value = 0.08;
    offlineMaster.connect(low);
    low.connect(mid);
    mid.connect(high);
    high.connect(compressor);
    compressor.connect(limiter);
    limiter.connect(offlineCtx.destination);

    const offlineBuses = new Map<string, BusMixNodes>();
    buses.forEach((bus) => {
      const input = offlineCtx.createGain();
      const gain = offlineCtx.createGain();
      const pan = offlineCtx.createStereoPanner();
      const delay = offlineCtx.createDelay(2);
      const feedback = offlineCtx.createGain();
      const reverbWet = offlineCtx.createGain();
      gain.gain.value = bus.volume;
      pan.pan.value = bus.pan;
      delay.delayTime.value = 0.32;
      feedback.gain.value = 0.18;
      reverbWet.gain.value = Math.min(0.45, bus.reverbSend * 0.25);
      input.connect(gain);
      gain.connect(pan);
      pan.connect(offlineMaster);
      pan.connect(delay);
      delay.connect(feedback);
      feedback.connect(delay);
      delay.connect(reverbWet);
      reverbWet.connect(offlineMaster);
      offlineBuses.set(bus.id, { input, gain, pan, delay, reverbWet });
    });

    const hasSolo = tracks.some((t) => t.solo);
    const stepDuration = 60 / Math.max(1, bpm) / 4;

    tracks.forEach((track) => {
      if (track.mute || (hasSolo && !track.solo)) return;

      const input = offlineCtx.createGain();
      const tGain = offlineCtx.createGain();
      const ampMaster = track.ampEnabled ? track.ampSettings?.master ?? 1 : 1;
      tGain.gain.value = track.volume * ampMaster;
      const tPan = offlineCtx.createStereoPanner();
      tPan.pan.value = track.pan;
      const bus = track.busId ? offlineBuses.get(track.busId) : undefined;
      if (track.automation?.volume?.length) {
        this.scheduleAutomation(
          tGain.gain,
          track.automation.volume.map((point) => ({ ...point, value: point.value * ampMaster })),
          track.volume * ampMaster,
          0,
          0,
          totalDurationSec
        );
      }
      if (track.automation?.pan?.length) {
        this.scheduleAutomation(tPan.pan, track.automation.pan, track.pan, 0, 0, totalDurationSec);
      }

      if (track.settings) {
        const lowCut = offlineCtx.createBiquadFilter();
        lowCut.type = "highpass";
        lowCut.frequency.value = track.settings.lowCut ? 80 : 10;
        const low = offlineCtx.createBiquadFilter();
        low.type = "lowshelf";
        low.frequency.value = 100;
        low.gain.value = track.settings.eqEnabled ? track.settings.lowGain : 0;
        const mid = offlineCtx.createBiquadFilter();
        mid.type = "peaking";
        mid.frequency.value = track.settings.midFreq;
        mid.Q.value = 0.8;
        mid.gain.value = track.settings.eqEnabled ? track.settings.midGain : 0;
        const high = offlineCtx.createBiquadFilter();
        high.type = "highshelf";
        high.frequency.value = 8000;
        high.gain.value = track.settings.eqEnabled ? track.settings.highGain : 0;
        const deEsser = offlineCtx.createBiquadFilter();
        deEsser.type = "highshelf";
        deEsser.frequency.value = 6500;
        deEsser.gain.value = track.settings.deEsserEnabled ? -12 * (track.settings.deEsserAmount ?? 0) : 0;
        const comp = offlineCtx.createDynamicsCompressor();
        if (track.settings.compEnabled || track.settings.gateEnabled) {
          comp.threshold.value = -40 * track.settings.compAmount;
          comp.ratio.value = track.settings.compEnabled ? 1 + track.settings.compAmount * 8 : 20;
          comp.attack.value = track.settings.compAttack;
          comp.release.value = track.settings.compRelease;
        } else comp.ratio.value = 1;
        if (track.settings.gateEnabled) comp.threshold.value = track.settings.gateThreshold;
        input.connect(lowCut);
        lowCut.connect(low);
        low.connect(mid);
        mid.connect(high);
        high.connect(deEsser);
        deEsser.connect(comp);
        if (track.ampEnabled && track.ampSettings) {
          const drive = offlineCtx.createWaveShaper();
          const curve = new Float32Array(44100);
          const amount = (track.ampSettings.driveEnabled ? track.ampSettings.drive : 0) * 45;
          for (let i = 0; i < curve.length; i++) {
            const x = (i * 2) / curve.length - 1;
            curve[i] = amount === 0 ? x : ((3 + amount) * x * 20 * (Math.PI / 180)) /
              (Math.PI + amount * Math.abs(x));
          }
          drive.curve = curve;
          drive.oversample = "4x";
          const bass = offlineCtx.createBiquadFilter();
          bass.type = "lowshelf";
          bass.frequency.value = 250;
          bass.gain.value = track.ampSettings.bass;
          const midTone = offlineCtx.createBiquadFilter();
          midTone.type = "peaking";
          midTone.frequency.value = 1000;
          midTone.Q.value = 0.7;
          midTone.gain.value = track.ampSettings.mid;
          const treble = offlineCtx.createBiquadFilter();
          treble.type = "highshelf";
          treble.frequency.value = 3500;
          treble.gain.value = track.ampSettings.treble;
          const cab = offlineCtx.createBiquadFilter();
          cab.type = "lowpass";
          cab.frequency.value = track.ampSettings.cabSim ? 4500 : 20000;
          comp.connect(drive);
          drive.connect(bass);
          bass.connect(midTone);
          midTone.connect(treble);
          treble.connect(cab);
          cab.connect(tGain);
          if (track.ampSettings.chorusEnabled) {
            const chorusDelay = offlineCtx.createDelay(0.05);
            const chorusWet = offlineCtx.createGain();
            const chorusLfo = offlineCtx.createOscillator();
            const chorusDepth = offlineCtx.createGain();
            chorusDelay.delayTime.value = 0.02;
            chorusWet.gain.value = 0.35;
            chorusLfo.frequency.value = 0.8;
            chorusDepth.gain.value = 0.004;
            chorusLfo.connect(chorusDepth);
            chorusDepth.connect(chorusDelay.delayTime);
            cab.connect(chorusDelay);
            chorusDelay.connect(chorusWet);
            chorusWet.connect(tGain);
            chorusLfo.start(0);
            chorusLfo.stop(totalDurationSec);
          }
        } else comp.connect(tGain);
      } else {
        input.connect(tGain);
      }
      tGain.connect(tPan);
      tPan.connect(bus?.input ?? offlineMaster);

      track.regions.forEach((region) => {
        if (region.muted || region.startTime >= totalDurationSec) return;
        const src = offlineCtx.createBufferSource();
        src.buffer = region.buffer;
        const regionGain = offlineCtx.createGain();
        regionGain.gain.value = region.gain ?? 1;
        src.connect(regionGain);
        regionGain.connect(input);
        src.start(region.startTime, region.offset, Math.min(region.duration, totalDurationSec - region.startTime));
      });
      const wetAmounts = [
        Math.max(track.settings?.reverbSend ?? 0, track.ampEnabled && track.ampSettings?.reverbEnabled !== false ? (track.ampSettings?.reverb ?? 0) : 0),
        track.settings?.ambienceSend ?? 0,
        track.ampEnabled && track.ampSettings?.delayEnabled ? (track.ampSettings?.delay ?? 0) : 0,
      ];
      wetAmounts.forEach((amount, index) => {
        if (amount <= 0 && !(index === 0 && track.automation?.reverbSend?.length)) return;
        const delay = offlineCtx.createDelay(2);
        delay.delayTime.value = index === 0 ? 0.32 : index === 1 ? 0.11 : 0.27;
        const feedback = offlineCtx.createGain();
        feedback.gain.value = index === 2 ? Math.min(0.55, amount * 0.65) : 0.18;
        const wet = offlineCtx.createGain();
        wet.gain.value = Math.min(0.45, amount * (index === 2 ? 0.4 : 0.25));
        if (index === 0 && track.automation?.reverbSend?.length) {
          this.scheduleAutomation(
            wet.gain,
            track.automation.reverbSend.map((point) => ({ ...point, value: point.value * 0.25 })),
            amount * 0.25,
            0,
            0,
            totalDurationSec
          );
        }
        tPan.connect(delay);
        delay.connect(feedback);
        feedback.connect(delay);
        delay.connect(wet);
        wet.connect(bus?.input ?? offlineMaster);
      });

      (track.midiNotes ?? []).forEach((note) => {
        const when = note.startStep * stepDuration;
        if (when >= totalDurationSec) return;
        if (track.pianoPreset && piano.scheduleNote(
          offlineCtx,
          note.pitch,
          note.velocity ?? 100,
          track.pianoPreset,
          input,
          when,
          Math.min(Math.max(1, note.length) * stepDuration, totalDurationSec - when),
          track.synthSettings?.release,
        )) return;
        const osc = offlineCtx.createOscillator();
        const gain = offlineCtx.createGain();
        const filter = offlineCtx.createBiquadFilter();
        const duration = Math.min(Math.max(1, note.length) * stepDuration, totalDurationSec - when);
        const synth = track.synthSettings;
        osc.type = synth?.waveform ?? "triangle";
        osc.frequency.value = 440 * Math.pow(2, (note.pitch - 69) / 12);
        filter.type = "lowpass";
        filter.frequency.value = synth?.cutoff ?? 12000;
        filter.Q.value = synth?.resonance ?? 0.7;
        const peak = Math.max(0.02, (note.velocity ?? 100) / 127) * 0.22;
        const attack = synth?.attack ?? 0.01;
        const decay = synth?.decay ?? 0.15;
        const release = synth?.release ?? 0.15;
        gain.gain.setValueAtTime(0.0001, when);
        gain.gain.linearRampToValueAtTime(peak, when + attack);
        gain.gain.linearRampToValueAtTime(peak * (synth?.sustain ?? 0.75), when + attack + decay);
        gain.gain.setValueAtTime(peak * (synth?.sustain ?? 0.75), when + duration);
        gain.gain.linearRampToValueAtTime(0.0001, when + duration + release);
        osc.connect(filter);
        filter.connect(gain);
        gain.connect(input);
        osc.start(when);
        osc.stop(Math.min(totalDurationSec, when + duration + release + 0.02));
      });

      if (track.category === "drum" && track.drumPattern) {
        const pattern = track.drumPattern;
        const rows = [pattern.kick, pattern.snare, pattern.hat, pattern.openHat ?? [], pattern.clap ?? [], pattern.percussion ?? []];
        const patternLength = Math.max(...rows.map((row) => row.length));
        const swing = Math.max(0, Math.min(0.5, pattern.swing ?? 0));
        if (patternLength === 0) return;
        for (let cycle = 0; cycle * patternLength * stepDuration < totalDurationSec; cycle++) {
          for (let step = 0; step < patternLength; step++) {
            const when = (cycle * patternLength + step) * stepDuration + (step % 2 === 1 ? swing * stepDuration * 0.5 : 0);
            const notes = [
              ["kick", pattern.kick[step]],
              ["snare", pattern.snare[step]],
              ["hat", pattern.hat[step]],
              ["openHat", pattern.openHat?.[step]],
              ["clap", pattern.clap?.[step]],
              ["percussion", pattern.percussion?.[step]],
            ] as const;
            notes.forEach(([kind, active]) => {
              if (!active) return;
              const gain = offlineCtx.createGain();
              const osc = offlineCtx.createOscillator();
              if (kind === "kick") {
                osc.type = "sine";
                osc.frequency.setValueAtTime(140, when);
                osc.frequency.exponentialRampToValueAtTime(42, when + 0.12);
                gain.gain.setValueAtTime(0.7, when);
                gain.gain.exponentialRampToValueAtTime(0.001, when + 0.28);
                osc.connect(gain);
                osc.start(when);
                osc.stop(Math.min(totalDurationSec, when + 0.3));
              } else {
                const noise = offlineCtx.createBufferSource();
                const buffer = offlineCtx.createBuffer(1, Math.floor(sampleRate * 0.2), sampleRate);
                const data = buffer.getChannelData(0);
                for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
                noise.buffer = buffer;
                const filter = offlineCtx.createBiquadFilter();
                filter.type = "highpass";
                filter.frequency.value = kind === "hat" ? 7000 : kind === "openHat" ? 5500 : kind === "percussion" ? 1800 : 1000;
                gain.gain.setValueAtTime(kind === "hat" ? 0.14 : kind === "openHat" ? 0.19 : kind === "clap" ? 0.28 : 0.25, when);
                gain.gain.exponentialRampToValueAtTime(0.001, when + (kind === "hat" ? 0.045 : kind === "openHat" ? 0.22 : kind === "percussion" ? 0.1 : 0.18));
                noise.connect(filter);
                filter.connect(gain);
                gain.connect(input);
                noise.start(when);
                noise.stop(Math.min(totalDurationSec, when + 0.2));
                return;
              }
              gain.connect(input);
            });
          }
        }
      }
    });

    const rendered = await offlineCtx.startRendering();
    return this.encodeWav(rendered);
  }

  private encodeWav(buffer: AudioBuffer): Blob {
    const numChannels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const format = 1; // PCM
    const bitDepth = 16;
    const bytesPerSample = bitDepth / 8;
    const blockAlign = numChannels * bytesPerSample;
    const length = buffer.length * blockAlign;
    const bufferSize = 44 + length;
    const arrayBuffer = new ArrayBuffer(bufferSize);
    const view = new DataView(arrayBuffer);

    const writeString = (offset: number, str: string) => {
      for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
    };

    writeString(0, "RIFF");
    view.setUint32(4, 36 + length, true);
    writeString(8, "WAVE");
    writeString(12, "fmt ");
    view.setUint32(16, 16, true);
    view.setUint16(20, format, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * blockAlign, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitDepth, true);
    writeString(36, "data");
    view.setUint32(40, length, true);

    const channels = [];
    for (let c = 0; c < numChannels; c++) channels.push(buffer.getChannelData(c));

    let offset = 44;
    for (let i = 0; i < buffer.length; i++) {
      for (let c = 0; c < numChannels; c++) {
        const s = Math.max(-1, Math.min(1, channels[c][i]));
        view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
        offset += 2;
      }
    }
    return new Blob([arrayBuffer], { type: "audio/wav" });
  }
}
