// Neonhold's sound effects (lasers, synth blips, sub drops, glitch ticks), as recipes for the little synth in ../audio/sfx.ts (WebAudio, no files).
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
  // battle: everything is a synth. Blades are filtered-noise swishes with a ring, guns are pitch-dropping lasers,
  // explosions are sub drops under a burst of bit-noise.
  slash: [["noise", 0.07, 0.16, "bandpass", 6200, 2200, 2.5], ["tone", "sawtooth", 1900, 700, 0.06, 0.04]],
  hit: [["tone", "square", 260, 70, 0.06, 0.07], ["noise", 0.04, 0.16, "highpass", 2600, 5200]],
  clank: [["tone", "square", 1760, 1320, 0.07, 0.06], ["tone", "triangle", 2640, 2640, 0.1, 0.05, 0.01], ["noise", 0.03, 0.08, "highpass", 6000, 8000]],
  arrow: [["tone", "sawtooth", 2400, 520, 0.09, 0.07], ["tone", "square", 1200, 300, 0.07, 0.03]],
  bolt: [["tone", "sawtooth", 1500, 110, 0.24, 0.11], ["tone", "square", 3000, 400, 0.12, 0.04], ["noise", 0.1, 0.1, "bandpass", 3800, 900, 3]],
  throw: [["tone", "triangle", 420, 1100, 0.13, 0.06], ["tone", "square", 840, 1680, 0.06, 0.02, 0.05]],
  pop: [["tone", "sine", 220, 44, 0.3, 0.3], ["noise", 0.22, 0.3, "lowpass", 3200, 200], ["tone", "square", 880, 110, 0.12, 0.05]],
  boom: [["tone", "sine", 130, 26, 0.9, 0.55], ["tone", "sawtooth", 65, 30, 0.5, 0.14], ["noise", 0.6, 0.42, "lowpass", 4200, 80], ["noise", 0.08, 0.12, "highpass", 5000, 2000]],
  slam: [["tone", "sine", 98, 30, 0.36, 0.42], ["tone", "square", 49, 36, 0.22, 0.08], ["noise", 0.16, 0.28, "lowpass", 900, 90]],
  zap: [["tone", "sawtooth", 3200, 180, 0.14, 0.1], ["tone", "square", 95, 190, 0.16, 0.06], ["noise", 0.16, 0.16, "bandpass", 7000, 2400, 6]],
  heal: [["tone", "sine", 660, 660, 0.12, 0.05], ["tone", "sine", 990, 990, 0.12, 0.05, 0.07], ["tone", "triangle", 1320, 1980, 0.2, 0.04, 0.14]],
  blink: [["tone", "square", 220, 1760, 0.1, 0.05], ["tone", "sine", 1760, 2640, 0.08, 0.05, 0.08], ["noise", 0.05, 0.06, "highpass", 7000, 9000]],
  charge: [["tone", "sawtooth", 82, 330, 0.45, 0.1], ["tone", "square", 164, 660, 0.45, 0.03], ["noise", 0.4, 0.12, "bandpass", 300, 1800, 2]],
  fuse: [["tone", "square", 1976, 1976, 0.035, 0.05], ["tone", "square", 2637, 2637, 0.035, 0.05, 0.09], ["tone", "square", 1976, 1976, 0.035, 0.05, 0.18]],
  down: [["tone", "square", 330, 82, 0.2, 0.05], ["noise", 0.08, 0.06, "bandpass", 2400, 600, 5, 0.04]],
  squish: [["tone", "square", 700, 180, 0.05, 0.05], ["noise", 0.04, 0.08, "bandpass", 3000, 1400, 6]],
  crumble: [["noise", 0.7, 0.42, "lowpass", 2600, 70], ["tone", "sawtooth", 180, 40, 0.5, 0.1], ["noise", 0.3, 0.12, "highpass", 5000, 9000, 1, 0.05]],
  // UI: short square and triangle blips on the home key (D minor, like the soundtrack)
  tap: [["tone", "square", 1175, 1175, 0.03, 0.03], ["tone", "triangle", 587, 587, 0.05, 0.04]],
  buy: [["tone", "square", 587, 587, 0.05, 0.04], ["tone", "square", 880, 880, 0.05, 0.04, 0.05], ["tone", "triangle", 1175, 1175, 0.1, 0.06, 0.1]],
  place: [["tone", "sine", 196, 73, 0.1, 0.2], ["tone", "square", 1175, 587, 0.05, 0.03], ["noise", 0.04, 0.1, "highpass", 4000, 7000]],
  upgrade: [["tone", "sawtooth", 294, 294, 0.07, 0.05], ["tone", "sawtooth", 440, 440, 0.07, 0.05, 0.06], ["tone", "sawtooth", 587, 587, 0.07, 0.05, 0.12], ["tone", "triangle", 880, 1760, 0.2, 0.06, 0.18]],
  sell: [["tone", "square", 880, 587, 0.06, 0.04], ["tone", "square", 587, 294, 0.1, 0.04, 0.06]],
  deny: [["tone", "sawtooth", 147, 139, 0.09, 0.07], ["tone", "sawtooth", 147, 131, 0.12, 0.07, 0.11]],
  reroll: [["tone", "square", 440, 440, 0.03, 0.03], ["tone", "square", 660, 660, 0.03, 0.03, 0.04], ["tone", "square", 523, 523, 0.03, 0.03, 0.08], ["tone", "square", 784, 784, 0.03, 0.03, 0.12], ["noise", 0.16, 0.05, "bandpass", 1200, 5000, 3]],
  fight: [["tone", "sawtooth", 73, 147, 0.5, 0.13], ["tone", "sawtooth", 110, 220, 0.5, 0.08], ["tone", "square", 294, 587, 0.5, 0.03], ["noise", 0.5, 0.1, "highpass", 2000, 9000]],
  // a rising D minor arpeggio that lands on a held ninth
  win: [["tone", "sawtooth", 294, 294, 0.12, 0.06, 0.0], ["tone", "sawtooth", 349, 349, 0.12, 0.06, 0.09], ["tone", "sawtooth", 440, 440, 0.12, 0.06, 0.18], ["tone", "sawtooth", 587, 587, 0.12, 0.06, 0.27], ["tone", "sawtooth", 698, 698, 0.12, 0.06, 0.36], ["tone", "sawtooth", 880, 880, 0.12, 0.06, 0.45], ["tone", "triangle", 1175, 1175, 0.5, 0.08, 0.54], ["tone", "sine", 147, 147, 0.6, 0.12, 0.54]],
  // a detuned fall: two saws drifting apart as they drop
  lose: [["tone", "sawtooth", 440, 415, 0.3, 0.06, 0.0], ["tone", "sawtooth", 349, 320, 0.3, 0.06, 0.18], ["tone", "sawtooth", 294, 262, 0.34, 0.06, 0.36], ["tone", "sawtooth", 220, 130, 0.7, 0.07, 0.56], ["tone", "sawtooth", 226, 120, 0.7, 0.05, 0.56], ["tone", "sine", 73, 49, 0.7, 0.14, 0.56]],
  round: [["tone", "square", 587, 587, 0.06, 0.04], ["tone", "square", 880, 880, 0.06, 0.04, 0.07], ["tone", "triangle", 1175, 1175, 0.14, 0.06, 0.14]],
  hurt: [["tone", "sine", 147, 41, 0.34, 0.24], ["tone", "sawtooth", 220, 55, 0.2, 0.07], ["noise", 0.2, 0.26, "lowpass", 1800, 120]],
};

export const GAPS: Record<string, number> = { hit: 0.05, slash: 0.06, arrow: 0.07, squish: 0.08, heal: 0.15, down: 0.08, clank: 0.08 };
