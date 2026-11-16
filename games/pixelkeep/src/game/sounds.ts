// Pixelkeep's sound effects: a console's sound chip. Two square-wave channels, a triangle bass and a noise channel,
// nothing else. Blows are a short noise burst over a falling square blip, shots are fast upward or downward square
// sweeps, magic is an arpeggio, and the jingles (buy, upgrade, win, lose, round) are three or four square notes.
// Recipes for the little synth in ../audio/sfx.ts (WebAudio, no files):
//   ["tone",  wave, startHz, endHz, seconds, loudness, delaySeconds?]
//   ["noise", seconds, loudness, filter, startHz, endHz, Q?, delaySeconds?]
// Square waves are loud for their peak, so levels are kept low: forty of these can play in a second.
export type Layer =
  | ["tone", OscillatorType, number, number, number, number, number?]
  | ["noise", number, number, BiquadFilterType, number, number, number?, number?];

/** A run of square notes, each `len` long and `gap` apart (an arpeggio or a jingle). */
const arp = (notes: number[], len: number, gap: number, vol: number, wave: OscillatorType = "square"): Layer[] =>
  notes.map((f, i): Layer => ["tone", wave, f, f, len, vol, +(i * gap).toFixed(3)]);

// note frequencies
const C4 = 261.6, E4 = 329.6, G4 = 392, A4 = 440, C5 = 523.3, D5 = 587.3, E5 = 659.3, G5 = 784, A5 = 880, C6 = 1046.5, E6 = 1318.5, G6 = 1568;

export const SOUNDS: Record<string, Layer[]> = {
  // ---- battle
  // a sword: a tick of the noise channel and a falling blip
  slash: [["noise", 0.045, 0.14, "highpass", 5000, 2500], ["tone", "square", 1100, 500, 0.05, 0.035]],
  // a blow landing: low noise thud and a short square drop
  hit: [["noise", 0.05, 0.2, "lowpass", 1400, 300], ["tone", "square", 240, 90, 0.06, 0.05]],
  // a block: two bright square pings
  clank: [["tone", "square", 1760, 1760, 0.04, 0.045], ["tone", "square", 2349, 2349, 0.06, 0.04, 0.035]],
  // an arrow: a quick falling chirp
  arrow: [["tone", "square", 1600, 700, 0.07, 0.04]],
  // a cannon shot: a square dive and a burst of noise
  bolt: [["tone", "square", 520, 70, 0.16, 0.07], ["noise", 0.12, 0.18, "lowpass", 2400, 300]],
  // a throw: a rising whoop
  throw: [["tone", "square", 330, 990, 0.12, 0.035]],
  // a small blast
  pop: [["noise", 0.22, 0.32, "lowpass", 2600, 150], ["tone", "square", 220, 50, 0.2, 0.07]],
  // the big blast: the noise channel falling all the way down, with a triangle rumble under it
  boom: [["noise", 0.6, 0.5, "lowpass", 4000, 80], ["tone", "triangle", 110, 30, 0.5, 0.35], ["tone", "square", 180, 40, 0.3, 0.06]],
  // a heavy landing
  slam: [["noise", 0.2, 0.34, "lowpass", 700, 80], ["tone", "triangle", 90, 36, 0.24, 0.3]],
  // lightning: a fast two-note trill, falling
  zap: [...arp([1976, 1319, 1976, 1319, 988], 0.03, 0.028, 0.04), ["noise", 0.1, 0.08, "highpass", 6000, 3000]],
  // a heal: three notes up
  heal: arp([E5, G5, C6], 0.06, 0.05, 0.035),
  // a warp: an octave leap
  blink: [["tone", "square", 440, 1760, 0.1, 0.04], ["tone", "square", 1760, 1760, 0.05, 0.03, 0.1]],
  // a charge: a rising growl on the triangle and a hoof-beat of noise
  charge: [["tone", "triangle", 110, 330, 0.3, 0.2], ["noise", 0.05, 0.14, "lowpass", 900, 300], ["noise", 0.05, 0.14, "lowpass", 900, 300, 1, 0.12]],
  // a fuse: two short high beeps
  fuse: [["tone", "square", 1568, 1568, 0.04, 0.04], ["tone", "square", 1568, 1568, 0.04, 0.04, 0.1]],
  // a body going down: a falling slide
  down: [["tone", "square", 520, 110, 0.16, 0.045]],
  // a slime: a wobble
  squish: [["tone", "square", 300, 600, 0.04, 0.035], ["tone", "square", 600, 250, 0.05, 0.035, 0.04]],
  // a building coming apart: noise in three steps down
  crumble: [["noise", 0.2, 0.34, "lowpass", 1800, 600], ["noise", 0.2, 0.3, "lowpass", 900, 300, 1, 0.16], ["noise", 0.4, 0.3, "lowpass", 500, 60, 1, 0.32], ["tone", "triangle", 90, 30, 0.6, 0.25]],
  // a keep taking a hit
  hurt: [["noise", 0.18, 0.3, "lowpass", 1000, 120], ["tone", "square", 196, 98, 0.2, 0.07]],
  // ---- interface
  // moving the menu cursor
  tap: [["tone", "square", 988, 988, 0.03, 0.04]],
  // a coin: the classic two-note ping
  buy: [["tone", "square", 988, 988, 0.06, 0.045], ["tone", "square", 1319, 1319, 0.22, 0.045, 0.06]],
  // setting a unit down
  place: [["tone", "square", 220, 110, 0.06, 0.06], ["noise", 0.04, 0.12, "lowpass", 800, 200]],
  // a level up: a fast run up the chord
  upgrade: arp([C5, E5, G5, C6, E6, G6], 0.06, 0.045, 0.04),
  // selling: the coin, backwards
  sell: [["tone", "square", 1319, 1319, 0.06, 0.04], ["tone", "square", 988, 988, 0.12, 0.04, 0.06]],
  // not allowed: a low double buzz
  deny: [["tone", "square", 130, 130, 0.07, 0.06], ["tone", "square", 130, 130, 0.1, 0.06, 0.1]],
  // shuffling the shop: a quick random-sounding run
  reroll: arp([659, 988, 784, 1175, 880, 1319], 0.03, 0.03, 0.035),
  // START: a rising fanfare of four notes with a bass note under it
  fight: [...arp([G4, C5, E5, G5], 0.09, 0.07, 0.05), ["tone", "triangle", 130.8, 130.8, 0.4, 0.2]],
  // stage clear
  win: [...arp([C5, E5, G5, C6, G5, C6], 0.11, 0.09, 0.05), ...arp([C4, G4, C5], 0.2, 0.18, 0.14, "triangle")],
  // game over: a slow fall
  lose: [...arp([G4, E4, C4, 196, 130.8], 0.2, 0.17, 0.05), ["tone", "triangle", 98, 49, 0.9, 0.16, 0.5]],
  // a new round
  round: arp([A4, D5, A5], 0.07, 0.06, 0.045),
};

export const GAPS: Record<string, number> = { hit: 0.06, slash: 0.07, arrow: 0.08, squish: 0.09, heal: 0.18, down: 0.09, clank: 0.09, zap: 0.12, bolt: 0.08 };
