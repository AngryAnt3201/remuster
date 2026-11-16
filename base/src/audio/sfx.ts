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
  s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05);
}

export function sfx(name: string, gain = 1) {
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
