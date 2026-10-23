// components/Studio.tsx
"use client";
import React, { useEffect, useRef, useState } from "react";
import { AudioEngine } from "@/lib/AudioEngine";
import { TrackData, AudioRegion } from "@/lib/AudioEngine";
import { ClipRegion } from "@/components/daw/ClipRegion";
import { PianoRoll, MidiNote } from "@/components/daw/PianoRoll";
import { GuitarAmpModal } from "@/components/daw/GuitarAmpModal";
import { AiCoachModal } from "@/components/daw/AiCoachModal";
import { AudioInputManager, AudioInputDevice } from "@/lib/daw/AudioInputManager";
import { ChannelEqModal } from "@/components/daw/ChannelEqModal";

export type TrackCompatibilityType = "vocal" | "guitar-bass" | "midi" | "drum";

interface ExtendedTrackData extends TrackData {
  trackType: TrackCompatibilityType;
  inputDevice?: string;
  monitoring?: boolean;
  noiseGate?: number;
  compressor?: number;
  lowCut?: boolean;
  reverbSend?: number;
}

const INSTRUMENT_LIBRARY: { name: string; category: "audio" | "midi" | "drum"; trackType: TrackCompatibilityType; color: string; icon: string; desc: string }[] = [
  { name: "Audio Track (Vocals)", category: "audio", trackType: "vocal", color: "bg-[#2563eb]", icon: "🎙️", desc: "Studio vocal chain & live hardware" },
  { name: "Electric Guitar", category: "audio", trackType: "guitar-bass", color: "bg-[#d97706]", icon: "🎸", desc: "Instrument direct input / Amp modeling" },
  { name: "Classic Bass", category: "audio", trackType: "guitar-bass", color: "bg-[#7c3aed]", icon: "🎸", desc: "Direct instrument bass input" },
  { name: "Grand Piano", category: "midi", trackType: "midi", color: "bg-[#059669]", icon: "🎹", desc: "MIDI-only software instrument" },
  { name: "Analog Synth", category: "midi", trackType: "midi", color: "bg-[#0284c7]", icon: "🎛️", desc: "Polyphonic MIDI synthesizer" },
  { name: "Drum Machine", category: "drum", trackType: "drum", color: "bg-[#dc2626]", icon: "🥁", desc: "16-step drum pattern trigger" },
];

const KEYS = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const midiToFreq = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

export default function Studio({ defaultBpm = 118 }: { defaultBpm?: number }) {
  const engine = useRef<AudioEngine>(AudioEngine.getInstance());
  const inputManager = useRef<AudioInputManager>(AudioInputManager.getInstance());

  const [tracks, setTracks] = useState<ExtendedTrackData[]>([
    {
      id: 1,
      name: "Audio 1",
      category: "audio",
      trackType: "vocal",
      instrument: "Audio Track (Vocals)",
      color: "bg-[#2563eb]",
      volume: 0.85,
      pan: 0,
      mute: false,
      solo: false,
      armed: true,
      monitoring: false,
      noiseGate: 0.2,
      compressor: 0.5,
      lowCut: true,
      reverbSend: 0.25,
      regions: [],
    },
    {
      id: 2,
      name: "Audio 2",
      category: "audio",
      trackType: "guitar-bass",
      instrument: "Electric Guitar",
      color: "bg-[#d97706]",
      volume: 0.8,
      pan: 0,
      mute: false,
      solo: false,
      armed: false,
      monitoring: false,
      noiseGate: 0.1,
      compressor: 0.4,
      lowCut: false,
      reverbSend: 0.3,
      regions: [],
    },
  ]);

  const [projectName, setProjectName] = useState("What I dont Say - Tracks");
  const [bpm, setBpm] = useState(defaultBpm);
  const [projectKey, setProjectKey] = useState("D♭");
  const [projectScale, setProjectScale] = useState<"maj" | "min">("maj");
  const [isPlaying, setIsPlaying] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [playheadSec, setPlayheadSec] = useState(0);
  const [selectedTrackId, setSelectedTrackId] = useState(1);
  const [pixelsPerSecond, setPixelsPerSecond] = useState(50);
  const [masterVolume, setMasterVolume] = useState(0.85);

  // Playhead scrubbing & looping
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [isLooping, setIsLooping] = useState(false);
  const [loopStartSec, setLoopStartSec] = useState(0);
  const [loopEndSec, setLoopEndSec] = useState(8);
  const [countInActive, setCountInActive] = useState(true);
  const [metronomeActive, setMetronomeActive] = useState(false);

  // Clipboard for Copy / Paste clips
  const [copiedClip, setCopiedClip] = useState<AudioRegion | null>(null);

  // Left Tools Drawer
  const [toolsDrawerOpen, setToolsDrawerOpen] = useState(true);
  const [smartControlsOpen, setSmartControlsOpen] = useState(true);

  // Hardware Devices
  const [devices, setDevices] = useState<AudioInputDevice[]>([]);
  const [statusMsg, setStatusMsg] = useState("");

  // Universal Draggable Window Coordinates
  const [windowState, setWindowState] = useState({
    piano: { open: false, x: 260, y: 120 },
    amp: { open: false, x: 300, y: 100 },
    eq: { open: false, x: 340, y: 140 },
    ai: { open: false, x: 380, y: 120 },
    trackModal: { open: false, x: 320, y: 120 },
  });

  const [activeDragWindow, setActiveDragWindow] = useState<keyof typeof windowState | null>(null);
  const dragOffset = useRef({ x: 0, y: 0 });

  const [trackNotes, setTrackNotes] = useState<Record<number, MidiNote[]>>({
    2: [
      { id: "1", pitch: 60, startStep: 0, length: 2 },
      { id: "2", pitch: 64, startStep: 4, length: 2 },
    ],
  });

  const animFrame = useRef<number | null>(null);
  const playStartTime = useRef(0);
  const playheadAnchor = useRef(0);
  const activeMediaRecorders = useRef<MediaRecorder[]>([]);
  const recChunks = useRef<Record<number, Blob[]>>({});
  const recStartTime = useRef(0);
  const liveCanvasRef = useRef<HTMLCanvasElement>(null);
  const liveAnimRef = useRef<number | null>(null);
  const timelineContainerRef = useRef<HTMLDivElement>(null);

  // Enumerate hardware devices (e.g. Scarlett Solo)
  useEffect(() => {
    inputManager.current.getAvailableInputs().then((devs) => {
      setDevices(devs);
    });
  }, []);

  // Universal Draggable Pointer Listeners
  const startDragWindow = (key: keyof typeof windowState, e: React.MouseEvent) => {
    setActiveDragWindow(key);
    dragOffset.current = {
      x: e.clientX - windowState[key].x,
      y: e.clientY - windowState[key].y,
    };
  };

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (activeDragWindow) {
        setWindowState((prev) => ({
          ...prev,
          [activeDragWindow]: {
            ...prev[activeDragWindow],
            x: Math.max(10, e.clientX - dragOffset.current.x),
            y: Math.max(10, e.clientY - dragOffset.current.y),
          },
        }));
      }
    };
    const onMouseUp = () => setActiveDragWindow(null);

    if (activeDragWindow) {
      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", onMouseUp);
    }
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [activeDragWindow]);

  // Scrubbing Listeners
  useEffect(() => {
    const onScrubMove = (e: MouseEvent) => {
      if (isScrubbing && timelineContainerRef.current) {
        const rect = timelineContainerRef.current.getBoundingClientRect();
        const scrollLeft = timelineContainerRef.current.scrollLeft || 0;
        const newSec = Math.max(0, (e.clientX - rect.left + scrollLeft) / pixelsPerSecond);
        setPlayheadSec(newSec);
        playheadAnchor.current = newSec;
      }
    };
    const onScrubUp = () => setIsScrubbing(false);

    if (isScrubbing) {
      window.addEventListener("mousemove", onScrubMove);
      window.addEventListener("mouseup", onScrubUp);
    }
    return () => {
      window.removeEventListener("mousemove", onScrubMove);
      window.removeEventListener("mouseup", onScrubUp);
    };
  }, [isScrubbing, pixelsPerSecond]);

  // Keyboard Shortcuts (Command+C, Command+V, Command+T)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "c") {
        const currTrack = tracks.find((t) => t.id === selectedTrackId);
        const clip = currTrack?.regions.find(
          (r) => playheadSec >= r.startTime && playheadSec <= r.startTime + r.duration
        );
        if (clip) {
          setCopiedClip(clip);
          setStatusMsg(`Copied "${clip.name}"`);
        }
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "v") {
        if (copiedClip) {
          pasteClipAtPlayhead();
        }
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "t") {
        splitClipAtPlayhead();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedTrackId, playheadSec, copiedClip, tracks]);

  const pasteClipAtPlayhead = () => {
    if (!copiedClip) return;
    const targetTrack = tracks.find((t) => t.id === selectedTrackId);
    if (!targetTrack) return;

    if (targetTrack.category === "midi") {
      setStatusMsg("Cannot paste audio clips onto MIDI / Piano tracks!");
      return;
    }

    const newRegion: AudioRegion = {
      ...copiedClip,
      id: `clip-${Date.now()}`,
      name: `${copiedClip.name} (Copy)`,
      startTime: playheadSec,
    };

    setTracks((prev) =>
      prev.map((t) => (t.id === selectedTrackId ? { ...t, regions: [...t.regions, newRegion] } : t))
    );
    setStatusMsg(`Pasted clip at ${playheadSec.toFixed(2)}s`);
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

  // Master Clock
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
      const pos = startAt !== undefined ? startAt : playheadSec;
      playStartTime.current = performance.now();
      playheadAnchor.current = pos;
      engine.current.schedulePlayback(tracks, pos);
      animFrame.current = requestAnimationFrame(updatePlaybackPosition);
      setIsPlaying(true);
    }
  };

  const handleStop = () => {
    engine.current.stopPlayback();
    if (animFrame.current) cancelAnimationFrame(animFrame.current);
    if (isRecording) {
      activeMediaRecorders.current.forEach((mr) => mr.stop());
      activeMediaRecorders.current = [];
      setIsRecording(false);
      if (liveAnimRef.current) cancelAnimationFrame(liveAnimRef.current);
    }
    setIsPlaying(false);
  };

  const startLiveWaveform = () => {
    const analyser = inputManager.current.analyserNode;
    const cv = liveCanvasRef.current;
    if (!cv || !analyser) return;

    const ctx = cv.getContext("2d");
    if (!ctx) return;

    const dataArray = new Uint8Array(analyser.frequencyBinCount);

    const draw = () => {
      liveAnimRef.current = requestAnimationFrame(draw);
      analyser.getByteTimeDomainData(dataArray);

      ctx.clearRect(0, 0, cv.width, cv.height);
      ctx.lineWidth = 2;
      ctx.strokeStyle = "#ffffff";
      ctx.beginPath();

      const sliceWidth = (cv.width * 1.0) / dataArray.length;
      let x = 0;

      for (let i = 0; i < dataArray.length; i++) {
        const v = dataArray[i] / 128.0;
        const y = (v * cv.height) / 2;

        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);

        x += sliceWidth;
      }

      ctx.lineTo(cv.width, cv.height / 2);
      ctx.stroke();
    };

    draw();
  };

  const handleRecord = async () => {
    if (isRecording) {
      handleStop();
      return;
    }

    const armedAudioTracks = tracks.filter((t) => t.armed && t.category === "audio");
    if (armedAudioTracks.length === 0) {
      setStatusMsg("No track armed! Click the red record circle (●) on a track.");
      return;
    }

    try {
      const ctx = engine.current.init();
      const currentTrack = tracks.find((t) => t.id === selectedTrackId);
      const { stream } = await inputManager.current.setupInputStream(
        ctx,
        currentTrack?.inputDevice,
        currentTrack?.monitoring ?? false
      );

      recChunks.current = {};
      recStartTime.current = playheadSec;
      activeMediaRecorders.current = [];

      armedAudioTracks.forEach((track) => {
        recChunks.current[track.id] = [];
        const mr = new MediaRecorder(stream);

        mr.ondataavailable = (e) => {
          if (e.data.size > 0) recChunks.current[track.id].push(e.data);
        };

        mr.onstop = async () => {
          const blob = new Blob(recChunks.current[track.id], { type: mr.mimeType || "audio/webm" });
          try {
            const buffer = await ctx.decodeAudioData(await blob.arrayBuffer());
            const newRegion: AudioRegion = {
              id: `rec-${track.id}-${Date.now()}`,
              name: `New Recording`,
              buffer,
              startTime: recStartTime.current,
              duration: buffer.duration,
              offset: 0,
              gain: 1.0,
            };
            setTracks((prev) =>
              prev.map((t) => (t.id === track.id ? { ...t, regions: [...t.regions, newRegion] } : t))
            );
          } catch {}
        };

        activeMediaRecorders.current.push(mr);
        mr.start();
      });

      setIsRecording(true);
      handlePlay();
      setTimeout(startLiveWaveform, 60);
    } catch {
      setStatusMsg("Microphone / Scarlett Solo access denied.");
    }
  };

  const selectedTrack = tracks.find((t) => t.id === selectedTrackId);
  const currentNotes = trackNotes[selectedTrackId] || [];

  const totalBeats = (playheadSec * bpm) / 60;
  const currentBar = Math.floor(totalBeats / 4) + 1;
  const currentBeat = (Math.floor(totalBeats) % 4) + 1;

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-[#24252a] text-[#c5c7d0] font-sans select-none">
      
      {/* 1. TOP TRANSPORT BAR (GARAGEBAND LOOK) */}
      <header className="flex h-12 flex-none items-center justify-between border-b border-[#1b1c20] bg-[#3a3c44] px-4 shadow-md z-30">
        
        {/* Left: Window Dots & Project Title */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <div className="h-3 w-3 rounded-full bg-[#ff5f56] border border-[#e0443e]" />
            <div className="h-3 w-3 rounded-full bg-[#ffbd2e] border border-[#dea123]" />
            <div className="h-3 w-3 rounded-full bg-[#27c93f] border border-[#1aab29]" />
          </div>

          <button
            onClick={() => setToolsDrawerOpen(!toolsDrawerOpen)}
            className={`flex h-7 items-center gap-1.5 rounded px-2 text-xs font-semibold border ${
              toolsDrawerOpen ? "bg-[#4a4d56] border-zinc-600 text-white" : "bg-[#33353c] border-zinc-700 text-zinc-400"
            }`}
          >
            <span>📁</span> Tools
          </button>

          <span className="text-xs font-bold text-zinc-300 truncate">{projectName}</span>
        </div>

        {/* Center: Authentic Transport + GarageBand LCD Box */}
        <div className="flex items-center gap-3">
          {/* Rewind, FastForward, Stop, Play, Record, Loop */}
          <div className="flex items-center gap-1 text-zinc-300">
            <button
              onClick={() => { handleStop(); setPlayheadSec(0); }}
              className="h-7 w-7 rounded flex items-center justify-center hover:text-white hover:bg-zinc-700/60"
              title="Rewind to start"
            >
              ◀◀
            </button>
            <button
              onClick={() => setPlayheadSec(playheadSec + (60 / bpm) * 4)}
              className="h-7 w-7 rounded flex items-center justify-center hover:text-white hover:bg-zinc-700/60"
              title="Forward 1 Bar"
            >
              ▶▶
            </button>
            <button
              onClick={handleStop}
              className="h-7 w-7 rounded flex items-center justify-center hover:text-white hover:bg-zinc-700/60"
              title="Stop"
            >
              ◼
            </button>
            <button
              onClick={() => handlePlay()}
              className={`h-8 w-10 rounded font-bold flex items-center justify-center transition shadow ${
                isPlaying ? "bg-[#3b82f6] text-white" : "bg-[#4a4d56] hover:bg-[#565964] text-white"
              }`}
              title="Play"
            >
              ▶
            </button>
            <button
              onClick={handleRecord}
              className={`h-8 w-8 rounded-full border border-red-950 flex items-center justify-center ml-1 ${
                isRecording ? "bg-red-500 animate-pulse text-white shadow-[0_0_12px_#ef4444]" : "bg-[#a82222] hover:bg-red-600"
              }`}
              title="Record"
            >
              <div className="h-3 w-3 rounded-full bg-white shadow-sm" />
            </button>
            <button
              onClick={() => setIsLooping(!isLooping)}
              className={`h-7 w-7 rounded flex items-center justify-center ml-1 ${
                isLooping ? "bg-amber-500/20 text-amber-300 border border-amber-500/50" : "text-zinc-400 hover:text-white"
              }`}
              title="Cycle Loop Range"
            >
              🔁
            </button>
          </div>

          {/* GarageBand LCD Center Display */}
          <div className="flex h-9 items-center divide-x divide-zinc-800 rounded-md border border-[#1b1c20] bg-[#141518] px-3 font-mono text-zinc-300 shadow-inner">
            <div className="pr-3 text-center">
              <span className="text-sm font-bold tracking-widest text-zinc-100">
                00{currentBar}.{currentBeat}
              </span>
              <p className="text-[7px] text-zinc-500 uppercase">Bar . Beat</p>
            </div>
            <div className="px-3 text-center">
              <input
                type="number"
                value={bpm}
                onChange={(e) => setBpm(Number(e.target.value) || 118)}
                className="w-8 bg-transparent text-xs font-bold text-zinc-100 focus:outline-none"
              />
              <p className="text-[7px] text-zinc-500 uppercase">Tempo</p>
            </div>
            <div className="pl-3 flex items-center gap-1">
              <select
                value={projectKey}
                onChange={(e) => setProjectKey(e.target.value)}
                className="bg-transparent text-xs font-bold text-sky-400 focus:outline-none cursor-pointer"
              >
                {KEYS.map((k) => <option key={k} value={k} className="bg-zinc-900 text-white">{k}</option>)}
              </select>
              <span className="text-xs font-bold text-zinc-400">{projectScale}</span>
            </div>
          </div>

          {/* Count-in Purple Button (1234) & Metronome */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCountInActive(!countInActive)}
              className={`h-7 px-2 rounded text-[11px] font-bold ${
                countInActive ? "bg-[#7c3aed] text-white shadow-[0_0_8px_#7c3aed]" : "bg-[#2d2f36] text-zinc-500"
              }`}
              title="Count-In (1234)"
            >
              1234
            </button>
            <button
              onClick={() => setMetronomeActive(!metronomeActive)}
              className={`h-7 w-7 rounded flex items-center justify-center text-xs ${
                metronomeActive ? "text-amber-400" : "text-zinc-500"
              }`}
              title="Metronome"
            >
              🔔
            </button>
          </div>
        </div>

        {/* Right: Master Output Volume Fader */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-400">🔈</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={masterVolume}
            onChange={(e) => setMasterVolume(Number(e.target.value))}
            className="w-24 accent-[#3572b0] h-1.5 bg-[#1e2025] rounded cursor-pointer"
          />
        </div>
      </header>

      {statusMsg && (
        <div className="bg-[#121319] py-1 text-center text-[11px] text-sky-300 border-b border-zinc-800">
          {statusMsg}
        </div>
      )}

      {/* 2. BODY (LEFT TOOLS MENU + CENTER TIMELINE) */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* Left Tools Menu Drawer */}
        {toolsDrawerOpen && (
          <aside className="w-52 flex-none border-r border-[#1e2026] bg-[#1d1f25] p-3 flex flex-col justify-between z-20">
            <div className="space-y-4">
              <span className="text-[10px] font-black uppercase tracking-wider text-zinc-400">Tools</span>

              <div className="space-y-1 text-xs">
                <button
                  onClick={() => setWindowState((w) => ({ ...w, trackModal: { ...w.trackModal, open: true } }))}
                  className="w-full text-left p-2 rounded hover:bg-[#282a32] flex items-center gap-2 font-semibold text-zinc-200"
                >
                  <span>+</span> New Track
                </button>
                <button
                  onClick={() => setWindowState((w) => ({ ...w, piano: { ...w.piano, open: true } }))}
                  className="w-full text-left p-2 rounded hover:bg-[#282a32] flex items-center gap-2 font-semibold text-zinc-200"
                >
                  <span>🎹</span> Piano Roll
                </button>
                <button
                  onClick={() => setWindowState((w) => ({ ...w, amp: { ...w.amp, open: true } }))}
                  className="w-full text-left p-2 rounded hover:bg-[#282a32] flex items-center gap-2 font-semibold text-zinc-200"
                >
                  <span>🎸</span> Amp & Pedals
                </button>
                <button
                  onClick={() => setWindowState((w) => ({ ...w, eq: { ...w.eq, open: true } }))}
                  className="w-full text-left p-2 rounded hover:bg-[#282a32] flex items-center gap-2 font-semibold text-zinc-200"
                >
                  <span>🎛️</span> Visual EQ
                </button>
                <button
                  onClick={() => setWindowState((w) => ({ ...w, ai: { ...w.ai, open: true } }))}
                  className="w-full text-left p-2 rounded hover:bg-[#282a32] flex items-center gap-2 font-semibold text-zinc-200"
                >
                  <span>✨</span> AI Coach
                </button>
              </div>

              {/* Clip Actions */}
              <div className="pt-2 border-t border-zinc-800 space-y-1">
                <span className="text-[9px] uppercase font-bold text-zinc-500">Edit Actions</span>
                <button
                  onClick={pasteClipAtPlayhead}
                  disabled={!copiedClip}
                  className="w-full text-left px-2 py-1 rounded text-[11px] text-zinc-300 hover:bg-[#282a32] disabled:opacity-40"
                >
                  📋 Paste Clip (Cmd+V)
                </button>
                <button
                  onClick={splitClipAtPlayhead}
                  className="w-full text-left px-2 py-1 rounded text-[11px] text-zinc-300 hover:bg-[#282a32]"
                >
                  ✂ Split at Playhead (Cmd+T)
                </button>
              </div>
            </div>

            <button
              onClick={() => setSmartControlsOpen(!smartControlsOpen)}
              className="text-[10px] text-zinc-400 hover:text-white py-1 border-t border-zinc-800 text-center"
            >
              {smartControlsOpen ? "Hide Controls ▼" : "Show Controls ▲"}
            </button>
          </aside>
        )}

        {/* Timeline Tracks Section */}
        <div className="flex-1 flex flex-col overflow-hidden bg-[#18191f]">
          
          {/* Timeline Grid (Headers + Lanes) */}
          <div className="flex-1 flex overflow-hidden">
            
            {/* Left Track Headers */}
            <div className="w-64 flex-none border-r border-[#1a1b20] bg-[#22242a] flex flex-col z-10 shadow-lg">
              <div className="h-7 border-b border-[#1a1b20] px-3 flex items-center justify-between font-bold text-zinc-400 text-[10px]">
                <span>TRACKS</span>
              </div>

              <div className="flex-1 overflow-y-auto divide-y divide-[#1b1c22]">
                {tracks.map((track) => (
                  <div
                    key={track.id}
                    onClick={() => setSelectedTrackId(track.id)}
                    className={`h-20 p-2 flex flex-col justify-between transition ${
                      selectedTrackId === track.id ? "bg-[#33363f]" : "bg-[#282a30] hover:bg-[#2d3038]"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <div className="h-6 w-6 rounded bg-[#3572b0] flex items-center justify-center text-xs text-white">
                          🎙️
                        </div>
                        <input
                          value={track.name}
                          onChange={(e) => setTracks((ts) => ts.map((t) => t.id === track.id ? { ...t, name: e.target.value } : t))}
                          className="w-28 bg-transparent text-xs font-bold text-white focus:outline-none rounded px-1"
                        />
                      </div>
                      <span className="text-[8px] uppercase font-mono text-zinc-500">{track.trackType}</span>
                    </div>

                    <div className="flex items-center justify-between text-[10px] pt-1">
                      <div className="flex items-center gap-1">
                        {track.category === "audio" && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setTracks((ts) => ts.map((t) => t.id === track.id ? { ...t, armed: !t.armed } : t));
                            }}
                            className={`h-4.5 w-4.5 rounded-full flex items-center justify-center font-bold text-[8px] ${
                              track.armed ? "bg-red-500 text-white animate-pulse" : "bg-[#3a3d46] text-red-400"
                            }`}
                            title="Record Arm"
                          >
                            ●
                          </button>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setTracks((ts) => ts.map((t) => t.id === track.id ? { ...t, mute: !t.mute } : t));
                          }}
                          className={`h-4.5 px-1.5 rounded text-[9px] font-bold ${track.mute ? "bg-blue-500 text-white" : "bg-[#3a3d46] text-zinc-400"}`}
                        >
                          M
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setTracks((ts) => ts.map((t) => t.id === track.id ? { ...t, solo: !t.solo } : t));
                          }}
                          className={`h-4.5 px-1.5 rounded text-[9px] font-bold ${track.solo ? "bg-amber-500 text-black" : "bg-[#3a3d46] text-zinc-400"}`}
                        >
                          S
                        </button>
                      </div>

                      <input
                        type="range"
                        min={0}
                        max={1}
                        step={0.05}
                        value={track.volume}
                        onChange={(e) => setTracks((ts) => ts.map((t) => t.id === track.id ? { ...t, volume: Number(e.target.value) } : t))}
                        className="w-16 accent-[#3572b0] h-1 bg-[#1a1b20] rounded cursor-pointer"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Scrollable Arranger Grid */}
            <div
              ref={timelineContainerRef}
              className="flex-1 overflow-x-auto overflow-y-hidden flex flex-col bg-[#14151a] relative select-none"
            >
              {/* Ruler */}
              <div
                onMouseDown={(e) => {
                  setIsScrubbing(true);
                  const rect = e.currentTarget.getBoundingClientRect();
                  const scrollLeft = timelineContainerRef.current?.scrollLeft || 0;
                  const newSec = Math.max(0, (e.clientX - rect.left + scrollLeft) / pixelsPerSecond);
                  setPlayheadSec(newSec);
                  playheadAnchor.current = newSec;
                }}
                style={{ width: "3200px" }}
                className="h-7 border-b border-[#1b1c22] bg-[#1a1c22] relative cursor-ew-resize flex-none"
              >
                {Array.from({ length: 64 }, (_, i) => (
                  <div
                    key={i}
                    style={{ left: `${(i * 4 * 60 * pixelsPerSecond) / bpm}px` }}
                    className="absolute flex items-center gap-2 text-zinc-500 top-1 text-[9px] font-mono pointer-events-none"
                  >
                    <span className="font-semibold text-zinc-400">{i + 1}</span>
                    <div className="h-3 w-[1px] bg-zinc-700" />
                  </div>
                ))}
              </div>

              {/* Arranger Track Lanes */}
              <div style={{ width: "3200px" }} className="flex-1 relative divide-y divide-[#1e2028]">
                {/* Gold Playhead Line */}
                <div
                  style={{ left: `${playheadSec * pixelsPerSecond}px` }}
                  className="absolute top-0 bottom-0 w-[2px] bg-[#d4af37] z-40 pointer-events-none shadow-[0_0_8px_#d4af37]"
                >
                  <div className="h-3 w-3 -ml-[5px] bg-[#d4af37] rotate-45 shadow-lg" />
                </div>

                {tracks.map((track) => (
                  <div
                    key={track.id}
                    onClick={() => setSelectedTrackId(track.id)}
                    className={`h-20 relative flex items-center transition ${
                      selectedTrackId === track.id ? "bg-[#1d1f27]" : "bg-[#14151a]"
                    }`}
                  >
                    {isRecording && track.armed && track.category === "audio" && (
                      <div
                        style={{
                          left: `${recStartTime.current * pixelsPerSecond}px`,
                          width: `${Math.max(20, (playheadSec - recStartTime.current) * pixelsPerSecond)}px`,
                        }}
                        className="absolute top-1 bottom-1 bg-[#3572b0]/80 border border-sky-400 rounded z-30 overflow-hidden"
                      >
                        <canvas ref={liveCanvasRef} width={400} height={70} className="h-full w-full opacity-90" />
                      </div>
                    )}

                    {track.regions.map((region) => (
                      <div
                        key={region.id}
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData("sourceTrackId", String(track.id));
                          e.dataTransfer.setData("regionId", region.id);
                        }}
                      >
                        <ClipRegion
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
                      </div>
                    ))}
                  </div>
                ))}
              </div>

            </div>
          </div>

          {/* 3. BOTTOM DOCK: RECORDING SETTINGS & HARDWARE CHANNEL STRIP (AS REQUESTED) */}
          {smartControlsOpen && (
            <div className="h-56 flex-none border-t border-[#1a1c22] bg-[#22242a] flex shadow-2xl z-20">
              
              {/* Left Column: Recording Settings (Focusrite Scarlett Solo setup) */}
              <div className="w-72 flex-none border-r border-[#1a1b22] p-4 flex flex-col justify-between bg-[#282a32]">
                <div className="space-y-3">
                  <span className="text-xs font-bold text-white uppercase tracking-wider block">
                    Recording Settings ({selectedTrack?.name})
                  </span>

                  {/* Input Selector Dropdown */}
                  <div>
                    <label className="text-[10px] text-zinc-400 block mb-1">Input Source</label>
                    <select
                      value={selectedTrack?.inputDevice ?? ""}
                      onChange={(e) => {
                        const dev = e.target.value;
                        setTracks((ts) => ts.map((t) => t.id === selectedTrackId ? { ...t, inputDevice: dev } : t));
                      }}
                      className="w-full bg-[#18191f] border border-zinc-700 text-xs text-white rounded p-1.5 focus:outline-none"
                    >
                      <option value="">1 (Scarlett Solo USB)</option>
                      {devices.map((d) => (
                        <option key={d.deviceId} value={d.deviceId}>{d.label}</option>
                      ))}
                    </select>
                  </div>

                  {/* Monitoring Toggle */}
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-xs text-zinc-300">Monitoring</span>
                    <button
                      onClick={() => {
                        const nextMon = !selectedTrack?.monitoring;
                        setTracks((ts) => ts.map((t) => t.id === selectedTrackId ? { ...t, monitoring: nextMon } : t));
                        inputManager.current.setMonitoring(engine.current.init(), nextMon);
                      }}
                      className={`px-3 py-1 rounded text-xs font-bold transition ${
                        selectedTrack?.monitoring ? "bg-sky-500 text-black" : "bg-zinc-800 text-zinc-400"
                      }`}
                    >
                      {selectedTrack?.monitoring ? "ON" : "OFF"}
                    </button>
                  </div>

                  {/* Noise Gate Slider */}
                  <div>
                    <div className="flex justify-between text-[10px] text-zinc-400 mb-1">
                      <span>Noise Gate</span>
                      <span>{Math.round((selectedTrack?.noiseGate ?? 0.2) * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.05}
                      value={selectedTrack?.noiseGate ?? 0.2}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setTracks((ts) => ts.map((t) => t.id === selectedTrackId ? { ...t, noiseGate: val } : t));
                      }}
                      className="w-full accent-[#3572b0] h-1 bg-zinc-800 rounded"
                    />
                  </div>
                </div>

                <span className="text-[9px] text-zinc-500">Inputs routing configured for USB Audio Interfaces</span>
              </div>

              {/* Right Column: Blue Skeuomorphic Hardware Console (Compressor, EQ, Sends) */}
              <div className="flex-1 bg-gradient-to-b from-[#244b78] via-[#1d3d63] to-[#142d4a] p-4 flex items-center justify-around border-l border-sky-950 shadow-inner">
                
                {/* Compressor Section */}
                <div className="flex flex-col items-center border-r border-sky-400/20 pr-8">
                  <span className="text-[10px] font-black tracking-wider text-sky-200 uppercase mb-2">COMPRESSOR</span>
                  <div className="flex items-center gap-3">
                    <div className="flex flex-col items-center">
                      <div className="h-14 w-14 rounded-full border-2 border-zinc-700 bg-gradient-to-b from-zinc-800 to-black shadow-lg flex items-center justify-center relative">
                        <div className="h-2 w-0.5 bg-cyan-400 absolute top-1 rounded" />
                        <div className="h-4 w-4 rounded-full bg-zinc-700" />
                      </div>
                      <span className="text-[9px] text-sky-200 mt-1 font-mono">AMOUNT</span>
                    </div>
                    {/* LED Ladder Meter */}
                    <div className="flex flex-col gap-1 p-1 bg-black/60 rounded border border-sky-900/40">
                      {[1, 2, 3, 4, 5, 6].map((i) => (
                        <div key={i} className={`h-1.5 w-1.5 rounded-full ${i > 4 ? "bg-amber-400" : "bg-emerald-400"}`} />
                      ))}
                    </div>
                  </div>
                </div>

                {/* 3-Band Channel EQ Section */}
                <div className="flex flex-col items-center border-r border-sky-400/20 px-8">
                  <span className="text-[10px] font-black tracking-wider text-sky-200 uppercase mb-2">EQUALIZER</span>
                  <div className="flex items-center gap-4">
                    {["LOW", "MID", "HIGH"].map((band) => (
                      <div key={band} className="flex flex-col items-center">
                        <div className="h-12 w-12 rounded-full border-2 border-zinc-700 bg-gradient-to-b from-zinc-800 to-black shadow flex items-center justify-center relative">
                          <div className="h-2 w-0.5 bg-white absolute top-1 rounded" />
                          <div className="h-3.5 w-3.5 rounded-full bg-zinc-700" />
                        </div>
                        <span className="text-[8px] text-sky-200 mt-1 font-bold">{band}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Sends Section: Ambience & Reverb */}
                <div className="flex flex-col items-center pl-8">
                  <span className="text-[10px] font-black tracking-wider text-sky-200 uppercase mb-2">SENDS</span>
                  <div className="flex items-center gap-4">
                    <div className="flex flex-col items-center">
                      <div className="h-12 w-12 rounded-full border-2 border-zinc-700 bg-gradient-to-b from-zinc-800 to-black shadow flex items-center justify-center relative">
                        <div className="h-2 w-0.5 bg-white absolute top-1 rounded" />
                        <div className="h-3.5 w-3.5 rounded-full bg-zinc-700" />
                      </div>
                      <span className="text-[8px] text-sky-200 mt-1 font-bold">AMBIENCE</span>
                    </div>
                    <div className="flex flex-col items-center">
                      <div className="h-12 w-12 rounded-full border-2 border-zinc-700 bg-gradient-to-b from-zinc-800 to-black shadow flex items-center justify-center relative">
                        <div className="h-2 w-0.5 bg-cyan-400 absolute top-1 rounded" />
                        <div className="h-3.5 w-3.5 rounded-full bg-zinc-700" />
                      </div>
                      <span className="text-[8px] text-sky-200 mt-1 font-bold">REVERB</span>
                    </div>
                  </div>
                </div>

              </div>

            </div>
          )}

        </div>
      </div>

      {/* 4. UNIVERSAL DRAGGABLE POP-UP WINDOWS */}
      
      {/* Draggable Piano Roll */}
      {windowState.piano.open && (
        <div
          style={{ left: `${windowState.piano.x}px`, top: `${windowState.piano.y}px` }}
          className="fixed z-50 w-[660px] h-[360px] rounded-xl border-2 border-[#1c1d22] bg-[#14151b] shadow-2xl flex flex-col overflow-hidden"
        >
          <div
            onMouseDown={(e) => startDragWindow("piano", e)}
            className="flex h-9 items-center justify-between border-b border-zinc-800 bg-[#282a32] px-4 cursor-grab active:cursor-grabbing"
          >
            <span className="text-xs font-bold text-white">🎹 Piano Roll Editor</span>
            <button onClick={() => setWindowState((w) => ({ ...w, piano: { ...w.piano, open: false } }))} className="text-zinc-400 hover:text-white text-xs">✕</button>
          </div>
          <div className="flex-1 overflow-hidden">
            <PianoRoll
              notes={currentNotes}
              instrumentName={selectedTrack?.instrument ?? "Grand Piano"}
              onPreviewNote={(p) => {
                const c = engine.current.init();
                const o = c.createOscillator(); const g = c.createGain();
                o.frequency.setValueAtTime(midiToFreq(p), c.currentTime);
                g.gain.setValueAtTime(0.4, c.currentTime);
                g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 1.2);
                o.connect(g); g.connect(c.destination);
                o.start(); o.stop(c.currentTime + 1.2);
              }}
              onAddNote={(note) => setTrackNotes((prev) => ({ ...prev, [selectedTrackId]: [...(prev[selectedTrackId] || []), note] }))}
              onDeleteNote={(nid) => setTrackNotes((prev) => ({ ...prev, [selectedTrackId]: (prev[selectedTrackId] || []).filter((n) => n.id !== nid) }))}
            />
          </div>
        </div>
      )}

      {/* Draggable Amp Rig */}
      {windowState.amp.open && (
        <div
          style={{ left: `${windowState.amp.x}px`, top: `${windowState.amp.y}px` }}
          className="fixed z-50 rounded-xl shadow-2xl overflow-hidden"
        >
          <div
            onMouseDown={(e) => startDragWindow("amp", e)}
            className="h-8 bg-[#282a32] flex items-center justify-between px-3 cursor-grab active:cursor-grabbing border-b border-zinc-800"
          >
            <span className="text-xs font-bold text-amber-400">🎸 Amp & Pedals</span>
            <button onClick={() => setWindowState((w) => ({ ...w, amp: { ...w.amp, open: false } }))} className="text-zinc-400 hover:text-white text-xs">✕</button>
          </div>
          <GuitarAmpModal isOpen={true} onClose={() => setWindowState((w) => ({ ...w, amp: { ...w.amp, open: false } }))} trackName={selectedTrack?.name ?? "Guitar"} />
        </div>
      )}

      {/* Draggable Visual EQ */}
      {windowState.eq.open && (
        <div
          style={{ left: `${windowState.eq.x}px`, top: `${windowState.eq.y}px` }}
          className="fixed z-50 rounded-xl shadow-2xl overflow-hidden"
        >
          <div
            onMouseDown={(e) => startDragWindow("eq", e)}
            className="h-8 bg-[#1a1c24] flex items-center justify-between px-3 cursor-grab active:cursor-grabbing border-b border-zinc-800"
          >
            <span className="text-xs font-bold text-sky-400">🎛️ Visual Channel EQ</span>
            <button onClick={() => setWindowState((w) => ({ ...w, eq: { ...w.eq, open: false } }))} className="text-zinc-400 hover:text-white text-xs">✕</button>
          </div>
          <ChannelEqModal isOpen={true} onClose={() => setWindowState((w) => ({ ...w, eq: { ...w.eq, open: false } }))} trackName={selectedTrack?.name ?? "Track"} />
        </div>
      )}

      {/* Draggable AI Coach */}
      {windowState.ai.open && (
        <div
          style={{ left: `${windowState.ai.x}px`, top: `${windowState.ai.y}px` }}
          className="fixed z-50 rounded-xl shadow-2xl overflow-hidden"
        >
          <div
            onMouseDown={(e) => startDragWindow("ai", e)}
            className="h-8 bg-[#21232d] flex items-center justify-between px-3 cursor-grab active:cursor-grabbing border-b border-zinc-800"
          >
            <span className="text-xs font-bold text-purple-300">✨ AI Studio Coach</span>
            <button onClick={() => setWindowState((w) => ({ ...w, ai: { ...w.ai, open: false } }))} className="text-zinc-400 hover:text-white text-xs">✕</button>
          </div>
          <AiCoachModal isOpen={true} onClose={() => setWindowState((w) => ({ ...w, ai: { ...w.ai, open: false } }))} currentKey={projectKey} bpm={bpm} />
        </div>
      )}

      {/* Draggable New Track Modal */}
      {windowState.trackModal.open && (
        <div
          style={{ left: `${windowState.trackModal.x}px`, top: `${windowState.trackModal.y}px` }}
          className="fixed z-50 w-96 rounded-xl border border-zinc-700 bg-[#22242a] p-4 shadow-2xl"
        >
          <div
            onMouseDown={(e) => startDragWindow("trackModal", e)}
            className="flex items-center justify-between pb-2 border-b border-zinc-800 cursor-grab active:cursor-grabbing mb-3"
          >
            <span className="text-xs font-bold text-white">Add New Track</span>
            <button onClick={() => setWindowState((w) => ({ ...w, trackModal: { ...w.trackModal, open: false } }))} className="text-zinc-400 hover:text-white text-xs">✕</button>
          </div>
          <div className="space-y-1.5">
            {INSTRUMENT_LIBRARY.map((item) => (
              <button
                key={item.name}
                onClick={() => {
                  const id = Date.now();
                  setTracks((prev) => [
                    ...prev,
                    {
                      id,
                      name: `${item.name.split(" ")[0]} ${prev.length + 1}`,
                      category: item.category,
                      trackType: item.trackType,
                      instrument: item.name,
                      color: item.color,
                      volume: 0.8,
                      pan: 0,
                      mute: false,
                      solo: false,
                      armed: false,
                      monitoring: false,
                      noiseGate: 0.2,
                      compressor: 0.5,
                      lowCut: true,
                      reverbSend: 0.25,
                      regions: [],
                    },
                  ]);
                  setSelectedTrackId(id);
                  setWindowState((w) => ({ ...w, trackModal: { ...w.trackModal, open: false } }));
                }}
                className="w-full text-left p-2 rounded bg-[#18191f] hover:bg-[#2c2e37] border border-zinc-800 flex items-center gap-2.5 text-xs text-white"
              >
                <span>{item.icon}</span>
                <span className="font-semibold">{item.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
