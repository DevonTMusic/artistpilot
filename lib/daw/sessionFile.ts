// lib/daw/sessionFile.ts
import { AudioRegion } from "@/lib/AudioEngine";

export const sourceBlobs = new WeakMap<AudioBuffer, Blob>();

export const blobToDataUrl = (b: Blob) =>
  new Promise<string>((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result));
    r.onerror = () => rej(r.error);
    r.readAsDataURL(b);
  });

export async function saveSessionFile(meta: any, tracks: any[], projectName: string) {
  const serializedTracks = await Promise.all(
    tracks.map(async (t) => {
      const serializedRegions = await Promise.all(
        t.regions.map(async (r: AudioRegion) => {
          let audioDataUrl = "";
          const blob = sourceBlobs.get(r.buffer);
          if (blob) {
            audioDataUrl = await blobToDataUrl(blob);
          }
          return {
            id: r.id,
            name: r.name,
            startTime: r.startTime,
            duration: r.duration,
            offset: r.offset,
            gain: r.gain,
            audioDataUrl,
          };
        })
      );
      return { ...t, regions: serializedRegions };
    })
  );

  const payload = {
    format: "artistpilot-session",
    version: 1,
    meta,
    tracks: serializedTracks,
  };

  const blob = new Blob([JSON.stringify(payload)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${projectName.toLowerCase().replace(/\s+/g, "-")}.artistpilot`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

export async function openSessionFile(file: File, ctx: AudioContext): Promise<{ meta: any; tracks: any[] }> {
  const text = await file.text();
  const d = JSON.parse(text);

  if (d.format !== "artistpilot-session" || !Array.isArray(d.tracks)) {
    throw new Error("Invalid session file");
  }

  const loadedTracks = await Promise.all(
    d.tracks.map(async (t: any) => {
      const restoredRegions: AudioRegion[] = [];
      for (const r of t.regions || []) {
        let buffer: AudioBuffer | null = null;
        if (r.audioDataUrl && r.audioDataUrl.startsWith("data:")) {
          try {
            const resp = await fetch(r.audioDataUrl);
            const blob = await resp.blob();
            buffer = await ctx.decodeAudioData(await blob.arrayBuffer());
            sourceBlobs.set(buffer, blob);
          } catch {}
        }
        if (buffer) {
          restoredRegions.push({
            id: r.id,
            name: r.name,
            buffer,
            startTime: r.startTime,
            duration: r.duration,
            offset: r.offset,
            gain: r.gain ?? 1.0,
          });
        }
      }
      return { ...t, regions: restoredRegions };
    })
  );

  return { meta: d.meta, tracks: loadedTracks };
}
