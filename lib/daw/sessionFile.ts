import type {
  AudioRegion,
  ArrangerSection,
  DrumPatternData,
  GuitarAmpSettings,
  MasterAutomationPoint,
  MixerBus,
  MidiNoteData,
  SamplerData,
  SamplerPad,
  StudioScene,
  SynthSettings,
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

interface SerializedSampler extends Omit<SamplerData, "sample"> {
  sampleDataUrl: string;
}

interface SerializedTrack extends Omit<TrackData, "regions" | "sampler"> {
  regions: SerializedRegion[];
  sampler?: SerializedSampler;
}

interface SessionDocument {
  format: "artistpilot-session";
  version: 3;
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

export async function serializeSessionFile(
  meta: Record<string, unknown>,
  tracks: TrackData[]
): Promise<Blob> {
  const serializedTracks = await Promise.all(
    tracks.map(async (track): Promise<SerializedTrack> => {
      const { sampler, ...trackData } = track;
      return {
        ...trackData,
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
        ...(sampler ? {
          sampler: {
            sampleName: sampler.sampleName,
            pads: sampler.pads,
            sampleDataUrl: await blobToDataUrl(sourceBlobs.get(sampler.sample) ?? audioBufferToWav(sampler.sample)),
          },
        } : {}),
      };
    })
  );

  const document: SessionDocument = {
    format: "artistpilot-session",
    version: 3,
    meta,
    tracks: serializedTracks,
  };
  return new Blob([JSON.stringify(document)], { type: "application/json" });
}

export async function saveSessionFile(
  meta: Record<string, unknown>,
  tracks: TrackData[],
  projectName: string
): Promise<void> {
  const blob = await serializeSessionFile(meta, tracks);
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
  const optionalBooleanKeys = ["deEsserEnabled"] as const;
  const optionalNumberKeys = ["deEsserAmount"] as const;
  if (numberKeys.some((key) => typeof value[key] !== "number" || !Number.isFinite(value[key])) ||
    booleanKeys.some((key) => typeof value[key] !== "boolean") ||
    optionalBooleanKeys.some((key) => value[key] !== undefined && typeof value[key] !== "boolean") ||
    optionalNumberKeys.some((key) => value[key] !== undefined && (typeof value[key] !== "number" || !Number.isFinite(value[key]) || value[key] < 0 || value[key] > 1))) {
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
    deEsserEnabled: typeof value.deEsserEnabled === "boolean" ? value.deEsserEnabled : false,
    deEsserAmount: typeof value.deEsserAmount === "number" ? value.deEsserAmount : 0,
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
  const rows = ["kick", "snare", "hat", "openHat", "clap", "percussion"]
    .map((key) => value[key])
    .filter((row) => row !== undefined);
  if (rows.some((row) => !Array.isArray(row) || row.length > 64 || row.some((step) => typeof step !== "boolean"))) {
    throw new Error("Drum pattern steps are invalid.");
  }
  if (!Array.isArray(value.kick) || !Array.isArray(value.snare) || !Array.isArray(value.hat) ||
    (value.swing !== undefined && (typeof value.swing !== "number" || !Number.isFinite(value.swing) || value.swing < 0 || value.swing > 0.5))) {
    throw new Error("Drum pattern settings are invalid.");
  }
  return {
    kick: value.kick as boolean[],
    snare: value.snare as boolean[],
    hat: value.hat as boolean[],
    openHat: value.openHat as boolean[] | undefined,
    clap: value.clap as boolean[] | undefined,
    percussion: value.percussion as boolean[] | undefined,
    swing: value.swing as number | undefined,
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
    (value.delay as number) < 0 || (value.delay as number) > 1 ||
    (value.master !== undefined && (typeof value.master !== "number" || !Number.isFinite(value.master) || value.master < 0 || value.master > 1)) ||
    ["driveEnabled", "delayEnabled", "chorusEnabled", "reverbEnabled"].some((key) => value[key] !== undefined && typeof value[key] !== "boolean")) {
    throw new Error("Amp settings are outside their supported range.");
  }
  return {
    drive: value.drive as number,
    bass: value.bass as number,
    mid: value.mid as number,
    treble: value.treble as number,
    master: typeof value.master === "number" && Number.isFinite(value.master) && value.master >= 0 && value.master <= 1
      ? value.master
      : 1,
    cabSim: value.cabSim,
    reverb: value.reverb as number,
    delay: value.delay as number,
    driveEnabled: typeof value.driveEnabled === "boolean" ? value.driveEnabled : true,
    delayEnabled: typeof value.delayEnabled === "boolean" ? value.delayEnabled : (value.delay as number) > 0,
    chorusEnabled: typeof value.chorusEnabled === "boolean" ? value.chorusEnabled : false,
    reverbEnabled: typeof value.reverbEnabled === "boolean" ? value.reverbEnabled : (value.reverb as number) > 0,
  };
}

function parseSynthSettings(value: unknown): SynthSettings | undefined {
  if (value === undefined) return undefined;
  if (!isRecord(value) ||
    !["sine", "square", "sawtooth", "triangle"].includes(String(value.waveform)) ||
    ["attack", "decay", "sustain", "release", "cutoff", "resonance"].some((key) =>
      typeof value[key] !== "number" || !Number.isFinite(value[key]))) {
    throw new Error("Synth settings are invalid.");
  }
  const ranges: Record<string, [number, number]> = {
    attack: [0.001, 2], decay: [0.001, 2], sustain: [0, 1], release: [0.001, 3],
    cutoff: [40, 20000], resonance: [0.1, 20],
  };
  if (Object.entries(ranges).some(([key, [min, max]]) => (value[key] as number) < min || (value[key] as number) > max)) {
    throw new Error("Synth settings are outside their supported range.");
  }
  return {
    waveform: value.waveform as OscillatorType,
    attack: value.attack as number,
    decay: value.decay as number,
    sustain: value.sustain as number,
    release: value.release as number,
    cutoff: value.cutoff as number,
    resonance: value.resonance as number,
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

export function parseArrangerSections(value: unknown): ArrangerSection[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 256) throw new Error("Arranger section data is invalid.");
  return value.map((section, index) => {
    if (!isRecord(section) ||
      typeof section.id !== "string" ||
      typeof section.name !== "string" ||
      section.name.length > 40 ||
      typeof section.color !== "string" ||
      section.color.length > 40 ||
      typeof section.startBar !== "number" ||
      !Number.isInteger(section.startBar) ||
      section.startBar < 1 ||
      typeof section.endBar !== "number" ||
      !Number.isInteger(section.endBar) ||
      section.endBar <= section.startBar ||
      section.endBar > 100000) {
      throw new Error(`Arranger section ${index + 1} is invalid.`);
    }
    return {
      id: section.id,
      name: section.name,
      color: section.color,
      startBar: section.startBar,
      endBar: section.endBar,
    };
  });
}

export function parseMixerBuses(value: unknown): MixerBus[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 64) throw new Error("Mixer bus data is invalid.");
  return value.map((bus, index) => {
    if (!isRecord(bus) ||
      typeof bus.id !== "string" ||
      typeof bus.name !== "string" ||
      bus.name.length > 60 ||
      typeof bus.volume !== "number" ||
      !Number.isFinite(bus.volume) ||
      bus.volume < 0 ||
      bus.volume > 1 ||
      typeof bus.pan !== "number" ||
      !Number.isFinite(bus.pan) ||
      bus.pan < -1 ||
      bus.pan > 1 ||
      typeof bus.reverbSend !== "number" ||
      !Number.isFinite(bus.reverbSend) ||
      bus.reverbSend < 0 ||
      bus.reverbSend > 1) {
      throw new Error(`Mixer bus ${index + 1} is invalid.`);
    }
    return {
      id: bus.id,
      name: bus.name,
      volume: bus.volume,
      pan: bus.pan,
      reverbSend: bus.reverbSend,
    };
  });
}

export function parseMasterAutomation(value: unknown): MasterAutomationPoint[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 10000) throw new Error("Master automation data is invalid.");
  return value.map((point, index) => {
    if (!isRecord(point) ||
      typeof point.id !== "string" ||
      typeof point.time !== "number" ||
      !Number.isFinite(point.time) ||
      point.time < 0 ||
      point.time > 600 ||
      typeof point.value !== "number" ||
      !Number.isFinite(point.value) ||
      point.value < 0 ||
      point.value > 1) {
      throw new Error(`Master automation point ${index + 1} is invalid.`);
    }
    return { id: point.id, time: point.time, value: point.value };
  });
}

export function parseStudioScenes(value: unknown): StudioScene[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 128) throw new Error("Scene data is invalid.");
  return value.map((scene, index) => {
    if (!isRecord(scene) ||
      typeof scene.id !== "string" ||
      typeof scene.name !== "string" ||
      scene.name.length > 40 ||
      typeof scene.color !== "string" ||
      scene.color.length > 40 ||
      !isRecord(scene.regionIdsByTrack)) {
      throw new Error(`Scene ${index + 1} is invalid.`);
    }
    const regionIdsByTrack: Record<number, string[]> = {};
    for (const [trackId, regionIds] of Object.entries(scene.regionIdsByTrack)) {
      const numericTrackId = Number(trackId);
      if (!Number.isInteger(numericTrackId) || numericTrackId < 0 ||
        !Array.isArray(regionIds) ||
        regionIds.length > 128 ||
        regionIds.some((regionId) => typeof regionId !== "string")) {
        throw new Error(`Scene ${index + 1} has invalid clip assignments.`);
      }
      regionIdsByTrack[numericTrackId] = regionIds;
    }
    const midiNotesByTrack: Record<number, MidiNoteData[]> = {};
    if (scene.midiNotesByTrack !== undefined) {
      if (!isRecord(scene.midiNotesByTrack)) throw new Error(`Scene ${index + 1} has invalid MIDI clips.`);
      for (const [trackId, notes] of Object.entries(scene.midiNotesByTrack)) {
        const numericTrackId = Number(trackId);
        if (!Number.isInteger(numericTrackId) || numericTrackId < 0) throw new Error(`Scene ${index + 1} has invalid MIDI track assignments.`);
        midiNotesByTrack[numericTrackId] = parseMidiNotes(notes);
      }
    }
    const drumPatternsByTrack: Record<number, DrumPatternData> = {};
    if (scene.drumPatternsByTrack !== undefined) {
      if (!isRecord(scene.drumPatternsByTrack)) throw new Error(`Scene ${index + 1} has invalid drum clips.`);
      for (const [trackId, pattern] of Object.entries(scene.drumPatternsByTrack)) {
        const numericTrackId = Number(trackId);
        const parsed = parseDrumPattern(pattern);
        if (!Number.isInteger(numericTrackId) || numericTrackId < 0 || !parsed) {
          throw new Error(`Scene ${index + 1} has invalid drum track assignments.`);
        }
        drumPatternsByTrack[numericTrackId] = parsed;
      }
    }
    return {
      id: scene.id,
      name: scene.name,
      color: scene.color,
      regionIdsByTrack,
      midiNotesByTrack,
      drumPatternsByTrack,
    };
  });
}

export async function openSessionFile(file: File, ctx: AudioContext): Promise<{ meta: Record<string, unknown>; tracks: TrackData[] }> {
  let decoded: unknown;
  try {
    decoded = JSON.parse(await file.text());
  } catch {
    throw new Error("This session file is not valid JSON.");
  }

  if (!isRecord(decoded) || decoded.format !== "artistpilot-session" ||
    (decoded.version !== 1 && decoded.version !== 2 && decoded.version !== 3) || !Array.isArray(decoded.tracks)) {
    throw new Error("Unsupported or invalid ArtistPilot session file.");
  }
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

      let sampler: SamplerData | undefined;
      if (rawTrack.sampler !== undefined) {
        if (!isRecord(rawTrack.sampler) ||
          typeof rawTrack.sampler.sampleName !== "string" ||
          typeof rawTrack.sampler.sampleDataUrl !== "string" ||
          !rawTrack.sampler.sampleDataUrl.startsWith("data:") ||
          !Array.isArray(rawTrack.sampler.pads) ||
          rawTrack.sampler.pads.length !== 8) {
          throw new Error(`Track ${trackIndex + 1} has invalid sampler data.`);
        }
        const response = await fetch(rawTrack.sampler.sampleDataUrl);
        if (!response.ok) throw new Error(`Could not read the sample for track ${trackIndex + 1}.`);
        const sampleBlob = await response.blob();
        const sample = await ctx.decodeAudioData(await sampleBlob.arrayBuffer());
        const validKeys = new Set(["a", "s", "d", "f", "j", "k", "l", ";"]);
        const seenKeys = new Set<string>();
        const pads: SamplerPad[] = rawTrack.sampler.pads.map((rawPad, padIndex) => {
          if (!isRecord(rawPad) ||
            typeof rawPad.id !== "string" ||
            typeof rawPad.name !== "string" ||
            typeof rawPad.key !== "string" ||
            !validKeys.has(rawPad.key.toLowerCase()) ||
            seenKeys.has(rawPad.key.toLowerCase()) ||
            typeof rawPad.startTime !== "number" ||
            !Number.isFinite(rawPad.startTime) ||
            typeof rawPad.endTime !== "number" ||
            !Number.isFinite(rawPad.endTime) ||
            rawPad.startTime < 0 ||
            rawPad.endTime <= rawPad.startTime ||
            rawPad.endTime > sample.duration + 0.05) {
            throw new Error(`Sampler pad ${padIndex + 1} on track ${trackIndex + 1} is invalid.`);
          }
          seenKeys.add(rawPad.key.toLowerCase());
          return {
            id: rawPad.id,
            name: rawPad.name,
            key: rawPad.key.toLowerCase(),
            startTime: rawPad.startTime,
            endTime: Math.min(rawPad.endTime, sample.duration),
          };
        });
        sourceBlobs.set(sample, sampleBlob);
        sampler = {
          sampleName: rawTrack.sampler.sampleName,
          sample,
          pads,
        };
      }

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
        synthSettings: parseSynthSettings(rawTrack.synthSettings),
        ampSettings: parseAmpSettings(rawTrack.ampSettings),
        ampEnabled: typeof rawTrack.ampEnabled === "boolean" ? rawTrack.ampEnabled : false,
        inputDevice: typeof rawTrack.inputDevice === "string" ? rawTrack.inputDevice : undefined,
        monitoring: typeof rawTrack.monitoring === "boolean" ? rawTrack.monitoring : false,
        automation: parseAutomation(rawTrack.automation),
        busId: typeof rawTrack.busId === "string" ? rawTrack.busId : undefined,
        sampler,
      };
    })
  );

  const meta = isRecord(decoded.meta) ? { ...decoded.meta } : {};
  if (meta.masterSettings !== undefined) meta.masterSettings = parseProcessingSettings(meta.masterSettings);
  if (meta.sections !== undefined) meta.sections = parseArrangerSections(meta.sections);
  if (meta.buses !== undefined) meta.buses = parseMixerBuses(meta.buses);
  if (meta.masterAutomation !== undefined) meta.masterAutomation = parseMasterAutomation(meta.masterAutomation);
  if (meta.scenes !== undefined) meta.scenes = parseStudioScenes(meta.scenes);
  return { meta, tracks: loadedTracks };
}
