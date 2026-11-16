// Brasswick's sound effects: metal on metal, steam, clockwork and rifle cracks. See base/src/game/sounds.ts for the
// recipe format. Steel rings (high triangle pings), valves hiss (bright noise sweeping down), gears tick (short
// square clicks), boilers thump.
import type { Layer } from "@base/game/sounds";
export type { Layer } from "@base/game/sounds";

export const SOUNDS: Record<string, Layer[]> = {
  // battle
  slash: [["noise", 0.07, 0.2, "highpass", 3500, 5000], ["tone", "triangle", 2100, 1500, 0.09, 0.06]],
  hit: [["noise", 0.04, 0.22, "bandpass", 2200, 700, 2], ["tone", "square", 240, 120, 0.04, 0.06], ["tone", "triangle", 1700, 1300, 0.06, 0.04]],
  clank: [["tone", "triangle", 1900, 1500, 0.16, 0.12], ["tone", "triangle", 2850, 2400, 0.1, 0.06], ["noise", 0.04, 0.12, "highpass", 5000, 3500]],
  arrow: [["noise", 0.05, 0.3, "bandpass", 1800, 500, 1.2], ["noise", 0.16, 0.08, "highpass", 6000, 2500, 1, 0.03]],
  bolt: [["tone", "sawtooth", 220, 55, 0.2, 0.12], ["noise", 0.1, 0.25, "lowpass", 2000, 300], ["tone", "triangle", 1500, 900, 0.1, 0.05, 0.02]],
  throw: [["noise", 0.14, 0.1, "bandpass", 900, 2600, 2], ["tone", "square", 900, 900, 0.02, 0.04]],
  pop: [["noise", 0.3, 0.45, "lowpass", 1900, 140], ["tone", "sine", 140, 45, 0.28, 0.3], ["noise", 0.35, 0.12, "highpass", 7000, 3000, 1, 0.08]],
  boom: [["noise", 0.85, 0.7, "lowpass", 2400, 55], ["tone", "sine", 80, 26, 0.75, 0.55], ["noise", 0.7, 0.14, "highpass", 8000, 2500, 1, 0.12]],
  slam: [["noise", 0.3, 0.42, "lowpass", 700, 70], ["tone", "sine", 64, 32, 0.34, 0.38], ["tone", "triangle", 900, 700, 0.18, 0.06]],
  zap: [["tone", "sawtooth", 2400, 150, 0.14, 0.11], ["tone", "square", 120, 120, 0.2, 0.05], ["noise", 0.2, 0.16, "highpass", 4000, 7000]],
  heal: [["noise", 0.3, 0.1, "highpass", 9000, 3500], ["tone", "sine", 990, 1485, 0.2, 0.05, 0.05]],
  blink: [["noise", 0.18, 0.16, "bandpass", 500, 4000, 3], ["tone", "sine", 400, 1600, 0.14, 0.06]],
  charge: [["noise", 0.5, 0.2, "lowpass", 500, 180], ["tone", "square", 70, 140, 0.4, 0.06], ["noise", 0.3, 0.1, "highpass", 6000, 9000, 1, 0.15]],
  fuse: [["tone", "square", 1800, 1800, 0.03, 0.06], ["tone", "square", 1500, 1500, 0.03, 0.06, 0.1], ["tone", "square", 1800, 1800, 0.03, 0.06, 0.2]],
  down: [["tone", "triangle", 320, 90, 0.2, 0.08], ["noise", 0.12, 0.08, "highpass", 5000, 2000]],
  squish: [["tone", "square", 1200, 600, 0.04, 0.05], ["noise", 0.05, 0.1, "bandpass", 2400, 900, 4]],
  crumble: [["noise", 0.9, 0.5, "lowpass", 1100, 60], ["tone", "triangle", 1400, 500, 0.3, 0.07], ["tone", "triangle", 900, 300, 0.35, 0.06, 0.12]],
  // UI: clockwork clicks, a cash-register ring, a lever and a steam whistle
  tap: [["tone", "square", 1500, 1500, 0.018, 0.05], ["tone", "triangle", 900, 800, 0.04, 0.04, 0.012]],
  buy: [["tone", "square", 1400, 1400, 0.02, 0.05], ["tone", "sine", 2093, 2093, 0.22, 0.08, 0.03], ["tone", "sine", 3136, 3136, 0.18, 0.04, 0.03]],
  place: [["noise", 0.06, 0.26, "lowpass", 900, 160], ["tone", "sine", 130, 70, 0.09, 0.16], ["tone", "triangle", 1300, 1000, 0.05, 0.04]],
  upgrade: [["tone", "square", 1200, 1200, 0.02, 0.05], ["tone", "square", 1500, 1500, 0.02, 0.05, 0.07], ["tone", "square", 1800, 1800, 0.02, 0.05, 0.14], ["tone", "sine", 1568, 1568, 0.3, 0.08, 0.2], ["tone", "sine", 2349, 2349, 0.3, 0.05, 0.2]],
  sell: [["tone", "sine", 1760, 1760, 0.1, 0.06], ["tone", "sine", 1319, 1319, 0.14, 0.06, 0.07]],
  deny: [["tone", "square", 160, 120, 0.1, 0.07], ["noise", 0.06, 0.1, "lowpass", 500, 200]],
  reroll: [["tone", "square", 1100, 1100, 0.015, 0.05], ["tone", "square", 1300, 1300, 0.015, 0.05, 0.05], ["tone", "square", 1100, 1100, 0.015, 0.05, 0.1], ["tone", "square", 1500, 1500, 0.015, 0.05, 0.15], ["noise", 0.2, 0.06, "bandpass", 1500, 3500, 2]],
  fight: [["tone", "sine", 740, 760, 0.5, 0.1], ["tone", "sine", 932, 950, 0.5, 0.07], ["noise", 0.5, 0.16, "highpass", 5000, 8000]],
  win: [["tone", "sine", 1047, 1047, 0.25, 0.08, 0.0], ["tone", "sine", 1319, 1319, 0.25, 0.08, 0.12], ["tone", "sine", 1568, 1568, 0.25, 0.08, 0.24], ["tone", "sine", 2093, 2093, 0.5, 0.09, 0.36], ["tone", "sine", 3136, 3136, 0.4, 0.04, 0.36]],
  lose: [["tone", "sawtooth", 196, 110, 0.7, 0.07], ["noise", 0.8, 0.18, "highpass", 6000, 1500], ["tone", "square", 800, 800, 0.02, 0.05, 0.5], ["tone", "square", 600, 600, 0.02, 0.05, 0.75]],
  round: [["tone", "sine", 1568, 1568, 0.3, 0.08], ["tone", "sine", 2349, 2349, 0.25, 0.04], ["tone", "square", 1400, 1400, 0.02, 0.04]],
  hurt: [["noise", 0.3, 0.36, "lowpass", 1000, 100], ["tone", "sine", 100, 46, 0.3, 0.2], ["tone", "triangle", 1200, 500, 0.22, 0.06]],
};

export const GAPS: Record<string, number> = { hit: 0.05, slash: 0.06, arrow: 0.07, squish: 0.08, heal: 0.15, down: 0.08, clank: 0.08 };
