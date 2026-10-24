// components/daw/AiCoachModal.tsx
"use client";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { AICreditPacks, type CoachUsage } from "@/components/AICreditPacks";
import { useLanguage } from "@/components/LanguageProvider";

interface AiCoachModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentKey: string;
  bpm: number;
  instrument?: string;
  scale?: "maj" | "min";
  initialTab?: "coach" | "theory";
  initialQuestion?: string;
}

const CHORD_LIBRARY: Record<string, { chords: string[]; formula: string; mood: string }> = {
  "C": { chords: ["C", "G", "Am", "F"], formula: "I – V – vi – IV", mood: "Uplifting, Classic Pop & Rock" },
  "G": { chords: ["G", "D", "Em", "C"], formula: "I – V – vi – IV", mood: "Warm, Acoustic, Folk & Country" },
  "Am": { chords: ["Am", "F", "C", "G"], formula: "i – VI – III – VII", mood: "Emotional, Melodic, Hip-Hop" },
  "F": { chords: ["F", "C", "Dm", "Bb"], formula: "I – V – vi – IV", mood: "Soulful, R&B, Dream Pop" },
  "D": { chords: ["D", "A", "Bm", "G"], formula: "I – V – vi – IV", mood: "Bright, Cinematic, Indie Rock" },
  "Em": { chords: ["Em", "C", "G", "D"], formula: "i – VI – III – VII", mood: "Dark, Energetic, Trap / Metal" },
};

const GUITAR_CHORDS = [
  { name: "C Major", notes: "C - E - G", frets: "x - 3 - 2 - 0 - 1 - 0" },
  { name: "G Major", notes: "G - B - D", frets: "3 - 2 - 0 - 0 - 3 - 3" },
  { name: "A Minor", notes: "A - C - E", frets: "x - 0 - 2 - 2 - 1 - 0" },
  { name: "E Minor", notes: "E - G - B", frets: "0 - 2 - 2 - 0 - 0 - 0" },
  { name: "D Major", notes: "D - F# - A", frets: "x - x - 0 - 2 - 3 - 2" },
  { name: "F Major", notes: "F - A - C", frets: "1 - 3 - 3 - 2 - 1 - 1" },
];

export function AiCoachModal({
  isOpen,
  onClose,
  currentKey,
  bpm,
  instrument = "general",
  scale = "maj",
  initialTab = "coach",
  initialQuestion,
}: AiCoachModalProps) {
  const { t } = useLanguage();
  const [tab, setTab] = useState<"coach" | "theory" | "guitar">(initialTab);
  const [messages, setMessages] = useState<Array<{ role: "ai" | "user"; text: string }>>([
    {
      role: "ai",
      text: t("coach.welcome", { bpm, key: currentKey }),
    },
  ]);
  const [inputText, setInputText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [usage, setUsage] = useState<CoachUsage | null>(null);
  const autoPrompt = useRef<string | null>(null);

  if (!isOpen) return null;

  const currentChords = CHORD_LIBRARY[currentKey] || CHORD_LIBRARY["C"];

  const handleSendMessage = useCallback(async (message = inputText) => {
    if (!message.trim() || loading) return;
    const userMsg = message.trim();
    setMessages((prev) => [...prev, { role: "user", text: userMsg }]);
    setInputText("");
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instrument,
          message: userMsg,
          context: `Key ${currentKey} ${scale === "maj" ? "major" : "minor"}, ${bpm} BPM. Suggested chords: ${currentChords.chords.join(", ")}.`,
        }),
      });
      const data = await response.json();
      if (
        data.usage &&
        typeof data.usage.freeUsed === "number" &&
        typeof data.usage.freeLimit === "number" &&
        typeof data.usage.creditsRemaining === "number"
      ) {
        setUsage({
          freeUsed: data.usage.freeUsed,
          freeLimit: data.usage.freeLimit,
          creditsRemaining: data.usage.creditsRemaining,
          globalLimitReached: data.usage.globalLimitReached === true,
        });
      }
      if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : "The coach could not answer right now.");
      if (typeof data.text !== "string" || !data.text.trim()) throw new Error("The coach returned an empty response.");
      setMessages((prev) => [...prev, { role: "ai", text: data.text }]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The coach could not answer right now.");
    } finally {
      setLoading(false);
    }
  }, [bpm, currentChords.chords, currentKey, inputText, instrument, loading, scale]);

  useEffect(() => {
    if (!isOpen) {
      autoPrompt.current = null;
      return;
    }
    setTab(initialTab);
    if (initialQuestion && autoPrompt.current !== initialQuestion) {
      autoPrompt.current = initialQuestion;
      void handleSendMessage(initialQuestion);
    }
  }, [handleSendMessage, initialQuestion, initialTab, isOpen]);

  return (
    <div className="absolute top-20 right-12 z-50 w-[580px] h-[480px] rounded-2xl border-2 border-indigo-900/60 bg-[#17181f] shadow-[0_20px_60px_rgba(0,0,0,0.85)] flex flex-col font-sans select-none overflow-hidden">
      
      {/* 1. Header & Navigation Tabs */}
      <div className="flex h-11 items-center justify-between border-b border-zinc-800 bg-[#21232d] px-4">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-indigo-400 flex items-center gap-1.5">
            {t("coach.title")}
          </span>
          <div className="flex rounded bg-black/40 p-0.5 text-[10px]">
            <button
              onClick={() => setTab("coach")}
              className={`px-2.5 py-1 rounded ${tab === "coach" ? "bg-indigo-600 text-white font-bold" : "text-zinc-400 hover:text-white"}`}
            >
              {t("coach.assistant")}
            </button>
            <button
              onClick={() => setTab("theory")}
              className={`px-2.5 py-1 rounded ${tab === "theory" ? "bg-indigo-600 text-white font-bold" : "text-zinc-400 hover:text-white"}`}
            >
              {t("coach.chordsTab")}
            </button>
            <button
              onClick={() => setTab("guitar")}
              className={`px-2.5 py-1 rounded ${tab === "guitar" ? "bg-indigo-600 text-white font-bold" : "text-zinc-400 hover:text-white"}`}
            >
              {t("coach.guitarTab")}
            </button>
          </div>
        </div>

        <button
          onClick={onClose}
          className="h-6 w-6 rounded hover:bg-red-500 text-zinc-400 hover:text-white flex items-center justify-center font-bold text-xs"
        >
          ✕
        </button>
      </div>

      {/* 2. Tab 1: AI Chat Assistant */}
      {tab === "coach" && (
        <div className="flex-1 flex flex-col justify-between p-3 bg-[#13141a]">
          <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
            {messages.map((m, i) => (
              <div
                key={i}
                className={`p-3 rounded-xl text-xs leading-relaxed max-w-[85%] ${
                  m.role === "ai"
                    ? "bg-[#21232e] text-zinc-200 border border-indigo-900/40"
                    : "bg-indigo-600 text-white ml-auto"
                }`}
              >
                {m.text}
              </div>
            ))}
            {loading && (
              <div className="text-[11px] text-indigo-400 italic">{t("coach.analyzing")}</div>
            )}
            <AICreditPacks usage={usage} />
            {error && <div role="alert" className="rounded-lg border border-red-900 bg-red-950/50 p-2 text-[11px] text-red-200">{error}</div>}
          </div>

          <div className="flex gap-2 pt-2 border-t border-zinc-800">
            <input
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && void handleSendMessage()}
              placeholder={t("coach.placeholder")}
              maxLength={1000}
              className="flex-1 bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            <button
              onClick={() => void handleSendMessage()}
              className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-xs font-bold"
            >
              {loading ? t("coach.thinking") : t("coach.ask")}
            </button>
          </div>
        </div>
      )}

      {/* 3. Tab 2: Theory & Recommended Progressions */}
      {tab === "theory" && (
        <div className="flex-1 p-4 bg-[#13141a] overflow-y-auto space-y-4">
          <div className="bg-indigo-950/40 border border-indigo-800/60 rounded-xl p-3.5">
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-400">{t("coach.recommended", { key: currentKey })}</span>
            <div className="flex items-center gap-3 my-2">
              {currentChords.chords.map((chord, i) => (
                <div key={i} className="h-14 w-14 rounded-lg bg-indigo-600/30 border border-indigo-500 flex flex-col items-center justify-center">
                  <span className="text-base font-black text-white">{chord}</span>
                  <span className="text-[8px] text-zinc-400 uppercase">{t("coach.chord", { number: i + 1 })}</span>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-zinc-400 mt-1">{t("coach.formula")} <span className="text-indigo-300 font-mono">{currentChords.formula}</span> • {t("coach.feel")} <span className="text-zinc-300">{t(`coach.mood.${currentKey in CHORD_LIBRARY ? currentKey : "C"}`)}</span></p>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            {Object.entries(CHORD_LIBRARY).map(([k, val]) => (
              <div key={k} className="p-2.5 rounded-lg border border-zinc-800 bg-zinc-900/50">
                <span className="font-bold text-white">{t("coach.recommended", { key: k })}</span>
                <p className="text-zinc-400 text-[10px] mt-0.5">{val.chords.join(" - ")}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4. Tab 3: Visual Guitar Fretboard & Chords for Visual Learners */}
      {tab === "guitar" && (
        <div className="flex-1 p-4 bg-[#13141a] overflow-y-auto space-y-3">
          <p className="text-xs text-zinc-400">{t("coach.guitarIntro")}</p>
          <div className="grid grid-cols-2 gap-3">
            {GUITAR_CHORDS.map((c) => (
              <div key={c.name} className="p-3 rounded-xl border border-zinc-800 bg-[#1b1c24] flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-amber-400">{t(`coach.guitarChord.${GUITAR_CHORDS.indexOf(c)}`)}</h4>
                  <p className="text-[10px] text-zinc-400 mt-0.5">{t("coach.notes")} {c.notes}</p>
                </div>
                <div className="text-right">
                  <span className="text-[9px] uppercase font-bold text-zinc-500">{t("coach.frets")}</span>
                  <p className="font-mono text-xs font-bold text-white bg-black/60 px-2 py-0.5 rounded mt-0.5">{c.frets}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
