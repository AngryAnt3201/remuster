// Content counts quoted by the App Store listing and the website (see tools/release-config.mjs).
import { ACTS, LEVELS } from "./campaign";
import { ABILITIES, UNIT_KINDS } from "./defs";
import { PUZZLES } from "./puzzles";

const WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve"];
export const numberWord = (n: number) => WORDS[n] ?? String(n);

export function contentCounts() {
  return {
    units: UNIT_KINDS.length,
    abilities: Object.keys(ABILITIES).length,
    levels: LEVELS.length,
    acts: ACTS.length,
    actsWord: numberWord(ACTS.length),
    bosses: LEVELS.filter((l) => l.boss).length,
    puzzles: PUZZLES.length,
  };
}
