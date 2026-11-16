// The soundtrack player: one cue at a time, crossfaded, on the same audio context as the sound effects.
// Which file each cue plays comes from ../game/music.ts, which a game can replace.
import { MUSIC, type Cue, type Track } from "../game/music";
import { audioContext } from "./sfx";

const FADE = 0.7; // seconds
const LEAD = 0.25; // where the loop window starts inside the file's wrap-around lead-in
const VOLUME = 0.42;

let on = true;
let want: Cue | null = null;
let playing: { cue: Cue; src: AudioBufferSourceNode; gain: GainNode } | null = null;
let bus: GainNode | null = null;
let token = 0;
const base = () => (import.meta as any).env?.BASE_URL ?? "./";

function busNode(ctx: AudioContext) {
  if (!bus || bus.context !== ctx) { bus = ctx.createGain(); bus.gain.value = VOLUME; bus.connect(ctx.destination); }
  return bus;
}

function stop(fade = FADE) {
  const p = playing, ctx = audioContext();
  playing = null;
  if (!p || !ctx) return;
  const t = ctx.currentTime;
  p.gain.gain.cancelScheduledValues(t);
  p.gain.gain.setValueAtTime(p.gain.gain.value, t);
  p.gain.gain.linearRampToValueAtTime(0, t + fade);
  p.src.stop(t + fade + 0.05);
}

const trackFor = (cue: Cue): Track | undefined => MUSIC[cue] ?? (cue === "boss" || cue === "arena" ? MUSIC.battle : undefined);

async function start(cue: Cue) {
  const ctx = audioContext(), tr = trackFor(cue);
  if (!ctx || !tr) { stop(); return; }
  const mine = ++token;
  let buf: AudioBuffer;
  try {
    const data = await (await fetch(`${base()}music/${tr.file}`)).arrayBuffer();
    buf = await ctx.decodeAudioData(data);
  } catch { return; }
  if (mine !== token || want !== cue || !on) return; // another cue was asked for while this one loaded
  stop();
  const src = ctx.createBufferSource(), gain = ctx.createGain();
  src.buffer = buf;
  if (tr.loop > 0) { src.loop = true; src.loopStart = LEAD; src.loopEnd = Math.min(buf.duration, LEAD + tr.loop); }
  const t = ctx.currentTime;
  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(tr.gain ?? 1, t + (tr.loop > 0 ? FADE : 0.02));
  src.connect(gain).connect(busNode(ctx));
  src.start(t, tr.loop > 0 ? LEAD : 0);
  playing = { cue, src, gain };
  src.onended = () => { if (playing?.src === src) playing = null; };
}

/** Ask for a cue (null = silence). Asking for the cue that is already playing does nothing, so screens can call
 *  this every time they open. Before the first tap unlocks audio the request is remembered and starts then. */
export function playMusic(cue: Cue | null) {
  want = cue;
  if (!on || !cue) { stop(); return; }
  const same = (c: Cue) => trackFor(c)?.file;
  if (playing && same(playing.cue) === same(cue)) { playing.cue = cue; return; }
  void start(cue);
}

export function setMusic(v: boolean) {
  on = v;
  if (!v) stop(0.2);
  else if (want) void start(want);
}
export const musicOn = () => on;
/** Call once audio is unlocked (first tap): starts whatever cue was asked for before then. */
export function resumeMusic() { if (on && want && !playing) void start(want); }
/** Whether this game ships any music at all (the settings sheet hides the switch otherwise). */
export const hasMusic = () => Object.keys(MUSIC).length > 0;
