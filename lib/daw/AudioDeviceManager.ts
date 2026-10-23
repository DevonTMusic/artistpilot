 // lib/daw/AudioDeviceManager.ts

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
    enableMonitoring: boolean = false
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
        channelCount: 2,           // Supports stereo interfaces (Scarlett Input 1 & 2)
      },
    };

    this.activeInputStream = await navigator.mediaDevices.getUserMedia(constraints);
    this.selectedInputId = deviceId || "default";

    // Build Web Audio pipeline
    this.activeSourceNode = ctx.createMediaStreamSource(this.activeInputStream);

    this.analyserNode = ctx.createAnalyser();
    this.analyserNode.fftSize = 512;
    this.activeSourceNode.connect(this.analyserNode);

    // Direct Monitoring
    this.monitorGainNode = ctx.createGain();
    this.setMonitoring(ctx, enableMonitoring);
    this.activeSourceNode.connect(this.monitorGainNode);
    this.monitorGainNode.connect(ctx.destination);

    return { stream: this.activeInputStream, analyser: this.analyserNode };
  }

  public setMonitoring(ctx: AudioContext, enable: boolean) {
    this.isMonitoring = enable;
    if (this.monitorGainNode) {
      this.monitorGainNode.gain.setValueAtTime(enable ? 0.95 : 0.0, ctx.currentTime);
    }
  }

  // Route master playback to selected physical output (Speakers / Headphones)
  public async setOutputDevice(ctx: AudioContext, deviceId: string): Promise<boolean> {
    this.selectedOutputId = deviceId;
    try {
      // @ts-ignore
      if (typeof ctx.setSinkId === "function") {
        // @ts-ignore
        await ctx.setSinkId(deviceId === "default" ? "" : deviceId);
        return true;
      }
    } catch {}
    return false;
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
  }
}
