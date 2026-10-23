// lib/daw/AudioEngine.ts
import { TrackData, AudioRegion } from "./types";

export class AudioEngine {
  private static instance: AudioEngine;
  public ctx: AudioContext | null = null;
  public masterGain: GainNode | null = null;
  private activeSources: AudioBufferSourceNode[] = [];

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
  }

  public schedulePlayback(tracks: TrackData[], startOffsetSec: number): void {
    const ctx = this.init();
    this.stopPlayback();

    const hasSolo = tracks.some((t) => t.solo);
    const scheduledTime = ctx.currentTime + 0.05;

    tracks.forEach((track) => {
      if (track.mute || (hasSolo && !track.solo)) return;

      const trackGain = ctx.createGain();
      trackGain.gain.setValueAtTime(track.volume, ctx.currentTime);

      const trackPan = ctx.createStereoPanner();
      trackPan.pan.setValueAtTime(track.pan, ctx.currentTime);

      trackGain.connect(trackPan);
      trackPan.connect(this.masterGain!);

      track.regions.forEach((region) => {
        if (region.startTime + region.duration > startOffsetSec) {
          const source = ctx.createBufferSource();
          source.buffer = region.buffer;

          const when = Math.max(0, region.startTime - startOffsetSec) + scheduledTime;
          const grainOffset = startOffsetSec > region.startTime 
            ? (startOffsetSec - region.startTime) + region.offset 
            : region.offset;
          const playDuration = Math.max(0, region.duration - (grainOffset - region.offset));

          source.connect(trackGain);
          source.start(when, grainOffset, playDuration);
          this.activeSources.push(source);
        }
      });
    });
  }

  public async exportMasterWav(tracks: TrackData[], totalDurationSec: number): Promise<Blob> {
    const sampleRate = 44100;
    const length = Math.ceil(sampleRate * Math.max(1, totalDurationSec));
    const offlineCtx = new OfflineAudioContext(2, length, sampleRate);
    const offlineMaster = offlineCtx.createGain();
    offlineMaster.connect(offlineCtx.destination);

    const hasSolo = tracks.some((t) => t.solo);

    tracks.forEach((track) => {
      if (track.mute || (hasSolo && !track.solo)) return;

      const tGain = offlineCtx.createGain();
      tGain.gain.value = track.volume;
      const tPan = offlineCtx.createStereoPanner();
      tPan.pan.value = track.pan;

      tGain.connect(tPan);
      tPan.connect(offlineMaster);

      track.regions.forEach((region) => {
        const src = offlineCtx.createBufferSource();
        src.buffer = region.buffer;
        src.connect(tGain);
        src.start(region.startTime, region.offset, region.duration);
      });
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
