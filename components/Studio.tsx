"use client";
import { useEffect, useRef, useState } from "react";

type Track = { id: number; name: string; instrument: string; buffer: AudioBuffer | null; blob: Blob | null; vol: number; pan: number; mute: boolean };
const INSTR = ["Vocals", "Guitar", "Bass", "Piano / keys", "Drums", "Ukulele", "Violin", "Other"];
const MAX_TRACKS = 12;
const MAX_SECONDS = 180;
const ROWS = ["Kick", "Snare", "Hi-hat"];
const startPattern = () => ROWS.map((_, r) => Array.from({ length: 16 }, (_, i) => (r === 0 ? i % 4 === 0 : r === 1 ? i % 8 === 4 : i % 2 === 0)));

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
    g.fillStyle = "#8b5cf6";
    for (let x = 0; x < cv.width; x++) {
      let m = 0;
      for (let i = 0; i < step; i += 32) m = Math.max(m, Math.abs(d[x * step + i] || 0));
      const h = Math.max(1, m * cv.height); g.fillRect(x, (cv.height - h) / 2, 1, h);
    }
  }, [buffer]);
  return <canvas ref={ref} width={600} height={56} className="h-14 w-full rounded bg-zinc-950" aria-label="Recorded waveform" />;
}

const blobToDataUrl = (b: Blob) => new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = () => rej(r.error); r.readAsDataURL(b); });
const num = (v: unknown, lo: number, hi: number, d: number) => { const n = Number(v); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d; };

export default function Studio({ defaultBpm = 92 }: { defaultBpm?: number }) {
  const nextId = useRef(1);
  const blank = (): Track => { const id = nextId.current++; return { id, name: `Track ${id}`, instrument: "Vocals", buffer: null, blob: null, vol: 0.9, pan: 0, mute: false }; };
  const [tracks, setTracks] = useState<Track[]>(() => [blank(), blank(), blank(), blank()]);
  const [bpm, setBpm] = useState(defaultBpm);
  const [pattern, setPattern] = useState<boolean[][]>(startPattern);
  const [beatOn, setBeatOn] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [rec, setRec] = useState<number | null>(null);
  const [msg, setMsg] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const ctxRef = useRef<AudioContext | null>(null);
  const stopRef = useRef<(() => void) | null>(null);
  const recRef = useRef<MediaRecorder | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const longest = Math.max(0, ...tracks.map((t) => t.buffer?.duration ?? 0));
  const loopDur = Math.max(longest, (60 / bpm) * 16);
  const update = (id: number, patch: Partial<Track>) => setTracks((ts) => ts.map((t) => (t.id === id ? { ...t, ...patch } : t)));
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
        try { update(id, { buffer: await c.decodeAudioData(await blob.arrayBuffer()), blob }); setDirty(true); }
        catch { setMsg("Could not read that recording. Please try again."); }
      };
      recRef.current = mr; setRec(id); mr.start();
      limit = window.setTimeout(() => { if (mr.state === "recording") mr.stop(); }, MAX_SECONDS * 1000);
      await play(id, MAX_SECONDS);
    } catch { setMsg("Microphone access was blocked. Allow it in your browser settings and try again."); }
  }
  async function exportWav() {
    setMsg("");
    try {
      const sr = getCtx().sampleRate; const oc = new OfflineAudioContext(2, Math.ceil(sr * loopDur), sr);
      scheduleTracks(oc, oc.destination, tracks, 0); scheduleBeat(oc, oc.destination, 0, loopDur, bpm, pattern, beatOn);
      download(toWav(await oc.startRendering()), `${safeName()}.wav`);
    } catch { setMsg("Could not export the mix in this browser."); }
  }
  async function saveToDevice() {
    setMsg(""); setBusy(true);
    try {
      const out = {
        format: "artistpilot-session", version: 1, name: name.trim() || "Untitled session", bpm, beatOn, pattern,
        tracks: await Promise.all(tracks.map(async (t) => ({ name: t.name, instrument: t.instrument, vol: t.vol, pan: t.pan, mute: t.mute, audio: t.blob ? await blobToDataUrl(t.blob) : null }))),
      };
      download(new Blob([JSON.stringify(out)], { type: "application/json" }), `${safeName()}.artistpilot`);
      setDirty(false); setMsg("Session saved to your device. Look for the .artistpilot file in your Downloads folder.");
    } catch { setMsg("Could not create the session file."); }
    finally { setBusy(false); }
  }
  async function openFromDevice(file: File) {
    setMsg("Opening...");
    try {
      const d = JSON.parse(await file.text());
      if (d.format !== "artistpilot-session" || !Array.isArray(d.tracks) || d.tracks.length < 1 || d.tracks.length > MAX_TRACKS) throw new Error("not a session file");
      stop(); const c = getCtx(); nextId.current = 1; const loaded: Track[] = []; let skipped = 0;
      for (const t of d.tracks) {
        let buffer: AudioBuffer | null = null; let blob: Blob | null = null;
        if (typeof t.audio === "string" && t.audio.startsWith("data:")) {
          try { blob = await (await fetch(t.audio)).blob(); buffer = await c.decodeAudioData(await blob.arrayBuffer()); }
          catch { blob = null; buffer = null; skipped++; }
        }
        const id = nextId.current++;
        loaded.push({ id, name: String(t.name ?? `Track ${id}`).slice(0, 30), instrument: INSTR.includes(t.instrument) ? t.instrument : "Other", buffer, blob, vol: num(t.vol, 0, 1, 0.9), pan: num(t.pan, -1, 1, 0), mute: !!t.mute });
      }
      setTracks(loaded); setName(String(d.name ?? "").slice(0, 60)); setBpm(num(d.bpm, 50, 200, 92)); setBeatOn(d.beatOn !== false);
      setPattern(Array.isArray(d.pattern) && d.pattern.length === 3 && d.pattern.every((r: unknown) => Array.isArray(r) && r.length === 16) ? d.pattern.map((r: unknown[]) => r.map(Boolean)) : startPattern());
      setDirty(false); setMsg(skipped ? `Session opened, but ${skipped} recording(s) could not be read by this browser.` : "Session opened.");
    } catch { setMsg("That doesn't look like an ArtistPilot session file."); }
  }
  function newSession() {
    if (dirty && !window.confirm("Start a new session? Anything you haven't saved to your device will be lost.")) return;
    stop(); nextId.current = 1; setTracks([blank(), blank(), blank(), blank()]);
    setName(""); setBpm(defaultBpm); setPattern(startPattern()); setBeatOn(true); setDirty(false); setMsg("");
  }
  function addTrack() { if (tracks.length < MAX_TRACKS) { const t = blank(); setTracks((ts) => [...ts, t]); } }
  function removeTrack(id: number) { if (tracks.length > 1 && rec === null) setTracks((ts) => ts.filter((t) => t.id !== id)); }

  useEffect(() => () => { stopRef.current?.(); ctxRef.current?.close(); }, []);
  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", h); return () => window.removeEventListener("beforeunload", h);
  }, [dirty]);

  const btn = "rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2 font-bold hover:border-violet-500 disabled:opacity-50";
  const field = "rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2";
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
        <label className="flex min-w-[12rem] flex-1 items-center gap-2 text-sm">Session
          <input className={field + " w-full"} value={name} maxLength={60} placeholder="Untitled session" onChange={(e) => setName(e.target.value)} /></label>
        <button className={btn + " border-transparent bg-gradient-to-r from-violet-500 to-blue-500"} onClick={saveToDevice} disabled={busy || rec !== null}>{busy ? "Saving..." : "Save to my device"}</button>
        <button className={btn} onClick={() => fileRef.current?.click()} disabled={rec !== null}>Open from my device</button>
        <button className={btn} onClick={newSession} disabled={rec !== null}>New session</button>
        <input ref={fileRef} type="file" accept=".artistpilot,application/json" className="hidden" aria-label="Open a session file"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) openFromDevice(f); e.target.value = ""; }} />
      </div>
      <p className="-mt-3 text-sm text-zinc-500">Your recordings stay on your own device. Press Save to my device to download a session file, then use Open from my device to continue later.</p>

      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
        <button className={btn + " border-transparent bg-gradient-to-r from-violet-500 to-blue-500"} onClick={() => (playing ? stop() : play())} disabled={rec !== null}>{playing ? "Stop" : "Play"}</button>
        <button className={btn} onClick={exportWav} disabled={rec !== null || (longest === 0 && !beatOn)}>Export WAV</button>
        <label className="ml-auto flex items-center gap-2 text-sm">BPM
          <input type="number" min={50} max={200} value={bpm} onChange={(e) => { setBpm(Math.min(200, Math.max(50, Number(e.target.value) || 92))); setDirty(true); }} className={field + " w-20"} /></label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={beatOn} onChange={(e) => { setBeatOn(e.target.checked); setDirty(true); }} />Drum beat</label>
      </div>
      {msg && <p role="status" className="text-sm text-amber-300">{msg}</p>}

      <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
        <h2 className="mb-3 font-bold">Drum machine</h2>
        <div className="space-y-2 overflow-x-auto">
          {ROWS.map((rowName, r) => (
            <div key={rowName} className="flex items-center gap-2">
              <span className="w-16 shrink-0 text-sm text-zinc-400">{rowName}</span>
              {pattern[r].map((on, i) => (
                <button key={i} aria-label={`${rowName} step ${i + 1}`} aria-pressed={on}
                  onClick={() => { setPattern((p) => p.map((row, ri) => (ri === r ? row.map((v, vi) => (vi === i ? !v : v)) : row))); setDirty(true); }}
                  className={`h-8 w-8 shrink-0 rounded ${on ? "bg-violet-500" : "bg-zinc-800"} ${i % 4 === 0 ? "ml-1" : ""}`} />
              ))}
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <h2 className="font-bold">Tracks ({tracks.length} of {MAX_TRACKS})</h2>
        <button className={btn} onClick={addTrack} disabled={tracks.length >= MAX_TRACKS || rec !== null}>Add track</button>
      </div>
      <div className="space-y-3">
        {tracks.map((t) => (
          <div key={t.id} className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
            <div className="mb-3 flex flex-wrap items-center gap-3">
              <input aria-label="Track name" className={field + " w-36"} value={t.name} maxLength={30} onChange={(e) => { update(t.id, { name: e.target.value }); setDirty(true); }} />
              <select aria-label="Instrument" className={field} value={t.instrument} onChange={(e) => { update(t.id, { instrument: e.target.value }); setDirty(true); }}>{INSTR.map((i) => <option key={i}>{i}</option>)}</select>
              <button className={btn + (rec === t.id ? " border-red-500 text-red-300" : "")} onClick={() => record(t.id)} disabled={rec !== null && rec !== t.id}>{rec === t.id ? "Stop recording" : "Record"}</button>
              <button className={btn} onClick={() => { update(t.id, { buffer: null, blob: null }); setDirty(true); }} disabled={!t.buffer || rec !== null}>Clear</button>
              <button className={btn} onClick={() => removeTrack(t.id)} disabled={tracks.length <= 1 || rec !== null}>Remove</button>
            </div>
            <div className="mb-3 flex flex-wrap items-center gap-4">
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={t.mute} onChange={(e) => { update(t.id, { mute: e.target.checked }); setDirty(true); }} />Mute</label>
              <label className="flex items-center gap-2 text-sm">Volume<input type="range" min={0} max={1} step={0.05} value={t.vol} onChange={(e) => { update(t.id, { vol: Number(e.target.value) }); setDirty(true); }} /></label>
              <label className="flex items-center gap-2 text-sm">Pan<input type="range" min={-1} max={1} step={0.1} value={t.pan} onChange={(e) => { update(t.id, { pan: Number(e.target.value) }); setDirty(true); }} /></label>
            </div>
            <Wave buffer={t.buffer} />
          </div>
        ))}
      </div>
      <p className="text-sm text-zinc-500">Each take can be up to {MAX_SECONDS / 60} minutes. Volume, pan and mute changes apply the next time you press Play. Export WAV gives you a finished audio file of the whole mix.</p>
    </div>
  );
}
