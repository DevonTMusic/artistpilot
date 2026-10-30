"use client";

import React, { useEffect, useRef, useState } from "react";
import { useLanguage } from "@/components/LanguageProvider";

interface InputDevice {
  deviceId: string;
  label: string;
}

interface ChromaticTunerProps {
  isOpen: boolean;
  onClose: () => void;
  instrumentName?: string;
}

const NOTE_NAMES = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"];

export function detectPitch(samples: Float32Array, sampleRate: number): number | null {
  const size = samples.length;
  let sum = 0;
  for (let i = 0; i < size; i++) sum += samples[i] * samples[i];
  if (Math.sqrt(sum / size) < 0.012) return null;

  let bestOffset = -1;
  let bestCorrelation = 0;
  let previousCorrelation = 1;
  const minOffset = Math.max(2, Math.floor(sampleRate / 1200));
  const maxOffset = Math.min(Math.floor(sampleRate / 35), Math.floor(size / 2));
  for (let offset = minOffset; offset <= maxOffset; offset++) {
    let difference = 0;
    for (let i = 0; i < size - offset; i++) difference += Math.abs(samples[i] - samples[i + offset]);
    const correlation = 1 - difference / (size - offset);
    if (correlation > 0.9 && correlation > previousCorrelation) {
      bestCorrelation = correlation;
      bestOffset = offset;
      break;
    }
    if (correlation > bestCorrelation) {
      bestCorrelation = correlation;
      bestOffset = offset;
    }
    previousCorrelation = correlation;
  }
  if (bestOffset < 0 || bestCorrelation < 0.72) return null;

  const left = bestOffset > minOffset ? bestOffset - 1 : bestOffset;
  const right = Math.min(maxOffset, bestOffset + 1);
  let refinedOffset = bestOffset;
  if (left !== bestOffset && right !== bestOffset) {
    const correlations = (offset: number) => {
      let difference = 0;
      for (let i = 0; i < size - offset; i++) difference += Math.abs(samples[i] - samples[i + offset]);
      return 1 - difference / (size - offset);
    };
    const y1 = correlations(left);
    const y2 = correlations(bestOffset);
    const y3 = correlations(right);
    const denominator = 2 * (2 * y2 - y1 - y3);
    if (Math.abs(denominator) > 1e-8) refinedOffset += (y3 - y1) / denominator;
  }
  return sampleRate / refinedOffset;
}

export function ChromaticTuner({ isOpen, onClose, instrumentName }: ChromaticTunerProps) {
  const { t } = useLanguage();
  const [devices, setDevices] = useState<InputDevice[]>([]);
  const [deviceId, setDeviceId] = useState("default");
  const [isListening, setIsListening] = useState(false);
  const [frequency, setFrequency] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [permissionRequested, setPermissionRequested] = useState(false);
  const contextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const frameRef = useRef<number | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);

  const stopListening = () => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
    analyserRef.current?.disconnect();
    analyserRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (contextRef.current && contextRef.current.state !== "closed") {
      void contextRef.current.close();
    }
    contextRef.current = null;
    setIsListening(false);
    setFrequency(null);
  };

  useEffect(() => {
    if (!isOpen) stopListening();
    return () => stopListening();
  }, [isOpen]);

  const refreshDevices = async () => {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    const inputs = (await navigator.mediaDevices.enumerateDevices())
      .filter((device) => device.kind === "audioinput")
      .map((device, index) => ({
        deviceId: device.deviceId,
        label: device.label || `Microphone ${index + 1}`,
      }));
    setDevices(inputs);
    if (inputs.length && !inputs.some((input) => input.deviceId === deviceId)) {
      setDeviceId(inputs[0].deviceId);
    }
  };

  const startListening = async () => {
    stopListening();
    setError("");
    setPermissionRequested(true);
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error(t("tuner.noMicrophone"));
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          deviceId: deviceId === "default" ? undefined : { exact: deviceId },
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });
      const context = new AudioContext();
      if (context.state === "suspended") await context.resume();
      const analyser = context.createAnalyser();
      analyser.fftSize = 4096;
      analyser.smoothingTimeConstant = 0.15;
      context.createMediaStreamSource(stream).connect(analyser);
      streamRef.current = stream;
      contextRef.current = context;
      analyserRef.current = analyser;
      setIsListening(true);
      await refreshDevices();
      const samples = new Float32Array(analyser.fftSize);
      let lastPitchUpdate = 0;
      const update = () => {
        const now = performance.now();
        if (now - lastPitchUpdate >= 50) {
          analyser.getFloatTimeDomainData(samples);
          setFrequency(detectPitch(samples, context.sampleRate));
          lastPitchUpdate = now;
        }
        frameRef.current = requestAnimationFrame(update);
      };
      update();
    } catch (cause) {
      stopListening();
      setError(cause instanceof Error ? cause.message : t("tuner.startError"));
    }
  };

  if (!isOpen) return null;

  const noteNumber = frequency === null ? null : Math.round(69 + 12 * Math.log2(frequency / 440));
  const noteName = noteNumber === null ? "—" : NOTE_NAMES[((noteNumber % 12) + 12) % 12];
  const octave = noteNumber === null ? "" : String(Math.floor(noteNumber / 12) - 1);
  const targetFrequency = noteNumber === null ? null : 440 * 2 ** ((noteNumber - 69) / 12);
  const cents = frequency === null || targetFrequency === null
    ? 0
    : Math.round(1200 * Math.log2(frequency / targetFrequency));
  const needle = Math.max(-50, Math.min(50, cents));

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/75 p-4">
      <section role="dialog" aria-modal="true" aria-label={t("tuner.title")} className="w-full max-w-md rounded-2xl border border-[#51456F] bg-[#15171d] p-5 text-zinc-200 shadow-2xl">
        <header className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-white">{t("tuner.title")}</h2>
            <p className="mt-1 text-xs text-zinc-400">
              {instrumentName ? `${instrumentName} · ` : ""}{t("tuner.browserNote")}
            </p>
          </div>
          <button onClick={onClose} aria-label={t("tuner.close")} className="rounded px-2 py-1 text-zinc-400 hover:bg-[#322849] hover:text-white">✕</button>
        </header>
        <label className="mb-5 block text-xs text-zinc-400">
          {t("tuner.microphone")}
          <select
            value={deviceId}
            onFocus={() => void refreshDevices()}
            onChange={(event) => setDeviceId(event.target.value)}
            disabled={isListening}
            className="mt-1 block w-full rounded-lg border border-[#51456F] bg-[#0d0f13] px-3 py-2 text-sm text-white disabled:opacity-60"
          >
            <option value="default">{t("tuner.systemDefault")}</option>
            {devices.map((device) => (
              <option key={device.deviceId} value={device.deviceId}>{device.label}</option>
            ))}
          </select>
        </label>
        <div className="rounded-xl border border-[#3B3155] bg-[#0c0e12] px-4 py-6 text-center">
          <div className="relative mx-auto mb-5 h-20 max-w-xs">
            <div className="absolute inset-x-0 top-10 h-px bg-zinc-700" />
            {[-50, -25, 0, 25, 50].map((value) => (
              <div key={value} className="absolute top-8 h-5 w-px bg-zinc-500" style={{ left: `${50 + value}%` }} />
            ))}
            <div
              className={`absolute left-1/2 top-1 h-10 w-1 origin-bottom rounded-full transition-transform duration-100 ${Math.abs(cents) <= 5 && frequency !== null ? "bg-[#4FE3C1]" : "bg-[#D0BCFF]"}`}
              style={{ transform: `translateX(-50%) rotate(${needle * 0.8}deg)` }}
            />
            <span className="absolute bottom-0 left-0 text-[10px] text-zinc-500">♭</span>
            <span className="absolute bottom-0 left-1/2 -translate-x-1/2 text-[10px] text-zinc-500">{t("tuner.inTune")}</span>
            <span className="absolute bottom-0 right-0 text-[10px] text-zinc-500">♯</span>
          </div>
          <div className="text-5xl font-black tracking-tight text-white">
            {noteName}<span className="ml-1 text-2xl text-zinc-400">{octave}</span>
          </div>
          <div className={`mt-2 text-sm font-semibold ${frequency === null ? "text-zinc-500" : Math.abs(cents) <= 5 ? "text-[#4FE3C1]" : "text-[#D0BCFF]"}`}>
            {frequency === null ? (isListening ? t("tuner.listening") : t("tuner.startListening")) : `${cents > 0 ? "+" : ""}${cents} cents`}
          </div>
          <div className="mt-1 font-mono text-xs text-zinc-500">
            {frequency === null ? "— Hz" : `${frequency.toFixed(1)} Hz`}
          </div>
        </div>
        {error && <p role="alert" className="mt-3 text-xs text-red-300">{error}</p>}
        {!permissionRequested && <p className="mt-3 text-[11px] text-zinc-500">{t("tuner.permission")}</p>}
        <footer className="mt-4 flex justify-end gap-2">
          {isListening && (
            <button onClick={stopListening} className="rounded-lg border border-[#51456F] px-4 py-2 text-xs font-semibold text-zinc-300 hover:bg-[#322849]">
              {t("tuner.stop")}
            </button>
          )}
          <button onClick={() => void startListening()} className="rounded-lg bg-sky-600 px-4 py-2 text-xs font-bold text-white hover:bg-sky-500">
            {isListening ? t("tuner.restart") : t("tuner.start")}
          </button>
        </footer>
      </section>
    </div>
  );
}
