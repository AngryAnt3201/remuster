// Bastion waves: 18 per map, rising in rank and toughness, with mixed roles (fast cavalry, flyers that ignore the
// road, tanks, spawners) and a boss on the last. Existing unit kinds only.
import type { UnitKind } from "../defs";

export interface WaveGroup {
  kind: UnitKind;
  /** how many units (multi-body units like the Blade Trio spawn each body) */
  n: number;
  /** seconds between spawns in the group */
  gap: number;
  /** seconds after the wave starts that the group begins */
  at: number;
  /** road index (wrapped to the map's road count); flyers ignore it */
  road?: number;
  boss?: boolean;
}
export interface Wave { groups: WaveGroup[]; rank: number; hpMul: number; boss?: boolean; }

export const WAVE_COUNT = 18;

type G = [UnitKind, number, number?];
// One row per wave: groups in spawn order. Gaps and start times are filled in by waves().
const PLAN: G[][] = [
  [["blades", 3]],
  [["blades", 2], ["ranger", 3]],
  [["lancer", 3], ["blades", 2]],
  [["bulwark", 2], ["duelist", 3], ["ranger", 3]],
  [["harrier", 4], ["blades", 3]],
  [["pikeman", 3], ["hive", 2], ["ranger", 3]],
  [["outrider", 4], ["lancer", 3]],
  [["golem", 1], ["bulwark", 2], ["grenadier", 2], ["duelist", 3]],
  [["harrier", 5], ["shade", 4]],
  [["ravager", 3], ["grave", 2], ["blades", 3]],
  [["lancer", 5], ["outrider", 4]],
  [["golem", 2], ["hive", 2], ["storm", 2], ["pikeman", 3]],
  [["harrier", 6], ["bulwark", 2], ["rime", 3]],
  [["ravager", 4], ["hook", 3], ["sapper", 3]],
  [["lancer", 6], ["harrier", 4], ["golem", 1]],
  [["golem", 3], ["grave", 2], ["banner", 2], ["blades", 3]],
  [["bulwark", 2], ["lancer", 5], ["harrier", 5], ["ravager", 3], ["hive", 1]],
  [["blades", 3], ["harrier", 4], ["golem", 1, 1], ["lancer", 4], ["bulwark", 2]],
];

export const BOSS_NAME = "The Old Colossus";

export function waves(roads = 1): Wave[] {
  return PLAN.map((row, w) => {
    let at = 0;
    const groups: WaveGroup[] = row.map(([kind, n, boss], gi) => {
      const fast = kind === "lancer" || kind === "outrider" || kind === "harrier";
      const gap = kind === "golem" ? 3.2 : fast ? 0.7 : 1.0;
      const g: WaveGroup = { kind, n, gap, at, road: (w + gi) % Math.max(1, roads), ...(boss ? { boss: true } : {}) };
      at += n * gap * 0.75 + 1.5;
      return g;
    });
    const rank = w < 5 ? 1 : w < 11 ? 2 : 3;
    // Toughness grows within each rank band too, so every wave is a step up.
    const hpMul = +(1 + 0.05 * w + 0.002 * w * w).toFixed(3);
    return { groups, rank, hpMul, ...(w === PLAN.length - 1 ? { boss: true } : {}) };
  });
}
