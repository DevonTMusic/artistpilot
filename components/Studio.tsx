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
  const [pixelsPerSecond, setPixelsPerSecond] = useState(50);
  const [masterVolume, setMasterVolume] = useState(0.85);

  // Loop & Count-In
  const [isLooping, setIsLooping] = useState(false);
  const [loopStartSec, setLoopStartSec] = useState(0);
  const [loopEndSec, setLoopEndSec] = useState(8);
  const [countInActive, setCountInActive] = useState(true);

  // Draggable Window Coordinates
  const [pianoPos, setPianoPos] = useState({ x: 260, y: 130 });
  const [isDraggingPiano, setIsDraggingPiano] = useState(false);
  const pianoOffset = useRef({ x: 0, y: 0 });

  // Modals & Panels
  const [instrumentWindowOpen, setInstrumentWindowOpen] = useState(false);
  const [ampModalOpen, setAmpModalOpen] = useState(false);
  const [aiCoachOpen, setAiCoachOpen] = useState(false);
  const [eqModalOpen, setEqModalOpen] = useState(false);
  const [mixerOpen, setMixerOpen] = useState(false);
  const [recModalOpen, setRecModalOpen] = useState(false);
  const [monitoringEnabled, setMonitoringEnabled] = useState(false);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>("");
  const [trackModalOpen, setTrackModalOpen] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");

  // Live Recording Waveform Canvas State
  const liveCanvasRef = useRef<HTMLCanvasElement>(null);
  const liveAnimRef = useRef<number | null>(null);

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

  const timelineContainerRef = useRef<HTMLDivElement>(null);

  // Sound Engine
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

  // Draggable Mouse Handlers for Pop-Ups
  const startDragPiano = (e: React.MouseEvent) => {
    setIsDraggingPiano(true);
    pianoOffset.current = {
      x: e.clientX - pianoPos.x,
      y: e.clientY - pianoPos.y,
    };
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDraggingPiano) {
        setPianoPos({
          x: Math.max(10, e.clientX - pianoOffset.current.x),
          y: Math.max(10, e.clientY - pianoOffset.current.y),
        });
      }
    };
    const handleMouseUp = () => setIsDraggingPiano(false);

    if (isDraggingPiano) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    }
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDraggingPiano]);

  // Master Clock & Loop Watcher
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
      if (liveAnimRef.current) cancelAnimationFrame(liveAnimRef.current);
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

  // Split Clip
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
      name: `${clip.name} (B)`,
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

  // Live Waveform Recording Functionality
  const startLiveWaveAnimation = () => {
    const analyser = inputManager.current.analyserNode;
    const cv = liveCanvasRef.current;
    if (!cv || !analyser) return;

    const canvasCtx = cv.getContext("2d");
    if (!canvasCtx) return;

    const dataArray = new Uint8Array(analyser.frequencyBinCount);

    const draw = () => {
      liveAnimRef.current = requestAnimationFrame(draw);
      analyser.getByteTimeDomainData(dataArray);

      canvasCtx.clearRect(0, 0, cv.width, cv.height);
      canvasCtx.lineWidth = 2;
      canvasCtx.strokeStyle = "#ffffff";
      canvasCtx.beginPath();

      const sliceWidth = (cv.width * 1.0) / dataArray.length;
      let x = 0;

      for (let i = 0; i < dataArray.length; i++) {
        const v = dataArray[i] / 128.0;
        const y = (v * cv.height) / 2;

        if (i === 0) canvasCtx.moveTo(x, y);
        else canvasCtx.lineTo(x, y);

        x += sliceWidth;
      }

      canvasCtx.lineTo(cv.width, cv.height / 2);
      canvasCtx.stroke();
    };

    draw();
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
      setTimeout(startLiveWaveAnimation, 50);
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
      
      {/* 1. TOP TRANSPORT BAR */}
      <header className="flex h-13 flex-none items-center justify-between border-b border-[#1f2128] bg-[#131419] px-4 shadow-xl z-20">
        
        {/* Left Controls */}
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
            + Track
          </button>

          <button
            onClick={() => setRecModalOpen(true)}
            className="flex h-7 items-center gap-1.5 rounded border border-zinc-800 bg-[#17181f] px-2.5 text-[11px] font-semibold text-sky-400 hover:border-sky-500/60 shadow-sm"
          >
            Inputs & Monitor
          </button>

          <button
            onClick={() => setEqModalOpen(true)}
            className="flex h-7 items-center gap-1.5 rounded border border-zinc-800 bg-[#17181f] px-2.5 text-[11px] font-semibold text-zinc-400 hover:border-sky-500/60 hover:text-sky-400 transition"
          >
            Visual EQ
          </button>

          <button
            onClick={() => setInstrumentWindowOpen(!instrumentWindowOpen)}
            className={`flex h-7 items-center gap-1.5 rounded border px-2.5 text-[11px] font-semibold transition ${
              instrumentWindowOpen ? "border-[#3b82f6] bg-blue-950/40 text-blue-300" : "border-zinc-800 bg-[#17181f] text-zinc-400 hover:text-white"
            }`}
          >
            Piano Roll
          </button>

          <button
            onClick={() => setAmpModalOpen(true)}
            className="flex h-7 items-center gap-1.5 rounded border border-zinc-800 bg-[#17181f] px-2.5 text-[11px] font-semibold text-zinc-400 hover:border-amber-500/60 hover:text-amber-400 transition"
          >
            Amp Rig
          </button>

          <button
            onClick={() => setAiCoachOpen(true)}
            className="flex h-7 items-center gap-1.5 rounded border border-zinc-800 bg-[#17181f] px-2.5 text-[11px] font-semibold text-zinc-400 hover:border-purple-500/60 hover:text-purple-300 transition"
          >
            AI Coach
          </button>
        </div>

        {/* Center: Vector Transport Controls */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <button
              onClick={handleRewind}
              title="Rewind to start"
              className="h-8 w-8 rounded flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-800 transition"
            >
              <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/>
              </svg>
            </button>
            
            <button
              onClick={handleStop}
              title="Stop"
              className="h-8 w-8 rounded flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-800 transition"
            >
              <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                <rect x="5" y="5" width="14" height="14" rx="1"/>
              </svg>
            </button>

            <button
              onClick={() => handlePlay()}
              title="Play / Pause"
              className={`h-8 w-11 rounded font-bold text-sm flex items-center justify-center transition shadow-md ${
                isPlaying ? "bg-[#d4af37] text-black" : "bg-[#22242e] text-white hover:bg-[#2b2d38]"
              }`}
            >
              {isPlaying ? (
                <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                  <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
                </svg>
              ) : (
                <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z"/>
                </svg>
              )}
            </button>

            <button
              onClick={handleForward}
              title="Forward 1 Bar"
              className="h-8 w-8 rounded flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-800 transition"
            >
              <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/>
              </svg>
            </button>
            
            <button
              onClick={handleRecord}
              title="Record"
              className={`h-8 w-8 rounded-full border border-red-950 flex items-center justify-center transition ml-1 ${
                isRecording ? "bg-red-500 animate-pulse text-white shadow-[0_0_12px_#ef4444]" : "bg-[#8b1e1e] hover:bg-red-600"
              }`}
            >
              <div className="h-3 w-3 rounded-full bg-white shadow-sm" />
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
              className={`h-7 px-2 rounded border text-[11px] font-bold transition ${
                isLooping ? "border-amber-400 bg-amber-400/20 text-amber-300" : "border-zinc-800 bg-[#16171d] text-zinc-500"
              }`}
              title="Toggle Loop Range"
            >
              ↻ Loop
            </button>
            <button
              onClick={() => setCountInActive(!countInActive)}
              className={`h-7 px-2 rounded border text-[10px] font-mono font-bold transition ${
                countInActive ? "border-[#d4af37] bg-[#d4af37]/20 text-[#d4af37]" : "border-zinc-800 bg-[#16171d] text-zinc-500"
              }`}
            >
              1234
            </button>
          </div>
        </div>

        {/* Right Section */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={splitClipAtPlayhead}
            className="h-7 px-2.5 rounded border border-zinc-700 bg-zinc-800/90 text-[11px] font-bold text-white hover:bg-zinc-700 shadow"
          >
            Split (✂)
          </button>

          <button
            onClick={() => setMixerOpen(!mixerOpen)}
            className={`h-7 px-2.5 rounded border text-[11px] font-semibold transition ${
              mixerOpen ? "border-[#d4af37] bg-[#d4af37]/15 text-[#d4af37]" : "border-zinc-800 bg-[#17181f] text-zinc-400 hover:text-white"
            }`}
          >
            Mixer
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

      {/* 2. SPLIT LAYOUT: FIXED HEADERS (LEFT) + HORIZONTALLY SCROLLABLE TIMELINE (RIGHT) */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* Left Track Headers (Stays in place during horizontal scroll) */}
        <div className="w-64 flex-none border-r border-[#1c1d24] bg-[#121318] flex flex-col z-10 shadow-lg">
          <div className="h-7 border-b border-[#1c1d24] px-3 flex items-center justify-between font-bold text-zinc-400 text-[10px]">
            <span>TRACK HEADERS ({tracks.length})</span>
          </div>

          <div className="flex-1 overflow-y-hidden divide-y divide-[#171820]">
            {tracks.map((track) => (
              <div
                key={track.id}
                onClick={() => setSelectedTrackId(track.id)}
                className={`h-20 p-2 flex flex-col justify-between transition ${
                  selectedTrackId === track.id ? "bg-[#16171f]" : "bg-[#121318]"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs">{INSTRUMENT_LIBRARY.find((p) => p.name === track.instrument)?.icon ?? "🎙️"}</span>
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
            ))}
          </div>
        </div>

        {/* Right Scrollable Timeline Grid */}
        <div
          ref={timelineContainerRef}
          className="flex-1 overflow-x-auto overflow-y-hidden flex flex-col bg-[#0c0d10] relative select-none"
        >
          {/* Scrollable Musical Ruler */}
          <div
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const scrollLeft = timelineContainerRef.current?.scrollLeft || 0;
              const clickX = e.clientX - rect.left + scrollLeft;
              const newSec = Math.max(0, clickX / pixelsPerSecond);
              setPlayheadSec(newSec);
              playheadAnchor.current = newSec;
              if (isPlaying) handlePlay(newSec);
            }}
            style={{ width: "3200px" }}
            className="h-7 border-b border-[#1c1d24] bg-[#121318] relative cursor-pointer flex-none"
          >
            {isLooping && (
              <div
                style={{
                  left: `${loopStartSec * pixelsPerSecond}px`,
                  width: `${(loopEndSec - loopStartSec) * pixelsPerSecond}px`,
                }}
                className="absolute top-0 bottom-0 bg-amber-400/30 border-y-2 border-amber-400 z-10 pointer-events-none"
              />
            )}

            {Array.from({ length: 64 }, (_, i) => (
              <div
                key={i}
                style={{ left: `${(i * 4 * 60 * pixelsPerSecond) / bpm}px` }}
                className="absolute flex items-center gap-2 text-zinc-500 top-1 text-[9px] font-mono pointer-events-none"
              >
                <span className="font-semibold text-zinc-400">{i + 1}</span>
                <div className="h-3 w-[1px] bg-zinc-800" />
              </div>
            ))}
          </div>

          {/* Arranger Track Lanes Container */}
          <div style={{ width: "3200px" }} className="flex-1 relative divide-y divide-[#171820]">
            
            {/* Playhead Hairline */}
            <div
              style={{ left: `${playheadSec * pixelsPerSecond}px` }}
              className="absolute top-0 bottom-0 w-[1.5px] bg-[#d4af37] z-30 pointer-events-none"
            >
              <div className="h-2 w-2 -ml-[3.5px] bg-[#d4af37] rotate-45 shadow" />
            </div>

            {tracks.map((track) => (
              <div
                key={track.id}
                onClick={() => setSelectedTrackId(track.id)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => handleDropAudio(e, track.id)}
                className={`h-20 relative flex items-center transition ${
                  selectedTrackId === track.id ? "bg-[#16171f]" : "bg-[#0e0f13] hover:bg-[#121319]"
                }`}
              >
                {/* Real-time live audio recording waveform canvas */}
                {isRecording && selectedTrackId === track.id && (
                  <div
                    style={{
                      left: `${recStartTime.current * pixelsPerSecond}px`,
                      width: `${Math.max(20, (playheadSec - recStartTime.current) * pixelsPerSecond)}px`,
                    }}
                    className="absolute top-1 bottom-1 bg-red-950/80 border border-red-500 rounded z-20 overflow-hidden"
                  >
                    <canvas ref={liveCanvasRef} width={400} height={70} className="h-full w-full opacity-90" />
                  </div>
                )}

                {track.regions.length === 0 && (!isRecording || selectedTrackId !== track.id) ? (
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
            ))}
          </div>

        </div>
      </div>

      {/* 3. DRAGGABLE PIANO ROLL POPUP */}
      {instrumentWindowOpen && (
        <div
          style={{ left: `${pianoPos.x}px`, top: `${pianoPos.y}px` }}
          className="fixed z-50 w-[660px] h-[360px] rounded-2xl border-2 border-[#20222a] bg-[#14151b] shadow-[0_30px_70px_rgba(0,0,0,0.9)] flex flex-col overflow-hidden font-sans select-none"
        >
          {/* Draggable Title Bar */}
          <div
            onMouseDown={startDragPiano}
            className="flex h-10 flex-none items-center justify-between border-b border-zinc-800 bg-[#1c1e26] px-4 cursor-grab active:cursor-grabbing hover:bg-[#22242e] transition"
          >
            <span className="text-xs font-bold text-white flex items-center gap-2">
              <span>🎹</span> Piano Roll ({selectedTrack?.instrument})
            </span>
            <button
              onClick={() => setInstrumentWindowOpen(false)}
              className="h-6 w-6 rounded hover:bg-red-500 text-zinc-400 hover:text-white flex items-center justify-center font-bold text-xs"
            >
              ✕
            </button>
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

      {/* 4. MODALS */}
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
