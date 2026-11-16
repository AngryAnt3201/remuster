// Synthesised sound effects (WebAudio, no files) with a per-sound rate limit so big fights don't turn to mush.
// What each sound is made of lives in ../game/sounds.ts, which a game can replace.
import { GAPS, SOUNDS } from "../game/sounds";

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let enabled = true;
const last = new Map<string, number>();
let noiseBuf: AudioBuffer | null = null;

export function setSound(on: boolean) { enabled = on; if (master) master.gain.value = on ? 0.6 : 0; }
export function soundOn() { return enabled; }

export function unlockAudio() {
  if (ctx) { if (ctx.state === "suspended") void ctx.resume(); return; }
  const AC = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext | undefined;
  if (!AC) return;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = enabled ? 0.6 : 0;
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -18; comp.ratio.value = 6;
  master.connect(comp).connect(ctx.destination);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 1, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
}

function env(g: GainNode, t: number, a: number, peak: number, dcy: number) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t + a + dcy);
}
function tone(type: OscillatorType, f0: number, f1: number, dur: number, peak: number, at = 0) {
  if (!ctx || !master) return;
  const t = ctx.currentTime + at;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  env(g, t, 0.005, peak, dur);
  o.connect(g).connect(master);
  o.start(t); o.stop(t + dur + 0.05);
}
function noise(dur: number, peak: number, filter: BiquadFilterType, f0: number, f1: number, q = 1, at = 0) {
  if (!ctx || !master || !noiseBuf) return;
  const t = ctx.currentTime + at;
  const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
  const f = ctx.createBiquadFilter(); f.type = filter; f.Q.value = q;
  f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
  const g = ctx.createGain(); env(g, t, 0.004, peak, dur);
  s.connect(f).connect(g).connect(master);
  s.start(t, ((t * 7919) % 1) * 0.5); s.stop(t + dur + 0.05);
}

export function sfx(name: string, gain = 1) {
  // [film] the recorder keeps every sound asked for, with its time, to rebuild the soundtrack offline (renderSfx)
  const film = typeof window !== "undefined" ? window.__film : undefined;
  if (film) { film.sfx.push({ name, gain, t: performance.now() }); return; }
  if (!enabled || !ctx) return;
  const layers = SOUNDS[name];
  if (!layers) return;
  const now = ctx.currentTime;
  if (now - (last.get(name) ?? -1) < (GAPS[name] ?? 0.03)) return;
  last.set(name, now);
  for (const l of layers) {
    if (l[0] === "tone") tone(l[1], l[2], l[3], l[4], l[5] * gain, l[6] ?? 0);
    else noise(l[1], l[2] * gain, l[3], l[4], l[5], l[6] ?? 1, l[7] ?? 0);
  }
}

/** The shared audio context and the effects bus (null until the first tap unlocks audio); the music player joins it. */
export const audioContext = () => ctx;

/** [film] Render a log of sounds (name, gain, time in ms) to stereo PCM, offline, with the same synth and bus the
 *  game plays them through. Used by tools/film.mjs to lay the game's own sound under recorded footage. */
export async function renderSfx(log: { name: string; gain: number; t: number }[], seconds: number, sampleRate = 48000): Promise<Float32Array[]> {
  const off = new OfflineAudioContext(2, Math.ceil(seconds * sampleRate), sampleRate);
  const keep = { ctx, master, noiseBuf, enabled };
  ctx = off as unknown as AudioContext;
  master = off.createGain(); master.gain.value = 0.6;
  const comp = off.createDynamicsCompressor(); comp.threshold.value = -18; comp.ratio.value = 6;
  master.connect(comp).connect(off.destination);
  noiseBuf = off.createBuffer(1, sampleRate, sampleRate);
  const d = noiseBuf.getChannelData(0);
  let seed = 12345;
  for (let i = 0; i < d.length; i++) { seed = (seed * 1664525 + 1013904223) >>> 0; d[i] = seed / 2147483648 - 1; }
  const gaps = new Map<string, number>();
  for (const e of [...log].sort((a, b) => a.t - b.t)) {
    const at = e.t / 1000, layers = SOUNDS[e.name];
    if (!layers || at >= seconds) continue;
    if (at - (gaps.get(e.name) ?? -1) < (GAPS[e.name] ?? 0.03)) continue;
    gaps.set(e.name, at);
    for (const l of layers) {
      if (l[0] === "tone") tone(l[1], l[2], l[3], l[4], l[5] * e.gain, at + (l[6] ?? 0));
      else noise(l[1], l[2] * e.gain, l[3], l[4], l[5], l[6] ?? 1, at + (l[7] ?? 0));
    }
  }
  const buf = await off.startRendering();
  ({ ctx, master, noiseBuf, enabled } = keep);
  return [buf.getChannelData(0), buf.getChannelData(1)];
}
