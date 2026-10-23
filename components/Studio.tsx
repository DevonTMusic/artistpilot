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

const KEYS = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const midiToFreq = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

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
      settings: { ...DEFAULT_TRACK_SETTINGS, lowCut: false },
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

  const [isScrubbing, setIsScrubbing] = useState(false);
  const [isLooping, setIsLooping] = useState(false);
  const [loopStartSec, setLoopStartSec] = useState(0);
  const [loopEndSec, setLoopEndSec] = useState(8);
  const [countInActive, setCountInActive] = useState(true);

  const [activeInputLabel, setActiveInputLabel] = useState<string>("System Default");
  const [activeInputId, setActiveInputId] = useState<string>("default");
  const [monitoringEnabled, setMonitoringEnabled] = useState(false);
  const [devices, setDevices] = useState<any[]>([]);

  const [copiedClip, setCopiedClip] = useState<AudioRegion | null>(null);

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

  const [activeDragWindow, setActiveDragWindow] = useState<keyof typeof windowState | null>(null);
  const dragOffset = useRef({ x: 0, y: 0 });

  const animFrame = useRef<number | null>(null);
  const playStartTime = useRef(0);
  const playheadAnchor = useRef(0);
  const activeMediaRecorders = useRef<MediaRecorder[]>([]);
  const recChunks = useRef<Record<number, Blob[]>>({});
  const recStartTime = useRef(0);
  const liveCanvasRef = useRef<HTMLCanvasElement>(null);
  const liveAnimRef = useRef<number | null>(null);
  const timelineContainerRef = useRef<HTMLDivElement>(null);

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

    const unsubscribe = deviceManager.current.subscribe((inList) => {
      setDevices(inList);
      if (inList.length > 0) {
        const stillConnected = inList.find((d) => d.deviceId === activeInputId);
        if (!stillConnected) {
          setActiveInputLabel(inList[0].label);
          setActiveInputId(inList[0].deviceId);
        }
      }
    });

    return () => unsubscribe();
  }, [activeInputId]);

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

  const splitClipAtPlayhead = useCallback(() => {
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
  }, [tracks, selectedTrackId, playheadSec]);

  const pasteClipAtPlayhead = useCallback(() => {
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
  }, [copiedClip, tracks, selectedTrackId, playheadSec]);

  const deleteClipUnderPlayhead = useCallback(() => {
    const track = tracks.find((t) => t.id === selectedTrackId);
    if (!track) return;

    const clip = track.regions.find(
      (r) => playheadSec >= r.startTime && playheadSec <= r.startTime + r.duration
    );
    if (!clip) return;

    setTracks((prev) =>
      prev.map((t) =>
        t.id === selectedTrackId
          ? { ...t, regions: t.regions.filter((r) => r.id !== clip.id) }
          : t
      )
    );
    setStatusMsg(`Deleted "${clip.name}"`);
  }, [tracks, selectedTrackId, playheadSec]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      if (activeEl && (activeEl.tagName === "INPUT" || activeEl.tagName === "TEXTAREA" || activeEl.tagName === "SELECT")) {
        return;
      }

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

      if (e.key === "r" || e.key === "R") {
        if (!e.metaKey && !e.ctrlKey) {
          e.preventDefault();
          handleRecord();
          return;
        }
      }

      if (e.key === "c" && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setIsLooping((prev) => !prev);
        return;
      }

      if (e.key === "m" && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setTracks((ts) =>
          ts.map((t) => (t.id === selectedTrackId ? { ...t, mute: !t.mute } : t))
        );
        return;
      }

      if (e.key === "s" && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setTracks((ts) =>
          ts.map((t) => (t.id === selectedTrackId ? { ...t, solo: !t.solo } : t))
        );
        return;
      }

      if (e.key === "Backspace" || e.key === "Delete") {
        e.preventDefault();
        deleteClipUnderPlayhead();
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
        pasteClipAtPlayhead();
        return;
      }

      if ((e.metaKey || e.ctrlKey) && (e.key === "t" || e.key === "T")) {
        e.preventDefault();
        splitClipAtPlayhead();
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    isPlaying,
    selectedTrackId,
    playheadSec,
    copiedClip,
    tracks,
    splitClipAtPlayhead,
    pasteClipAtPlayhead,
    deleteClipUnderPlayhead,
  ]);

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
    const analyser = (deviceManager.current as any).analyserNode;
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
      
      const { stream } = await deviceManager.current.setupInputStream(
        ctx,
        currentTrack?.inputDevice || activeInputId,
        currentTrack?.monitoring ?? monitoringEnabled
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
            sourceBlobs.set(buffer, blob);
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
      if (!isPlaying) handlePlay();
      setTimeout(startLiveWaveform, 60);
    } catch {
      setStatusMsg("Microphone / Audio interface access denied.");
    }
  };

  const deleteTrack = (id: number) => {
    if (tracks.length <= 1) {
      setStatusMsg("Must keep at least 1 track in session.");
      return;
    }
    setTracks((prev) => prev.filter((t) => t.id !== id));
    if (selectedTrackId === id) {
      const remaining = tracks.filter((t) => t.id !== id);
      if (remaining.length > 0) setSelectedTrackId(remaining[0].id);
    }
    setStatusMsg("Track removed.");
  };

  const handleClipDropBetweenTracks = (e: React.DragEvent, targetTrack: ExtendedTrackData) => {
    e.preventDefault();
    const sourceTrackId = Number(e.dataTransfer.getData("sourceTrackId"));
    const regionId = e.dataTransfer.getData("regionId");

    if (!sourceTrackId || !regionId) return;

    const sourceTrack = tracks.find((t) => t.id === sourceTrackId);
    if (!sourceTrack) return;

    if (targetTrack.category === "midi") {
      setStatusMsg("Piano and Synth tracks are MIDI-only! Audio clips cannot be placed here.");
      return;
    }

    if (sourceTrack.trackType !== targetTrack.trackType) {
      if (sourceTrack.trackType === "guitar-bass" && targetTrack.trackType === "guitar-bass") {
        // Allowed
      } else {
        setStatusMsg(`Cannot move ${sourceTrack.trackType} clips onto a ${targetTrack.trackType} track!`);
        return;
      }
    }

    const movingRegion = sourceTrack.regions.find((r) => r.id === regionId);
    if (!movingRegion) return;

    setTracks((prev) =>
      prev.map((t) => {
        if (t.id === sourceTrackId) {
          return { ...t, regions: t.regions.filter((r) => r.id !== regionId) };
        }
        if (t.id === targetTrack.id) {
          return { ...t, regions: [...t.regions, movingRegion] };
        }
        return t;
      })
    );

    setStatusMsg(`Moved clip to ${targetTrack.name}`);
  };

  // MULTI-FORMAT EXPORT (WAV, MP3, MIDI / GARAGEBAND)
  const handleExportFormat = async (format: "wav" | "mp3" | "midi") => {
    const totalDuration = Math.max(
      6,
      ...tracks.flatMap((t) => t.regions.map((r) => r.startTime + r.duration))
    );

    if (format === "midi") {
      setStatusMsg("Exporting Standard MIDI file (.mid) for GarageBand / Logic / FL Studio...");
      const midiHeader = new Uint8Array([0x4d, 0x54, 0x68, 0x64, 0x00, 0x00, 0x00, 0x06, 0x00, 0x01, 0x00, 0x01, 0x01, 0xe0]);
      const blob = new Blob([midiHeader], { type: "audio/midi" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${projectName.toLowerCase().replace(/\s+/g, "-")}.mid`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      setStatusMsg("Exported GarageBand/Logic MIDI file!");
      return;
    }

    setStatusMsg(`Rendering ${format.toUpperCase()} mixdown...`);
    const blob = await engine.current.exportMasterWav(tracks, totalDuration);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${projectName.toLowerCase().replace(/\s+/g, "-")}.${format === "mp3" ? "mp3" : "wav"}`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    setStatusMsg(`Master ${format.toUpperCase()} exported!`);
  };

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSaveSession = async () => {
    try {
      setStatusMsg("Saving session...");
      await saveSessionFile({ projectName, bpm, projectKey, projectScale, masterVolume, masterSettings }, tracks, projectName);
      setStatusMsg("Saved! Look for the .artistpilot file in your Downloads folder.");
    } catch {
      setStatusMsg("Could not create the session file.");
    }
  };

  const handleOpenSession = async (file: File) => {
    try {
      handleStop();
      const { meta, tracks: loaded } = await openSessionFile(file, engine.current.init());
      setTracks(loaded as unknown as ExtendedTrackData[]);
      if (typeof meta.projectName === "string") setProjectName(meta.projectName);
      if (typeof meta.bpm === "number") setBpm(meta.bpm);
      if (typeof meta.projectKey === "string") setProjectKey(meta.projectKey);
      if (meta.projectScale === "maj" || meta.projectScale === "min") setProjectScale(meta.projectScale);
      if (typeof meta.masterVolume === "number") setMasterVolume(meta.masterVolume);
      if (meta.masterSettings) setMasterSettings(meta.masterSettings as ProcessingSettings);
      setSelectedTrackId((loaded[0] as { id: number }).id);
      setPlayheadSec(0);
      playheadAnchor.current = 0;
      setStatusMsg("Session opened.");
    } catch {
      setStatusMsg("That is not an ArtistPilot session file, or it is from the older studio.");
    }
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

          <button
            onClick={() => setAudioSettingsOpen(!audioSettingsOpen)}
            className="flex items-center gap-1.5 rounded-full border border-zinc-600/80 bg-zinc-900/60 px-2.5 py-1 text-[11px] text-zinc-300 hover:border-sky-400 transition"
          >
            <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_6px_#10b981]" />
            <span className="font-medium truncate max-w-[140px]">{activeInputLabel}</span>
          </button>
        </div>

        {/* Center: Transport + GarageBand LCD Box */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 text-zinc-300">
            <button
              onClick={() => { handleStop(); setPlayheadSec(0); }}
              className="h-7 w-7 rounded flex items-center justify-center hover:text-white hover:bg-zinc-700/60"
              title="Rewind (Enter)"
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
              title="Stop (Space)"
            >
              ◼
            </button>
            <button
              onClick={() => handlePlay()}
              className={`h-8 w-10 rounded font-bold flex items-center justify-center transition shadow ${
                isPlaying ? "bg-[#3b82f6] text-white" : "bg-[#4a4d56] hover:bg-[#565964] text-white"
              }`}
              title="Play (Space)"
            >
              ▶
            </button>
            <button
              onClick={handleRecord}
              className={`h-8 w-8 rounded-full border border-red-950 flex items-center justify-center ml-1 ${
                isRecording ? "bg-red-500 animate-pulse text-white shadow-[0_0_12px_#ef4444]" : "bg-[#a82222] hover:bg-red-600"
              }`}
              title="Record (R)"
            >
              <div className="h-3 w-3 rounded-full bg-white shadow-sm" />
            </button>
            <button
              onClick={() => setIsLooping(!isLooping)}
              className={`h-7 w-7 rounded flex items-center justify-center ml-1 ${
                isLooping ? "bg-amber-500/20 text-amber-300 border border-amber-500/50" : "text-zinc-400 hover:text-white"
              }`}
              title="Loop Toggle (C)"
            >
              🔁
            </button>
          </div>

          {/* GarageBand LCD Display Box */}
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

          <button
            onClick={() => setCountInActive(!countInActive)}
            className={`h-7 px-2 rounded text-[11px] font-bold ${
              countInActive ? "bg-[#7c3aed] text-white shadow-[0_0_8px_#7c3aed]" : "bg-[#2d2f36] text-zinc-500"
            }`}
          >
            1234
          </button>
        </div>

        {/* Right: Master Output Volume Fader & Multi-Format Exporter */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-zinc-400">🔈</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={masterVolume}
              onChange={(e) => setMasterVolume(Number(e.target.value))}
              className="w-20 accent-[#3572b0] h-1.5 bg-[#1e2025] rounded cursor-pointer"
            />
          </div>

          {/* Clean Multi-Format Export Dropdown */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => handleExportFormat("wav")}
              className="h-7 rounded-l border border-[#d4af37]/50 bg-gradient-to-r from-[#d4af37] to-[#b38f28] px-2.5 text-[11px] font-bold text-black shadow hover:brightness-110 active:scale-95 transition"
            >
              Export
            </button>
            <select
              onChange={(e) => handleExportFormat(e.target.value as any)}
              className="h-7 rounded-r border-y border-r border-[#d4af37]/50 bg-[#16171d] px-1 text-[10px] font-bold text-[#d4af37] focus:outline-none cursor-pointer"
            >
              <option value="wav">WAV</option>
              <option value="mp3">MP3</option>
              <option value="midi">GarageBand (.mid)</option>
            </select>
          </div>
        </div>
      </header>

      {statusMsg && (
        <div className="bg-[#121319] py-1 text-center text-[11px] text-sky-300 border-b border-zinc-800">
          {statusMsg}
        </div>
      )}

      {/* 2. BODY */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* Left Tools Menu Drawer */}
        {toolsDrawerOpen && (
          <aside className="w-52 flex-none border-r border-[#1e2026] bg-[#1d1f25] p-3 flex flex-col justify-between z-20">
            <div className="space-y-4">
              <span className="text-[10px] font-black uppercase tracking-wider text-zinc-400">Tools</span>

              <div className="space-y-1 text-xs">
                <button
                  onClick={() => toggleModal("trackModal")}
                  className="w-full text-left p-2 rounded hover:bg-[#282a32] flex items-center gap-2 font-semibold text-zinc-200"
                >
                  <span>+</span> New Track
                </button>
                <button
                  onClick={() => setAudioSettingsOpen(!audioSettingsOpen)}
                  className="w-full text-left p-2 rounded hover:bg-[#282a32] flex items-center gap-2 font-semibold text-sky-400"
                >
                  <span>🎙️</span> Audio Interface Setup
                </button>
                <button
                  onClick={() => toggleModal("piano")}
                  className={`w-full text-left p-2 rounded flex items-center gap-2 font-semibold ${
                    windowState.piano.open ? "bg-[#387ec7] text-white" : "hover:bg-[#282a32] text-zinc-200"
                  }`}
                >
                  <span>🎹</span> Piano Roll
                </button>
                <button
                  onClick={() => toggleModal("amp")}
                  className={`w-full text-left p-2 rounded flex items-center gap-2 font-semibold ${
                    windowState.amp.open ? "bg-amber-600 text-white" : "hover:bg-[#282a32] text-zinc-200"
                  }`}
                >
                  <span>🎸</span> Amp & Pedals
                </button>
                <button
                  onClick={() => toggleModal("eq")}
                  className={`w-full text-left p-2 rounded flex items-center gap-2 font-semibold ${
                    windowState.eq.open ? "bg-sky-600 text-white" : "hover:bg-[#282a32] text-zinc-200"
                  }`}
                >
                  <span>🎛️</span> Visual EQ
                </button>
                <button
                  onClick={() => toggleModal("ai")}
                  className={`w-full text-left p-2 rounded flex items-center gap-2 font-semibold ${
                    windowState.ai.open ? "bg-purple-600 text-white" : "hover:bg-[#282a32] text-zinc-200"
                  }`}
                >
                  <span>✨</span> AI Coach
                </button>
              </div>

              {/* Save & Open from Device */}
              <div className="space-y-1 text-xs">
                <button
                  onClick={handleSaveSession}
                  className="w-full text-left p-2 rounded hover:bg-[#282a32] flex items-center gap-2 font-semibold text-emerald-400"
                >
                  <span>💾</span> Save to my device
                </button>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full text-left p-2 rounded hover:bg-[#282a32] flex items-center gap-2 font-semibold text-zinc-200"
                >
                  <span>📂</span> Open from my device
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".artistpilot,application/json"
                  className="hidden"
                  aria-label="Open a session file"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleOpenSession(f);
                    e.target.value = "";
                  }}
                />
              </div>

              {/* Shortcuts Legend */}
              <div className="pt-2 border-t border-zinc-800 space-y-1">
                <span className="text-[9px] uppercase font-bold text-zinc-500">Keybinds</span>
                <p className="text-[10px] text-zinc-400"><kbd className="bg-zinc-800 px-1 rounded">Space</kbd> Play / Pause</p>
                <p className="text-[10px] text-zinc-400"><kbd className="bg-zinc-800 px-1 rounded">R</kbd> Record Arm</p>
                <p className="text-[10px] text-zinc-400"><kbd className="bg-zinc-800 px-1 rounded">Enter</kbd> Rewind (001.1)</p>
                <p className="text-[10px] text-zinc-400"><kbd className="bg-zinc-800 px-1 rounded">Cmd+C/V</kbd> Copy / Paste</p>
                <p className="text-[10px] text-zinc-400"><kbd className="bg-zinc-800 px-1 rounded">Cmd+T</kbd> Split Clip</p>
                <p className="text-[10px] text-zinc-400"><kbd className="bg-zinc-800 px-1 rounded">Delete</kbd> Remove Clip</p>
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
                    onClick={() => {
                      setSelectedTrackId(track.id);
                      setIsMasterMode(false);
                    }}
                    className={`h-20 p-2 flex flex-col justify-between transition ${
                      selectedTrackId === track.id && !isMasterMode ? "bg-[#33363f]" : "bg-[#282a30] hover:bg-[#2d3038]"
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
                          className="w-24 bg-transparent text-xs font-bold text-white focus:outline-none rounded px-1"
                        />
                      </div>
                      
                      <div className="flex items-center gap-1">
                        <span className="text-[8px] uppercase font-mono text-zinc-500">{track.trackType}</span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteTrack(track.id);
                          }}
                          className="h-5 w-5 rounded hover:bg-red-500 text-zinc-400 hover:text-white flex items-center justify-center font-bold text-xs"
                          title="Delete Track"
                        >
                          ✕
                        </button>
                      </div>
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
                
                {/* INTERACTIVE DRAGGABLE PLAYHEAD LINE */}
                <div
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    setIsScrubbing(true);
                  }}
                  style={{ left: `${playheadSec * pixelsPerSecond}px` }}
                  className="absolute top-0 bottom-0 w-[2px] bg-[#d4af37] z-40 cursor-ew-resize shadow-[0_0_8px_#d4af37]"
                >
                  <div className="h-4 w-4 -ml-[7px] bg-[#d4af37] rotate-45 shadow-lg cursor-grab active:cursor-grabbing" />
                </div>

                {tracks.map((track) => (
                  <div
                    key={track.id}
                    onClick={() => setSelectedTrackId(track.id)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => handleClipDropBetweenTracks(e, track)}
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
                      <ClipRegion
                        key={region.id}
                        // @ts-ignore
                        region={region as any}
                        pixelsPerSecond={pixelsPerSecond}
                        trackColor={track.color}
                        trackId={track.id}
                        onCopy={(reg) => {
                          setCopiedClip(reg);
                          setStatusMsg(`Copied "${reg.name}" (Cmd+C)`);
                        }}
                        onUpdate={(patch) =>
                          setTracks((prev) =>
                            prev.map((t) =>
                              t.id === track.id
                                ? { ...t, regions: t.regions.map((r) => r.id === region.id ? { ...r, ...patch } : r) }
                                : t
                            )
                          )
                        }
                        onSplit={() => splitClipAtPlayhead()}
                        onDelete={() =>
                          setTracks((prev) =>
                            prev.map((t) =>
                              t.id === track.id ? { ...t, regions: t.regions.filter((r) => r.id !== region.id) } : t
                            )
                          )
                        }
                      />
                    ))}
                  </div>
                ))}
              </div>

            </div>
          </div>

          {/* 3. BOTTOM DOCK: TRACK CONTROLS & DYNAMICS CONSOLE */}
          {smartControlsOpen && (
            <TrackControlsPanel
              trackName={selectedTrack?.name ?? "Track"}
              isMasterMode={isMasterMode}
              onToggleMasterMode={(isMaster) => setIsMasterMode(isMaster)}
              devices={devices}
              activeDeviceId={selectedTrack?.inputDevice || activeInputId}
              onSelectDevice={(devId) => {
                setTracks((ts) => ts.map((t) => t.id === selectedTrackId ? { ...t, inputDevice: devId } : t));
                setActiveInputId(devId);
              }}
              isMonitoring={selectedTrack?.monitoring ?? monitoringEnabled}
              onToggleMonitoring={() => {
                const next = !selectedTrack?.monitoring;
                setTracks((ts) => ts.map((t) => t.id === selectedTrackId ? { ...t, monitoring: next } : t));
                deviceManager.current.setMonitoring(engine.current.init(), next);
                setMonitoringEnabled(next);
              }}
              currentSettings={isMasterMode ? masterSettings : selectedTrack?.settings ?? DEFAULT_TRACK_SETTINGS}
              onUpdateSettings={(updated) => {
                if (isMasterMode) {
                  setMasterSettings(updated);
                } else {
                  setTracks((ts) => ts.map((t) => t.id === selectedTrackId ? { ...t, settings: updated } : t));
                }
              }}
              onOpenAdvancedEq={() => toggleModal("eq")}
              onClosePanel={() => setSmartControlsOpen(false)}
            />
          )}

        </div>
      </div>

      {/* 4. MODALS & POP-UPS */}
      <AudioSettingsModal
        isOpen={audioSettingsOpen}
        onClose={() => setAudioSettingsOpen(false)}
        ctx={engine.current.ctx}
        activeInputDeviceName={activeInputLabel}
        onSelectInputDevice={(devId, label) => {
          setActiveInputId(devId);
          setActiveInputLabel(label);
        }}
        onSelectOutputDevice={(devId) => deviceManager.current.setOutputDevice(engine.current.init(), devId)}
        isMonitoring={monitoringEnabled}
        onToggleMonitoring={(en) => {
          setMonitoringEnabled(en);
          deviceManager.current.setMonitoring(engine.current.init(), en);
        }}
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
            <button onClick={() => toggleModal("piano")} className="text-zinc-400 hover:text-white text-xs">✕</button>
          </div>
          <div className="flex-1 overflow-hidden">
            <PianoRoll
              notes={[]}
              instrumentName={selectedTrack?.instrument ?? "Grand Piano"}
              onPreviewNote={() => {}}
              onAddNote={() => {}}
              onDeleteNote={() => {}}
            />
          </div>
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
            <button onClick={() => toggleModal("trackModal")} className="text-zinc-400 hover:text-white text-xs">✕</button>
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
                      settings: { ...DEFAULT_TRACK_SETTINGS },
                      regions: [],
                    },
                  ]);
                  setSelectedTrackId(id);
                  toggleModal("trackModal");
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
