// Open-field battles are frozen: a battle with no terrain must play out bit for bit as it did before roads and brush
// (engine v2). The fingerprints below were recorded from the v2 engine; they change only if the open-field sim does.
// GOLDEN_PRINT=1 npx vitest run tests/golden.test.ts prints the current fingerprints.
import { describe, expect, it } from "vitest";
import { Battle } from "../engine/core/battle";
import { UNITS, UNIT_KINDS, type Piece, type Side, type UnitKind } from "../engine/core/defs";
import { hashSeed } from "../engine/core/rng";

const P = (id: number, kind: UnitKind, side: Side, x: number, y: number, rank = 1): Piece => ({ id, kind, side, x, y, rank, spent: UNITS[kind].cost });
/** Every kind on both sides at mixed ranks; `shift` rotates who stands where. */
const board = (shift: number): Piece[] => UNIT_KINDS.flatMap((k, i) => [
  P(i * 2 + 1, k, 0, 0.8 + ((i + shift) % 6) * 1.5, 12.8 - Math.floor(i / 6) * 1.0, 1 + ((i + shift) % 4)),
  P(i * 2 + 2, k, 1, 0.8 + ((i + 3) % 6) * 1.5, 1.2 + Math.floor(i / 6) * 1.0, 1 + ((i + 2 * shift + 2) % 4)),
]);
function fingerprint(seed: number, shift: number, rocks: boolean): string {
  const b = new Battle(board(shift), {
    seed, events: true,
    obstacles: rocks ? [{ x: 2.2, y: 7, r: 0.6 }, { x: 6.8, y: 7, r: 0.6 }, { x: 4.5, y: 6.2, r: 0.5 }] : undefined,
  });
  b.run();
  const r = b.result();
  let h = hashSeed("golden", r.winner, Math.round(r.time * 1000), b.events.length, b.bodies.length);
  for (const x of b.bodies) h = hashSeed(h, x.kind, Math.round(x.x * 1e6), Math.round(x.y * 1e6), Math.round(x.hp * 1e3), x.alive ? 1 : 0, x.hidden ? 1 : 0);
  return `${r.winner}:${r.time.toFixed(3)}:${b.events.length}:${b.bodies.length}:${h}`;
}

const CASES: [number, number, boolean][] = [
  [1, 0, false], [2, 1, false], [3, 2, false], [4, 3, false], [5, 4, false], [6, 5, false],
  [7, 0, true], [8, 1, true], [9, 2, true], [10, 3, true], [11, 4, true], [12, 5, true],
];
const GOLDEN: string[] = [
  "1:22.533:1407:110:147592599",
  "0:16.267:1282:110:1004408764",
  "1:22.700:1339:108:3291618901",
  "1:25.133:1178:110:3163725040",
  "1:18.667:1350:102:3681152255",
  "0:15.333:1226:102:1494772830",
  "1:17.367:1264:99:2240029322",
  "0:18.033:1473:114:1429127038",
  "1:23.267:1382:110:2607004276",
  "0:29.467:1308:122:917945779",
  "0:37.633:1762:132:2164746118",
  "0:19.300:1379:112:1763023688",
];

describe("open-field golden battles", () => {
  if (process.env.GOLDEN_PRINT) {
    it("prints", () => { console.log(CASES.map(([s, sh, r]) => `  "${fingerprint(s, sh, r)}",`).join("\n")); });
    return;
  }
  it("has a fingerprint for every case", () => { expect(GOLDEN).toHaveLength(CASES.length); });
  CASES.forEach(([seed, shift, rocks], i) => {
    it(`seed ${seed}, shift ${shift}${rocks ? ", rocks" : ""} plays out exactly as engine v2`, () => {
      expect(fingerprint(seed, shift, rocks)).toBe(GOLDEN[i]);
    });
  });
});
