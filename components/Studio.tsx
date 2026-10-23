"use client";
import { useEffect, useRef, useState } from "react";

type Track = {
  id: number;
  name: string;
  instrument: string;
  buffer: AudioBuffer | null;
  blob: Blob | null;
  vol: number;
  pan: number;
  mute: boolean;
};

const INSTR = ["Vocals", "Guitar", "Bass", "Piano / keys", "Drums", "Ukulele", "Violin", "Other"];
const MAX_TRACKS = 12;
const MAX_SECONDS = 180;
const ROWS = ["Kick", "Snare", "Hi-hat"];
const startPattern = () =>
  ROWS.map((_, r) => Array.from({ length: 16 }, (_, i) => (r === 0 ? i % 4 === 0 : r === 1 ? i % 8 === 4 : i % 2 === 0)));

function noiseBuffer(c: BaseAudioContext) {
  const b = c.createBuffer(1, c.sampleRate, c.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return b;
}

function noiseHit(c: BaseAudioContext, dest: AudioNode, noise: AudioBuffer, t: number, freq: number, len: number, vol: number) {
  const s = c.createBufferSource(); s.buffer = noise;
  const f = c.createBiquadFilter(); f.type = "highpass"; f.frequency.value = freq;
  const g = c.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + len);
  s.connect(f); f.connect(g); g.connect(dest); s.start(t); s.stop(t + len + 0.05);
}

function scheduleBeat(c: BaseAudioContext, dest: AudioNode, t0: number, dur: number, bpm: number, pat: boolean[][], on: boolean) {
  if (!on) return;
  const step = 60 / bpm / 4; const noise = noiseBuffer(c);
  for (let n = 0; n * step < dur; n++) {
    const t = t0 + n * step; const i = n % 16;
    if (pat[0][i]) {
      const o = c.createOscillator(); const g = c.createGain();
      o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.2);
      g.gain.setValueAtTime(0.9, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
      o.connect(g); g.connect(dest); o.start(t); o.stop(t + 0.3);
    }
    if (pat[1][i]) noiseHit(c, dest, noise, t, 1500, 0.18, 0.6);
    if (pat[2][i]) noiseHit(c, dest, noise, t, 7000, 0.05, 0.25);
  }
}

function scheduleTracks(c: BaseAudioContext, dest: AudioNode, tracks: Track[], t0: number, skip?: number) {
  tracks.forEach((tr) => {
    if (!tr.buffer || tr.mute || tr.id === skip) return;
    const s = c.createBufferSource(); s.buffer = tr.buffer;
    const g = c.createGain(); g.gain.value = tr.vol;
    const p = c.createStereoPanner(); p.pan.value = tr.pan;
    s.connect(g); g.connect(p); p.connect(dest); s.start(t0);
  });
}

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

function Wave({ buffer }: { buffer: AudioBuffer | null }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current; if (!cv) return;
    const g = cv.getContext("2d"); if (!g) return;
    g.clearRect(0, 0, cv.width, cv.height);
    if (!buffer) return;
    const d = buffer.getChannelData(0); const step = Math.max(1, Math.floor(d.length / cv.width));
    g.fillStyle = "#06b6d4"; // BandLab Cyan
    for (let x = 0; x < cv.width; x++) {
      let m = 0;
      for (let i = 0; i < step; i += 32) m = Math.max(m, Math.abs(d[x * step + i] || 0));
      const h = Math.max(2, m * cv.height);
      g.fillRect(x, (cv.height - h) / 2, 1.5, h);
    }
  }, [buffer]);

  if (!buffer) {
    return (
      <div className="flex h-full w-full items-center justify-center border-l border-zinc-800 bg-[#16181d] text-xs text-zinc-600">
        Empty Track (Arm ● to record)
      </div>
    );
  }

  return (
    <div className="relative h-full w-full bg-[#14161a] p-1 border-l border-zinc-800">
      <canvas ref={ref} width={800} height={70} className="h-full w-full rounded bg-[#1e222b]" aria-label="Audio Waveform" />
    </div>
  );
}

const blobToDataUrl = (b: Blob) => new Promise<string>((res, rej) => {
  const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = () => rej(r.error); r.readAsDataURL(b);
});
const num = (v: unknown, lo: number, hi: number, d: number) => {
  const n = Number(v); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d;
};

export default function Studio({ defaultBpm = 92 }: { defaultBpm?: number }) {
  const nextId = useRef(1);
  const blank = (): Track => {
    const id = nextId.current++;
    return { id, name: `Track ${id}`, instrument: "Vocals", buffer: null, blob: null, vol: 0.85, pan: 0, mute: false };
  };

  const [tracks, setTracks] = useState<Track[]>(() => [blank(), blank(), blank()]);
  const [bpm, setBpm] = useState(defaultBpm);
  const [pattern, setPattern] = useState<boolean[][]>(startPattern);
  const [beatOn, setBeatOn] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [rec, setRec] = useState<number | null>(null);
  const [msg, setMsg] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(true);

  const ctxRef = useRef<AudioContext | null>(null);
  const stopRef = useRef<(() => void) | null>(null);
  const recRef = useRef<MediaRecorder | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const longest = Math.max(0, ...tracks.map((t) => t.buffer?.duration ?? 0));
  const loopDur = Math.max(longest, (60 / bpm) * 16);
  const update = (id: number, patch: Partial<Track>) =>
    setTracks((ts) => ts.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  const getCtx = () => { if (!ctxRef.current) ctxRef.current = new AudioContext(); return ctxRef.current; };
  const safeName = () => (name.trim() || "artistpilot-session").replace(/[^\w-]+/g, "-");

  const download = (blob: Blob, filename: string) => {
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = filename; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  };

  function stop() { stopRef.current?.(); stopRef.current = null; setPlaying(false); }

  async function play(skip?: number, forceDur?: number) {
    const c = getCtx(); await c.resume(); stop();
    const master = c.createGain(); master.connect(c.destination);
    const t0 = c.currentTime + 0.1; const dur = forceDur ?? loopDur;
    scheduleTracks(c, master, tracks, t0, skip); scheduleBeat(c, master, t0, dur, bpm, pattern, beatOn);
    const timer = window.setTimeout(() => setPlaying(false), (dur + 0.2) * 1000);
    stopRef.current = () => { master.disconnect(); window.clearTimeout(timer); };
    setPlaying(true);
  }

  async function record(id: number) {
    if (rec !== null) { recRef.current?.stop(); return; }
    setMsg("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const c = getCtx(); const mr = new MediaRecorder(stream); const chunks: Blob[] = [];
      let limit = 0;
      mr.ondataavailable = (e) => chunks.push(e.data);
      mr.onstop = async () => {
        window.clearTimeout(limit); stream.getTracks().forEach((t) => t.stop()); stop(); setRec(null);
        const blob = new Blob(chunks, { type: mr.mimeType || "audio/webm" });
        try {
          update(id, { buffer: await c.decodeAudioData(await blob.arrayBuffer()), blob });
          setDirty(true);
        } catch { setMsg("Could not process recording."); }
      };
      recRef.current = mr; setRec(id); mr.start();
      limit = window.setTimeout(() => { if (mr.state === "recording") mr.stop(); }, MAX_SECONDS * 1000);
      await play(id, MAX_SECONDS);
    } catch { setMsg("Microphone access denied. Please enable mic permissions."); }
  }

  async function exportWav() {
    setMsg("");
    try {
      const sr = getCtx().sampleRate; const oc = new OfflineAudioContext(2, Math.ceil(sr * loopDur), sr);
      scheduleTracks(oc, oc.destination, tracks, 0); scheduleBeat(oc, oc.destination, 0, loopDur, bpm, pattern, beatOn);
      download(toWav(await oc.startRendering()), `${safeName()}.wav`);
    } catch { setMsg("Could not export WAV."); }
  }

  async function saveToDevice() {
    setMsg(""); setBusy(true);
    try {
      const out = {
        format: "artistpilot-session", version: 1, name: name.trim() || "Untitled session", bpm, beatOn, pattern,
        tracks: await Promise.all(tracks.map(async (t) => ({ name: t.name, instrument: t.instrument, vol: t.vol, pan: t.pan, mute: t.mute, audio: t.blob ? await blobToDataUrl(t.blob) : null }))),
      };
      download(new Blob([JSON.stringify(out)], { type: "application/json" }), `${safeName()}.artistpilot`);
      setDirty(false); setMsg("Saved session to device!");
    } catch { setMsg("Could not save session file."); }
    finally { setBusy(false); }
  }

  async function openFromDevice(file: File) {
    setMsg("Opening...");
    try {
      const d = JSON.parse(await file.text());
      if (d.format !== "artistpilot-session") throw new Error();
      stop(); const c = getCtx(); nextId.current = 1; const loaded: Track[] = [];
      for (const t of d.tracks) {
        let buffer = null; let blob = null;
        if (typeof t.audio === "string" && t.audio.startsWith("data:")) {
          try { blob = await (await fetch(t.audio)).blob(); buffer = await c.decodeAudioData(await blob.arrayBuffer()); } catch {}
        }
        const id = nextId.current++;
        loaded.push({ id, name: t.name ?? `Track ${id}`, instrument: t.instrument ?? "Other", buffer, blob, vol: num(t.vol, 0, 1, 0.85), pan: num(t.pan, -1, 1, 0), mute: !!t.mute });
      }
      setTracks(loaded); setName(d.name ?? ""); setBpm(num(d.bpm, 50, 200, 92)); setBeatOn(d.beatOn !== false);
      setPattern(d.pattern ?? startPattern()); setDirty(false); setMsg("Session opened!");
    } catch { setMsg("Invalid session file."); }
  }

  function addTrack() { if (tracks.length < MAX_TRACKS) setTracks((ts) => [...ts, blank()]); }
  function removeTrack(id: number) { if (tracks.length > 1 && rec === null) setTracks((ts) => ts.filter((t) => t.id !== id)); }

  useEffect(() => () => { stopRef.current?.(); ctxRef.current?.close(); }, []);

  return (
    <div className="flex h-full w-full flex-col bg-[#0f1015] text-zinc-200 select-none font-sans">
      
      {/* 1. TOP TRANSPORT BAR (BandLab Style) */}
      <div className="flex h-14 flex-none items-center justify-between border-b border-zinc-800 bg-[#16181e] px-4">
        {/* Left: Project title & Cloud/Save */}
        <div className="flex items-center gap-3">
          <input
            className="w-44 rounded bg-zinc-900/80 px-2.5 py-1 text-sm font-semibold text-white placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
            value={name}
            placeholder="Untitled Project"
            onChange={(e) => { setName(e.target.value); setDirty(true); }}
          />
          <button onClick={saveToDevice} disabled={busy || rec !== null} className="rounded bg-zinc-800 px-2.5 py-1 text-xs font-medium hover:bg-zinc-700">
            {busy ? "Saving..." : "Save"}
          </button>
          <button onClick={() => fileRef.current?.click()} className="rounded bg-zinc-800 px-2.5 py-1 text-xs font-medium hover:bg-zinc-700">
            Open
          </button>
          <input ref={fileRef} type="file" accept=".artistpilot,application/json" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) openFromDevice(f); }} />
        </div>

        {/* Center: Play, Stop, Record buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => (playing ? stop() : play())}
            className={`flex h-10 w-10 items-center justify-center rounded-full text-lg shadow transition ${
              playing ? "bg-amber-500 text-black" : "bg-emerald-500 text-black hover:bg-emerald-400"
            }`}
          >
            {playing ? "■" : "▶"}
          </button>
          <div className="h-5 w-[1px] bg-zinc-800 mx-2" />
          {/* BPM display */}
          <div className="flex items-center gap-1.5 rounded-lg bg-zinc-900 px-3 py-1 border border-zinc-800">
            <span className="text-[11px] font-bold text-zinc-500 tracking-wider">BPM</span>
            <input
              type="number"
              min={50}
              max={200}
              value={bpm}
              onChange={(e) => { setBpm(Number(e.target.value) || 92); setDirty(true); }}
              className="w-12 bg-transparent text-sm font-bold text-white focus:outline-none"
            />
          </div>
          {/* Drum Beat toggle */}
          <button
            onClick={() => { setBeatOn(!beatOn); setDirty(true); }}
            className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold border ${
              beatOn ? "border-cyan-500/50 bg-cyan-950/40 text-cyan-400" : "border-zinc-800 bg-zinc-900 text-zinc-500"
            }`}
          >
            Beat {beatOn ? "ON" : "OFF"}
          </button>
        </div>

        {/* Right: Export & Add Track */}
        <div className="flex items-center gap-2">
          <button
            onClick={exportWav}
            disabled={rec !== null || (longest === 0 && !beatOn)}
            className="rounded bg-gradient-to-r from-cyan-500 to-blue-600 px-3 py-1.5 text-xs font-bold text-white shadow hover:opacity-90 disabled:opacity-40"
          >
            Export Mix (.wav)
          </button>
        </div>
      </div>

      {msg && <div className="bg-cyan-950/60 py-1 text-center text-xs text-cyan-300 border-b border-cyan-800/50">{msg}</div>}

      {/* 2. TIMELINE RULER BAR */}
      <div className="flex h-7 flex-none border-b border-zinc-800 bg-[#121418] text-[10px] text-zinc-500">
        <div className="w-72 flex-none border-r border-zinc-800 px-3 flex items-center justify-between font-semibold">
          <span>TRACKS ({tracks.length}/{MAX_TRACKS})</span>
          <button onClick={addTrack} disabled={tracks.length >= MAX_TRACKS} className="text-cyan-400 hover:text-cyan-300 font-bold text-xs">+ Track</button>
        </div>
        <div className="flex-1 flex items-center px-4 space-x-12 overflow-hidden">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16].map((bar) => (
            <div key={bar} className="flex items-center gap-2">
              <span className="font-mono">{bar}</span>
              <div className="h-2 w-[1px] bg-zinc-800" />
            </div>
          ))}
        </div>
      </div>

      {/* 3. ARRANGER: TRACK HEADERS + WAVEFORMS */}
      <div className="flex-1 overflow-y-auto divide-y divide-zinc-800/80">
        {tracks.map((t) => (
          <div key={t.id} className="flex h-20 bg-[#121317] hover:bg-[#15171d] transition">
            
            {/* Left Track Header */}
            <div className="w-72 flex-none border-r border-zinc-800 p-2.5 flex flex-col justify-between bg-[#16181f]">
              <div className="flex items-center justify-between gap-1">
                <input
                  value={t.name}
                  onChange={(e) => { update(t.id, { name: e.target.value }); setDirty(true); }}
                  className="w-24 bg-transparent text-xs font-bold text-white focus:outline-none focus:ring-1 focus:ring-cyan-500 rounded px-1"
                />
                <select
                  value={t.instrument}
                  onChange={(e) => { update(t.id, { instrument: e.target.value }); setDirty(true); }}
                  className="bg-zinc-900 border border-zinc-800 text-[10px] text-zinc-300 rounded px-1 py-0.5"
                >
                  {INSTR.map((i) => <option key={i}>{i}</option>)}
                </select>
                <button onClick={() => removeTrack(t.id)} className="text-zinc-600 hover:text-red-400 text-xs px-1">✕</button>
              </div>

              {/* Mute, Record Arm, Vol, Pan */}
              <div className="flex items-center justify-between text-xs pt-1">
                <div className="flex items-center gap-1.5">
                  {/* Record button */}
                  <button
                    onClick={() => record(t.id)}
                    className={`h-6 w-6 rounded-full flex items-center justify-center font-bold text-xs ${
                      rec === t.id ? "bg-red-500 text-white animate-pulse" : "bg-zinc-800 text-red-500 hover:bg-zinc-700"
                    }`}
                  >
                    ●
                  </button>
                  {/* Mute button */}
                  <button
                    onClick={() => { update(t.id, { mute: !t.mute }); setDirty(true); }}
                    className={`h-6 w-6 rounded text-[11px] font-black ${
                      t.mute ? "bg-amber-500 text-black" : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                    }`}
                  >
                    M
                  </button>
                </div>

                {/* Volume & Pan faders */}
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={t.vol}
                    onChange={(e) => { update(t.id, { vol: Number(e.target.value) }); setDirty(true); }}
                    className="w-16 accent-cyan-500 h-1 bg-zinc-700 rounded-lg cursor-pointer"
                    title="Volume"
                  />
                  <input
                    type="range"
                    min={-1}
                    max={1}
                    step={0.1}
                    value={t.pan}
                    onChange={(e) => { update(t.id, { pan: Number(e.target.value) }); setDirty(true); }}
                    className="w-10 accent-indigo-500 h-1 bg-zinc-700 rounded-lg cursor-pointer"
                    title="Pan"
                  />
                </div>
              </div>
            </div>

            {/* Right Waveform Display */}
            <div className="flex-1 relative">
              <Wave buffer={t.buffer} />
            </div>
          </div>
        ))}
      </div>

      {/* 4. BOTTOM DRAWER (BandLab Style Step Sequencer / Beatmaker) */}
      <div className="flex-none border-t border-zinc-800 bg-[#16181f]">
        <div className="flex items-center justify-between px-4 py-1.5 border-b border-zinc-800/60 bg-[#121318]">
          <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">🥁 16-Step Drum Machine</span>
          <button
            onClick={() => setDrawerOpen(!drawerOpen)}
            className="text-xs text-zinc-400 hover:text-white"
          >
            {drawerOpen ? "Hide ▼" : "Show ▲"}
          </button>
        </div>

        {drawerOpen && (
          <div className="p-3 max-h-48 overflow-x-auto space-y-1.5">
            {ROWS.map((rowName, r) => (
              <div key={rowName} className="flex items-center gap-1.5">
                <span className="w-16 text-right pr-2 text-xs font-medium text-zinc-400">{rowName}</span>
                <div className="flex items-center gap-1">
                  {pattern[r].map((on, i) => (
                    <button
                      key={i}
                      onClick={() => {
                        setPattern((p) => p.map((row, ri) => (ri === r ? row.map((v, vi) => (vi === i ? !v : v)) : row)));
                        setDirty(true);
                      }}
                      className={`h-7 w-7 rounded transition ${
                        on ? "bg-cyan-500 shadow-sm shadow-cyan-500/50" : "bg-zinc-800/80 hover:bg-zinc-700"
                      } ${i % 4 === 0 ? "ml-1.5 border-l-2 border-zinc-600" : ""}`}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
