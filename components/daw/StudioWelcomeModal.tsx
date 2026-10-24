"use client";
import React from "react";

interface StudioWelcomeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const guideSections = [
  {
    title: "1. Start with a track",
    description: "Choose Add Track to create a vocal/audio track, piano instrument, drum machine, guitar, or bass. You can also import audio onto an audio track.",
  },
  {
    title: "2. Record or build a part",
    description: "Arm a track, choose an input, then press Record. For MIDI, open the piano or drum editor. Turn on input monitoring to check your mic or instrument before recording; headphones help prevent feedback.",
  },
  {
    title: "3. Arrange your song",
    description: "Move, trim, split, loop, and snap regions on the timeline. Use the arranger lane for song sections, and set tempo, key, metronome, and loop range in the top bar.",
  },
  {
    title: "4. Shape and mix",
    description: "Select a track to edit its level, pan, effects, and instrument controls. Use buses to group tracks, the sampler for audio slices, and Scenes to launch clips together.",
  },
  {
    title: "5. Save and export",
    description: "Save keeps a local .artistpilot project on your device. Export Mix renders a WAV; Stems exports separate track files. Collaborate uploads a project only when you explicitly choose to share it.",
  },
];

export function StudioWelcomeModal({ isOpen, onClose }: StudioWelcomeModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="studio-welcome-title"
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-zinc-700 bg-[#15171d] p-5 shadow-2xl sm:p-7"
      >
        <header className="mb-5 flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-sky-300">ArtistPilot Studio</p>
            <h2 id="studio-welcome-title" className="mt-1 text-xl font-bold text-white">Welcome to your studio</h2>
            <p className="mt-2 text-xs leading-relaxed text-zinc-400">A quick guide to recording, arranging, mixing, and exporting your music.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close studio guide"
            className="rounded-lg px-2 py-1 text-lg text-zinc-400 hover:bg-zinc-800 hover:text-white"
          >
            ×
          </button>
        </header>

        <div className="grid gap-3 sm:grid-cols-2">
          {guideSections.map((section) => (
            <article key={section.title} className="rounded-xl border border-zinc-800 bg-[#101116] p-3.5">
              <h3 className="text-xs font-semibold text-white">{section.title}</h3>
              <p className="mt-1.5 text-[11px] leading-relaxed text-zinc-400">{section.description}</p>
            </article>
          ))}
          <article className="rounded-xl border border-violet-900/70 bg-violet-950/20 p-3.5">
            <h3 className="text-xs font-semibold text-violet-200">Need this guide again?</h3>
            <p className="mt-1.5 text-[11px] leading-relaxed text-violet-200/70">Select Studio Guide in the top bar any time to reopen these instructions.</p>
          </article>
        </div>

        <footer className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-sky-600 px-4 py-2 text-xs font-bold text-white hover:bg-sky-500"
          >
            Start creating
          </button>
        </footer>
      </section>
    </div>
  );
}
