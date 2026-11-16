// Synthesised sound effects (WebAudio, no files) with a per-sound rate limit so big fights don't turn to mush.

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

const GAP: Record<string, number> = { hit: 0.05, slash: 0.06, arrow: 0.07, squish: 0.08, heal: 0.15, down: 0.08, clank: 0.08 };

export function sfx(name: string, gain = 1) {
  if (!enabled || !ctx) return;
  const now = ctx.currentTime;
  if (now - (last.get(name) ?? -1) < (GAP[name] ?? 0.03)) return;
  last.set(name, now);
  const v = gain;
  switch (name) {
    case "slash": noise(0.09, 0.22 * v, "bandpass", 3200, 900, 1.5); break;
    case "hit": noise(0.05, 0.25 * v, "lowpass", 1800, 400); tone("square", 180, 90, 0.05, 0.05 * v); break;
    case "clank": tone("triangle", 1300, 900, 0.12, 0.12 * v); noise(0.05, 0.12 * v, "highpass", 4000, 3000); break;
    case "arrow": noise(0.12, 0.12 * v, "bandpass", 5000, 1500, 3); break;
    case "bolt": tone("sawtooth", 300, 60, 0.18, 0.12 * v); noise(0.14, 0.2 * v, "bandpass", 2400, 600, 2); break;
    case "throw": tone("sine", 500, 900, 0.12, 0.06 * v); break;
    case "pop": noise(0.35, 0.45 * v, "lowpass", 1600, 120); tone("sine", 120, 40, 0.3, 0.3 * v); break;
    case "boom": noise(0.8, 0.7 * v, "lowpass", 2200, 60); tone("sine", 90, 28, 0.7, 0.55 * v); break;
    case "slam": noise(0.3, 0.4 * v, "lowpass", 600, 80); tone("sine", 70, 35, 0.3, 0.35 * v); break;
    case "zap": tone("sawtooth", 1800, 200, 0.16, 0.12 * v); noise(0.18, 0.18 * v, "highpass", 3000, 6000); break;
    case "heal": tone("sine", 880, 1320, 0.18, 0.06 * v); tone("sine", 1320, 1760, 0.18, 0.04 * v, 0.06); break;
    case "blink": tone("sine", 300, 1400, 0.16, 0.1 * v); break;
    case "charge": noise(0.5, 0.2 * v, "lowpass", 400, 150); tone("triangle", 220, 330, 0.25, 0.08 * v); break;
    case "fuse": tone("square", 1400, 1400, 0.05, 0.06 * v); tone("square", 1400, 1400, 0.05, 0.06 * v, 0.12); break;
    case "down": tone("triangle", 260, 110, 0.18, 0.08 * v); break;
    case "squish": noise(0.06, 0.12 * v, "bandpass", 1200, 500, 4); break;
    case "crumble": noise(0.9, 0.5 * v, "lowpass", 900, 60); break;
    // UI
    case "tap": tone("triangle", 660, 760, 0.05, 0.05 * v); break;
    case "buy": tone("triangle", 880, 880, 0.06, 0.07 * v); tone("triangle", 1320, 1320, 0.08, 0.07 * v, 0.06); break;
    case "place": noise(0.07, 0.25 * v, "lowpass", 800, 150); tone("sine", 150, 80, 0.08, 0.15 * v); break;
    case "upgrade": [660, 880, 1100].forEach((f, i) => tone("triangle", f, f, 0.09, 0.07 * v, i * 0.07)); break;
    case "sell": tone("triangle", 900, 500, 0.12, 0.07 * v); break;
    case "deny": tone("square", 200, 150, 0.12, 0.06 * v); break;
    case "reroll": noise(0.2, 0.12 * v, "bandpass", 800, 3000, 2); break;
    case "fight": tone("sawtooth", 110, 220, 0.4, 0.12 * v); tone("sawtooth", 165, 330, 0.4, 0.08 * v); break;
    case "win": [523, 659, 784, 1047].forEach((f, i) => tone("triangle", f, f, 0.22, 0.09 * v, i * 0.11)); break;
    case "lose": [392, 330, 262].forEach((f, i) => tone("triangle", f, f * 0.98, 0.3, 0.09 * v, i * 0.16)); break;
    case "round": tone("triangle", 784, 784, 0.1, 0.07 * v); tone("triangle", 1047, 1047, 0.16, 0.07 * v, 0.1); break;
    case "hurt": noise(0.3, 0.35 * v, "lowpass", 900, 100); tone("sine", 110, 50, 0.3, 0.2 * v); break;
  }
}
