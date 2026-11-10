// WSOLA time-stretch: changes duration without changing pitch.
// All channels share one set of alignment offsets so stereo images stay intact.

const FRAME = 2048;
const SYNTH_HOP = FRAME / 4;
const SEARCH = 384;

export const MIN_STRETCH = 0.25;
export const MAX_STRETCH = 4;

/** `factor` is output length / input length (2 = twice as long and half the tempo). */
export function timeStretch(buffer: AudioBuffer, ctx: BaseAudioContext, factor: number): AudioBuffer {
  const safeFactor = Math.min(MAX_STRETCH, Math.max(MIN_STRETCH, factor));
  const length = buffer.length;
  const outLength = Math.max(1, Math.round(length * safeFactor));
  const channels = Array.from({ length: buffer.numberOfChannels }, (_, index) => buffer.getChannelData(index));
  const mono = new Float32Array(length);
  channels.forEach((data) => {
    for (let i = 0; i < length; i++) mono[i] += data[i] / channels.length;
  });

  const window = new Float32Array(FRAME);
  for (let i = 0; i < FRAME; i++) window[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / FRAME);

  const outputs = channels.map(() => new Float32Array(outLength + FRAME));
  const norm = new Float32Array(outLength + FRAME);
  const analysisHop = SYNTH_HOP / safeFactor;
  let previousPos = 0;

  for (let frame = 0, outPos = 0; outPos < outLength; frame++, outPos += SYNTH_HOP) {
    const nominal = Math.round(frame * analysisHop);
    let pos = nominal;
    if (frame > 0) {
      const target = previousPos + SYNTH_HOP;
      let best = Number.NEGATIVE_INFINITY;
      const lo = Math.max(0, nominal - SEARCH);
      const hi = Math.min(length - FRAME, nominal + SEARCH);
      pos = Math.min(Math.max(0, nominal), Math.max(0, length - FRAME));
      if (target + FRAME <= length) {
        for (let candidate = lo; candidate <= hi; candidate += 2) {
          let score = 0;
          for (let i = 0; i < FRAME; i += 4) score += mono[candidate + i] * mono[target + i];
          if (score > best) {
            best = score;
            pos = candidate;
          }
        }
      }
    } else {
      pos = 0;
    }
    previousPos = pos;
    const available = Math.min(FRAME, length - pos);
    if (available <= 0) break;
    channels.forEach((data, channelIndex) => {
      const out = outputs[channelIndex];
      for (let i = 0; i < available; i++) out[outPos + i] += data[pos + i] * window[i];
    });
    for (let i = 0; i < available; i++) norm[outPos + i] += window[i];
  }

  const result = ctx.createBuffer(buffer.numberOfChannels, outLength, buffer.sampleRate);
  outputs.forEach((out, channelIndex) => {
    const target = result.getChannelData(channelIndex);
    for (let i = 0; i < outLength; i++) target[i] = norm[i] > 1e-3 ? out[i] / norm[i] : 0;
  });
  return result;
}
