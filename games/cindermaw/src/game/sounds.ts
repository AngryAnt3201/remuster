// Cindermaw's sound effects: a 1993 sound card with the gain up. Guns are a crack of band-passed noise over a low
// square thump; blows are meaty low-pass thuds with a sawtooth growl sliding down under them; everything metal is a
// pair of clashing square partials; the jingles are power chords (root, fifth, octave on detuned sawtooth and square)
// instead of bells. No sine waves except the sub under the big blasts: sines are too clean for this world.
// Recipes for the little synth in ../audio/sfx.ts (WebAudio, no files):
//   ["tone",  wave, startHz, endHz, seconds, loudness, delaySeconds?]        wave: sine | triangle | square | sawtooth
//   ["noise", seconds, loudness, filter, startHz, endHz, Q?, delaySeconds?]  filter: lowpass | highpass | bandpass
// Square and sawtooth are loud for their peak, so tone levels sit under the base game's: forty can play in a second.
export type Layer =
  | ["tone", OscillatorType, number, number, number, number, number?]
  | ["noise", number, number, BiquadFilterType, number, number, number?, number?];

/** A power chord: root, fifth and octave, sawtooth with a square a hair flat under it for the beating. */
const chord = (root: number, len: number, vol: number, at = 0, bend = 1): Layer[] => [
  ["tone", "sawtooth", root, root * bend, len, vol, at],
  ["tone", "sawtooth", root * 1.498, root * 1.498 * bend, len, vol * 0.8, at],
  ["tone", "square", root * 1.99, root * 1.99 * bend, len, vol * 0.45, at],
];
/** A pick scrape: the pick hitting the strings ahead of a chord. */
const pick = (at = 0, vol = 0.1): Layer => ["noise", 0.04, vol, "bandpass", 2600, 1400, 1.2, at];

const D2 = 73.4, F2 = 87.3, G2 = 98, A2 = 110, C3 = 130.8, D3 = 146.8;

export const SOUNDS: Record<string, Layer[]> = {
  // ---- battle
  // claws and blades: a wet rip (noise falling through the mids) and a short growl
  slash: [["noise", 0.07, 0.2, "bandpass", 2400, 600, 1.2], ["tone", "sawtooth", 210, 90, 0.07, 0.035]],
  // a blow landing: a meaty thud and a square knock dropping under it
  hit: [["noise", 0.06, 0.24, "lowpass", 900, 180], ["tone", "square", 130, 55, 0.07, 0.05]],
  // a round off plate: two square partials that do not agree, and a tick of grit
  clank: [["tone", "square", 1180, 1020, 0.08, 0.04], ["tone", "square", 1730, 1560, 0.06, 0.03], ["noise", 0.03, 0.1, "bandpass", 3600, 2400, 3]],
  // a rifle: a hard crack, the low thump of the report, a short tail
  arrow: [["noise", 0.035, 0.2, "bandpass", 3800, 1500, 1.5], ["tone", "square", 200, 60, 0.06, 0.05], ["noise", 0.1, 0.06, "lowpass", 1800, 400, 1, 0.02]],
  // the heavy gun (rail spike, shotgun): a wide blast with a body, then the boom rolling off
  bolt: [["noise", 0.16, 0.26, "bandpass", 1800, 350, 0.7], ["tone", "square", 150, 38, 0.16, 0.08], ["tone", "sawtooth", 95, 40, 0.2, 0.06], ["noise", 0.22, 0.1, "lowpass", 900, 120, 1, 0.05]],
  // a throw: a grunt of effort and the whoosh
  throw: [["tone", "sawtooth", 160, 260, 0.09, 0.04], ["noise", 0.12, 0.08, "bandpass", 700, 1900, 2]],
  // a small blast: crunchy, mid-heavy
  pop: [["noise", 0.28, 0.36, "lowpass", 1900, 140], ["tone", "square", 140, 42, 0.24, 0.08], ["noise", 0.05, 0.14, "bandpass", 2600, 1200, 1]],
  // the big blast: the crack, the body, and a sub that sags
  boom: [["noise", 0.7, 0.56, "lowpass", 2600, 60], ["tone", "sine", 82, 26, 0.65, 0.42], ["tone", "sawtooth", 110, 30, 0.45, 0.09], ["noise", 0.06, 0.2, "bandpass", 3000, 900, 0.8]],
  // something very heavy coming down on iron deck
  slam: [["noise", 0.26, 0.36, "lowpass", 520, 70], ["tone", "square", 82, 30, 0.28, 0.1], ["tone", "sawtooth", 61, 31, 0.3, 0.1]],
  // an arc: a buzzing sawtooth dropping through a high-passed crackle
  zap: [["tone", "sawtooth", 1500, 140, 0.14, 0.07], ["tone", "square", 2240, 300, 0.1, 0.03], ["noise", 0.16, 0.14, "highpass", 2800, 5200]],
  // the injector gun: a hiss of gas and a flat two-note beep, like a monitor
  heal: [["noise", 0.12, 0.07, "highpass", 5200, 3400], ["tone", "square", 587, 587, 0.07, 0.022, 0.03], ["tone", "square", 880, 880, 0.1, 0.022, 0.1]],
  // a blink: the air tearing open, bottom to top
  blink: [["tone", "sawtooth", 90, 900, 0.14, 0.05], ["noise", 0.14, 0.1, "bandpass", 500, 3600, 3]],
  // a charge: a growl winding up over the rumble of hooves or tyres
  charge: [["tone", "sawtooth", 62, 150, 0.42, 0.09], ["noise", 0.45, 0.2, "lowpass", 260, 520], ["noise", 0.05, 0.12, "lowpass", 700, 250, 1, 0.14], ["noise", 0.05, 0.12, "lowpass", 700, 250, 1, 0.28]],
  // a fuse: two flat alarm beeps
  fuse: [["tone", "square", 1245, 1245, 0.045, 0.04], ["tone", "square", 1245, 1245, 0.045, 0.04, 0.11]],
  // a body going down: a falling growl and the thump of it landing
  down: [["tone", "sawtooth", 190, 48, 0.2, 0.06], ["noise", 0.08, 0.12, "lowpass", 500, 120, 1, 0.1]],
  // something soft bursting
  squish: [["noise", 0.07, 0.14, "bandpass", 900, 280, 3], ["tone", "sawtooth", 150, 70, 0.05, 0.03]],
  // a structure coming apart: plate tearing, then rubble in two falls
  crumble: [["noise", 0.3, 0.34, "bandpass", 1400, 300, 0.8], ["noise", 0.5, 0.34, "lowpass", 800, 60, 1, 0.18], ["tone", "square", 98, 30, 0.6, 0.08, 0.1], ["noise", 0.3, 0.2, "lowpass", 400, 60, 1, 0.55]],
  // the hold taking a hit: an impact and a roar of pain behind it
  hurt: [["noise", 0.24, 0.3, "lowpass", 800, 100], ["tone", "sawtooth", 130, 58, 0.3, 0.09], ["tone", "square", 92, 44, 0.3, 0.05]],
  // ---- interface
  // a key on the status bar: a dead little click
  tap: [["tone", "square", 320, 190, 0.035, 0.045], ["noise", 0.02, 0.07, "bandpass", 2400, 1800, 2]],
  // buying: a pump-action. Slide back (the pitch falls), slide home (it rises), and the lock
  buy: [["noise", 0.07, 0.17, "bandpass", 2000, 800, 2.5], ["noise", 0.07, 0.19, "bandpass", 900, 2400, 2.5, 0.1], ["tone", "square", 170, 85, 0.04, 0.06, 0.16]],
  // setting a unit down: a blast door slamming shut, with the plate ringing after it
  place: [["noise", 0.12, 0.3, "lowpass", 700, 90], ["tone", "square", 96, 46, 0.12, 0.09], ["tone", "square", 412, 396, 0.14, 0.02, 0.01], ["noise", 0.03, 0.1, "bandpass", 3200, 2200, 4]],
  // a rank up: three power chords climbing
  upgrade: [pick(0, 0.07), ...chord(D2, 0.1, 0.05), ...chord(F2, 0.1, 0.05, 0.08), ...chord(A2, 0.22, 0.055, 0.16)],
  // junking a unit: it drops into the bin
  sell: [["tone", "square", 300, 110, 0.1, 0.05], ["noise", 0.08, 0.14, "bandpass", 1600, 500, 2, 0.05], ["tone", "square", 760, 700, 0.05, 0.02, 0.1]],
  // not allowed: a buzzer
  deny: [["tone", "sawtooth", 98, 92, 0.16, 0.07], ["tone", "square", 104, 98, 0.16, 0.04]],
  // restocking the rack: a shorter, faster pump
  reroll: [["noise", 0.05, 0.15, "bandpass", 2200, 900, 3], ["noise", 0.06, 0.17, "bandpass", 1000, 2600, 3, 0.07], ["tone", "square", 150, 80, 0.03, 0.05, 0.12]],
  // BREACH: one power chord stabbed and bent up, with the kick under it
  fight: [pick(), ...chord(D2, 0.5, 0.075, 0, 1.06), ["tone", "square", 120, 40, 0.14, 0.12], ["noise", 0.1, 0.2, "lowpass", 600, 100]],
  // a win: three stabs up to a held chord
  win: [pick(), ...chord(D2, 0.12, 0.06), ...chord(F2, 0.12, 0.06, 0.14), ...chord(G2, 0.12, 0.06, 0.28), pick(0.42), ...chord(D3, 0.7, 0.07, 0.42), ["tone", "square", D2, D2, 0.7, 0.06, 0.42]],
  // a loss: one chord with the tuning pegs let go, each string sagging at its own rate
  lose: [pick(0, 0.08), ["tone", "sawtooth", D3, D3 * 0.62, 1.1, 0.07], ["tone", "sawtooth", A2, A2 * 0.55, 1.1, 0.06], ["tone", "square", D2 * 1.02, D2 * 0.5, 1.2, 0.07], ["noise", 0.9, 0.08, "lowpass", 500, 60, 1, 0.2]],
  // a new round: two muted chugs and an open one
  round: [...chord(D2, 0.05, 0.05), ...chord(D2, 0.05, 0.05, 0.09), ...chord(C3, 0.2, 0.05, 0.18)],
};

export const GAPS: Record<string, number> = { hit: 0.06, slash: 0.07, arrow: 0.08, squish: 0.09, heal: 0.18, down: 0.09, clank: 0.09, zap: 0.12, bolt: 0.09 };
