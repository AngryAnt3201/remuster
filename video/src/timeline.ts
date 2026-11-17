// The edit, as data. Everything is on the music grid: 144 BPM, 4/4, at 60 fps one beat is exactly 25 frames and one
// bar exactly 100. `bar` counts from 1; `beats` is a length in beats. The same file drives the picture (Launch.tsx)
// and the soundtrack (tools/music/mix.py reads audio/cuts.json, written from this by video/cuts.mjs).
// The form follows the tune: intro 1-4, A 5-12, B 13-20, A 21-28, B 29-36 (the climax), break 37-38, last A 39-46,
// tag 47, held chord 48.
export const FPS = 60;
export const BEAT = 25; // frames
export const BAR = 100; // frames
export const BARS = 48;
export const TAIL = 3 * FPS; // the last chord rings out
export const DURATION = BARS * BAR + TAIL;
/** Frame at which a bar (1-based, may be fractional: 9.5 = bar 9, beat 3) starts. */
export const at = (bar: number) => Math.round((bar - 1) * BAR);

export type GameId = "base" | "brasswick" | "dustline" | "neonhold" | "pixelkeep" | "inkfall";
export interface GameInfo { id: GameId; name: string; prompt: string; style: string; color: string; }
/** The six games, in the order the video meets them. `prompt` is what was typed to make it; `style` names its
 *  arrangement of the theme tune (tools/music). */
export const GAMES: GameInfo[] = [
  { id: "base", name: "Crownfall", prompt: "", style: "fantasy", color: "#ffcf4d" },
  { id: "brasswick", name: "Brasswick", prompt: "make it steampunk", style: "steampunk", color: "#e0a04a" },
  { id: "dustline", name: "Dustline", prompt: "make it a western", style: "western", color: "#e8743b" },
  { id: "neonhold", name: "Neonhold", prompt: "make it cyberpunk", style: "synthwave", color: "#ff3fd0" },
  { id: "pixelkeep", name: "Pixelkeep", prompt: "make it 8-bit", style: "chiptune", color: "#7ce04a" },
  { id: "inkfall", name: "Inkfall", prompt: "make it an ink painting", style: "ink", color: "#d94a3a" },
];
export const game = (id: GameId) => GAMES.find((g) => g.id === id)!;

/** One shot: a game's capture of a scene, from `bar` for `beats`. `t` is the scene time (seconds) the shot starts
 *  at; omitted, the scene's own clock keeps running from the section's start, so a cut to another game lands on
 *  the same moment of the same battle. */
export interface Shot { bar: number; beats: number; game: GameId; clip: string; t?: number; tag?: boolean; }
export interface Section { name: string; bar: number; bars: number; }

const cycle = (ids: GameId[], n: number, from = 0) => Array.from({ length: n }, (_, i) => ids[(from + i) % ids.length]);
const ALL = GAMES.map((g) => g.id);

export const SECTIONS: Section[] = [
  { name: "intro", bar: 1, bars: 4 },
  { name: "one-battle", bar: 5, bars: 16 },
  { name: "under-the-hood", bar: 21, bars: 8 },
  { name: "arenas", bar: 29, bars: 8 },
  { name: "break", bar: 37, bars: 2 },
  { name: "finale", bar: 39, bars: 8 },
];

/** Scene clocks: the bar at which each continuous scene's time 0 falls. */
export const SCENE_START: Record<string, number> = { clash: 5, siege: 21, arena: 29, crossing: 32, market: 34 };
/** Seconds of each capture to skip: the game's own opening banner before the armies move. */
export const SCENE_SKIP: Record<string, number> = { clash: 1.0, arena: 1.2, crossing: 1.2, market: 1.2, siege: 2.0 };

export const SHOTS: Shot[] = [
  // intro: the base game's home screen
  { bar: 1, beats: 16, game: "base", clip: "home", t: 0 },
  // one battle, six games
  { bar: 5, beats: 24, game: "base", clip: "clash" },                 // bars 5-10: fantasy; "make it steampunk" typed over 9-10
  { bar: 11, beats: 12, game: "brasswick", clip: "clash", tag: true }, // bars 11-13; "make it a western" typed over 13
  { bar: 14, beats: 4, game: "dustline", clip: "clash", tag: true },
  { bar: 15, beats: 4, game: "neonhold", clip: "clash", tag: true },
  { bar: 16, beats: 4, game: "pixelkeep", clip: "clash", tag: true },
  { bar: 17, beats: 4, game: "inkfall", clip: "clash", tag: true },
  ...cycle(ALL, 6).map((g, i): Shot => ({ bar: 18 + i * 0.5, beats: 2, game: g, clip: "clash" })), // bars 18-20, a cut every two beats
  // bars 21-24: all six at once (drawn by the grid, not as shots); bars 25-28: every game's front door
  ...cycle(ALL, 8).map((g, i): Shot => ({ bar: 25 + i * 0.5, beats: 2, game: g, clip: i < 6 ? "home" : "army", t: 0.6 })),
  // real places: each opens on the whole globe and comes in. A village (bars 29-31), a river crossing (32-33), a
  // market square (34-36), the game changing on every bar
  ...cycle(ALL, 8, 0).map((g, i): Shot => ({ bar: 29 + i, beats: 4, game: g, clip: i < 3 ? "arena" : i < 5 ? "crossing" : "market", tag: i > 0 && i < 6 })),
  // finale: every two beats, the best moments of everything
  ...cycle(ALL, 16, 1).map((g, i): Shot => ({ bar: 39 + i * 0.5, beats: 2, game: g, clip: ["clash", "crossing", "arena", "market", "siege"][i % 5], t: [6.2, 4.0, 5.0, 9.4, 7.5, 8.2, 12.0, 10.4, 11.0, 14.6, 12.8, 13.4, 16.0, 14.2, 15.0, 17.5][i] })),
];

/** The prompts typed on screen: start typing at `bar`, finished and sent by `send`, which is the cut. */
export const PROMPTS: { bar: number; send: number; text: string }[] = [
  { bar: 9, send: 11, text: game("brasswick").prompt },
  { bar: 12.75, send: 14, text: game("dustline").prompt },
  { bar: 14.5, send: 15, text: game("neonhold").prompt },
  { bar: 15.5, send: 16, text: game("pixelkeep").prompt },
  { bar: 16.5, send: 17, text: game("inkfall").prompt },
];

/** Words on screen. */
export const CAPTIONS: { bar: number; beats: number; lines: string[]; big?: boolean; y?: number }[] = [
  { bar: 1.5, beats: 9, lines: ["One game."], big: true },
  { bar: 18, beats: 12, lines: ["Same battle.", "Same rules."] },
  { bar: 21, beats: 15, lines: ["We run the game.", "You own the look."] },
  { bar: 29, beats: 4, lines: ["Every level", "A REAL PLACE"], big: true },
  { bar: 31, beats: 6, lines: ["Streets. Cover. Ambushes."], y: 0.16 },
  { bar: 33.5, beats: 9, lines: ["Spin it like a globe."], y: 0.16 },
  { bar: 37, beats: 4, lines: ["One game."], big: true },
  { bar: 38, beats: 4, lines: ["Make it yours."], big: true },
];

/** Which style of the theme tune plays from each bar (the soundtrack follows the picture). */
export function musicCuts(): [number, string][] {
  const cuts: [number, string][] = [[1, "fantasy"]];
  for (const s of [...SHOTS].sort((a, b) => a.bar - b.bar)) {
    if (s.bar < 5 || !Number.isInteger(s.bar)) continue; // the tune changes on bar lines only
    const style = game(s.game).style;
    if (cuts[cuts.length - 1][1] !== style) cuts.push([s.bar, style]);
  }
  // the grid, the break and the ending belong to the base theme
  return [...cuts.filter(([b]) => b < 21 || (b >= 29 && b < 37) || (b >= 39 && b < 46)), [21, "fantasy"], [37, "fantasy"], [46, "fantasy"]]
    .sort((a, b) => a[0] - b[0]).filter((c, i, all) => i === 0 || all[i - 1][1] !== c[1]) as [number, string][];
}
