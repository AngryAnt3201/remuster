import type { Side } from "@engine/core/defs";
import { STYLE, rgba, rgbaPrefix } from "./style";

// Board chrome stays the v2 dark board until the arena item replaces it with the rendered ground.
export const INK = "#0a0e16";
export const BOARD = { base0: "#16202e", base1: "#0f1722", line: "rgba(160,190,220,0.055)", band: "rgba(0,0,0,0.22)" };

/** Team colours from the active style direction: the player is Tide, the rival is Ember. */
const side = (t: { main: string; dark: string; light: string }, zone: number) =>
  ({ main: t.main, dark: t.dark, light: t.light, glow: rgbaPrefix(t.main), zone: rgba(t.main, zone) }) as const;
export const TEAM = [side(STYLE.team.tide, 0.07), side(STYLE.team.ember, 0.06)] as const;

export const team = (s: Side) => TEAM[s];
export const STEEL = "#e8eef5";
export const WOOD = "#8a5a35";
// Effect tints from the direction's vfx slots
export const GOLD = STYLE.vfx.gold;
export const HEAL = STYLE.vfx.heal;
export const ZAP = STYLE.vfx.zap;
export const VIOLET = STYLE.vfx.arcane;
