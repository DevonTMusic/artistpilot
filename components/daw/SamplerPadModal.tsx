"use client";
import React, { useEffect, useRef, useState } from "react";
import { AudioEngine, SamplerData, SamplerPad, TrackData } from "@/lib/AudioEngine";
import { sourceBlobs } from "@/lib/daw/sessionFile";
import { useLanguage } from "@/components/LanguageProvider";

const PAD_KEYS = ["a", "s", "d", "f", "j", "k", "l", ";"];

interface SamplerPadModalProps {
  isOpen: boolean;
  track: TrackData | null;
  audioContext: AudioContext;
  onChange: (sampler: SamplerData | undefined) => void;
  onClose: () => void;
}

function suggestBoundaries(buffer: AudioBuffer): number[] {
  const samples = buffer.getChannelData(0);
  const windowSize = Math.max(1, Math.floor(buffer.sampleRate * 0.01));
  const rms: number[] = [];
  for (let offset = 0; offset < samples.length; offset += windowSize) {
    const end = Math.min(samples.length, offset + windowSize);
    let energy = 0;
    for (let index = offset; index < end; index++) energy += samples[index] * samples[index];
    rms.push(Math.sqrt(energy / Math.max(1, end - offset)));
  }
  const peak = Math.max(0, ...rms);
  const threshold = Math.max(0.025, peak * 0.2);
  const onsets: number[] = [];
  let lastOnset = -Infinity;
  for (let index = 1; index < rms.length; index++) {
    const time = (index * windowSize) / buffer.sampleRate;
    if (rms[index] >= threshold && rms[index - 1] < threshold && time - lastOnset >= 0.08) {
      onsets.push(time);
      lastOnset = time;
    }
  }
  const candidates = onsets.filter((time) => time > 0.01 && time < buffer.duration - 0.01);
  const boundaries = [0, ...candidates.slice(0, 7), buffer.duration].sort((a, b) => a - b);
  while (boundaries.length < 9) {
    const index = boundaries.length - 1;
    boundaries.splice(index, 0, (buffer.duration * index) / 8);
    boundaries.sort((a, b) => a - b);
  }
  return boundaries.slice(0, 9);
}

function createPads(buffer: AudioBuffer): SamplerPad[] {
  const boundaries = suggestBoundaries(buffer);
  return PAD_KEYS.map((key, index) => ({
    id: `pad-${index + 1}`,
    name: `Slice ${index + 1}`,
    key,
    startTime: boundaries[index],
    endTime: Math.max(boundaries[index] + 0.01, boundaries[index + 1]),
  }));
}

export function SamplerPadModal({ isOpen, track, audioContext, onChange, onClose }: SamplerPadModalProps) {
  const { t } = useLanguage();
  const fileRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);
  const sampler = track?.sampler;

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement;
      if (target.matches("input, textarea, select, button")) return;
      const index = PAD_KEYS.indexOf(event.key.toLowerCase());
      const pad = sampler?.pads[index];
      if (!pad || !track) return;
      event.preventDefault();
      AudioEngine.getInstance().playSamplerPad(track, pad);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, sampler, track]);

  if (!isOpen || !track) return null;

  const loadSample = async (file?: File) => {
    if (!file) return;
    setError("");
    try {
      if (!file.type.startsWith("audio/")) throw new Error(t("sampler.audioError"));
      const buffer = await audioContext.decodeAudioData(await file.arrayBuffer());
      sourceBlobs.set(buffer, file);
      const next: SamplerData = { sampleName: file.name, sample: buffer, pads: createPads(buffer) };
      onChange(next);
    } catch (cause) {
      console.error("Could not load sampler audio:", cause);
      setError(cause instanceof Error ? cause.message : t("sampler.loadError"));
    }
  };

  const updatePad = (padId: string, updates: Partial<SamplerPad>) => {
    if (!sampler) return;
    onChange({
      ...sampler,
      pads: sampler.pads.map((pad) => {
        if (pad.id !== padId) return pad;
        const next = { ...pad, ...updates };
        next.startTime = Math.max(0, Math.min(next.startTime, sampler.sample.duration - 0.01));
        next.endTime = Math.max(next.startTime + 0.01, Math.min(next.endTime, sampler.sample.duration));
        return next;
      }),
    });
  };

  return (
    <div className="fixed inset-0 z-[75] flex items-center justify-center bg-black/80 p-4">
      <section
        onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          void loadSample(event.dataTransfer.files[0]);
        }}
        className={`max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-xl border bg-[#15171d] p-4 shadow-2xl ${dragging ? "border-sky-400" : "border-zinc-700"}`}
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-white">{t("sampler.title", { track: track.name })}</h2>
            <p className="mt-1 text-[10px] text-zinc-400">{t("sampler.help")}</p>
          </div>
          <div className="flex gap-2">
            <input ref={fileRef} type="file" accept="audio/*,.wav,.mp3,.m4a,.ogg,.webm" className="hidden" onChange={(event) => { void loadSample(event.target.files?.[0]); event.currentTarget.value = ""; }} />
            <button onClick={() => fileRef.current?.click()} className="rounded bg-sky-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-600">{t("sampler.load")}</button>
            <button onClick={onClose} className="rounded bg-zinc-800 px-3 py-1.5 text-xs text-zinc-200 hover:bg-zinc-700">{t("sampler.close")}</button>
          </div>
        </div>
        {sampler ? (
          <>
            <p className="mb-3 truncate text-[10px] text-zinc-400">{sampler.sampleName} · {sampler.sample.duration.toFixed(2)} {t("sampler.seconds")} · {t("sampler.onsetHelp")}</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {sampler.pads.map((pad) => (
                <div key={pad.id} className="rounded-lg border border-zinc-800 bg-[#0f1015] p-2">
                  <button onClick={() => AudioEngine.getInstance().playSamplerPad(track, pad)} className="mb-2 flex w-full items-center justify-between rounded bg-zinc-800 px-2 py-2 text-left text-xs font-bold text-white hover:bg-sky-800">
                    <span>{pad.name}</span><kbd className="rounded bg-black px-1.5 py-0.5 text-[10px] text-sky-300">{pad.key.toUpperCase()}</kbd>
                  </button>
                  <input aria-label={`${pad.name} name`} value={pad.name} onChange={(event) => updatePad(pad.id, { name: event.target.value.slice(0, 32) })} className="mb-2 w-full rounded bg-zinc-900 px-2 py-1 text-[10px] text-white" />
                  <label className="block text-[9px] text-zinc-500">{t("sampler.start")} {pad.startTime.toFixed(2)}s
                    <input type="range" min={0} max={Math.max(0.01, pad.endTime - 0.01)} step={0.01} value={pad.startTime} onChange={(event) => updatePad(pad.id, { startTime: Number(event.target.value) })} className="block w-full accent-sky-400" />
                  </label>
                  <label className="block text-[9px] text-zinc-500">{t("sampler.end")} {pad.endTime.toFixed(2)}s
                    <input type="range" min={Math.min(sampler.sample.duration, pad.startTime + 0.01)} max={sampler.sample.duration} step={0.01} value={pad.endTime} onChange={(event) => updatePad(pad.id, { endTime: Number(event.target.value) })} className="block w-full accent-violet-400" />
                  </label>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="rounded-lg border border-dashed border-zinc-700 p-10 text-center text-xs text-zinc-500">{t("sampler.dropHint")}</div>
        )}
        {error && <p role="alert" className="mt-3 rounded bg-rose-950/60 p-2 text-xs text-rose-300">{error}</p>}
      </section>
    </div>
  );
}
