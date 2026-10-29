"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import CompleteButton from "@/components/CompleteButton";
import { ChordVisualizer } from "@/components/ChordVisualizer";
import { ChromaticTuner } from "@/components/daw/ChromaticTuner";
import type { Lesson } from "@/lib/lessons";
import { useLanguage } from "@/components/LanguageProvider";
import { spanishLessons } from "@/lib/i18n/lessonTranslations";

const AUDIO_EXAMPLES: Record<string, string[]> = {
  "guitar-1": ["E2", "A2", "D3", "G3", "B3", "E4"],
  "guitar-2": ["E3", "G3", "B3", "A3", "C4", "E4"],
  "guitar-3": ["E3", "G3", "B3", "G3", "A3", "C4", "E4"],
  "piano-1": ["C3", "C4", "C5", "C4"],
  "piano-2": ["C4", "D4", "E4", "F4", "G4", "A4", "B4", "C5"],
  "piano-3": ["C4", "E4", "G4", "G3", "B3", "D4", "A3", "C4", "E4", "F3", "A3", "C4"],
  "bass-1": ["E1", "A1", "D2", "G2"],
  "bass-2": ["C2", "G1", "A1", "F1"],
  "bass-3": ["G1", "G2", "G1", "G2"],
  "ukulele-1": ["G4", "C4", "E4", "A4"],
  "ukulele-2": ["C4", "E4", "G4", "A3", "C4", "E4", "F4", "A4", "C5"],
  "ukulele-3": ["C4", "E4", "G4", "A3", "C4", "E4", "F4", "A4"],
  "violin-1": ["G3", "D4", "A4", "E5"],
  "violin-2": ["A4", "A4", "A4", "A4"],
  "violin-3": ["A4", "B4", "C#5", "D5", "C#5", "B4", "A4"],
  "vocals-1": ["C4", "C4", "C4", "C4"],
  "vocals-2": ["C4", "D4", "E4", "G4", "E4", "D4", "C4"],
  "vocals-3": ["C4", "D4", "E4", "F4", "G4", "A4", "B4", "C5"],
};
const DRUM_EXAMPLES: Record<string, string[]> = {
  "drums-1": ["Kick", "Hat", "Hat", "Hat", "Snare", "Hat", "Hat", "Hat"],
  "drums-2": ["Kick", "Hat", "Snare", "Hat", "Kick", "Hat", "Snare", "Hat"],
  "drums-3": ["Kick", "Hat", "Snare", "Hat", "Kick", "Hat", "Snare", "Snare"],
};
const LESSON_CHORDS: Record<string, string[]> = {
  "guitar-2": ["Em", "Am"],
  "piano-2": ["C"],
  "piano-3": ["C", "G", "Am", "F"],
  "bass-2": ["C", "G", "Am", "F"],
  "ukulele-2": ["C", "Am", "F"],
  "violin-3": ["A"],
};

function noteFrequency(note: string): number | null {
  const match = note.match(/^([A-G])(#|b)?(-?\d)$/);
  if (!match) return null;
  const pitchClasses: Record<string, number> = { C: 0, "C#": 1, Db: 1, D: 2, "D#": 3, Eb: 3, E: 4, F: 5, "F#": 6, Gb: 6, G: 7, "G#": 8, Ab: 8, A: 9, "A#": 10, Bb: 10, B: 11 };
  const midi = (Number(match[3]) + 1) * 12 + pitchClasses[match[1] + (match[2] ?? "")];
  return 440 * 2 ** ((midi - 69) / 12);
}

function stopSources(sources: AudioScheduledSourceNode[]) {
  sources.forEach((source) => {
    try { source.stop(); } catch {}
  });
  sources.length = 0;
}

export function AcademyLessonPlayer({
  lesson,
  previousId,
  nextId,
  done,
}: {
  lesson: Lesson;
  previousId?: string;
  nextId?: string;
  done: boolean;
}) {
  const { locale, t } = useLanguage();
  const localizedLesson = locale === "es" ? spanishLessons[lesson.id] ?? lesson : lesson;
  const steps = [
    ...localizedLesson.body.map((text, index) => ({
      title: t("lesson.learnStep", { step: index + 1 }),
      text,
    })),
    { title: locale === "es" ? "Práctica" : "Practice", text: localizedLesson.practice },
  ];
  const [currentStep, setCurrentStep] = useState(0);
  const [stepTried, setStepTried] = useState(false);
  const [selectedVisualChord, setSelectedVisualChord] = useState(LESSON_CHORDS[lesson.id]?.[0] ?? "");
  const [audioPlaying, setAudioPlaying] = useState(false);
  const [tunerOpen, setTunerOpen] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourcesRef = useRef<AudioScheduledSourceNode[]>([]);
  const audioTimerRef = useRef<number | null>(null);
  const isDrums = lesson.instrument === "Drums";
  const canTune = ["Guitar", "Bass", "Ukulele", "Violin", "Vocals"].includes(lesson.instrument);

  useEffect(() => () => {
    if (audioTimerRef.current !== null) window.clearTimeout(audioTimerRef.current);
    stopSources(sourcesRef.current);
    if (audioContextRef.current && audioContextRef.current.state !== "closed") {
      void audioContextRef.current.close();
    }
  }, []);

  const stopAudio = () => {
    if (audioTimerRef.current !== null) window.clearTimeout(audioTimerRef.current);
    audioTimerRef.current = null;
    stopSources(sourcesRef.current);
    setAudioPlaying(false);
  };

  const playAudioExample = async () => {
    stopAudio();
    try {
      const AudioContextClass = window.AudioContext;
      const context = audioContextRef.current?.state === "closed" ? new AudioContextClass() : audioContextRef.current ?? new AudioContextClass();
      audioContextRef.current = context;
      if (context.state === "suspended") await context.resume();
      const startAt = context.currentTime + 0.05;
      if (isDrums) {
        const pattern = DRUM_EXAMPLES[lesson.id] ?? DRUM_EXAMPLES["drums-1"];
        pattern.forEach((kind, index) => {
          const when = startAt + index * 0.28;
          const gain = context.createGain();
          gain.gain.setValueAtTime(0.0001, when);
          gain.gain.exponentialRampToValueAtTime(kind === "Hat" ? 0.035 : 0.16, when + 0.008);
          gain.gain.exponentialRampToValueAtTime(0.0001, when + (kind === "Hat" ? 0.055 : 0.18));
          if (kind === "Kick") {
            const kick = context.createOscillator();
            kick.type = "sine";
            kick.frequency.setValueAtTime(125, when);
            kick.frequency.exponentialRampToValueAtTime(42, when + 0.13);
            kick.connect(gain);
            kick.start(when);
            kick.stop(when + 0.2);
            sourcesRef.current.push(kick);
          } else {
            const length = Math.ceil(context.sampleRate * 0.08);
            const buffer = context.createBuffer(1, length, context.sampleRate);
            const channel = buffer.getChannelData(0);
            for (let sample = 0; sample < length; sample++) channel[sample] = Math.random() * 2 - 1;
            const noise = context.createBufferSource();
            noise.buffer = buffer;
            if (kind === "Hat") {
              const highPass = context.createBiquadFilter();
              highPass.type = "highpass";
              highPass.frequency.value = 6500;
              noise.connect(highPass);
              highPass.connect(gain);
            } else {
              const bandPass = context.createBiquadFilter();
              bandPass.type = "bandpass";
              bandPass.frequency.value = 1800;
              noise.connect(bandPass);
              bandPass.connect(gain);
              const body = context.createOscillator();
              body.frequency.value = 180;
              body.connect(gain);
              body.start(when);
              body.stop(when + 0.19);
              sourcesRef.current.push(body);
            }
            noise.connect(gain);
            noise.start(when);
            noise.stop(when + 0.09);
            sourcesRef.current.push(noise);
          }
          gain.connect(context.destination);
        });
      } else {
        const notes = AUDIO_EXAMPLES[lesson.id] ?? ["C4", "E4", "G4"];
        const noteDuration = 0.38;
        notes.forEach((note, index) => {
          const frequency = noteFrequency(note);
          if (frequency === null) return;
          const oscillator = context.createOscillator();
          const gain = context.createGain();
          oscillator.type = lesson.instrument === "Violin" ? "sawtooth"
            : lesson.instrument === "Guitar" || lesson.instrument === "Ukulele" ? "triangle"
            : "sine";
          const when = startAt + index * 0.45;
          oscillator.frequency.setValueAtTime(frequency, when);
          gain.gain.setValueAtTime(0.0001, when);
          gain.gain.exponentialRampToValueAtTime(0.13, when + 0.015);
          gain.gain.exponentialRampToValueAtTime(0.0001, when + noteDuration);
          oscillator.connect(gain);
          gain.connect(context.destination);
          oscillator.start(when);
          oscillator.stop(when + noteDuration + 0.02);
          sourcesRef.current.push(oscillator);
        });
      }

      setAudioPlaying(true);
      const exampleDuration = isDrums ? 8 * 280 : (AUDIO_EXAMPLES[lesson.id]?.length ?? 3) * 450;
      audioTimerRef.current = window.setTimeout(() => {
        if (sourcesRef.current.length > 0) stopAudio();
      }, exampleDuration + 400);
    } catch (cause) {
      console.error("Could not play Academy reference tones:", cause);
      setAudioPlaying(false);
    }
  };

  const advance = () => {
    setStepTried(false);
    setCurrentStep((step) => Math.min(steps.length - 1, step + 1));
  };
  const goBack = () => {
    setStepTried(false);
    setCurrentStep((step) => Math.max(0, step - 1));
  };

  return (
    <div>
      <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 sm:p-7">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold text-amber-300">{localizedLesson.instrument} · {t("lesson.guided")}</p>
            <h2 className="mt-1 text-lg font-bold text-white">{steps[currentStep].title}</h2>
          </div>
          <span className="rounded-full border border-zinc-700 px-3 py-1 text-xs text-zinc-400">{t("lesson.step", { current: currentStep + 1, total: steps.length })}</span>
        </div>

        <div className="mb-5 flex gap-1.5" role="progressbar" aria-label={t("lesson.progress")} aria-valuemin={1} aria-valuemax={steps.length} aria-valuenow={currentStep + 1}>
          {steps.map((step, index) => (
            <div key={step.title} className={`h-1.5 flex-1 rounded-full ${index <= currentStep ? "bg-amber-400" : "bg-zinc-700"}`} />
          ))}
        </div>

        <p className="min-h-24 text-sm leading-7 text-zinc-200">{steps[currentStep].text}</p>

        {LESSON_CHORDS[lesson.id] && (
          <div className="mt-4">
            <div className="flex flex-wrap gap-2" role="group" aria-label={t("lesson.chooseChord")}>
              {LESSON_CHORDS[lesson.id].map((chord) => (
                <button
                  key={chord}
                  type="button"
                  onClick={() => setSelectedVisualChord(chord)}
                  aria-pressed={selectedVisualChord === chord}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${selectedVisualChord === chord ? "border-sky-500 bg-sky-950/40 text-sky-200" : "border-zinc-700 text-zinc-300 hover:bg-zinc-800"}`}
                >
                  {t("lesson.view", { chord })}
                </button>
              ))}
            </div>
            <ChordVisualizer instrument={lesson.instrument} chord={selectedVisualChord} />
          </div>
        )}

        <div className="mt-5 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={audioPlaying ? stopAudio : () => void playAudioExample()}
            className="rounded-lg border border-sky-700/70 bg-sky-950/30 px-3 py-2 text-xs font-semibold text-sky-200 hover:bg-sky-900/50"
          >
            {audioPlaying ? t("lesson.stopAudio") : t("lesson.playAudio", { instrument: localizedLesson.instrument.toLowerCase() })}
          </button>
          {canTune && (
            <button type="button" onClick={() => setTunerOpen(true)} className="rounded-lg border border-zinc-700 px-3 py-2 text-xs font-semibold text-zinc-200 hover:bg-zinc-800">
              {t("lesson.openTuner")}
            </button>
          )}
          {currentStep === steps.length - 1 && (
            <button
              type="button"
              onClick={() => setStepTried((tried) => !tried)}
              aria-pressed={stepTried}
              className={`rounded-lg border px-3 py-2 text-xs font-semibold ${stepTried ? "border-emerald-700 bg-emerald-950/40 text-emerald-200" : "border-zinc-700 text-zinc-300 hover:bg-zinc-800"}`}
            >
              {stepTried ? t("lesson.practiceChecked") : t("lesson.tryPractice")}
            </button>
          )}
        </div>

        <p className="mt-3 text-[11px] text-zinc-400">{t("lesson.audioNote")}</p>

        <div className="mt-6 flex items-center justify-between gap-3 border-t border-zinc-800 pt-4">
          <button type="button" onClick={goBack} disabled={currentStep === 0} className="rounded-lg px-3 py-2 text-xs font-semibold text-zinc-200 hover:bg-zinc-800 disabled:opacity-40">{t("lesson.previousStep")}</button>
          {currentStep < steps.length - 1 ? (
            <button type="button" onClick={advance} className="rounded-lg bg-amber-600 px-4 py-2 text-xs font-bold text-white hover:bg-amber-500">{t("lesson.nextStep")}</button>
          ) : (
            <span role="status" className="text-xs font-semibold text-emerald-200">{t("lesson.practiceReached")}</span>
          )}
        </div>
      </section>

      {currentStep === steps.length - 1 && (
        <section className="mt-4 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-amber-500/50 bg-amber-950/20 p-5">
          <div>
            <h2 className="font-bold text-white">{t("lesson.saveProgress")}</h2>
            <p className="mt-1 text-xs text-zinc-300">{t("lesson.finishHint")}</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <CompleteButton lessonId={lesson.id} done={done} />
            {nextId && <Link href={`/academy/${nextId}`} className="rounded-lg border border-zinc-700 px-4 py-3 text-xs font-bold text-white hover:bg-zinc-800">{t("lesson.nextLesson")}</Link>}
          </div>
        </section>
      )}

      <div className="mt-5 flex justify-between text-xs">
        {previousId ? <Link href={`/academy/${previousId}`} className="text-zinc-300 hover:text-white">← {t("lesson.previousLesson")}</Link> : <span />}
        <Link href="/academy" className="text-zinc-300 hover:text-white">{t("lesson.allInstruments")}</Link>
      </div>

      <ChromaticTuner isOpen={tunerOpen} onClose={() => setTunerOpen(false)} instrumentName={lesson.instrument} />
    </div>
  );
}
