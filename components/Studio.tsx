// components/Studio.tsx
"use client";
import React, { useEffect, useRef, useState } from "react";
import { AudioEngine } from "@/lib/AudioEngine";
import { TrackData, AudioRegion } from "@/lib/AudioEngine";
import { ClipRegion } from "@/components/daw/ClipRegion";
import { PianoRoll, MidiNote } from "@/components/daw/PianoRoll";
import { GuitarAmpModal } from "@/components/daw/GuitarAmpModal";
import { AiCoachModal } from "@/components/daw/AiCoachModal";
import { AudioInputManager } from "@/lib/daw/AudioInputManager";
import { RecordingSettingsModal } from "@/components/daw/RecordingSettingsModal";
import { ChannelEqModal } from "@/components/daw/ChannelEqModal";

const INSTRUMENT_LIBRARY = [
  { name: "Vocals / Acoustic Mic", category: "audio" as const, color: "bg-[#2563eb]", icon: "🎙️", desc: "Studio vocal chain & live hardware" },
  { name: "Acoustic Grand Piano", category: "midi" as const, color: "bg-[#059669]", icon: "🎹", desc: "Dynamic multi-velocity grand piano" },
  { name: "Electric Lead Guitar", category: "midi" as const, color: "bg-[#d97706]", icon: "🎸", desc: "Warm overdriven harmonic lead" },
  { name: "Vintage Bass Guitar", category: "midi" as const, color: "bg-[#7c3aed]", icon: "🎸", desc: "Analog punchy low-end sub" },
  { name: "808 Studio Drum Kit", category: "drum" as const, color: "bg-[#dc2626]", icon: "🥁", desc: "Punchy kick, snare, clap & closed hat" },
  { name: "Atmospheric Synth Pad", category: "midi" as const, color: "bg-[#0284c7]", icon: "🎛️", desc: "Polyphonic stereo chorus ambience" },
];

const midiToFreq = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

export default function Studio({ defaultBpm = 120 }: { defaultBpm?: number }) {
  const engine = useRef<AudioEngine>(AudioEngine.getInstance());
  const inputManager = useRef<AudioInputManager>(AudioInputManager.getInstance());

  const [tracks, setTracks] = useState<TrackData[]>([
    {
      id: 1,
      name: "Audio 1 (Vocals)",
      category: "audio",
      instrument: "Vocals / Acoustic Mic",
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
      name: "Audio 2 (Guitar)",
      category: "audio",
      instrument: "Electric Lead Guitar",
      color: "bg-[#d97706]",
      volume: 0.8,
      pan: 0,
      mute: false,
      solo: false,
      armed: false,
      regions: [],
    },
  ]);

  const [projectName, setProjectName] = useState("ArtistPilot Session");
  const [bpm, setBpm] = useState(defaultBpm);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [playheadSec, setPlayheadSec] = useState(0);
  const [selectedTrackId, setSelectedTrackId] = useState(1);
  const [pixelsPerSecond, setPixelsPerSecond] = useState(48);
  const [masterVolume, setMasterVolume] = useState(0.85);

  // Advanced Transport: Loop & Count-In
  const [isLooping, setIsLooping] = useState(false);
  const [loopStartSec, setLoopStartSec] = useState(0);
  const [loopEndSec, setLoopEndSec] = useState(8);
  const [countInActive, setCountInActive] = useState(true);

  // Modals & Windows
  const [instrumentWindowOpen, setInstrumentWindowOpen] = useState(false);
  const [instrumentTab, setInstrumentTab] = useState<"pianoroll" | "keyboard">("keyboard");
  const [ampModalOpen, setAmpModalOpen] = useState(false);
  const [aiCoachOpen, setAiCoachOpen] = useState(false);
  const [eqModalOpen, setEqModalOpen] = useState(false);
  const [mixerOpen, setMixerOpen] = useState(false);
  const [recModalOpen, setRecModalOpen] = useState(false);
  const [monitoringEnabled, setMonitoringEnabled] = useState(false);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>("");
  const [trackModalOpen, setTrackModalOpen] = useState(false);
  const [midiConnected, setMidiConnected] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");

  const [trackNotes, setTrackNotes] = useState<Record<number, MidiNote[]>>({
    2: [
      { id: "1", pitch: 60, startStep: 0, length: 2 },
      { id: "2", pitch: 64, startStep: 4, length: 2 },
    ],
  });

  const animFrame = useRef<number | null>(null);
  const playStartTime = useRef(0);
  const playheadAnchor = useRef(0);
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const recChunks = useRef<Blob[]>([]);
  const recStartTime = useRef(0);

  const clickSound = (high: boolean) => {
    const c = engine.current.init();
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.frequency.setValueAtTime(high ? 1200 : 800, c.currentTime);
    g.gain.setValueAtTime(0.3, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.04);
    osc.connect(g);
    g.connect(c.destination);
    osc.start();
    osc.stop(c.currentTime + 0.05);
  };

  const playSynthesizerVoice = (pitch: number, instrument: string) => {
    const c = engine.current.init();
    const t = c.currentTime;
    const freq = midiToFreq(pitch);

    if (instrument.includes("Piano")) {
      const o1 = c.createOscillator(); const o2 = c.createOscillator(); const g = c.createGain();
      o1.type = "triangle"; o2.type = "sine";
      o1.frequency.setValueAtTime(freq, t); o2.frequency.setValueAtTime(freq * 2, t);
      g.gain.setValueAtTime(0.4, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 1.8);
      o1.connect(g); o2.connect(g); g.connect(c.destination);
      o1.start(t); o2.start(t); o1.stop(t + 1.8); o2.stop(t + 1.8);
    } else {
      const o = c.createOscillator(); const f = c.createBiquadFilter(); const g = c.createGain();
      o.type = "sawtooth";
      o.frequency.setValueAtTime(freq, t);
      f.type = "lowpass";
      f.frequency.setValueAtTime(3200, t);
      f.frequency.exponentialRampToValueAtTime(800, t + 0.6);
      g.gain.setValueAtTime(0.35, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 1.2);
      o.connect(f); f.connect(g); g.connect(c.destination);
      o.start(t); o.stop(t + 1.2);
    }
  };

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
              playSynthesizerVoice(noteNumber, currentTrack?.instrument ?? "Acoustic Grand Piano");
            }
          };
        }
      }).catch(() => {});
    }
  }, [tracks, selectedTrackId]);

  const updatePlaybackPosition = () => {
    const elapsed = (performance.now() - playStartTime.current) / 1000;
    let currentSec = playheadAnchor.current + elapsed;

    if (isLooping && currentSec >= loopEndSec) {
      currentSec = loopStartSec;
      playStartTime.current = performance.now();
      playheadAnchor.current = loopStartSec;
      engine.current.schedulePlayback(tracks, loopStartSec);
    }

    setPlayheadSec(currentSec);
    animFrame.current = requestAnimationFrame(updatePlaybackPosition);
  };

  const handlePlay = (startAt?: number) => {
    engine.current.init();
    if (isPlaying) {
      engine.current.stopPlayback();
      if (animFrame.current) cancelAnimationFrame(animFrame.current);
      setIsPlaying(false);
    } else {
      const position = startAt !== undefined ? startAt : playheadSec;
      playStartTime.current = performance.now();
      playheadAnchor.current = position;
      engine.current.schedulePlayback(tracks, position);
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
  };

  const handleRewind = () => {
    handleStop();
    setPlayheadSec(0);
    playheadAnchor.current = 0;
  };

  const handleForward = () => {
    const nextBar = playheadSec + (60 / bpm) * 4;
    setPlayheadSec(nextBar);
    playheadAnchor.current = nextBar;
  };

  const splitClipAtPlayhead = () => {
    const track = tracks.find((t) => t.id === selectedTrackId);
    if (!track) return;

    const clip = track.regions.find(
      (r) => playheadSec > r.startTime && playheadSec < r.startTime + r.duration
    );
    if (!clip) return;

    const firstDuration = playheadSec - clip.startTime;
    const secondDuration = clip.duration - firstDuration;

    const r1: AudioRegion = { ...clip, duration: firstDuration };
    const r2: AudioRegion = {
      ...clip,
      id: `reg-${Date.now()}`,
      name: `${clip.name} (Part 2)`,
      startTime: playheadSec,
      offset: clip.offset + firstDuration,
      duration: secondDuration,
    };

    setTracks((prev) =>
      prev.map((t) =>
        t.id === selectedTrackId
          ? { ...t, regions: t.regions.flatMap((r) => (r.id === clip.id ? [r1, r2] : r)) }
          : t
      )
    );
    setStatusMsg(`Split clip at ${playheadSec.toFixed(2)}s`);
  };

  const handleRecord = async () => {
    if (isRecording) {
      handleStop();
      return;
    }

    try {
      const ctx = engine.current.init();
      const { stream } = await inputManager.current.setupInputStream(
        ctx,
        selectedDeviceId,
        monitoringEnabled
      );

      if (countInActive) {
        setStatusMsg("Count-in: 1... 2... 3... 4...");
        const beatIntervalMs = (60 / bpm) * 1000;
        for (let i = 0; i < 4; i++) {
          setTimeout(() => clickSound(i === 0), i * beatIntervalMs);
        }
        await new Promise((res) => setTimeout(res, 4 * beatIntervalMs));
      }

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
            id: `rec-${Date.now()}`,
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
      handlePlay();
    } catch {
      setStatusMsg("Microphone or Interface permission denied.");
    }
  };

  const handleDropAudio = async (e: React.DragEvent, trackId: number) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (!file) return;

    setStatusMsg(`Importing ${file.name}...`);
    try {
      const ctx = engine.current.init();
      const arrayBuffer = await file.arrayBuffer();
      const buffer = await ctx.decodeAudioData(arrayBuffer);
      const newRegion: AudioRegion = {
        id: `import-${Date.now()}`,
        name: file.name.slice(0, 24),
        buffer,
        startTime: playheadSec,
        duration: buffer.duration,
        offset: 0,
        gain: 1.0,
      };
      setTracks((prev) =>
        prev.map((t) => (t.id === trackId ? { ...t, regions: [...t.regions, newRegion] } : t))
      );
      setStatusMsg(`Imported ${file.name}!`);
    } catch {
      setStatusMsg("Could not decode audio.");
    }
  };

  const handleExport = async () => {
    setStatusMsg("Rendering 16-bit Master WAV...");
    const totalDuration = Math.max(
      6,
      ...tracks.flatMap((t) => t.regions.map((r) => r.startTime + r.duration))
    );
    const blob = await engine.current.exportMasterWav(tracks, totalDuration);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${projectName.toLowerCase().replace(/\s+/g, "-")}.wav`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    setStatusMsg("Master WAV mix exported!");
  };

  const selectedTrack = tracks.find((t) => t.id === selectedTrackId);
  const currentNotes = trackNotes[selectedTrackId] || [];

  const totalBeats = (playheadSec * bpm) / 60;
  const currentBar = Math.floor(totalBeats / 4) + 1;
  const currentBeat = (Math.floor(totalBeats) % 4) + 1;

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-[#0a0b0e] text-[#c5c7d0] font-sans select-none relative">
      
      {/* 1. GARAGEBAND LUXURY GRAPHITE TRANSPORT BAR */}
      <header className="flex h-13 flex-none items-center justify-between border-b border-[#1f2128] bg-[#131419] px-4 shadow-xl z-20">
        
        {/* Left Section: Add Track & Modular Studios */}
        <div className="flex items-center gap-2">
          <input
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            className="w-40 bg-transparent text-xs font-bold text-white/90 focus:outline-none focus:ring-1 focus:ring-[#d4af37] rounded px-1.5 py-1 truncate"
          />
          <div className="h-4 w-[1px] bg-zinc-800 mx-1" />

          <button
            onClick={() => setTrackModalOpen(true)}
            className="flex h-7 items-center gap-1 rounded bg-[#1e2028] border border-zinc-700/80 px-2.5 text-[11px] font-semibold text-zinc-200 hover:border-[#d4af37] hover:text-[#d4af37] transition shadow-sm"
          >
            <span>+</span> Track
          </button>

          <button
            onClick={() => setRecModalOpen(true)}
            className="flex h-7 items-center gap-1.5 rounded border border-zinc-800 bg-[#17181f] px-2.5 text-[11px] font-semibold text-sky-400 hover:border-sky-500/60 shadow-sm"
          >
            <span>🎙️</span> Inputs
          </button>

          <button
            onClick={() => setEqModalOpen(true)}
            className="flex h-7 items-center gap-1.5 rounded border border-zinc-800 bg-[#17181f] px-2.5 text-[11px] font-semibold text-zinc-400 hover:border-sky-500/60 hover:text-sky-400 transition"
          >
            <span>🎛️</span> Visual EQ
          </button>

          <button
            onClick={() => setInstrumentWindowOpen(!instrumentWindowOpen)}
            className={`flex h-7 items-center gap-1.5 rounded border px-2.5 text-[11px] font-semibold transition ${
              instrumentWindowOpen ? "border-[#3b82f6] bg-blue-950/40 text-blue-300" : "border-zinc-800 bg-[#17181f] text-zinc-400 hover:text-white"
            }`}
          >
            <span>🎹</span> Piano Roll
          </button>

          <button
            onClick={() => setAmpModalOpen(true)}
            className="flex h-7 items-center gap-1.5 rounded border border-zinc-800 bg-[#17181f] px-2.5 text-[11px] font-semibold text-zinc-400 hover:border-amber-500/60 hover:text-amber-400 transition"
          >
            <span>🎸</span> Amp Rig
          </button>

          <button
            onClick={() => setAiCoachOpen(true)}
            className="flex h-7 items-center gap-1.5 rounded border border-zinc-800 bg-[#17181f] px-2.5 text-[11px] font-semibold text-zinc-400 hover:border-purple-500/60 hover:text-purple-300 transition"
          >
            <span>✨</span> AI Coach
          </button>
        </div>

        {/* Center Section: GarageBand Transport Controls */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <button onClick={handleRewind} title="Return to Beginning" className="h-7 w-7 rounded flex items-center justify-center text-zinc-400 hover:text-white text-xs">⏮</button>
            <button onClick={handleStop} title="Stop" className="h-7 w-7 rounded flex items-center justify-center text-zinc-400 hover:text-white text-xs">◼</button>
            <button
              onClick={() => handlePlay()}
              title="Play / Pause"
              className={`h-8 w-11 rounded font-bold text-sm flex items-center justify-center transition shadow-md ${
                isPlaying ? "bg-[#d4af37] text-black" : "bg-[#22242e] text-white hover:bg-[#2b2d38]"
              }`}
            >
              {isPlaying ? "❚❚" : "▶"}
            </button>
            <button onClick={handleForward} title="Forward 1 Bar" className="h-7 w-7 rounded flex items-center justify-center text-zinc-400 hover:text-white text-xs">⏭</button>
            
            <button
              onClick={handleRecord}
              title="Record to Selected Track"
              className={`h-7 w-7 rounded-full border border-red-950 flex items-center justify-center transition ml-1 ${
                isRecording ? "bg-red-500 animate-pulse text-white shadow-[0_0_12px_#ef4444]" : "bg-[#8b1e1e] hover:bg-red-600"
              }`}
            >
              <div className="h-2.5 w-2.5 rounded-full bg-white shadow-sm" />
            </button>
          </div>

          {/* LCD Timecode */}
          <div className="flex h-8 items-center divide-x divide-zinc-800/80 rounded border border-zinc-800/90 bg-[#08090b] px-3 font-mono text-zinc-300 shadow-inner">
            <div className="pr-2.5 text-center">
              <span className="text-xs font-bold tracking-widest text-[#d4af37]">
                {String(currentBar).padStart(3, "0")}.{currentBeat}
              </span>
            </div>
            <div className="px-2.5 text-center flex items-center gap-1">
              <input
                type="number"
                value={bpm}
                onChange={(e) => setBpm(Number(e.target.value) || 120)}
                className="w-8 bg-transparent text-xs font-bold text-white focus:outline-none"
              />
              <span className="text-[8px] text-zinc-500">BPM</span>
            </div>
            <div className="pl-2.5 text-center">
              <span className="text-[10px] font-semibold text-zinc-400">4/4 C</span>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setIsLooping(!isLooping)}
              className={`h-7 px-2 rounded border text-[10px] font-bold transition ${
                isLooping ? "border-amber-400 bg-amber-400/20 text-amber-300" : "border-zinc-800 bg-[#16171d] text-zinc-500"
              }`}
              title="Cycle Loop Range"
            >
              🔁
            </button>
            <button
              onClick={() => setCountInActive(!countInActive)}
              className={`h-7 px-2 rounded border text-[10px] font-mono font-bold transition ${
                countInActive ? "border-[#d4af37] bg-[#d4af37]/20 text-[#d4af37]" : "border-zinc-800 bg-[#16171d] text-zinc-500"
              }`}
              title="4-Beat Count-in"
            >
              1234
            </button>
          </div>
        </div>

        {/* Right Section: Split Tool, Mixer & Export */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={splitClipAtPlayhead}
            className="h-7 px-2.5 rounded border border-zinc-700 bg-zinc-800/90 text-[11px] font-bold text-white hover:bg-zinc-700 shadow"
            title="Split Clip at Playhead"
          >
            ✂ Split
          </button>

          <button
            onClick={() => setMixerOpen(!mixerOpen)}
            className={`h-7 px-2.5 rounded border text-[11px] font-semibold transition ${
              mixerOpen ? "border-[#d4af37] bg-[#d4af37]/15 text-[#d4af37]" : "border-zinc-800 bg-[#17181f] text-zinc-400 hover:text-white"
            }`}
          >
            🎚️ Mixer
          </button>

          <button
            onClick={handleExport}
            className="h-7 rounded border border-[#d4af37]/50 bg-gradient-to-r from-[#d4af37] to-[#b38f28] px-3 text-[11px] font-bold text-black shadow-md hover:brightness-110 active:scale-95 transition"
          >
            Export WAV
          </button>
        </div>
      </header>

      {statusMsg && (
        <div className="bg-[#101217] py-1 text-center text-[11px] text-[#d4af37] border-b border-zinc-800">
          {statusMsg}
        </div>
      )}

      {/* 2. MUSICAL TIMELINE RULER & LOOP CYCLE BAR */}
      <div
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const clickX = e.clientX - rect.left - 256;
          if (clickX >= 0) {
            const newSec = Math.max(0, clickX / pixelsPerSecond);
            setPlayheadSec(newSec);
            playheadAnchor.current = newSec;
            if (isPlaying) handlePlay(newSec);
          }
        }}
        className="flex h-7 flex-none border-b border-[#1c1d24] bg-[#121318] text-[9px] text-zinc-500 font-mono cursor-pointer relative"
      >
        <div className="w-64 flex-none border-r border-[#1c1d24] px-3 flex items-center justify-between font-bold text-zinc-400">
          <span>TRACKS ({tracks.length})</span>
          <span className="text-[8px] font-sans text-zinc-500">Click to scrub</span>
        </div>

        {isLooping && (
          <div
            style={{
              left: `${256 + loopStartSec * pixelsPerSecond}px`,
              width: `${(loopEndSec - loopStartSec) * pixelsPerSecond}px`,
            }}
            className="absolute top-0 bottom-0 bg-amber-400/30 border-y-2 border-amber-400 z-10 pointer-events-none"
          />
        )}

        <div className="flex-1 flex items-center relative overflow-hidden select-none">
          {Array.from({ length: 32 }, (_, i) => (
            <div
              key={i}
              style={{ left: `${(i * 4 * 60 * pixelsPerSecond) / bpm}px` }}
              className="absolute flex items-center gap-2 text-zinc-500"
            >
              <span className="font-semibold text-zinc-400">{i + 1}</span>
              <div className="h-2 w-[1px] bg-zinc-800" />
            </div>
          ))}
        </div>
      </div>

      {/* 3. MULTI-TRACK ARRANGER */}
      <div className="flex-1 overflow-y-auto divide-y divide-[#171820] bg-[#0c0d10] relative">
        <div
          style={{ left: `${256 + playheadSec * pixelsPerSecond}px` }}
          className="absolute top-0 bottom-0 w-[1.5px] bg-[#d4af37] z-30 pointer-events-none"
        >
          <div className="h-2 w-2 -ml-[3px] bg-[#d4af37] rotate-45 shadow" />
        </div>

        {tracks.map((track) => {
          const isSelected = selectedTrackId === track.id;
          return (
            <div
              key={track.id}
              onClick={() => setSelectedTrackId(track.id)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => handleDropAudio(e, track.id)}
              className={`flex h-20 transition ${isSelected ? "bg-[#16171f]" : "bg-[#0e0f13] hover:bg-[#121319]"}`}
            >
              {/* Left Track Header */}
              <div className="w-64 flex-none border-r border-[#1c1d24] p-2 flex flex-col justify-between bg-[#121318]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="flex h-6 w-6 items-center justify-center rounded bg-zinc-800 text-xs shadow-inner">
                      {INSTRUMENT_LIBRARY.find((p) => p.name === track.instrument)?.icon ?? "🎙️"}
                    </div>
                    <input
                      value={track.name}
                      onChange={(e) => setTracks((ts) => ts.map((t) => t.id === track.id ? { ...t, name: e.target.value } : t))}
                      className="w-28 bg-transparent text-xs font-bold text-white focus:outline-none focus:ring-1 focus:ring-[#d4af37] rounded px-1 truncate"
                    />
                  </div>
                  {tracks.length > 1 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setTracks((prev) => prev.filter((t) => t.id !== track.id));
                      }}
                      className="text-zinc-600 hover:text-red-400 text-xs px-1"
                    >
                      ✕
                    </button>
                  )}
                </div>

                <div className="flex items-center justify-between text-[10px] pt-1">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setTracks((ts) => ts.map((t) => t.id === track.id ? { ...t, mute: !t.mute } : t));
                      }}
                      className={`h-4.5 px-1.5 rounded text-[9px] font-bold ${track.mute ? "bg-blue-500 text-white" : "bg-[#1e2028] text-zinc-400 hover:text-white"}`}
                    >
                      M
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setTracks((ts) => ts.map((t) => t.id === track.id ? { ...t, solo: !t.solo } : t));
                      }}
                      className={`h-4.5 px-1.5 rounded text-[9px] font-bold ${track.solo ? "bg-amber-500 text-black" : "bg-[#1e2028] text-zinc-400 hover:text-white"}`}
                    >
                      S
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedTrackId(track.id);
                        setEqModalOpen(true);
                      }}
                      className="h-4.5 px-1.5 rounded text-[9px] font-bold bg-[#1e2028] text-zinc-400 hover:text-sky-400 hover:border-sky-500/50 border border-transparent"
                    >
                      EQ
                    </button>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span className="text-[9px] text-zinc-500 font-mono">VOL</span>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.05}
                      value={track.volume}
                      onChange={(e) => setTracks((ts) => ts.map((t) => t.id === track.id ? { ...t, volume: Number(e.target.value) } : t))}
                      className="w-16 accent-[#d4af37] h-1 bg-zinc-800 rounded cursor-pointer"
                    />
                  </div>
                </div>
              </div>

              {/* Arranger Track Grid Lane */}
              <div className="flex-1 relative overflow-hidden flex items-center">
                {track.regions.length === 0 ? (
                  <div className="text-[10px] text-zinc-600 pl-6 italic select-none pointer-events-none">
                    Drop audio files here, or arm record (●)
                  </div>
                ) : (
                  track.regions.map((region) => (
                    <ClipRegion
                      key={region.id}
                      // @ts-ignore
                      region={region as any}
                      pixelsPerSecond={pixelsPerSecond}
                      trackColor={track.color}
                      onUpdate={(patch) =>
                        setTracks((prev) =>
                          prev.map((t) =>
                            t.id === track.id
                              ? { ...t, regions: t.regions.map((r) => r.id === region.id ? { ...r, ...patch } : r) }
                              : t
                          )
                        )
                      }
                      onSplit={() => {}}
                      onDelete={() =>
                        setTracks((prev) =>
                          prev.map((t) =>
                            t.id === track.id ? { ...t, regions: t.regions.filter((r) => r.id !== region.id) } : t
                          )
                        )
                      }
                    />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* 4. MODALS & WINDOWS */}
      <RecordingSettingsModal
        isOpen={recModalOpen}
        onClose={() => setRecModalOpen(false)}
        ctx={engine.current.ctx}
        onSelectDevice={(devId) => setSelectedDeviceId(devId)}
        onToggleMonitoring={(en) => {
          setMonitoringEnabled(en);
          inputManager.current.setMonitoring(engine.current.init(), en);
        }}
        monitoringEnabled={monitoringEnabled}
      />

      <ChannelEqModal
        isOpen={eqModalOpen}
        onClose={() => setEqModalOpen(false)}
        trackName={selectedTrack?.name ?? "Track"}
      />

      {instrumentWindowOpen && (
        <div className="absolute bottom-6 right-8 z-40 w-[640px] h-[340px] rounded-xl border border-zinc-700 bg-[#14151a] shadow-2xl flex flex-col overflow-hidden">
          <div className="flex h-9 items-center justify-between border-b border-zinc-800 bg-[#1c1d24] px-3 select-none">
            <span className="text-xs font-bold text-white">🎹 {selectedTrack?.instrument}</span>
            <button onClick={() => setInstrumentWindowOpen(false)} className="text-xs text-zinc-400 hover:text-white">✕</button>
          </div>
          <div className="flex-1 overflow-hidden">
            <PianoRoll
              notes={currentNotes}
              instrumentName={selectedTrack?.instrument ?? "Acoustic Grand Piano"}
              onPreviewNote={(pitch) => playSynthesizerVoice(pitch, selectedTrack?.instrument ?? "Acoustic Grand Piano")}
              onAddNote={(note) =>
                setTrackNotes((prev) => ({
                  ...prev,
                  [selectedTrackId]: [...(prev[selectedTrackId] || []), note],
                }))
              }
              onDeleteNote={(noteId) =>
                setTrackNotes((prev) => ({
                  ...prev,
                  [selectedTrackId]: (prev[selectedTrackId] || []).filter((n) => n.id !== noteId),
                }))
              }
            />
          </div>
        </div>
      )}

      <GuitarAmpModal isOpen={ampModalOpen} onClose={() => setAmpModalOpen(false)} trackName={selectedTrack?.name ?? "Guitar Track"} />
      <AiCoachModal isOpen={aiCoachOpen} onClose={() => setAiCoachOpen(false)} currentKey="C" bpm={bpm} />

      {/* 5. ADD TRACK MODAL */}
      {trackModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-xl rounded-xl border border-zinc-700 bg-[#14151a] p-6 shadow-2xl">
            <h2 className="text-base font-bold text-white mb-1">Add Studio Track</h2>
            <div className="grid grid-cols-2 gap-2.5 mt-4">
              {INSTRUMENT_LIBRARY.map((p) => (
                <button
                  key={p.name}
                  onClick={() => {
                    const id = Date.now();
                    setTracks((prev) => [
                      ...prev,
                      {
                        id,
                        name: `${p.name.split(" ")[0]} ${prev.length + 1}`,
                        category: p.category,
                        instrument: p.name,
                        color: p.color,
                        volume: 0.8,
                        pan: 0,
                        mute: false,
                        solo: false,
                        armed: false,
                        regions: [],
                      },
                    ]);
                    setSelectedTrackId(id);
                    setTrackModalOpen(false);
                  }}
                  className="flex items-center gap-3 rounded-lg border border-zinc-800 bg-[#191b22] p-3 text-left hover:border-[#d4af37] transition"
                >
                  <div className="text-xl">{p.icon}</div>
                  <div>
                    <h3 className="text-xs font-bold text-white">{p.name}</h3>
                    <p className="text-[10px] text-zinc-500">{p.desc}</p>
                  </div>
                </button>
              ))}
            </div>
            <div className="mt-5 flex justify-end">
              <button onClick={() => setTrackModalOpen(false)} className="rounded bg-zinc-800 px-4 py-1.5 text-xs text-white hover:bg-zinc-700">Cancel</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
