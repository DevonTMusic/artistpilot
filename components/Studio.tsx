// components/Studio.tsx
"use client";
import React, { useEffect, useRef, useState, useCallback } from "react";
import { useLanguage } from "@/components/LanguageProvider";
import { AudioEngine } from "@/lib/AudioEngine";
import {
  TrackData,
  AudioRegion,
  ArrangerSection,
  DrumPatternData,
  GuitarAmpSettings,
  MasterAutomationPoint,
  MixerBus,
  SamplerData,
  StudioScene,
  SynthSettings,
} from "@/lib/AudioEngine";
import { ClipRegion } from "@/components/daw/ClipRegion";
import { ArrangerLane } from "@/components/daw/ArrangerLane";
import { PianoRoll, MidiNote } from "@/components/daw/PianoRoll";
import { GuitarAmpModal } from "@/components/daw/GuitarAmpModal";
import { AiCoachModal } from "@/components/daw/AiCoachModal";
import { ChannelEqModal } from "@/components/daw/ChannelEqModal";
import { AudioDeviceManager, DeviceInfo } from "@/lib/daw/AudioDeviceManager";
import { AudioSettingsModal } from "@/components/daw/AudioSettingsModal";
import { TrackControlsPanel } from "@/components/daw/TrackControlsPanel";
import { ProcessingSettings, DEFAULT_TRACK_SETTINGS } from "@/lib/daw/TrackProcessor";
import {
  saveSessionFile,
  openSessionFile,
  parseArrangerSections,
  parseMasterAutomation,
  parseMixerBuses,
  parseProcessingSettings,
  parseStudioScenes,
  serializeSessionFile,
  sourceBlobs,
} from "@/lib/daw/sessionFile";
import { PianoStudioModal } from "@/components/daw/PianoStudioModal";
import { PianoEngine } from "@/lib/daw/PianoEngine";
import { DiscoverTrackModal } from "@/components/daw/DiscoverTrackModal";
import { DrumPatternEditor } from "@/components/daw/DrumPatternEditor";
import { SoundLibraryModal } from "@/components/daw/SoundLibraryModal";
import { SamplerPadModal } from "@/components/daw/SamplerPadModal";
import { SceneLauncherModal } from "@/components/daw/SceneLauncherModal";
import { CollaborationPanel } from "@/components/daw/CollaborationPanel";
import { StudioWelcomeModal } from "@/components/daw/StudioWelcomeModal";
import { ChromaticTuner } from "@/components/daw/ChromaticTuner";
import { SoundPreset } from "@/lib/daw/soundLibrary";
import { parseMidiFile } from "@/lib/daw/midiFile";
import {
  PlayIcon,
  PauseIcon,
  StopIcon,
  RewindIcon,
  LoopIcon,
  MicIcon,
  PianoIcon,
  GuitarIcon,
  BassIcon,
  DrumIcon,
  BellIcon,
} from "@/components/daw/StudioIcons";

export type TrackCompatibilityType = "vocal" | "guitar-bass" | "midi" | "drum";

interface ExtendedTrackData extends TrackData {
  trackType: TrackCompatibilityType;
  inputDevice?: string;
  monitoring?: boolean;
  settings: ProcessingSettings;
  ampSettings: GuitarAmpSettings;
  ampEnabled: boolean;
}

const KEYS = ["C", "D♭", "D", "E♭", "E", "F", "F#", "G", "A♭", "A", "B♭", "B"];
const DEFAULT_DRUM_PATTERN: DrumPatternData = {
  kick: Array.from({ length: 16 }, (_, index) => index % 4 === 0),
  snare: Array.from({ length: 16 }, (_, index) => index === 4 || index === 12),
  hat: Array.from({ length: 16 }, (_, index) => index % 2 === 0),
  openHat: Array.from({ length: 16 }, () => false),
  clap: Array.from({ length: 16 }, (_, index) => index === 4 || index === 12),
  percussion: Array.from({ length: 16 }, () => false),
  swing: 0,
};
const DEFAULT_SYNTH_SETTINGS: SynthSettings = {
  waveform: "triangle",
  attack: 0.01,
  decay: 0.15,
  sustain: 0.75,
  release: 0.15,
  cutoff: 12000,
  resonance: 0.7,
};
const DEFAULT_AMP_SETTINGS: GuitarAmpSettings = {
  drive: 0,
  bass: 0,
  mid: 0,
  treble: 0,
  master: 1,
  cabSim: false,
  reverb: 0,
  delay: 0,
  driveEnabled: false,
  delayEnabled: false,
  chorusEnabled: false,
  reverbEnabled: false,
};

const FREE_TRACK_LIMIT = 3;

export default function Studio({ defaultBpm = 120, isPro = true }: { defaultBpm?: number; isPro?: boolean }) {
  const { t, locale } = useLanguage();
  const engine = useRef<AudioEngine>(AudioEngine.getInstance());
  const deviceManager = useRef<AudioDeviceManager>(AudioDeviceManager.getInstance());

  const [tracks, setTracks] = useState<ExtendedTrackData[]>([]);
  const trackHistoryRef = useRef<{
    undo: ExtendedTrackData[][];
    redo: ExtendedTrackData[][];
    last: ExtendedTrackData[];
    applying: boolean;
  }>({ undo: [], redo: [], last: tracks, applying: false });

  const [masterSettings, setMasterSettings] = useState<ProcessingSettings>({
    ...DEFAULT_TRACK_SETTINGS,
    compAmount: 0,
  });

  const [isMasterMode, setIsMasterMode] = useState(false);
  const [projectName, setProjectName] = useState(t("studio.newProject"));
  const [bpm, setBpm] = useState(Math.min(300, Math.max(30, defaultBpm)));
  const [projectKey, setProjectKey] = useState("D♭");
  const [projectScale, setProjectScale] = useState<"maj" | "min">("maj");
  const [sections, setSections] = useState<ArrangerSection[]>([]);
  const [buses, setBuses] = useState<MixerBus[]>([]);
  const [busPanelOpen, setBusPanelOpen] = useState(false);
  const [masterAutomation, setMasterAutomation] = useState<MasterAutomationPoint[]>([]);
  const [scenes, setScenes] = useState<StudioScene[]>([]);
  const [samplerTrackId, setSamplerTrackId] = useState<number | null>(null);
  const [sceneLauncherOpen, setSceneLauncherOpen] = useState(false);
  const [activeSceneId, setActiveSceneId] = useState<string | null>(null);
  const [collaborationOpen, setCollaborationOpen] = useState(false);
  const [sharedProjectId, setSharedProjectId] = useState<string | null>(null);
  const [sharedRevision, setSharedRevision] = useState(0);
  const [sharedProjectIsOwner, setSharedProjectIsOwner] = useState(false);
  const [hasEditLease, setHasEditLease] = useState(false);
  const [editLockOwnerId, setEditLockOwnerId] = useState<string | null>(null);
  const [editLockExpiresAt, setEditLockExpiresAt] = useState<string | null>(null);
  const sharedProjectLoaderRef = useRef<(projectId: string) => Promise<void>>(async () => {});
  const [isPlaying, setIsPlaying] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [playheadSec, setPlayheadSec] = useState(0);
  const [selectedTrackId, setSelectedTrackId] = useState(0);
  const [pixelsPerSecond, setPixelsPerSecond] = useState(50);
  const [isSnapEnabled, setIsSnapEnabled] = useState(true);
  const [isAutomationMode, setIsAutomationMode] = useState(false);
  const [automationParameter, setAutomationParameter] = useState<"volume" | "pan" | "reverbSend">("volume");
  const [quantizeGridSteps, setQuantizeGridSteps] = useState(1);
  const [timeSignature, setTimeSignature] = useState<"3/4" | "4/4" | "6/8">("4/4");
  const [lyricsNotes, setLyricsNotes] = useState("");
  const [activeUtility, setActiveUtility] = useState<"notes" | "shortcuts" | null>(null);
  const [masterPreset, setMasterPreset] = useState<"custom" | "warm" | "clear" | "loud">("custom");
  const [historyVersion, setHistoryVersion] = useState(0);
  const [masterVolume, setMasterVolume] = useState(0.85);

  // Loop & Scrubbing
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [isLooping, setIsLooping] = useState(false);
  const [loopStartSec, setLoopStartSec] = useState(0);
  const [loopEndSec, setLoopEndSec] = useState(8);
  const [draggingLoopEdge, setDraggingLoopEdge] = useState<"start" | "end" | null>(null);

  const [countInActive, setCountInActive] = useState(true);
  const [metronomeActive, setMetronomeActive] = useState(false);

  // Hardware Interface
  const [activeInputLabel, setActiveInputLabel] = useState<string>(t("studio.systemDefaultInput"));
  const [activeInputId, setActiveInputId] = useState<string>("default");
  const [activeOutputId, setActiveOutputId] = useState<string>("default");
  const [monitoringEnabled, setMonitoringEnabled] = useState(false);
  const [devices, setDevices] = useState<DeviceInfo[]>([]);
  const [copiedClip, setCopiedClip] = useState<AudioRegion | null>(null);
  const [pianoRollOpen, setPianoRollOpen] = useState(false);
  const [drumEditorOpen, setDrumEditorOpen] = useState(false);
  const [tunerOpen, setTunerOpen] = useState(false);
  const [soundLibraryOpen, setSoundLibraryOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isExportingStems, setIsExportingStems] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const soundInputRef = useRef<HTMLInputElement>(null);

  // Modals & Panels
  const [smartControlsOpen, setSmartControlsOpen] = useState(true);
  const [audioSettingsOpen, setAudioSettingsOpen] = useState(false);
  const [discoverModalOpen, setDiscoverModalOpen] = useState(false);
  const [welcomeOpen, setWelcomeOpen] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");
  const [upgradeFeature, setUpgradeFeature] = useState<string | null>(null);
  const [aiFeature, setAiFeature] = useState<"coach" | "palette" | "songstarter">("coach");

  useEffect(() => {
    if (new URLSearchParams(window.location.search).has("invite")) return;
    try {
      if (window.localStorage.getItem("artistpilot-studio-guide-seen") !== "true") {
        setWelcomeOpen(true);
      }
    } catch (error) {
      console.warn("Could not read Studio guide preference:", error);
      setWelcomeOpen(true);
    }
  }, []);

  const closeWelcome = () => {
    setWelcomeOpen(false);
    try {
      window.localStorage.setItem("artistpilot-studio-guide-seen", "true");
    } catch (error) {
      console.warn("Could not save Studio guide preference:", error);
    }
  };

  const [windowState, setWindowState] = useState({
    piano: { open: false, x: 260, y: 120 },
    amp: { open: false, x: 300, y: 100 },
    eq: { open: false, x: 340, y: 140 },
    ai: { open: false, x: 380, y: 120 },
  });

  const [trackNotes, setTrackNotes] = useState<Record<number, MidiNote[]>>({});

  const animFrame = useRef<number | null>(null);
  const playStartTime = useRef(0);
  const playheadAnchor = useRef(0);
  const activeMediaRecorders = useRef<MediaRecorder[]>([]);
  const nextTrackId = useRef(1);
  const recChunks = useRef<Record<number, Blob[]>>({});
  const recStartTime = useRef(0);
  const activeMidiInputNotes = useRef<Record<number, { id: string; startStep: number }>>({});
  const liveCanvasRefs = useRef(new Map<number, HTMLCanvasElement>());
  const liveAnalyserRef = useRef<AnalyserNode | null>(null);
  const liveWaveformHistoryRef = useRef(new Map<number, number[]>());
  const liveAnimRef = useRef<number | null>(null);
  const timelineContainerRef = useRef<HTMLDivElement>(null);
  const trackHeaderRowsRef = useRef<HTMLDivElement>(null);
  const timelineRowsRef = useRef<HTMLDivElement>(null);
  const lastMetronomeBeat = useRef<number>(-1);
  const scrubPosition = useRef(0);
  const countInCancelled = useRef(false);
  const tapTimes = useRef<number[]>([]);
  const [barNumerator, barDenominator] = timeSignature.split("/").map(Number);
  const secondsPerBar = (60 / bpm) * (barNumerator * (4 / barDenominator));
  useEffect(() => {
    const history = trackHistoryRef.current;
    if (history.last !== tracks) {
      if (!history.applying) {
        history.undo.push(history.last);
        if (history.undo.length > 50) history.undo.shift();
        history.redo = [];
      }
      history.last = tracks;
      history.applying = false;
      setHistoryVersion((version) => version + 1);
    }
  }, [tracks]);
  const projectDuration = Math.max(
    8,
    ...tracks.flatMap((track) => [
      ...track.regions.map((region) => region.startTime + region.duration),
      ...(trackNotes[track.id] ?? track.midiNotes ?? []).map((note) => ((note.startStep + note.length) * 60) / bpm / 4),
      track.category === "drum" ? ((track.drumPattern?.kick.length ?? 0) * 60) / bpm / 4 : 0,
    ]),
    ...sections.map((section) => section.endBar * secondsPerBar),
    ...masterAutomation.map((point) => point.time)
  );
  const addArrangerSection = () => {
    const startBar = Math.max(1, Math.floor(playheadSec / secondsPerBar) + 1);
    const names = [
      t("studio.sectionIntro"),
      t("studio.sectionVerse"),
      t("studio.sectionChorus"),
      t("studio.sectionBridge"),
      t("studio.sectionOutro"),
    ];
    const colors = ["bg-emerald-700", "bg-sky-700", "bg-amber-700", "bg-amber-700", "bg-rose-700"];
    const index = sections.length;
    setSections((current) => [...current, {
      id: `section-${Date.now()}`,
      name: names[index % names.length],
      color: colors[index % colors.length],
      startBar,
      endBar: startBar + 4,
    }]);
  };

  const commitSectionMove = useCallback((previous: ArrangerSection, next: ArrangerSection) => {
    const deltaBars = next.startBar - previous.startBar;
    const deltaSeconds = deltaBars * secondsPerBar;
    const sectionStart = (previous.startBar - 1) * secondsPerBar;
    const sectionEnd = (previous.endBar - 1) * secondsPerBar;
    const stepDuration = 60 / bpm / 4;
    const deltaSteps = Math.round(deltaSeconds / stepDuration);
    if (deltaBars !== 0) {
      setTracks((current) => current.map((track) => ({
        ...track,
        regions: track.regions.map((region) =>
          region.startTime >= sectionStart && region.startTime < sectionEnd
            ? { ...region, startTime: Math.max(0, region.startTime + deltaSeconds) }
            : region
        ),
        midiNotes: (trackNotes[track.id] ?? track.midiNotes ?? []).map((note) => {
          const noteTime = note.startStep * stepDuration;
          return noteTime >= sectionStart && noteTime < sectionEnd
            ? { ...note, startStep: Math.max(0, note.startStep + deltaSteps) }
            : note;
        }),
      })));
      setTrackNotes((current) => Object.fromEntries(Object.entries(current).map(([trackId, notes]) => [
        trackId,
        notes.map((note) => {
          const noteTime = note.startStep * stepDuration;
          return noteTime >= sectionStart && noteTime < sectionEnd
            ? { ...note, startStep: Math.max(0, note.startStep + deltaSteps) }
            : note;
        }),
      ])));
    }
    setSections((current) => current.map((section) => section.id === next.id ? next : section));
  }, [bpm, secondsPerBar, trackNotes]);

  const seekToBar = (bar: number) => {
    const time = Math.max(0, (bar - 1) * secondsPerBar);
    engine.current.stopPlayback();
    if (animFrame.current) cancelAnimationFrame(animFrame.current);
    animFrame.current = null;
    setIsPlaying(false);
    setPlayheadSec(time);
    playheadAnchor.current = time;
    scrubPosition.current = time;
  };
  const addMasterAutomationPoint = (time: number, value: number) => {
    setMasterAutomation((current) => [
      ...current.filter((point) => Math.abs(point.time - time) > 0.02),
      { id: `master-${Date.now()}-${Math.round(time * 1000)}`, time, value },
    ].sort((left, right) => left.time - right.time));
  };
  const createMasterFadeOut = () => {
    const fadeStart = Math.max(playheadSec, projectDuration - secondsPerBar);
    const fadeEnd = Math.max(fadeStart + 0.1, projectDuration);
    setMasterAutomation((current) => [
      ...current.filter((point) => point.time < fadeStart || point.time > fadeEnd),
      { id: `master-fade-in-${Date.now()}`, time: fadeStart, value: masterVolume },
      { id: `master-fade-out-${Date.now()}`, time: fadeEnd, value: 0 },
    ].sort((left, right) => left.time - right.time));
  };
  const addMixerBus = () => {
    setBuses((current) => [...current, {
      id: `bus-${Date.now()}`,
      name: `Bus ${current.length + 1}`,
      volume: 1,
      pan: 0,
      reverbSend: 0,
    }]);
    setBusPanelOpen(true);
  };
  const captureScene = () => {
    const projectTracks = getProjectTracks();
    const regionIdsByTrack: Record<number, string[]> = {};
    const midiNotesByTrack: Record<number, NonNullable<TrackData["midiNotes"]>> = {};
    const drumPatternsByTrack: Record<number, DrumPatternData> = {};
    projectTracks.forEach((track) => {
      if (track.category === "audio" && track.regions[0]) regionIdsByTrack[track.id] = [track.regions[0].id];
      if (track.category === "midi" && track.midiNotes?.length) midiNotesByTrack[track.id] = track.midiNotes;
      if (track.category === "drum" && track.drumPattern) drumPatternsByTrack[track.id] = track.drumPattern;
    });
    const colors = ["bg-cyan-700", "bg-amber-700", "bg-emerald-700", "bg-orange-700"];
    setScenes((current) => [...current, {
      id: `scene-${Date.now()}`,
      name: `Scene ${current.length + 1}`,
      color: colors[current.length % colors.length],
      regionIdsByTrack,
      midiNotesByTrack,
      drumPatternsByTrack,
    }]);
  };
  const launchScene = (scene: StudioScene) => {
    const remainder = playheadSec % secondsPerBar;
    const delay = isPlaying && remainder > 0.02 ? secondsPerBar - remainder : 0;
    engine.current.launchScene(getProjectTracks(), scene, bpm, timeSignature, delay, buses);
    setActiveSceneId(scene.id);
    setStatusMsg(t(delay > 0 ? "studio.statusSceneQueued" : "studio.statusSceneLaunched", { name: scene.name }));
  };
  const playbackState = useRef({
    tracks,
    bpm,
    timeSignature,
    masterVolume,
    isLooping,
    loopStartSec,
    loopEndSec,
    metronomeActive,
    isRecording,
    isPlaying,
    projectDuration,
    masterSettings,
    buses,
    masterAutomation,
  });

  const triggerMetronomeClick = useCallback((isDownbeat: boolean) => {
    try {
      const c = engine.current.init();
      if (c.state === "suspended") c.resume();
      const osc = c.createOscillator();
      const gain = c.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(isDownbeat ? 1600 : 850, c.currentTime);
      gain.gain.setValueAtTime(0.4, c.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.05);

      osc.connect(gain);
      gain.connect(c.destination);
      osc.start(c.currentTime);
      osc.stop(c.currentTime + 0.055);
    } catch {}
  }, []);

  const toggleModal = (key: keyof typeof windowState) => {
    setWindowState((prev) => ({
      ...prev,
      [key]: { ...prev[key], open: !prev[key].open },
    }));
  };

  useEffect(() => {
    deviceManager.current.refreshDevices().then(({ inputs }) => {
      setDevices(inputs);
      if (inputs.length > 0) {
        setActiveInputLabel(inputs[0].label);
        setActiveInputId(inputs[0].deviceId);
      }
    });
  }, []);

  useEffect(() => () => {
    deviceManager.current.cleanupStream();
    engine.current.stopPlayback();
  }, []);

  useEffect(() => {
    playbackState.current = {
      tracks: tracks.map((track) => ({ ...track, midiNotes: trackNotes[track.id] ?? track.midiNotes ?? [] })),
      bpm,
      timeSignature,
      masterVolume,
      isLooping,
      loopStartSec,
      loopEndSec,
      metronomeActive,
      isRecording,
      isPlaying,
      projectDuration,
      masterSettings,
      buses,
      masterAutomation,
    };
    engine.current.updateMix(playbackState.current.tracks, masterVolume, masterSettings, buses);
  }, [tracks, trackNotes, bpm, timeSignature, masterVolume, isLooping, loopStartSec, loopEndSec, metronomeActive, isRecording, isPlaying, projectDuration, masterSettings, buses, masterAutomation]);

  // Scrubbing & Loop Range Listeners
  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!timelineContainerRef.current) return;
      const rect = timelineContainerRef.current.getBoundingClientRect();
      const scrollLeft = timelineContainerRef.current.scrollLeft || 0;
      const currentMouseSec = Math.max(0, (e.clientX - rect.left + scrollLeft) / pixelsPerSecond);

      if (isScrubbing) {
        setPlayheadSec(currentMouseSec);
        playheadAnchor.current = currentMouseSec;
        playStartTime.current = performance.now();
        scrubPosition.current = currentMouseSec;
      } else if (draggingLoopEdge === "start") {
        setLoopStartSec(Math.min(currentMouseSec, loopEndSec - 0.5));
      } else if (draggingLoopEdge === "end") {
        setLoopEndSec(Math.max(currentMouseSec, loopStartSec + 0.5));
      }
    };

    const onMouseUp = () => {
      if (isScrubbing && playbackState.current.isPlaying) {
        const state = playbackState.current;
        playheadAnchor.current = scrubPosition.current;
        playStartTime.current = performance.now();
        engine.current.schedulePlayback(
          state.tracks,
          scrubPosition.current,
          state.bpm,
          state.masterVolume,
          state.masterSettings,
          state.isLooping ? state.loopEndSec : state.projectDuration,
          state.buses,
          state.masterAutomation
        );
      }
      setIsScrubbing(false);
      setDraggingLoopEdge(null);
    };

    if (isScrubbing || draggingLoopEdge) {
      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", onMouseUp);
    }
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [isScrubbing, draggingLoopEdge, pixelsPerSecond, loopStartSec, loopEndSec]);

  // Master Clock & Loop Watcher
  const updatePlaybackPosition = () => {
    const elapsed = (performance.now() - playStartTime.current) / 1000;
    let currentSec = playheadAnchor.current + elapsed;

    const state = playbackState.current;
    if (state.isLooping && currentSec >= state.loopEndSec) {
      currentSec = state.loopStartSec;
      playStartTime.current = performance.now();
      playheadAnchor.current = state.loopStartSec;
      engine.current.schedulePlayback(
        state.tracks,
        state.loopStartSec,
        state.bpm,
        state.masterVolume,
        state.masterSettings,
        state.loopEndSec,
        state.buses,
        state.masterAutomation
      );
    }

    if (state.metronomeActive) {
      const denominator = Number(state.timeSignature.split("/")[1]);
      const beatSeconds = 60 / state.bpm * (4 / denominator);
      const beatIdx = Math.floor(currentSec / beatSeconds);
      if (beatIdx !== lastMetronomeBeat.current) {
        lastMetronomeBeat.current = beatIdx;
        triggerMetronomeClick(beatIdx % Number(state.timeSignature.split("/")[0]) === 0);
      }
    }

    if (!state.isLooping && !state.isRecording && currentSec >= state.projectDuration) {
      setPlayheadSec(state.projectDuration);
      setIsPlaying(false);
      engine.current.stopPlayback();
      animFrame.current = null;
      return;
    }

    setPlayheadSec(currentSec);
    animFrame.current = requestAnimationFrame(updatePlaybackPosition);
  };

  const handlePlay = (startAt?: number) => {
    engine.current.init();
    if (isPlaying) {
      engine.current.stopPlayback();
      if (animFrame.current) cancelAnimationFrame(animFrame.current);
      animFrame.current = null;
      setIsPlaying(false);
    } else {
      const pos = startAt !== undefined ? startAt : (isLooping && playheadSec >= loopEndSec ? loopStartSec : playheadSec);
      playStartTime.current = performance.now();
      playheadAnchor.current = pos;
      lastMetronomeBeat.current = -1;
      engine.current.schedulePlayback(
        tracks.map((track) => ({ ...track, midiNotes: trackNotes[track.id] ?? track.midiNotes ?? [] })),
        pos,
        bpm,
        masterVolume,
        masterSettings,
        isLooping ? loopEndSec : projectDuration,
        buses,
        masterAutomation
      );
      animFrame.current = requestAnimationFrame(updatePlaybackPosition);
      setIsPlaying(true);
    }
  };

  const startLiveInputMonitor = async (deviceIdOverride?: string) => {
    const inputTrack = tracks.find((track) => track.id === selectedTrackId && track.category === "audio")
      ?? tracks.find((track) => track.category === "audio");
    if (!inputTrack) throw new Error("Add or select an audio track before monitoring a microphone or instrument.");
    const ctx = engine.current.init();
    if (ctx.state === "suspended") await ctx.resume();
    const { analyser } = await deviceManager.current.setupInputStream(
      ctx,
      deviceIdOverride || inputTrack.inputDevice || activeInputId,
      true,
      inputTrack.settings,
      inputTrack.ampSettings,
      inputTrack.ampEnabled
    );
    liveAnalyserRef.current = analyser;
  };

  const setInputMonitoring = async (enabled: boolean, deviceIdOverride?: string) => {
    setMonitoringEnabled(enabled);
    const ctx = engine.current.ctx;
    if (!enabled) {
      if (isRecording && ctx) {
        deviceManager.current.setMonitoring(ctx, false);
      } else {
        deviceManager.current.cleanupStream();
        liveAnalyserRef.current = null;
      }
      return;
    }

    if (isRecording && ctx) {
      deviceManager.current.setMonitoring(ctx, true);
      return;
    }
    try {
      await startLiveInputMonitor(deviceIdOverride);
      setStatusMsg(t("studio.statusMonitoring"));
    } catch (error) {
      deviceManager.current.cleanupStream();
      liveAnalyserRef.current = null;
      setMonitoringEnabled(false);
      console.error("Could not start live input monitoring:", error);
      setStatusMsg(error instanceof Error ? error.message : t("studio.statusMonitorError"));
    }
  };

  const handleStop = () => {
    const shouldResumeMonitoring = isRecording && monitoringEnabled;
    countInCancelled.current = true;
    engine.current.stopPlayback();
    if (animFrame.current) cancelAnimationFrame(animFrame.current);
    animFrame.current = null;
    if (isRecording) {
      activeMediaRecorders.current.forEach((mr) => {
        if (mr.state === "inactive") return;
        try { mr.stop(); } catch (error) { console.error("Could not stop audio recorder:", error); }
      });
      activeMediaRecorders.current = [];
      liveAnalyserRef.current = null;
      setIsRecording(false);
      if (liveAnimRef.current) cancelAnimationFrame(liveAnimRef.current);
      liveAnimRef.current = null;
    }
    liveAnalyserRef.current = null;
    deviceManager.current.cleanupStream();
    setActiveSceneId(null);
    if (shouldResumeMonitoring) {
      void startLiveInputMonitor().catch((error: unknown) => {
        setMonitoringEnabled(false);
        console.error("Could not resume live input monitoring:", error);
        setStatusMsg(error instanceof Error ? error.message : t("studio.statusMonitorError"));
      });
    }
    setIsPlaying(false);
  };

  // Full Unrestricted Global Keybinds
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      if (activeEl && (activeEl.tagName === "INPUT" || activeEl.tagName === "TEXTAREA" || activeEl.tagName === "SELECT")) return;
      if (windowState.piano.open || pianoRollOpen || drumEditorOpen) return;

      if ((e.metaKey || e.ctrlKey) && (e.key === "z" || e.key === "Z")) {
        e.preventDefault();
        if (e.shiftKey) redoTrackChanges();
        else undoTrackChanges();
        return;
      }

      if (e.code === "Space") {
        e.preventDefault();
        if (isPlaying) handleStop();
        else handlePlay();
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        handleStop();
        setPlayheadSec(0);
        playheadAnchor.current = 0;
        return;
      }
      if ((e.key === "r" || e.key === "R") && !e.metaKey && !e.ctrlKey) {
        if (!windowState.piano.open) {
          e.preventDefault();
          handleRecord();
          return;
        }
      }
      if (e.key === "c" && !e.metaKey && !e.ctrlKey) {
        if (!windowState.piano.open) {
          e.preventDefault();
          setIsLooping((prev) => !prev);
          return;
        }
      }
      if (e.key === "Backspace" || e.key === "Delete") {
        e.preventDefault();
        const currTrack = tracks.find((t) => t.id === selectedTrackId);
        const clip = currTrack?.regions.find(
          (r) => playheadSec >= r.startTime && playheadSec <= r.startTime + r.duration
        );
        if (clip) {
          setTracks((prev) =>
            prev.map((t) =>
              t.id === selectedTrackId
                ? { ...t, regions: t.regions.filter((r) => r.id !== clip.id) }
                : t
            )
          );
          setStatusMsg(t("studio.statusDeletedClip", { name: clip.name }));
        }
        return;
      }
      if ((e.metaKey || e.ctrlKey) && (e.key === "c" || e.key === "C")) {
        const currTrack = tracks.find((t) => t.id === selectedTrackId);
        const clip = currTrack?.regions.find(
          (r) => playheadSec >= r.startTime && playheadSec <= r.startTime + r.duration
        );
        if (clip) {
          setCopiedClip(clip);
          setStatusMsg(t("studio.statusCopiedClip", { name: clip.name }));
        }
        return;
      }
      if ((e.metaKey || e.ctrlKey) && (e.key === "v" || e.key === "V")) {
        if (copiedClip) {
          const newRegion: AudioRegion = {
            ...copiedClip,
            id: `clip-${Date.now()}`,
            name: `${copiedClip.name} (Copy)`,
            startTime: playheadSec,
          };
          setTracks((prev) =>
            prev.map((t) => (t.id === selectedTrackId ? { ...t, regions: [...t.regions, newRegion] } : t))
          );
          setStatusMsg(t("studio.statusPastedClip", { time: playheadSec.toFixed(2) }));
        }
        return;
      }
      if ((e.metaKey || e.ctrlKey) && (e.key === "t" || e.key === "T")) {
        e.preventDefault();
        const currTrack = tracks.find((t) => t.id === selectedTrackId);
        const clip = currTrack?.regions.find(
          (r) => playheadSec > r.startTime && playheadSec < r.startTime + r.duration
        );
        if (clip) {
          const firstDuration = playheadSec - clip.startTime;
          const secondDuration = clip.duration - firstDuration;
          const r1 = { ...clip, duration: firstDuration };
          const r2 = {
            ...clip,
            id: `reg-${Date.now()}`,
            name: `${clip.name} (Part 2)`,
            startTime: playheadSec,
            offset: clip.offset + firstDuration,
            duration: secondDuration,
          };
          setTracks((prev) =>
            prev.map((t) =>
              t.id === selectedTrackId
                ? { ...t, regions: t.regions.flatMap((r) => (r.id === clip.id ? [r1, r2] : r)) }
                : t
            )
          );
          setStatusMsg(t("studio.statusSplitClip", { time: playheadSec.toFixed(2) }));
        }
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isPlaying, windowState.piano.open, pianoRollOpen, drumEditorOpen, selectedTrackId, playheadSec, copiedClip, tracks]);

  // Live Oscilloscope Waveform while Recording
  const startLiveWaveform = (analyser: AnalyserNode) => {
    const dataArray = new Uint8Array(analyser.frequencyBinCount);

    const draw = () => {
      liveAnimRef.current = requestAnimationFrame(draw);
      analyser.getByteTimeDomainData(dataArray);
      let peak = 0;
      dataArray.forEach((sample) => {
        peak = Math.max(peak, Math.abs(sample - 128) / 128);
      });
      liveCanvasRefs.current.forEach((canvas) => {
        const canvasContext = canvas.getContext("2d");
        if (!canvasContext) return;
        const history = liveWaveformHistoryRef.current.get(Number(canvas.dataset.trackId)) ?? [];
        history.push(peak);
        if (history.length > 20000) history.shift();
        liveWaveformHistoryRef.current.set(Number(canvas.dataset.trackId), history);
        const targetWidth = Math.min(16384, Math.max(1, Math.floor(canvas.clientWidth)));
        if (canvas.width !== targetWidth) canvas.width = targetWidth;
        canvasContext.clearRect(0, 0, canvas.width, canvas.height);
        canvasContext.lineWidth = 2;
        canvasContext.strokeStyle = "#fb7185";
        canvasContext.beginPath();
        const center = canvas.height / 2;
        for (let x = 0; x < canvas.width; x++) {
          const from = Math.floor((x / canvas.width) * history.length);
          const to = Math.max(from + 1, Math.floor(((x + 1) / canvas.width) * history.length));
          let columnPeak = 0;
          for (let index = from; index < Math.min(to, history.length); index++) {
            columnPeak = Math.max(columnPeak, history[index]);
          }
          const amplitude = Math.max(1, columnPeak * center * 0.9);
          canvasContext.moveTo(x, center - amplitude);
          canvasContext.lineTo(x, center + amplitude);
        }
        canvasContext.stroke();
      });
    };

    draw();
  };

  useEffect(() => {
    if (isRecording && liveAnalyserRef.current) {
      if (liveAnimRef.current) cancelAnimationFrame(liveAnimRef.current);
      startLiveWaveform(liveAnalyserRef.current);
    }
    return () => {
      if (liveAnimRef.current) cancelAnimationFrame(liveAnimRef.current);
      liveAnimRef.current = null;
    };
  }, [isRecording]);

  const handleRecord = async () => {
    if (isRecording) {
      handleStop();
      return;
    }

    const armedAudioTracks = tracks.filter((t) => t.armed && t.category === "audio");
    if (armedAudioTracks.length === 0) {
      setStatusMsg(t("studio.statusArmAudio"));
      return;
    }

    try {
      const ctx = engine.current.init();
      if (ctx.state === "suspended") await ctx.resume();

        const currentTrack = armedAudioTracks.find((track) => track.id === selectedTrackId) ?? armedAudioTracks[0];
      const { stream, analyser } = await deviceManager.current.setupInputStream(
        ctx,
          currentTrack.inputDevice || activeInputId,
          currentTrack.monitoring ?? monitoringEnabled,
          currentTrack.settings,
          currentTrack.ampSettings,
          currentTrack.ampEnabled
      );
      liveAnalyserRef.current = analyser;

        if (isPlaying) {
          engine.current.stopPlayback();
          if (animFrame.current) cancelAnimationFrame(animFrame.current);
          animFrame.current = null;
          setIsPlaying(false);
        }
        countInCancelled.current = false;
        if (countInActive) {
          const [countInBeats, countInDenominator] = timeSignature.split("/").map(Number);
          const beatMs = (60 / Math.max(1, bpm)) * (4 / countInDenominator) * 1000;
          for (let i = 0; i < countInBeats; i++) {
            if (countInCancelled.current) {
              liveAnalyserRef.current = null;
              deviceManager.current.cleanupStream();
              return;
            }
            setStatusMsg(t("studio.statusCountIn", { current: i + 1, total: countInBeats }));
            triggerMetronomeClick(i === 0);
            await new Promise((res) => setTimeout(res, beatMs));
          }
          if (countInCancelled.current) {
            liveAnalyserRef.current = null;
            deviceManager.current.cleanupStream();
            return;
          }
        }

      recChunks.current = {};
      recStartTime.current = playheadSec;
      liveWaveformHistoryRef.current.clear();
      activeMediaRecorders.current = [];

      armedAudioTracks.forEach((track) => {
        recChunks.current[track.id] = [];
        if (typeof MediaRecorder === "undefined") throw new Error("Audio recording is not supported by this browser.");
        const mr = new MediaRecorder(stream);

        mr.ondataavailable = (e) => {
          if (e.data.size > 0) recChunks.current[track.id].push(e.data);
        };

        mr.onstop = async () => {
          const blob = new Blob(recChunks.current[track.id], { type: mr.mimeType || "audio/webm" });
          try {
            if (blob.size === 0) throw new Error("The recording was empty.");
            const buffer = await ctx.decodeAudioData(await blob.arrayBuffer());
            sourceBlobs.set(buffer, blob);
            const newRegion: AudioRegion = {
              id: `rec-${track.id}-${Date.now()}`,
              name: `Recording`,
              buffer,
              startTime: recStartTime.current,
              duration: buffer.duration,
              offset: 0,
              gain: 1.0,
            };
            setTracks((prev) =>
              prev.map((t) => (t.id === track.id ? { ...t, regions: [...t.regions, newRegion] } : t))
            );
            setStatusMsg(t("studio.statusRecordingAdded", { track: track.name }));
          } catch (error) {
            console.error("Could not decode recorded audio:", error);
            setStatusMsg(t("studio.statusRecordingDecode", { track: track.name }));
          }
        };

        activeMediaRecorders.current.push(mr);
        mr.start();
      });

      setIsRecording(true);
      if (!isPlaying) handlePlay();
      setStatusMsg(t("studio.statusRecordingLive"));
    } catch (error) {
      activeMediaRecorders.current.forEach((recorder) => {
        if (recorder.state !== "inactive") {
          try { recorder.stop(); } catch (stopError) { console.error("Could not stop partial recorder:", stopError); }
        }
      });
      activeMediaRecorders.current = [];
      liveAnalyserRef.current = null;
      deviceManager.current.cleanupStream();
      setStatusMsg(error instanceof Error ? error.message : t("studio.statusRecordError"));
    }
  };

  const updateClip = (trackId: number, regionId: string, updated: Partial<AudioRegion>) => {
    setTracks((prev) =>
      prev.map((track) => track.id === trackId
        ? { ...track, regions: track.regions.map((region) => region.id === regionId ? { ...region, ...updated } : region) }
        : track)
    );
  };

  const splitClip = (trackId: number, regionId: string, splitTime: number) => {
    setTracks((prev) => prev.map((track) => {
      if (track.id !== trackId) return track;
      const region = track.regions.find((item) => item.id === regionId);
      if (!region) return track;
      const split = Math.max(region.startTime + 0.05, Math.min(region.startTime + region.duration - 0.05, splitTime));
      const firstDuration = split - region.startTime;
      const second: AudioRegion = {
        ...region,
        id: `clip-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        name: `${region.name} (Part 2)`,
        startTime: split,
        offset: region.offset + firstDuration,
        duration: region.duration - firstDuration,
      };
      setStatusMsg(t("studio.statusSplitRegion", { name: region.name, time: split.toFixed(2) }));
      return {
        ...track,
        regions: track.regions.flatMap((item) => item.id === regionId
          ? [{ ...item, duration: firstDuration }, second]
          : [item]),
      };
    }));
  };

  const repeatClipToLoopEnd = (trackId: number, regionId: string) => {
    const track = tracks.find((item) => item.id === trackId);
    const region = track?.regions.find((item) => item.id === regionId);
    if (!region) return;
    if (loopEndSec <= region.startTime + region.duration) {
      setStatusMsg(t("studio.statusLoopEnd"));
      return;
    }
    const repeated: AudioRegion[] = [];
    let startTime = region.startTime + region.duration;
    while (startTime < loopEndSec) {
      const duration = Math.min(region.duration, loopEndSec - startTime);
      repeated.push({
        ...region,
        id: `repeat-${region.id}-${Math.round(startTime * 1000)}`,
        name: `${region.name} (Loop)`,
        startTime,
        duration,
      });
      startTime += region.duration;
    }
    setTracks((current) => current.map((item) => item.id === trackId
      ? { ...item, regions: [...item.regions, ...repeated] }
      : item));
    setStatusMsg(t(repeated.length === 1 ? "studio.statusRepeatedOne" : "studio.statusRepeated", { name: region.name, count: repeated.length }));
  };

  const reverseClip = (trackId: number, regionId: string) => {
    const track = tracks.find((item) => item.id === trackId);
    const region = track?.regions.find((item) => item.id === regionId);
    if (!region) return;
    try {
      const context = engine.current.init();
      const sampleRate = region.buffer.sampleRate;
      const sourceStart = Math.max(0, Math.floor(region.offset * sampleRate));
      const frameCount = Math.min(
        Math.floor(region.duration * sampleRate),
        region.buffer.length - sourceStart
      );
      if (frameCount <= 0) throw new Error("This clip has no audio to reverse.");
      const reversed = context.createBuffer(region.buffer.numberOfChannels, frameCount, sampleRate);
      for (let channel = 0; channel < region.buffer.numberOfChannels; channel++) {
        const input = region.buffer.getChannelData(channel);
        const output = reversed.getChannelData(channel);
        for (let frame = 0; frame < frameCount; frame++) {
          output[frame] = input[sourceStart + frameCount - frame - 1];
        }
      }
      sourceBlobs.delete(reversed);
      setTracks((current) => current.map((item) => item.id === trackId
        ? {
          ...item,
          regions: item.regions.map((clip) => clip.id === regionId
            ? { ...clip, buffer: reversed, offset: 0, duration: reversed.duration, name: `${clip.name.replace(/ \(Reversed\)$/, "")} (Reversed)` }
            : clip),
        }
        : item));
      setStatusMsg(t("studio.statusReversed", { name: region.name }));
    } catch (error) {
      console.error("Could not reverse audio clip:", error);
      setStatusMsg(error instanceof Error ? error.message : t("studio.statusReverseError"));
    }
  };

  const joinAdjacentRegions = (trackId: number) => {
    const track = tracks.find((item) => item.id === trackId);
    if (!track) return;
    const ordered = [...track.regions].sort((a, b) => a.startTime - b.startTime);
    const first = ordered.find((region, index) =>
      index < ordered.length - 1 && Math.abs(region.startTime + region.duration - ordered[index + 1].startTime) < 0.03
    );
    const second = first ? ordered[ordered.indexOf(first) + 1] : undefined;
    if (!first || !second) {
      setStatusMsg(t("studio.statusJoinAdjacent"));
      return;
    }
    try {
      const ctx = engine.current.init();
      const channels = Math.max(first.buffer.numberOfChannels, second.buffer.numberOfChannels);
      const sampleRate = first.buffer.sampleRate;
      const firstFrames = Math.round(first.duration * sampleRate);
      const secondFrames = Math.round(second.duration * sampleRate);
      const buffer = ctx.createBuffer(channels, firstFrames + secondFrames, sampleRate);
      for (let channel = 0; channel < channels; channel++) {
        const output = buffer.getChannelData(channel);
        const firstChannel = first.buffer.getChannelData(Math.min(channel, first.buffer.numberOfChannels - 1));
        const secondChannel = second.buffer.getChannelData(Math.min(channel, second.buffer.numberOfChannels - 1));
        for (let frame = 0; frame < firstFrames; frame++) {
          output[frame] = (firstChannel[Math.floor(first.offset * sampleRate) + frame] ?? 0) * (first.gain ?? 1);
        }
        for (let frame = 0; frame < secondFrames; frame++) {
          output[firstFrames + frame] =
            (secondChannel[Math.floor(second.offset * sampleRate) + frame] ?? 0) * (second.gain ?? 1);
        }
      }
      sourceBlobs.delete(buffer);
      const joined: AudioRegion = {
        id: `join-${first.id}-${second.id}`,
        name: `${first.name} + ${second.name}`,
        buffer,
        startTime: first.startTime,
        duration: buffer.duration,
        offset: 0,
        gain: 1,
      };
      setTracks((current) => current.map((item) => item.id === trackId
        ? { ...item, regions: [...item.regions.filter((region) => region.id !== first.id && region.id !== second.id), joined] }
        : item));
      setStatusMsg(t("studio.statusJoined", { first: first.name, second: second.name }));
    } catch (error) {
      console.error("Could not join adjacent clips:", error);
      setStatusMsg(t("studio.statusJoinError"));
    }
  };

  const handleImportFile = async (file: File, trackId: number, startTime = playheadSec) => {
    const track = tracks.find((item) => item.id === trackId);
    if (!track) return;
    if (file.name.toLowerCase().endsWith(".mid") || file.name.toLowerCase().endsWith(".midi")) {
      try {
        const { notes, bpm: fileBpm } = parseMidiFile(await file.arrayBuffer());
        const stepOffset = Math.round(startTime / (60 / Math.max(1, bpm) / 4));
        const importedNotes = notes.map((note) => ({
          ...note,
          id: `${note.id}-${Date.now()}`,
          startStep: note.startStep + stepOffset,
        }));
        const combinedNotes = [...(trackNotes[trackId] ?? track.midiNotes ?? []), ...importedNotes];
        setTrackNotes((prev) => ({ ...prev, [trackId]: combinedNotes }));
        setTracks((prev) => prev.map((item) => item.id === trackId
          ? { ...item, category: "midi", trackType: "midi", midiNotes: combinedNotes }
          : item));
        if (fileBpm && fileBpm >= 30 && fileBpm <= 300) setBpm(Math.round(fileBpm));
        setSelectedTrackId(trackId);
        setStatusMsg(t("studio.statusImportedMidi", { count: notes.length, name: file.name }));
      } catch (error) {
        setStatusMsg(error instanceof Error ? t("studio.statusMidiImportDetail", { detail: error.message }) : t("studio.statusMidiImportError"));
      }
      return;
    }
    try {
      const ctx = engine.current.init();
      const buffer = await ctx.decodeAudioData(await file.arrayBuffer());
      sourceBlobs.set(buffer, file);
      const region: AudioRegion = {
        id: `import-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        name: file.name.replace(/\.[^.]+$/, "") || "Imported Audio",
        buffer,
        startTime: Math.max(0, startTime),
        duration: buffer.duration,
        offset: 0,
        gain: 1,
      };
      setTracks((prev) => prev.map((item) =>
        item.id === trackId ? { ...item, regions: [...item.regions, region] } : item
      ));
      setStatusMsg(t("studio.statusImportedAudio", { file: file.name, track: track.name }));
    } catch (error) {
      console.error("Could not import audio file:", error);
      setStatusMsg(t("studio.statusImportError", { name: file.name }));
    }
  };

  const deleteTrack = (id: number) => {
    if (isRecording) {
      setStatusMsg(t("studio.statusStopBeforeRemove"));
      return;
    }
    if (tracks.length <= 1) {
      setStatusMsg(t("studio.statusKeepTrack"));
      return;
    }
    setTracks((prev) => prev.filter((t) => t.id !== id));
    setTrackNotes((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    if (selectedTrackId === id) {
      const replacement = tracks.find((track) => track.id !== id);
      if (replacement) setSelectedTrackId(replacement.id);
    }
  };

  const undoTrackChanges = () => {
    const history = trackHistoryRef.current;
    const previous = history.undo.pop();
    if (!previous) return;
    history.redo.push(tracks);
    history.applying = true;
    setTracks(previous);
  };

  const redoTrackChanges = () => {
    const history = trackHistoryRef.current;
    const next = history.redo.pop();
    if (!next) return;
    history.undo.push(tracks);
    history.applying = true;
    setTracks(next);
  };

  const applyAutoMix = () => {
    if (tracks.length === 0) {
      setStatusMsg(t("studio.statusAutoMixNeedsTracks"));
      return;
    }
    const levelByCategory = { audio: 0.72, midi: 0.62, drum: 0.68 };
    setTracks((current) => current.map((track) => ({
      ...track,
      volume: levelByCategory[track.category ?? "audio"],
      pan: track.category === "midi" ? 0 : track.pan,
    })));
    setStatusMsg(t("studio.statusAutoMix"));
  };

  const quantizeTrackRegions = (trackId: number) => {
    const intervalSec = (60 / bpm / 4) * quantizeGridSteps;
    setTracks((current) => current.map((track) => track.id === trackId
      ? {
        ...track,
        regions: track.regions.map((region) => {
          const startTime = Math.max(0, Math.round(region.startTime / intervalSec) * intervalSec);
          const endTime = Math.max(startTime + intervalSec, Math.round((region.startTime + region.duration) / intervalSec) * intervalSec);
          return { ...region, startTime, duration: Math.min(region.buffer.duration - region.offset, endTime - startTime) };
        }),
      }
      : track));
    setStatusMsg(t("studio.statusAligned", { track: tracks.find((track) => track.id === trackId)?.name ?? t("studio.noTrack"), grid: quantizeGridSteps === 1 ? "1/16" : "1/8" }));
  };

  const addAutomationPoint = (
    trackId: number,
    time: number,
    normalizedValue: number
  ) => {
    const value = automationParameter === "pan" ? normalizedValue * 2 - 1 : normalizedValue;
    setTracks((current) => current.map((track) => {
      if (track.id !== trackId) return track;
      const existing = track.automation?.[automationParameter] ?? [];
      const points = [
        ...existing.filter((point) => Math.abs(point.time - time) > 0.015),
        { id: `automation-${trackId}-${Date.now()}`, time, value },
      ].sort((a, b) => a.time - b.time);
      return { ...track, automation: { ...track.automation, [automationParameter]: points } };
    }));
  };

  const removeNearestAutomationPoint = (trackId: number, time: number) => {
    setTracks((current) => current.map((track) => {
      if (track.id !== trackId) return track;
      const points = track.automation?.[automationParameter] ?? [];
      if (points.length === 0) return track;
      const nearest = points.reduce((best, point) =>
        Math.abs(point.time - time) < Math.abs(best.time - time) ? point : best
      );
      if (Math.abs(nearest.time - time) > 0.35) return track;
      return {
        ...track,
        automation: {
          ...track.automation,
          [automationParameter]: points.filter((point) => point.id !== nearest.id),
        },
      };
    }));
  };

  const applyMasterPreset = (preset: "warm" | "clear" | "loud") => {
    const presets = {
      warm: { eqEnabled: true, lowGain: 1.5, midGain: -0.5, highGain: -1, compEnabled: true, compAmount: 0.35 },
      clear: { eqEnabled: true, lowGain: -0.5, midGain: 0.8, highGain: 1.2, compEnabled: false, compAmount: 0.25 },
      loud: { eqEnabled: true, lowGain: 0.5, midGain: 0, highGain: 0.5, compEnabled: true, compAmount: 0.75 },
    };
    setMasterSettings((settings) => ({ ...settings, ...presets[preset] }));
    setMasterPreset(preset);
    setIsMasterMode(true);
    setSmartControlsOpen(true);
  };

  const openBeats = () => {
    const drumTrack = selectedTrack?.category === "drum"
      ? selectedTrack
      : tracks.find((track) => track.category === "drum");
    if (!drumTrack) {
      handleAddTrackType("drum");
      setDrumEditorOpen(true);
      setStatusMsg(t("studio.statusAddedDrums"));
      return;
    }
    setSelectedTrackId(drumTrack.id);
    setDrumEditorOpen(true);
  };

  const tapTempo = () => {
    const now = performance.now();
    const previous = tapTimes.current.at(-1);
    if (previous !== undefined && now - previous > 2000) tapTimes.current = [];
    tapTimes.current.push(now);
    tapTimes.current = tapTimes.current.slice(-5);
    if (tapTimes.current.length >= 2) {
      const intervals = tapTimes.current.slice(1).map((time, index) => time - tapTimes.current[index]);
      const average = intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;
      if (average > 0) setBpm(Math.min(300, Math.max(30, Math.round(60000 / average))));
    }
  };

  const importSoundFile = (file?: File) => {
    if (!file) return;
    const target = selectedTrack?.category === "audio"
      ? selectedTrack
      : tracks.find((track) => track.category === "audio");
    if (!target) {
      setStatusMsg(t("studio.statusImportNeedsTrack"));
      setDiscoverModalOpen(true);
      return;
    }
    void handleImportFile(file, target.id);
  };

  // Add Track from Discover Modal (Screenshot 2 functionality)
  const handleAddTrackType = (type: "vocal" | "guitar" | "bass" | "piano" | "drum", preset?: SoundPreset) => {
    if (!isPro && tracks.length >= FREE_TRACK_LIMIT) {
      setUpgradeFeature(t("studio.upgradeTracks", { count: FREE_TRACK_LIMIT }));
      return;
    }
    if (tracks.length >= 12) {
      setStatusMsg(t("studio.statusTrackLimit"));
      return;
    }
    const id = nextTrackId.current++;
    let name = t("studio.audioTrack");
    let category: "audio" | "midi" | "drum" = "audio";
    let trackType: TrackCompatibilityType = "vocal";
    let color = "bg-[#e53e3e]";

    if (type === "vocal") {
      name = `Voice ${tracks.length + 1}`;
      color = "bg-[#e53e3e]";
      trackType = "vocal";
    } else if (type === "piano") {
      name = `Piano ${tracks.length + 1}`;
      category = "midi";
      trackType = "midi";
      color = "bg-[#38a169]";
    } else if (type === "drum") {
      name = `Drums ${tracks.length + 1}`;
      category = "drum";
      trackType = "drum";
      color = "bg-[#d69e2e]";
    } else if (type === "guitar") {
      name = `Guitar ${tracks.length + 1}`;
      color = "bg-[#319795]";
      trackType = "guitar-bass";
    } else if (type === "bass") {
      name = `Bass ${tracks.length + 1}`;
      color = "bg-[#3182ce]";
      trackType = "guitar-bass";
    }

    setTracks((prev) => [
      ...prev,
      {
        id,
        name,
        category,
        trackType,
        instrument: preset?.name ?? name,
        color,
        volume: 0.8,
        pan: 0,
        mute: false,
        solo: false,
        armed: false,
        monitoring: false,
        settings: { ...DEFAULT_TRACK_SETTINGS, ...preset?.processing },
        ampSettings: { ...DEFAULT_AMP_SETTINGS, ...preset?.amp },
        ampEnabled: Boolean(preset?.amp),
        regions: [],
        midiNotes: [],
        ...(type === "drum" ? { drumPattern: { ...DEFAULT_DRUM_PATTERN, ...preset?.drums } } : {}),
        ...(type === "piano" ? { synthSettings: { ...DEFAULT_SYNTH_SETTINGS, ...preset?.synth } } : {}),
      },
    ]);
    if (category === "midi") setTrackNotes((prev) => ({ ...prev, [id]: [] }));
    setSelectedTrackId(id);
  };

  const getProjectTracks = (): ExtendedTrackData[] =>
    tracks.map((track) => ({ ...track, midiNotes: trackNotes[track.id] ?? track.midiNotes ?? [] }));

  const getProjectMeta = () => ({
    projectName,
    bpm,
    key: projectKey,
    scale: projectScale,
    masterVolume,
    masterSettings,
    isLooping,
    loopStartSec,
    loopEndSec,
    timeSignature,
    lyricsNotes,
    sections,
    buses,
    masterAutomation,
    scenes,
  });

  const saveProject = async () => {
    if (isRecording) {
      setStatusMsg(t("studio.statusStopBeforeSave"));
      return;
    }
    try {
      await saveSessionFile(getProjectMeta(), getProjectTracks(), projectName);
      setStatusMsg(t("studio.statusSavedLocal", { name: projectName || t("studio.newProject") }));
    } catch (error) {
      console.error("Could not save studio session:", error);
      setStatusMsg(error instanceof Error ? t("studio.statusSaveDetail", { detail: error.message }) : t("studio.statusSaveError"));
    }
  };

  const loadProject = async (file?: File, fromSharedProject = false): Promise<boolean> => {
    if (!file) return false;
    if (isRecording) {
      setStatusMsg(t("studio.statusStopBeforeOpen"));
      return false;
    }
    try {
      if (!fromSharedProject && sharedProjectId) {
        if (hasEditLease) await releaseSharedProject();
        setSharedProjectId(null);
        setSharedRevision(0);
        setSharedProjectIsOwner(false);
        setHasEditLease(false);
        setEditLockOwnerId(null);
        setEditLockExpiresAt(null);
      }
      handleStop();
      const { meta, tracks: loadedTracks } = await openSessionFile(file, engine.current.init());
      const nextTracks = loadedTracks.map((track) => ({
        ...track,
        trackType: track.category === "midi" ? "midi" as const
          : track.category === "drum" ? "drum" as const
          : track.name.toLowerCase().includes("guitar") || track.name.toLowerCase().includes("bass") ? "guitar-bass" as const
          : "vocal" as const,
        inputDevice: typeof track.inputDevice === "string" ? track.inputDevice : undefined,
        monitoring: typeof track.monitoring === "boolean" ? track.monitoring : false,
        settings: track.settings ?? { ...DEFAULT_TRACK_SETTINGS },
        synthSettings: track.synthSettings ?? (track.category === "midi" ? { ...DEFAULT_SYNTH_SETTINGS } : undefined),
        ampSettings: track.ampSettings ?? { ...DEFAULT_AMP_SETTINGS },
        ampEnabled: track.ampEnabled ?? false,
      }));
      setTracks(nextTracks);
      nextTrackId.current = Math.max(1, ...nextTracks.map((track) => track.id + 1));
      setTrackNotes(Object.fromEntries(nextTracks.map((track) => [track.id, track.midiNotes ?? []])));
      if (nextTracks[0]) setSelectedTrackId(nextTracks[0].id);
      setIsMasterMode(false);
      setCopiedClip(null);
      setProjectName(typeof meta.projectName === "string" ? meta.projectName : file.name.replace(/\.artistpilot$/i, ""));
      setBpm(typeof meta.bpm === "number" ? Math.min(300, Math.max(30, meta.bpm)) : defaultBpm);
      setProjectKey(typeof meta.key === "string" && KEYS.includes(meta.key) ? meta.key : "C");
      setProjectScale(meta.scale === "min" ? "min" : "maj");
      setTimeSignature(meta.timeSignature === "3/4" || meta.timeSignature === "6/8" ? meta.timeSignature : "4/4");
      setLyricsNotes(typeof meta.lyricsNotes === "string" ? meta.lyricsNotes : "");
      setMasterVolume(typeof meta.masterVolume === "number" ? Math.min(1, Math.max(0, meta.masterVolume)) : 0.85);
      setMasterSettings(parseProcessingSettings(meta.masterSettings) ?? { ...DEFAULT_TRACK_SETTINGS });
      setSections(parseArrangerSections(meta.sections));
      setBuses(parseMixerBuses(meta.buses));
      setMasterAutomation(parseMasterAutomation(meta.masterAutomation));
      setScenes(parseStudioScenes(meta.scenes));
      setIsLooping(meta.isLooping === true);
      const loadedLoopStart = typeof meta.loopStartSec === "number" && Number.isFinite(meta.loopStartSec)
        ? Math.max(0, meta.loopStartSec)
        : 0;
      const loadedLoopEnd = typeof meta.loopEndSec === "number" && Number.isFinite(meta.loopEndSec)
        ? Math.max(0, meta.loopEndSec)
        : 8;
      setLoopStartSec(loadedLoopStart);
      setLoopEndSec(Math.max(loadedLoopStart + 0.5, loadedLoopEnd));
      setPlayheadSec(0);
      setStatusMsg(t("studio.statusOpened", { name: file.name }));
      return true;
    } catch (error) {
      console.error("Could not open studio session:", error);
      setStatusMsg(error instanceof Error ? t("studio.statusOpenDetail", { detail: error.message }) : t("studio.statusOpenError"));
      return false;
    }
  };

  const createSharedProject = async () => {
    if (isRecording) throw new Error("Stop recording before sharing this project.");
    const fileBlob = await serializeSessionFile(getProjectMeta(), getProjectTracks());
    const form = new FormData();
    form.set("action", "create");
    form.set("name", projectName.trim() || "Untitled Studio Project");
    form.set("file", new File([fileBlob], `${projectName.trim() || "studio-project"}.artistpilot`, {
      type: "application/octet-stream",
    }));
    const response = await fetch("/api/studio/shared", { method: "POST", body: form });
    const result = await response.json() as { projectId?: string; revision?: number; lockExpiresAt?: string; error?: string };
    if (!response.ok || !result.projectId) throw new Error(result.error ?? "Could not share this Studio project.");
    setSharedProjectId(result.projectId);
    setSharedRevision(Number(result.revision) || 1);
    setSharedProjectIsOwner(true);
    setHasEditLease(true);
    setEditLockOwnerId(null);
    setEditLockExpiresAt(result.lockExpiresAt ?? null);
    setStatusMsg(t("studio.statusSharedCreated"));
  };

  const saveSharedProject = async () => {
    if (!sharedProjectId || !hasEditLease) throw new Error("Take the edit lock before saving a shared revision.");
    if (isRecording) throw new Error("Stop recording before saving a shared revision.");
    const fileBlob = await serializeSessionFile(getProjectMeta(), getProjectTracks());
    const form = new FormData();
    form.set("action", "save");
    form.set("projectId", sharedProjectId);
    form.set("expectedRevision", String(sharedRevision));
    form.set("name", projectName.trim() || "Untitled Studio Project");
    form.set("file", new File([fileBlob], `${projectName.trim() || "studio-project"}.artistpilot`, {
      type: "application/octet-stream",
    }));
    const response = await fetch("/api/studio/shared", { method: "POST", body: form });
    const result = await response.json() as { revision?: number; error?: string };
    if (!response.ok || typeof result.revision !== "number") throw new Error(result.error ?? "Could not save the shared project revision.");
    setSharedRevision(result.revision);
    setStatusMsg(t("studio.statusSharedSaved", { revision: result.revision }));
  };

  const claimSharedProject = async (targetProjectId = sharedProjectId) => {
    if (!targetProjectId) return;
    const form = new FormData();
    form.set("action", "claim");
    form.set("projectId", targetProjectId);
    const response = await fetch("/api/studio/shared", { method: "POST", body: form });
    const payload = await response.json() as {
      result?: { acquired?: boolean; editorId?: string | null; expiresAt?: string | null };
      error?: string;
    };
    if (!response.ok || !payload.result) throw new Error(payload.error ?? "Could not take the shared project edit lock.");
    const lock = payload.result;
    setHasEditLease(lock.acquired === true);
    setEditLockOwnerId(lock.editorId ?? null);
    setEditLockExpiresAt(lock.expiresAt ?? null);
    if (!lock.acquired) throw new Error("Another collaborator currently holds the edit lock.");
  };

  const releaseSharedProject = async () => {
    if (!sharedProjectId) return;
    const form = new FormData();
    form.set("action", "release");
    form.set("projectId", sharedProjectId);
    const response = await fetch("/api/studio/shared", { method: "POST", body: form });
    const payload = await response.json() as { result?: boolean; error?: string };
    if (!response.ok) throw new Error(payload.error ?? "Could not release the shared project edit lock.");
    setHasEditLease(false);
    setEditLockOwnerId(null);
    setEditLockExpiresAt(null);
  };

  const loadSharedProject = async (projectId: string) => {
    if (isRecording) throw new Error("Stop recording before opening another project.");
    const response = await fetch(`/api/studio/shared?id=${encodeURIComponent(projectId)}`, { cache: "no-store" });
    if (!response.ok) {
      const result = await response.json() as { error?: string };
      throw new Error(result.error ?? "Could not open the shared Studio project.");
    }
    const name = decodeURIComponent(response.headers.get("X-Studio-Project-Name") ?? "Shared Studio Project");
    const blob = await response.blob();
    const file = new File([blob], `${name}.artistpilot`, { type: "application/octet-stream" });
    if (!await loadProject(file, true)) throw new Error("The shared Studio project could not be loaded.");
    setProjectName(name);
    setSharedProjectId(projectId);
    setSharedRevision(Number(response.headers.get("X-Studio-Project-Revision")) || 1);
    setSharedProjectIsOwner(response.headers.get("X-Studio-Project-Is-Owner") === "true");
    setEditLockOwnerId(response.headers.get("X-Studio-Edit-Owner") || null);
    setEditLockExpiresAt(response.headers.get("X-Studio-Edit-Expires") || null);
    setHasEditLease(false);
    try {
      await claimSharedProject(projectId);
    } catch (error) {
      if (error instanceof Error && error.message === "Another collaborator currently holds the edit lock.") {
        setStatusMsg(t("studio.statusLockHeld"));
        return;
      }
      throw error;
    }
  };
  sharedProjectLoaderRef.current = loadSharedProject;

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("invite");
    if (!token) return;
    let cancelled = false;
    const acceptInvite = async () => {
      const form = new FormData();
      form.set("action", "accept");
      form.set("token", token);
      const response = await fetch("/api/studio/shared", { method: "POST", body: form });
      const result = await response.json() as { projectId?: string; error?: string };
      if (!response.ok || !result.projectId) throw new Error(result.error ?? "Could not accept this Studio invitation.");
      if (cancelled) return;
      params.delete("invite");
      const query = params.toString();
      window.history.replaceState({}, "", `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`);
      await sharedProjectLoaderRef.current(result.projectId);
    };
    void acceptInvite().catch((error: unknown) => {
      if (!cancelled) setStatusMsg(error instanceof Error ? error.message : t("studio.statusInvitationError"));
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!sharedProjectId || !hasEditLease) return;
    const interval = window.setInterval(() => {
      void (async () => {
        const form = new FormData();
        form.set("action", "claim");
        form.set("projectId", sharedProjectId);
        const response = await fetch("/api/studio/shared", { method: "POST", body: form });
        const payload = await response.json() as {
          result?: { acquired?: boolean; editorId?: string | null; expiresAt?: string | null };
          error?: string;
        };
        if (!response.ok || !payload.result || !payload.result.acquired) {
          setHasEditLease(false);
          setEditLockOwnerId(payload.result?.editorId ?? null);
          setEditLockExpiresAt(payload.result?.expiresAt ?? null);
          setStatusMsg(payload.error ?? t("studio.statusLockLost"));
          return;
        }
        setEditLockOwnerId(payload.result.editorId ?? null);
        setEditLockExpiresAt(payload.result.expiresAt ?? null);
      })().catch((error: unknown) => {
        setHasEditLease(false);
        setStatusMsg(error instanceof Error ? t("studio.statusLockDetail", { detail: error.message }) : t("studio.statusLockError"));
      });
    }, 60_000);
    return () => window.clearInterval(interval);
  }, [sharedProjectId, hasEditLease]);

  const exportProject = async () => {
    if (!isPro) {
      setUpgradeFeature(t("studio.upgradeExport"));
      return;
    }
    if (isExporting) return;
    if (isRecording) {
      setStatusMsg(t("studio.statusStopBeforeExport"));
      return;
    }
    setIsExporting(true);
    setStatusMsg(t("studio.statusRenderingMix"));
    try {
      const blob = await engine.current.exportMasterWav(
        getProjectTracks(),
        projectDuration + 1,
        bpm,
        masterVolume,
        masterSettings,
        buses,
        masterAutomation
      );
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${projectName.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "artistpilot-project"}.wav`;
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 5000);
      setStatusMsg(t("studio.statusExportedMix"));
    } catch (error) {
      console.error("Could not export studio mixdown:", error);
      setStatusMsg(error instanceof Error ? t("studio.statusWavExportDetail", { detail: error.message }) : t("studio.statusWavExportError"));
    } finally {
      setIsExporting(false);
    }
  };

  const exportStems = async () => {
    if (!isPro) {
      setUpgradeFeature(t("studio.upgradeStems"));
      return;
    }
    if (isExportingStems || isExporting) return;
    if (isRecording) {
      setStatusMsg(t("studio.statusStopBeforeStems"));
      return;
    }
    const exportableTracks = getProjectTracks().filter((track) =>
      track.regions.length > 0 || (track.midiNotes?.length ?? 0) > 0 || track.category === "drum"
    );
    if (exportableTracks.length === 0) {
      setStatusMsg(t("studio.statusNoStems"));
      return;
    }
    setIsExportingStems(true);
    setStatusMsg(t("studio.statusRenderingStems", { count: exportableTracks.length }));
    try {
      const duration = projectDuration + 1;
      for (const [index, track] of exportableTracks.entries()) {
        const stemTrack = { ...track, mute: false, solo: false };
        const blob = await engine.current.exportMasterWav([stemTrack], duration, bpm, 1, undefined, buses, []);
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = `${projectName.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "artistpilot-project"}-${track.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || `track-${index + 1}`}.wav`;
        anchor.click();
        window.setTimeout(() => URL.revokeObjectURL(url), 10000);
        await new Promise((resolve) => window.setTimeout(resolve, 150));
      }
      setStatusMsg(t("studio.statusExportedStems", { count: exportableTracks.length }));
    } catch (error) {
      console.error("Could not export studio stems:", error);
      setStatusMsg(error instanceof Error ? t("studio.statusStemsExportDetail", { detail: error.message }) : t("studio.statusStemsExportError"));
    } finally {
      setIsExportingStems(false);
    }
  };

  const addMidiNote = (note: MidiNote) => {
    const next = [...(trackNotes[selectedTrackId] ?? []), note];
    setTrackNotes((prev) => ({ ...prev, [selectedTrackId]: next }));
    setTracks((prev) => prev.map((track) => track.id === selectedTrackId ? { ...track, midiNotes: next } : track));
  };

  const deleteMidiNote = (noteId: string) => {
    const next = (trackNotes[selectedTrackId] ?? []).filter((note) => note.id !== noteId);
    setTrackNotes((prev) => ({ ...prev, [selectedTrackId]: next }));
    setTracks((prev) => prev.map((track) => track.id === selectedTrackId ? { ...track, midiNotes: next } : track));
  };

  const updateMidiNotes = (next: MidiNote[]) => {
    setTrackNotes((prev) => ({ ...prev, [selectedTrackId]: next }));
    setTracks((prev) => prev.map((track) => track.id === selectedTrackId ? { ...track, midiNotes: next } : track));
  };

  const previewMidiNote = (pitch: number) => {
    const ctx = engine.current.init();
    const piano = PianoEngine.getInstance();
    piano.noteOn(ctx, pitch, 100, undefined, engine.current.masterGain ?? undefined, selectedTrack?.synthSettings ?? DEFAULT_SYNTH_SETTINGS);
    window.setTimeout(() => piano.noteOff(ctx, pitch), 250);
  };

  const handlePianoMidiNote = (pitch: number, velocity: number, isNoteOn: boolean) => {
    if (selectedTrack?.category !== "midi") return;
    const step = Math.max(0, Math.round(playheadSec / (60 / Math.max(1, bpm) / 4)));
    if (isNoteOn) {
      const id = `keyboard-${Date.now()}-${pitch}-${Math.random().toString(36).slice(2, 7)}`;
      activeMidiInputNotes.current[pitch] = { id, startStep: step };
      const note: MidiNote = { id, pitch, startStep: step, length: 1, velocity };
      const next = [...(trackNotes[selectedTrack.id] ?? []), note];
      setTrackNotes((prev) => ({ ...prev, [selectedTrack.id]: next }));
      setTracks((prev) => prev.map((track) => track.id === selectedTrack.id ? { ...track, midiNotes: next } : track));
    } else {
      const active = activeMidiInputNotes.current[pitch];
      if (!active) return;
      delete activeMidiInputNotes.current[pitch];
      const duration = Math.max(1, step - active.startStep);
      const next = (trackNotes[selectedTrack.id] ?? []).map((note) =>
        note.id === active.id ? { ...note, length: duration } : note
      );
      setTrackNotes((prev) => ({ ...prev, [selectedTrack.id]: next }));
      setTracks((prev) => prev.map((track) => track.id === selectedTrack.id ? { ...track, midiNotes: next } : track));
    }
  };

  const handleLaneDrop = (event: React.DragEvent<HTMLDivElement>, trackId: number) => {
    event.preventDefault();
    const droppedFile = event.dataTransfer.files[0];
    if (droppedFile) {
      const rect = event.currentTarget.getBoundingClientRect();
      const at = Math.max(0, (event.clientX - rect.left + (timelineContainerRef.current?.scrollLeft ?? 0)) / pixelsPerSecond);
      void handleImportFile(droppedFile, trackId, at);
      return;
    }
    const sourceTrackId = Number(event.dataTransfer.getData("sourceTrackId"));
    const regionId = event.dataTransfer.getData("regionId");
    if (!Number.isFinite(sourceTrackId) || !regionId) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const at = Math.max(0, (event.clientX - rect.left + (timelineContainerRef.current?.scrollLeft ?? 0)) / pixelsPerSecond);
    setTracks((prev) => {
      const region = prev.find((track) => track.id === sourceTrackId)?.regions.find((item) => item.id === regionId);
      if (!region) return prev;
      return prev.map((track) => {
        if (track.id === sourceTrackId && sourceTrackId !== trackId) {
          return { ...track, regions: track.regions.filter((item) => item.id !== regionId) };
        }
        if (track.id === trackId) {
          const existing = track.regions.filter((item) => item.id !== regionId);
          return { ...track, regions: [...existing, { ...region, startTime: at }] };
        }
        return track;
      });
    });
  };

  const selectedTrack = tracks.find((t) => t.id === selectedTrackId);
  const applySoundPreset = (preset: SoundPreset) => {
    const matchesPresetTrack = (track: ExtendedTrackData | undefined) => {
      if (!track) return false;
      if (preset.category === "vocals") return track.trackType === "vocal";
      if (preset.category === "guitar") return track.trackType === "guitar-bass" && track.name.toLowerCase().includes("guitar");
      if (preset.category === "bass") return track.trackType === "guitar-bass" && track.name.toLowerCase().includes("bass");
      if (preset.category === "keys") return track.category === "midi";
      return track.category === "drum";
    };
    const target = matchesPresetTrack(selectedTrack)
      ? selectedTrack
      : tracks.find(matchesPresetTrack);
    if (!target) {
      const trackType = preset.category === "vocals" ? "vocal"
        : preset.category === "guitar" ? "guitar"
        : preset.category === "bass" ? "bass"
        : preset.category === "keys" ? "piano"
        : "drum";
      handleAddTrackType(trackType, preset);
      setStatusMsg(t("studio.statusPresetTrack", { category: t(`sound.${preset.category}`), name: preset.name }));
      return;
    }
    setSelectedTrackId(target.id);
    setIsMasterMode(false);
    setTracks((current) => current.map((track) => track.id !== target.id ? track : ({
      ...track,
      instrument: preset.name,
      settings: { ...track.settings, ...preset.processing },
      ...(preset.amp ? { ampSettings: { ...track.ampSettings, ...preset.amp }, ampEnabled: true } : {}),
      ...(preset.synth ? { synthSettings: { ...DEFAULT_SYNTH_SETTINGS, ...track.synthSettings, ...preset.synth } } : {}),
      ...(preset.drums ? { drumPattern: { ...DEFAULT_DRUM_PATTERN, ...track.drumPattern, ...preset.drums } } : {}),
    })));
    setStatusMsg(t("studio.statusPresetApplied", { preset: preset.name, track: target.name }));
  };
  const [meterNumerator, meterDenominator] = timeSignature.split("/").map(Number);
  const beatSeconds = (60 / bpm) * (4 / meterDenominator);
  const totalBeats = playheadSec / beatSeconds;
  const currentBar = Math.floor(totalBeats / meterNumerator) + 1;
  const currentBeat = (Math.floor(totalBeats) % meterNumerator) + 1;

  // Format time as BandLab mm:ss.ms (e.g. 00:00.0)
  const formatTimecode = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const secs = Math.floor(sec % 60);
    const ms = Math.floor((sec % 1) * 10);
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}.${ms}`;
  };
  const activeSettings = isMasterMode ? masterSettings : selectedTrack?.settings ?? DEFAULT_TRACK_SETTINGS;
  const masterDb = masterVolume <= 0 ? "-∞" : (20 * Math.log10(masterVolume)).toFixed(1);
  const barWidth = (meterNumerator * beatSeconds * pixelsPerSecond);
  const timelineWidth = Math.max(3200, projectDuration * pixelsPerSecond + 200, barWidth * 64);
  const barCount = Math.ceil(timelineWidth / barWidth);

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden bg-[#0c0d0f] text-[#c5c7d0] font-sans select-none">
      <input
        ref={fileInputRef}
        type="file"
        accept=".artistpilot"
        className="hidden"
        onChange={(event) => {
          void loadProject(event.target.files?.[0]);
          event.currentTarget.value = "";
        }}
      />
      <input
        ref={soundInputRef}
        type="file"
        accept="audio/*,.wav,.mp3,.m4a,.ogg,.webm"
        className="hidden"
        onChange={(event) => {
          importSoundFile(event.target.files?.[0]);
          event.currentTarget.value = "";
        }}
      />
      
      {/* 1. BANDLAB-STYLE MODERN TOP TRANSPORT BAR (Screenshot 1) */}
      <header
        tabIndex={0}
        aria-label={t("studio.transportAria")}
        className="flex h-11 flex-none items-center gap-4 overflow-x-auto overscroll-x-contain border-b border-[#1c1d22] bg-[#121316] px-2 shadow-md z-30 focus-visible:outline focus-visible:outline-1 focus-visible:outline-sky-500"
      >
        
        {/* Left: Brand / Project Name & Metronome */}
        <div className="flex flex-none items-center gap-2 whitespace-nowrap">
          <div className="flex gap-1" data-history-version={historyVersion}>
            <button
              onClick={undoTrackChanges}
              disabled={trackHistoryRef.current.undo.length === 0}
              aria-label={t("studio.undo")}
              title={t("studio.undoChange", { count: trackHistoryRef.current.undo.length })}
              className="flex h-7 items-center gap-1 rounded bg-[#20222a] px-1.5 text-[10px] text-zinc-200 hover:bg-zinc-700 disabled:opacity-30"
            ><span aria-hidden="true">↶</span> {t("studio.undo")}</button>
            <button
              onClick={redoTrackChanges}
              disabled={trackHistoryRef.current.redo.length === 0}
              aria-label={t("studio.redo")}
              title={t("studio.redoChange")}
              className="flex h-7 items-center gap-1 rounded bg-[#20222a] px-1.5 text-[10px] text-zinc-200 hover:bg-zinc-700 disabled:opacity-30"
            ><span aria-hidden="true">↷</span> {t("studio.redo")}</button>
          </div>
          <button
            onClick={() => setDiscoverModalOpen(true)}
            className="flex h-7 items-center gap-1 rounded-lg bg-[#24262e] border border-zinc-700/80 px-2 text-[11px] font-bold text-white hover:border-red-500 hover:text-white transition shadow-sm"
          >
            <span>+</span> {t("studio.addTrack")}
          </button>
          <button
            onClick={() => setWelcomeOpen(true)}
            className="h-7 rounded bg-[#20222a] px-2 text-[10px] font-semibold text-zinc-300 hover:bg-zinc-700 hover:text-white"
            title={t("studio.titleOpenGuide")}
          >
            {t("studio.openGuide")}
          </button>

          <input
            aria-label={t("studio.projectNameAria")}
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            className="w-36 bg-transparent text-xs font-bold text-white focus:outline-none rounded px-1.5 py-0.5 truncate"
          />

          <div className="h-4 w-[1px] bg-zinc-800" />
          <button onClick={() => void saveProject()} className="rounded bg-[#20222a] px-2 py-1 text-[10px] font-semibold text-zinc-200 hover:bg-zinc-700">{t("studio.save")}</button>
          <button onClick={() => fileInputRef.current?.click()} className="rounded bg-[#20222a] px-2 py-1 text-[10px] font-semibold text-zinc-200 hover:bg-zinc-700">{t("studio.open")}</button>
          <button onClick={() => (isPro ? setCollaborationOpen(true) : setUpgradeFeature(t("studio.upgradeCollab")))} className="rounded bg-amber-900/60 px-2 py-1 text-[10px] font-semibold text-amber-200 hover:bg-amber-800">{t("studio.collaborate")}</button>
          <button onClick={() => setBusPanelOpen(true)} className="rounded bg-[#20222a] px-2 py-1 text-[10px] font-semibold text-zinc-200 hover:bg-zinc-700">{t("studio.buses")}</button>

          {/* Metronome & Count-In Pill */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setMetronomeActive(!metronomeActive)}
              className={`h-7 px-2.5 rounded-lg text-xs font-bold transition flex items-center gap-1 ${
                metronomeActive ? "bg-amber-500/20 text-amber-300 border border-amber-500/60" : "bg-[#1c1d24] text-zinc-400 hover:text-white"
              }`}
              title={t("studio.metronome")}
            >
              <BellIcon className="h-4 w-4" />
            </button>
            <button
              onClick={() => setCountInActive(!countInActive)}
              className={`h-7 px-2.5 rounded-lg text-[11px] font-bold transition ${
                countInActive ? "bg-amber-600 text-white shadow" : "bg-[#1c1d24] text-zinc-500"
              }`}
              title={t("studio.countIn", { beats: meterNumerator })}
            >
              {Array.from({ length: meterNumerator }, (_, index) => index + 1).join("")}
            </button>
          </div>
        </div>

        {/* Center: BandLab Tempo, Time Signature, Key, Transport, Timecode */}
        <div className="flex flex-none items-center gap-2 whitespace-nowrap">
          {/* BPM Box */}
          <div className="flex items-center gap-1 rounded-lg border border-zinc-800 bg-[#1a1b22] px-1.5 py-0.5 text-[11px]">
            <input
              type="number"
              aria-label={t("studio.tempoAria")}
              value={bpm}
              min={30}
              max={300}
              onChange={(e) => setBpm(Math.min(300, Math.max(30, Number(e.target.value) || 120)))}
              className="w-8 bg-transparent text-xs font-bold text-white focus:outline-none"
            />
            <span className="text-[9px] text-zinc-500">{t("studio.bpm")}</span>
          </div>
          <button
            onClick={tapTempo}
            className="rounded-lg border border-zinc-800 bg-[#1a1b22] px-2 py-1 text-[10px] font-bold text-zinc-300 hover:bg-zinc-700 hover:text-white"
            title={t("studio.tapTempoHelp")}
          >
            {t("studio.tap")}
          </button>

          {/* 4 / 4 Time Signature */}
          <select
            aria-label={t("studio.timeSignature")}
            value={timeSignature}
            onChange={(event) => setTimeSignature(event.target.value as typeof timeSignature)}
            className="bg-[#1a1b22] px-2 py-1 rounded-lg border border-zinc-800 text-xs font-bold text-zinc-300"
          >
            <option value="3/4">3 / 4</option>
            <option value="4/4">4 / 4</option>
            <option value="6/8">6 / 8</option>
          </select>

          {/* Key Pill (e.g. D♭ maj) */}
          <div className="flex items-center gap-1 rounded-lg border border-zinc-800 bg-[#1a1b22] px-1.5 py-0.5 text-[11px]">
            <select
              value={projectKey}
              onChange={(e) => setProjectKey(e.target.value)}
              className="bg-transparent text-xs font-bold text-white focus:outline-none cursor-pointer"
            >
              {KEYS.map((k) => (
                <option key={k} value={k} className="bg-zinc-900 text-white">{k}</option>
              ))}
            </select>
            <button
              onClick={() => setProjectScale(projectScale === "maj" ? "min" : "maj")}
              className="font-bold text-zinc-400 hover:text-white text-[11px]"
            >
              {t(projectScale === "maj" ? "music.majorShort" : "music.minorShort")}
            </button>
          </div>

          {/* Authentic Vector Transport Controls */}
          <div className="ml-1 flex items-center gap-1 text-zinc-300">
            <button
              onClick={() => handlePlay()}
              className={`h-8 w-10 rounded-lg font-bold flex items-center justify-center transition shadow ${
                isPlaying ? "bg-amber-500 text-black" : "bg-[#24262e] text-white hover:bg-zinc-700"
              }`}
              title={t("studio.playPause")}
            >
              {isPlaying ? <PauseIcon className="w-3.5 h-3.5 fill-current" /> : <PlayIcon className="w-3.5 h-3.5 fill-current" />}
            </button>

            <button
              onClick={() => { handleStop(); setPlayheadSec(0); }}
              className="h-8 w-8 rounded-lg flex items-center justify-center bg-[#1a1b22] hover:bg-zinc-700 text-zinc-400 hover:text-white transition"
              title={t("studio.returnStart")}
            >
              <RewindIcon className="w-3.5 h-3.5 fill-current" />
            </button>

            <button
              onClick={handleRecord}
              className={`h-8 w-8 rounded-full flex items-center justify-center ml-1 transition ${
                isRecording ? "bg-red-500 animate-pulse text-white shadow-[0_0_12px_#ef4444]" : "bg-[#e53e3e] hover:bg-red-600 text-white"
              }`}
              title={t("studio.record")}
            >
              <div className="h-3 w-3 rounded-full bg-white shadow-sm" />
            </button>

            <button
              onClick={() => setIsLooping(!isLooping)}
              className={`h-8 w-8 rounded-lg flex items-center justify-center ml-1 transition ${
                isLooping ? "bg-amber-500/25 text-amber-300 border border-amber-500/60" : "bg-[#1a1b22] text-zinc-400 hover:text-white"
              }`}
              title={t("studio.toggleLoop")}
            >
              <LoopIcon className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Timecode Clock (e.g. 00:00.0) */}
          <div className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-[#1a1b22] px-2 py-1 text-[11px] font-mono font-bold text-zinc-200">
            <span>{formatTimecode(playheadSec)}</span>
            <span className="text-[9px] text-zinc-500">{t("studio.barBeat", { bar: currentBar, beat: currentBeat })}</span>
          </div>
        </div>

        {/* Right: Master Output Volume Fader with +0.0 dB readout & Export */}
        <div className="ml-auto flex flex-none items-center gap-2 whitespace-nowrap">
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-zinc-400">{t("studio.volume").toUpperCase()}</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={masterVolume}
              onChange={(e) => setMasterVolume(Number(e.target.value))}
              className="w-20 accent-sky-400 h-1 bg-zinc-800 rounded cursor-pointer"
            />
            <span className="w-10 text-[10px] font-mono text-zinc-400">{masterDb} dB</span>
          </div>

          <select
            aria-label={t("studio.masterPreset")}
            value={masterPreset}
            onChange={(event) => {
              const preset = event.target.value as typeof masterPreset;
              if (preset === "custom") {
                setMasterSettings({ ...DEFAULT_TRACK_SETTINGS });
                setMasterPreset("custom");
              } else {
                applyMasterPreset(preset);
              }
            }}
            className="h-8 rounded-lg border border-zinc-700 bg-[#20222a] px-2 text-[10px] font-semibold text-zinc-200"
          >
            <option value="custom">{t("studio.mastering")}</option>
            <option value="warm">{t("studio.warm")}</option>
            <option value="clear">{t("studio.clear")}</option>
            <option value="loud">{t("studio.loud")}</option>
          </select>

          <div className="flex items-center gap-1">
            <button
              onClick={() => void exportProject()}
              disabled={isExporting || isExportingStems}
              className="h-7 rounded-lg bg-zinc-900 px-2.5 text-[11px] font-bold text-white shadow  active:scale-95 transition disabled:cursor-wait disabled:opacity-60"
            >
              {isExporting ? t("studio.rendering") : t("studio.exportMix")}
            </button>
            <button
              onClick={() => void exportStems()}
              disabled={isExporting || isExportingStems}
              className="h-7 rounded-lg border border-zinc-700 bg-[#20222a] px-2 text-[9px] font-semibold text-zinc-200 hover:bg-zinc-700 disabled:cursor-wait disabled:opacity-60"
            >
              {isExportingStems ? `${t("studio.stems")}…` : t("studio.stems")}
            </button>
          </div>
        </div>
      </header>

      {statusMsg && (
        <div className="flex-none bg-[#161820] py-1 text-center text-[11px] text-sky-400 border-b border-zinc-800">
          {statusMsg}
        </div>
      )}

      {/* 2. BODY ARRANGEMENT VIEW */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        
        {/* Track Headers (Left Column) */}
        <div className="w-56 flex-none border-r border-[#1a1b20] bg-[#121316] flex flex-col z-10 shadow-lg">
          <div
            tabIndex={0}
            aria-label={t("studio.tracksAria")}
            className="h-7 w-full min-w-0 flex-none overflow-x-auto border-b border-[#1a1b20] px-2 font-bold text-zinc-400 text-[9px]"
          >
            <div className="flex w-max min-w-full items-center justify-between gap-2">
            <span className="flex-none whitespace-nowrap">{t("studio.trackCount", { count: tracks.length })}</span>
            <div className="flex flex-none items-center gap-1 font-normal">
              <button
                onClick={applyAutoMix}
                className="rounded bg-sky-900/40 px-1.5 py-0.5 text-[9px] text-sky-300 hover:bg-sky-800/60"
                title={t("studio.titleAutoMix")}
              >
                {t("studio.autoMix")}
              </button>
              <button
                onClick={() => setIsSnapEnabled((enabled) => !enabled)}
                aria-pressed={isSnapEnabled}
                title={t("studio.titleSnap")}
                className={`rounded px-1.5 py-0.5 text-[9px] ${isSnapEnabled ? "bg-amber-500/20 text-amber-300" : "text-zinc-500 hover:text-white"}`}
              >
                {t("studio.snap")} {isSnapEnabled ? t("studio.on") : t("studio.off")}
              </button>
              <select
                aria-label={t("studio.quantizeGrid")}
                value={quantizeGridSteps}
                onChange={(event) => setQuantizeGridSteps(Number(event.target.value))}
                className="rounded border border-zinc-700 bg-[#17181f] px-1 py-0.5 text-[9px] text-zinc-300"
              >
                <option value={1}>1/16</option>
                <option value={2}>1/8</option>
              </select>
              <button
                onClick={() => quantizeTrackRegions(selectedTrackId)}
                disabled={!selectedTrack?.regions.length}
                className="rounded bg-amber-900/40 px-1.5 py-0.5 text-[9px] text-amber-300 hover:bg-amber-800/60 disabled:opacity-30"
                title={t("studio.titleAlign")}
              >
                {t("studio.align")}
              </button>
              <button
                onClick={() => joinAdjacentRegions(selectedTrackId)}
                disabled={!selectedTrack?.regions || selectedTrack.regions.length < 2}
                className="rounded bg-emerald-900/40 px-1.5 py-0.5 text-[9px] text-emerald-300 hover:bg-emerald-800/60 disabled:opacity-30"
                title={t("studio.titleJoin")}
              >
                {t("studio.join")}
              </button>
              <button
                onClick={() => setIsAutomationMode((active) => !active)}
                aria-pressed={isAutomationMode}
                className={`rounded px-1.5 py-0.5 text-[9px] ${isAutomationMode ? "bg-fuchsia-500/20 text-fuchsia-300" : "text-zinc-500 hover:text-white"}`}
              >
                Automation
              </button>
              {isAutomationMode && (
                <select
                  aria-label={t("studio.automationParameter")}
                  value={automationParameter}
                  onChange={(event) => setAutomationParameter(event.target.value as typeof automationParameter)}
                  className="rounded border border-zinc-700 bg-[#17181f] px-1 py-0.5 text-[9px] text-zinc-300"
                >
                  <option value="volume">{t("studio.volume")}</option>
                  <option value="pan">{t("studio.pan")}</option>
                  <option value="reverbSend">{t("studio.reverb")}</option>
                </select>
              )}
              <button onClick={() => setPixelsPerSecond((value) => Math.max(25, value - 5))} aria-label={t("studio.zoomOut")} className="rounded px-1 text-sm hover:bg-zinc-800">−</button>
              <span>{pixelsPerSecond}px/s</span>
              <button onClick={() => setPixelsPerSecond((value) => Math.min(100, value + 5))} aria-label={t("studio.zoomIn")} className="rounded px-1 text-sm hover:bg-zinc-800">+</button>
            </div>
            </div>
          </div>

          <div className="flex h-9 flex-none items-center justify-between border-b border-[#1a1b20] bg-[#101116] px-2">
            <span className="text-[9px] font-bold tracking-wide text-zinc-500">{t("studio.arranger")}</span>
            <button
              onClick={addArrangerSection}
              className="rounded bg-zinc-800 px-2 py-1 text-[9px] font-semibold text-zinc-200 hover:bg-zinc-700"
              title={t("studio.sectionTitle")}
            >
              {t("studio.addSection")}
            </button>
          </div>

          <div
            ref={trackHeaderRowsRef}
            onScroll={(event) => {
              if (timelineRowsRef.current) timelineRowsRef.current.scrollTop = event.currentTarget.scrollTop;
            }}
            className="flex-1 min-h-0 overflow-y-auto divide-y divide-[#171820]"
          >
            {tracks.length === 0 && (
              <div className="flex min-h-48 flex-col items-center justify-center gap-3 px-6 text-center">
                <p className="text-sm font-semibold text-zinc-300">{t("studio.readyTitle")}</p>
                <p className="max-w-sm text-xs text-zinc-500">{t("studio.readyText")}</p>
                <button
                  onClick={() => setDiscoverModalOpen(true)}
                  className="rounded-lg bg-sky-600 px-4 py-2 text-xs font-bold text-white hover:bg-sky-500"
                >
                  {t("studio.addFirstTrack")}
                </button>
              </div>
            )}
            {tracks.map((track) => (
              <div
                key={track.id}
                onClick={() => {
                  setSelectedTrackId(track.id);
                  setIsMasterMode(false);
                  if (track.trackType === "guitar-bass") {
                    setWindowState((prev) => ({ ...prev, amp: { ...prev.amp, open: true } }));
                  }
                }}
                className={`h-16 p-1.5 flex flex-col justify-between transition ${
                  selectedTrackId === track.id && !isMasterMode ? "bg-[#1c1e26]" : "bg-[#121316] hover:bg-[#181920]"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`h-6 w-6 rounded-lg ${track.color} flex items-center justify-center text-xs text-white shadow`}>
                      {track.trackType === "midi" ? <PianoIcon className="h-4 w-4 fill-white" />
                        : track.trackType === "drum" ? <DrumIcon className="h-4 w-4 stroke-white" />
                        : track.trackType === "guitar-bass" ? (track.name.toLowerCase().includes("bass")
                          ? <BassIcon className="h-4 w-4 fill-white" />
                          : <GuitarIcon className="h-4 w-4 fill-white" />)
                        : <MicIcon className="h-4 w-4 fill-white" />}
                    </div>
                    <input
                      value={track.name}
                      onChange={(e) => setTracks((ts) => ts.map((t) => t.id === track.id ? { ...t, name: e.target.value } : t))}
                      className="w-24 bg-transparent text-xs font-bold text-white focus:outline-none rounded px-1"
                    />
                  </div>
                  <select
                    aria-label={t("studio.outputBus")}
                    title={t("studio.outputBus")}
                    value={track.busId ?? ""}
                    onClick={(event) => event.stopPropagation()}
                    onChange={(event) => setTracks((current) => current.map((item) => item.id === track.id
                      ? { ...item, busId: event.target.value || undefined }
                      : item))}
                    className="w-14 truncate rounded border border-zinc-700 bg-[#17181f] px-1 py-0.5 text-[8px] text-zinc-300"
                  >
                    <option value="">{t("studio.main")}</option>
                    {buses.map((bus) => <option key={bus.id} value={bus.id}>{bus.name}</option>)}
                  </select>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteTrack(track.id);
                    }}
                    className="text-zinc-500 hover:text-red-400 text-xs px-1 font-bold"
                  >
                    ✕
                  </button>
                </div>

                <div className="flex items-center justify-between text-[10px]">
                  <div className="flex items-center gap-1">
                    {track.category === "audio" && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setTracks((ts) => ts.map((t) => t.id === track.id ? { ...t, armed: !t.armed } : t));
                        }}
                        className={`h-4.5 w-4.5 rounded-full flex items-center justify-center font-bold text-[8px] ${
                          track.armed ? "bg-red-500 text-white animate-pulse" : "bg-[#20222a] text-red-500"
                        }`}
                      >
                        ●
                      </button>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setTracks((ts) => ts.map((t) => t.id === track.id ? { ...t, mute: !t.mute } : t));
                      }}
                      className={`px-1.5 py-0.5 rounded ${track.mute ? "bg-blue-500 text-white" : "bg-[#1c1e26] text-zinc-400"}`}
                    >
                      M
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setTracks((ts) => ts.map((t) => t.id === track.id ? { ...t, solo: !t.solo } : t));
                      }}
                      className={`px-1.5 py-0.5 rounded ${track.solo ? "bg-amber-500 text-black" : "bg-[#1c1e26] text-zinc-400"}`}
                      title={t("studio.solo")}
                    >
                      S
                    </button>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={track.volume}
                    onChange={(e) => setTracks((ts) => ts.map((t) => t.id === track.id ? { ...t, volume: Number(e.target.value) } : t))}
                    className="w-20 accent-sky-400 h-1 bg-zinc-800 rounded"
                  />
                </div>
                <input
                  type="range"
                  min={-1}
                  max={1}
                  step={0.05}
                  value={track.pan}
                  aria-label={t("studio.trackPanAria", { track: track.name })}
                  onChange={(e) => setTracks((ts) => ts.map((t) => t.id === track.id ? { ...t, pan: Number(e.target.value) } : t))}
                  className="h-1 w-full accent-amber-400"
                />
              </div>
            ))}
            <div
              onClick={() => setIsMasterMode(true)}
              className={`flex h-14 flex-none items-center justify-between border-t border-emerald-900/60 px-2 ${isMasterMode ? "bg-emerald-950/50" : "bg-[#111319]"}`}
            >
              <div>
                <p className="text-[10px] font-bold tracking-wide text-emerald-300">{t("studio.master")}</p>
                <p className="text-[8px] text-zinc-500">{t("studio.masterSafety")}</p>
              </div>
              <button
                onClick={(event) => {
                  event.stopPropagation();
                  createMasterFadeOut();
                }}
                className="rounded bg-emerald-900/60 px-1.5 py-1 text-[8px] text-emerald-200 hover:bg-emerald-800"
              >
                Fade out
              </button>
            </div>
          </div>
        </div>

        {/* Scrollable Timeline Grid */}
        <div
          ref={timelineContainerRef}
          className="flex-1 overflow-x-auto overflow-y-hidden flex flex-col bg-[#0c0d0f] relative select-none"
        >
          {/* Ruler */}
          <div
            onMouseDown={(e) => {
              const target = e.target as HTMLElement;
              if (target.dataset.loopHandle) return;
              setIsScrubbing(true);
              const rect = e.currentTarget.getBoundingClientRect();
              const scrollLeft = timelineContainerRef.current?.scrollLeft || 0;
              const newSec = Math.max(0, (e.clientX - rect.left + scrollLeft) / pixelsPerSecond);
              setPlayheadSec(newSec);
              playheadAnchor.current = newSec;
              scrubPosition.current = newSec;
            }}
            style={{ width: `${timelineWidth}px` }}
            className="h-7 border-b border-[#1b1c22] bg-[#121316] relative cursor-ew-resize flex-none"
          >
            {/* Draggable Loop Range with Drag Brackets */}
            {isLooping && (
              <div
                style={{
                  left: `${loopStartSec * pixelsPerSecond}px`,
                  width: `${Math.max(20, (loopEndSec - loopStartSec) * pixelsPerSecond)}px`,
                }}
                className="absolute top-0 bottom-0 bg-red-500/25 border-y-2 border-red-500 z-20 flex items-center justify-between"
              >
                <div
                  data-loop-handle="start"
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    setDraggingLoopEdge("start");
                  }}
                  className="w-2 h-full bg-red-500 cursor-ew-resize hover:brightness-125"
                />
                <span className="text-[8px] font-black text-red-200 pointer-events-none select-none">
                  LOOP ({(loopEndSec - loopStartSec).toFixed(1)}s)
                </span>
                <div
                  data-loop-handle="end"
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    setDraggingLoopEdge("end");
                  }}
                  className="w-2 h-full bg-red-500 cursor-ew-resize hover:brightness-125"
                />
              </div>
            )}

            {Array.from({ length: barCount }, (_, i) => (
              <div key={i} style={{ left: `${i * barWidth}px` }} className="absolute flex items-center gap-2 text-zinc-500 top-1 text-[9px] font-mono pointer-events-none">
                <span>{i + 1}</span>
                <div className="h-3 w-[1px] bg-zinc-800" />
              </div>
            ))}
          </div>

          <ArrangerLane
            sections={sections}
            width={timelineWidth}
            pixelsPerBar={barWidth}
            onSeek={seekToBar}
            onCommit={commitSectionMove}
            onRename={(id, name) => setSections((current) => current.map((section) => section.id === id ? { ...section, name } : section))}
            onDelete={(id) => setSections((current) => current.filter((section) => section.id !== id))}
          />

          {/* Arranger Track Lanes */}
          <div
            ref={timelineRowsRef}
            onScroll={(event) => {
              if (trackHeaderRowsRef.current) trackHeaderRowsRef.current.scrollTop = event.currentTarget.scrollTop;
            }}
            style={{ width: `${timelineWidth}px` }}
            className="flex-1 overflow-y-auto relative divide-y divide-[#171820]"
          >
            
            {/* Gold Playhead Line */}
            <div
              onMouseDown={(e) => {
                e.stopPropagation();
                setIsScrubbing(true);
                const rect = timelineContainerRef.current?.getBoundingClientRect();
                if (rect) {
                  const newSec = Math.max(0, (e.clientX - rect.left + timelineContainerRef.current!.scrollLeft) / pixelsPerSecond);
                  setPlayheadSec(newSec);
                  playheadAnchor.current = newSec;
                  scrubPosition.current = newSec;
                }
              }}
              style={{ left: `${playheadSec * pixelsPerSecond}px` }}
              className="absolute top-0 bottom-0 w-[2px] bg-[#d4af37] z-40 cursor-ew-resize shadow-[0_0_8px_#d4af37]"
            >
              <div className="h-4 w-4 -ml-[7px] bg-[#d4af37] rotate-45 shadow-lg" />
            </div>

            {tracks.map((track) => (
              <div
                key={track.id}
                onClick={() => setSelectedTrackId(track.id)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => handleLaneDrop(event, track.id)}
                className={`h-16 relative flex items-center transition ${
                  selectedTrackId === track.id ? "bg-[#14151c]" : "bg-[#0c0d0f]"
                }`}
              >
                {isAutomationMode && (
                  <svg
                    viewBox={`0 0 ${timelineWidth} 64`}
                    preserveAspectRatio="none"
                    className="absolute inset-0 z-30 h-full w-full cursor-crosshair"
                    onClick={(event) => {
                      const rect = event.currentTarget.getBoundingClientRect();
                      const time = Math.max(0, (event.clientX - rect.left) / pixelsPerSecond);
                      const normalizedValue = 1 - (event.clientY - rect.top) / rect.height;
                      addAutomationPoint(track.id, time, Math.max(0, Math.min(1, normalizedValue)));
                    }}
                    onDoubleClick={(event) => {
                      const rect = event.currentTarget.getBoundingClientRect();
                      removeNearestAutomationPoint(track.id, (event.clientX - rect.left) / pixelsPerSecond);
                    }}
                    aria-label={t("studio.trackAutomationAria", {
                      parameter: t(automationParameter === "reverbSend" ? "studio.reverb" : `studio.${automationParameter}`),
                      track: track.name,
                    })}
                  >
                    <polyline
                      points={(track.automation?.[automationParameter] ?? [])
                        .map((point) => `${point.time * pixelsPerSecond},${(automationParameter === "pan" ? (1 - (point.value + 1) / 2) : 1 - point.value) * 64}`)
                        .join(" ")}
                      fill="none"
                      stroke="#e879f9"
                      strokeWidth="2"
                      vectorEffect="non-scaling-stroke"
                    />
                    {(track.automation?.[automationParameter] ?? []).map((point) => (
                      <circle
                        key={point.id}
                        cx={point.time * pixelsPerSecond}
                        cy={(automationParameter === "pan" ? (1 - (point.value + 1) / 2) : 1 - point.value) * 64}
                        r="4"
                        fill="#f0abfc"
                        stroke="#701a75"
                        strokeWidth="1"
                      />
                    ))}
                  </svg>
                )}
                {/* Live Recording Oscilloscope Waveform */}
                {isRecording && track.armed && track.category === "audio" && (
                  <div
                    style={{
                      left: `${recStartTime.current * pixelsPerSecond}px`,
                      width: `${Math.max(30, (playheadSec - recStartTime.current) * pixelsPerSecond)}px`,
                    }}
                    className="absolute top-1 bottom-1 bg-red-950/80 border border-red-500 rounded z-30 overflow-hidden flex items-center"
                  >
                    <canvas
                      ref={(canvas) => {
                        if (canvas) liveCanvasRefs.current.set(track.id, canvas);
                        else liveCanvasRefs.current.delete(track.id);
                      }}
                      width={400}
                      height={70}
                      data-track-id={track.id}
                      aria-label={t("studio.liveWaveformAria", { track: track.name })}
                      className="h-full w-full"
                    />
                  </div>
                )}

                {/* Empty Track Prompt (Screenshot 1: Drop a loop or an audio/MIDI file) */}
                {track.regions.length === 0 && (!isRecording || !track.armed) && (
                  <div className="w-full text-center text-xs text-zinc-600 italic select-none pointer-events-none">
                    Drop a loop or an audio/MIDI file
                  </div>
                )}

                {track.regions.map((region) => (
                  <ClipRegion
                    key={region.id}
                    region={region as any}
                    pixelsPerSecond={pixelsPerSecond}
                    trackColor={track.color}
                    trackId={track.id}
                    snapIntervalSec={isSnapEnabled ? (60 / bpm / 4) * quantizeGridSteps : undefined}
                    onCopy={(reg) => setCopiedClip(reg)}
                    onLoop={() => repeatClipToLoopEnd(track.id, region.id)}
                    onReverse={() => reverseClip(track.id, region.id)}
                    onUpdate={(updated) => updateClip(track.id, region.id, updated)}
                    onSplit={(at) => splitClip(track.id, region.id, at)}
                    onDelete={() => setTracks((prev) => prev.map((item) => item.id === track.id
                      ? { ...item, regions: item.regions.filter((regionToDelete) => regionToDelete.id !== region.id) }
                      : item))}
                  />
                ))}
              </div>
            ))}
            <div className="relative h-14 border-t border-emerald-900/60 bg-[#101217]">
              <svg
                  viewBox={`0 0 ${timelineWidth} 56`}
                  preserveAspectRatio="none"
                  className="absolute inset-0 h-full w-full"
                  aria-label={t("studio.volumeAutomationAria")}
                  onClick={(event) => {
                    const rect = event.currentTarget.getBoundingClientRect();
                    const time = Math.max(0, (event.clientX - rect.left) / pixelsPerSecond);
                    const value = Math.max(0, Math.min(1, 1 - (event.clientY - rect.top) / rect.height));
                    addMasterAutomationPoint(time, value);
                  }}
                  onDoubleClick={(event) => {
                    const rect = event.currentTarget.getBoundingClientRect();
                    const time = (event.clientX - rect.left) / pixelsPerSecond;
                    setMasterAutomation((current) => {
                      const nearest = current.reduce<MasterAutomationPoint | null>((best, point) =>
                        !best || Math.abs(point.time - time) < Math.abs(best.time - time) ? point : best, null);
                      return nearest && Math.abs(nearest.time - time) < 0.5
                        ? current.filter((point) => point.id !== nearest.id)
                        : current;
                    });
                  }}
                >
                  <polyline
                    points={masterAutomation.map((point) => `${point.time * pixelsPerSecond},${(1 - point.value) * 56}`).join(" ")}
                    fill="none"
                    stroke="#34d399"
                    strokeWidth="2"
                    vectorEffect="non-scaling-stroke"
                  />
                  {masterAutomation.map((point) => (
                    <circle key={point.id} cx={point.time * pixelsPerSecond} cy={(1 - point.value) * 56} r="4" fill="#a7f3d0" />
                  ))}
              </svg>
            </div>
          </div>

        </div>
      </div>

      {busPanelOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4">
          <section className="max-h-[80vh] w-full max-w-xl overflow-y-auto rounded-xl border border-zinc-700 bg-[#17191f] p-4 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-white">{t("studio.subgroupBuses")}</h2>
                <p className="mt-1 text-[10px] text-zinc-400">{t("studio.subgroupHelp")}</p>
              </div>
              <button onClick={() => setBusPanelOpen(false)} className="rounded bg-zinc-800 px-2 py-1 text-xs text-zinc-200 hover:bg-zinc-700">{t("studio.close")}</button>
            </div>
            <button onClick={addMixerBus} className="mb-3 rounded bg-sky-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-600">{t("studio.addBus")}</button>
            <div className="space-y-3">
              {buses.map((bus) => (
                <div key={bus.id} className="grid grid-cols-[minmax(5rem,1fr)_1fr_1fr_1fr_auto] items-center gap-3 rounded-lg border border-zinc-800 bg-[#101116] p-3">
                  <input
                    aria-label={t("studio.busName")}
                    value={bus.name}
                    onChange={(event) => setBuses((current) => current.map((item) => item.id === bus.id ? { ...item, name: event.target.value.slice(0, 60) } : item))}
                    className="min-w-0 rounded bg-zinc-900 px-2 py-1 text-xs text-white"
                  />
                  <label className="text-[9px] text-zinc-400">Level
                    <input type="range" min={0} max={1} step={0.01} value={bus.volume} onChange={(event) => setBuses((current) => current.map((item) => item.id === bus.id ? { ...item, volume: Number(event.target.value) } : item))} className="block w-full accent-sky-400" />
                  </label>
                  <label className="text-[9px] text-zinc-400">Pan
                    <input type="range" min={-1} max={1} step={0.01} value={bus.pan} onChange={(event) => setBuses((current) => current.map((item) => item.id === bus.id ? { ...item, pan: Number(event.target.value) } : item))} className="block w-full accent-amber-400" />
                  </label>
                  <label className="text-[9px] text-zinc-400">Reverb
                    <input type="range" min={0} max={1} step={0.01} value={bus.reverbSend} onChange={(event) => setBuses((current) => current.map((item) => item.id === bus.id ? { ...item, reverbSend: Number(event.target.value) } : item))} className="block w-full accent-fuchsia-400" />
                  </label>
                  <button
                    onClick={() => {
                      setBuses((current) => current.filter((item) => item.id !== bus.id));
                      setTracks((current) => current.map((track) => track.busId === bus.id ? { ...track, busId: undefined } : track));
                    }}
                    className="rounded bg-zinc-800 px-2 py-1 text-[10px] text-zinc-300 hover:bg-rose-900"
                    aria-label={t("studio.removeBusAria", { bus: bus.name })}
                  >
                    Remove
                  </button>
                </div>
              ))}
              {buses.length === 0 && <p className="rounded-lg border border-dashed border-zinc-700 p-5 text-center text-xs text-zinc-500">{t("studio.noBuses")}</p>}
            </div>
          </section>
        </div>
      )}

      {/* 3. DOCKABLE BOTTOM BAR (BandLab Style Pill Dock) */}
      <footer
        tabIndex={0}
        aria-label={t("studio.toolsAria")}
        className="flex h-9 flex-none items-center justify-start gap-3 overflow-x-auto overscroll-x-contain border-t border-[#1c1d22] bg-[#121316] px-2 z-20 focus-visible:outline focus-visible:outline-1 focus-visible:outline-sky-500"
      >
        <div className="flex w-max flex-none items-center gap-1.5">
          <button
            onClick={() => setSmartControlsOpen(!smartControlsOpen)}
            className={`inline-flex flex-none items-center gap-1 whitespace-nowrap rounded-full px-2 py-1 text-[11px] font-semibold transition ${
              smartControlsOpen ? "bg-zinc-800 text-white" : "text-zinc-500 hover:text-white"
            }`}
          >
            {t("studio.controls")}
          </button>

          <button
            onClick={() => toggleModal("piano")}
            className="inline-flex flex-none items-center gap-1 whitespace-nowrap rounded-full px-2 py-1 text-[11px] font-semibold text-zinc-400 hover:text-white hover:bg-zinc-800/80 transition"
          >
            <PianoIcon className="h-4 w-4" /> {t("studio.piano")}
          </button>

          <button
            onClick={() => {
              if (selectedTrack?.category !== "midi") {
                setStatusMsg(t("studio.selectMidi"));
                return;
              }
              setPianoRollOpen(true);
            }}
            className="inline-flex flex-none items-center gap-1 whitespace-nowrap rounded-full px-2 py-1 text-[11px] font-semibold text-zinc-400 hover:text-white hover:bg-zinc-800/80 transition"
          >
            {t("studio.pianoRoll")}
          </button>

          <button
            onClick={() => {
              if (selectedTrack?.category !== "drum") {
                setStatusMsg(t("studio.selectDrums"));
                return;
              }
              setDrumEditorOpen(true);
            }}
            className="inline-flex flex-none items-center gap-1 whitespace-nowrap rounded-full px-2 py-1 text-[11px] font-semibold text-zinc-400 hover:text-white hover:bg-zinc-800/80 transition"
          >
            {t("studio.drumPattern")}
          </button>
          <button
            onClick={() => {
              if (!selectedTrack) {
                setStatusMsg(t("studio.selectSampler"));
                return;
              }
              setSamplerTrackId(selectedTrack.id);
            }}
            className="inline-flex flex-none items-center gap-1 whitespace-nowrap rounded-full px-2 py-1 text-[11px] font-semibold text-zinc-400 hover:bg-zinc-800/80 hover:text-white"
          >
            {t("studio.sampler")}
          </button>
          <button
            onClick={() => setSceneLauncherOpen(true)}
            className="inline-flex flex-none items-center gap-1 whitespace-nowrap rounded-full px-2 py-1 text-[11px] font-semibold text-emerald-300 hover:bg-emerald-900/40"
          >
            {t("studio.liveScenes")}
          </button>

          <button
            onClick={() => {
              if (selectedTrack?.trackType !== "guitar-bass") {
                setStatusMsg(t("studio.selectAmp"));
                return;
              }
              toggleModal("amp");
            }}
            disabled={selectedTrack?.trackType !== "guitar-bass"}
            className="inline-flex flex-none items-center gap-1 whitespace-nowrap rounded-full px-2 py-1 text-[11px] font-semibold text-zinc-400 hover:text-white hover:bg-zinc-800/80 transition disabled:cursor-not-allowed disabled:opacity-40"
          >
            <GuitarIcon className="h-4 w-4" /> {t("studio.guitarRig")}
          </button>

          <button
            onClick={() => {
              if (!isPro) {
                setUpgradeFeature(t("studio.upgradeCoach"));
                return;
              }
              setAiFeature("coach");
              toggleModal("ai");
            }}
            className="inline-flex flex-none items-center gap-1 whitespace-nowrap rounded-full px-2 py-1 text-[11px] font-semibold text-zinc-400 hover:text-white hover:bg-zinc-800/80 transition"
          >
            {t("studio.aiAssistant")}
          </button>

          <button
            onClick={() => setAudioSettingsOpen(true)}
            className="inline-flex flex-none items-center gap-1 whitespace-nowrap rounded-full px-2 py-1 text-[11px] font-semibold text-sky-400 hover:bg-zinc-800/80 transition"
          >
            <MicIcon className="h-4 w-4" /> {t("studio.audioInputs", { device: activeInputLabel })}
          </button>
          <button
            onClick={() => setActiveUtility("notes")}
            className="flex-none whitespace-nowrap rounded-full px-2 py-1 text-[11px] font-semibold text-zinc-400 transition hover:bg-zinc-800/80 hover:text-white"
          >
            {t("studio.lyricsNotes")}
          </button>
          <button
            onClick={() => setSoundLibraryOpen(true)}
            className="flex-none whitespace-nowrap rounded-full px-2 py-1 text-[11px] font-semibold text-zinc-400 transition hover:bg-zinc-800/80 hover:text-white"
          >
            {t("studio.soundBrowser")}
          </button>
          <button
            onClick={() => soundInputRef.current?.click()}
            className="flex-none whitespace-nowrap rounded-full px-2 py-1 text-[11px] font-semibold text-zinc-400 transition hover:bg-zinc-800/80 hover:text-white"
          >
            {t("studio.importAudio")}
          </button>
          <button
            onClick={openBeats}
            className="flex-none whitespace-nowrap rounded-full px-2 py-1 text-[11px] font-semibold text-zinc-400 transition hover:bg-zinc-800/80 hover:text-white"
          >
            {t("studio.beats")}
          </button>
          <button
            onClick={() => setTunerOpen(true)}
            className="flex-none whitespace-nowrap rounded-full px-2 py-1 text-[11px] font-semibold text-zinc-400 transition hover:bg-zinc-800/80 hover:text-white"
          >
            {t("studio.tuner")}
          </button>
          <button
            onClick={() => setActiveUtility("shortcuts")}
            className="flex-none whitespace-nowrap rounded-full px-2 py-1 text-[11px] font-semibold text-zinc-400 transition hover:bg-zinc-800/80 hover:text-white"
          >
            {t("studio.shortcutsButton")}
          </button>
        </div>

        <div className="ml-auto flex-none whitespace-nowrap text-[10px] font-mono text-zinc-500">
          {t("studio.version")}
        </div>
      </footer>

      {activeUtility && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <section
            role="dialog"
            aria-modal="true"
            aria-label={activeUtility === "notes" ? t("studio.lyricsNotes") : t("studio.shortcuts")}
            className="w-full max-w-xl rounded-xl border border-zinc-700 bg-[#17191f] p-5 shadow-2xl"
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-bold text-white">
                {activeUtility === "notes" ? t("studio.lyricsNotes") : t("studio.shortcuts")}
              </h2>
              <button onClick={() => setActiveUtility(null)} aria-label={t("studio.closeUtility")} className="px-2 text-zinc-400 hover:text-white">✕</button>
            </div>
            {activeUtility === "notes" ? (
              <textarea
                value={lyricsNotes}
                onChange={(event) => setLyricsNotes(event.target.value)}
                placeholder={t("studio.lyricsPlaceholder")}
                className="h-64 w-full resize-y rounded-lg border border-zinc-700 bg-[#0c0d0f] p-3 text-sm text-zinc-200 outline-none focus:border-sky-500"
              />
            ) : (
              <dl className="grid grid-cols-[1fr_auto] gap-x-8 gap-y-2 text-sm">
                <dt>{t("studio.playPause")}</dt><dd className="font-mono text-sky-300">Space</dd>
                <dt>{t("studio.record")}</dt><dd className="font-mono text-sky-300">R</dd>
                <dt>{t("studio.toggleLoop")}</dt><dd className="font-mono text-sky-300">C</dd>
                <dt>{t("studio.returnStart")}</dt><dd className="font-mono text-sky-300">Enter</dd>
                <dt>{t("studio.copyPaste")}</dt><dd className="font-mono text-sky-300">⌘/Ctrl+C, ⌘/Ctrl+V</dd>
                <dt>{t("studio.splitClip")}</dt><dd className="font-mono text-sky-300">⌘/Ctrl+T</dd>
                <dt>{t("studio.deleteClip")}</dt><dd className="font-mono text-sky-300">Delete</dd>
              </dl>
            )}
            <div className="mt-4 flex justify-end">
              <button onClick={() => setActiveUtility(null)} className="rounded-lg bg-sky-700 px-4 py-2 text-xs font-bold text-white hover:bg-sky-600">
                {t("studio.done")}
              </button>
            </div>
          </section>
        </div>
      )}

      {/* 4. BOTTOM SMART DYNAMICS & EQ CONSOLE (When Controls is open) */}
      {smartControlsOpen && (
        <TrackControlsPanel
          trackName={selectedTrack?.name ?? t("studio.noTrack")}
          isMasterMode={isMasterMode}
          onToggleMasterMode={(isMaster) => setIsMasterMode(isMaster)}
          devices={devices}
          activeDeviceId={selectedTrack?.inputDevice || activeInputId}
          onSelectDevice={(devId) => {
            setActiveInputId(devId);
            const input = devices.find((device) => device.deviceId === devId);
            setActiveInputLabel(input?.label ?? t("studio.systemDefaultInput"));
            if (selectedTrack) {
              setTracks((prev) => prev.map((track) => track.id === selectedTrack.id ? { ...track, inputDevice: devId } : track));
            }
            if (monitoringEnabled && !isRecording) void setInputMonitoring(true, devId);
          }}
          isMonitoring={monitoringEnabled}
          onToggleMonitoring={() => {
            void setInputMonitoring(!monitoringEnabled);
          }}
          currentSettings={activeSettings}
          onUpdateSettings={(updated) => {
            if (isMasterMode) {
              setMasterSettings(updated);
              setMasterPreset("custom");
            }
            else setTracks((ts) => ts.map((t) => t.id === selectedTrackId ? { ...t, settings: updated } : t));
          }}
          onOpenAdvancedEq={() => toggleModal("eq")}
          onClosePanel={() => setSmartControlsOpen(false)}
        />
      )}

      {/* 5. ALL WORKING MODALS */}
      <DiscoverTrackModal
        isOpen={discoverModalOpen}
        onClose={() => setDiscoverModalOpen(false)}
        onSelectTrackType={handleAddTrackType}
        onOpenAiSongStarter={(feature) => {
          setAiFeature(feature);
          setWindowState((prev) => ({ ...prev, ai: { ...prev.ai, open: true } }));
        }}
      />

      <SoundLibraryModal
        isOpen={soundLibraryOpen}
        onClose={() => setSoundLibraryOpen(false)}
        onApply={applySoundPreset}
      />

      <PianoStudioModal
        isOpen={windowState.piano.open}
        onClose={() => toggleModal("piano")}
        ctx={engine.current.init()}
        outputNode={engine.current.masterGain ?? undefined}
        synthSettings={selectedTrack?.synthSettings ?? DEFAULT_SYNTH_SETTINGS}
        projectKey={projectKey}
        scale={projectScale}
        trackName={selectedTrack?.name ?? t("studio.defaultPiano")}
        onRecordMidiNote={handlePianoMidiNote}
      />

      {pianoRollOpen && selectedTrack && (
        <div className="fixed inset-8 z-50 overflow-hidden rounded-xl border border-zinc-700 bg-[#14151a] shadow-2xl">
          <PianoRoll
            notes={trackNotes[selectedTrack.id] ?? selectedTrack.midiNotes ?? []}
            instrumentName={selectedTrack.name}
            projectKey={projectKey}
            scale={projectScale}
            onAddNote={addMidiNote}
            onDeleteNote={deleteMidiNote}
            onPreviewNote={previewMidiNote}
            onUpdateNotes={updateMidiNotes}
            synthSettings={selectedTrack.synthSettings ?? DEFAULT_SYNTH_SETTINGS}
            onSynthSettingsChange={(settings) => setTracks((prev) => prev.map((track) =>
              track.id === selectedTrack.id ? { ...track, synthSettings: settings } : track
            ))}
          />
          <button
            onClick={() => setPianoRollOpen(false)}
            className="absolute right-3 top-1 z-10 rounded px-2 py-1 text-xs text-zinc-400 hover:bg-zinc-700 hover:text-white"
            aria-label={t("studio.closePianoRoll")}
          >
            {t("studio.close")} ✕
          </button>
        </div>
      )}

      <DrumPatternEditor
        isOpen={drumEditorOpen}
        pattern={selectedTrack?.drumPattern ?? DEFAULT_DRUM_PATTERN}
        bpm={bpm}
        playheadSec={playheadSec}
        isPlaying={isPlaying}
        onChange={(pattern) => setTracks((prev) => prev.map((track) => track.id === selectedTrackId ? { ...track, drumPattern: pattern } : track))}
        onClose={() => setDrumEditorOpen(false)}
      />

      <ChromaticTuner isOpen={tunerOpen} onClose={() => setTunerOpen(false)} />

      <SamplerPadModal
        isOpen={samplerTrackId !== null}
        track={tracks.find((track) => track.id === samplerTrackId) ?? null}
        audioContext={engine.current.init()}
        onChange={(sampler) => {
          if (samplerTrackId === null) return;
          setTracks((current) => current.map((track) => track.id === samplerTrackId ? { ...track, sampler } : track));
        }}
        onClose={() => setSamplerTrackId(null)}
      />

      {sceneLauncherOpen && (
        <SceneLauncherModal
          scenes={scenes}
          tracks={getProjectTracks()}
          isPlaying={activeSceneId !== null}
          onCreate={captureScene}
          onChange={(nextScene) => setScenes((current) => current.map((scene) => scene.id === nextScene.id ? nextScene : scene))}
          onDelete={(sceneId) => {
            setScenes((current) => current.filter((scene) => scene.id !== sceneId));
            if (activeSceneId === sceneId) {
              engine.current.stopScene();
              setActiveSceneId(null);
            }
          }}
          onLaunch={launchScene}
          onStop={() => {
            engine.current.stopScene();
            setActiveSceneId(null);
            setStatusMsg(t("studio.statusSceneStopped"));
          }}
          onClose={() => setSceneLauncherOpen(false)}
        />
      )}

      {sharedProjectId && !hasEditLease && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4">
          <section className="max-w-md rounded-xl border border-zinc-700 bg-[#15171d] p-5 text-center shadow-2xl">
            <h2 className="text-sm font-bold text-white">{t("studio.readOnlyTitle")}</h2>
            <p className="mt-2 text-xs text-zinc-400">
              {editLockOwnerId && editLockExpiresAt && new Date(editLockExpiresAt).getTime() > Date.now()
                ? t("studio.lockExpires", { time: new Date(editLockExpiresAt).toLocaleTimeString(locale) })
                : t("studio.takeEditLock")}
            </p>
            <button onClick={() => setCollaborationOpen(true)} className="mt-4 rounded bg-amber-700 px-4 py-2 text-xs font-semibold text-white hover:bg-amber-600">
              {t("studio.openCollaboration")}
            </button>
          </section>
        </div>
      )}

      <CollaborationPanel
        isOpen={collaborationOpen}
        projectId={sharedProjectId}
        projectName={projectName}
        revision={sharedRevision}
        isOwner={sharedProjectIsOwner}
        hasEditLease={hasEditLease}
        lockOwnerId={editLockOwnerId}
        lockExpiresAt={editLockExpiresAt}
        onCreateShared={createSharedProject}
        onSaveShared={saveSharedProject}
        onLoadProject={loadSharedProject}
        onClaim={claimSharedProject}
        onRelease={releaseSharedProject}
        onClose={() => setCollaborationOpen(false)}
      />

      <AudioSettingsModal
        isOpen={audioSettingsOpen}
        onClose={() => setAudioSettingsOpen(false)}
        ctx={engine.current.ctx}
        activeInputDeviceName={activeInputLabel}
        activeInputDeviceId={selectedTrack?.inputDevice || activeInputId}
        activeOutputDeviceId={activeOutputId}
        onSelectInputDevice={(devId, label) => {
          setActiveInputId(devId);
          setActiveInputLabel(label);
          if (selectedTrack) {
            setTracks((prev) => prev.map((track) => track.id === selectedTrack.id ? { ...track, inputDevice: devId } : track));
          }
          if (monitoringEnabled && !isRecording) void setInputMonitoring(true, devId);
        }}
        onSelectOutputDevice={async (devId) => {
          const ctx = engine.current.init();
          const routed = await deviceManager.current.setOutputDevice(ctx, devId);
          if (routed) {
            setActiveOutputId(devId);
            setStatusMsg(t("studio.statusOutputChanged"));
          } else {
            setStatusMsg(t("studio.statusOutputUnsupported"));
          }
          return routed;
        }}
        isMonitoring={monitoringEnabled}
        onToggleMonitoring={(enabled) => {
          void setInputMonitoring(enabled);
        }}
      />

      <ChannelEqModal
        isOpen={windowState.eq.open}
        onClose={() => toggleModal("eq")}
        trackName={selectedTrack?.name ?? t("studio.noTrack")}
        settings={activeSettings}
        onSettingsChange={(updated) => {
          if (isMasterMode) setMasterSettings(updated);
          else setTracks((prev) => prev.map((track) => track.id === selectedTrackId ? { ...track, settings: updated } : track));
        }}
      />

      <GuitarAmpModal
        isOpen={windowState.amp.open}
        onClose={() => toggleModal("amp")}
        trackName={selectedTrack?.name ?? t("studio.defaultGuitarTrack")}
        settings={selectedTrack?.ampSettings ?? DEFAULT_AMP_SETTINGS}
        enabled={selectedTrack?.ampEnabled ?? false}
        onSettingsChange={(settings) => setTracks((prev) => prev.map((track) => track.id === selectedTrackId ? { ...track, ampSettings: settings } : track))}
        onToggleEnabled={() => setTracks((prev) => prev.map((track) => track.id === selectedTrackId ? { ...track, ampEnabled: !track.ampEnabled } : track))}
      />

      {upgradeFeature && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-[80] grid place-items-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-amber-500 bg-[#18191d] p-6 text-white shadow-2xl">
            <h2 className="text-lg font-extrabold">{t("studio.upgradeTitle")}</h2>
            <p className="mt-2 text-sm text-zinc-300">{upgradeFeature}</p>
            <div className="mt-5 flex gap-2">
              <a href="/dashboard" className="flex-1 rounded-lg bg-amber-500 text-zinc-950 hover:bg-amber-400 px-4 py-2 text-center text-sm font-bold">{t("studio.upgradeCta")}</a>
              <button onClick={() => setUpgradeFeature(null)} className="rounded-lg bg-zinc-800 px-4 py-2 text-sm font-semibold hover:bg-zinc-700">{t("studio.upgradeLater")}</button>
            </div>
          </div>
        </div>
      )}

      <AiCoachModal
        isOpen={windowState.ai.open}
        onClose={() => toggleModal("ai")}
        currentKey={projectKey}
        bpm={bpm}
        instrument={selectedTrack?.instrument ?? "general"}
        scale={projectScale}
        initialTab={aiFeature === "palette" ? "theory" : "coach"}
        initialQuestion={aiFeature === "songstarter"
          ? t("studio.songStarterQuestion")
          : undefined}
      />

      <StudioWelcomeModal
        isOpen={welcomeOpen}
        onClose={closeWelcome}
        onAddTrack={() => {
          closeWelcome();
          setDiscoverModalOpen(true);
        }}
        onPlay={() => {
          closeWelcome();
          handlePlay();
        }}
        onSave={() => {
          closeWelcome();
          void saveProject();
        }}
      />

    </div>
  );
}
