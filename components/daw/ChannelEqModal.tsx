// components/daw/ChannelEqModal.tsx
"use client";
import React, { useEffect, useRef, useState } from "react";

interface ChannelEqModalProps {
  isOpen: boolean;
  onClose: () => void;
  trackName: string;
}

export function ChannelEqModal({ isOpen, onClose, trackName }: ChannelEqModalProps) {
  const [lowGain, setLowGain] = useState(0);    // -12 to +12 dB (Bass)
  const [midFreq, setMidFreq] = useState(1000);  // 200Hz to 5000Hz
  const [midGain, setMidGain] = useState(2);    // -12 to +12 dB
  const [highGain, setHighGain] = useState(1.5); // -12 to +12 dB (Treble)
  const [lowCut, setLowCut] = useState(true);   // 80Hz High-pass filter

  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Draw authentic GarageBand EQ frequency curve
  useEffect(() => {
    if (!isOpen) return;
    const cv = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, cv.width, cv.height);

    // Dark grid background
    ctx.strokeStyle = "#1f222c";
    ctx.lineWidth = 1;
    for (let x = 0; x < cv.width; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, cv.height);
      ctx.stroke();
    }
    for (let y = 0; y < cv.height; y += 30) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(cv.width, y);
      ctx.stroke();
    }

    // 0dB Center guide line
    ctx.strokeStyle = "#383c4a";
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(0, cv.height / 2);
    ctx.lineTo(cv.width, cv.height / 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Calculate & draw EQ curve
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = "#38bdf8"; // Cyan EQ Curve
    ctx.beginPath();

    const midX = (Math.log10(midFreq / 100) / Math.log10(100)) * cv.width;

    for (let x = 0; x < cv.width; x++) {
      let y = cv.height / 2;

      // Low Shelf influence
      if (x < 120) {
        y -= (lowGain * 2) * (1 - x / 120);
      }

      // High-Pass Filter roll off
      if (lowCut && x < 60) {
        y += Math.pow((60 - x) / 60, 2) * 50;
      }

      // Mid Parametric bell curve
      const dist = Math.abs(x - midX);
      if (dist < 80) {
        const bell = Math.cos((dist / 80) * (Math.PI / 2));
        y -= (midGain * 2.5) * bell;
      }

      // High Shelf influence
      if (x > cv.width - 140) {
        const factor = (x - (cv.width - 140)) / 140;
        y -= (highGain * 2) * factor;
      }

      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }

    ctx.stroke();

    // Fill gradient below curve
    ctx.lineTo(cv.width, cv.height);
    ctx.lineTo(0, cv.height);
    const grad = ctx.createLinearGradient(0, 0, 0, cv.height);
    grad.addColorStop(0, "rgba(56, 189, 248, 0.15)");
    grad.addColorStop(1, "rgba(56, 189, 248, 0.0)");
    ctx.fillStyle = grad;
    ctx.fill();
  }, [isOpen, lowGain, midFreq, midGain, highGain, lowCut]);

  if (!isOpen) return null;

  return (
    <div className="absolute top-28 left-1/3 z-50 w-[540px] rounded-2xl border-2 border-[#20232c] bg-[#12141a] shadow-[0_25px_60px_rgba(0,0,0,0.9)] overflow-hidden font-sans select-none">
      
      {/* Title Bar */}
      <div className="flex h-10 items-center justify-between border-b border-zinc-800 bg-[#1a1c24] px-4">
        <span className="text-xs font-bold text-white flex items-center gap-1.5">
          🎛️ 4-Band Visual Channel EQ <span className="text-sky-400 font-semibold">({trackName})</span>
        </span>
        <button onClick={onClose} className="text-xs text-zinc-400 hover:text-white font-bold">✕</button>
      </div>

      {/* Visual EQ Screen */}
      <div className="p-4 bg-[#0a0b0e]">
        <div className="h-36 w-full rounded-lg border border-zinc-800 bg-[#07080a] relative overflow-hidden">
          <canvas ref={canvasRef} width={508} height={144} className="h-full w-full" />
          <div className="absolute top-1.5 right-2 text-[9px] font-mono text-zinc-500">20Hz - 20kHz</div>
        </div>

        {/* Hardware EQ Knobs */}
        <div className="grid grid-cols-4 gap-3 pt-4 border-t border-zinc-800/80 mt-3 text-center">
          
          {/* Low Cut / Bass */}
          <div className="flex flex-col items-center">
            <span className="text-[9px] font-bold text-zinc-400 mb-1">LOW SHELF</span>
            <input
              type="range"
              min={-12}
              max={12}
              value={lowGain}
              onChange={(e) => setLowGain(Number(e.target.value))}
              className="w-20 accent-sky-400 h-1 bg-zinc-800 rounded cursor-pointer"
            />
            <span className="text-[10px] font-mono text-white mt-1">{lowGain > 0 ? `+${lowGain}` : lowGain} dB</span>
            <button
              onClick={() => setLowCut(!lowCut)}
              className={`mt-1.5 px-2 py-0.5 rounded text-[8px] font-bold ${lowCut ? "bg-sky-500 text-black" : "bg-zinc-800 text-zinc-500"}`}
            >
              80Hz HPF
            </button>
          </div>

          {/* Mid Freq */}
          <div className="flex flex-col items-center">
            <span className="text-[9px] font-bold text-zinc-400 mb-1">MID FREQ</span>
            <input
              type="range"
              min={250}
              max={4000}
              step={50}
              value={midFreq}
              onChange={(e) => setMidFreq(Number(e.target.value))}
              className="w-20 accent-sky-400 h-1 bg-zinc-800 rounded cursor-pointer"
            />
            <span className="text-[10px] font-mono text-white mt-1">{midFreq} Hz</span>
          </div>

          {/* Mid Gain */}
          <div className="flex flex-col items-center">
            <span className="text-[9px] font-bold text-zinc-400 mb-1">MID GAIN</span>
            <input
              type="range"
              min={-12}
              max={12}
              value={midGain}
              onChange={(e) => setMidGain(Number(e.target.value))}
              className="w-20 accent-sky-400 h-1 bg-zinc-800 rounded cursor-pointer"
            />
            <span className="text-[10px] font-mono text-white mt-1">{midGain > 0 ? `+${midGain}` : midGain} dB</span>
          </div>

          {/* High Shelf */}
          <div className="flex flex-col items-center">
            <span className="text-[9px] font-bold text-zinc-400 mb-1">HIGH SHELF</span>
            <input
              type="range"
              min={-12}
              max={12}
              value={highGain}
              onChange={(e) => setHighGain(Number(e.target.value))}
              className="w-20 accent-sky-400 h-1 bg-zinc-800 rounded cursor-pointer"
            />
            <span className="text-[10px] font-mono text-white mt-1">{highGain > 0 ? `+${highGain}` : highGain} dB</span>
          </div>

        </div>
      </div>

    </div>
  );
}
