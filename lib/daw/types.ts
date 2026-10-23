// lib/daw/types.ts

export type InstrumentCategory = "audio" | "midi" | "drum";

export interface AudioRegion {
  id: string;
  name: string;
  buffer: AudioBuffer;
  startTime: number;    // Timeline start position in seconds
  duration: number;     // Active length in seconds
  offset: number;       // Trim start offset into original buffer
  gain: number;         // Clip level (0 to 2.0)
  muted?: boolean;
}

export interface TrackData {
  id: number;
  name: string;
  category: InstrumentCategory;
  instrument: string;
  color: string;
  volume: number;       // 0 to 1.0
  pan: number;          // -1.0 to 1.0
  mute: boolean;
  solo: boolean;
  armed: boolean;
  regions: AudioRegion[];
}

export interface ProjectSession {
  version: 1;
  id: string;
  name: string;
  bpm: number;
  timeSignature: [number, number];
  key: string;
  tracks: TrackData[];
}
