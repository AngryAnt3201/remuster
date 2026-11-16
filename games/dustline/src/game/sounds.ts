// Dustline's sound effects, as recipes for the little synth in base/src/audio/sfx.ts (WebAudio, no files).
// Each sound is a list of layers played together:
//   ["tone",  wave, startHz, endHz, seconds, loudness, delaySeconds?]        wave: sine | triangle | square | sawtooth
//   ["noise", seconds, loudness, filter, startHz, endHz, Q?, delaySeconds?]  filter: lowpass | highpass | bandpass
// The names are the engine's; the voices are the frontier's: rifle cracks for arrows, the long whine of a ricochet
// off a wall, a bullwhip for the call to fight, boots and spurs when a unit is set down, a riffled deck for the
// redeal, a cash drawer for a purchase, and a honky-tonk piano (every note struck twice, a hair out of tune) for
// promotions and the win. Peaks are kept low: forty of these can play in a second.
export type Layer =
  | ["tone", OscillatorType, number, number, number, number, number?]
  | ["noise", number, number, BiquadFilterType, number, number, number?, number?];

/** One honky-tonk piano note: two strings a few cents apart, a soft hammer knock. */
const key = (hz: number, at: number, len = 0.2, vol = 0.06): Layer[] => [
  ["tone", "triangle", hz, hz, len, vol, at],
  ["tone", "square", hz * 1.008, hz * 1.008, len * 0.8, vol * 0.3, at],
  ["noise", 0.012, vol * 0.8, "bandpass", 2600, 1800, 2, at],
];
const C4 = 261.63, E4 = 329.63, G4 = 392, A4 = 440, C5 = 523.25, D5 = 587.33, E5 = 659.25, G5 = 783.99, A5 = 880, C6 = 1046.5, Eb5 = 622.25;

export const SOUNDS: Record<string, Layer[]> = {
  // ---- battle
  // a bowie knife through the air
  slash: [["noise", 0.08, 0.2, "bandpass", 4200, 1200, 1.4], ["noise", 0.03, 0.08, "highpass", 6000, 7000, 1, 0.03]],
  // a fist or a rifle butt: a dull knock and a slap
  hit: [["noise", 0.045, 0.24, "lowpass", 1500, 320], ["tone", "sine", 150, 70, 0.06, 0.09]],
  // a ricochet: a tick off the wall and the long falling whine
  clank: [["noise", 0.02, 0.2, "highpass", 5000, 4000], ["tone", "sine", 2600, 1100, 0.3, 0.07, 0.01], ["tone", "sine", 2640, 1080, 0.26, 0.03, 0.03]],
  // a rifle shot: the crack, then the report rolling off
  arrow: [["noise", 0.035, 0.34, "highpass", 2400, 900], ["noise", 0.16, 0.16, "bandpass", 1300, 320, 0.8, 0.02], ["tone", "square", 170, 60, 0.05, 0.06]],
  // the Buffalo Gun: a deeper, longer boom
  bolt: [["noise", 0.05, 0.36, "highpass", 1600, 500], ["noise", 0.36, 0.26, "lowpass", 2200, 160, 1, 0.02], ["tone", "sine", 120, 38, 0.3, 0.2]],
  // a lit bundle leaving the hand: a whoosh and a fizz
  throw: [["noise", 0.16, 0.1, "bandpass", 700, 2400, 2], ["noise", 0.12, 0.04, "highpass", 6500, 7500, 1, 0.03]],
  // a stick of dynamite
  pop: [["noise", 0.04, 0.4, "highpass", 1200, 400], ["noise", 0.36, 0.42, "lowpass", 1700, 110, 1, 0.01], ["tone", "sine", 130, 40, 0.3, 0.28]],
  // a keg of it
  boom: [["noise", 0.05, 0.5, "highpass", 900, 300], ["noise", 0.85, 0.66, "lowpass", 2300, 55, 1, 0.01], ["tone", "sine", 95, 26, 0.75, 0.55], ["noise", 0.5, 0.12, "bandpass", 500, 200, 1, 0.3]],
  // a rock fist, a mortar bed
  slam: [["noise", 0.3, 0.4, "lowpass", 560, 70], ["tone", "sine", 72, 34, 0.32, 0.36], ["noise", 0.12, 0.08, "bandpass", 1800, 700, 1, 0.04]],
  // lightning down the kite wire
  zap: [["noise", 0.03, 0.26, "highpass", 5000, 8000], ["tone", "sawtooth", 2100, 180, 0.15, 0.1, 0.01], ["noise", 0.2, 0.14, "bandpass", 3200, 700, 1.2, 0.03]],
  // snake oil: the cork, the glug, the glow
  heal: [["tone", "sine", 420, 1100, 0.035, 0.1], ["tone", "sine", 300, 520, 0.07, 0.07, 0.06], ["tone", "sine", 340, 600, 0.07, 0.06, 0.14], ["tone", "sine", 1318, 1760, 0.2, 0.035, 0.2]],
  // a bushwhacker gone from one place and in another
  blink: [["noise", 0.16, 0.12, "bandpass", 500, 3200, 2], ["tone", "sine", 320, 1300, 0.14, 0.05]],
  // hooves at a gallop
  charge: [["noise", 0.05, 0.22, "lowpass", 620, 180], ["noise", 0.05, 0.18, "lowpass", 520, 160, 1, 0.08], ["noise", 0.05, 0.22, "lowpass", 620, 180, 1, 0.2], ["noise", 0.05, 0.18, "lowpass", 520, 160, 1, 0.28], ["noise", 0.05, 0.2, "lowpass", 620, 180, 1, 0.4]],
  // a fuse spitting
  fuse: [["noise", 0.09, 0.07, "highpass", 5200, 7400], ["noise", 0.09, 0.07, "highpass", 5600, 7800, 1, 0.12]],
  // a body in the dust
  down: [["noise", 0.09, 0.14, "lowpass", 700, 160], ["tone", "triangle", 210, 90, 0.16, 0.06]],
  // a scorpion under a boot
  squish: [["noise", 0.05, 0.12, "bandpass", 1500, 500, 4], ["noise", 0.03, 0.06, "highpass", 4200, 3000, 1, 0.02]],
  // timber coming down
  crumble: [["noise", 0.12, 0.3, "bandpass", 1800, 500, 1.2], ["noise", 0.8, 0.44, "lowpass", 1000, 60, 1, 0.05], ["noise", 0.06, 0.16, "bandpass", 2400, 900, 2, 0.22], ["noise", 0.06, 0.12, "bandpass", 2000, 700, 2, 0.4]],
  // ---- interface
  // a knuckle on a pine board
  tap: [["tone", "triangle", 430, 300, 0.04, 0.07], ["noise", 0.018, 0.08, "bandpass", 1900, 1300, 2]],
  // the cash drawer: the bell, then the coins settling
  buy: [["tone", "sine", 2093, 2093, 0.22, 0.05], ["tone", "sine", 3136, 3136, 0.16, 0.025], ["noise", 0.03, 0.08, "highpass", 5200, 6400, 1, 0.07], ["tone", "triangle", 1568, 1568, 0.05, 0.04, 0.09], ["tone", "triangle", 1760, 1760, 0.06, 0.04, 0.14]],
  // boots hit the boards and the spurs ring
  place: [["noise", 0.07, 0.26, "lowpass", 760, 140], ["tone", "sine", 140, 70, 0.08, 0.14], ["tone", "sine", 3520, 3440, 0.07, 0.03, 0.05], ["tone", "sine", 4180, 4080, 0.09, 0.025, 0.09], ["tone", "sine", 3740, 3660, 0.08, 0.02, 0.13]],
  // promoted: three keys up the piano
  upgrade: [...key(C5, 0, 0.12), ...key(E5, 0.07, 0.12), ...key(G5, 0.14, 0.12), ...key(C6, 0.21, 0.24)],
  // silver across the counter
  sell: [["tone", "triangle", 1760, 1700, 0.05, 0.06], ["tone", "triangle", 1320, 1280, 0.05, 0.06, 0.07], ["tone", "triangle", 1568, 1500, 0.08, 0.05, 0.13]],
  // no dice: two dull knocks
  deny: [["tone", "square", 170, 130, 0.07, 0.06], ["noise", 0.03, 0.08, "lowpass", 500, 200], ["tone", "square", 150, 110, 0.09, 0.06, 0.11]],
  // a deck riffled and squared
  reroll: [["noise", 0.02, 0.1, "highpass", 3200, 5200, 1, 0.0], ["noise", 0.02, 0.1, "highpass", 3400, 5400, 1, 0.035], ["noise", 0.02, 0.1, "highpass", 3600, 5600, 1, 0.07], ["noise", 0.02, 0.1, "highpass", 3800, 5800, 1, 0.105], ["noise", 0.02, 0.1, "highpass", 4000, 6000, 1, 0.14], ["noise", 0.02, 0.1, "highpass", 4200, 6200, 1, 0.175], ["noise", 0.04, 0.12, "bandpass", 1600, 900, 2, 0.23]],
  // the bullwhip: the loop coming over, then the crack
  fight: [["noise", 0.2, 0.12, "bandpass", 380, 2600, 2.5], ["noise", 0.025, 0.5, "highpass", 4200, 8000, 1, 0.2], ["noise", 0.12, 0.2, "bandpass", 2600, 900, 1, 0.215], ["tone", "square", 900, 200, 0.03, 0.1, 0.2]],
  // the saloon piano: a run up the keys and a stomped chord
  win: [...key(G4, 0, 0.1), ...key(C5, 0.085, 0.1), ...key(E5, 0.17, 0.1), ...key(G5, 0.255, 0.1), ...key(A5, 0.34, 0.1), ...key(G5, 0.425, 0.1),
    ...key(C5, 0.56, 0.42, 0.05), ...key(E5, 0.56, 0.42, 0.05), ...key(G5, 0.56, 0.42, 0.05), ...key(C6, 0.56, 0.5, 0.06), ...key(C4, 0.56, 0.3, 0.05)],
  // the same piano, the lid half shut
  lose: [...key(G4, 0, 0.3, 0.06), ...key(Eb5 / 2, 0.2, 0.3, 0.06), ...key(C4, 0.4, 0.5, 0.06), ["tone", "sine", 131, 123, 0.6, 0.06, 0.4]],
  // the depot bell
  round: [["tone", "sine", 1568, 1560, 0.3, 0.06], ["tone", "sine", 3140, 3120, 0.18, 0.02], ["tone", "triangle", 784, 780, 0.2, 0.03], ["noise", 0.015, 0.06, "bandpass", 3000, 2200, 2]],
  // the hall takes a hit
  hurt: [["noise", 0.3, 0.34, "lowpass", 900, 100], ["tone", "sine", 110, 48, 0.3, 0.2], ["noise", 0.08, 0.1, "bandpass", 2000, 800, 2, 0.05]],
};
void [E4, A4, D5];

export const GAPS: Record<string, number> = { hit: 0.05, slash: 0.06, arrow: 0.07, squish: 0.08, heal: 0.15, down: 0.08, clank: 0.09, charge: 0.3, fuse: 0.1 };
