"use client";
import React, { useEffect, useRef, useState } from "react";

type InstrumentType = "Audio/Mic" | "Grand Piano" | "Electric Guitar" | "Bass Guitar" | "Drum Kit" | "Warm Pad";

type Track = {
  id: number;
  name: string;
  instrument: InstrumentType;
  buffer: AudioBuffer | null;
  blob: Blob | null;
  vol: number;
  pan: number;
  mute: boolean;
  solo: boolean;
};

const INSTRUMENT_OPTIONS: { name: InstrumentType; icon: string; desc: string; category: "audio" | "midi" | "drums" }[] = [
  { name: "Audio/Mic", icon: "🎙️", desc: "Record vocals, acoustic guitar, or external gear via microphone", category: "audio" },
  { name: "Grand Piano", icon: "🎹", desc: "Classic acoustic grand piano with dynamic response", category: "midi" },
  { name: "Electric Guitar", icon: "🎸", desc: "Bright lead guitar with harmonized overdrive", category: "midi" },
  { name: "Bass Guitar", icon: "🎸", desc: "Deep, punchy low-end electric bass", category: "midi" },
  { name: "Warm Pad", icon: "🎛️", desc: "Atmospheric lush polyphonic synth", category: "midi" },
  { name: "Drum Kit", icon: "🥁", desc: "Acoustic and electronic drum machine pads", category: "drums" },
];

const NOTES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const midiToFreq = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

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
    g.fillStyle = "rgba(255, 255, 255, 0.9)";
    for (let x = 0; x < cv.width; x++) {
      let m = 0;
      for (let i = 0; i < step; i += 32) m = Math.max(m, Math.abs(d[x * step + i] || 0));
      const h = Math.max(2, m * cv.height);
      g.fillRect(x, (cv.height - h) / 2, 1.5, h);
    }
  }, [buffer]);

  if (!buffer) return null;

  return (
    <div className="absolute left-1 top-1 bottom-1 w-[460px] rounded border border-sky-300/60 bg-[#3572b0] shadow-md overflow-hidden flex flex-col">
      <div className="h-4 bg-[#4a89cc] px-2 text-[10px] font-semibold text-white/95 border-b border-sky-300/40 truncate">
        {name}
      </div>
      <div className="flex-1">
        <canvas ref={ref} width={460} height={50} className="h-full w-full" />
      </div>
    </div>
  );
}

export default function Studio({ defaultBpm = 118 }: { defaultBpm?: number }) {
  const nextId = useRef(3);
  const [tracks, setTracks] = useState<Track[]>([
    { id: 1, name: "Lead Vocal", instrument: "Audio/Mic", buffer: null, blob: null, vol: 0.85, pan: 0, mute: false, solo: false },
    { id: 2, name: "Grand Piano", instrument: "Grand Piano", buffer: null, blob: null, vol: 0.8, pan: 0, mute: false, solo: false },
  ]);

  const [selectedTrack, setSelectedTrack] = useState<number>(1);
  const [bpm, setBpm] = useState(defaultBpm);
  const [playing, setPlaying] = useState(false);
  const [rec, setRec] = useState<number | null>(null);
  const [masterVol, setMasterVol] = useState(0.85);
  const [modalOpen, setModalOpen] = useState(false);
  const [midiConnected, setMidiConnected] = useState(false);
  const [octave, setOctave] = useState(3); // Octave 3 (C3 - B4)
  const [editingTrackId, setEditingTrackId] = useState<number | null>(null);
  const [bottomTab, setBottomTab] = useState<"keys" | "drums" | "editor">("keys");

  const ctxRef = useRef<AudioContext | null>(null);
  const stopRef = useRef<(() => void) | null>(null);
  const recRef = useRef<MediaRecorder | null>(null);

  const getCtx = () => {
    if (!ctxRef.current) ctxRef.current = new AudioContext();
    return ctxRef.current;
  };

  const update = (id: number, patch: Partial<Track>) =>
    setTracks((ts) => ts.map((t) => (t.id === id ? { ...t, ...patch } : t)));

  // Sound Engine (Web Audio synthesizers tailored for each instrument)
  const playInstrumentSound = (freq: number, instr: InstrumentType) => {
    const c = getCtx();
    const t = c.currentTime;

    if (instr === "Grand Piano") {
      const osc1 = c.createOscillator(); const osc2 = c.createOscillator();
      const gain = c.createGain();
      osc1.type = "triangle"; osc2.type = "sine";
      osc1.frequency.setValueAtTime(freq, t); osc2.frequency.setValueAtTime(freq * 2, t);
      gain.gain.setValueAtTime(0.4, t);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 1.8);
      osc1.connect(gain); osc2.connect(gain); gain.connect(c.destination);
      osc1.start(t); osc2.start(t); osc1.stop(t + 1.8); osc2.stop(t + 1.8);
    } else if (instr === "Electric Guitar") {
      const osc = c.createOscillator(); const filter = c.createBiquadFilter(); const gain = c.createGain();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(freq, t);
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(3200, t);
      filter.frequency.exponentialRampToValueAtTime(700, t + 0.6);
      gain.gain.setValueAtTime(0.35, t);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 1.2);
      osc.connect(filter); filter.connect(gain); gain.connect(c.destination);
      osc.start(t); osc.stop(t + 1.2);
    } else if (instr === "Bass Guitar") {
      const osc = c.createOscillator(); const gain = c.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(freq / 2, t);
      gain.gain.setValueAtTime(0.55, t);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 1.4);
      osc.connect(gain); gain.connect(c.destination);
      osc.start(t); osc.stop(t + 1.4);
    } else if (instr === "Warm Pad") {
      const o1 = c.createOscillator(); const o2 = c.createOscillator(); const g = c.createGain();
      o1.type = "sine"; o2.type = "triangle";
      o1.frequency.setValueAtTime(freq, t); o2.frequency.setValueAtTime(freq * 1.005, t);
      g.gain.setValueAtTime(0.01, t);
      g.gain.linearRampToValueAtTime(0.3, t + 0.2);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 2.5);
      o1.connect(g); o2.connect(g); g.connect(c.destination);
      o1.start(t); o2.start(t); o1.stop(t + 2.5); o2.stop(t + 2.5);
    } else {
      // Drum trigger if played on keys
      const o = c.createOscillator(); const g = c.createGain();
      o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(38, t + 0.15);
      g.gain.setValueAtTime(0.8, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
      o.connect(g); g.connect(c.destination);
      o.start(t); o.stop(t + 0.22);
    }
  };

  // Drum Sound Triggers
  const playDrum = (type: "kick" | "snare" | "hihat" | "clap") => {
    const c = getCtx(); const t = c.currentTime;
    if (type === "kick") {
      const o = c.createOscillator(); const g = c.createGain();
      o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.2);
      g.gain.setValueAtTime(0.9, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
      o.connect(g); g.connect(c.destination); o.start(t); o.stop(t + 0.3);
    } else {
      const b = c.createBuffer(1, c.sampleRate * 0.2, c.sampleRate);
      const d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      const s = c.createBufferSource(); s.buffer = b;
      const f = c.createBiquadFilter();
      f.type = "highpass";
      f.frequency.value = type === "snare" ? 1500 : 7000;
      const g = c.createGain();
      g.gain.setValueAtTime(type === "snare" ? 0.6 : 0.25, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + (type === "snare" ? 0.18 : 0.05));
      s.connect(f); f.connect(g); g.connect(c.destination);
      s.start(t); s.stop(t + 0.2);
    }
  };

  // Web MIDI API Setup (Allows external MIDI keyboards)
  useEffect(() => {
    if (typeof navigator !== "undefined" && "requestMIDIAccess" in navigator) {
      navigator.requestMIDIAccess?.().then((access) => {
        setMidiConnected(access.inputs.size > 0);
        access.onstatechange = () => setMidiConnected(access.inputs.size > 0);
        for (const input of access.inputs.values()) {
          input.onmidimessage = (msg) => {
            const [status, noteNumber, velocity] = msg.data;
            if (status >= 144 && status <= 159 && velocity > 0) {
              const currentTrack = tracks.find((tr) => tr.id === selectedTrack);
              playInstrumentSound(midiToFreq(noteNumber), currentTrack?.instrument ?? "Grand Piano");
            }
          };
        }
      }).catch(() => {});
    }
  }, [tracks, selectedTrack]);

  function stop() { stopRef.current?.(); stopRef.current = null; setPlaying(false); }

  async function play() {
    const c = getCtx(); await c.resume(); stop();
    const master = c.createGain(); master.gain.value = masterVol; master.connect(c.destination);
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
    } catch { alert("Please allow microphone permissions to record."); }
  }

  async function exportWav() {
    try {
      const longest = Math.max(0, ...tracks.map((t) => t.buffer?.duration ?? 0));
      if (longest === 0) return alert("Record or play audio into a track before exporting!");
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
      a.download = "ArtistPilot-Session.wav";
      a.click();
    } catch {}
  }

  const addChosenTrack = (instr: InstrumentType) => {
    const id = nextId.current++;
    setTracks([...tracks, { id, name: `${instr} ${id}`, instrument: instr, buffer: null, blob: null, vol: 0.8, pan: 0, mute: false, solo: false }]);
    setSelectedTrack(id);
    setModalOpen(false);
  };

  // Generate 2 full octaves (24 keys) based on current octave setting
  const activeKeys = Array.from({ length: 25 }, (_, i) => {
    const noteIndex = i % 12;
    const keyOctave = octave + Math.floor(i / 12);
    const noteName = `${NOTES[noteIndex]}${keyOctave}`;
    const midiNumber = 12 * (keyOctave + 1) + noteIndex;
    return { note: noteName, freq: midiToFreq(midiNumber), isBlack: NOTES[noteIndex].includes("#") };
  });

  const selectedTrackObj = tracks.find((t) => t.id === selectedTrack);

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-[#24262b] text-zinc-300 font-sans select-none">
      
      {/* 1. TOP TRANSPORT BAR */}
      <div className="flex h-14 flex-none items-center justify-between border-b border-[#1b1c21] bg-[#383a42] px-4 shadow-md">
        {/* Left: Add Track Button + MIDI Status Indicator */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setModalOpen(true)}
            className="flex h-8 items-center gap-1.5 rounded border border-[#2b2d33] bg-[#4a4d56] px-3 text-xs font-bold text-white shadow-inner hover:bg-[#585c67]"
          >
            <span className="text-sm font-black">+</span> New Track
          </button>

          {/* MIDI controller pill */}
          <div className="flex items-center gap-1.5 rounded-full border border-zinc-700 bg-zinc-900/60 px-2.5 py-1 text-[11px]">
            <span className={`h-2 w-2 rounded-full ${midiConnected ? "bg-emerald-400 shadow-sm shadow-emerald-400" : "bg-zinc-600"}`} />
            <span className="text-zinc-400 font-medium">{midiConnected ? "MIDI Keyboard Connected" : "MIDI In Active"}</span>
          </div>
        </div>

        {/* Center: Play, Stop, Big Red Record, LCD Display */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <button onClick={stop} className="h-8 w-8 rounded text-zinc-300 hover:text-white text-sm">◼</button>
            <button
              onClick={() => (playing ? stop() : play())}
              className={`h-8 w-9 rounded text-base font-bold transition flex items-center justify-center ${
                playing ? "bg-[#367fc9] text-white" : "bg-[#4a4d56] text-white hover:bg-[#565963]"
              }`}
            >
              ▶
            </button>
            <button
              onClick={() => record(selectedTrack)}
              className={`h-8 w-8 rounded-full border border-red-950 shadow flex items-center justify-center ${
                rec !== null ? "bg-red-500 text-white animate-pulse" : "bg-[#b12222] text-white hover:bg-red-600"
              }`}
              title="Record to Selected Track"
            >
              <div className="h-3 w-3 rounded-full bg-white" />
            </button>
          </div>

          {/* LCD Display */}
          <div className="flex h-10 items-center divide-x divide-black/40 rounded border border-[#1b1c20] bg-[#111215] px-3 font-mono text-cyan-400 shadow-inner">
            <div className="pr-3 text-center">
              <span className="text-base font-bold tracking-widest text-zinc-100">001. 1</span>
              <p className="text-[8px] text-zinc-500 uppercase">Bars</p>
            </div>
            <div className="px-3 text-center">
              <input
                type="number"
                value={bpm}
                onChange={(e) => setBpm(Number(e.target.value) || 120)}
                className="w-9 bg-transparent text-sm font-bold text-zinc-100 focus:outline-none"
              />
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
        </div>

        {/* Right: Master Volume & Export */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-400">🔈</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={masterVol}
              onChange={(e) => setMasterVol(Number(e.target.value))}
              className="w-20 accent-[#3572b0] h-1.5 bg-[#18191d] rounded cursor-pointer"
            />
          </div>
          <button
            onClick={exportWav}
            className="rounded border border-[#2b2d33] bg-[#4a4d56] px-3 py-1.5 text-xs font-bold text-zinc-100 hover:bg-[#585c67]"
          >
            Export WAV
          </button>
        </div>
      </div>

      {/* 2. TIMELINE RULER BAR */}
      <div className="flex h-6 flex-none border-b border-[#1c1d22] bg-[#222328] text-[10px] text-zinc-500">
        <div className="w-72 flex-none border-r border-[#1a1b1f] px-3 flex items-center justify-between font-bold text-zinc-400">
          TRACKS ({tracks.length})
        </div>
        <div className="flex-1 flex items-center px-4 space-x-20 overflow-hidden select-none">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16].map((bar) => (
            <div key={bar} className="flex items-center gap-2 font-mono">
              <span>{bar}</span>
              <div className="h-2 w-[1px] bg-zinc-700" />
            </div>
          ))}
        </div>
      </div>

      {/* 3. ARRANGER: TRACK HEADERS + REGIONS */}
      <div className="flex-1 overflow-y-auto divide-y divide-[#1f2025] bg-[#1a1b1f]">
        {tracks.map((t) => {
          const isSelected = selectedTrack === t.id;
          return (
            <div
              key={t.id}
              onClick={() => setSelectedTrack(t.id)}
              className={`flex h-20 transition ${isSelected ? "bg-[#31343c]" : "bg-[#27292f] hover:bg-[#2c2e35]"}`}
            >
              {/* Left Track Card */}
              <div className="w-72 flex-none border-r border-[#1b1c20] p-2 flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {/* Instrument Badge */}
                    <div className="flex h-7 w-7 items-center justify-center rounded bg-[#3572b0] shadow text-xs">
                      {INSTRUMENT_OPTIONS.find((opt) => opt.name === t.instrument)?.icon ?? "🎙️"}
                    </div>
                    {/* Editable Track Name */}
                    {editingTrackId === t.id ? (
                      <input
                        autoFocus
                        value={t.name}
                        onBlur={() => setEditingTrackId(null)}
                        onKeyDown={(e) => e.key === "Enter" && setEditingTrackId(null)}
                        onChange={(e) => update(t.id, { name: e.target.value })}
                        className="w-28 rounded bg-black/60 px-1 py-0.5 text-xs font-semibold text-white focus:outline-none"
                      />
                    ) : (
                      <span
                        onDoubleClick={() => setEditingTrackId(t.id)}
                        className="text-xs font-bold text-white truncate w-28 cursor-pointer"
                        title="Double-click to rename"
                      >
                        {t.name}
                      </span>
                    )}
                  </div>

                  {/* Switch Instrument Preset dropdown */}
                  <select
                    value={t.instrument}
                    onChange={(e) => update(t.id, { instrument: e.target.value as InstrumentType })}
                    className="bg-[#1c1d22] border border-zinc-700 text-[10px] text-zinc-300 rounded px-1 py-0.5 focus:outline-none"
                  >
                    {INSTRUMENT_OPTIONS.map((i) => <option key={i.name} value={i.name}>{i.name}</option>)}
                  </select>

                  {tracks.length > 1 && (
                    <button
                      onClick={(e) => { e.stopPropagation(); setTracks(tracks.filter((tk) => tk.id !== t.id)); }}
                      className="text-zinc-500 hover:text-red-400 text-xs px-1"
                    >
                      ✕
                    </button>
                  )}
                </div>

                {/* Track knobs & switches */}
                <div className="flex items-center justify-between text-[10px] pt-1">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={(e) => { e.stopPropagation(); update(t.id, { mute: !t.mute }); }}
                      className={`h-5 w-5 rounded text-[9px] font-bold ${t.mute ? "bg-blue-500 text-white" : "bg-[#383a42] text-zinc-400 hover:bg-[#464952]"}`}
                    >
                      M
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); update(t.id, { solo: !t.solo }); }}
                      className={`h-5 w-5 rounded text-[9px] font-bold ${t.solo ? "bg-amber-500 text-black" : "bg-[#383a42] text-zinc-400 hover:bg-[#464952]"}`}
                    >
                      S
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); record(t.id); }}
                      className={`h-5 w-5 rounded-full flex items-center justify-center font-bold text-[9px] ${
                        rec === t.id ? "bg-red-500 text-white animate-pulse" : "bg-[#383a42] text-red-400 hover:bg-[#464952]"
                      }`}
                    >
                      ●
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[9px] text-zinc-500">VOL</span>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.05}
                      value={t.vol}
                      onChange={(e) => update(t.id, { vol: Number(e.target.value) })}
                      className="w-16 accent-zinc-300 h-1 bg-[#16171b] rounded cursor-pointer"
                    />
                  </div>
                </div>
              </div>

              {/* Right Arranger Lane */}
              <div className="flex-1 relative bg-[#1c1e23] border-b border-[#282a32]">
                <WaveformClip buffer={t.buffer} name={t.name} />
              </div>
            </div>
          );
        })}
      </div>

      {/* 4. BOTTOM EXPANDED MULTI-INSTRUMENT DRAWER */}
      <div className="flex-none border-t border-[#18191d] bg-[#1e2025] h-64 flex flex-col shadow-2xl">
        <div className="flex h-8 items-center justify-between border-b border-[#18191d] bg-[#292b32] px-4 text-xs font-semibold">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setBottomTab("keys")}
              className={`rounded px-3 py-1 ${bottomTab === "keys" ? "bg-[#3572b0] text-white" : "text-zinc-400 hover:text-white"}`}
            >
              🎹 Full Piano Keys ({selectedTrackObj?.instrument})
            </button>
            <button
              onClick={() => setBottomTab("drums")}
              className={`rounded px-3 py-1 ${bottomTab === "drums" ? "bg-[#3572b0] text-white" : "text-zinc-400 hover:text-white"}`}
            >
              🥁 Drum Pads
            </button>
          </div>

          {bottomTab === "keys" && (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-zinc-400">Octave:</span>
              <button onClick={() => setOctave(Math.max(1, octave - 1))} className="rounded bg-zinc-800 px-2 py-0.5 hover:bg-zinc-700">-</button>
              <span className="font-bold text-white font-mono">{octave}</span>
              <button onClick={() => setOctave(Math.min(6, octave + 1))} className="rounded bg-zinc-800 px-2 py-0.5 hover:bg-zinc-700">+</button>
            </div>
          )}
        </div>

        {/* Tab 1: 2-Octave Full Size Piano Keyboard */}
        {bottomTab === "keys" && (
          <div className="flex-1 bg-[#121316] p-2 flex items-center justify-center overflow-x-auto">
            <div className="relative flex h-48 select-none bg-black p-1 rounded-b-lg border border-zinc-800 shadow-2xl">
              {activeKeys.map((k, index) => {
                if (k.isBlack) return null;
                return (
                  <button
                    key={index}
                    onClick={() => playInstrumentSound(k.freq, selectedTrackObj?.instrument ?? "Grand Piano")}
                    className="relative w-12 h-full rounded-b border border-zinc-400 bg-gradient-to-b from-zinc-100 to-zinc-300 text-zinc-700 hover:from-white hover:to-zinc-200 active:bg-zinc-400 shadow-md flex flex-col justify-end pb-2 items-center text-[10px] font-bold"
                  >
                    {k.note}
                  </button>
                );
              })}

              {/* Black keys overlaid on top */}
              <div className="absolute top-1 left-1 flex pointer-events-none">
                {activeKeys.map((k, idx) => {
                  if (!k.isBlack) return <div key={idx} className="w-12 pointer-events-none" />;
                  return (
                    <button
                      key={idx}
                      onClick={() => playInstrumentSound(k.freq, selectedTrackObj?.instrument ?? "Grand Piano")}
                      style={{ marginLeft: "-16px", marginRight: "-16px" }}
                      className="pointer-events-auto z-10 w-8 h-28 rounded-b border border-black bg-gradient-to-b from-zinc-800 to-black text-zinc-300 hover:bg-zinc-700 active:bg-zinc-900 shadow-xl flex flex-col justify-end pb-1 items-center text-[8px] font-bold"
                    >
                      {k.note}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Drum Machine MPC Pads */}
        {bottomTab === "drums" && (
          <div className="flex-1 bg-[#15161b] p-4 flex items-center justify-center gap-4">
            {[
              { label: "808 KICK", type: "kick" as const, color: "bg-red-950 border-red-700 hover:bg-red-900 text-red-200" },
              { label: "SNARE", type: "snare" as const, color: "bg-amber-950 border-amber-700 hover:bg-amber-900 text-amber-200" },
              { label: "HI-HAT", type: "hihat" as const, color: "bg-sky-950 border-sky-700 hover:bg-sky-900 text-sky-200" },
              { label: "HAND CLAP", type: "clap" as const, color: "bg-emerald-950 border-emerald-700 hover:bg-emerald-900 text-emerald-200" },
            ].map((pad) => (
              <button
                key={pad.label}
                onClick={() => playDrum(pad.type)}
                className={`h-36 w-36 rounded-xl border-2 shadow-2xl font-black text-sm flex flex-col items-center justify-center gap-1 active:scale-95 transition ${pad.color}`}
              >
                <span>🥁</span>
                {pad.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 5. GARAGEBAND "NEW TRACK" MODAL SELECTOR */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-2xl rounded-xl border border-zinc-700 bg-[#292b32] p-6 shadow-2xl">
            <h2 className="text-xl font-bold text-white mb-1">Choose a track type</h2>
            <p className="text-xs text-zinc-400 mb-6">Select an instrument or audio track to add to your session.</p>

            <div className="grid grid-cols-2 gap-4">
              {INSTRUMENT_OPTIONS.map((item) => (
                <button
                  key={item.name}
                  onClick={() => addChosenTrack(item.name)}
                  className="flex items-start gap-4 rounded-lg border border-zinc-700/80 bg-[#1e2025] p-4 text-left transition hover:border-[#3572b0] hover:bg-[#252830]"
                >
                  <div className="flex h-12 w-12 flex-none items-center justify-center rounded-lg bg-[#3572b0] text-2xl shadow">
                    {item.icon}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">{item.name}</h3>
                    <p className="text-xs text-zinc-400 mt-1 leading-relaxed">{item.desc}</p>
                  </div>
                </button>
              ))}
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setModalOpen(false)}
                className="rounded-lg bg-zinc-700 px-5 py-2 text-xs font-bold text-white hover:bg-zinc-600"
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
