// components/daw/PitchEditorModal.tsx
"use client";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLanguage } from "@/components/LanguageProvider";
import {
  applyManualEdits,
  detectPitchTrack,
  mixToMono,
  nearestScaleMidi,
  segmentNotes,
  type PitchFrame,
  type PitchNote,
  type PitchScale,
} from "@/lib/daw/pitchCorrect";

const NOTE_NAMES = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"];
const KEY_NAMES = ["C", "D♭", "D", "E♭", "E", "F", "F#", "G", "A♭", "A", "B♭", "B"];
const ROW = 14;
const LABEL_WIDTH = 44;
const BLACK_KEYS = new Set([1, 3, 6, 8, 10]);

function noteLabel(midi: number): string {
  const rounded = Math.round(midi);
  const cents = Math.round((midi - rounded) * 100);
  const base = `${NOTE_NAMES[((rounded % 12) + 12) % 12]}${Math.floor(rounded / 12) - 1}`;
  return cents === 0 ? base : `${base} ${cents > 0 ? "+" : ""}${cents}¢`;
}

interface PitchEditorModalProps {
  isOpen: boolean;
  clipName: string;
  buffer: AudioBuffer | null;
  defaultKeyIndex: number;
  defaultScale: PitchScale;
  getContext: () => AudioContext;
  onClose: () => void;
  onApply: (result: AudioBuffer) => void;
}

export function PitchEditorModal({
  isOpen,
  clipName,
  buffer,
  defaultKeyIndex,
  defaultScale,
  getContext,
  onClose,
  onApply,
}: PitchEditorModalProps) {
  const { t } = useLanguage();
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [track, setTrack] = useState<PitchFrame[]>([]);
  const [notes, setNotes] = useState<PitchNote[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [keyIndex, setKeyIndex] = useState(defaultKeyIndex);
  const [scale, setScale] = useState<PitchScale>(defaultScale);
  const [flatten, setFlatten] = useState(0);
  const [pxPerSec, setPxPerSec] = useState(140);
  const [busy, setBusy] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const previewSource = useRef<AudioBufferSourceNode | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const drag = useRef<{ id: number; startY: number; startTarget: number } | null>(null);

  const stopPreview = useCallback(() => {
    try { previewSource.current?.stop(); } catch {}
    previewSource.current = null;
    setPreviewing(false);
  }, []);

  useEffect(() => {
    if (!isOpen || !buffer) return;
    setKeyIndex(defaultKeyIndex);
    setScale(defaultScale);
    setFlatten(0);
    setSelectedId(null);
    setError(null);
    setNotes([]);
    setTrack([]);
    setAnalyzing(true);
    // Yield so the "Analyzing" state paints before the CPU-heavy tracking starts.
    const timer = window.setTimeout(() => {
      try {
        const detected = detectPitchTrack(mixToMono(buffer), buffer.sampleRate);
        const found = segmentNotes(detected);
        if (found.length === 0) setError(t("pitchEdit.noNotes"));
        setTrack(detected);
        setNotes(found);
        setSelectedId(found[0]?.id ?? null);
      } catch (analysisError) {
        setError(analysisError instanceof Error ? analysisError.message : t("pitch.failed"));
      } finally {
        setAnalyzing(false);
      }
    }, 30);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, buffer]);

  useEffect(() => {
    if (!isOpen) stopPreview();
    return stopPreview;
  }, [isOpen, stopPreview]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, busy, onClose]);

  const range = useMemo(() => {
    if (notes.length === 0) return { lo: 48, hi: 72 };
    const lows = notes.map((note) => Math.min(note.midi, note.targetMidi));
    const highs = notes.map((note) => Math.max(note.midi, note.targetMidi));
    return { lo: Math.floor(Math.min(...lows)) - 8, hi: Math.ceil(Math.max(...highs)) + 8 };
  }, [notes.length]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!scroller.current || notes.length === 0) return;
    const mid = notes.reduce((sum, note) => sum + note.midi, 0) / notes.length;
    scroller.current.scrollTop = Math.max(0, (range.hi - mid) * ROW - scroller.current.clientHeight / 2);
    // Only recentre when a new analysis arrives.
  }, [range.hi, notes.length]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!isOpen) return null;

  const duration = buffer?.duration ?? 0;
  const width = Math.max(300, duration * pxPerSec);
  const height = (range.hi - range.lo + 1) * ROW;
  const yFor = (midi: number) => (range.hi - midi + 0.5) * ROW;
  const clampMidi = (midi: number) => Math.max(range.lo, Math.min(range.hi, midi));

  const setTarget = (id: number, target: number) =>
    setNotes((prev) => prev.map((note) => note.id === id ? { ...note, targetMidi: clampMidi(target) } : note));

  const handleKey = (event: React.KeyboardEvent, note: PitchNote) => {
    const fine = event.shiftKey;
    if (event.key === "ArrowUp") setTarget(note.id, fine ? note.targetMidi + 0.1 : Math.round(note.targetMidi) + 1);
    else if (event.key === "ArrowDown") setTarget(note.id, fine ? note.targetMidi - 0.1 : Math.round(note.targetMidi) - 1);
    else if (event.key === "Delete" || event.key === "Backspace" || event.key === "0") setTarget(note.id, note.midi);
    else return;
    event.preventDefault();
    event.stopPropagation();
  };

  const snapNote = (note: PitchNote): PitchNote => ({ ...note, targetMidi: nearestScaleMidi(note.midi, keyIndex, scale) });
  const snapSelected = () => setNotes((prev) => prev.map((note) => note.id === selectedId ? snapNote(note) : note));
  const snapAll = () => setNotes((prev) => prev.map(snapNote));
  const resetAll = () => setNotes((prev) => prev.map((note) => ({ ...note, targetMidi: note.midi })));
  const editedCount = notes.filter((note) => Math.abs(note.targetMidi - note.midi) >= 0.005).length;

  const render = (): AudioBuffer => applyManualEdits(buffer!, getContext(), track, notes, { flatten, transitionMs: 25 });

  const preview = () => {
    if (!buffer) return;
    if (previewing) {
      stopPreview();
      return;
    }
    setBusy(true);
    window.setTimeout(() => {
      try {
        const ctx = getContext();
        if (ctx.state === "suspended") void ctx.resume();
        const source = ctx.createBufferSource();
        source.buffer = render();
        source.connect(ctx.destination);
        source.onended = () => {
          if (previewSource.current === source) stopPreview();
        };
        source.start();
        previewSource.current = source;
        setPreviewing(true);
      } catch (previewError) {
        setError(previewError instanceof Error ? previewError.message : t("pitch.failed"));
      } finally {
        setBusy(false);
      }
    }, 30);
  };

  const apply = () => {
    if (!buffer) return;
    stopPreview();
    setBusy(true);
    window.setTimeout(() => {
      try {
        onApply(render());
      } catch (applyError) {
        setError(applyError instanceof Error ? applyError.message : t("pitch.failed"));
      } finally {
        setBusy(false);
      }
    }, 30);
  };

  const contourPath = (() => {
    let path = "";
    let drawing = false;
    track.forEach((frame) => {
      if (frame.freq <= 0) {
        drawing = false;
        return;
      }
      const midi = 69 + 12 * Math.log2(frame.freq / 440);
      path += `${drawing ? "L" : "M"}${(frame.time * pxPerSec).toFixed(1)},${yFor(midi).toFixed(1)}`;
      drawing = true;
    });
    return path;
  })();

  const rows: number[] = [];
  for (let midi = range.hi; midi >= range.lo; midi--) rows.push(midi);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t("pitchEdit.title")}
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-3"
      onClick={() => { if (!busy) onClose(); }}
    >
      <div
        className="flex max-h-[94vh] w-[960px] max-w-full flex-col rounded-2xl border-2 border-[#20232c] bg-[#12141a] font-sans shadow-[0_25px_60px_rgba(0,0,0,0.9)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex h-10 flex-none items-center justify-between border-b border-[#3B3155] bg-[#1a1c24] px-4">
          <span className="text-xs font-bold text-white">
            {t("pitchEdit.title")} <span className="font-semibold text-[#75DEFF]">({clipName})</span>
          </span>
          <button aria-label="Close" onClick={onClose} disabled={busy} className="text-xs font-bold text-zinc-400 hover:text-white disabled:opacity-40">✕</button>
        </div>

        <div className="flex flex-none flex-wrap items-end gap-3 border-b border-[#2a2540] px-4 py-3 text-[11px] text-zinc-300">
          <p className="basis-full text-zinc-400">{t("pitchEdit.hint")}</p>
          <label>
            <span className="mb-1 block font-bold">{t("pitch.key")}</span>
            <select value={keyIndex} onChange={(event) => setKeyIndex(Number(event.target.value))}
              className="rounded border border-[#3B3155] bg-[#201933] px-2 py-1 text-white">
              {KEY_NAMES.map((name, index) => <option key={name} value={index}>{name}</option>)}
            </select>
          </label>
          <label>
            <span className="mb-1 block font-bold">{t("pitch.scale")}</span>
            <select value={scale} onChange={(event) => setScale(event.target.value as PitchScale)}
              className="rounded border border-[#3B3155] bg-[#201933] px-2 py-1 text-white">
              <option value="major">{t("pitch.major")}</option>
              <option value="minor">{t("pitch.minor")}</option>
              <option value="chromatic">{t("pitch.chromatic")}</option>
            </select>
          </label>
          <button onClick={snapSelected} disabled={selectedId === null}
            className="rounded border border-[#3B3155] bg-[#201933] px-3 py-1 font-bold hover:border-[#75DEFF] hover:text-white disabled:opacity-40">
            {t("pitchEdit.snapSelected")}
          </button>
          <button onClick={snapAll} disabled={notes.length === 0}
            className="rounded border border-[#3B3155] bg-[#201933] px-3 py-1 font-bold hover:border-[#75DEFF] hover:text-white disabled:opacity-40">
            {t("pitchEdit.snapAll")}
          </button>
          <button onClick={resetAll} disabled={editedCount === 0}
            className="rounded border border-[#3B3155] bg-[#201933] px-3 py-1 font-bold hover:border-[#75DEFF] hover:text-white disabled:opacity-40">
            {t("pitchEdit.resetAll")}
          </button>
          <label title={t("pitchEdit.flattenHint")}>
            <span className="mb-1 flex justify-between font-bold">{t("pitchEdit.flatten")}<span className="font-mono text-zinc-400">{Math.round(flatten * 100)}%</span></span>
            <input type="range" min={0} max={1} step={0.05} value={flatten}
              onChange={(event) => setFlatten(Number(event.target.value))} className="w-28 accent-sky-500" />
          </label>
          <label>
            <span className="mb-1 block font-bold">{t("pitchEdit.zoom")}</span>
            <input type="range" min={60} max={400} step={10} value={pxPerSec}
              onChange={(event) => setPxPerSec(Number(event.target.value))} className="w-24 accent-sky-500" />
          </label>
        </div>

        <div className="relative min-h-[200px] flex-1 overflow-hidden">
          {analyzing && (
            <div className="flex h-[300px] items-center justify-center text-xs text-zinc-300" aria-live="polite">{t("pitchEdit.analyzing")}</div>
          )}
          {!analyzing && error && notes.length === 0 && (
            <div className="flex h-[300px] items-center justify-center px-6 text-center text-xs text-amber-300" role="alert">{error}</div>
          )}
          {!analyzing && notes.length > 0 && (
            <div ref={scroller} className="h-[340px] max-h-[55vh] overflow-auto bg-[#0e1015]">
              <div className="relative" style={{ width: width + LABEL_WIDTH, height }}>
                <div className="sticky left-0 z-20 float-left h-full bg-[#15171d]" style={{ width: LABEL_WIDTH }}>
                  {rows.map((midi) => (
                    <div key={midi} style={{ height: ROW }}
                      className={`flex items-center justify-end pr-1 text-[8px] ${midi % 12 === 0 ? "font-bold text-sky-300" : "text-zinc-600"}`}>
                      {BLACK_KEYS.has(midi % 12) && midi % 12 !== 0 ? "" : `${NOTE_NAMES[midi % 12]}${Math.floor(midi / 12) - 1}`}
                    </div>
                  ))}
                </div>
                <div className="relative" style={{ marginLeft: LABEL_WIDTH, width, height }}>
                  {rows.map((midi) => (
                    <div key={midi} style={{ top: (range.hi - midi) * ROW, height: ROW }}
                      className={`absolute inset-x-0 border-b border-white/[0.04] ${BLACK_KEYS.has(midi % 12) ? "bg-white/[0.03]" : ""} ${midi % 12 === 0 ? "border-b-sky-500/30" : ""}`} />
                  ))}
                  <svg width={width} height={height} className="pointer-events-none absolute inset-0">
                    <path d={contourPath} fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth={1.25} />
                  </svg>
                  {notes.map((note) => {
                    const edited = Math.abs(note.targetMidi - note.midi) >= 0.005;
                    const left = note.startTime * pxPerSec;
                    const noteWidth = Math.max(8, (note.endTime - note.startTime) * pxPerSec);
                    return (
                      <React.Fragment key={note.id}>
                        {edited && (
                          <div className="pointer-events-none absolute rounded border border-dashed border-white/30"
                            style={{ left, width: noteWidth, top: yFor(note.midi) - ROW / 2 + 1, height: ROW - 2 }} />
                        )}
                        <div
                          role="slider"
                          tabIndex={0}
                          aria-label={t("pitchEdit.noteLabel", { time: note.startTime.toFixed(2), note: noteLabel(note.midi) })}
                          aria-valuemin={range.lo}
                          aria-valuemax={range.hi}
                          aria-valuenow={Number(note.targetMidi.toFixed(2))}
                          aria-valuetext={noteLabel(note.targetMidi)}
                          onFocus={() => setSelectedId(note.id)}
                          onKeyDown={(event) => handleKey(event, note)}
                          onDoubleClick={() => setTarget(note.id, note.midi)}
                          onPointerDown={(event) => {
                            setSelectedId(note.id);
                            drag.current = { id: note.id, startY: event.clientY, startTarget: note.targetMidi };
                            (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
                          }}
                          onPointerMove={(event) => {
                            const active = drag.current;
                            if (!active || active.id !== note.id) return;
                            const raw = active.startTarget + (active.startY - event.clientY) / ROW;
                            setTarget(note.id, event.shiftKey ? raw : Math.round(raw));
                          }}
                          onPointerUp={(event) => {
                            drag.current = null;
                            try { (event.currentTarget as HTMLElement).releasePointerCapture(event.pointerId); } catch {}
                          }}
                          className={`absolute z-10 flex cursor-ns-resize touch-none items-center overflow-hidden rounded px-1 text-[9px] font-bold leading-none outline-none focus-visible:ring-2 focus-visible:ring-white ${
                            note.id === selectedId ? "bg-sky-400 text-black" : edited ? "bg-violet-500 text-white" : "bg-sky-700/80 text-white"
                          }`}
                          style={{ left, width: noteWidth, top: yFor(note.targetMidi) - ROW / 2 + 1, height: ROW - 2 }}
                        >
                          {noteWidth > 34 ? noteLabel(note.targetMidi) : ""}
                        </div>
                      </React.Fragment>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-none items-center justify-between gap-3 border-t border-[#3B3155] px-4 py-3 text-[11px]">
          <span className="text-zinc-400" aria-live="polite">
            {error && notes.length > 0 ? error : t("pitchEdit.summary", { count: notes.length, edited: editedCount })}
          </span>
          <div className="flex gap-2">
            <button onClick={onClose} disabled={busy}
              className="rounded px-3 py-1.5 font-bold text-zinc-400 hover:text-white disabled:opacity-40">{t("pitch.cancel")}</button>
            <button onClick={preview} disabled={busy || analyzing || notes.length === 0}
              className="rounded border border-[#3B3155] bg-[#201933] px-3 py-1.5 font-bold text-white hover:border-[#75DEFF] disabled:opacity-40">
              {previewing ? t("pitchEdit.stop") : t("pitchEdit.preview")}
            </button>
            <button onClick={apply} disabled={busy || analyzing || editedCount === 0}
              className="rounded bg-sky-500 px-4 py-1.5 font-bold text-black hover:bg-sky-400 disabled:opacity-60">
              {busy ? t("pitch.processing") : t("pitch.apply")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
