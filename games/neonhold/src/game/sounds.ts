// This game's sound effects, as recipes for the little synth in ../audio/sfx.ts (WebAudio, no files).
// Each sound is a list of layers played together:
//   ["tone",  wave, startHz, endHz, seconds, loudness, delaySeconds?]        wave: sine | triangle | square | sawtooth
//   ["noise", seconds, loudness, filter, startHz, endHz, Q?, delaySeconds?]  filter: lowpass | highpass | bandpass
// The names are fixed (the game asks for them by name); what each one sounds like is entirely the game's choice.
// A game shadows this file (games/<id>/src/game/sounds.ts) to re-voice everything: gunshots for arrows, steam hisses
// for heals, a honky-tonk run for a win. `GAPS` is the shortest time between two plays of the same sound, so a big
// fight doesn't turn to mush.
export type Layer =
  | ["tone", OscillatorType, number, number, number, number, number?]
  | ["noise", number, number, BiquadFilterType, number, number, number?, number?];

export const SOUNDS: Record<string, Layer[]> = {
  // battle
  slash: [["noise", 0.09, 0.22, "bandpass", 3200, 900, 1.5]],
  hit: [["noise", 0.05, 0.25, "lowpass", 1800, 400], ["tone", "square", 180, 90, 0.05, 0.05]],
  clank: [["tone", "triangle", 1300, 900, 0.12, 0.12], ["noise", 0.05, 0.12, "highpass", 4000, 3000]],
  arrow: [["noise", 0.12, 0.12, "bandpass", 5000, 1500, 3]],
  bolt: [["tone", "sawtooth", 300, 60, 0.18, 0.12], ["noise", 0.14, 0.2, "bandpass", 2400, 600, 2]],
  throw: [["tone", "sine", 500, 900, 0.12, 0.06]],
  pop: [["noise", 0.35, 0.45, "lowpass", 1600, 120], ["tone", "sine", 120, 40, 0.3, 0.3]],
  boom: [["noise", 0.8, 0.7, "lowpass", 2200, 60], ["tone", "sine", 90, 28, 0.7, 0.55]],
  slam: [["noise", 0.3, 0.4, "lowpass", 600, 80], ["tone", "sine", 70, 35, 0.3, 0.35]],
  zap: [["tone", "sawtooth", 1800, 200, 0.16, 0.12], ["noise", 0.18, 0.18, "highpass", 3000, 6000]],
  heal: [["tone", "sine", 880, 1320, 0.18, 0.06], ["tone", "sine", 1320, 1760, 0.18, 0.04, 0.06]],
  blink: [["tone", "sine", 300, 1400, 0.16, 0.1]],
  charge: [["noise", 0.5, 0.2, "lowpass", 400, 150], ["tone", "triangle", 220, 330, 0.25, 0.08]],
  fuse: [["tone", "square", 1400, 1400, 0.05, 0.06], ["tone", "square", 1400, 1400, 0.05, 0.06, 0.12]],
  down: [["tone", "triangle", 260, 110, 0.18, 0.08]],
  squish: [["noise", 0.06, 0.12, "bandpass", 1200, 500, 4]],
  crumble: [["noise", 0.9, 0.5, "lowpass", 900, 60]],
  // UI
  tap: [["tone", "triangle", 660, 760, 0.05, 0.05]],
  buy: [["tone", "triangle", 880, 880, 0.06, 0.07], ["tone", "triangle", 1320, 1320, 0.08, 0.07, 0.06]],
  place: [["noise", 0.07, 0.25, "lowpass", 800, 150], ["tone", "sine", 150, 80, 0.08, 0.15]],
  upgrade: [["tone", "triangle", 660, 660, 0.09, 0.07, 0.0], ["tone", "triangle", 880, 880, 0.09, 0.07, 0.07], ["tone", "triangle", 1100, 1100, 0.09, 0.07, 0.14]],
  sell: [["tone", "triangle", 900, 500, 0.12, 0.07]],
  deny: [["tone", "square", 200, 150, 0.12, 0.06]],
  reroll: [["noise", 0.2, 0.12, "bandpass", 800, 3000, 2]],
  fight: [["tone", "sawtooth", 110, 220, 0.4, 0.12], ["tone", "sawtooth", 165, 330, 0.4, 0.08]],
  win: [["tone", "triangle", 523, 523, 0.22, 0.09, 0.0], ["tone", "triangle", 659, 659, 0.22, 0.09, 0.11], ["tone", "triangle", 784, 784, 0.22, 0.09, 0.22], ["tone", "triangle", 1047, 1047, 0.22, 0.09, 0.33]],
  lose: [["tone", "triangle", 392, 384.2, 0.3, 0.09, 0.0], ["tone", "triangle", 330, 323.4, 0.3, 0.09, 0.16], ["tone", "triangle", 262, 256.8, 0.3, 0.09, 0.32]],
  round: [["tone", "triangle", 784, 784, 0.1, 0.07], ["tone", "triangle", 1047, 1047, 0.16, 0.07, 0.1]],
  hurt: [["noise", 0.3, 0.35, "lowpass", 900, 100], ["tone", "sine", 110, 50, 0.3, 0.2]],};

export const GAPS: Record<string, number> = { hit: 0.05, slash: 0.06, arrow: 0.07, squish: 0.08, heal: 0.15, down: 0.08, clank: 0.08 };
