// lib/daw/AudioInputManager.ts

export interface AudioInputDevice {
  deviceId: string;
  label: string;
}

export class AudioInputManager {
  private static instance: AudioInputManager;
  private currentStream: MediaStream | null = null;
  private monitorGainNode: GainNode | null = null;
  public analyserNode: AnalyserNode | null = null;

  private constructor() {}

  public static getInstance(): AudioInputManager {
    if (!AudioInputManager.instance) {
      AudioInputManager.instance = new AudioInputManager();
    }
    return AudioInputManager.instance;
  }

  // Enumerate hardware interfaces (Scarlett Solo, USB Mics, Line-ins)
  public async getAvailableInputs(): Promise<AudioInputDevice[]> {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.enumerateDevices) {
      return [];
    }
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      return devices
        .filter((d) => d.kind === "audioinput")
        .map((d, i) => ({
          deviceId: d.deviceId,
          label: d.label || `Audio Interface / Input ${i + 1}`,
        }));
    } catch {
      return [];
    }
  }

  // Open audio stream with direct monitoring and analyzer for live waveforms
  public async setupInputStream(
    ctx: AudioContext,
    deviceId?: string,
    enableMonitoring: boolean = false
  ): Promise<{ stream: MediaStream; analyser: AnalyserNode }> {
    if (this.currentStream) {
      this.currentStream.getTracks().forEach((t) => t.stop());
    }

    const constraints: MediaStreamConstraints = {
      audio: {
        deviceId: deviceId ? { exact: deviceId } : undefined,
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      },
    };

    this.currentStream = await navigator.mediaDevices.getUserMedia(constraints);
    const source = ctx.createMediaStreamSource(this.currentStream);

    // Live wave analyser
    this.analyserNode = ctx.createAnalyser();
    this.analyserNode.fftSize = 512;
    source.connect(this.analyserNode);

    // Hardware Monitoring node
    if (!this.monitorGainNode) {
      this.monitorGainNode = ctx.createGain();
    }
    this.monitorGainNode.gain.setValueAtTime(enableMonitoring ? 0.9 : 0.0, ctx.currentTime);
    source.connect(this.monitorGainNode);
    this.monitorGainNode.connect(ctx.destination);

    return { stream: this.currentStream, analyser: this.analyserNode };
  }

  public setMonitoring(ctx: AudioContext, enable: boolean) {
    if (this.monitorGainNode) {
      this.monitorGainNode.gain.setValueAtTime(enable ? 0.9 : 0.0, ctx.currentTime);
    }
  }

  public stopStream() {
    if (this.currentStream) {
      this.currentStream.getTracks().forEach((t) => t.stop());
      this.currentStream = null;
    }
  }
}
