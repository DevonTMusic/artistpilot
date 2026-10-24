import type {
  AudioRegion,
  DrumPatternData,
  GuitarAmpSettings,
  MidiNoteData,
  TrackData,
  TrackAutomation,
  TrackProcessingSettings,
} from "@/lib/AudioEngine";

export const sourceBlobs = new WeakMap<AudioBuffer, Blob>();

interface SerializedRegion {
  id: string;
  name: string;
  startTime: number;
  duration: number;
  offset: number;
  gain?: number;
  muted?: boolean;
  audioDataUrl: string;
}

interface SerializedTrack extends Omit<TrackData, "regions"> {
  regions: SerializedRegion[];
}

interface SessionDocument {
  format: "artistpilot-session";
  version: 2;
  meta: Record<string, unknown>;
  tracks: SerializedTrack[];
}

export const blobToDataUrl = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("Could not read audio data."));
    reader.readAsDataURL(blob);
  });

function audioBufferToWav(buffer: AudioBuffer): Blob {
  const channels = buffer.numberOfChannels;
  const bytesPerSample = 2;
  const blockAlign = channels * bytesPerSample;
  const dataLength = buffer.length * blockAlign;
  const output = new ArrayBuffer(44 + dataLength);
  const view = new DataView(output);
  const writeString = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i));
  };

  writeString(0, "RIFF");
  view.setUint32(4, 36 + dataLength, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, buffer.sampleRate, true);
  view.setUint32(28, buffer.sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  writeString(36, "data");
  view.setUint32(40, dataLength, true);

  const channelData = Array.from({ length: channels }, (_, channel) => buffer.getChannelData(channel));
  let cursor = 44;
  for (let frame = 0; frame < buffer.length; frame++) {
    for (let channel = 0; channel < channels; channel++) {
      const sample = Math.max(-1, Math.min(1, channelData[channel][frame]));
      view.setInt16(cursor, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      cursor += bytesPerSample;
    }
  }
  return new Blob([output], { type: "audio/wav" });
}

export async function saveSessionFile(
  meta: Record<string, unknown>,
  tracks: TrackData[],
  projectName: string
): Promise<void> {
  const serializedTracks = await Promise.all(
    tracks.map(async (track): Promise<SerializedTrack> => ({
      ...track,
      regions: await Promise.all(
        track.regions.map(async (region): Promise<SerializedRegion> => {
          const blob = sourceBlobs.get(region.buffer) ?? audioBufferToWav(region.buffer);
          return {
            id: region.id,
            name: region.name,
            startTime: region.startTime,
            duration: region.duration,
            offset: region.offset,
            gain: region.gain,
            muted: region.muted,
            audioDataUrl: await blobToDataUrl(blob),
          };
        })
      ),
    }))
  );

  const document: SessionDocument = {
    format: "artistpilot-session",
    version: 2,
    meta,
    tracks: serializedTracks,
  };
  const blob = new Blob([JSON.stringify(document)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = window.document.createElement("a");
  anchor.href = url;
  anchor.download = `${projectName.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "artistpilot-project"}.artistpilot`;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 5000);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function finiteNumber(value: unknown, label: string, min = 0): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < min) {
    throw new Error(`Invalid ${label} in session file.`);
  }
  return value;
}

export function parseProcessingSettings(value: unknown): TrackProcessingSettings | undefined {
  if (value === undefined) return undefined;
  if (!isRecord(value)) throw new Error("Track processing settings are invalid.");
  const numberKeys = [
    "inputGain", "gateThreshold", "compAmount", "compAttack", "compRelease",
    "lowGain", "midGain", "midFreq", "highGain", "ambienceSend", "reverbSend",
  ] as const;
  const booleanKeys = ["gateEnabled", "compEnabled", "eqEnabled", "lowCut"] as const;
  if (numberKeys.some((key) => typeof value[key] !== "number" || !Number.isFinite(value[key])) ||
    booleanKeys.some((key) => typeof value[key] !== "boolean")) {
    throw new Error("Track processing settings are incomplete or invalid.");
  }
  const ranges: Partial<Record<(typeof numberKeys)[number], [number, number]>> = {
    inputGain: [0, 2],
    gateThreshold: [-60, 0],
    compAmount: [0, 1],
    compAttack: [0, 1],
    compRelease: [0, 1],
    lowGain: [-12, 12],
    midGain: [-12, 12],
    midFreq: [200, 5000],
    highGain: [-12, 12],
    ambienceSend: [0, 1],
    reverbSend: [0, 1],
  };
  if (numberKeys.some((key) => {
    const range = ranges[key]!;
    return (value[key] as number) < range[0] || (value[key] as number) > range[1];
  })) throw new Error("Track processing settings are outside their supported range.");
  return {
    inputGain: value.inputGain as number,
    gateEnabled: value.gateEnabled as boolean,
    gateThreshold: value.gateThreshold as number,
    compEnabled: value.compEnabled as boolean,
    compAmount: value.compAmount as number,
    compAttack: value.compAttack as number,
    compRelease: value.compRelease as number,
    eqEnabled: value.eqEnabled as boolean,
    lowGain: value.lowGain as number,
    midGain: value.midGain as number,
    midFreq: value.midFreq as number,
    highGain: value.highGain as number,
    lowCut: value.lowCut as boolean,
    ambienceSend: value.ambienceSend as number,
    reverbSend: value.reverbSend as number,
  };
}

function parseMidiNotes(value: unknown): MidiNoteData[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new Error("MIDI note data is invalid.");
  return value.map((note, index) => {
    if (!isRecord(note) || typeof note.id !== "string" ||
      typeof note.pitch !== "number" || !Number.isInteger(note.pitch) || note.pitch < 0 || note.pitch > 127 ||
      typeof note.startStep !== "number" || !Number.isInteger(note.startStep) || note.startStep < 0 ||
      note.startStep > 100000 ||
      typeof note.length !== "number" || !Number.isInteger(note.length) || note.length < 1 || note.length > 100000 ||
      (note.velocity !== undefined && (typeof note.velocity !== "number" || !Number.isFinite(note.velocity) || note.velocity < 1 || note.velocity > 127))) {
      throw new Error(`MIDI note ${index + 1} is invalid.`);
    }
    return {
      id: note.id,
      pitch: note.pitch,
      startStep: note.startStep,
      length: note.length,
      velocity: note.velocity as number | undefined,
    };
  });
}

function parseDrumPattern(value: unknown): DrumPatternData | undefined {
  if (value === undefined) return undefined;
  if (!isRecord(value)) throw new Error("Drum pattern is invalid.");
  const rows = [value.kick, value.snare, value.hat];
  if (rows.some((row) => !Array.isArray(row) || row.length > 128 || row.some((step) => typeof step !== "boolean"))) {
    throw new Error("Drum pattern steps are invalid.");
  }
  return {
    kick: value.kick as boolean[],
    snare: value.snare as boolean[],
    hat: value.hat as boolean[],
  };
}

function parseAmpSettings(value: unknown): GuitarAmpSettings | undefined {
  if (value === undefined) return undefined;
  if (!isRecord(value) ||
    ["drive", "bass", "mid", "treble", "reverb", "delay"].some((key) => typeof value[key] !== "number" || !Number.isFinite(value[key])) ||
    typeof value.cabSim !== "boolean") {
    throw new Error("Amp settings are invalid.");
  }
  if ((value.drive as number) < 0 || (value.drive as number) > 1 ||
    ["bass", "mid", "treble"].some((key) => (value[key] as number) < -10 || (value[key] as number) > 10) ||
    (value.reverb as number) < 0 || (value.reverb as number) > 1 ||
    (value.delay as number) < 0 || (value.delay as number) > 1) {
    throw new Error("Amp settings are outside their supported range.");
  }
  return {
    drive: value.drive as number,
    bass: value.bass as number,
    mid: value.mid as number,
    treble: value.treble as number,
    cabSim: value.cabSim,
    reverb: value.reverb as number,
    delay: value.delay as number,
  };
}

function parseAutomation(value: unknown): TrackAutomation | undefined {
  if (value === undefined) return undefined;
  if (!isRecord(value)) throw new Error("Track automation is invalid.");
  const automation: TrackAutomation = {};
  for (const key of ["volume", "pan", "reverbSend"] as const) {
    const rawPoints = value[key];
    if (rawPoints === undefined) continue;
    if (!Array.isArray(rawPoints) || rawPoints.length > 10000) {
      throw new Error(`Track ${key} automation is invalid.`);
    }
    const points = rawPoints.map((point, index) => {
      if (!isRecord(point) || typeof point.id !== "string" ||
        typeof point.time !== "number" || !Number.isFinite(point.time) || point.time < 0 || point.time > 600 ||
        typeof point.value !== "number" || !Number.isFinite(point.value)) {
        throw new Error(`Track ${key} automation point ${index + 1} is invalid.`);
      }
      const [min, max] = key === "pan" ? [-1, 1] : [0, 1];
      if (point.value < min || point.value > max) throw new Error(`Track ${key} automation is outside its supported range.`);
      return { id: point.id, time: point.time, value: point.value };
    });
    automation[key] = points;
  }
  return automation;
}

export async function openSessionFile(file: File, ctx: AudioContext): Promise<{ meta: Record<string, unknown>; tracks: TrackData[] }> {
  let decoded: unknown;
  try {
    decoded = JSON.parse(await file.text());
  } catch {
    throw new Error("This session file is not valid JSON.");
  }

  if (!isRecord(decoded) || decoded.format !== "artistpilot-session" ||
    (decoded.version !== 1 && decoded.version !== 2) || !Array.isArray(decoded.tracks)) {
    throw new Error("Unsupported or invalid ArtistPilot session file.");
  }
  if (decoded.tracks.length === 0) throw new Error("This session does not contain any tracks.");
  if (decoded.tracks.length > 12) throw new Error("This session contains more than the 12-track Studio limit.");

  const loadedTracks = await Promise.all(
    decoded.tracks.map(async (rawTrack, trackIndex): Promise<TrackData> => {
      if (!isRecord(rawTrack) || !Array.isArray(rawTrack.regions)) {
        throw new Error(`Track ${trackIndex + 1} is invalid.`);
      }
      const { id, name, instrument, color, volume, pan, mute, solo, armed } = rawTrack;
      if (typeof id !== "number" || !Number.isInteger(id) || id < 0 || typeof name !== "string" || typeof instrument !== "string" ||
        typeof color !== "string" || typeof mute !== "boolean" || typeof solo !== "boolean" ||
        typeof armed !== "boolean" || typeof volume !== "number" || !Number.isFinite(volume) || volume < 0 || volume > 1) {
        throw new Error(`Track ${trackIndex + 1} has invalid settings.`);
      }
      const regions = await Promise.all(
        rawTrack.regions.map(async (rawRegion, regionIndex): Promise<AudioRegion> => {
          if (!isRecord(rawRegion) || typeof rawRegion.id !== "string" ||
            typeof rawRegion.name !== "string" || typeof rawRegion.audioDataUrl !== "string" ||
            !rawRegion.audioDataUrl.startsWith("data:")) {
            throw new Error(`Track ${trackIndex + 1}, region ${regionIndex + 1} has missing audio data.`);
          }
          const startTime = finiteNumber(rawRegion.startTime, "region start time");
          const duration = finiteNumber(rawRegion.duration, "region duration");
          const offset = finiteNumber(rawRegion.offset, "region offset");
          const response = await fetch(rawRegion.audioDataUrl);
          if (!response.ok) throw new Error(`Could not read audio for ${rawRegion.name}.`);
          const blob = await response.blob();
          const buffer = await ctx.decodeAudioData(await blob.arrayBuffer());
          if (offset + duration > buffer.duration + 0.05) {
            throw new Error(`Region "${rawRegion.name}" extends beyond its audio source.`);
          }
          sourceBlobs.set(buffer, blob);
          return {
            id: rawRegion.id,
            name: rawRegion.name,
            buffer,
            startTime,
            duration,
            offset,
            gain: typeof rawRegion.gain === "number" ? rawRegion.gain : 1,
            muted: typeof rawRegion.muted === "boolean" ? rawRegion.muted : false,
          };
        })
      );

      return {
        id,
        name,
        category: rawTrack.category === "midi" || rawTrack.category === "drum" ? rawTrack.category : "audio",
        instrument,
        color,
        volume,
        pan: typeof pan === "number" && Number.isFinite(pan) ? Math.max(-1, Math.min(1, pan)) : 0,
        mute,
        solo,
        armed,
        regions,
        settings: parseProcessingSettings(rawTrack.settings),
        midiNotes: parseMidiNotes(rawTrack.midiNotes),
        drumPattern: parseDrumPattern(rawTrack.drumPattern),
        ampSettings: parseAmpSettings(rawTrack.ampSettings),
        ampEnabled: typeof rawTrack.ampEnabled === "boolean" ? rawTrack.ampEnabled : false,
        inputDevice: typeof rawTrack.inputDevice === "string" ? rawTrack.inputDevice : undefined,
        monitoring: typeof rawTrack.monitoring === "boolean" ? rawTrack.monitoring : false,
        automation: parseAutomation(rawTrack.automation),
      };
    })
  );

  const meta = isRecord(decoded.meta) ? { ...decoded.meta } : {};
  if (meta.masterSettings !== undefined) meta.masterSettings = parseProcessingSettings(meta.masterSettings);
  return { meta, tracks: loadedTracks };
}
