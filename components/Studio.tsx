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
import { DiscoverTrackModal } from "@/components/daw/DiscoverTrackModal";
import { PlayIcon, PauseIcon, StopIcon, RewindIcon, LoopIcon } from "@/components/daw/StudioIcons";

export type TrackCompatibilityType = "vocal" | "guitar-bass" | "midi" | "drum";

interface ExtendedTrackData extends TrackData {
  trackType: TrackCompatibilityType;
  inputDevice?: string;
  monitoring?: boolean;
  settings: ProcessingSettings;
}

const KEYS = ["C", "D♭", "D", "E♭", "E", "F", "F#", "G", "A♭", "A", "B♭", "B"];

export default function Studio({ defaultBpm = 120 }: { defaultBpm?: number }) {
  const engine = useRef<AudioEngine>(AudioEngine.getInstance());
  const deviceManager = useRef<AudioDeviceManager>(AudioDeviceManager.getInstance());

  const [tracks, setTracks] = useState<ExtendedTrackData[]>([
    {
      id: 1,
      name: "Audio 1",
      category: "audio",
      trackType: "vocal",
      instrument: "Voice / Audio",
      color: "bg-[#e53e3e]",
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
      color: "bg-[#38a169]",
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
  const [projectName, setProjectName] = useState("New Project");
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
  const [activeInputLabel, setActiveInputLabel] = useState<string>("Scarlett Solo USB");
  const [activeInputId, setActiveInputId] = useState<string>("default");
  const [monitoringEnabled, setMonitoringEnabled] = useState(false);
  const [devices, setDevices] = useState<any[]>([]);
  const [copiedClip, setCopiedClip] = useState<AudioRegion | null>(null);

  // Modals & Panels
  const [smartControlsOpen, setSmartControlsOpen] = useState(true);
  const [audioSettingsOpen, setAudioSettingsOpen] = useState(false);
  const [discoverModalOpen, setDiscoverModalOpen] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");

  const [windowState, setWindowState] = useState({
    piano: { open: false, x: 260, y: 120 },
    amp: { open: false, x: 300, y: 100 },
    eq: { open: false, x: 340, y: 140 },
    ai: { open: false, x: 380, y: 120 },
  });

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

  // Scrubbing & Loop Range Listeners
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

  // Full Unrestricted Global Keybinds
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      if (activeEl && (activeEl.tagName === "INPUT" || activeEl.tagName === "TEXTAREA" || activeEl.tagName === "SELECT")) return;

      if (e.code === "Space") {
        e.preventDefault();
        if (isPlaying) handleStop();
        else handlePlay();
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        handleStop();
        setPlayheadSec(0);
        playheadAnchor.current = 0;
        return;
      }
      if ((e.key === "r" || e.key === "R") && !e.metaKey && !e.ctrlKey) {
        if (!windowState.piano.open) {
          e.preventDefault();
          handleRecord();
          return;
        }
      }
      if (e.key === "c" && !e.metaKey && !e.ctrlKey) {
        if (!windowState.piano.open) {
          e.preventDefault();
          setIsLooping((prev) => !prev);
          return;
        }
      }
      if (e.key === "Backspace" || e.key === "Delete") {
        e.preventDefault();
        const currTrack = tracks.find((t) => t.id === selectedTrackId);
        const clip = currTrack?.regions.find(
          (r) => playheadSec >= r.startTime && playheadSec <= r.startTime + r.duration
        );
        if (clip) {
          setTracks((prev) =>
            prev.map((t) =>
              t.id === selectedTrackId
                ? { ...t, regions: t.regions.filter((r) => r.id !== clip.id) }
                : t
            )
          );
          setStatusMsg(`Deleted "${clip.name}"`);
        }
        return;
      }
      if ((e.metaKey || e.ctrlKey) && (e.key === "c" || e.key === "C")) {
        const currTrack = tracks.find((t) => t.id === selectedTrackId);
        const clip = currTrack?.regions.find(
          (r) => playheadSec >= r.startTime && playheadSec <= r.startTime + r.duration
        );
        if (clip) {
          setCopiedClip(clip);
          setStatusMsg(`Copied "${clip.name}"`);
        }
        return;
      }
      if ((e.metaKey || e.ctrlKey) && (e.key === "v" || e.key === "V")) {
        if (copiedClip) {
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
        }
        return;
      }
      if ((e.metaKey || e.ctrlKey) && (e.key === "t" || e.key === "T")) {
        e.preventDefault();
        const currTrack = tracks.find((t) => t.id === selectedTrackId);
        const clip = currTrack?.regions.find(
          (r) => playheadSec > r.startTime && playheadSec < r.startTime + r.duration
        );
        if (clip) {
          const firstDuration = playheadSec - clip.startTime;
          const secondDuration = clip.duration - firstDuration;
          const r1 = { ...clip, duration: firstDuration };
          const r2 = {
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
        }
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isPlaying, windowState.piano.open, selectedTrackId, playheadSec, copiedClip, tracks]);

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
      ctx.strokeStyle = "#38bdf8";
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

  // Add Track from Discover Modal (Screenshot 2 functionality)
  const handleAddTrackType = (type: "vocal" | "guitar" | "bass" | "piano" | "drum") => {
    const id = Date.now();
    let name = "Audio Track";
    let category: "audio" | "midi" | "drum" = "audio";
    let trackType: TrackCompatibilityType = "vocal";
    let color = "bg-[#e53e3e]";

    if (type === "vocal") {
      name = `Voice ${tracks.length + 1}`;
      color = "bg-[#e53e3e]";
      trackType = "vocal";
    } else if (type === "piano") {
      name = `Piano ${tracks.length + 1}`;
      category = "midi";
      trackType = "midi";
      color = "bg-[#38a169]";
    } else if (type === "drum") {
      name = `Drums ${tracks.length + 1}`;
      category = "drum";
      trackType = "drum";
      color = "bg-[#d69e2e]";
    } else if (type === "guitar") {
      name = `Guitar ${tracks.length + 1}`;
      color = "bg-[#319795]";
      trackType = "guitar-bass";
    } else if (type === "bass") {
      name = `Bass ${tracks.length + 1}`;
      color = "bg-[#3182ce]";
      trackType = "guitar-bass";
    }

    setTracks((prev) => [
      ...prev,
      {
        id,
        name,
        category,
        trackType,
        instrument: name,
        color,
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
    setSelectedTrackId(id);
  };

  const selectedTrack = tracks.find((t) => t.id === selectedTrackId);
  const totalBeats = (playheadSec * bpm) / 60;
  const currentBar = Math.floor(totalBeats / 4) + 1;
  const currentBeat = (Math.floor(totalBeats) % 4) + 1;

  // Format time as BandLab mm:ss.ms (e.g. 00:00.0)
  const formatTimecode = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const secs = Math.floor(sec % 60);
    const ms = Math.floor((sec % 1) * 10);
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}.${ms}`;
  };

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-[#0c0d0f] text-[#c5c7d0] font-sans select-none">
      
      {/* 1. BANDLAB-STYLE MODERN TOP TRANSPORT BAR (Screenshot 1) */}
      <header className="flex h-13 flex-none items-center justify-between border-b border-[#1c1d22] bg-[#121316] px-4 shadow-md z-30">
        
        {/* Left: Brand / Project Name & Metronome */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setDiscoverModalOpen(true)}
            className="flex h-8 items-center gap-1.5 rounded-lg bg-[#24262e] border border-zinc-700/80 px-3 text-xs font-bold text-white hover:border-red-500 hover:text-white transition shadow-sm"
          >
            <span>+</span> Add Track
          </button>

          <input
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            className="w-36 bg-transparent text-xs font-bold text-white focus:outline-none rounded px-1.5 py-0.5 truncate"
          />

          <div className="h-4 w-[1px] bg-zinc-800" />

          {/* Metronome & Count-In Pill */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setMetronomeActive(!metronomeActive)}
              className={`h-7 px-2.5 rounded-lg text-xs font-bold transition flex items-center gap-1 ${
                metronomeActive ? "bg-amber-500/20 text-amber-300 border border-amber-500/60" : "bg-[#1c1d24] text-zinc-400 hover:text-white"
              }`}
              title="Metronome Click"
            >
              <span>🔔</span>
            </button>
            <button
              onClick={() => setCountInActive(!countInActive)}
              className={`h-7 px-2.5 rounded-lg text-[11px] font-bold transition ${
                countInActive ? "bg-purple-600 text-white shadow" : "bg-[#1c1d24] text-zinc-500"
              }`}
              title="4-Beat Count-In"
            >
              1234
            </button>
          </div>
        </div>

        {/* Center: BandLab Tempo, Time Signature, Key, Transport, Timecode */}
        <div className="flex items-center gap-3">
          {/* BPM Box */}
          <div className="flex items-center gap-1 bg-[#1a1b22] px-2.5 py-1 rounded-lg border border-zinc-800 text-xs">
            <input
              type="number"
              value={bpm}
              onChange={(e) => setBpm(Number(e.target.value) || 120)}
              className="w-8 bg-transparent text-xs font-bold text-white focus:outline-none"
            />
            <span className="text-[10px] text-zinc-500">bpm</span>
          </div>

          {/* 4 / 4 Time Signature */}
          <div className="bg-[#1a1b22] px-2 py-1 rounded-lg border border-zinc-800 text-xs font-bold text-zinc-300">
            4 / 4
          </div>

          {/* Key Pill (e.g. D♭ maj) */}
          <div className="flex items-center gap-1 bg-[#1a1b22] px-2.5 py-1 rounded-lg border border-zinc-800 text-xs">
            <select
              value={projectKey}
              onChange={(e) => setProjectKey(e.target.value)}
              className="bg-transparent text-xs font-bold text-white focus:outline-none cursor-pointer"
            >
              {KEYS.map((k) => (
                <option key={k} value={k} className="bg-zinc-900 text-white">{k}</option>
              ))}
            </select>
            <button
              onClick={() => setProjectScale(projectScale === "maj" ? "min" : "maj")}
              className="font-bold text-zinc-400 hover:text-white text-[11px]"
            >
              {projectScale}
            </button>
          </div>

          {/* Authentic Vector Transport Controls */}
          <div className="flex items-center gap-1 text-zinc-300 ml-2">
            <button
              onClick={() => handlePlay()}
              className={`h-8 w-10 rounded-lg font-bold flex items-center justify-center transition shadow ${
                isPlaying ? "bg-amber-500 text-black" : "bg-[#24262e] text-white hover:bg-zinc-700"
              }`}
              title="Play / Pause"
            >
              {isPlaying ? <PauseIcon className="w-3.5 h-3.5 fill-current" /> : <PlayIcon className="w-3.5 h-3.5 fill-current" />}
            </button>

            <button
              onClick={() => { handleStop(); setPlayheadSec(0); }}
              className="h-8 w-8 rounded-lg flex items-center justify-center bg-[#1a1b22] hover:bg-zinc-700 text-zinc-400 hover:text-white transition"
              title="Return to Start"
            >
              <RewindIcon className="w-3.5 h-3.5 fill-current" />
            </button>

            <button
              onClick={handleRecord}
              className={`h-8 w-8 rounded-full flex items-center justify-center ml-1 transition ${
                isRecording ? "bg-red-500 animate-pulse text-white shadow-[0_0_12px_#ef4444]" : "bg-[#e53e3e] hover:bg-red-600 text-white"
              }`}
              title="Record Armed Tracks"
            >
              <div className="h-3 w-3 rounded-full bg-white shadow-sm" />
            </button>

            <button
              onClick={() => setIsLooping(!isLooping)}
              className={`h-8 w-8 rounded-lg flex items-center justify-center ml-1 transition ${
                isLooping ? "bg-amber-500/25 text-amber-300 border border-amber-500/60" : "bg-[#1a1b22] text-zinc-400 hover:text-white"
              }`}
              title="Cycle Loop Range"
            >
              <LoopIcon className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Timecode Clock (e.g. 00:00.0) */}
          <div className="bg-[#1a1b22] px-3 py-1 rounded-lg border border-zinc-800 text-xs font-mono font-bold text-zinc-200">
            {formatTimecode(playheadSec)}
          </div>
        </div>

        {/* Right: Master Output Volume Fader with +0.0 dB readout & Export */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-400">🔈</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={masterVolume}
              onChange={(e) => setMasterVolume(Number(e.target.value))}
              className="w-20 accent-sky-400 h-1 bg-zinc-800 rounded cursor-pointer"
            />
            <span className="text-[10px] font-mono text-zinc-400">+0.0 dB</span>
          </div>

          <button
            onClick={() => setStatusMsg("Exporting master WAV mixdown...")}
            className="h-8 rounded-lg bg-gradient-to-r from-red-500 to-rose-600 px-3.5 text-xs font-bold text-white shadow hover:brightness-110 active:scale-95 transition"
          >
            Publish / Export
          </button>
        </div>
      </header>

      {statusMsg && (
        <div className="bg-[#161820] py-1 text-center text-[11px] text-sky-400 border-b border-zinc-800">
          {statusMsg}
        </div>
      )}

      {/* 2. BODY ARRANGEMENT VIEW */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* Track Headers (Left Column) */}
        <div className="w-64 flex-none border-r border-[#1a1b20] bg-[#121316] flex flex-col z-10 shadow-lg">
          <div className="h-7 border-b border-[#1a1b20] px-3 flex items-center justify-between font-bold text-zinc-400 text-[10px]">
            <span>TRACKS ({tracks.length})</span>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-[#171820]">
            {tracks.map((track) => (
              <div
                key={track.id}
                onClick={() => {
                  setSelectedTrackId(track.id);
                  setIsMasterMode(false);
                }}
                className={`h-20 p-2 flex flex-col justify-between transition ${
                  selectedTrackId === track.id && !isMasterMode ? "bg-[#1c1e26]" : "bg-[#121316] hover:bg-[#181920]"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`h-6 w-6 rounded-lg ${track.color} flex items-center justify-center text-xs text-white shadow`}>
                      {track.category === "midi" ? "🎹" : "🎙️"}
                    </div>
                    <input
                      value={track.name}
                      onChange={(e) => setTracks((ts) => ts.map((t) => t.id === track.id ? { ...t, name: e.target.value } : t))}
                      className="w-24 bg-transparent text-xs font-bold text-white focus:outline-none rounded px-1"
                    />
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteTrack(track.id);
                    }}
                    className="text-zinc-500 hover:text-red-400 text-xs px-1 font-bold"
                  >
                    ✕
                  </button>
                </div>

                <div className="flex items-center justify-between text-[10px]">
                  <div className="flex items-center gap-1">
                    {track.category === "audio" && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setTracks((ts) => ts.map((t) => t.id === track.id ? { ...t, armed: !t.armed } : t));
                        }}
                        className={`h-4.5 w-4.5 rounded-full flex items-center justify-center font-bold text-[8px] ${
                          track.armed ? "bg-red-500 text-white animate-pulse" : "bg-[#20222a] text-red-500"
                        }`}
                      >
                        ●
                      </button>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setTracks((ts) => ts.map((t) => t.id === track.id ? { ...t, mute: !t.mute } : t));
                      }}
                      className={`px-1.5 py-0.5 rounded ${track.mute ? "bg-blue-500 text-white" : "bg-[#1c1e26] text-zinc-400"}`}
                    >
                      M
                    </button>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={track.volume}
                    onChange={(e) => setTracks((ts) => ts.map((t) => t.id === track.id ? { ...t, volume: Number(e.target.value) } : t))}
                    className="w-20 accent-sky-400 h-1 bg-zinc-800 rounded"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Scrollable Timeline Grid */}
        <div
          ref={timelineContainerRef}
          className="flex-1 overflow-x-auto overflow-y-hidden flex flex-col bg-[#0c0d0f] relative select-none"
        >
          {/* Ruler */}
          <div
            onMouseDown={(e) => {
              const target = e.target as HTMLElement;
              if (target.dataset.loopHandle) return;
              setIsScrubbing(true);
              const rect = e.currentTarget.getBoundingClientRect();
              const scrollLeft = timelineContainerRef.current?.scrollLeft || 0;
              const newSec = Math.max(0, (e.clientX - rect.left + scrollLeft) / pixelsPerSecond);
              setPlayheadSec(newSec);
              playheadAnchor.current = newSec;
            }}
            style={{ width: "3200px" }}
            className="h-7 border-b border-[#1b1c22] bg-[#121316] relative cursor-ew-resize flex-none"
          >
            {/* Draggable Loop Range with Drag Brackets */}
            {isLooping && (
              <div
                style={{
                  left: `${loopStartSec * pixelsPerSecond}px`,
                  width: `${Math.max(20, (loopEndSec - loopStartSec) * pixelsPerSecond)}px`,
                }}
                className="absolute top-0 bottom-0 bg-red-500/25 border-y-2 border-red-500 z-20 flex items-center justify-between"
              >
                <div
                  data-loop-handle="start"
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    setDraggingLoopEdge("start");
                  }}
                  className="w-2 h-full bg-red-500 cursor-ew-resize hover:brightness-125"
                />
                <span className="text-[8px] font-black text-red-200 pointer-events-none select-none">
                  LOOP ({(loopEndSec - loopStartSec).toFixed(1)}s)
                </span>
                <div
                  data-loop-handle="end"
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    setDraggingLoopEdge("end");
                  }}
                  className="w-2 h-full bg-red-500 cursor-ew-resize hover:brightness-125"
                />
              </div>
            )}

            {Array.from({ length: 64 }, (_, i) => (
              <div key={i} style={{ left: `${(i * 4 * 60 * pixelsPerSecond) / bpm}px` }} className="absolute flex items-center gap-2 text-zinc-500 top-1 text-[9px] font-mono pointer-events-none">
                <span>{i + 1}</span>
                <div className="h-3 w-[1px] bg-zinc-800" />
              </div>
            ))}
          </div>

          {/* Arranger Track Lanes */}
          <div style={{ width: "3200px" }} className="flex-1 relative divide-y divide-[#171820]">
            
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
              <div
                key={track.id}
                onClick={() => setSelectedTrackId(track.id)}
                className={`h-20 relative flex items-center transition ${
                  selectedTrackId === track.id ? "bg-[#14151c]" : "bg-[#0c0d0f]"
                }`}
              >
                {/* Live Recording Oscilloscope Waveform */}
                {isRecording && track.armed && track.category === "audio" && (
                  <div
                    style={{
                      left: `${recStartTime.current * pixelsPerSecond}px`,
                      width: `${Math.max(30, (playheadSec - recStartTime.current) * pixelsPerSecond)}px`,
                    }}
                    className="absolute top-1 bottom-1 bg-red-950/80 border border-red-500 rounded z-30 overflow-hidden flex items-center"
                  >
                    <canvas ref={liveCanvasRef} width={400} height={70} className="h-full w-full" />
                  </div>
                )}

                {/* Empty Track Prompt (Screenshot 1: Drop a loop or an audio/MIDI file) */}
                {track.regions.length === 0 && (!isRecording || !track.armed) && (
                  <div className="w-full text-center text-xs text-zinc-600 italic select-none pointer-events-none">
                    Drop a loop or an audio/MIDI file
                  </div>
                )}

                {track.regions.map((region) => (
                  <ClipRegion
                    key={region.id}
                    region={region as any}
                    pixelsPerSecond={pixelsPerSecond}
                    trackColor={track.color}
                    trackId={track.id}
                    onCopy={(reg) => setCopiedClip(reg)}
                    onUpdate={() => {}}
                    onSplit={() => {}}
                    onDelete={() => {}}
                  />
                ))}
              </div>
            ))}
          </div>

        </div>
      </div>

      {/* 3. DOCKABLE BOTTOM BAR (BandLab Style Pill Dock) */}
      <footer className="h-10 flex-none border-t border-[#1c1d22] bg-[#121316] px-4 flex items-center justify-between z-20">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSmartControlsOpen(!smartControlsOpen)}
            className={`px-3 py-1 rounded-full text-xs font-semibold transition ${
              smartControlsOpen ? "bg-zinc-800 text-white" : "text-zinc-500 hover:text-white"
            }`}
          >
            🎛️ Controls
          </button>

          <button
            onClick={() => toggleModal("piano")}
            className="px-3 py-1 rounded-full text-xs font-semibold text-zinc-400 hover:text-white hover:bg-zinc-800/80 transition"
          >
            🎹 88-Key Piano
          </button>

          <button
            onClick={() => toggleModal("amp")}
            className="px-3 py-1 rounded-full text-xs font-semibold text-zinc-400 hover:text-white hover:bg-zinc-800/80 transition"
          >
            🎸 Guitar Rig
          </button>

          <button
            onClick={() => toggleModal("ai")}
            className="px-3 py-1 rounded-full text-xs font-semibold text-zinc-400 hover:text-white hover:bg-zinc-800/80 transition"
          >
            ✨ AI Assistant
          </button>

          <button
            onClick={() => setAudioSettingsOpen(true)}
            className="px-3 py-1 rounded-full text-xs font-semibold text-sky-400 hover:bg-zinc-800/80 transition"
          >
            🎙️ Audio Inputs ({activeInputLabel})
          </button>
        </div>

        <div className="text-[11px] font-mono text-zinc-500">
          ArtistPilot Pro Studio v2.0
        </div>
      </footer>

      {/* 4. BOTTOM SMART DYNAMICS & EQ CONSOLE (When Controls is open) */}
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

      {/* 5. ALL WORKING MODALS */}
      <DiscoverTrackModal
        isOpen={discoverModalOpen}
        onClose={() => setDiscoverModalOpen(false)}
        onSelectTrackType={handleAddTrackType}
        onOpenAiSongStarter={() => toggleModal("ai")}
      />

      <PianoStudioModal
        isOpen={windowState.piano.open}
        onClose={() => toggleModal("piano")}
        ctx={engine.current.init()}
        trackName={selectedTrack?.name ?? "Grand Piano"}
      />

      <AudioSettingsModal
        isOpen={audioSettingsOpen}
        onClose={() => setAudioSettingsOpen(false)}
        ctx={engine.current.ctx}
        activeInputDeviceName={activeInputLabel}
        onSelectInputDevice={(devId, label) => {
          setActiveInputId(devId);
          setActiveInputLabel(label);
        }}
        onSelectOutputDevice={() => {}}
        isMonitoring={monitoringEnabled}
        onToggleMonitoring={(en) => setMonitoringEnabled(en)}
      />

      <ChannelEqModal
        isOpen={windowState.eq.open}
        onClose={() => toggleModal("eq")}
        trackName={selectedTrack?.name ?? "Track"}
      />

      <GuitarAmpModal
        isOpen={windowState.amp.open}
        onClose={() => toggleModal("amp")}
        trackName={selectedTrack?.name ?? "Guitar Track"}
      />

      <AiCoachModal
        isOpen={windowState.ai.open}
        onClose={() => toggleModal("ai")}
        currentKey={projectKey}
        bpm={bpm}
      />

    </div>
  );
}
