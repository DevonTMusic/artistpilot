// components/Studio.tsx
"use client";
import React, { useEffect, useRef, useState, useCallback } from "react";
import { AudioEngine } from "@/lib/AudioEngine";
import { TrackData, AudioRegion } from "@/lib/AudioEngine";
import { ClipRegion } from "@/components/daw/ClipRegion";
import { PianoRoll, MidiNote } from "@/components/daw/PianoRoll";
import { GuitarAmpModal } from "@/components/daw/GuitarAmpModal";
import { AiCoachModal } from "@/components/daw/AiCoachModal";
import { ChannelEqModal } from "@/components/daw/ChannelEqModal";
import { AudioDeviceManager } from "@/lib/daw/AudioDeviceManager";
import { AudioSettingsModal } from "@/components/daw/AudioSettingsModal";
import { TrackControlsPanel } from "@/components/daw/TrackControlsPanel";
import { ProcessingSettings, DEFAULT_TRACK_SETTINGS } from "@/lib/daw/TrackProcessor";
import { saveSessionFile, openSessionFile, sourceBlobs } from "@/lib/daw/sessionFile";
import { PianoStudioModal } from "@/components/daw/PianoStudioModal";

export type TrackCompatibilityType = "vocal" | "guitar-bass" | "midi" | "drum";

interface ExtendedTrackData extends TrackData {
  trackType: TrackCompatibilityType;
  inputDevice?: string;
  monitoring?: boolean;
  settings: ProcessingSettings;
}

const INSTRUMENT_LIBRARY: { name: string; category: "audio" | "midi" | "drum"; trackType: TrackCompatibilityType; color: string; icon: string; desc: string }[] = [
  { name: "Audio Track (Vocals)", category: "audio", trackType: "vocal", color: "bg-[#2563eb]", icon: "🎙️", desc: "Studio vocal chain & live hardware" },
  { name: "Electric Guitar", category: "audio", trackType: "guitar-bass", color: "bg-[#d97706]", icon: "🎸", desc: "Instrument direct input / Amp modeling" },
  { name: "Classic Bass", category: "audio", trackType: "guitar-bass", color: "bg-[#7c3aed]", icon: "🎸", desc: "Direct instrument bass input" },
  { name: "Grand Piano", category: "midi", trackType: "midi", color: "bg-[#059669]", icon: "🎹", desc: "MIDI-only software instrument" },
  { name: "Analog Synth", category: "midi", trackType: "midi", color: "bg-[#0284c7]", icon: "🎛️", desc: "Polyphonic MIDI synthesizer" },
  { name: "Drum Machine", category: "drum", trackType: "drum", color: "bg-[#dc2626]", icon: "🥁", desc: "16-step drum pattern trigger" },
];

const KEYS = ["C", "D♭", "D", "E♭", "E", "F", "F#", "G", "A♭", "A", "B♭", "B"];

export default function Studio({ defaultBpm = 118 }: { defaultBpm?: number }) {
  const engine = useRef<AudioEngine>(AudioEngine.getInstance());
  const deviceManager = useRef<AudioDeviceManager>(AudioDeviceManager.getInstance());

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
      settings: { ...DEFAULT_TRACK_SETTINGS },
      regions: [],
    },
    {
      id: 2,
      name: "Grand Piano",
      category: "midi",
      trackType: "midi",
      instrument: "Grand Piano",
      color: "bg-[#059669]",
      volume: 0.8,
      pan: 0,
      mute: false,
      solo: false,
      armed: false,
      monitoring: false,
      settings: { ...DEFAULT_TRACK_SETTINGS },
      regions: [],
    },
  ]);

  const [masterSettings, setMasterSettings] = useState<ProcessingSettings>({
    ...DEFAULT_TRACK_SETTINGS,
    compAmount: 0.3,
  });

  const [isMasterMode, setIsMasterMode] = useState(false);
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

  // Loop & Scrubbing
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [isLooping, setIsLooping] = useState(false);
  const [loopStartSec, setLoopStartSec] = useState(0);
  const [loopEndSec, setLoopEndSec] = useState(8);
  const [draggingLoopEdge, setDraggingLoopEdge] = useState<"start" | "end" | null>(null);

  const [countInActive, setCountInActive] = useState(true);
  const [metronomeActive, setMetronomeActive] = useState(false);

  // Hardware Interface
  const [activeInputLabel, setActiveInputLabel] = useState<string>("AirPods (Bluetooth)");
  const [activeInputId, setActiveInputId] = useState<string>("default");
  const [monitoringEnabled, setMonitoringEnabled] = useState(false);
  const [devices, setDevices] = useState<any[]>([]);
  const [copiedClip, setCopiedClip] = useState<AudioRegion | null>(null);

  // Drawers & Modals
  const [toolsDrawerOpen, setToolsDrawerOpen] = useState(true);
  const [smartControlsOpen, setSmartControlsOpen] = useState(true);
  const [audioSettingsOpen, setAudioSettingsOpen] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");

  const [windowState, setWindowState] = useState({
    piano: { open: false, x: 260, y: 120 },
    amp: { open: false, x: 300, y: 100 },
    eq: { open: false, x: 340, y: 140 },
    ai: { open: false, x: 380, y: 120 },
    trackModal: { open: false, x: 320, y: 120 },
  });

  // CLEAN EMPTY MIDI NOTE STATE (No green dummy numbers!)
  const [trackNotes, setTrackNotes] = useState<Record<number, MidiNote[]>>({
    2: [],
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
  const lastMetronomeBeat = useRef<number>(-1);

  const triggerMetronomeClick = useCallback((isDownbeat: boolean) => {
    try {
      const c = engine.current.init();
      if (c.state === "suspended") c.resume();
      const osc = c.createOscillator();
      const gain = c.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(isDownbeat ? 1600 : 850, c.currentTime);
      gain.gain.setValueAtTime(0.4, c.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.05);

      osc.connect(gain);
      gain.connect(c.destination);
      osc.start(c.currentTime);
      osc.stop(c.currentTime + 0.055);
    } catch {}
  }, []);

  const toggleModal = (key: keyof typeof windowState) => {
    setWindowState((prev) => ({
      ...prev,
      [key]: { ...prev[key], open: !prev[key].open },
    }));
  };

  useEffect(() => {
    deviceManager.current.refreshDevices().then(({ inputs }) => {
      setDevices(inputs);
      if (inputs.length > 0) {
        setActiveInputLabel(inputs[0].label);
        setActiveInputId(inputs[0].deviceId);
      }
    });
  }, []);

  // Playhead & Loop Range Dragging Listeners
  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!timelineContainerRef.current) return;
      const rect = timelineContainerRef.current.getBoundingClientRect();
      const scrollLeft = timelineContainerRef.current.scrollLeft || 0;
      const currentMouseSec = Math.max(0, (e.clientX - rect.left + scrollLeft) / pixelsPerSecond);

      if (isScrubbing) {
        setPlayheadSec(currentMouseSec);
        playheadAnchor.current = currentMouseSec;
      } else if (draggingLoopEdge === "start") {
        setLoopStartSec(Math.min(currentMouseSec, loopEndSec - 0.5));
      } else if (draggingLoopEdge === "end") {
        setLoopEndSec(Math.max(currentMouseSec, loopStartSec + 0.5));
      }
    };

    const onMouseUp = () => {
      setIsScrubbing(false);
      setDraggingLoopEdge(null);
    };

    if (isScrubbing || draggingLoopEdge) {
      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", onMouseUp);
    }
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [isScrubbing, draggingLoopEdge, pixelsPerSecond, loopStartSec, loopEndSec]);

  // Master Clock & Active Loop Watcher
  const updatePlaybackPosition = () => {
    const elapsed = (performance.now() - playStartTime.current) / 1000;
    let currentSec = playheadAnchor.current + elapsed;

    if (isLooping && currentSec >= loopEndSec) {
      currentSec = loopStartSec;
      playStartTime.current = performance.now();
      playheadAnchor.current = loopStartSec;
      engine.current.schedulePlayback(tracks, loopStartSec);
    }

    if (metronomeActive) {
      const beatIdx = Math.floor((currentSec * bpm) / 60);
      if (beatIdx !== lastMetronomeBeat.current) {
        lastMetronomeBeat.current = beatIdx;
        triggerMetronomeClick(beatIdx % 4 === 0);
      }
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
      const pos = startAt !== undefined ? startAt : (isLooping && playheadSec >= loopEndSec ? loopStartSec : playheadSec);
      playStartTime.current = performance.now();
      playheadAnchor.current = pos;
      lastMetronomeBeat.current = -1;
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

  // Live Oscilloscope Waveform while Recording
  const startLiveWaveform = (analyser: AnalyserNode) => {
    const cv = liveCanvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;

    const dataArray = new Uint8Array(analyser.frequencyBinCount);

    const draw = () => {
      liveAnimRef.current = requestAnimationFrame(draw);
      analyser.getByteTimeDomainData(dataArray);

      ctx.clearRect(0, 0, cv.width, cv.height);
      ctx.lineWidth = 2;
      ctx.strokeStyle = "#38bdf8"; // Bright sky blue wave
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
      setStatusMsg("Arm an audio track (●) to record.");
      return;
    }

    try {
      const ctx = engine.current.init();
      if (ctx.state === "suspended") await ctx.resume();

      const currentTrack = tracks.find((t) => t.id === selectedTrackId);
      const { stream, analyser } = await deviceManager.current.setupInputStream(
        ctx,
        currentTrack?.inputDevice || activeInputId,
        currentTrack?.monitoring ?? monitoringEnabled
      );

      if (countInActive) {
        handleStop();
        const beatMs = (60 / bpm) * 1000;
        for (let i = 0; i < 4; i++) {
          setStatusMsg(`Count-In: ${i + 1} ...`);
          triggerMetronomeClick(i === 0);
          await new Promise((res) => setTimeout(res, beatMs));
        }
      }

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
            sourceBlobs.set(buffer, blob);
            const newRegion: AudioRegion = {
              id: `rec-${track.id}-${Date.now()}`,
              name: `Recording`,
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
      if (!isPlaying) handlePlay();
      startLiveWaveform(analyser);
      setStatusMsg("Recording live audio...");
    } catch {
      setStatusMsg("Microphone / Audio interface access denied.");
    }
  };

  const deleteTrack = (id: number) => {
    if (tracks.length <= 1) return;
    setTracks((prev) => prev.filter((t) => t.id !== id));
  };

  const selectedTrack = tracks.find((t) => t.id === selectedTrackId);
  const totalBeats = (playheadSec * bpm) / 60;
  const currentBar = Math.floor(totalBeats / 4) + 1;
  const currentBeat = (Math.floor(totalBeats) % 4) + 1;

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-[#24252a] text-[#c5c7d0] font-sans select-none">
      
      {/* 1. TOP TRANSPORT BAR */}
      <header className="flex h-12 flex-none items-center justify-between border-b border-[#1b1c20] bg-[#3a3c44] px-4 shadow-md z-30">
        
        {/* Left: Window Dots & Tools Drawer */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <div className="h-3 w-3 rounded-full bg-[#ff5f56]" />
            <div className="h-3 w-3 rounded-full bg-[#ffbd2e]" />
            <div className="h-3 w-3 rounded-full bg-[#27c93f]" />
          </div>

          <button
            onClick={() => setToolsDrawerOpen(!toolsDrawerOpen)}
            className={`flex h-7 items-center gap-1.5 rounded px-2 text-xs font-semibold border ${
              toolsDrawerOpen ? "bg-[#4a4d56] border-zinc-600 text-white" : "bg-[#33353c] border-zinc-700 text-zinc-400"
            }`}
          >
            <span>📁</span> Tools
          </button>

          <button
            onClick={() => setAudioSettingsOpen(!audioSettingsOpen)}
            className="flex items-center gap-1.5 rounded-full border border-zinc-600 bg-zinc-900 px-2.5 py-1 text-[11px] text-zinc-300"
          >
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            <span className="font-medium truncate max-w-[140px]">{activeInputLabel}</span>
          </button>
        </div>

        {/* Center: Transport + Interactive LCD */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 text-zinc-300">
            <button onClick={() => { handleStop(); setPlayheadSec(0); }} className="h-7 w-7 rounded flex items-center justify-center hover:bg-zinc-700/60" title="Rewind">◀◀</button>
            <button onClick={() => setPlayheadSec(playheadSec + (60 / bpm) * 4)} className="h-7 w-7 rounded flex items-center justify-center hover:bg-zinc-700/60" title="Forward">▶▶</button>
            <button onClick={handleStop} className="h-7 w-7 rounded flex items-center justify-center hover:bg-zinc-700/60" title="Stop">◼</button>
            <button onClick={() => handlePlay()} className={`h-8 w-10 rounded font-bold flex items-center justify-center shadow ${isPlaying ? "bg-[#3b82f6] text-white" : "bg-[#4a4d56] text-white"}`} title="Play">▶</button>
            <button onClick={handleRecord} className={`h-8 w-8 rounded-full border border-red-950 flex items-center justify-center ml-1 ${isRecording ? "bg-red-500 animate-pulse text-white shadow-[0_0_12px_#ef4444]" : "bg-[#a82222] hover:bg-red-600"}`} title="Record">
              <div className="h-3 w-3 rounded-full bg-white shadow-sm" />
            </button>
            
            {/* Cycle / Loop button */}
            <button
              onClick={() => setIsLooping(!isLooping)}
              className={`h-7 px-2.5 rounded flex items-center gap-1 text-xs font-bold transition ml-1 ${
                isLooping ? "bg-amber-500/25 text-amber-300 border border-amber-500/60 shadow-sm" : "text-zinc-400 hover:text-white"
              }`}
            >
              🔁 <span>Loop</span>
            </button>
          </div>

          {/* Interactive LCD Box: Fully Clickable Key & Scale Selectors */}
          <div className="flex h-9 items-center divide-x divide-zinc-800 rounded-md border border-[#1b1c20] bg-[#141518] px-3 font-mono text-zinc-300 shadow-inner">
            <div className="pr-3 text-center">
              <span className="text-sm font-bold text-zinc-100">00{currentBar}.{currentBeat}</span>
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

            {/* Real Interactive Key & Scale Menus */}
            <div className="pl-3 flex items-center gap-1">
              <select
                value={projectKey}
                onChange={(e) => setProjectKey(e.target.value)}
                className="bg-transparent text-xs font-bold text-sky-400 focus:outline-none cursor-pointer"
              >
                {KEYS.map((k) => (
                  <option key={k} value={k} className="bg-zinc-900 text-white">{k}</option>
                ))}
              </select>
              
              <button
                onClick={() => setProjectScale(projectScale === "maj" ? "min" : "maj")}
                className="text-xs font-bold text-zinc-300 hover:text-[#d4af37]"
                title="Toggle Major / Minor"
              >
                {projectScale}
              </button>
            </div>
          </div>

          <button onClick={() => setCountInActive(!countInActive)} className={`h-7 px-2.5 rounded text-[11px] font-bold ${countInActive ? "bg-[#7c3aed] text-white shadow-[0_0_8px_#7c3aed]" : "bg-[#2d2f36] text-zinc-500"}`}>1234</button>
          <button onClick={() => setMetronomeActive(!metronomeActive)} className={`h-7 px-2 rounded border text-xs font-bold ${metronomeActive ? "border-amber-400 bg-amber-400/20 text-amber-300" : "border-zinc-700 bg-[#2d2f36] text-zinc-500"}`}>🔔</button>
        </div>

        {/* Right Master Volume & Export */}
        <div className="flex items-center gap-3">
          <input type="range" min={0} max={1} step={0.05} value={masterVolume} onChange={(e) => setMasterVolume(Number(e.target.value))} className="w-20 accent-[#3572b0] h-1.5 bg-[#1e2025] rounded cursor-pointer" />
          <button onClick={() => setStatusMsg("Exporting master mixdown...")} className="h-7 rounded border border-[#d4af37]/50 bg-gradient-to-r from-[#d4af37] to-[#b38f28] px-3 text-[11px] font-bold text-black shadow">Export</button>
        </div>
      </header>

      {statusMsg && <div className="bg-[#121319] py-1 text-center text-[11px] text-sky-300 border-b border-zinc-800">{statusMsg}</div>}

      {/* 2. BODY */}
      <div className="flex-1 flex overflow-hidden">
        {toolsDrawerOpen && (
          <aside className="w-52 flex-none border-r border-[#1e2026] bg-[#1d1f25] p-3 flex flex-col justify-between z-20">
            <div className="space-y-3">
              <span className="text-[10px] font-black uppercase tracking-wider text-zinc-400">Tools</span>
              <button onClick={() => toggleModal("trackModal")} className="w-full text-left p-2 rounded hover:bg-[#282a32] flex items-center gap-2 font-semibold text-xs text-zinc-200"><span>+</span> New Track</button>
              <button onClick={() => toggleModal("piano")} className="w-full text-left p-2 rounded hover:bg-[#282a32] flex items-center gap-2 font-semibold text-xs text-emerald-400"><span>🎹</span> 88-Key Piano Studio</button>
              <button onClick={() => toggleModal("amp")} className="w-full text-left p-2 rounded hover:bg-[#282a32] flex items-center gap-2 font-semibold text-xs text-zinc-200"><span>🎸</span> Amp & Pedals</button>
              <button onClick={() => toggleModal("eq")} className="w-full text-left p-2 rounded hover:bg-[#282a32] flex items-center gap-2 font-semibold text-xs text-zinc-200"><span>🎛️</span> Visual EQ</button>
              <button onClick={() => toggleModal("ai")} className="w-full text-left p-2 rounded hover:bg-[#282a32] flex items-center gap-2 font-semibold text-xs text-zinc-200"><span>✨</span> AI Coach</button>
            </div>
            <button onClick={() => setSmartControlsOpen(!smartControlsOpen)} className="text-[10px] text-zinc-400 hover:text-white py-1 border-t border-zinc-800 text-center">{smartControlsOpen ? "Hide Controls ▼" : "Show Controls ▲"}</button>
          </aside>
        )}

        <div className="flex-1 flex flex-col overflow-hidden bg-[#18191f]">
          <div className="flex-1 flex overflow-hidden">
            {/* Headers */}
            <div className="w-64 flex-none border-r border-[#1a1b20] bg-[#22242a] flex flex-col z-10 shadow-lg">
              <div className="h-7 border-b border-[#1a1b20] px-3 flex items-center justify-between font-bold text-zinc-400 text-[10px]"><span>TRACKS</span></div>
              <div className="flex-1 overflow-y-auto divide-y divide-[#1b1c22]">
                {tracks.map((track) => (
                  <div key={track.id} onClick={() => { setSelectedTrackId(track.id); setIsMasterMode(false); }} className={`h-24 p-2 flex flex-col justify-between ${selectedTrackId === track.id && !isMasterMode ? "bg-[#33363f]" : "bg-[#282a30]"}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5"><span className="text-xs">{track.category === "midi" ? "🎹" : "🎙️"}</span><input value={track.name} onChange={(e) => setTracks((ts) => ts.map((t) => t.id === track.id ? { ...t, name: e.target.value } : t))} className="w-24 bg-transparent text-xs font-bold text-white focus:outline-none rounded px-1" /></div>
                      <button onClick={(e) => { e.stopPropagation(); deleteTrack(track.id); }} className="text-zinc-400 hover:text-red-400 text-xs px-1 font-bold">✕</button>
                    </div>
                    <div className="flex items-center justify-between text-[10px]">
                      <div className="flex items-center gap-1">
                        {track.category === "audio" && (
                          <button onClick={(e) => { e.stopPropagation(); setTracks((ts) => ts.map((t) => t.id === track.id ? { ...t, armed: !t.armed } : t)); }} className={`h-4.5 w-4.5 rounded-full flex items-center justify-center font-bold text-[8px] ${track.armed ? "bg-red-500 text-white" : "bg-[#3a3d46] text-red-400"}`}>●</button>
                        )}
                        <button onClick={(e) => { e.stopPropagation(); setTracks((ts) => ts.map((t) => t.id === track.id ? { ...t, mute: !t.mute } : t)); }} className={`px-1.5 py-0.5 rounded ${track.mute ? "bg-blue-500 text-white" : "bg-[#1c1e26] text-zinc-400"}`}>M</button>
                      </div>
                      <input type="range" min={0} max={1} step={0.05} value={track.volume} onChange={(e) => setTracks((ts) => ts.map((t) => t.id === track.id ? { ...t, volume: Number(e.target.value) } : t))} className="w-20 accent-[#3572b0] h-1 bg-[#1a1b20] rounded" />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Timeline Lanes: Scrubbing + Draggable Yellow Loop Region */}
            <div ref={timelineContainerRef} className="flex-1 overflow-x-auto overflow-y-hidden flex flex-col bg-[#14151a] relative select-none">
              
              {/* Musical Ruler */}
              <div
                onMouseDown={(e) => {
                  const target = e.target as HTMLElement;
                  if (target.dataset.loopHandle) return; // Don't scrub if grabbing loop handles
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
                {/* Yellow Draggable Loop Range with Drag Brackets */}
                {isLooping && (
                  <div
                    style={{
                      left: `${loopStartSec * pixelsPerSecond}px`,
                      width: `${Math.max(20, (loopEndSec - loopStartSec) * pixelsPerSecond)}px`,
                    }}
                    className="absolute top-0 bottom-0 bg-amber-400/35 border-y-2 border-amber-400 z-20 flex items-center justify-between"
                  >
                    {/* Left Loop Handle */}
                    <div
                      data-loop-handle="start"
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        setDraggingLoopEdge("start");
                      }}
                      className="w-2 h-full bg-amber-400 cursor-ew-resize hover:brightness-125"
                      title="Drag to change Loop Start"
                    />
                    
                    <span className="text-[8px] font-black text-amber-200 pointer-events-none select-none">
                      LOOP ({(loopEndSec - loopStartSec).toFixed(1)}s)
                    </span>

                    {/* Right Loop Handle */}
                    <div
                      data-loop-handle="end"
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        setDraggingLoopEdge("end");
                      }}
                      className="w-2 h-full bg-amber-400 cursor-ew-resize hover:brightness-125"
                      title="Drag to change Loop End"
                    />
                  </div>
                )}

                {Array.from({ length: 64 }, (_, i) => (
                  <div key={i} style={{ left: `${(i * 4 * 60 * pixelsPerSecond) / bpm}px` }} className="absolute flex items-center gap-2 text-zinc-500 top-1 text-[9px] font-mono pointer-events-none">
                    <span>{i + 1}</span>
                    <div className="h-3 w-[1px] bg-zinc-700" />
                  </div>
                ))}
              </div>

              {/* Arranger Lanes */}
              <div style={{ width: "3200px" }} className="flex-1 relative divide-y divide-[#1e2028]">
                
                {/* Gold Playhead Line */}
                <div
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    setIsScrubbing(true);
                  }}
                  style={{ left: `${playheadSec * pixelsPerSecond}px` }}
                  className="absolute top-0 bottom-0 w-[2px] bg-[#d4af37] z-40 cursor-ew-resize shadow-[0_0_8px_#d4af37]"
                >
                  <div className="h-4 w-4 -ml-[7px] bg-[#d4af37] rotate-45 shadow-lg" />
                </div>

                {tracks.map((track) => (
                  <div key={track.id} onClick={() => setSelectedTrackId(track.id)} className={`h-24 relative flex items-center ${selectedTrackId === track.id ? "bg-[#1d1f27]" : "bg-[#14151a]"}`}>
                    
                    {/* Live Recording Oscilloscope Waveform Box */}
                    {isRecording && track.armed && track.category === "audio" && (
                      <div
                        style={{
                          left: `${recStartTime.current * pixelsPerSecond}px`,
                          width: `${Math.max(30, (playheadSec - recStartTime.current) * pixelsPerSecond)}px`,
                        }}
                        className="absolute top-1 bottom-1 bg-sky-950/80 border border-sky-400 rounded z-30 overflow-hidden flex items-center"
                      >
                        <canvas ref={liveCanvasRef} width={400} height={70} className="h-full w-full" />
                      </div>
                    )}

                    {/* MIDI Track Lane (Clean empty state) */}
                    {track.category === "midi" ? (
                      <div className="h-full w-full relative flex items-center pl-3 text-xs text-zinc-600">
                        {trackNotes[track.id]?.length === 0 ? (
                          <span className="italic">Empty MIDI lane — click Piano Studio in Tools to play</span>
                        ) : (
                          trackNotes[track.id]?.map((note) => (
                            <div
                              key={note.id}
                              style={{
                                left: `${note.startStep * 20}px`,
                                width: `${note.length * 20}px`,
                                top: `${Math.max(4, Math.min(65, (72 - note.pitch) * 3))}px`,
                              }}
                              className="absolute h-4 rounded bg-[#059669] border border-emerald-300 shadow"
                            />
                          ))
                        )}
                      </div>
                    ) : (
                      track.regions.map((region) => (
                        <ClipRegion key={region.id} region={region as any} pixelsPerSecond={pixelsPerSecond} trackColor={track.color} trackId={track.id} onCopy={(reg) => setCopiedClip(reg)} onUpdate={() => {}} onSplit={() => {}} onDelete={() => {}} />
                      ))
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 3. WORKING ROTARY DYNAMICS & EQ CONSOLE */}
          {smartControlsOpen && (
            <TrackControlsPanel
              trackName={selectedTrack?.name ?? "Track"}
              isMasterMode={isMasterMode}
              onToggleMasterMode={(isMaster) => setIsMasterMode(isMaster)}
              devices={devices}
              activeDeviceId={selectedTrack?.inputDevice || activeInputId}
              onSelectDevice={(devId) => setActiveInputId(devId)}
              isMonitoring={monitoringEnabled}
              onToggleMonitoring={() => setMonitoringEnabled(!monitoringEnabled)}
              currentSettings={selectedTrack?.settings ?? DEFAULT_TRACK_SETTINGS}
              onUpdateSettings={(updated) => {
                setTracks((ts) => ts.map((t) => t.id === selectedTrackId ? { ...t, settings: updated } : t));
              }}
              onOpenAdvancedEq={() => toggleModal("eq")}
              onClosePanel={() => setSmartControlsOpen(false)}
            />
          )}
        </div>
      </div>

      {/* MODALS */}
      <PianoStudioModal isOpen={windowState.piano.open} onClose={() => toggleModal("piano")} ctx={engine.current.init()} trackName={selectedTrack?.name ?? "Grand Piano"} />
      <AudioSettingsModal isOpen={audioSettingsOpen} onClose={() => setAudioSettingsOpen(false)} ctx={engine.current.ctx} activeInputDeviceName={activeInputLabel} onSelectInputDevice={(devId, label) => { setActiveInputId(devId); setActiveInputLabel(label); }} onSelectOutputDevice={() => {}} isMonitoring={monitoringEnabled} onToggleMonitoring={(en) => setMonitoringEnabled(en)} />
      <ChannelEqModal isOpen={windowState.eq.open} onClose={() => toggleModal("eq")} trackName={selectedTrack?.name ?? "Track"} />
      <GuitarAmpModal isOpen={windowState.amp.open} onClose={() => toggleModal("amp")} trackName={selectedTrack?.name ?? "Guitar Track"} />
      <AiCoachModal isOpen={windowState.ai.open} onClose={() => toggleModal("ai")} currentKey={projectKey} bpm={bpm} />
    </div>
  );
}
