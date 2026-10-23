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
      if (!isPlaying) handlePlay();
    } catch {
      setStatusMsg("Microphone access was denied. Please allow it in browser settings.");
    }
  };

  const handleExport = async () => {
    setStatusMsg("Rendering WAV mixdown...");
    const totalDuration = Math.max(
      6,
      ...tracks.flatMap((t) => t.regions.map((r) => r.startTime + r.duration))
    );
    const blob = await engine.current.exportMasterWav(tracks, totalDuration);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ArtistPilot-Master-${Date.now()}.wav`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    setStatusMsg("Export complete!");
  };

  const selectedTrack = tracks.find((t) => t.id === selectedTrackId);
  const currentNotes = trackNotes[selectedTrackId] || [];

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-[#18191d] text-zinc-300 font-sans select-none relative">
      
      {/* 1. TOP TRANSPORT BAR */}
      <div className="flex h-14 flex-none items-center justify-between border-b border-[#2a2c33] bg-[#22242a] px-4 shadow-md z-10">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setTrackModalOpen(true)}
            className="flex h-8 items-center gap-1.5 rounded bg-[#3572b0] px-3 text-xs font-bold text-white shadow hover:bg-[#4182c4]"
          >
            <span>+</span> Track
          </button>

          {/* Pop-up Toggle Button */}
          <button
            onClick={() => setInstrumentWindowOpen(!instrumentWindowOpen)}
            className={`flex h-8 items-center gap-1.5 rounded border px-3 text-xs font-bold transition shadow ${
              instrumentWindowOpen
                ? "border-sky-500 bg-sky-950/60 text-sky-300"
                : "border-zinc-700 bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
            }`}
          >
            <span>🎹</span> {instrumentWindowOpen ? "Hide Instrument Window" : "Open Instrument / Piano Roll"}
          </button>
          
          <div className="flex items-center gap-1.5 rounded-full border border-zinc-700 bg-zinc-900/60 px-2.5 py-1 text-[11px]">
            <span className={`h-2 w-2 rounded-full ${midiConnected ? "bg-emerald-400 shadow-sm shadow-emerald-400" : "bg-zinc-600"}`} />
            <span className="text-zinc-400 font-medium">{midiConnected ? "Hardware MIDI Active" : "MIDI In Ready"}</span>
          </div>
        </div>

        {/* Center: Controls + Timecode */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <button onClick={handleStop} className="h-8 w-8 rounded text-zinc-300 hover:text-white">◼</button>
            <button
              onClick={handlePlay}
              className={`h-8 w-10 rounded font-black text-sm flex items-center justify-center ${
                isPlaying ? "bg-[#3572b0] text-white" : "bg-zinc-700 hover:bg-zinc-600 text-white"
              }`}
            >
              {isPlaying ? "❚❚" : "▶"}
            </button>
            <button
              onClick={handleRecord}
              className={`h-8 w-8 rounded-full border border-red-950 flex items-center justify-center ${
                isRecording ? "bg-red-500 animate-pulse text-white" : "bg-[#a82222] hover:bg-red-600"
              }`}
            >
              <div className="h-3 w-3 rounded-full bg-white shadow" />
            </button>
          </div>

          <div className="flex h-9 items-center divide-x divide-zinc-800 rounded border border-zinc-800 bg-[#0d0e11] px-3 font-mono text-cyan-400">
            <div className="pr-3 text-center">
              <span className="text-sm font-bold tracking-widest text-white">001. 1</span>
              <p className="text-[7px] text-zinc-500 uppercase">Bars.Beat</p>
            </div>
            <div className="px-3 text-center">
              <input
                type="number"
                value={bpm}
                onChange={(e) => setBpm(Number(e.target.value) || 120)}
                className="w-10 bg-transparent text-sm font-bold text-white focus:outline-none"
              />
              <p className="text-[7px] text-zinc-500 uppercase">Tempo</p>
            </div>
            <div className="pl-3 text-center">
              <span className="text-xs font-semibold text-zinc-300">4/4 C</span>
              <p className="text-[7px] text-zinc-500 uppercase">Key</p>
            </div>
          </div>
        </div>

        {/* Right: Export */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleExport}
            className="rounded border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs font-bold text-white hover:bg-zinc-700"
          >
            Export Mix (.wav)
          </button>
        </div>
      </div>

      {statusMsg && (
        <div className="bg-[#121c2b] py-1 text-center text-xs text-sky-400 border-b border-sky-900/50">
          {statusMsg}
        </div>
      )}

      {/* 2. TIMELINE RULER */}
      <div className="flex h-7 flex-none border-b border-[#25272e] bg-[#1d1f24] text-[10px] text-zinc-500">
        <div className="w-64 flex-none border-r border-[#25272e] px-3 flex items-center font-bold text-zinc-400">
          TRACKS ({tracks.length})
        </div>
        <div className="flex-1 flex items-center relative overflow-hidden select-none">
          {Array.from({ length: 32 }, (_, i) => (
            <div
              key={i}
              style={{ left: `${(i * 4 * 60 * pixelsPerSecond) / bpm}px` }}
              className="absolute flex items-center gap-2 font-mono text-[9px] text-zinc-500"
            >
              <span>{i + 1}</span>
              <div className="h-2 w-[1px] bg-zinc-700" />
            </div>
          ))}
        </div>
      </div>

      {/* 3. MULTI-TRACK ARRANGER (Takes up all main space comfortably) */}
      <div className="flex-1 overflow-y-auto divide-y divide-[#22242a] bg-[#131417] relative">
        <div
          style={{ left: `${256 + playheadSec * pixelsPerSecond}px` }}
          className="absolute top-0 bottom-0 w-[1.5px] bg-red-500 z-30 pointer-events-none"
        />

        {tracks.map((track) => {
          const isSelected = selectedTrackId === track.id;
          return (
            <div
              key={track.id}
              onClick={() => setSelectedTrackId(track.id)}
              className={`flex h-24 transition ${isSelected ? "bg-[#202228]" : "bg-[#18191d] hover:bg-[#1c1d22]"}`}
            >
              <div className="w-64 flex-none border-r border-[#262830] p-2 flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded bg-zinc-800 shadow text-xs">
                      {INSTRUMENT_PRESETS.find((p) => p.name === track.instrument)?.icon ?? "🎙️"}
                    </div>
                    <span className="text-xs font-bold text-white truncate w-28">{track.name}</span>
                  </div>
                  <select
                    value={track.instrument}
                    onChange={(e) => {
                      const found = INSTRUMENT_PRESETS.find((p) => p.name === e.target.value);
                      if (found) {
                        setTracks((prev) =>
                          prev.map((t) =>
                            t.id === track.id
                              ? { ...t, instrument: found.name, category: found.category, color: found.color }
                              : t
                          )
                        );
                      }
                    }}
                    className="bg-[#121316] text-[10px] text-zinc-300 rounded border border-zinc-700 px-1 py-0.5"
                  >
                    {INSTRUMENT_PRESETS.map((p) => <option key={p.name} value={p.name}>{p.name}</option>)}
                  </select>
                </div>

                <div className="flex items-center justify-between text-[10px] pt-1">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setTracks((prev) => prev.map((t) => t.id === track.id ? { ...t, mute: !t.mute } : t))}
                      className={`h-5 w-5 rounded font-bold ${track.mute ? "bg-blue-500 text-white" : "bg-zinc-800 text-zinc-400"}`}
                    >
                      M
                    </button>
                    <button
                      onClick={() => setTracks((prev) => prev.map((t) => t.id === track.id ? { ...t, solo: !t.solo } : t))}
                      className={`h-5 w-5 rounded font-bold ${track.solo ? "bg-amber-500 text-black" : "bg-zinc-800 text-zinc-400"}`}
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
                    onChange={(e) => setTracks((prev) => prev.map((t) => t.id === track.id ? { ...t, volume: Number(e.target.value) } : t))}
                    className="w-16 accent-[#3572b0] h-1 bg-zinc-800 rounded"
                  />
                </div>
              </div>

              <div className="flex-1 relative overflow-hidden">
                {track.regions.map((region) => (
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
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* 4. GARAGEBAND-STYLE FLOATING POP-UP WINDOW (PIANO ROLL & KEYS) */}
      {instrumentWindowOpen && (
        <div className="absolute bottom-6 right-8 z-40 w-[640px] h-[340px] rounded-xl border border-zinc-700 bg-[#1e2027] shadow-2xl flex flex-col overflow-hidden">
          {/* Pop-up Window Title Bar */}
          <div className="flex h-9 items-center justify-between border-b border-zinc-800 bg-[#2b2d36] px-3 select-none">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                🎹 {selectedTrack?.instrument} Studio
              </span>
              <div className="flex rounded bg-black/40 p-0.5 text-[10px]">
                <button
                  onClick={() => setInstrumentTab("keyboard")}
                  className={`px-2 py-0.5 rounded ${instrumentTab === "keyboard" ? "bg-sky-600 text-white font-bold" : "text-zinc-400 hover:text-white"}`}
                >
                  Keys
                </button>
                <button
                  onClick={() => setInstrumentTab("pianoroll")}
                  className={`px-2 py-0.5 rounded ${instrumentTab === "pianoroll" ? "bg-sky-600 text-white font-bold" : "text-zinc-400 hover:text-white"}`}
                >
                  Piano Roll
                </button>
              </div>
            </div>
            
            <button
              onClick={() => setInstrumentWindowOpen(false)}
              className="h-6 w-6 rounded hover:bg-red-500/80 hover:text-white text-zinc-400 text-xs flex items-center justify-center font-bold"
            >
              ✕
            </button>
          </div>

          {/* Window Body: Piano Roll Tab */}
          {instrumentTab === "pianoroll" && (
            <div className="flex-1 overflow-hidden">
              <PianoRoll
                notes={currentNotes}
                instrumentName={selectedTrack?.instrument ?? "Grand Piano"}
                onPreviewNote={(pitch) => playSynthesizerVoice(pitch, selectedTrack?.instrument ?? "Grand Piano")}
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

          {/* Window Body: Playable Keys Tab */}
          {instrumentTab === "keyboard" && (
            <div className="flex-1 bg-[#121316] p-4 flex flex-col items-center justify-center select-none">
              <p className="text-[11px] text-zinc-400 mb-3">
                Click any key to play notes into <span className="text-sky-400 font-bold">{selectedTrack?.name}</span>:
              </p>
              
              {/* Playable Keyboard that fits completely in the window */}
              <div className="relative flex h-44 select-none bg-black p-1 rounded-b border border-zinc-800 shadow-2xl">
                {[
                  { n: "C3", p: 48, b: false },
                  { n: "D3", p: 50, b: false },
                  { n: "E3", p: 52, b: false },
                  { n: "F3", p: 53, b: false },
                  { n: "G3", p: 55, b: false },
                  { n: "A3", p: 57, b: false },
                  { n: "B3", p: 59, b: false },
                  { n: "C4", p: 60, b: false },
                  { n: "D4", p: 62, b: false },
                  { n: "E4", p: 64, b: false },
                  { n: "F4", p: 65, b: false },
                  { n: "G4", p: 67, b: false },
                  { n: "A4", p: 69, b: false },
                  { n: "B4", p: 71, b: false },
                  { n: "C5", p: 72, b: false },
                ].map((k) => (
                  <button
                    key={k.p}
                    onClick={() => playSynthesizerVoice(k.p, selectedTrack?.instrument ?? "Grand Piano")}
                    className="relative w-9 h-full rounded-b border border-zinc-400 bg-gradient-to-b from-zinc-100 to-zinc-300 active:bg-sky-400 active:from-sky-300 text-zinc-800 flex flex-col justify-end pb-2 items-center text-[10px] font-bold shadow-md hover:to-white"
                  >
                    {k.n}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 5. NEW TRACK MODAL */}
      {trackModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="w-full max-w-xl rounded-xl border border-zinc-700 bg-[#22242a] p-6 shadow-2xl">
            <h2 className="text-lg font-bold text-white mb-1">New Track</h2>
            <div className="grid grid-cols-2 gap-3 mt-4">
              {INSTRUMENT_PRESETS.map((p) => (
                <button
                  key={p.name}
                  onClick={() => {
                    const id = Date.now();
                    setTracks((prev) => [
                      ...prev,
                      {
                        id,
                        name: `${p.name} ${prev.length + 1}`,
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
                    setInstrumentWindowOpen(true);
                  }}
                  className="flex items-center gap-3 rounded-lg border border-zinc-700 bg-[#17181c] p-3 text-left hover:border-[#3572b0]"
                >
                  <div className="text-xl">{p.icon}</div>
                  <div>
                    <h3 className="text-xs font-bold text-white">{p.name}</h3>
                    <p className="text-[10px] text-zinc-400">{p.desc}</p>
                  </div>
                </button>
              ))}
            </div>
            <div className="mt-6 flex justify-end">
              <button onClick={() => setTrackModalOpen(false)} className="rounded bg-zinc-700 px-4 py-1.5 text-xs text-white">Cancel</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
