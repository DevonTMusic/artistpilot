// components/daw/ClipRegion.tsx
"use client";
import React, { useEffect, useRef, useState } from "react";
import { AudioRegion } from "@/lib/AudioEngine";
import { useLanguage } from "@/components/LanguageProvider";

interface ClipRegionProps {
  region: AudioRegion;
  pixelsPerSecond: number;
  trackColor: string;
  trackId: number;
  snapIntervalSec?: number;
  onUpdate: (updated: Partial<AudioRegion>) => void;
  onSplit: (splitTimeSec: number) => void;
  onDelete: () => void;
  onLoop?: () => void;
  onReverse?: () => void;
  onCopy?: (region: AudioRegion) => void;
}

export function ClipRegion({
  region,
  pixelsPerSecond,
  trackColor,
  trackId,
  snapIntervalSec,
  onUpdate,
  onSplit,
  onDelete,
  onLoop,
  onReverse,
  onCopy,
}: ClipRegionProps) {
  const { t } = useLanguage();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dragMode, setDragMode] = useState<"move" | "left" | "right" | null>(null);
  const dragStartX = useRef(0);
  const originalStartTime = useRef(0);
  const originalOffset = useRef(0);
  const originalDuration = useRef(0);

  // Render Real Waveform
  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv || !region.buffer) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, cv.width, cv.height);
    const data = region.buffer.getChannelData(0);
    const sampleRate = region.buffer.sampleRate;

    const startSample = Math.floor(region.offset * sampleRate);
    const endSample = Math.floor((region.offset + region.duration) * sampleRate);
    const sliceLen = Math.max(1, endSample - startSample);
    const step = Math.max(1, Math.floor(sliceLen / cv.width));

    ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
    for (let x = 0; x < cv.width; x++) {
      let maxPeak = 0;
      const baseIdx = startSample + x * step;
      for (let s = 0; s < step; s += 16) {
        if (baseIdx + s < data.length) {
          maxPeak = Math.max(maxPeak, Math.abs(data[baseIdx + s]));
        }
      }
      const h = Math.max(2, maxPeak * cv.height * 0.95);
      ctx.fillRect(x, (cv.height - h) / 2, 1.2, h);
    }
  }, [region, pixelsPerSecond]);

  // Horizontal position dragging
  const handlePointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest("button")) return;
    const handle = (e.target as HTMLElement).closest<HTMLElement>("[data-handle]");
    const mode = handle?.dataset.handle === "left" ? "left" : handle?.dataset.handle === "right" ? "right" : "move";
    setDragMode(mode);
    dragStartX.current = e.clientX;
    originalStartTime.current = region.startTime;
    originalOffset.current = region.offset;
    originalDuration.current = region.duration;
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragMode) return;
    const deltaSec = (e.clientX - dragStartX.current) / pixelsPerSecond;
    const snap = (value: number) => snapIntervalSec
      ? Math.round(value / snapIntervalSec) * snapIntervalSec
      : value;
    if (dragMode === "move") {
      onUpdate({ startTime: Math.max(0, snap(originalStartTime.current + deltaSec)) });
    } else if (dragMode === "left") {
      const delta = Math.max(
        -Math.min(originalOffset.current, originalStartTime.current),
        Math.min(originalDuration.current - 0.05, deltaSec)
      );
      const snappedStart = Math.max(0, snap(originalStartTime.current + delta));
      const snappedDelta = Math.max(
        -Math.min(originalOffset.current, originalStartTime.current),
        Math.min(originalDuration.current - 0.05, snappedStart - originalStartTime.current)
      );
      onUpdate({
        startTime: originalStartTime.current + snappedDelta,
        offset: originalOffset.current + snappedDelta,
        duration: originalDuration.current - snappedDelta,
      });
    } else {
      const maxDuration = region.buffer.duration - originalOffset.current;
      onUpdate({ duration: Math.max(0.05, Math.min(maxDuration, snap(originalDuration.current + deltaSec))) });
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    setDragMode(null);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}
  };

  const width = Math.max(24, region.duration * pixelsPerSecond);
  const left = region.startTime * pixelsPerSecond;

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("sourceTrackId", String(trackId));
        e.dataTransfer.setData("regionId", region.id);
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      style={{ left: `${left}px`, width: `${width}px` }}
      className={`absolute top-1 bottom-1 select-none rounded border border-white/25 shadow-md flex flex-col overflow-hidden ${dragMode ? "cursor-grabbing" : "cursor-grab"} ${trackColor}`}
    >
      {/* Clip Header Label with Copy, Split, and Delete Buttons */}
      <div className="flex h-4 items-center justify-between bg-black/40 px-1.5 text-[9px] font-semibold text-white/95">
        <span className="truncate max-w-[120px]">{region.name}</span>
        <div className="flex items-center gap-1.5">
          {onCopy && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onCopy(region);
              }}
              title={t("clip.copy")}
              className="hover:text-[#5ee38f] transition text-[10px]"
            >
              📋
            </button>
          )}
          {onLoop && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onLoop();
              }}
              title={t("clip.repeat")}
              className="hover:text-[#5ee38f] transition text-[10px]"
            >
              ↻
            </button>
          )}
          {onReverse && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onReverse();
              }}
              title={t("clip.reverse")}
              className="hover:text-[#5ee38f] transition text-[10px]"
            >
              ⇄
            </button>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onSplit(region.startTime + region.duration / 2);
            }}
            title={t("clip.split")}
            className="hover:text-[#5ee38f] transition text-[10px]"
          >
            ✂
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            title={t("clip.delete")}
            className="hover:text-red-300 transition text-[10px]"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Waveform Graphic */}
      <div className="flex-1 w-full relative">
        <canvas
          ref={canvasRef}
          width={Math.max(10, Math.floor(width))}
          height={50}
          className="h-full w-full pointer-events-none"
        />
      </div>

      {/* Trim Handles */}
      <div data-handle="left" className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-white/40" />
      <div data-handle="right" className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-white/40" />
    </div>
  );
}
