// components/daw/DiscoverTrackModal.tsx
"use client";
import React from "react";
import { useLanguage } from "@/components/LanguageProvider";
import { MicIcon, PianoIcon, GuitarIcon, BassIcon, DrumIcon } from "./StudioIcons";

interface DiscoverTrackModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTrackType: (type: "vocal" | "guitar" | "bass" | "piano" | "drum") => void;
  onOpenAiSongStarter?: (feature: "palette" | "songstarter") => void;
}

export function DiscoverTrackModal({
  isOpen,
  onClose,
  onSelectTrackType,
  onOpenAiSongStarter,
}: DiscoverTrackModalProps) {
  const { t } = useLanguage();
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 font-sans select-none">
      <div className="w-full max-w-2xl rounded-2xl border border-zinc-800 bg-[#121316] shadow-2xl overflow-hidden flex flex-col text-zinc-300">
        
        {/* Title Bar */}
        <div className="flex h-12 items-center justify-between border-b border-zinc-800/80 px-6">
          <h2 className="text-sm font-bold text-white tracking-wide">{t("discover.title")}</h2>
          <button
            onClick={onClose}
            className="h-7 w-7 rounded-full hover:bg-zinc-800 text-zinc-400 hover:text-white flex items-center justify-center font-bold text-sm"
          >
            ✕
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* 1. AI Creation Suite */}
          <div className="grid grid-cols-2 gap-3.5">
            <button
              onClick={() => {
                if (onOpenAiSongStarter) onOpenAiSongStarter("palette");
                onClose();
              }}
              className="flex items-center gap-3.5 p-3.5 rounded-xl border border-zinc-800 bg-[#18191f] hover:bg-[#1f2129] transition text-left"
            >
              <div className="h-12 w-12 rounded-xl bg-gradient-to-tr from-pink-600 to-rose-400 flex items-center justify-center text-white shadow-lg">
                <span className="font-bold text-lg">AI</span>
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-white">{t("discover.palette")}</span>
                  <span className="text-[9px] bg-blue-500 text-white font-bold px-1 rounded">AI</span>
                </div>
                <p className="text-[10px] text-zinc-400 mt-0.5">{t("discover.paletteText")}</p>
              </div>
            </button>

            <button
              onClick={() => {
                if (onOpenAiSongStarter) onOpenAiSongStarter("songstarter");
                onClose();
              }}
              className="flex items-center gap-3.5 p-3.5 rounded-xl border border-zinc-800 bg-[#18191f] hover:bg-[#1f2129] transition text-left"
            >
              <div className="h-12 w-12 rounded-xl bg-gradient-to-tr from-blue-600 to-cyan-400 flex items-center justify-center text-white shadow-lg">
                <span className="font-bold text-lg">START</span>
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-white">{t("discover.songStarter")}</span>
                  <span className="text-[9px] bg-blue-500 text-white font-bold px-1 rounded">AI</span>
                </div>
                <p className="text-[10px] text-zinc-400 mt-0.5">{t("discover.songStarterText")}</p>
              </div>
            </button>
          </div>

          <span className="text-[11px] font-bold tracking-wider text-zinc-500 block">{t("discover.newTrack")}</span>

          {/* 2. Track Category Tiles (Exact BandLab Look) */}
          <div className="grid grid-cols-2 gap-3.5">
            
            {/* Voice / Audio */}
            <button
              onClick={() => {
                onSelectTrackType("vocal");
                onClose();
              }}
              className="flex items-center gap-3.5 p-3.5 rounded-xl border border-zinc-800 bg-[#18191f] hover:border-red-500/50 hover:bg-[#1f2129] transition text-left"
            >
              <div className="h-12 w-12 rounded-xl bg-[#e53e3e] flex items-center justify-center text-white shadow-lg">
                <MicIcon className="w-6 h-6 fill-white" />
              </div>
              <div>
                <span className="text-xs font-bold text-white block">{t("discover.voice")}</span>
                <p className="text-[10px] text-zinc-400 mt-0.5">{t("discover.voiceText")}</p>
              </div>
            </button>

            {/* Instruments MIDI */}
            <button
              onClick={() => {
                onSelectTrackType("piano");
                onClose();
              }}
              className="flex items-center gap-3.5 p-3.5 rounded-xl border border-zinc-800 bg-[#18191f] hover:border-emerald-500/50 hover:bg-[#1f2129] transition text-left"
            >
              <div className="h-12 w-12 rounded-xl bg-[#38a169] flex items-center justify-center text-white shadow-lg">
                <PianoIcon className="w-6 h-6 fill-white" />
              </div>
              <div>
                <div className="flex items-center gap-1">
                  <span className="text-xs font-bold text-white">{t("discover.instruments")}</span>
                  <span className="text-[8px] bg-zinc-800 text-zinc-300 px-1 rounded font-bold">MIDI</span>
                </div>
                <p className="text-[10px] text-zinc-400 mt-0.5">{t("discover.instrumentsText")}</p>
              </div>
            </button>

            {/* Drum Machine */}
            <button
              onClick={() => {
                onSelectTrackType("drum");
                onClose();
              }}
              className="flex items-center gap-3.5 p-3.5 rounded-xl border border-zinc-800 bg-[#18191f] hover:border-[#1DB954]/50 hover:bg-[#1f2129] transition text-left"
            >
              <div className="h-12 w-12 rounded-xl bg-[#d69e2e] flex items-center justify-center text-white shadow-lg">
                <DrumIcon className="w-6 h-6 stroke-white" />
              </div>
              <div>
                <div className="flex items-center gap-1">
                  <span className="text-xs font-bold text-white">{t("discover.drums")}</span>
                  <span className="text-[8px] bg-zinc-800 text-zinc-300 px-1 rounded font-bold">MIDI</span>
                </div>
                <p className="text-[10px] text-zinc-400 mt-0.5">{t("discover.drumsText")}</p>
              </div>
            </button>

            {/* Guitar Amp */}
            <button
              onClick={() => {
                onSelectTrackType("guitar");
                onClose();
              }}
              className="flex items-center gap-3.5 p-3.5 rounded-xl border border-zinc-800 bg-[#18191f] hover:border-cyan-500/50 hover:bg-[#1f2129] transition text-left"
            >
              <div className="h-12 w-12 rounded-xl bg-[#319795] flex items-center justify-center text-white shadow-lg">
                <BassIcon className="w-6 h-6 fill-white" />
              </div>
              <div>
                <span className="text-xs font-bold text-white block">{t("discover.guitar")}</span>
                <p className="text-[10px] text-zinc-400 mt-0.5">{t("discover.guitarText")}</p>
              </div>
            </button>

            {/* Bass Amp */}
            <button
              onClick={() => {
                onSelectTrackType("bass");
                onClose();
              }}
              className="flex items-center gap-3.5 p-3.5 rounded-xl border border-zinc-800 bg-[#18191f] hover:border-blue-500/50 hover:bg-[#1f2129] transition text-left"
            >
              <div className="h-12 w-12 rounded-xl bg-[#3182ce] flex items-center justify-center text-white shadow-lg">
                <GuitarIcon className="w-6 h-6 fill-white" />
              </div>
              <div>
                <span className="text-xs font-bold text-white block">{t("discover.bass")}</span>
                <p className="text-[10px] text-zinc-400 mt-0.5">{t("discover.bassText")}</p>
              </div>
            </button>

          </div>

        </div>

      </div>
    </div>
  );
}
