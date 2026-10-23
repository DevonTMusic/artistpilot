"use client";
import React, { useEffect, useRef, useState } from "react";

type Track = {
  id: number;
  name: string;
  instrument: string;
  buffer: AudioBuffer | null;
  blob: Blob | null;
  vol: number;
  pan: number;
  mute: boolean;
  solo: boolean;
};

const INSTRUMENTS = [
  { name: "Audio Track", icon: "🎙️", color: "from-blue-600 to-blue-500" },
  { name: "Grand Piano", icon: "🎹", color: "from-emerald-600 to-emerald-500" },
  { name: "Acoustic Guitar", icon: "🎸", color: "from-amber-600 to-amber-500" },
  { name: "Classic Bass", icon: "🎸", color: "from-purple-600 to-purple-500" },
  { name: "Drum Kit", icon: "🥁", color: "from-red-600 to-red-500" },
];

const MAX_TRACKS = 8;
const MAX_SECONDS = 180;

// Musical Notes for the virtual interactive keyboard
const PIANO_KEYS = [
  { note: "C3", freq: 130.81, isBlack: false, key: "a" },
  { note: "C#3", freq: 138.59, isBlack: true, key: "w" },
  { note: "D3", freq: 146.83, isBlack: false, key: "s" },
  { note: "D#3", freq: 155.56, isBlack: true, key: "e" },
  { note: "E3", freq: 164.81, isBlack: false, key: "d" },
  { note: "F3", freq: 174.61, isBlack: false, key: "f" },
  { note: "F#3", freq: 185.0, isBlack: true, key: "t" },
  { note: "G3", freq: 196.0, isBlack: false, key: "g" },
  { note: "G#3", freq: 207.65, isBlack: true, key: "y" },
  { note: "A3", freq: 220.0, isBlack: false, key: "h" },
  { note: "A#3", freq: 233.08, isBlack: true, key: "u" },
  { note: "B3", freq: 246.94, isBlack: false, key: "j" },
  { note: "C4", freq: 261.63, isBlack: false, key: "k" },
  { note: "C#4", freq: 277.18, isBlack: true, key: "o" },
  { note: "D4", freq: 293.66, isBlack: false, key: "l" },
  { note: "D#4", freq: 311.13, isBlack: true, key: "p" },
  { note: "E4", freq: 329.63, isBlack: false, key: ";" },
];

function toWav(b: AudioBuffer) {
  const ch = b.numberOfChannels; const len = b.length * ch * 2;
  const buf = new ArrayBuffer(44 + len); const v = new DataView(buf);
  const w = (o: number, s: string) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  w(0, "RIFF"); v.setUint32(4, 36 + len, true); w(8, "WAVEfmt "); v.setUint32(16, 16, true);
  v.setUint16(20, 1, true); v.setUint16(22, ch, true); v.setUint32(24, b.sampleRate, true);
  v.setUint32(28, b.sampleRate * ch * 2, true); v.setUint16(32, ch * 2, true); v.setUint16(34, 16, true);
  w(36, "data"); v.setUint32(40, len, true);
  const data = Array.from({ length: ch }, (_, i) => b.getChannelData(i)); let o = 44;
  for (let i = 0; i < b.length; i++) for (let k = 0; k < ch; k++) {
    const s = Math.max(-1, Math.min(1, data[k][i])); v.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7fff, true); o += 2;
  }
  return new Blob([buf], { type: "audio/wav" });
}

function WaveformClip({ buffer, name }: { buffer: AudioBuffer | null; name: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current; if (!cv || !buffer) return;
    const g = cv.getContext("2d"); if (!g) return;
    g.clearRect(0, 0, cv.width, cv.height);
    const d = buffer.getChannelData(0); const step = Math.max(1, Math.floor(d.length / cv.width));
    g.fillStyle = "rgba(255, 255, 255, 0.85)";
    for (let x = 0; x < cv.width; x++) {
      let m = 0;
      for (let i = 0; i < step; i += 32) m = Math.max(m, Math.abs(d[x * step + i] || 0));
      const h = Math.max(1.5, m * cv.height);
      g.fillRect(x, (cv.height - h) / 2, 1, h);
    }
  }, [buffer]);

  if (!buffer) return null;

  return (
    <div className="absolute left-2 top-1 bottom-1 w-[420px] rounded-sm border border-sky-300/60 bg-[#3572b0] shadow-md overflow-hidden flex flex-col">
      <div className="h-4 bg-[#4a89cc] px-2 text-[10px] font-semibold text-white/90 border-b border-sky-300/40 truncate">
        {name}
      </div>
      <div className="flex-1">
        <canvas ref={ref} width={420} height={50} className="h-full w-full opacity-90" />
      </div>
    </div>
  );
}

export default function Studio({ defaultBpm = 118 }: { defaultBpm?: number }) {
  const nextId = useRef(1);
  const blank = (name?: string, instr?: string): Track => {
    const id = nextId.current++;
    return { id, name: name ?? `Audio ${id}`, instrument: instr ?? "Audio Track", buffer: null, blob: null, vol: 0.8, pan: 0, mute: false, solo: false };
  };

  const [tracks, setTracks] = useState<Track[]>(() => [blank("Audio 1", "Audio Track"), blank("Audio 2", "Audio Track")]);
  const [selectedTrack, setSelectedTrack] = useState<number>(1);
  const [bpm, setBpm] = useState(defaultBpm);
  const [playing, setPlaying] = useState(false);
  const [rec, setRec] = useState<number | null>(null);
  const [metronome, setMetronome] = useState(false);
  const [activeBottomTab, setActiveBottomTab] = useState<"smart" | "keyboard">("keyboard");
  const [masterVol, setMasterVol] = useState(0.85);

  const ctxRef = useRef<AudioContext | null>(null);
  const stopRef = useRef<(() => void) | null>(null);
  const recRef = useRef<MediaRecorder | null>(null);

  const getCtx = () => { if (!ctxRef.current) ctxRef.current = new AudioContext(); return ctxRef.current; };
  const update = (id: number, patch: Partial<Track>) => setTracks((ts) => ts.map((t) => (t.id === id ? { ...t, ...patch } : t)));

  // Play synthetic piano note (Web Audio)
  const playNote = (freq: number) => {
    const c = getCtx();
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(freq, c.currentTime);
    gain.gain.setValueAtTime(0.3, c.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 1.2);
    osc.connect(gain);
    gain.connect(c.destination);
    osc.start();
    osc.stop(c.currentTime + 1.3);
  };

  function stop() { stopRef.current?.(); stopRef.current = null; setPlaying(false); }

  async function play() {
    const c = getCtx(); await c.resume(); stop();
    const master = c.createGain();
    master.gain.value = masterVol;
    master.connect(c.destination);

    const hasSolo = tracks.some((t) => t.solo);
    tracks.forEach((tr) => {
      if (!tr.buffer || tr.mute || (hasSolo && !tr.solo)) return;
      const s = c.createBufferSource(); s.buffer = tr.buffer;
      const g = c.createGain(); g.gain.value = tr.vol;
      const p = c.createStereoPanner(); p.pan.value = tr.pan;
      s.connect(g); g.connect(p); p.connect(master);
      s.start(c.currentTime + 0.05);
    });

    setPlaying(true);
  }

  async function record(id: number) {
    if (rec !== null) { recRef.current?.stop(); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const c = getCtx(); const mr = new MediaRecorder(stream); const chunks: Blob[] = [];
      mr.ondataavailable = (e) => chunks.push(e.data);
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop()); stop(); setRec(null);
        const blob = new Blob(chunks, { type: mr.mimeType || "audio/webm" });
        try {
          const buffer = await c.decodeAudioData(await blob.arrayBuffer());
          update(id, { buffer, blob });
        } catch {}
      };
      recRef.current = mr; setRec(id); mr.start();
      await play();
    } catch { alert("Please allow microphone permissions."); }
  }

  async function exportWav() {
    try {
      const longest = Math.max(0, ...tracks.map((t) => t.buffer?.duration ?? 0));
      if (longest === 0) return alert("Record something first!");
      const sr = getCtx().sampleRate;
      const oc = new OfflineAudioContext(2, Math.ceil(sr * longest), sr);
      tracks.forEach((tr) => {
        if (!tr.buffer || tr.mute) return;
        const s = oc.createBufferSource(); s.buffer = tr.buffer;
        const g = oc.createGain(); g.gain.value = tr.vol;
        s.connect(g); g.connect(oc.destination);
        s.start(0);
      });
      const rendered = await oc.startRendering();
      const wav = toWav(rendered);
      const a = document.createElement("a");
      a.href = URL.createObjectURL(wav);
      a.download = "GarageBand-ArtistPilot.wav";
      a.click();
    } catch {}
  }

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-[#2d2f34] text-zinc-300 font-sans select-none">
      
      {/* 1. GARAGEBAND TOP TRANSPORT CONTROL BAR */}
      <div className="flex h-14 flex-none items-center justify-between border-b border-[#1c1d21] bg-[#3a3d45] px-4 shadow-md">
        
        {/* Left: Add Track & Quick Tools */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => tracks.length < MAX_TRACKS && setTracks([...tracks, blank()])}
            className="flex h-8 w-8 items-center justify-center rounded-md border border-[#2b2d33] bg-[#4a4d56] text-lg font-bold text-zinc-100 hover:bg-[#565963] shadow-inner"
            title="New Track"
          >
            +
          </button>
          <button
            onClick={exportWav}
            className="rounded border border-[#2b2d33] bg-[#4a4d56] px-2.5 py-1 text-xs font-semibold text-zinc-200 hover:bg-[#565963]"
          >
            Share / Export
          </button>
        </div>

        {/* Center: GarageBand Transport Buttons + LCD Display */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            {/* Rewind */}
            <button onClick={() => { stop(); }} className="h-8 w-8 rounded text-zinc-400 hover:text-white text-sm">⏪</button>
            {/* Stop */}
            <button onClick={stop} className="h-8 w-8 rounded text-zinc-300 hover:text-white text-sm">◼</button>
            {/* Play */}
            <button
              onClick={() => (playing ? stop() : play())}
              className={`h-8 w-9 rounded text-base font-bold transition flex items-center justify-center ${
                playing ? "bg-[#367fc9] text-white" : "bg-[#4a4d56] text-white hover:bg-[#565963]"
              }`}
            >
              ▶
            </button>
            {/* GarageBand Big Red Record Button */}
            <button
              onClick={() => record(selectedTrack)}
              className={`h-8 w-8 rounded-full border border-red-900 shadow transition flex items-center justify-center ${
                rec !== null ? "bg-red-500 text-white animate-pulse" : "bg-[#a82222] text-white hover:bg-red-600"
              }`}
              title="Record to Selected Track"
            >
              <div className="h-3.5 w-3.5 rounded-full bg-white shadow" />
            </button>
          </div>

          {/* Authentic GarageBand LCD Display Box */}
          <div className="flex h-10 items-center divide-x divide-[#00000088] rounded-md border border-[#1b1c20] bg-[#111215] px-3 font-mono text-cyan-400 shadow-inner">
            <div className="pr-3 text-center">
              <span className="text-base font-bold tracking-widest text-zinc-100">001. 1</span>
              <p className="text-[8px] text-zinc-500 uppercase tracking-tighter">Bars</p>
            </div>
            <div className="px-3 text-center">
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  value={bpm}
                  onChange={(e) => setBpm(Number(e.target.value) || 120)}
                  className="w-9 bg-transparent text-sm font-bold text-zinc-100 focus:outline-none"
                />
              </div>
              <p className="text-[8px] text-zinc-500 uppercase">Tempo</p>
            </div>
            <div className="px-3 text-center">
              <span className="text-xs font-bold text-zinc-300">4/4</span>
              <p className="text-[8px] text-zinc-500 uppercase">Sig</p>
            </div>
            <div className="pl-3 text-center">
              <span className="text-xs font-bold text-zinc-300">C maj</span>
              <p className="text-[8px] text-zinc-500 uppercase">Key</p>
            </div>
          </div>

          {/* Metronome */}
          <button
            onClick={() => setMetronome(!metronome)}
            className={`h-8 rounded px-2.5 text-xs font-semibold border ${
              metronome ? "border-purple-500 bg-purple-900/40 text-purple-300" : "border-[#2b2d33] bg-[#4a4d56] text-zinc-400"
            }`}
          >
            1234
          </button>
        </div>

        {/* Right: Master Volume Slider */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-400">🔈</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={masterVol}
            onChange={(e) => setMasterVol(Number(e.target.value))}
            className="w-24 accent-[#3572b0] h-1.5 bg-[#1e2025] rounded cursor-pointer"
          />
        </div>
      </div>

      {/* 2. TIMELINE RULER BAR */}
      <div className="flex h-6 flex-none border-b border-[#212328] bg-[#22242a] text-[10px] text-zinc-400">
        <div className="w-64 flex-none border-r border-[#1c1d22] px-3 flex items-center justify-between font-bold text-zinc-400">
          TRACKS
        </div>
        <div className="flex-1 flex items-center px-4 space-x-16 overflow-hidden select-none">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16].map((bar) => (
            <div key={bar} className="flex items-center gap-2 text-zinc-500 font-mono">
              <span>{bar}</span>
              <div className="h-2 w-[1px] bg-zinc-700" />
            </div>
          ))}
        </div>
      </div>

      {/* 3. ARRANGER: TRACK HEADERS + BLUE AUDIO REGIONS */}
      <div className="flex-1 overflow-y-auto divide-y divide-[#202126] bg-[#1a1b1f]">
        {tracks.map((t) => {
          const isSelected = selectedTrack === t.id;
          return (
            <div
              key={t.id}
              onClick={() => setSelectedTrack(t.id)}
              className={`flex h-20 transition ${isSelected ? "bg-[#33363f]" : "bg-[#282a30] hover:bg-[#2e3038]"}`}
            >
              {/* Left Track Header (Classic GarageBand Card) */}
              <div className="w-64 flex-none border-r border-[#1c1d22] p-2 flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {/* Blue Instrument Icon */}
                    <div className="flex h-7 w-7 items-center justify-center rounded-md bg-gradient-to-b from-[#3a78b5] to-[#245382] shadow text-xs">
                      🎙️
                    </div>
                    <span className="text-xs font-semibold text-white truncate w-24">{t.name}</span>
                  </div>
                  {/* Delete track */}
                  {tracks.length > 1 && (
                    <button
                      onClick={(e) => { e.stopPropagation(); setTracks(tracks.filter((tk) => tk.id !== t.id)); }}
                      className="text-zinc-500 hover:text-red-400 text-xs px-1"
                    >
                      ✕
                    </button>
                  )}
                </div>

                {/* Track controls: Mute, Solo, Record, Vol fader */}
                <div className="flex items-center justify-between pt-1 text-[10px]">
                  <div className="flex items-center gap-1">
                    {/* Mute */}
                    <button
                      onClick={(e) => { e.stopPropagation(); update(t.id, { mute: !t.mute }); }}
                      className={`h-5 w-5 rounded text-[9px] font-bold ${
                        t.mute ? "bg-blue-500 text-white" : "bg-[#3a3d46] text-zinc-400 hover:bg-[#484b55]"
                      }`}
                    >
                      M
                    </button>
                    {/* Solo */}
                    <button
                      onClick={(e) => { e.stopPropagation(); update(t.id, { solo: !t.solo }); }}
                      className={`h-5 w-5 rounded text-[9px] font-bold ${
                        t.solo ? "bg-amber-500 text-black" : "bg-[#3a3d46] text-zinc-400 hover:bg-[#484b55]"
                      }`}
                    >
                      S
                    </button>
                    {/* Record Arm */}
                    <button
                      onClick={(e) => { e.stopPropagation(); record(t.id); }}
                      className={`h-5 w-5 rounded-full flex items-center justify-center font-bold text-[9px] ${
                        rec === t.id ? "bg-red-500 text-white animate-pulse" : "bg-[#3a3d46] text-red-400 hover:bg-[#484b55]"
                      }`}
                    >
                      ●
                    </button>
                  </div>

                  {/* Volume Slider */}
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={t.vol}
                    onChange={(e) => update(t.id, { vol: Number(e.target.value) })}
                    className="w-16 accent-zinc-300 h-1 bg-[#1a1b1f] rounded cursor-pointer"
                  />
                </div>
              </div>

              {/* Right Arranger Lane with Blue GarageBand Region */}
              <div className="flex-1 relative bg-[#1f2026] border-b border-[#292b33]">
                <WaveformClip buffer={t.buffer} name={t.name} />
              </div>
            </div>
          );
        })}
      </div>

      {/* 4. GARAGEBAND BOTTOM DRAWER (Smart Controls & Musical Instruments) */}
      <div className="flex-none border-t border-[#1a1b20] bg-[#22242a] h-56 flex flex-col shadow-2xl">
        {/* Drawer Tabs */}
        <div className="flex h-8 items-center justify-between border-b border-[#1b1c21] bg-[#2d3038] px-4 text-xs font-semibold">
          <div className="flex items-center gap-1">
            <button
              onClick={() => setActiveBottomTab("keyboard")}
              className={`rounded px-3 py-1 ${activeBottomTab === "keyboard" ? "bg-[#387ec7] text-white" : "text-zinc-400 hover:text-white"}`}
            >
              Virtual Keyboard (Piano)
            </button>
            <button
              onClick={() => setActiveBottomTab("smart")}
              className={`rounded px-3 py-1 ${activeBottomTab === "smart" ? "bg-[#387ec7] text-white" : "text-zinc-400 hover:text-white"}`}
            >
              Smart Controls & EQ
            </button>
          </div>
          <span className="text-[11px] text-zinc-400">Track: {tracks.find((t) => t.id === selectedTrack)?.name}</span>
        </div>

        {/* Tab 1: Virtual Piano Keyboard (Playable by Clicking) */}
        {activeBottomTab === "keyboard" && (
          <div className="flex-1 bg-[#15161a] p-3 flex flex-col items-center justify-center">
            <p className="text-[11px] text-zinc-500 mb-1">Click the keys to play notes directly into your session:</p>
            <div className="relative flex h-36 select-none bg-zinc-950 p-1.5 rounded-b-lg border border-zinc-800 shadow-2xl">
              {PIANO_KEYS.map((k) => {
                if (k.isBlack) return null;
                return (
                  <button
                    key={k.note}
                    onClick={() => playNote(k.freq)}
                    className="relative w-10 h-full rounded-b border border-zinc-400 bg-gradient-to-b from-zinc-100 to-zinc-300 text-zinc-800 hover:from-white hover:to-zinc-200 active:bg-zinc-400 shadow flex flex-col justify-end pb-2 items-center text-[10px] font-bold"
                  >
                    <span className="text-[9px] text-zinc-400 uppercase">{k.key}</span>
                    {k.note}
                  </button>
                );
              })}

              {/* Black Keys overlaid */}
              <div className="absolute top-1.5 left-1.5 flex pointer-events-none">
                {PIANO_KEYS.map((k, idx) => {
                  if (!k.isBlack) return <div key={idx} className="w-10 pointer-events-none" />;
                  return (
                    <button
                      key={k.note}
                      onClick={() => playNote(k.freq)}
                      style={{ marginLeft: "-14px", marginRight: "-14px" }}
                      className="pointer-events-auto z-10 w-7 h-20 rounded-b border border-black bg-gradient-to-b from-zinc-800 to-black text-white hover:bg-zinc-700 active:bg-zinc-900 shadow-lg flex flex-col justify-end pb-1 items-center text-[8px] font-bold"
                    >
                      <span className="text-[8px] text-zinc-500 uppercase">{k.key}</span>
                      {k.note}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Smart Controls Hardware Knobs */}
        {activeBottomTab === "smart" && (
          <div className="flex-1 bg-gradient-to-b from-[#24262c] to-[#1c1d22] p-4 flex items-center justify-around">
            {/* Skeuomorphic Hardware Dials */}
            {[
              { label: "COMPRESSOR", val: "50%" },
              { label: "LOW EQ", val: "0.0 dB" },
              { label: "MID EQ", val: "+2.0 dB" },
              { label: "HIGH EQ", val: "+1.5 dB" },
              { label: "REVERB", val: "25%" },
            ].map((knob, i) => (
              <div key={i} className="flex flex-col items-center gap-1.5">
                <span className="text-[10px] font-bold text-zinc-400 tracking-wider">{knob.label}</span>
                <div className="h-14 w-14 rounded-full border-2 border-zinc-700 bg-gradient-to-b from-[#3a3d45] to-[#1a1b1f] shadow-lg flex items-center justify-center relative cursor-pointer">
                  <div className="h-2 w-0.5 bg-cyan-400 absolute top-1 rounded" />
                  <div className="h-4 w-4 rounded-full bg-zinc-800 shadow-inner" />
                </div>
                <span className="text-[9px] font-mono text-cyan-400">{knob.val}</span>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
