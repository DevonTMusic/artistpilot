// components/daw/RecordingSettingsModal.tsx
"use client";
import React, { useEffect, useRef, useState } from "react";
import { useLanguage } from "@/components/LanguageProvider";
import { AudioInputManager, AudioInputDevice } from "@/lib/daw/AudioInputManager";

interface RecordingSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  ctx: AudioContext | null;
  onSelectDevice: (deviceId: string) => void;
  onToggleMonitoring: (enabled: boolean) => void;
  monitoringEnabled: boolean;
}

export function RecordingSettingsModal({
  isOpen,
  onClose,
  ctx,
  onSelectDevice,
  onToggleMonitoring,
  monitoringEnabled,
}: RecordingSettingsModalProps) {
  const { t } = useLanguage();
  const [devices, setDevices] = useState<AudioInputDevice[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<string>("");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number | null>(null);

  useEffect(() => {
    if (isOpen) {
      AudioInputManager.getInstance().getAvailableInputs().then((devs) => {
        setDevices(devs);
        if (devs.length > 0 && !selectedDevice) {
          setSelectedDevice(devs[0].deviceId);
        }
      });
    }
  }, [isOpen]);

  // Live Oscilloscope Waveform visualizer
  useEffect(() => {
    if (!isOpen) return;
    const analyser = AudioInputManager.getInstance().analyserNode;
    const cv = canvasRef.current;
    if (!cv || !analyser) return;

    const canvasCtx = cv.getContext("2d");
    if (!canvasCtx) return;

    const dataArray = new Uint8Array(analyser.frequencyBinCount);

    const draw = () => {
      animRef.current = requestAnimationFrame(draw);
      analyser.getByteTimeDomainData(dataArray);

      canvasCtx.fillStyle = "#0c0d11";
      canvasCtx.fillRect(0, 0, cv.width, cv.height);

      canvasCtx.lineWidth = 2;
      canvasCtx.strokeStyle = "#38bdf8"; // Sky Blue Live Wave
      canvasCtx.beginPath();

      const sliceWidth = (cv.width * 1.0) / dataArray.length;
      let x = 0;

      for (let i = 0; i < dataArray.length; i++) {
        const v = dataArray[i] / 128.0;
        const y = (v * cv.height) / 2;

        if (i === 0) canvasCtx.moveTo(x, y);
        else canvasCtx.lineTo(x, y);

        x += sliceWidth;
      }

      canvasCtx.lineTo(cv.width, cv.height / 2);
      canvasCtx.stroke();
    };

    draw();

    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="absolute top-24 left-32 z-50 w-[480px] rounded-2xl border-2 border-[#20222a] bg-[#14151b] shadow-[0_25px_60px_rgba(0,0,0,0.9)] overflow-hidden font-sans select-none">
      
      {/* Header */}
      <div className="flex h-10 items-center justify-between border-b border-zinc-800 bg-[#1e2028] px-4 cursor-move">
        <span className="text-xs font-bold text-white flex items-center gap-1.5">
          {t("audio.recordingInput")}
        </span>
        <button onClick={onClose} className="text-xs text-zinc-400 hover:text-white font-bold">✕</button>
      </div>

      <div className="p-4 space-y-4">
        {/* Device Dropdown */}
        <div>
          <label className="text-[10px] font-bold text-zinc-400 block mb-1.5">{t("audio.inputDevice")}</label>
          <select
            value={selectedDevice}
            onChange={(e) => {
              setSelectedDevice(e.target.value);
              onSelectDevice(e.target.value);
            }}
            className="w-full rounded-lg bg-[#0a0a0d] border border-zinc-700/80 p-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-sky-500"
          >
            {devices.map((d) => (
              <option key={d.deviceId} value={d.deviceId}>
                {d.label}
              </option>
            ))}
          </select>
          <span className="text-[9px] text-zinc-500 mt-1 block">{t("audio.deviceSupport")}</span>
        </div>

        {/* Live Input Waveform Monitor */}
        <div>
          <span className="text-[10px] font-bold text-zinc-400 block mb-1.5">{t("audio.liveWaveform")}</span>
          <div className="h-16 w-full rounded-lg border border-zinc-800 overflow-hidden bg-black">
            <canvas ref={canvasRef} width={450} height={64} className="h-full w-full" />
          </div>
        </div>

        {/* Direct Monitoring Toggle */}
        <div className="flex items-center justify-between p-3 rounded-lg bg-[#191b22] border border-zinc-800">
          <div>
            <span className="text-xs font-bold text-white block">{t("audio.monitoring")}</span>
            <span className="text-[10px] text-zinc-400">{t("audio.monitoringHelp")}</span>
          </div>
          <button
            onClick={() => onToggleMonitoring(!monitoringEnabled)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition shadow ${
              monitoringEnabled
                ? "bg-sky-500 text-black shadow-sky-500/50"
                : "bg-zinc-800 text-zinc-400 hover:text-white"
            }`}
          >
            {monitoringEnabled ? t("audio.monitoringOn") : t("audio.muted")}
          </button>
        </div>
      </div>

    </div>
  );
}
