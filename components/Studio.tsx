// components/Studio.tsx
"use client";
import React, { useEffect, useRef, useState } from "react";
import { AudioEngine } from "@/lib/AudioEngine";
import { TrackData, AudioRegion } from "@/lib/AudioEngine";
import { ClipRegion } from "@/components/daw/ClipRegion";
import { PianoRoll, MidiNote } from "@/components/daw/PianoRoll";
import { GuitarAmpModal } from "@/components/daw/GuitarAmpModal";
import { AiCoachModal } from "@/components/daw/AiCoachModal";

const INSTRUMENT_LIBRARY = [
  { name: "Vocals / Acoustic Mic", category: "audio" as const, color: "bg-[#2563eb]", icon: "🎙️", desc: "Studio vocal chain & live instruments" },
  { name: "Acoustic Grand Piano", category: "midi" as const, color: "bg-[#059669]", icon: "🎹", desc: "Multi-sampled grand piano tone" },
  { name: "Electric Lead Guitar", category: "midi" as const, color: "bg-[#d97706]", icon: "🎸", desc: "Overdriven warm tube tone" },
  { name: "Vintage Bass Guitar", category: "midi" as const, color: "bg-[#7c3aed]", icon: "🎸", desc: "Thick analog low-end punch" },
  { name: "808 Studio Drum Kit", category: "drum" as const, color: "bg-[#dc2626]", icon: "🥁", desc: "Punchy analog kick, snare & hats" },
  { name: "Atmospheric Synth Pad", category: "midi" as const, color: "bg-[#0284c7]", icon: "🎛️", desc: "Lush polyphonic ambient texture" },
];

const midiToFreq = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

export default function Studio({ defaultBpm = 120 }: { defaultBpm?: number }) {
  const engine = useRef<AudioEngine>(AudioEngine.getInstance());
  const [tracks, setTracks] = useState<TrackData[]>([
    {
      id: 1,
      name: "Lead Vocal",
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
      name: "Grand Piano",
      category: "midi",
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

  const [projectName, setProjectName] = useState("ArtistPilot Master Session");
  const [bpm, setBpm] = useState(defaultBpm);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [playheadSec, setPlayheadSec] = useState(0);
  const [selectedTrackId, setSelectedTrackId] = useState(1);
  const [pixelsPerSecond, setPixelsPerSecond] = useState(48);
  const [masterVolume, setMasterVolume] = useState(0.85);

  // Panels & Drawers
  const [instrumentWindowOpen, setInstrumentWindowOpen] = useState(false);
  const [instrumentTab, setInstrumentTab] = useState<"pianoroll" | "keyboard">("keyboard");
  const [ampModalOpen, setAmpModalOpen] = useState(false);
  const [aiCoachOpen, setAiCoachOpen] = useState(false);
  const [mixerOpen, setMixerOpen] = useState(false);
  const [browserOpen, setBrowserOpen] = useState(false);
  const [trackModalOpen, setTrackModalOpen] = useState(false);
  const [midiConnected, setMidiConnected] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");

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

  // High-fidelity voice synthesizer
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
    } else if (instrument.includes("Guitar")) {
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
    } else if (instrument.includes("Bass")) {
      const o = c.createOscillator(); const g = c.createGain();
      o.type = "triangle";
      o.frequency.setValueAtTime(freq / 2, t);
      g.gain.setValueAtTime(0.55, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 1.4);
      o.connect(g); g.connect(c.destination);
      o.start(t); o.stop(t + 1.4);
    } else {
      // 808 Analog Drum Voice
      const o = c.createOscillator(); const g = c.createGain();
      o.frequency.setValueAtTime(140, t);
      o.frequency.exponentialRampToValueAtTime(38, t + 0.15);
      g.gain.setValueAtTime(0.85, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
      o.connect(g); g.connect(c.destination);
      o.start(t); o.stop(t + 0.22);
    }
  };

  // Web MIDI hardware setup
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
      if (!isPlaying) handlePlay();
    } catch {
      setStatusMsg("Microphone permission denied.");
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
    <div className="flex h-full w-full flex-col overflow-hidden bg-[#0c0d10] text-[#c5c7d0] font-sans select-none relative">
      
      {/* 1. LUXURY GRAPHITE & CHAMPAGNE TOP TOOLBAR */}
      <header className="flex h-13 flex-none items-center justify-between border-b border-[#21232a] bg-[#14151a] px-4 shadow-xl z-20">
        
        {/* Left: Tools & Workspace Views */}
        <div className="flex items-center gap-2">
          <input
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            className="w-48 bg-transparent text-xs font-bold text-white/90 focus:outline-none focus:ring-1 focus:ring-[#d4af37] rounded px-1.5 py-1 truncate"
            title="Rename session"
          />
          <div className="h-4 w-[1px] bg-zinc-800 mx-1" />

          <button
            onClick={() => setTrackModalOpen(true)}
            className="flex h-7 items-center gap-1 rounded bg-[#1e2028] border border-zinc-700/80 px-2.5 text-[11px] font-semibold text-zinc-200 hover:border-[#d4af37] hover:text-[#d4af37] transition shadow-sm"
          >
            <span>+</span> Track
          </button>

          <button
            onClick={() => setBrowserOpen(!browserOpen)}
            className={`flex h-7 items-center gap-1.5 rounded border px-2.5 text-[11px] font-semibold transition ${
              browserOpen ? "border-[#d4af37] bg-[#d4af37]/10 text-[#d4af37]" : "border-zinc-800 bg-[#17181f] text-zinc-400 hover:text-white"
            }`}
          >
            <span>📁</span> Sounds
          </button>

          <button
            onClick={() => setInstrumentWindowOpen(!instrumentWindowOpen)}
            className={`flex h-7 items-center gap-1.5 rounded border px-2.5 text-[11px] font-semibold transition ${
              instrumentWindowOpen ? "border-[#3b82f6] bg-blue-950/40 text-blue-300" : "border-zinc-800 bg-[#17181f] text-zinc-400 hover:text-white"
            }`}
          >
            <span>🎹</span> Keys & Roll
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

        {/* Center: Sleek Transport + OLED Status Screen */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <button onClick={handleStop} className="h-7 w-7 rounded flex items-center justify-center text-zinc-400 hover:text-white text-xs">◼</button>
            <button
              onClick={handlePlay}
              className={`h-8 w-11 rounded font-bold text-sm flex items-center justify-center transition shadow-md ${
                isPlaying ? "bg-[#d4af37] text-black" : "bg-[#22242e] text-white hover:bg-[#2b2d38]"
              }`}
            >
              {isPlaying ? "❚❚" : "▶"}
            </button>
            <button
              onClick={handleRecord}
              className={`h-7 w-7 rounded-full border border-red-950 flex items-center justify-center transition ${
                isRecording ? "bg-red-500 animate-pulse text-white shadow-[0_0_12px_#ef4444]" : "bg-[#8b1e1e] hover:bg-red-600"
              }`}
            >
              <div className="h-2.5 w-2.5 rounded-full bg-white shadow-sm" />
            </button>
          </div>

          {/* Precision OLED Screen */}
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
        </div>

        {/* Right: Master Volume, Mixer Toggle & Export */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className={`h-2 w-2 rounded-full ${midiConnected ? "bg-emerald-400 shadow-[0_0_6px_#10b981]" : "bg-zinc-600"}`} />
            <span className="text-[10px] text-zinc-500 font-mono">{midiConnected ? "MIDI" : "OFFLINE"}</span>
          </div>

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

      {/* 2. MAIN WORKSPACE (Arrangement + Optional Sound Browser) */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* Left Side: Sound Library & Preset Browser */}
        {browserOpen && (
          <aside className="w-64 flex-none border-r border-[#1f2027] bg-[#101115] p-3 flex flex-col justify-between z-10 animate-in slide-in-from-left duration-150">
            <div>
              <div className="flex items-center justify-between pb-2 border-b border-zinc-800 mb-3">
                <span className="text-xs font-bold text-white uppercase tracking-wider">Sound Library</span>
                <button onClick={() => setBrowserOpen(false)} className="text-zinc-500 hover:text-white text-xs">✕</button>
              </div>

              <div className="space-y-1.5">
                {INSTRUMENT_LIBRARY.map((inst) => (
                  <button
                    key={inst.name}
                    onClick={() => {
                      const id = Date.now();
                      setTracks((prev) => [
                        ...prev,
                        {
                          id,
                          name: `${inst.name.split(" ")[0]} ${prev.length + 1}`,
                          category: inst.category,
                          instrument: inst.name,
                          color: inst.color,
                          volume: 0.8,
                          pan: 0,
                          mute: false,
                          solo: false,
                          armed: false,
                          regions: [],
                        },
                      ]);
                      setSelectedTrackId(id);
                    }}
                    className="w-full text-left p-2 rounded-lg bg-[#15171d] hover:bg-[#1d2028] border border-zinc-800/80 transition flex items-center gap-2.5"
                  >
                    <span className="text-base">{inst.icon}</span>
                    <div className="overflow-hidden">
                      <p className="text-xs font-semibold text-zinc-200 truncate">{inst.name}</p>
                      <p className="text-[9px] text-zinc-500 truncate">{inst.desc}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <p className="text-[10px] text-zinc-600 text-center">Click any instrument to add as new track</p>
          </aside>
        )}

        {/* Center: Arrangement Workspace */}
        <div className="flex-1 flex flex-col overflow-hidden bg-[#0e0f13]">
          
          {/* Timeline Ruler */}
          <div className="flex h-6 flex-none border-b border-[#1c1d24] bg-[#121318] text-[9px] text-zinc-500 font-mono">
            <div className="w-64 flex-none border-r border-[#1c1d24] px-3 flex items-center font-bold text-zinc-400">
              TRACK HEADERS ({tracks.length})
            </div>
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

          {/* Arranger Track Lanes */}
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
                  className={`flex h-20 transition ${isSelected ? "bg-[#16171f]" : "bg-[#0e0f13] hover:bg-[#121319]"}`}
                >
                  {/* Track Header Card */}
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

                    {/* Mute, Solo, Volume */}
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
                        Empty lane — click Record (●) or draw MIDI in Keys & Roll
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

          {/* 3. PROFESSIONAL BOTTOM MIXER CONSOLE (COLLAPSIBLE) */}
          {mixerOpen && (
            <div className="h-64 flex-none border-t border-[#1c1d24] bg-[#101116] flex overflow-x-auto shadow-2xl z-10 animate-in slide-in-from-bottom duration-150">
              {tracks.map((t) => (
                <div
                  key={t.id}
                  className="w-28 flex-none border-r border-[#1a1b22] p-2.5 flex flex-col justify-between bg-[#121319]"
                >
                  <span className="text-[11px] font-bold text-white truncate text-center">{t.name}</span>

                  {/* Fader & Stereo Meter Column */}
                  <div className="flex-1 flex items-center justify-center gap-3 py-2">
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.05}
                      value={t.volume}
                      onChange={(e) => setTracks((ts) => ts.map((tk) => tk.id === t.id ? { ...tk, volume: Number(e.target.value) } : tk))}
                      style={{ writingMode: "vertical-lr" }}
                      className="h-28 accent-[#d4af37] cursor-pointer"
                    />
                    <div className="h-28 w-2 bg-black rounded-sm border border-zinc-800 overflow-hidden flex flex-col-reverse p-0.5">
                      <div
                        style={{ height: `${Math.round(t.volume * 90)}%` }}
                        className="w-full bg-gradient-to-t from-emerald-500 via-amber-400 to-red-500 rounded-sm"
                      />
                    </div>
                  </div>

                  {/* Pan & Solo/Mute */}
                  <div className="flex flex-col gap-1.5 text-center">
                    <span className="text-[9px] text-zinc-500 font-mono">PAN {t.pan === 0 ? "C" : t.pan}</span>
                    <div className="flex justify-center gap-1.5">
                      <button
                        onClick={() => setTracks((ts) => ts.map((tk) => tk.id === t.id ? { ...tk, mute: !tk.mute } : tk))}
                        className={`h-5 w-7 rounded text-[9px] font-bold ${t.mute ? "bg-blue-500 text-white" : "bg-zinc-800 text-zinc-400"}`}
                      >
                        M
                      </button>
                      <button
                        onClick={() => setTracks((ts) => ts.map((tk) => tk.id === t.id ? { ...tk, solo: !tk.solo } : tk))}
                        className={`h-5 w-7 rounded text-[9px] font-bold ${t.solo ? "bg-amber-500 text-black" : "bg-zinc-800 text-zinc-400"}`}
                      >
                        S
                      </button>
                    </div>
                  </div>
                </div>
              ))}

              {/* Dedicated Master Output Strip */}
              <div className="w-32 flex-none bg-[#090a0d] border-l-2 border-zinc-800 p-2.5 flex flex-col justify-between">
                <span className="text-[11px] font-black text-[#d4af37] uppercase text-center tracking-wider">MASTER BUS</span>
                <div className="flex-1 flex items-center justify-center gap-3 py-2">
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={masterVolume}
                    onChange={(e) => setMasterVolume(Number(e.target.value))}
                    style={{ writingMode: "vertical-lr" }}
                    className="h-28 accent-[#d4af37] cursor-pointer"
                  />
                  <div className="h-28 w-2.5 bg-black rounded border border-zinc-800 overflow-hidden flex flex-col-reverse p-0.5">
                    <div
                      style={{ height: `${Math.round(masterVolume * 95)}%` }}
                      className="w-full bg-gradient-to-t from-emerald-500 via-amber-400 to-red-500"
                    />
                  </div>
                </div>
                <span className="text-[9px] font-mono text-center text-zinc-500">0.0 dB LIMITER</span>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* 4. FLOATING PIANO ROLL & KEYBOARD */}
      {instrumentWindowOpen && (
        <div className="absolute bottom-6 right-8 z-40 w-[640px] h-[340px] rounded-xl border border-zinc-700 bg-[#14151a] shadow-2xl flex flex-col overflow-hidden">
          <div className="flex h-9 items-center justify-between border-b border-zinc-800 bg-[#1c1d24] px-3 select-none">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                🎹 {selectedTrack?.instrument}
              </span>
              <div className="flex rounded bg-black/40 p-0.5 text-[10px]">
                <button
                  onClick={() => setInstrumentTab("keyboard")}
                  className={`px-2 py-0.5 rounded ${instrumentTab === "keyboard" ? "bg-[#d4af37] text-black font-bold" : "text-zinc-400 hover:text-white"}`}
                >
                  Keys
                </button>
                <button
                  onClick={() => setInstrumentTab("pianoroll")}
                  className={`px-2 py-0.5 rounded ${instrumentTab === "pianoroll" ? "bg-[#d4af37] text-black font-bold" : "text-zinc-400 hover:text-white"}`}
                >
                  Piano Roll
                </button>
              </div>
            </div>
            <button onClick={() => setInstrumentWindowOpen(false)} className="h-6 w-6 rounded hover:bg-red-500 text-zinc-400 hover:text-white text-xs font-bold">✕</button>
          </div>

          {instrumentTab === "pianoroll" && (
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
          )}

          {instrumentTab === "keyboard" && (
            <div className="flex-1 bg-[#0d0e12] p-4 flex flex-col items-center justify-center select-none">
              <p className="text-[11px] text-zinc-400 mb-3">
                Click any key to play notes into <span className="text-[#d4af37] font-bold">{selectedTrack?.name}</span>:
              </p>
              <div className="relative flex h-40 select-none bg-black p-1 rounded border border-zinc-800 shadow-2xl">
                {[
                  { n: "C3", p: 48 }, { n: "D3", p: 50 }, { n: "E3", p: 52 },
                  { n: "F3", p: 53 }, { n: "G3", p: 55 }, { n: "A3", p: 57 },
                  { n: "B3", p: 59 }, { n: "C4", p: 60 }, { n: "D4", p: 62 },
                  { n: "E4", p: 64 }, { n: "F4", p: 65 }, { n: "G4", p: 67 },
                  { n: "A4", p: 69 }, { n: "B4", p: 71 }, { n: "C5", p: 72 },
                ].map((k) => (
                  <button
                    key={k.p}
                    onClick={() => playSynthesizerVoice(k.p, selectedTrack?.instrument ?? "Acoustic Grand Piano")}
                    className="relative w-9 h-full rounded-b border border-zinc-500 bg-gradient-to-b from-zinc-100 to-zinc-300 active:bg-[#d4af37] text-zinc-900 flex flex-col justify-end pb-2 items-center text-[10px] font-bold shadow-md hover:to-white"
                  >
                    {k.n}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 5. MODALS (Amp, AI Coach, New Track) */}
      <GuitarAmpModal isOpen={ampModalOpen} onClose={() => setAmpModalOpen(false)} trackName={selectedTrack?.name ?? "Guitar Track"} />
      <AiCoachModal isOpen={aiCoachOpen} onClose={() => setAiCoachOpen(false)} currentKey="C" bpm={bpm} />

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
