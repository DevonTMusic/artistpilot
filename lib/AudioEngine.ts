// lib/daw/AudioEngine.ts

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

export interface GuitarAmpSettings {
  drive: number;
  bass: number;
  mid: number;
  treble: number;
  cabSim: boolean;
  reverb: number;
  delay: number;
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
  ampSettings?: GuitarAmpSettings;
  ampEnabled?: boolean;
  inputDevice?: string;
  monitoring?: boolean;
  automation?: TrackAutomation;
}

interface TrackMixNodes {
  gain: GainNode;
  pan: StereoPannerNode;
  filters: BiquadFilterNode[];
  compressor: DynamicsCompressorNode;
  ampDrive: WaveShaperNode;
  ampFilters: BiquadFilterNode[];
  sends: Array<{ wet: GainNode; type: "reverb" | "ambience" | "delay" }>;
  currentDrive: number;
  audible: boolean;
}

export class AudioEngine {
  private static instance: AudioEngine;
  public ctx: AudioContext | null = null;
  public masterGain: GainNode | null = null;
  private activeSources: AudioScheduledSourceNode[] = [];
  private activeNodes: AudioNode[] = [];
  private masterNodes: AudioNode[] = [];
  private activeTrackMix = new Map<number, TrackMixNodes>();

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
  }

  public setMasterVolume(volume: number): void {
    if (!this.ctx || !this.masterGain) return;
    this.masterGain.gain.setTargetAtTime(Math.max(0, Math.min(1, volume)), this.ctx.currentTime, 0.015);
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
    if (!low || !mid || !high || !compressor) {
      this.masterGain.disconnect();
      low = this.ctx.createBiquadFilter();
      low.type = "lowshelf";
      mid = this.ctx.createBiquadFilter();
      mid.type = "peaking";
      mid.Q.value = 0.8;
      high = this.ctx.createBiquadFilter();
      high.type = "highshelf";
      compressor = this.ctx.createDynamicsCompressor();
      this.masterGain.connect(low);
      low.connect(mid);
      mid.connect(high);
      high.connect(compressor);
      compressor.connect(this.ctx.destination);
      this.masterNodes = [low, mid, high, compressor];
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
    if (!track.automation?.pan?.length) nodes.pan.pan.setTargetAtTime(track.pan, time, 0.015);
    nodes.filters[0].frequency.setTargetAtTime(settings?.lowCut ? 80 : 10, time, 0.02);
    nodes.filters[1].gain.setTargetAtTime(settings?.eqEnabled ? settings.lowGain : 0, time, 0.02);
    nodes.filters[2].frequency.setTargetAtTime(settings?.midFreq ?? 1200, time, 0.02);
    nodes.filters[2].gain.setTargetAtTime(settings?.eqEnabled ? settings.midGain : 0, time, 0.02);
    nodes.filters[3].gain.setTargetAtTime(settings?.eqEnabled ? settings.highGain : 0, time, 0.02);
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
    const drive = track.ampEnabled ? (amp?.drive ?? 0) : 0;
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
    const sendLevels = {
      reverb: Math.max(settings?.reverbSend ?? 0, track.ampEnabled ? (amp?.reverb ?? 0) : 0),
      ambience: settings?.ambienceSend ?? 0,
      delay: track.ampEnabled ? (amp?.delay ?? 0) : 0,
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

  public updateMix(tracks: TrackData[], masterVolume: number, masterSettings?: TrackProcessingSettings): void {
    this.setMasterVolume(masterVolume);
    this.configureMasterProcessing(masterSettings);
    const hasSolo = tracks.some((track) => track.solo);
    const currentTrackIds = new Set(tracks.map((track) => track.id));
    this.activeTrackMix.forEach((nodes, trackId) => {
      if (!currentTrackIds.has(trackId)) nodes.gain.gain.setTargetAtTime(0, this.ctx?.currentTime ?? 0, 0.015);
    });
    tracks.forEach((track) => {
      const nodes = this.activeTrackMix.get(track.id);
      if (nodes) this.updateTrackMix(track, nodes, hasSolo);
    });
  }

  public schedulePlayback(
    tracks: TrackData[],
    startOffsetSec: number,
    bpm = 120,
    masterVolume = 1,
    masterSettings?: TrackProcessingSettings,
    endOffsetSec = Number.POSITIVE_INFINITY
  ): void {
    const ctx = this.init();
    this.stopPlayback();
    this.setMasterVolume(masterVolume);
    this.configureMasterProcessing(masterSettings);

    const hasSolo = tracks.some((t) => t.solo);
    const scheduledTime = ctx.currentTime + 0.05;
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
      const trackPan = ctx.createStereoPanner();
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
      filters[3].connect(compressor);
      compressor.connect(ampDrive);
      ampDrive.connect(ampFilters[0]);
      ampFilters[0].connect(ampFilters[1]);
      ampFilters[1].connect(ampFilters[2]);
      ampFilters[2].connect(ampFilters[3]);
      ampFilters[3].connect(trackGain);
      trackGain.connect(trackPan);
      trackPan.connect(this.masterGain!);
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
        wet.connect(this.masterGain!);
        sends.push({ wet, type });
        this.activeNodes.push(delay, feedback, wet);
      });
      const mixNodes: TrackMixNodes = {
        gain: trackGain,
        pan: trackPan,
        filters,
        compressor,
        ampDrive,
        ampFilters,
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
        track.ampEnabled ? (track.ampSettings?.reverb ?? 0) : 0
      );
      if (track.automation?.reverbSend?.length) {
        const reverbWet = sends.find((send) => send.type === "reverb")?.wet;
        if (reverbWet) {
          const scale = Math.min(0.45, 0.25);
          const scaledPoints = track.automation.reverbSend.map((point) => ({ ...point, value: point.value * scale }));
          this.scheduleAutomation(reverbWet.gain, scaledPoints, Math.min(0.45, reverbSend * 0.25), startOffsetSec, scheduledTime, effectiveEndOffset);
        }
      }
      this.activeNodes.push(input, trackGain, trackPan, ...filters, compressor, ampDrive, ...ampFilters);

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
        this.scheduleTone(input, note.pitch, note.velocity ?? 100, start, duration, startOffsetSec, scheduledTime);
      });

      if (track.category === "drum" && track.drumPattern) {
        const pattern = track.drumPattern;
        const patternLength = Math.max(pattern.kick.length, pattern.snare.length, pattern.hat.length);
        if (patternLength === 0) return;
        for (let cycle = 0; ; cycle++) {
          let hasScheduledStep = false;
          for (let step = 0; step < patternLength; step++) {
            const when = (cycle * patternLength + step) * stepDuration;
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
    scheduledTime: number
  ): void {
    const ctx = this.ctx!;
    const when = scheduledTime + Math.max(0, start - offset);
    const remaining = duration - Math.max(0, offset - start);
    if (remaining <= 0) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.value = 440 * Math.pow(2, (pitch - 69) / 12);
    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.linearRampToValueAtTime(Math.max(0.02, velocity / 127) * 0.22, when + 0.01);
    gain.gain.setTargetAtTime(0.0001, when + remaining, 0.06);
    osc.connect(gain);
    gain.connect(destination);
    osc.start(when);
    osc.stop(when + remaining + 0.25);
    this.activeNodes.push(osc, gain);
  }

  private scheduleDrum(destination: AudioNode, kind: "kick" | "snare" | "hat", when: number): void {
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
      filter.frequency.value = kind === "hat" ? 7000 : 1000;
      gain.gain.setValueAtTime(kind === "hat" ? 0.14 : 0.35, when);
      gain.gain.exponentialRampToValueAtTime(0.001, when + (kind === "hat" ? 0.045 : 0.18));
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
    masterSettings?: TrackProcessingSettings
  ): Promise<Blob> {
    const sampleRate = 44100;
    if (!Number.isFinite(totalDurationSec) || totalDurationSec <= 0 || totalDurationSec > 600) {
      throw new Error("Project duration must be between 0 and 10 minutes to export.");
    }
    const length = Math.ceil(sampleRate * totalDurationSec);
    const offlineCtx = new OfflineAudioContext(2, length, sampleRate);
    const offlineMaster = offlineCtx.createGain();
    offlineMaster.gain.value = Math.max(0, Math.min(1, masterVolume));
    if (masterSettings) {
      const low = offlineCtx.createBiquadFilter();
      low.type = "lowshelf";
      low.frequency.value = 100;
      low.gain.value = masterSettings.eqEnabled ? masterSettings.lowGain : 0;
      const mid = offlineCtx.createBiquadFilter();
      mid.type = "peaking";
      mid.frequency.value = masterSettings.midFreq;
      mid.Q.value = 0.8;
      mid.gain.value = masterSettings.eqEnabled ? masterSettings.midGain : 0;
      const high = offlineCtx.createBiquadFilter();
      high.type = "highshelf";
      high.frequency.value = 8000;
      high.gain.value = masterSettings.eqEnabled ? masterSettings.highGain : 0;
      const compressor = offlineCtx.createDynamicsCompressor();
      if (masterSettings.compEnabled || masterSettings.gateEnabled) {
        compressor.threshold.value = masterSettings.gateEnabled
          ? masterSettings.gateThreshold
          : -40 * masterSettings.compAmount;
        compressor.ratio.value = masterSettings.compEnabled ? 1 + masterSettings.compAmount * 8 : 20;
        compressor.attack.value = masterSettings.compAttack;
        compressor.release.value = masterSettings.compRelease;
      } else compressor.ratio.value = 1;
      offlineMaster.connect(low);
      low.connect(mid);
      mid.connect(high);
      high.connect(compressor);
      compressor.connect(offlineCtx.destination);
    } else {
      offlineMaster.connect(offlineCtx.destination);
    }

    const hasSolo = tracks.some((t) => t.solo);
    const stepDuration = 60 / Math.max(1, bpm) / 4;

    tracks.forEach((track) => {
      if (track.mute || (hasSolo && !track.solo)) return;

      const input = offlineCtx.createGain();
      const tGain = offlineCtx.createGain();
      tGain.gain.value = track.volume;
      const tPan = offlineCtx.createStereoPanner();
      tPan.pan.value = track.pan;
      if (track.automation?.volume?.length) {
        this.scheduleAutomation(tGain.gain, track.automation.volume, track.volume, 0, 0, totalDurationSec);
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
        high.connect(comp);
        if (track.ampEnabled && track.ampSettings) {
          const drive = offlineCtx.createWaveShaper();
          const curve = new Float32Array(44100);
          const amount = track.ampSettings.drive * 45;
          for (let i = 0; i < curve.length; i++) {
            const x = (i * 2) / curve.length - 1;
            curve[i] = ((3 + amount) * x * 20 * (Math.PI / 180)) /
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
        } else comp.connect(tGain);
      } else {
        input.connect(tGain);
      }
      tGain.connect(tPan);
      tPan.connect(offlineMaster);

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
        Math.max(track.settings?.reverbSend ?? 0, track.ampEnabled ? (track.ampSettings?.reverb ?? 0) : 0),
        track.settings?.ambienceSend ?? 0,
        track.ampEnabled ? (track.ampSettings?.delay ?? 0) : 0,
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
        wet.connect(offlineMaster);
      });

      (track.midiNotes ?? []).forEach((note) => {
        const when = note.startStep * stepDuration;
        if (when >= totalDurationSec) return;
        const osc = offlineCtx.createOscillator();
        const gain = offlineCtx.createGain();
        const duration = Math.min(Math.max(1, note.length) * stepDuration, totalDurationSec - when);
        osc.type = "triangle";
        osc.frequency.value = 440 * Math.pow(2, (note.pitch - 69) / 12);
        gain.gain.setValueAtTime(Math.max(0.02, (note.velocity ?? 100) / 127) * 0.22, when);
        gain.gain.setTargetAtTime(0.0001, when + duration, 0.06);
        osc.connect(gain);
        gain.connect(input);
        osc.start(when);
        osc.stop(Math.min(totalDurationSec, when + duration + 0.25));
      });

      if (track.category === "drum" && track.drumPattern) {
        const pattern = track.drumPattern;
        const patternLength = Math.max(pattern.kick.length, pattern.snare.length, pattern.hat.length);
        if (patternLength === 0) return;
        for (let cycle = 0; cycle * patternLength * stepDuration < totalDurationSec; cycle++) {
          for (let step = 0; step < patternLength; step++) {
            const when = (cycle * patternLength + step) * stepDuration;
            const notes = [
              ["kick", pattern.kick[step]],
              ["snare", pattern.snare[step]],
              ["hat", pattern.hat[step]],
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
                filter.frequency.value = kind === "hat" ? 7000 : 1000;
                gain.gain.setValueAtTime(kind === "hat" ? 0.14 : 0.35, when);
                gain.gain.exponentialRampToValueAtTime(0.001, when + (kind === "hat" ? 0.045 : 0.18));
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
