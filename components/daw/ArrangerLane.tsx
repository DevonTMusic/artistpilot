"use client";
import React, { useEffect, useRef, useState } from "react";
import { ArrangerSection } from "@/lib/AudioEngine";
import { useLanguage } from "@/components/LanguageProvider";

interface ArrangerLaneProps {
  sections: ArrangerSection[];
  width: number;
  pixelsPerBar: number;
  onSeek: (bar: number) => void;
  onCommit: (previous: ArrangerSection, next: ArrangerSection) => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
}

interface SectionDrag {
  id: string;
  startX: number;
  startBar: number;
  endBar: number;
  resize: boolean;
}

export function ArrangerLane({ sections, width, pixelsPerBar, onSeek, onCommit, onRename, onDelete }: ArrangerLaneProps) {
  const { t } = useLanguage();
  const [previewSections, setPreviewSections] = useState(sections);
  const dragRef = useRef<SectionDrag | null>(null);
  const previewRef = useRef(sections);
  const draggedRef = useRef(false);

  useEffect(() => {
    previewRef.current = sections;
    setPreviewSections(sections);
  }, [sections]);

  useEffect(() => {
    const move = (event: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      const delta = Math.round((event.clientX - drag.startX) / pixelsPerBar);
      if (delta !== 0) draggedRef.current = true;
      const startBar = drag.resize ? drag.startBar : Math.max(1, drag.startBar + delta);
      const endBar = drag.resize
        ? Math.max(drag.startBar + 1, drag.endBar + delta)
        : Math.max(startBar + 1, drag.endBar + delta);
      const next = previewRef.current.map((section) => section.id === drag.id
        ? { ...section, startBar, endBar }
        : section);
      previewRef.current = next;
      setPreviewSections(next);
    };
    const up = () => {
      const drag = dragRef.current;
      if (!drag) return;
      const previous = sections.find((section) => section.id === drag.id);
      const next = previewRef.current.find((section) => section.id === drag.id);
      if (previous && next && (previous.startBar !== next.startBar || previous.endBar !== next.endBar)) {
        onCommit(previous, next);
      }
      dragRef.current = null;
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, [sections, pixelsPerBar, onCommit]);

  return (
    <div
      style={{
        width,
        backgroundImage: "linear-gradient(to right, rgba(63, 70, 86, 0.45) 1px, transparent 1px)",
        backgroundSize: `${pixelsPerBar}px 100%`,
      }}
      className="relative h-9 flex-none border-b border-zinc-800 bg-[#101116]"
      aria-label={t("arranger.sections")}
    >
      {previewSections.map((section) => (
        <div
          key={section.id}
          role="button"
          tabIndex={0}
          title={t("arranger.sectionTitle", { name: section.name, start: section.startBar, end: section.endBar - 1 })}
          onPointerDown={(event) => {
            event.preventDefault();
            event.stopPropagation();
            const target = event.target as HTMLElement;
            dragRef.current = {
              id: section.id,
              startX: event.clientX,
              startBar: section.startBar,
              endBar: section.endBar,
              resize: target.dataset.resize === "true",
            };
            draggedRef.current = false;
          }}
          onClick={() => {
            if (!draggedRef.current) onSeek(section.startBar);
            draggedRef.current = false;
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              onSeek(section.startBar);
            }
          }}
          style={{
            left: `${(section.startBar - 1) * pixelsPerBar}px`,
            width: `${(section.endBar - section.startBar) * pixelsPerBar}px`,
          }}
          className={`absolute inset-y-1 flex min-w-8 items-center rounded border border-white/15 px-2 text-[9px] font-bold text-white shadow-sm ${section.color} cursor-grab active:cursor-grabbing`}
        >
          <span className="truncate">{section.name}</span>
          <button
            type="button"
            title={t("arranger.rename", { name: section.name })}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              const name = window.prompt(t("arranger.prompt"), section.name)?.trim();
              if (name) onRename(section.id, name.slice(0, 40));
            }}
            className="ml-auto px-1 text-[8px] opacity-70 hover:opacity-100"
          >
            {t("arranger.edit")}
          </button>
          <span className="px-1 text-[8px] opacity-70">{section.startBar}-{section.endBar - 1}</span>
          <button
            type="button"
            title={t("arranger.delete", { name: section.name })}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              onDelete(section.id);
            }}
            className="pr-1 text-[10px] opacity-70 hover:text-white hover:opacity-100"
          >
            ×
          </button>
          <span
            data-resize="true"
            aria-label={t("arranger.resize", { name: section.name })}
            className="absolute right-0 top-0 h-full w-2 cursor-ew-resize"
          />
        </div>
      ))}
    </div>
  );
}
