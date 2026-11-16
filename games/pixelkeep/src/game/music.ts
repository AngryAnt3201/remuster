// This game's soundtrack. Each cue names a file under public/music and how it plays. The player
// (../audio/music.ts) crossfades between cues as the player moves through the game:
//   home     menus, the map, the Army, the Shop
//   battle   deploying and fighting
//   boss     boss levels and the last stand of a Gauntlet run (falls back to battle)
//   arena    Arena matches (falls back to battle)
//   win      a short sting when a match is won, then silence until the next screen
//   lose     the same for a loss
// `loop` is the length of the looping section in seconds (0 = play once). Looping files carry half a second of
// wrap-around on each end (the end of the loop before it, the start after it), so any window of exactly `loop`
// seconds repeats seamlessly whatever padding the encoder adds; `npm run music -- <game>` writes them that way.
// A game shadows this file (games/<id>/src/game/music.ts) and ships its own public/music.
export interface Track { file: string; loop: number; gain?: number; }
export type Cue = "home" | "battle" | "boss" | "arena" | "win" | "lose";

// D minor, 144 BPM. Written by `npm run music -- pixelkeep` (chiptune arrangement); do not edit by hand.
export const MUSIC: Partial<Record<Cue, Track>> = {
  home: { file: "home.m4a", loop: 53.333333 },
  battle: { file: "battle.m4a", loop: 53.333333 },
  boss: { file: "boss.m4a", loop: 53.333333 },
  win: { file: "win.m4a", loop: 0.000000 },
  lose: { file: "lose.m4a", loop: 0.000000 },
};
