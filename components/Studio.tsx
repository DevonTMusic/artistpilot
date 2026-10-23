// components/Studio.tsx
"use client";
import React, { useEffect, useRef, useState } from "react";
import { AudioEngine } from "@/lib/daw/AudioEngine";
import { TrackData, AudioRegion } from "@/lib/daw/types";
import { ClipRegion } from "@/components/daw/ClipRegion";

const INSTRUMENT_PRESETS = [
  { name: "Audio / Microphone", category: "audio" as const, color: "bg-[#2563eb]", icon: "🎙️", desc: "Vocals, guitars, or live hardware" },
  { name: "Acoustic Grand Piano", category: "midi" as const, color: "bg-[#059669]", icon: "🎹", desc: "Dynamic velocity-sensitive keys" },
  { name: "Electric Guitar Clean", category: "audio" as const, color: "bg-[#d97706]", icon: "🎸", desc: "Clean combo amp direct input" },
  { name: "Classic Bass Guitar", category: "midi" as const, color: "bg-[#7c3aed]", icon: "🎸", desc: "Warm punchy low-end bass" },
  { name: "Drum Machine Beatmaker", category: "drum" as const, color: "bg-[#dc2626]", icon: "🥁", desc: "Electronic 808/909 step sequencer" },
];

export default function Studio({ defaultBpm = 120 }: { defaultBpm?: number }) {
  const engine = useRef<AudioEngine>(AudioEngine.getInstance());
  const [tracks, setTracks] = useState<TrackData[]>([
    {
      id: 1,
      name: "Lead Vocal",
      category: "audio",
      instrument: "Audio / Microphone",
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

  const [bpm, setBpm] = useState(defaultBpm);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [playheadSec, setPlayheadSec] = useState(0);
  const [selectedTrackId, setSelectedTrackId] = useState(1);
  const [pixelsPerSecond, setPixelsPerSecond] = useState(42);
  const [trackModalOpen, setTrackModalOpen] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");

  const animFrame = useRef<number | null>(null);
  const playStartTime = useRef(0);
  const playheadAnchor = useRef(0);
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const recChunks = useRef<Blob[]>([]);
  const recStartTime = useRef(0);

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
            name: `Rec ${new Date().toLocaleTimeString([], { minute: "2-digit", second: "2-digit" })}`,
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
          setStatusMsg("Failed to decode audio data.");
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
    setStatusMsg("Rendering master WAV mixdown...");
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
    setStatusMsg("Export complete! Download started.");
  };

  const updateTrack = (id: number, patch: Partial<TrackData>) => {
    setTracks((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  };

  const updateRegion = (trackId: number, regionId: string, patch: Partial<AudioRegion>) => {
    setTracks((prev) =>
      prev.map((t) =>
        t.id === trackId
          ? {
              ...t,
              regions: t.regions.map((r) => (r.id === regionId ? { ...r, ...patch } : r)),
            }
          : t
      )
    );
  };

  const deleteRegion = (trackId: number, regionId: string) => {
    setTracks((prev) =>
      prev.map((t) =>
        t.id === trackId ? { ...t, regions: t.regions.filter((r) => r.id !== regionId) } : t
      )
    );
  };

  const splitRegion = (trackId: number, regionId: string, splitTimeSec: number) => {
    setTracks((prev) =>
      prev.map((t) => {
        if (t.id !== trackId) return t;
        const reg = t.regions.find((r) => r.id === regionId);
        if (!reg || splitTimeSec <= reg.startTime || splitTimeSec >= reg.startTime + reg.duration)
          return t;

        const firstDuration = splitTimeSec - reg.startTime;
        const secondDuration = reg.duration - firstDuration;
        const r1: AudioRegion = { ...reg, duration: firstDuration };
        const r2: AudioRegion = {
          ...reg,
          id: `reg-${Date.now()}`,
          name: `${reg.name} (B)`,
          startTime: splitTimeSec,
          offset: reg.offset + firstDuration,
          duration: secondDuration,
        };

        return { ...t, regions: t.regions.flatMap((r) => (r.id === regionId ? [r1, r2] : r)) };
      })
    );
  };

  const addTrackFromPreset = (preset: (typeof INSTRUMENT_PRESETS)[0]) => {
    const id = Date.now();
    setTracks((prev) => [
      ...prev,
      {
        id,
        name: `${preset.name} ${prev.length + 1}`,
        category: preset.category,
        instrument: preset.name,
        color: preset.color,
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
  };

  const totalBeats = (playheadSec * bpm) / 60;
  const currentBar = Math.floor(totalBeats / 4) + 1;
  const currentBeat = (Math.floor(totalBeats) % 4) + 1;

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-[#18191d] text-zinc-300 font-sans select-none">
      
      {/* 1. TOP TRANSPORT BAR */}
      <div className="flex h-14 flex-none items-center justify-between border-b border-[#2a2c33] bg-[#22242a] px-4 shadow-md">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setTrackModalOpen(true)}
            className="flex h-8 items-center gap-1.5 rounded bg-[#3572b0] px-3 text-xs font-bold text-white shadow hover:bg-[#4182c4]"
          >
            <span>+</span> Track
          </button>
        </div>

        {/* Center: Controls + GarageBand LCD */}
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
              <span className="text-sm font-bold tracking-widest text-white">
                {String(currentBar).padStart(3, "0")}. {currentBeat}
              </span>
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

        {/* Right: Zoom & Export */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-zinc-500">Zoom</span>
            <input
              type="range"
              min={20}
              max={100}
              value={pixelsPerSecond}
              onChange={(e) => setPixelsPerSecond(Number(e.target.value))}
              className="w-16 accent-[#3572b0] h-1 bg-zinc-800 rounded cursor-pointer"
            />
          </div>
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

      {/* 2. TIMELINE RULER BAR */}
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

      {/* 3. MULTI-TRACK ARRANGER (Main Grid) */}
      <div className="flex-1 overflow-y-auto divide-y divide-[#22242a] bg-[#131417] relative">
        <div
          style={{ left: `${256 + playheadSec * pixelsPerSecond}px` }}
          className="absolute top-0 bottom-0 w-[1.5px] bg-red-500 z-30 pointer-events-none"
        >
          <div className="h-2 w-2 -ml-[3px] bg-red-500 rotate-45 shadow" />
        </div>

        {tracks.map((track) => {
          const isSelected = selectedTrackId === track.id;
          return (
            <div
              key={track.id}
              onClick={() => setSelectedTrackId(track.id)}
              className={`flex h-20 transition ${isSelected ? "bg-[#202228]" : "bg-[#18191d] hover:bg-[#1c1d22]"}`}
            >
              <div className="w-64 flex-none border-r border-[#262830] p-2 flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded bg-zinc-800 shadow text-xs">
                      {INSTRUMENT_PRESETS.find((p) => p.name === track.instrument)?.icon ?? "🎙️"}
                    </div>
                    <input
                      value={track.name}
                      onChange={(e) => updateTrack(track.id, { name: e.target.value })}
                      className="w-28 bg-transparent text-xs font-bold text-white focus:outline-none focus:ring-1 focus:ring-sky-500 rounded px-1"
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
                        updateTrack(track.id, { mute: !track.mute });
                      }}
                      className={`h-5 w-5 rounded font-bold ${
                        track.mute ? "bg-blue-500 text-white" : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                      }`}
                    >
                      M
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        updateTrack(track.id, { solo: !track.solo });
                      }}
                      className={`h-5 w-5 rounded font-bold ${
                        track.solo ? "bg-amber-500 text-black" : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                      }`}
                    >
                      S
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-zinc-500 text-[9px]">VOL</span>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.05}
                      value={track.volume}
                      onChange={(e) => updateTrack(track.id, { volume: Number(e.target.value) })}
                      className="w-16 accent-[#3572b0] h-1 bg-zinc-800 rounded cursor-pointer"
                    />
                  </div>
                </div>
              </div>

              <div className="flex-1 relative overflow-hidden">
                {track.regions.map((region) => (
                  <ClipRegion
                    key={region.id}
                    region={region}
                    pixelsPerSecond={pixelsPerSecond}
                    trackColor={track.color}
                    onUpdate={(patch) => updateRegion(track.id, region.id, patch)}
                    onSplit={(splitTime) => splitRegion(track.id, region.id, splitTime)}
                    onDelete={() => deleteRegion(track.id, region.id)}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* 4. TRACK MODAL */}
      {trackModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="w-full max-w-xl rounded-xl border border-zinc-700 bg-[#22242a] p-6 shadow-2xl">
            <h2 className="text-lg font-bold text-white mb-1">New Track</h2>
            <p className="text-xs text-zinc-400 mb-5">Select an instrument or audio track to add to your session.</p>

            <div className="grid grid-cols-2 gap-3">
              {INSTRUMENT_PRESETS.map((p) => (
                <button
                  key={p.name}
                  onClick={() => addTrackFromPreset(p)}
                  className="flex items-center gap-3 rounded-lg border border-zinc-700 bg-[#17181c] p-3 text-left transition hover:border-[#3572b0] hover:bg-[#1e2025]"
                >
                  <div className="flex h-10 w-10 flex-none items-center justify-center rounded bg-zinc-800 text-xl shadow">
                    {p.icon}
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-white">{p.name}</h3>
                    <p className="text-[10px] text-zinc-400">{p.desc}</p>
                  </div>
                </button>
              ))}
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setTrackModalOpen(false)}
                className="rounded bg-zinc-700 px-4 py-1.5 text-xs font-semibold text-white hover:bg-zinc-600"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
