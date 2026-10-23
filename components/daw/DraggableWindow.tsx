// components/daw/DraggableWindow.tsx
"use client";
import React, { useState, useRef } from "react";

interface DraggableWindowProps {
  title: string;
  icon?: string;
  isOpen: boolean;
  onClose: () => void;
  defaultPosition?: { x: number; y: number };
  width?: string;
  height?: string;
  children: React.ReactNode;
}

export function DraggableWindow({
  title,
  icon = "🎛️",
  isOpen,
  onClose,
  defaultPosition = { x: 120, y: 100 },
  width = "w-[620px]",
  height = "h-[380px]",
  children,
}: DraggableWindowProps) {
  const [pos, setPos] = useState(defaultPosition);
  const [isDragging, setIsDragging] = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });

  if (!isOpen) return null;

  const handlePointerDown = (e: React.PointerEvent) => {
    setIsDragging(true);
    dragOffset.current = {
      x: e.clientX - pos.x,
      y: e.clientY - pos.y,
    };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    setPos({
      x: Math.max(10, Math.min(window.innerWidth - 300, e.clientX - dragOffset.current.x)),
      y: Math.max(10, Math.min(window.innerHeight - 150, e.clientY - dragOffset.current.y)),
    });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    setIsDragging(false);
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}
  };

  return (
    <div
      style={{ left: `${pos.x}px`, top: `${pos.y}px` }}
      className={`fixed z-50 ${width} ${height} rounded-2xl border-2 border-[#20222a] bg-[#14151b] shadow-[0_30px_70px_rgba(0,0,0,0.9)] flex flex-col overflow-hidden font-sans select-none backdrop-blur-md`}
    >
      {/* Draggable Title Bar */}
      <div
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        className="flex h-10 flex-none items-center justify-between border-b border-zinc-800 bg-[#1c1e26] px-4 cursor-grab active:cursor-grabbing hover:bg-[#22242e] transition"
      >
        <span className="text-xs font-bold text-white flex items-center gap-2">
          <span>{icon}</span> {title}
        </span>
        <div className="flex items-center gap-1.5">
          <button
            onClick={onClose}
            className="h-6 w-6 rounded hover:bg-red-500/80 text-zinc-400 hover:text-white flex items-center justify-center font-bold text-xs"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Window Body */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {children}
      </div>
    </div>
  );
}
