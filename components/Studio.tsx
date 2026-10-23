// components/Studio.tsx
"use client";
import React, { useEffect, useRef, useState } from "react";
import { AudioEngine } from "@/lib/AudioEngine";
import { TrackData, AudioRegion } from "@/lib/AudioEngine";
import { ClipRegion } from "@/components/daw/ClipRegion";
import { PianoRoll, MidiNote } from "@/components/daw/PianoRoll";

const INSTRUMENT_PRESETS = [
  { name: "Vocals / Mic", category: "audio" as const, color: "bg-[#2563eb]", icon: "🎙️", desc: "Vocals, guitars, or live hardware" },
  { name: "Grand Piano", category: "midi" as const, color: "bg-[#059669]", icon: "🎹", desc: "Dynamic acoustic piano timbre" },
  { name: "Electric Guitar", category: "midi" as const, color: "bg-[#d97706]", icon: "🎸", desc: "Overdriven lead guitar tone" },
  { name: "Classic Bass", category: "midi" as const, color: "bg-[#7c3aed]", icon: "🎸", desc: "Deep punchy low-end bass" },
  { name: "Drum Kit 808", category: "drum" as const, color: "bg-[#dc2626]", icon: "🥁", desc: "Punchy analog kick, snare & hat" },
];

const midiToFreq = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

export default function Studio({ defaultBpm = 120 }: { defaultBpm?: number }) {
  const engine = useRef<AudioEngine>(AudioEngine.getInstance());
  const [tracks, setTracks] = useState<TrackData[]>([
    {
      id: 1,
      name: "Lead Vocal",
      category: "audio",
      instrument: "Vocals / Mic",
      color: "bg-[#2563eb]",
      volume: 0.85,
      pan: 0,
      mute: false,
      solo: false,
      armed: true,
      regions: [],
    },
    {
      id: 2,
      name: "Grand Piano",
      category: "midi",
      instrument: "Grand Piano",
      color: "bg-[#059669]",
      volume: 0.8,
      pan: 0,
      mute: false,
      solo: false,
      armed: false,
      regions: [],
    },
  ]);

  const [bpm, setBpm] = useState(defaultBpm);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [playheadSec, setPlayheadSec] = useState(0);
  const [selectedTrackId, setSelectedTrackId] = useState(2);
  const [pixelsPerSecond, setPixelsPerSecond] = useState(42);
  const [trackModalOpen, setTrackModalOpen] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");
  const [midiConnected, setMidiConnected] = useState(false);
  
  // POP-UP WINDOW STATE
  const [instrumentWindowOpen, setInstrumentWindowOpen] = useState(true);
  const [instrumentTab, setInstrumentTab] = useState<"pianoroll" | "keyboard">("keyboard");

  const [trackNotes, setTrackNotes] = useState<Record<number, MidiNote[]>>({
    2: [
      { id: "1", pitch: 60, startStep: 0, length: 2 },
      { id: "2", pitch: 64, startStep: 4, length: 2 },
      { id: "3", pitch: 67, startStep: 8, length: 2 },
      { id: "4", pitch: 71, startStep: 12, length: 2 },
    ],
  });

  const animFrame = useRef<number | null>(null);
  const playStartTime = useRef(0);
  const playheadAnchor = useRef(0);
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const recChunks = useRef<Blob[]>([]);
  const recStartTime = useRef(0);

  // Sound Engine
  const playSynthesizerVoice = (pitch: number, instrument: string) => {
    const c = engine.current.init();
    const t = c.currentTime;
    const freq = midiToFreq(pitch);

    if (instrument === "Grand Piano") {
      const o1 = c.createOscillator(); const o2 = c.createOscillator(); const g = c.createGain();
      o1.type = "triangle"; o2.type = "sine";
      o1.frequency.setValueAtTime(freq, t); o2.frequency.setValueAtTime(freq * 2, t);
      g.gain.setValueAtTime(0.4, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 1.8);
      o1.connect(g); o2.connect(g); g.connect(c.destination);
      o1.start(t); o2.start(t); o1.stop(t + 1.8); o2.stop(t + 1.8);
    } else if (instrument === "Electric Guitar") {
      const o = c.createOscillator(); const f = c.createBiquadFilter(); const g = c.createGain();
      o.type = "sawtooth";
      o.frequency.setValueAtTime(freq, t);
      f.type = "lowpass";
      f.frequency.setValueAtTime(3000, t);
      f.frequency.exponentialRampToValueAtTime(800, t + 0.6);
      g.gain.setValueAtTime(0.35, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 1.2);
      o.connect(f); f.connect(g); g.connect(c.destination);
      o.start(t); o.stop(t + 1.2);
    } else if (instrument === "Classic Bass") {
      const o = c.createOscillator(); const g = c.createGain();
      o.type = "triangle";
      o.frequency.setValueAtTime(freq / 2, t);
      g.gain.setValueAtTime(0.5, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 1.4);
      o.connect(g); g.connect(c.destination);
      o.start(t); o.stop(t + 1.4);
    } else {
      const o = c.createOscillator(); const g = c.createGain();
      o.frequency.setValueAtTime(140, t);
      o.frequency.exponentialRampToValueAtTime(38, t + 0.15);
      g.gain.setValueAtTime(0.8, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
      o.connect(g); g.connect(c.destination);
      o.start(t); o.stop(t + 0.22);
    }
  };

  // Web MIDI listener
  useEffect(() => {
    if (typeof navigator !== "undefined" && "requestMIDIAccess" in navigator) {
      // @ts-ignore
      navigator.requestMIDIAccess?.().then((access: any) => {
        setMidiConnected(access.inputs.size > 0);
        access.onstatechange = () => setMidiConnected(access.inputs.size > 0);
        for (const input of access.inputs.values()) {
          input.onmidimessage = (msg: any) => {
            if (!msg?.data) return;
            const [status, noteNumber, velocity] = msg.data;
            if (status >= 144 && status <= 159 && velocity > 0) {
              const currentTrack = tracks.find((tr) => tr.id === selectedTrackId);
              playSynthesizerVoice(noteNumber, currentTrack?.instrument ?? "Grand Piano");
            }
          };
        }
      }).catch(() => {});
    }
  }, [tracks, selectedTrackId]);

  const updatePlaybackPosition = () => {
    const elapsed = (performance.now() - playStartTime.current) / 1000;
    setPlayheadSec(playheadAnchor.current + elapsed);
    animFrame.current = requestAnimationFrame(updatePlaybackPosition);
  };

  const handlePlay = () => {
    engine.current.init();
    if (isPlaying) {
      engine.current.stopPlayback();
      if (animFrame.current) cancelAnimationFrame(animFrame.current);
      setIsPlaying(false);
    } else {
      playStartTime.current = performance.now();
      playheadAnchor.current = playheadSec;
      engine.current.schedulePlayback(tracks, playheadSec);
      animFrame.current = requestAnimationFrame(updatePlaybackPosition);
      setIsPlaying(true);
    }
  };

  const handleStop = () => {
    engine.current.stopPlayback();
    if (animFrame.current) cancelAnimationFrame(animFrame.current);
    if (isRecording && mediaRecorder.current) {
      mediaRecorder.current.stop();
      setIsRecording(false);
    }
    setIsPlaying(false);
    setPlayheadSec(0);
    playheadAnchor.current = 0;
  };

  const handleRecord = async () => {
    if (isRecording) {
      handleStop();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const ctx = engine.current.init();
      const mr = new MediaRecorder(stream);
      recChunks.current = [];
      recStartTime.current = playheadSec;

      mr.ondataavailable = (e) => recChunks.current.push(e.data);
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(recChunks.current, { type: mr.mimeType || "audio/webm" });
        try {
          const buffer = await ctx.decodeAudioData(await blob.arrayBuffer());
          const newRegion: AudioRegion = {
            id: `reg-${Date.now()}`,
            name: `Take ${new Date().toLocaleTimeString([], { minute: "2-digit", second: "2-digit" })}`,
            buffer,
            startTime: recStartTime.current,
            duration: buffer.duration,
            offset: 0,
            gain: 1.0,
          };
          setTracks((prev) =>
            prev.map((t) =>
              t.id === selectedTrackId ? { ...t, regions: [...t.regions, newRegion] } : t
            )
          );
        } catch {
          setStatusMsg("Failed to decode audio.");
        }
      };

      mediaRecorder.current = mr;
      mr.start();
      setIsRecording(true);
