// Blackridge's sound effects, as recipes for the little synth in base/src/audio/sfx.ts (WebAudio, no files).
// Each sound is a list of layers played together:
//   ["tone",  wave, startHz, endHz, seconds, loudness, delaySeconds?]        wave: sine | triangle | square | sawtooth
//   ["noise", seconds, loudness, filter, startHz, endHz, Q?, delaySeconds?]  filter: lowpass | highpass | bandpass
// The names are fixed (the game asks for them by name). The world is a drone feed over a modern battlefield, so:
// gunfire is a bright crack over a sine thump, explosions are a crack, a long low-passed roar and a sub drop, and
// everything the interface says is a radio or terminal: short square or sine chirps and band-passed squelch bursts.
// No triangle arpeggios anywhere. Loudness is kept low on anything a fight repeats (the bus is compressed).
// `GAPS` is the shortest time between two plays of the same sound, so a big fight doesn't turn to mush.
export type Layer =
  | ["tone", OscillatorType, number, number, number, number, number?]
  | ["noise", number, number, BiquadFilterType, number, number, number?, number?];

export const SOUNDS: Record<string, Layer[]> = {
  // battle
  // knife or baton: a quick air swish, high to low
  slash: [["noise", 0.07, 0.15, "bandpass", 5200, 1400, 2.5], ["noise", 0.02, 0.05, "highpass", 6500, 5000]],
  // bullet impact: a dry tick and a small body thud
  hit: [["noise", 0.035, 0.2, "bandpass", 2600, 700, 1.2], ["tone", "sine", 140, 60, 0.06, 0.12]],
  // a round off plate: a short ring and spark
  clank: [["tone", "square", 1900, 1400, 0.05, 0.045], ["tone", "sine", 3100, 2500, 0.14, 0.05], ["noise", 0.04, 0.11, "highpass", 5000, 3500]],
  // rifle shot: sharp crack, short report, low thump
  arrow: [["noise", 0.03, 0.22, "highpass", 2800, 1200], ["noise", 0.11, 0.12, "bandpass", 1500, 350, 0.8], ["tone", "sine", 150, 48, 0.09, 0.18]],
  // heavy gun: a bigger crack, a long report and a deep thump
  bolt: [["noise", 0.05, 0.26, "highpass", 1800, 700], ["noise", 0.3, 0.24, "lowpass", 1400, 90], ["tone", "sine", 95, 32, 0.28, 0.3], ["tone", "square", 70, 40, 0.08, 0.05]],
  // a thrown charge: a pin tick and a rising whoosh
  throw: [["tone", "square", 2400, 2400, 0.02, 0.03], ["noise", 0.16, 0.09, "bandpass", 500, 1600, 2]],
  // small explosion: crack, roar, sub thump
  pop: [["noise", 0.02, 0.26, "highpass", 2000, 900], ["noise", 0.32, 0.38, "lowpass", 1800, 90], ["tone", "sine", 110, 34, 0.3, 0.32]],
  // big explosion: the same, longer and lower, with falling debris
  boom: [["noise", 0.03, 0.32, "highpass", 1500, 600], ["noise", 0.9, 0.58, "lowpass", 2400, 50], ["tone", "sine", 80, 24, 0.8, 0.55], ["noise", 0.5, 0.11, "bandpass", 600, 150, 0.7, 0.12]],
  // a heavy body or shell on the ground
  slam: [["noise", 0.28, 0.36, "lowpass", 500, 60], ["tone", "sine", 62, 28, 0.34, 0.38], ["tone", "square", 120, 50, 0.06, 0.05]],
  // electrical arc: mains buzz, a falling snap and two bursts of hiss
  zap: [["tone", "sawtooth", 110, 95, 0.2, 0.09], ["tone", "square", 2400, 600, 0.09, 0.05], ["noise", 0.05, 0.18, "highpass", 5000, 8000], ["noise", 0.06, 0.12, "highpass", 6000, 4000, 1, 0.08]],
  // medical monitor: two soft sine beeps, low then high
  heal: [["tone", "sine", 880, 880, 0.09, 0.055], ["tone", "sine", 1175, 1175, 0.12, 0.05, 0.11]],
  // a fast flank move: a rising whoosh over a short drop
  blink: [["noise", 0.14, 0.11, "bandpass", 700, 3200, 3], ["tone", "sine", 420, 180, 0.1, 0.05]],
  // engine rev with three rotor thumps
  charge: [["tone", "sawtooth", 55, 150, 0.45, 0.09], ["noise", 0.45, 0.15, "lowpass", 250, 700], ["tone", "sine", 70, 58, 0.07, 0.15], ["tone", "sine", 70, 58, 0.07, 0.15, 0.12], ["tone", "sine", 70, 58, 0.07, 0.15, 0.24]],
  // arming beeps, speeding up
  fuse: [["tone", "square", 1900, 1900, 0.04, 0.05], ["tone", "square", 1900, 1900, 0.04, 0.05, 0.11], ["tone", "square", 1900, 1900, 0.04, 0.05, 0.18]],
  // a soldier down: a soft thud
  down: [["noise", 0.1, 0.13, "lowpass", 500, 90], ["tone", "sine", 130, 55, 0.16, 0.09]],
  // a small bot crushed: a crunch and a dying chirp
  squish: [["noise", 0.05, 0.12, "bandpass", 2400, 800, 3], ["tone", "square", 900, 300, 0.04, 0.03]],
  // a structure coming down: long rubble, a sub drop, a late clatter
  crumble: [["noise", 1.0, 0.48, "lowpass", 1100, 50], ["tone", "sine", 60, 26, 0.6, 0.28], ["noise", 0.3, 0.11, "bandpass", 2200, 500, 1, 0.15]],
  // UI: a radio handset and a terminal
  // key click
  tap: [["tone", "square", 1500, 1500, 0.025, 0.03], ["noise", 0.012, 0.045, "highpass", 6000, 6000]],
  // requisition confirmed: two rising blips and a squelch tail
  buy: [["tone", "square", 1200, 1200, 0.04, 0.04], ["tone", "square", 1800, 1800, 0.05, 0.04, 0.055], ["noise", 0.03, 0.05, "bandpass", 3000, 3000, 2, 0.11]],
  // kit on the ground, with a position blip
  place: [["noise", 0.06, 0.2, "lowpass", 700, 140], ["tone", "sine", 140, 70, 0.08, 0.14], ["tone", "square", 2000, 2000, 0.02, 0.025, 0.03]],
  // data burst: two ticks, then a rising sine sweep under hiss
  upgrade: [["tone", "square", 1000, 1000, 0.03, 0.04], ["tone", "square", 1000, 1000, 0.03, 0.04, 0.05], ["tone", "sine", 1600, 2400, 0.12, 0.05, 0.1], ["noise", 0.05, 0.045, "highpass", 5000, 7000, 1, 0.1]],
  // a falling blip and a short squelch
  sell: [["tone", "square", 1300, 650, 0.07, 0.04], ["noise", 0.04, 0.055, "bandpass", 2000, 900, 2, 0.05]],
  // refused: a low double buzz
  deny: [["tone", "square", 170, 160, 0.07, 0.06], ["tone", "square", 170, 160, 0.09, 0.06, 0.1]],
  // retuning the radio: a squelch sweep and a lock blip
  reroll: [["noise", 0.16, 0.11, "bandpass", 900, 3800, 3], ["tone", "square", 1700, 1700, 0.025, 0.035, 0.15]],
  // radio squelch and a key-up blip, then five rotor thumps over a low wash
  fight: [["noise", 0.09, 0.15, "bandpass", 2400, 1800, 2], ["tone", "square", 1100, 1100, 0.05, 0.04, 0.09], ["noise", 0.55, 0.08, "lowpass", 300, 200, 1, 0.16], ["tone", "sine", 75, 45, 0.09, 0.24, 0.16], ["tone", "sine", 75, 45, 0.09, 0.24, 0.27], ["tone", "sine", 75, 45, 0.09, 0.24, 0.38], ["tone", "sine", 75, 45, 0.09, 0.24, 0.49], ["tone", "sine", 75, 45, 0.09, 0.22, 0.6]],
  // terminal confirmation: two ticks, one held tone, squelch out
  win: [["tone", "square", 1320, 1320, 0.05, 0.045], ["tone", "square", 1320, 1320, 0.05, 0.045, 0.09], ["tone", "sine", 1760, 1760, 0.3, 0.07, 0.18], ["noise", 0.06, 0.05, "bandpass", 2600, 2600, 2, 0.5]],
  // terminal failure: two falling ticks, a low sagging tone, static
  lose: [["tone", "square", 440, 440, 0.09, 0.05], ["tone", "square", 330, 330, 0.09, 0.05, 0.14], ["tone", "sine", 165, 150, 0.4, 0.09, 0.28], ["noise", 0.25, 0.07, "bandpass", 1800, 500, 1.5, 0.3]],
  // new round: squelch, then two ticks on one pitch
  round: [["noise", 0.04, 0.08, "bandpass", 2400, 2400, 2], ["tone", "square", 1500, 1500, 0.04, 0.04, 0.05], ["tone", "square", 1500, 1500, 0.07, 0.04, 0.12]],
  // the command post is hit: crack, rumble, sub, and an alarm tick
  hurt: [["noise", 0.03, 0.2, "highpass", 1500, 700], ["noise", 0.3, 0.33, "lowpass", 800, 90], ["tone", "sine", 95, 42, 0.3, 0.22], ["tone", "square", 700, 700, 0.06, 0.03, 0.1]],
};

export const GAPS: Record<string, number> = { hit: 0.06, slash: 0.07, arrow: 0.09, bolt: 0.12, clank: 0.09, squish: 0.08, heal: 0.2, down: 0.1, zap: 0.1, pop: 0.08, throw: 0.06 };
