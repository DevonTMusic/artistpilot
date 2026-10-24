import type { MidiNoteData } from "@/lib/AudioEngine";

export interface ParsedMidiFile {
  notes: MidiNoteData[];
  bpm?: number;
}

export function parseMidiFile(data: ArrayBuffer): ParsedMidiFile {
  const bytes = new DataView(data);
  let cursor = 0;
  const readString = (length: number) => {
    if (cursor + length > bytes.byteLength) throw new Error("MIDI file is truncated.");
    let value = "";
    for (let i = 0; i < length; i++) value += String.fromCharCode(bytes.getUint8(cursor++));
    return value;
  };
  const readUint32 = () => {
    if (cursor + 4 > bytes.byteLength) throw new Error("MIDI file is truncated.");
    const value = bytes.getUint32(cursor);
    cursor += 4;
    return value;
  };
  const readUint16 = () => {
    if (cursor + 2 > bytes.byteLength) throw new Error("MIDI file is truncated.");
    const value = bytes.getUint16(cursor);
    cursor += 2;
    return value;
  };
  const readVarInt = (end: number) => {
    let value = 0;
    let byte: number;
    do {
      if (cursor >= end) throw new Error("MIDI event is truncated.");
      byte = bytes.getUint8(cursor++);
      value = (value << 7) | (byte & 0x7f);
    } while (byte & 0x80);
    return value;
  };

  if (readString(4) !== "MThd") throw new Error("This is not a Standard MIDI File.");
  const headerLength = readUint32();
  if (headerLength < 6 || cursor + headerLength > bytes.byteLength) throw new Error("MIDI header is invalid.");
  const format = readUint16();
  const trackCount = readUint16();
  const division = readUint16();
  if (format > 1 || trackCount < 1 || division & 0x8000 || division === 0) {
    throw new Error("This MIDI file uses an unsupported time format.");
  }
  cursor += headerLength - 6;

  const ticksPerQuarter = division;
  const openNotes = new Map<string, { pitch: number; velocity: number; tick: number }>();
  const rawNotes: Array<{ pitch: number; velocity: number; startTick: number; endTick: number }> = [];
  let bpm: number | undefined;

  for (let trackIndex = 0; trackIndex < trackCount; trackIndex++) {
    if (readString(4) !== "MTrk") throw new Error("MIDI track chunk is missing.");
    const trackLength = readUint32();
    const trackEnd = cursor + trackLength;
    if (trackEnd > bytes.byteLength) throw new Error("MIDI track is truncated.");
    let tick = 0;
    let runningStatus = 0;
    while (cursor < trackEnd) {
      tick += readVarInt(trackEnd);
      if (cursor >= trackEnd) break;
      let status = bytes.getUint8(cursor);
      if (status & 0x80) {
        cursor++;
        runningStatus = status;
      } else {
        status = runningStatus;
        if (!(status & 0x80)) throw new Error("MIDI event has no running status.");
      }

      if (status === 0xff) {
        if (cursor >= trackEnd) throw new Error("MIDI meta event is truncated.");
        const type = bytes.getUint8(cursor++);
        const length = readVarInt(trackEnd);
        if (cursor + length > trackEnd) throw new Error("MIDI meta event is truncated.");
        if (type === 0x51 && length === 3 && bpm === undefined) {
          const microsPerQuarter = (bytes.getUint8(cursor) << 16) |
            (bytes.getUint8(cursor + 1) << 8) | bytes.getUint8(cursor + 2);
          if (microsPerQuarter > 0) bpm = 60_000_000 / microsPerQuarter;
        }
        cursor += length;
        continue;
      }
      if (status === 0xf0 || status === 0xf7) {
        cursor += readVarInt(trackEnd);
        continue;
      }

      const command = status & 0xf0;
      const channel = status & 0x0f;
      if (command >= 0x80 && command <= 0xe0) {
        const first = bytes.getUint8(cursor++);
        const second = command === 0xc0 || command === 0xd0 ? 0 : bytes.getUint8(cursor++);
        const key = `${channel}:${first}`;
        if (command === 0x90 && second > 0) {
          openNotes.set(key, { pitch: first, velocity: second, tick });
        } else if (command === 0x80 || (command === 0x90 && second === 0)) {
          const note = openNotes.get(key);
          if (note) {
            rawNotes.push({ ...note, startTick: note.tick, endTick: Math.max(tick, note.tick + 1) });
            openNotes.delete(key);
          }
        }
      } else {
        throw new Error("MIDI file contains an unsupported event.");
      }
    }
    cursor = trackEnd;
  }

  const stepTicks = ticksPerQuarter / 4;
  const notes = rawNotes.map((note, index) => ({
    id: `midi-${index}-${note.startTick}`,
    pitch: note.pitch,
    startStep: Math.max(0, Math.round(note.startTick / stepTicks)),
    length: Math.max(1, Math.round((note.endTick - note.startTick) / stepTicks)),
    velocity: note.velocity,
  }));
  if (notes.length === 0) throw new Error("No note events were found in this MIDI file.");
  return { notes, bpm };
}
