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

export type TrackCompatibilityType = "vocal" | "guitar-bass" | "midi" | "drum";

interface ExtendedTrackData extends TrackData {
  trackType: TrackCompatibilityType;
}

const INSTRUMENT_LIBRARY: { name: string; category: "audio" | "midi" | "drum"; trackType: TrackCompatibilityType; color: string; icon: string; desc: string }[] = [
  { name: "Lead Vocal", category: "audio", trackType: "vocal", color: "bg-[#2563eb]", icon: "🎙️", desc: "Dedicated vocal channel with pitch tracking" },
  { name: "Electric Lead Guitar", category: "audio", trackType: "guitar-bass", color: "bg-[#d97706]", icon: "🎸", desc: "Instrument direct input / Amp modeling" },
  { name: "Classic Bass Guitar", category: "audio", trackType: "guitar-bass", color: "bg-[#7c3aed]", icon: "🎸", desc: "Direct instrument bass input" },
  { name: "Acoustic Grand Piano", category: "midi", trackType: "midi", color: "bg-[#059669]", icon: "🎹", desc: "MIDI-only software instrument" },
  { name: "Analog Synth Pad", category: "midi", trackType: "midi", color: "bg-[#0284c7]", icon: "🎛️", desc: "Polyphonic MIDI synthesizer" },
  { name: "808 Drum Machine", category: "drum", trackType: "drum", color: "bg-[#dc2626]", icon: "🥁", desc: "16-step drum pattern trigger" },
];

const KEYS = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const midiToFreq = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

export default function Studio({ defaultBpm = 120 }: { defaultBpm?: number }) {
  const engine = useRef<AudioEngine>(AudioEngine.getInstance());
  const inputManager = useRef<AudioInputManager>(AudioInputManager.getInstance());

  const [tracks, setTracks] = useState<ExtendedTrackData[]>([
    {
      id: 1,
      name: "Lead Vocal",
      category: "audio",
      trackType: "vocal",
      instrument: "Lead Vocal",
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
      name: "Lead Guitar",
      category: "audio",
      trackType: "guitar-bass",
      instrument: "Electric Lead Guitar",
      color: "bg-[#d97706]",
      volume: 0.8,
      pan: 0,
      mute: false,
      solo: false,
      armed: false,
      regions: [],
    },
    {
      id: 3,
      name: "Grand Piano",
      category: "midi",
      trackType: "midi",
      instrument: "Acoustic Grand Piano",
      color: "bg-[#059669]",
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
  const [projectKey, setProjectKey] = useState("C");
  const [projectScale, setProjectScale] = useState<"maj" | "min">("maj");
  const [isPlaying, setIsPlaying] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [playheadSec, setPlayheadSec] = useState(0);
  const [selectedTrackId, setSelectedTrackId] = useState(1);
  const [pixelsPerSecond, setPixelsPerSecond] = useState(50);
  const [masterVolume, setMasterVolume] = useState(0.85);

  // Playhead scrubbing state
  const [isScrubbing, setIsScrubbing] = useState(false);

  // Direct Modal Visibility States
  const [pianoOpen, setPianoOpen] = useState(false);
  const [ampOpen, setAmpOpen] = useState(false);
  const [eqOpen, setEqOpen] = useState(false);
  const [inputsOpen, setInputsOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [trackModalOpen, setTrackModalOpen] = useState(false);

  // Piano Window Coordinates for dragging
  const [pianoPos, setPianoPos] = useState({ x: 260, y: 120 });
  const [isDraggingPiano, setIsDraggingPiano] = useState(false);
  const pianoDragOffset = useRef({ x: 0, y: 0 });

  const [isLooping, setIsLooping] = useState(false);
  const [loopStartSec, setLoopStartSec] = useState(0);
  const [loopEndSec, setLoopEndSec] = useState(8);
  const [monitoringEnabled, setMonitoringEnabled] = useState(false);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>("");
  const [statusMsg, setStatusMsg] = useState("");

  // Live Waveform Canvas Reference
  const liveCanvasRef = useRef<HTMLCanvasElement>(null);
  const liveAnimRef = useRef<number | null>(null);

  const [trackNotes, setTrackNotes] = useState<Record<number, MidiNote[]>>({
    3: [
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

  const timelineContainerRef = useRef<HTMLDivElement>(null);

  // Drag listeners for Piano Roll window
  const startDragPiano = (e: React.MouseEvent) => {
    setIsDraggingPiano(true);
    pianoDragOffset.current = {
      x: e.clientX - pianoPos.x,
      y: e.clientY - pianoPos.y,
    };
  };

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (isDraggingPiano) {
        setPianoPos({
          x: Math.max(10, e.clientX - pianoDragOffset.current.x),
          y: Math.max(10, e.clientY - pianoDragOffset.current.y),
        });
      }
    };
    const onMouseUp = () => setIsDraggingPiano(false);

    if (isDraggingPiano) {
      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", onMouseUp);
    }
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [isDraggingPiano]);

  // Playhead Scrubbing Listeners
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

  // Live Oscilloscope Waveform Animation
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

  // Multi-Track Recording (Simultaneous)
  const handleRecord = async () => {
    if (isRecording) {
      handleStop();
      return;
    }

    const armedAudioTracks = tracks.filter((t) => t.armed && t.category === "audio");
    if (armedAudioTracks.length === 0) {
      setStatusMsg("No audio track armed! Click the record dot (●) on a vocal or guitar track.");
      return;
    }

    try {
      const ctx = engine.current.init();
      const { stream } = await inputManager.current.setupInputStream(
        ctx,
        selectedDeviceId,
        monitoringEnabled
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
              name: `${track.name} Take`,
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
      setStatusMsg(`Recording live into ${armedAudioTracks.length} track(s)...`);
    } catch {
      setStatusMsg("Microphone / Audio interface permission was denied.");
    }
  };

  // Drag and Drop Audio Clip Between Tracks (Compatibility validation)
  const handleClipDropBetweenTracks = (e: React.DragEvent, targetTrack: ExtendedTrackData) => {
    e.preventDefault();
    const sourceTrackId = Number(e.dataTransfer.getData("sourceTrackId"));
    const regionId = e.dataTransfer.getData("regionId");

    if (!sourceTrackId || !regionId) return;

    const sourceTrack = tracks.find((t) => t.id === sourceTrackId);
    if (!sourceTrack) return;

    // MIDI tracks strictly reject audio files!
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
    setStatusMsg("Master WAV exported!");
  };

  const selectedTrack = tracks.find((t) => t.id === selectedTrackId);
  const currentNotes = trackNotes[selectedTrackId] || [];

  const totalBeats = (playheadSec * bpm) / 60;
  const currentBar = Math.floor(totalBeats / 4) + 1;
  const currentBeat = (Math.floor(totalBeats) % 4) + 1;

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-[#090a0d] text-[#c5c7d0] font-sans select-none relative">
      
      {/* 1. TOP TRANSPORT BAR */}
      <header className="flex h-13 flex-none items-center justify-between border-b border-[#1c1d24] bg-[#121318] px-4 shadow-xl z-30">
        
        {/* Left Section */}
        <div className="flex items-center gap-2">
          <input
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            className="w-36 bg-transparent text-xs font-bold text-white/90 focus:outline-none focus:ring-1 focus:ring-[#d4af37] rounded px-1.5 py-1 truncate"
          />
          <div className="h-4 w-[1px] bg-zinc-800 mx-1" />

          <button
            onClick={() => setTrackModalOpen(true)}
            className="flex h-7 items-center gap-1 rounded bg-[#1c1e26] border border-zinc-700/80 px-2.5 text-[11px] font-semibold text-zinc-200 hover:border-[#d4af37] hover:text-[#d4af37] transition shadow-sm"
          >
            + Track
          </button>

          <button
            onClick={() => setInputsOpen(true)}
            className="flex h-7 items-center gap-1.5 rounded border border-zinc-800 bg-[#16171e] px-2.5 text-[11px] font-semibold text-sky-400 hover:border-sky-500/60 shadow-sm"
          >
            Inputs & Monitor
          </button>

          <button
            onClick={() => setEqOpen(true)}
            className="flex h-7 items-center gap-1.5 rounded border border-zinc-800 bg-[#16171e] px-2.5 text-[11px] font-semibold text-zinc-400 hover:border-sky-500/60 hover:text-sky-400 transition"
          >
            Visual EQ
          </button>

          <button
            onClick={() => setPianoOpen(!pianoOpen)}
            className={`flex h-7 items-center gap-1.5 rounded border px-2.5 text-[11px] font-semibold transition ${
              pianoOpen ? "border-emerald-500 bg-emerald-950/40 text-emerald-300" : "border-zinc-800 bg-[#16171e] text-zinc-400 hover:text-white"
            }`}
          >
            Piano Roll
          </button>

          <button
            onClick={() => setAmpOpen(true)}
            className="flex h-7 items-center gap-1.5 rounded border border-zinc-800 bg-[#16171e] px-2.5 text-[11px] font-semibold text-zinc-400 hover:border-amber-500/60 hover:text-amber-400 transition"
          >
            Amp Rig
          </button>

          <button
            onClick={() => setAiOpen(true)}
            className="flex h-7 items-center gap-1.5 rounded border border-zinc-800 bg-[#16171e] px-2.5 text-[11px] font-semibold text-zinc-400 hover:border-purple-500/60 hover:text-purple-300 transition"
          >
            AI Coach
          </button>
        </div>

        {/* Center: Vector Transport + LCD Screen */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <button
              onClick={() => { handleStop(); setPlayheadSec(0); playheadAnchor.current = 0; }}
              className="h-8 w-8 rounded flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-800 transition"
              title="Return to 001.1"
            >
              <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/></svg>
            </button>
            <button
              onClick={handleStop}
              className="h-8 w-8 rounded flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-800 transition"
              title="Stop"
            >
              <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24"><rect x="5" y="5" width="14" height="14" rx="1"/></svg>
            </button>
            <button
              onClick={() => handlePlay()}
              className={`h-8 w-11 rounded font-bold text-sm flex items-center justify-center transition shadow-md ${
                isPlaying ? "bg-[#d4af37] text-black" : "bg-[#22242e] text-white hover:bg-[#2b2d38]"
              }`}
              title="Play"
            >
              {isPlaying ? (
                <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
              ) : (
                <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
              )}
            </button>

            {/* Multi-Track Record Button */}
            <button
              onClick={handleRecord}
              className={`h-8 w-8 rounded-full border border-red-950 flex items-center justify-center transition ml-1 ${
                isRecording ? "bg-red-500 animate-pulse text-white shadow-[0_0_12px_#ef4444]" : "bg-[#8b1e1e] hover:bg-red-600"
              }`}
              title="Record Armed Tracks"
            >
              <div className="h-3 w-3 rounded-full bg-white shadow-sm" />
            </button>
          </div>

          {/* OLED Timecode Display with Musical Key and BPM */}
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
            <div className="pl-2.5 flex items-center gap-1">
              <select
                value={projectKey}
                onChange={(e) => setProjectKey(e.target.value)}
                className="bg-transparent text-[11px] font-bold text-sky-400 focus:outline-none cursor-pointer"
              >
                {KEYS.map((k) => <option key={k} value={k} className="bg-zinc-900 text-white">{k}</option>)}
              </select>
              <button
                onClick={() => setProjectScale(projectScale === "maj" ? "min" : "maj")}
                className="text-[10px] text-zinc-400 font-bold hover:text-white"
              >
                {projectScale}
              </button>
            </div>
          </div>
        </div>

        {/* Right Section */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleExport}
            className="h-7 rounded border border-[#d4af37]/50 bg-gradient-to-r from-[#d4af37] to-[#b38f28] px-3 text-[11px] font-bold text-black shadow hover:brightness-110 active:scale-95 transition"
          >
            Export WAV
          </button>
        </div>
      </header>

      {statusMsg && (
        <div className="bg-[#121319] py-1 text-center text-[11px] text-[#d4af37] border-b border-zinc-800 z-20">
          {statusMsg}
        </div>
      )}

      {/* 2. TIMELINE + FIXED TRACK HEADERS */}
      <div className="flex-1 flex overflow-hidden relative">
        
        {/* Left Track Headers */}
        <div className="w-64 flex-none border-r border-[#1a1b22] bg-[#101116] flex flex-col z-20 shadow-xl">
          <div className="h-7 border-b border-[#1a1b22] px-3 flex items-center justify-between font-bold text-zinc-400 text-[10px]">
            <span>TRACKS ({tracks.length})</span>
            <span className="text-[8px] text-zinc-500 font-normal">● = Arm Rec</span>
          </div>

          <div className="flex-1 overflow-y-hidden divide-y divide-[#171820]">
            {tracks.map((track) => (
              <div
                key={track.id}
                onClick={() => setSelectedTrackId(track.id)}
                className={`h-20 p-2 flex flex-col justify-between transition ${
                  selectedTrackId === track.id ? "bg-[#161720]" : "bg-[#101116]"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs">{INSTRUMENT_LIBRARY.find((p) => p.name === track.instrument)?.icon ?? "🎙️"}</span>
                    <input
                      value={track.name}
                      onChange={(e) => setTracks((ts) => ts.map((t) => t.id === track.id ? { ...t, name: e.target.value } : t))}
                      className="w-24 bg-transparent text-xs font-bold text-white focus:outline-none focus:ring-1 focus:ring-[#d4af37] rounded px-1 truncate"
                    />
                  </div>
                  
                  {/* Delete Button (Restored!) */}
                  <div className="flex items-center gap-1">
                    <span className="text-[8px] uppercase tracking-wider text-zinc-500 font-mono">{track.trackType}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteTrack(track.id);
                      }}
                      className="text-zinc-600 hover:text-red-400 text-xs px-1 font-bold"
                      title="Delete Track"
                    >
                      ✕
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[10px] pt-1">
                  <div className="flex items-center gap-1">
                    {/* Record Arm Button */}
                    {track.category === "audio" && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setTracks((ts) => ts.map((t) => t.id === track.id ? { ...t, armed: !t.armed } : t));
                        }}
                        className={`h-4.5 w-4.5 rounded-full flex items-center justify-center font-bold text-[8px] transition ${
                          track.armed ? "bg-red-500 text-white shadow-[0_0_8px_#ef4444]" : "bg-[#1e2028] text-red-500 hover:bg-zinc-800"
                        }`}
                        title="Arm Track for Recording"
                      >
                        ●
                      </button>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setTracks((ts) => ts.map((t) => t.id === track.id ? { ...t, mute: !t.mute } : t));
                      }}
                      className={`h-4.5 px-1.5 rounded text-[9px] font-bold ${track.mute ? "bg-blue-500 text-white" : "bg-[#1c1e26] text-zinc-400"}`}
                    >
                      M
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setTracks((ts) => ts.map((t) => t.id === track.id ? { ...t, solo: !t.solo } : t));
                      }}
                      className={`h-4.5 px-1.5 rounded text-[9px] font-bold ${track.solo ? "bg-amber-500 text-black" : "bg-[#1c1e26] text-zinc-400"}`}
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
          className="flex-1 overflow-x-auto overflow-y-hidden flex flex-col bg-[#08090c] relative select-none"
        >
          {/* Draggable Musical Ruler */}
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
            className="h-7 border-b border-[#1c1d24] bg-[#0f1015] relative cursor-ew-resize flex-none"
          >
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

          {/* Arranger Lanes Container */}
          <div style={{ width: "3200px" }} className="flex-1 relative divide-y divide-[#15161e]">
            
            {/* FULL-HEIGHT GOLD PLAYHEAD LINE (Always on top z-40) */}
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
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => handleClipDropBetweenTracks(e, track)}
                className={`h-20 relative flex items-center transition ${
                  selectedTrackId === track.id ? "bg-[#14151e]" : "bg-[#090a0d] hover:bg-[#0e0f14]"
                }`}
              >
                {/* Real-time live audio recording waveform canvas */}
                {isRecording && track.armed && track.category === "audio" && (
                  <div
                    style={{
                      left: `${recStartTime.current * pixelsPerSecond}px`,
                      width: `${Math.max(20, (playheadSec - recStartTime.current) * pixelsPerSecond)}px`,
                    }}
                    className="absolute top-1 bottom-1 bg-red-950/80 border border-red-500 rounded z-30 overflow-hidden"
                  >
                    <canvas ref={liveCanvasRef} width={400} height={70} className="h-full w-full" />
                  </div>
                )}

                {track.category === "midi" ? (
                  <div className="text-[10px] text-zinc-600 pl-6 italic select-none pointer-events-none">
                    MIDI Lane (Piano Roll only — audio clips not allowed)
                  </div>
                ) : track.regions.length === 0 && (!isRecording || !track.armed) ? (
                  <div className="text-[10px] text-zinc-600 pl-6 italic select-none pointer-events-none">
                    Empty {track.trackType} lane — drag clips here or arm record (●)
                  </div>
                ) : (
                  track.regions.map((region) => (
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
                  ))
                )}
              </div>
            ))}
          </div>

        </div>
      </div>

      {/* 3. WORKING POP-UP WINDOWS */}
      
      {/* Draggable Piano Roll */}
      {pianoOpen && (
        <div
          style={{ left: `${pianoPos.x}px`, top: `${pianoPos.y}px` }}
          className="fixed z-50 w-[660px] h-[360px] rounded-2xl border-2 border-[#20222a] bg-[#14151b] shadow-[0_30px_70px_rgba(0,0,0,0.9)] flex flex-col overflow-hidden font-sans select-none"
        >
          <div
            onMouseDown={startDragPiano}
            className="flex h-10 flex-none items-center justify-between border-b border-zinc-800 bg-[#1c1e26] px-4 cursor-grab active:cursor-grabbing hover:bg-[#22242e] transition"
          >
            <span className="text-xs font-bold text-white flex items-center gap-2">
              <span>🎹</span> Piano Roll ({selectedTrack?.instrument})
            </span>
            <button
              onClick={() => setPianoOpen(false)}
              className="h-6 w-6 rounded hover:bg-red-500 text-zinc-400 hover:text-white flex items-center justify-center font-bold text-xs"
            >
              ✕
            </button>
          </div>

          <div className="flex-1 overflow-hidden">
            <PianoRoll
              notes={currentNotes}
              instrumentName={selectedTrack?.instrument ?? "Acoustic Grand Piano"}
              onPreviewNote={(pitch) => {
                const c = engine.current.init();
                const o = c.createOscillator(); const g = c.createGain();
                o.frequency.setValueAtTime(midiToFreq(pitch), c.currentTime);
                g.gain.setValueAtTime(0.4, c.currentTime);
                g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 1.5);
                o.connect(g); g.connect(c.destination);
                o.start(); o.stop(c.currentTime + 1.5);
              }}
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

      {/* Pop-Up Modals */}
      <RecordingSettingsModal
        isOpen={inputsOpen}
        onClose={() => setInputsOpen(false)}
        ctx={engine.current.ctx}
        onSelectDevice={(devId) => setSelectedDeviceId(devId)}
        onToggleMonitoring={(en) => {
          setMonitoringEnabled(en);
          inputManager.current.setMonitoring(engine.current.init(), en);
        }}
        monitoringEnabled={monitoringEnabled}
      />

      <ChannelEqModal
        isOpen={eqOpen}
        onClose={() => setEqOpen(false)}
        trackName={selectedTrack?.name ?? "Track"}
      />

      <GuitarAmpModal
        isOpen={ampOpen}
        onClose={() => setAmpOpen(false)}
        trackName={selectedTrack?.name ?? "Guitar Track"}
      />

      <AiCoachModal
        isOpen={aiOpen}
        onClose={() => setAiOpen(false)}
        currentKey={projectKey}
        bpm={bpm}
      />

      {/* Add Track Modal */}
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
                        trackType: p.trackType,
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
