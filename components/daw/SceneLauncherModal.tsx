"use client";
import React from "react";
import { StudioScene, TrackData } from "@/lib/AudioEngine";
import { useLanguage } from "@/components/LanguageProvider";

interface SceneLauncherModalProps {
  scenes: StudioScene[];
  tracks: TrackData[];
  isPlaying: boolean;
  onCreate: () => void;
  onChange: (scene: StudioScene) => void;
  onDelete: (sceneId: string) => void;
  onLaunch: (scene: StudioScene) => void;
  onStop: () => void;
  onClose: () => void;
}

export function SceneLauncherModal({
  scenes,
  tracks,
  isPlaying,
  onCreate,
  onChange,
  onDelete,
  onLaunch,
  onStop,
  onClose,
}: SceneLauncherModalProps) {
  const { t } = useLanguage();
  return (
    <div className="fixed inset-0 z-[72] flex items-center justify-center bg-black/80 p-4">
      <section className="max-h-[90vh] w-full max-w-5xl overflow-hidden rounded-xl border border-zinc-700 bg-[#15171d] shadow-2xl">
        <header className="flex items-center justify-between gap-3 border-b border-zinc-800 p-4">
          <div>
            <h2 className="text-sm font-bold text-white">{t("scene.title")}</h2>
            <p className="mt-1 text-[10px] text-zinc-400">{t("scene.help")}</p>
          </div>
          <div className="flex gap-2">
            <button onClick={onCreate} className="rounded bg-sky-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-600">{t("scene.capture")}</button>
            <button onClick={onStop} disabled={!isPlaying} className="rounded bg-rose-900/70 px-3 py-1.5 text-xs text-rose-100 hover:bg-rose-800 disabled:opacity-40">{t("scene.stop")}</button>
            <button onClick={onClose} className="rounded bg-zinc-800 px-3 py-1.5 text-xs text-zinc-200 hover:bg-zinc-700">{t("scene.close")}</button>
          </div>
        </header>
        <div className="max-h-[75vh] overflow-auto p-4">
          {scenes.length === 0 ? (
            <div className="rounded-lg border border-dashed border-zinc-700 p-10 text-center text-xs text-zinc-500">{t("scene.empty")}</div>
          ) : (
            <div className="space-y-3">
              {scenes.map((scene) => (
                <div key={scene.id} className="rounded-lg border border-zinc-800 bg-[#101116] p-3">
                  <div className="mb-3 flex items-center gap-2">
                    <input
                      aria-label={t("scene.name")}
                      value={scene.name}
                      onChange={(event) => onChange({ ...scene, name: event.target.value.slice(0, 40) })}
                      className="min-w-0 flex-1 rounded bg-zinc-900 px-2 py-1 text-xs font-semibold text-white"
                    />
                    <button onClick={() => onLaunch(scene)} className="rounded bg-emerald-700 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-600">{t("scene.launch")}</button>
                    <button onClick={() => onDelete(scene.id)} className="rounded bg-zinc-800 px-2 py-1.5 text-[10px] text-zinc-300 hover:bg-rose-900">{t("scene.delete")}</button>
                  </div>
                  {tracks.length === 0 ? (
                    <p className="text-[10px] text-zinc-500">{t("scene.noTracks")}</p>
                  ) : (
                    <div className="flex gap-2 overflow-x-auto pb-1">
                      {tracks.map((track) => {
                        if (track.category === "audio") {
                          const selectedRegionId = scene.regionIdsByTrack[track.id]?.[0] ?? "";
                          return (
                            <label key={track.id} className="w-40 flex-none rounded border border-zinc-800 bg-zinc-900/70 p-2 text-[9px] text-zinc-400">
                              <span className="mb-1 block truncate font-bold text-zinc-200">{track.name}</span>
                              <select
                                aria-label={`${track.name} scene clip`}
                                value={selectedRegionId}
                                onChange={(event) => {
                                  const regionIdsByTrack = { ...scene.regionIdsByTrack };
                                  if (event.target.value) regionIdsByTrack[track.id] = [event.target.value];
                                  else delete regionIdsByTrack[track.id];
                                  onChange({ ...scene, regionIdsByTrack });
                                }}
                                className="w-full rounded bg-black px-1.5 py-1 text-[9px] text-white"
                              >
                                <option value="">{t("scene.noClip")}</option>
                                {track.regions.map((region) => <option key={region.id} value={region.id}>{region.name}</option>)}
                              </select>
                            </label>
                          );
                        }
                        if (track.category === "midi") {
                          const notes = scene.midiNotesByTrack?.[track.id];
                          const enabled = Boolean(notes?.length);
                          return (
                            <label key={track.id} className="flex w-40 flex-none items-center gap-2 rounded border border-zinc-800 bg-zinc-900/70 p-2 text-[9px] text-zinc-300">
                              <input
                                type="checkbox"
                                checked={enabled}
                                disabled={!track.midiNotes?.length}
                                onChange={(event) => {
                                  const midiNotesByTrack = { ...scene.midiNotesByTrack };
                                  if (event.target.checked) midiNotesByTrack[track.id] = track.midiNotes ?? [];
                                  else delete midiNotesByTrack[track.id];
                                  onChange({ ...scene, midiNotesByTrack });
                                }}
                              />
                              <span className="truncate">{track.name} MIDI {track.midiNotes?.length ? `(${track.midiNotes.length})` : t("scene.emptyTrack")}</span>
                            </label>
                          );
                        }
                        const enabled = Boolean(scene.drumPatternsByTrack?.[track.id]);
                        return (
                          <label key={track.id} className="flex w-40 flex-none items-center gap-2 rounded border border-zinc-800 bg-zinc-900/70 p-2 text-[9px] text-zinc-300">
                            <input
                              type="checkbox"
                              checked={enabled}
                              disabled={!track.drumPattern}
                              onChange={(event) => {
                                const drumPatternsByTrack = { ...scene.drumPatternsByTrack };
                                if (event.target.checked && track.drumPattern) drumPatternsByTrack[track.id] = track.drumPattern;
                                else delete drumPatternsByTrack[track.id];
                                onChange({ ...scene, drumPatternsByTrack });
                              }}
                            />
                            <span className="truncate">{track.name} {t("scene.beat")} {track.drumPattern ? t("scene.included") : t("scene.emptyTrack")}</span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
