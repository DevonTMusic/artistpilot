// components/daw/AudioSettingsModal.tsx
"use client";
import React, { useEffect, useRef, useState } from "react";
import { AudioDeviceManager, DeviceInfo } from "@/lib/daw/AudioDeviceManager";
import { useLanguage } from "@/components/LanguageProvider";

interface AudioSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  ctx: AudioContext | null;
  activeInputDeviceName: string;
  activeInputDeviceId: string;
  activeOutputDeviceId: string;
  onSelectInputDevice: (deviceId: string, label: string) => void;
  onSelectOutputDevice: (deviceId: string) => boolean | Promise<boolean>;
  isMonitoring: boolean;
  onToggleMonitoring: (enabled: boolean) => void;
}

export function AudioSettingsModal({
  isOpen,
  onClose,
  ctx,
  activeInputDeviceName,
  activeInputDeviceId,
  activeOutputDeviceId,
  onSelectInputDevice,
  onSelectOutputDevice,
  isMonitoring,
  onToggleMonitoring,
}: AudioSettingsModalProps) {
  const { t } = useLanguage();
  const manager = useRef<AudioDeviceManager>(AudioDeviceManager.getInstance());
  const [inputs, setInputs] = useState<DeviceInfo[]>([]);
  const [outputs, setOutputs] = useState<DeviceInfo[]>([]);
  const [selectedInput, setSelectedInput] = useState<string>("default");
  const [selectedOutput, setSelectedOutput] = useState<string>("default");
  const [inputLevel, setInputLevel] = useState<number>(0);
  const [isClipping, setIsClipping] = useState<boolean>(false);
  const [permissionGranted, setPermissionGranted] = useState<boolean>(false);
  const [meterError, setMeterError] = useState("");
  const [outputError, setOutputError] = useState("");

  // Scan hardware on open
  useEffect(() => {
    if (!isOpen) return;
    setSelectedInput(activeInputDeviceId);
    setSelectedOutput(activeOutputDeviceId);

    manager.current.requestPermissionAndEnumerate().then(({ inputs, outputs }) => {
      setInputs(inputs);
      setOutputs(outputs);
      setPermissionGranted(manager.current.permissionGranted);
    });

    const unsubscribe = manager.current.subscribe((inList, outList) => {
      setInputs(inList);
      setOutputs(outList);
    });

    return () => unsubscribe();
  }, [isOpen, activeInputDeviceId, activeOutputDeviceId]);

  // Real-time Peak Level & Clipping Meter
  useEffect(() => {
    if (!isOpen || !ctx || !permissionGranted) return;
    let cancelled = false;
    let frameId = 0;
    let previewStream: MediaStream | null = null;
    let source: MediaStreamAudioSourceNode | null = null;
    let analyser: AnalyserNode | null = null;

    const updateMeter = () => {
      if (!analyser) return;
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteTimeDomainData(dataArray);
      let peak = 0;
      for (let i = 0; i < dataArray.length; i++) {
        peak = Math.max(peak, Math.abs((dataArray[i] - 128) / 128));
      }
      setInputLevel(Math.min(100, Math.round(peak * 115)));
      setIsClipping(peak >= 0.98);
      frameId = requestAnimationFrame(updateMeter);
    };

    const startPreview = async () => {
      try {
        previewStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            deviceId: selectedInput === "default" ? undefined : { exact: selectedInput },
            echoCancellation: false,
            autoGainControl: false,
            noiseSuppression: false,
          },
        });
        if (cancelled) {
          previewStream.getTracks().forEach((track) => track.stop());
          return;
        }
        source = ctx.createMediaStreamSource(previewStream);
        analyser = ctx.createAnalyser();
        analyser.fftSize = 512;
        source.connect(analyser);
        setMeterError("");
        updateMeter();
      } catch (error) {
        setMeterError(error instanceof Error ? error.message : t("audio.inputAccessError"));
      }
    };
    void startPreview();

    return () => {
      cancelled = true;
      cancelAnimationFrame(frameId);
      try { source?.disconnect(); } catch {}
      previewStream?.getTracks().forEach((track) => track.stop());
    };
  }, [isOpen, ctx, selectedInput, permissionGranted]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 font-sans select-none">
      <div className="w-full max-w-lg rounded-2xl border-2 border-[#20222a] bg-[#14151b] shadow-2xl overflow-hidden flex flex-col text-zinc-300">
        
        {/* Title Bar */}
        <div className="flex h-11 items-center justify-between border-b border-zinc-800 bg-[#1c1e26] px-4">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-white flex items-center gap-1.5">
              {t("audio.systemTitle")}
            </span>
          </div>
          <button onClick={onClose} className="h-6 w-6 rounded hover:bg-red-500 text-zinc-400 hover:text-white flex items-center justify-center font-bold text-xs">
            ✕
          </button>
        </div>

        <div className="p-5 space-y-5 overflow-y-auto max-h-[80vh]">
          
          {/* Permission Alert if labels are hidden */}
          {!permissionGranted && (
            <div className="p-3 bg-amber-950/40 border border-amber-800/60 rounded-xl text-xs text-amber-200">
              <span className="font-bold block mb-0.5">{t("audio.permissionTitle")}</span>
              {t("audio.permissionHelp")}
            </div>
          )}

          {/* 1. Input Device Selector */}
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">{t("audio.inputLabel")}</label>
              <span className="text-[10px] text-sky-400 font-mono truncate max-w-[200px]">{activeInputDeviceName}</span>
            </div>

            <select
              value={selectedInput}
              onChange={(e) => {
                const devId = e.target.value;
                setSelectedInput(devId);
                const found = inputs.find((d) => d.deviceId === devId);
                onSelectInputDevice(devId, found?.label ?? t("audio.inputLabel"));
              }}
              className="w-full rounded-lg bg-[#0d0e12] border border-zinc-700/80 p-2.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-sky-500"
            >
              <option value="default">{t("audio.defaultInput")}</option>
              {inputs.map((d) => (
                <option key={d.deviceId} value={d.deviceId}>
                  {d.label}
                </option>
              ))}
            </select>
          </div>

          {/* 2. Real-time Hardware VU Meter */}
          <div>
            <div className="flex justify-between text-[10px] text-zinc-400 mb-1">
              <span>{t("audio.inputLevel")}</span>
              <span className={isClipping ? "text-red-500 font-black animate-pulse" : "text-zinc-400"}>
                {isClipping ? t("audio.clipping") : `${inputLevel}%`}
              </span>
            </div>
            
            <div className="h-3 w-full bg-[#0a0a0d] rounded border border-zinc-800 p-0.5 overflow-hidden flex items-center">
              <div
                style={{ width: `${inputLevel}%` }}
                className={`h-full rounded-sm transition-all duration-75 ${
                  inputLevel > 85 ? "bg-red-500 shadow-[0_0_8px_#ef4444]" : inputLevel > 65 ? "bg-amber-400" : "bg-emerald-400"
                }`}
              />
            </div>
            {meterError && <p role="alert" className="mt-1 text-[10px] text-amber-300">{meterError}</p>}
          </div>

          {/* 3. Output Device Selector */}
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 block mb-1.5">{t("audio.outputLabel")}</label>
            <select
              value={selectedOutput}
              onChange={(e) => {
                const devId = e.target.value;
                void (async () => {
                  const applied = await onSelectOutputDevice(devId);
                  if (applied) {
                    setSelectedOutput(devId);
                    setOutputError("");
                  } else {
                    setSelectedOutput(activeOutputDeviceId);
                    setOutputError(t("audio.outputRouteError"));
                  }
                })();
              }}
              className="w-full rounded-lg bg-[#0d0e12] border border-zinc-700/80 p-2.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-sky-500"
            >
              <option value="default">{t("audio.defaultOutput")}</option>
              {outputs.map((d) => (
                <option key={d.deviceId} value={d.deviceId}>
                  {d.label}
                </option>
              ))}
            </select>
            <span className="text-[9px] text-zinc-500 mt-1 block">{t("audio.routingNote")}</span>
            {outputError && <p role="alert" className="mt-1 text-[10px] text-amber-300">{outputError}</p>}
          </div>

          {/* 4. Direct Monitoring Switch */}
          <div className="flex items-center justify-between p-3.5 rounded-xl bg-[#181a22] border border-zinc-800">
            <div>
              <span className="text-xs font-bold text-white block">{t("audio.directLatency")}</span>
              <span className="text-[10px] text-zinc-400">{t("audio.routeHelp")}</span>
            </div>
            <button
              onClick={() => onToggleMonitoring(!isMonitoring)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition shadow ${
                isMonitoring ? "bg-sky-500 text-black shadow-sky-500/50" : "bg-zinc-800 text-zinc-400 hover:text-white"
              }`}
            >
              {isMonitoring ? t("audio.monitoringOn") : t("audio.muted")}
            </button>
          </div>

          {/* 5. Audio Engine Stats */}
          <div className="p-3 bg-black/40 rounded-xl border border-zinc-900 grid grid-cols-2 gap-2 text-[10px] font-mono text-zinc-400">
            <div>{t("audio.sampleRate")}: <span className="text-white font-bold">{ctx?.sampleRate ?? 44100} Hz</span></div>
            <div>{t("audio.latencyState")}: <span className="text-emerald-400 font-bold">{t("audio.interactiveLow")}</span></div>
          </div>

        </div>

        <div className="p-4 border-t border-zinc-800 bg-[#171920] flex justify-between items-center">
          <button
            onClick={() => manager.current.refreshDevices()}
            className="text-xs text-sky-400 hover:text-sky-300 font-semibold"
          >
            ↻ {t("audio.rescan")}
          </button>
          <button
            onClick={onClose}
            className="rounded-lg bg-zinc-700 hover:bg-zinc-600 px-4 py-1.5 text-xs font-bold text-white"
          >
            {t("audio.done")}
          </button>
        </div>

      </div>
    </div>
  );
}
