"use client";

import { useState } from "react";
import Staff, { noteLetter, type Clef } from "./Staff";

const RANGES: Record<Clef, string[]> = {
  treble: ["C4", "D4", "E4", "F4", "G4", "A4", "B4", "C5", "D5", "E5", "F5", "G5", "A5"],
  bass: ["E2", "F2", "G2", "A2", "B2", "C3", "D3", "E3", "F3", "G3", "A3", "B3", "C4"],
};
const LETTERS = ["A", "B", "C", "D", "E", "F", "G"];

const pick = (clef: Clef, avoid?: string) => {
  const pool = RANGES[clef].filter((note) => note !== avoid);
  return pool[Math.floor(Math.random() * pool.length)];
};

export default function NoteQuiz({ clef, labels }: { clef: Clef; labels: { title: string; prompt: string; correct: string; wrong: string; score: string; best: string } }) {
  const [note, setNote] = useState(() => (clef === "treble" ? "G4" : "F3"));
  const [feedback, setFeedback] = useState<"" | "correct" | "wrong">("");
  const [right, setRight] = useState(0);
  const [total, setTotal] = useState(0);
  const [streak, setStreak] = useState(0);
  const [best, setBest] = useState(0);

  const answer = (letter: string) => {
    const ok = letter === noteLetter(note);
    setTotal((n) => n + 1);
    if (ok) {
      setRight((n) => n + 1);
      setStreak((n) => {
        setBest((b) => Math.max(b, n + 1));
        return n + 1;
      });
      setFeedback("correct");
      setNote((current) => pick(clef, current));
    } else {
      setStreak(0);
      setFeedback("wrong");
    }
  };

  return (
    <div className="mt-4 rounded-xl border border-[#4FE3C1]/40 bg-[#1B1630] p-4">
      <h3 className="font-bold text-[#4FE3C1]">{labels.title}</h3>
      <p className="text-sm text-zinc-300">{labels.prompt}</p>
      <Staff clef={clef} notes={[note]} />
      <div className="flex flex-wrap gap-2" role="group" aria-label={labels.prompt}>
        {LETTERS.map((letter) => (
          <button key={letter} type="button" onClick={() => answer(letter)} className="h-11 w-11 rounded-lg bg-[#986FEF] font-bold text-white hover:bg-[#B89CFF] focus-visible:outline focus-visible:outline-2 focus-visible:outline-white">{letter}</button>
        ))}
      </div>
      <p className="mt-3 min-h-5 text-sm font-semibold" aria-live="polite">
        {feedback === "correct" && <span className="text-[#4FE3C1]">{labels.correct}</span>}
        {feedback === "wrong" && <span className="text-[#FF8FA3]">{labels.wrong}</span>}
      </p>
      <p className="text-xs text-zinc-400">{labels.score.replace("{right}", String(right)).replace("{total}", String(total))} · {labels.best.replace("{n}", String(best))}</p>
    </div>
  );
}
