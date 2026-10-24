 // lib/daw/AudioDeviceManager.ts

import { GuitarAmpSettings, TrackProcessingSettings } from "@/lib/AudioEngine";

export interface DeviceInfo {
  deviceId: string;
  label: string;
  groupId?: string;
  kind: "audioinput" | "audiooutput";
}

export type DeviceChangeCallback = (inputs: DeviceInfo[], outputs: DeviceInfo[]) => void;

export class AudioDeviceManager {
  private static instance: AudioDeviceManager;
  private activeInputStream: MediaStream | null = null;
  private activeSourceNode: MediaStreamAudioSourceNode | null = null;
  private monitorGainNode: GainNode | null = null;
  private analyserNode: AnalyserNode | null = null;
  private activeInputNodes: AudioNode[] = [];
  private recordingDestination: MediaStreamAudioDestinationNode | null = null;

  public selectedInputId: string = "default";
  public selectedOutputId: string = "default";
  public isMonitoring: boolean = false;
  public permissionGranted: boolean = false;

  private onDeviceChangeListeners: DeviceChangeCallback[] = [];

  private constructor() {
    if (typeof window !== "undefined" && navigator.mediaDevices) {
      navigator.mediaDevices.addEventListener("devicechange", () => {
        this.refreshDevices();
      });
    }
  }

  public static getInstance(): AudioDeviceManager {
    if (!AudioDeviceManager.instance) {
      AudioDeviceManager.instance = new AudioDeviceManager();
    }
    return AudioDeviceManager.instance;
  }

  public subscribe(cb: DeviceChangeCallback): () => void {
    this.onDeviceChangeListeners.push(cb);
    return () => {
      this.onDeviceChangeListeners = this.onDeviceChangeListeners.filter((l) => l !== cb);
    };
  }

  // Request actual hardware permissions and discover labels
  public async requestPermissionAndEnumerate(): Promise<{ inputs: DeviceInfo[]; outputs: DeviceInfo[] }> {
    if (typeof window === "undefined" || !navigator.mediaDevices?.enumerateDevices) {
      return { inputs: [], outputs: [] };
    }

    try {
      // Temporary stream to force browser to reveal hardware device labels
      const tempStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.permissionGranted = true;
      tempStream.getTracks().forEach((t) => t.stop());
    } catch {
      this.permissionGranted = false;
    }

    return this.refreshDevices();
  }

  public async refreshDevices(): Promise<{ inputs: DeviceInfo[]; outputs: DeviceInfo[] }> {
    if (!navigator.mediaDevices?.enumerateDevices) {
      return { inputs: [], outputs: [] };
    }

    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const inputs: DeviceInfo[] = [];
      const outputs: DeviceInfo[] = [];

      devices.forEach((d, idx) => {
        if (d.kind === "audioinput") {
          inputs.push({
            deviceId: d.deviceId,
            label: d.label || (this.permissionGranted ? `Audio Input ${idx + 1}` : "Microphone (Permission needed)"),
            groupId: d.groupId,
            kind: "audioinput",
          });
        } else if (d.kind === "audiooutput") {
          outputs.push({
            deviceId: d.deviceId,
            label: d.label || `Speaker / Output ${idx + 1}`,
            groupId: d.groupId,
            kind: "audiooutput",
          });
        }
      });

      this.onDeviceChangeListeners.forEach((cb) => cb(inputs, outputs));
      return { inputs, outputs };
    } catch {
      return { inputs: [], outputs: [] };
    }
  }

  // Setup uncompressed, clean input audio stream
  public async setupInputStream(
    ctx: AudioContext,
    deviceId?: string,
    enableMonitoring: boolean = false,
    settings?: TrackProcessingSettings,
    ampSettings?: GuitarAmpSettings,
    ampEnabled = false
  ): Promise<{ stream: MediaStream; analyser: AnalyserNode }> {
    this.cleanupStream();

    const targetId = deviceId && deviceId !== "default" ? { exact: deviceId } : undefined;

    // Professional clean instrument/vocal constraints
    const constraints: MediaStreamConstraints = {
      audio: {
        deviceId: targetId,
        echoCancellation: false,   // Must be false for acoustic guitar / instruments
        autoGainControl: false,    // Prevents ducking or pumping dynamics
        noiseSuppression: false,   // Preserves natural harmonics
        channelCount: { ideal: 2 },
      },
    };

    this.activeInputStream = await navigator.mediaDevices.getUserMedia(constraints);
    this.selectedInputId = deviceId || "default";

    // Build Web Audio pipeline
    this.activeSourceNode = ctx.createMediaStreamSource(this.activeInputStream);

    this.analyserNode = ctx.createAnalyser();
    this.analyserNode.fftSize = 512;
    this.activeSourceNode.connect(this.analyserNode);

    const inputGain = ctx.createGain();
    inputGain.gain.value = settings?.inputGain ?? 1;
    const highPass = ctx.createBiquadFilter();
    highPass.type = "highpass";
    highPass.frequency.value = settings?.lowCut ? 80 : 10;
    const low = ctx.createBiquadFilter();
    low.type = "lowshelf";
    low.frequency.value = 100;
    low.gain.value = settings?.eqEnabled ? settings.lowGain : 0;
    const mid = ctx.createBiquadFilter();
    mid.type = "peaking";
    mid.frequency.value = settings?.midFreq ?? 1200;
    mid.Q.value = 0.8;
    mid.gain.value = settings?.eqEnabled ? settings.midGain : 0;
    const high = ctx.createBiquadFilter();
    high.type = "highshelf";
    high.frequency.value = 8000;
    high.gain.value = settings?.eqEnabled ? settings.highGain : 0;
    const compressor = ctx.createDynamicsCompressor();
    if (settings?.compEnabled || settings?.gateEnabled) {
      compressor.threshold.value = settings?.gateEnabled
        ? settings.gateThreshold
        : -40 * (settings?.compAmount ?? 0.5);
      compressor.ratio.value = settings?.compEnabled ? 1 + (settings?.compAmount ?? 0.5) * 8 : 20;
      compressor.attack.value = settings?.compAttack ?? 0.01;
      compressor.release.value = settings?.compRelease ?? 0.15;
    } else {
      compressor.ratio.value = 1;
    }

    this.activeSourceNode.connect(inputGain);
    inputGain.connect(highPass);
    highPass.connect(low);
    low.connect(mid);
    mid.connect(high);
    high.connect(compressor);

    let processedOutput: AudioNode = compressor;
    if (ampEnabled && ampSettings) {
      const drive = ctx.createWaveShaper();
      const curve = new Float32Array(44100);
      const amount = ampSettings.drive * 45;
      for (let i = 0; i < curve.length; i++) {
        const x = (i * 2) / curve.length - 1;
        curve[i] = ((3 + amount) * x * 20 * (Math.PI / 180)) /
          (Math.PI + amount * Math.abs(x));
      }
      drive.curve = curve;
      drive.oversample = "4x";
      const bass = ctx.createBiquadFilter();
      bass.type = "lowshelf";
      bass.frequency.value = 250;
      bass.gain.value = ampSettings.bass;
      const midTone = ctx.createBiquadFilter();
      midTone.type = "peaking";
      midTone.frequency.value = 1000;
      midTone.Q.value = 0.7;
      midTone.gain.value = ampSettings.mid;
      const treble = ctx.createBiquadFilter();
      treble.type = "highshelf";
      treble.frequency.value = 3500;
      treble.gain.value = ampSettings.treble;
      const cabinet = ctx.createBiquadFilter();
      cabinet.type = "lowpass";
      cabinet.frequency.value = ampSettings.cabSim ? 4500 : 20000;
      compressor.connect(drive);
      drive.connect(bass);
      bass.connect(midTone);
      midTone.connect(treble);
      treble.connect(cabinet);
      processedOutput = cabinet;
      this.activeInputNodes.push(drive, bass, midTone, treble, cabinet);
    }

    const outputBus = ctx.createGain();
    processedOutput.connect(outputBus);
    const sends = [
      settings?.reverbSend ?? 0,
      settings?.ambienceSend ?? 0,
      ampEnabled ? (ampSettings?.reverb ?? 0) : 0,
      ampEnabled ? (ampSettings?.delay ?? 0) : 0,
    ];
    sends.forEach((amount, index) => {
      if (amount <= 0) return;
      const delay = ctx.createDelay(2);
      delay.delayTime.value = index === 1 ? 0.11 : index === 3 ? 0.27 : 0.32;
      const feedback = ctx.createGain();
      feedback.gain.value = index === 3 ? Math.min(0.55, amount * 0.65) : 0.18;
      const wet = ctx.createGain();
      wet.gain.value = Math.min(0.45, amount * (index === 3 ? 0.4 : 0.25));
      processedOutput.connect(delay);
      delay.connect(feedback);
      feedback.connect(delay);
      delay.connect(wet);
      wet.connect(outputBus);
      this.activeInputNodes.push(delay, feedback, wet);
    });

    this.recordingDestination = ctx.createMediaStreamDestination();
    outputBus.connect(this.recordingDestination);
    this.monitorGainNode = ctx.createGain();
    this.setMonitoring(ctx, enableMonitoring);
    outputBus.connect(this.monitorGainNode);
    this.monitorGainNode.connect(ctx.destination);
    this.activeInputNodes.push(inputGain, highPass, low, mid, high, compressor, outputBus);

    return { stream: this.recordingDestination.stream, analyser: this.analyserNode };
  }

  public setMonitoring(ctx: AudioContext, enable: boolean) {
    this.isMonitoring = enable;
    if (this.monitorGainNode) {
      this.monitorGainNode.gain.setValueAtTime(enable ? 0.95 : 0.0, ctx.currentTime);
    }
  }

  public getInputAnalyser(): AnalyserNode | null {
    return this.analyserNode;
  }

  // Route master playback to selected physical output (Speakers / Headphones)
  public async setOutputDevice(ctx: AudioContext, deviceId: string): Promise<boolean> {
    try {
      const routableContext = ctx as AudioContext & { setSinkId?: (sinkId: string) => Promise<void> };
      if (typeof routableContext.setSinkId !== "function") return false;
      await routableContext.setSinkId(deviceId === "default" ? "" : deviceId);
      this.selectedOutputId = deviceId;
      return true;
    } catch (error) {
      console.error("Could not route audio output to the selected device:", error);
      return false;
    }
  }

  public cleanupStream() {
    if (this.activeInputStream) {
      this.activeInputStream.getTracks().forEach((t) => t.stop());
      this.activeInputStream = null;
    }
    if (this.activeSourceNode) {
      try { this.activeSourceNode.disconnect(); } catch {}
      this.activeSourceNode = null;
    }
    if (this.monitorGainNode) {
      try { this.monitorGainNode.disconnect(); } catch {}
      this.monitorGainNode = null;
    }
    if (this.analyserNode) {
      try { this.analyserNode.disconnect(); } catch {}
      this.analyserNode = null;
    }
    this.activeInputNodes.forEach((node) => {
      try { node.disconnect(); } catch {}
    });
    this.activeInputNodes = [];
    if (this.recordingDestination) {
      this.recordingDestination.stream.getTracks().forEach((track) => track.stop());
      try { this.recordingDestination.disconnect(); } catch {}
      this.recordingDestination = null;
    }
  }
}
