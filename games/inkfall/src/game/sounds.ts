// Inkfall's sound effects, as recipes for the little synth in base/src/audio/sfx.ts (WebAudio, no files).
// Each sound is a list of layers played together:
//   ["tone",  wave, startHz, endHz, seconds, loudness, delaySeconds?]        wave: sine | triangle | square | sawtooth
//   ["noise", seconds, loudness, filter, startHz, endHz, Q?, delaySeconds?]  filter: lowpass | highpass | bandpass
// The voices are a small percussion ensemble and a brush: woodblock clacks for hits and taps, a soft brush swish for
// blades and arrows, plucked strings (a quick falling triangle with a click) for magic and menus, a taiko thump for
// anything heavy, and a small bell for coins. Quiet and dry: forty of these can play in a second.
export type Layer =
  | ["tone", OscillatorType, number, number, number, number, number?]
  | ["noise", number, number, BiquadFilterType, number, number, number?, number?];

/** A plucked string at `hz`: a triangle that drops a hair in pitch, with a soft pick click. */
const pluck = (hz: number, len = 0.22, vol = 0.07, at = 0): Layer[] => [["tone", "triangle", hz * 1.012, hz, len, vol, at], ["noise", 0.012, vol * 0.9, "bandpass", hz * 3, hz * 2, 2, at]];
/** A woodblock: a short sine knock with a hard, narrow click. */
const block = (hz: number, vol = 0.1, at = 0): Layer[] => [["tone", "sine", hz, hz * 0.94, 0.045, vol, at], ["noise", 0.018, vol * 1.3, "bandpass", hz * 2.2, hz * 1.8, 6, at]];
/** A taiko: a low sine that falls, under a thud of skin. */
const taiko = (hz: number, len = 0.32, vol = 0.34, at = 0): Layer[] => [["tone", "sine", hz, hz * 0.52, len, vol, at], ["noise", 0.07, vol * 0.7, "lowpass", 700, 160, 1, at]];
/** A small bell: two high sines a fifth apart. */
const bell = (hz: number, len = 0.3, vol = 0.05, at = 0): Layer[] => [["tone", "sine", hz, hz, len, vol, at], ["tone", "sine", hz * 2.76, hz * 2.76, len * 0.6, vol * 0.45, at]];
/** A brush over paper: a breath of noise swept through a band. */
const swish = (len: number, vol: number, from: number, to: number, q = 1.2, at = 0): Layer[] => [["noise", len, vol, "bandpass", from, to, q, at]];

export const SOUNDS: Record<string, Layer[]> = {
  // battle
  slash: swish(0.11, 0.2, 2600, 700),
  hit: block(620, 0.11),
  clank: [...block(1180, 0.08), ["tone", "triangle", 1760, 1700, 0.07, 0.03]],
  arrow: swish(0.13, 0.11, 4200, 1300, 3),
  bolt: [...swish(0.16, 0.16, 1800, 500, 2), ["tone", "triangle", 196, 110, 0.14, 0.09]],
  throw: swish(0.14, 0.08, 500, 1500, 1.5),
  pop: [...taiko(150, 0.26, 0.3), ...swish(0.2, 0.2, 1400, 300, 0.8)],
  boom: [...taiko(98, 0.6, 0.5), ["noise", 0.55, 0.42, "lowpass", 1500, 70]],
  slam: taiko(82, 0.34, 0.4),
  zap: [...block(1560, 0.07), ["noise", 0.16, 0.15, "highpass", 2600, 5200], ["tone", "triangle", 1175, 587, 0.12, 0.05]],
  heal: [...pluck(880, 0.26, 0.05), ...pluck(1318.5, 0.3, 0.04, 0.07)],
  blink: [...swish(0.14, 0.09, 600, 2400, 2), ...pluck(1174.7, 0.16, 0.04, 0.04)],
  charge: [...taiko(110, 0.22, 0.22), ...taiko(110, 0.22, 0.24, 0.16), ...swish(0.4, 0.1, 300, 900, 0.8)],
  fuse: [...block(1900, 0.05), ...block(1900, 0.05, 0.12)],
  down: [["tone", "triangle", 293.7, 146.8, 0.2, 0.07], ["noise", 0.05, 0.06, "lowpass", 900, 300]],
  squish: swish(0.07, 0.12, 900, 400, 4),
  crumble: [["noise", 0.8, 0.42, "lowpass", 800, 60], ...taiko(70, 0.4, 0.3)],
  // UI
  tap: block(880, 0.07),
  buy: [...bell(1568, 0.3, 0.05), ...bell(2093, 0.36, 0.045, 0.07)],
  place: [...block(440, 0.1), ["tone", "sine", 140, 80, 0.07, 0.12]],
  upgrade: [...pluck(587.3, 0.2, 0.065), ...pluck(784, 0.2, 0.065, 0.08), ...pluck(1174.7, 0.34, 0.065, 0.16), ...bell(2349, 0.3, 0.025, 0.16)],
  sell: [...bell(1318.5, 0.2, 0.045), ...bell(987.8, 0.26, 0.045, 0.07)],
  deny: [...block(240, 0.09), ...block(220, 0.09, 0.09)],
  reroll: [...swish(0.2, 0.12, 700, 2600, 2), ...block(990, 0.05, 0.16)],
  fight: [...taiko(98, 0.3, 0.36), ...taiko(98, 0.3, 0.3, 0.2), ...taiko(73.4, 0.6, 0.44, 0.4), ...block(1100, 0.06, 0.4)],
  win: [...pluck(587.3, 0.3, 0.08), ...pluck(784, 0.3, 0.08, 0.13), ...pluck(880, 0.3, 0.08, 0.26), ...pluck(1174.7, 0.6, 0.085, 0.39), ...bell(2349, 0.5, 0.03, 0.39), ...taiko(98, 0.4, 0.22, 0.39)],
  lose: [...pluck(440, 0.4, 0.08), ...pluck(349.2, 0.4, 0.08, 0.2), ...pluck(293.7, 0.7, 0.08, 0.4), ...taiko(73.4, 0.6, 0.26, 0.4)],
  round: [...block(784, 0.07), ...block(1174.7, 0.07, 0.11)],
  hurt: [...taiko(104, 0.3, 0.32), ["noise", 0.22, 0.2, "lowpass", 700, 120]],
};

export const GAPS: Record<string, number> = { hit: 0.05, slash: 0.06, arrow: 0.07, squish: 0.08, heal: 0.15, down: 0.08, clank: 0.08 };
