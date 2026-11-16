import { beforeEach, describe, expect, it } from "vitest";
import { Battle, simulate } from "../engine/core/battle";
import { LEVELS } from "../engine/core/campaign";
import { levelConfig, puzzleConfig } from "../engine/core/content";
import { dailyBoard, dailyConfig } from "../engine/core/daily";
import { UNITS, UNIT_KINDS, type Piece, type UnitKind } from "../engine/core/defs";
import { MAX_LEVEL, levelDmg, levelHp, uniformLevels } from "../engine/core/levels";
import { Match } from "../engine/core/match";
import { PUZZLES } from "../engine/core/puzzles";
import { wallet, earn } from "../engine/economy/wallet";
import {
  BASE_CAP, CAMPAIGN_WIN, COINS_TO_MAX, COMMANDER_XP, EXPECTED_LEVEL_BY_ACT, KEEP_HP_PER_LEVEL, MAX_COMMANDER, REPLAY_DAILY_CAP, SKIRMISH_DAILY_CAP,
  STARTER_KINDS, UPGRADE_CARDS, UPGRADE_COINS, actsCleared, campaignCards, campaignReward, cardsBetween, coinsBetween, commanderLevel, commanderProgress,
  dailyReward, foeLevelForAct, gauntletFoeLevel, gauntletRivalReward, keepBonus, levelCap, levelsFor, skirmishReward, unlockedKinds, upgradeCards,
  upgradeCoins, upgradeState, upgradeXp,
} from "../engine/progression/economy";
import { RARITIES, cardsOf, grantCards, isFound } from "../engine/progression/collection";
import { addXp, awardCampaign, awardSkirmish, commander, migrateArmySave, migrateLevel, troopLevel, troopState, upgradeTroop, withLevels } from "../engine/progression/troops";
import { load, resetSave, save } from "../engine/save";

const army = (side: 0 | 1, kinds: UnitKind[], idBase: number): Piece[] =>
  kinds.map((kind, i) => ({ id: idBase + i, kind, side, x: 1.5 + i * 1.6, y: side === 0 ? 11 : 3, rank: 1 + (i % 3), spent: 0 }));
const fight = (): Piece[] => [...army(0, ["bulwark", "ranger", "medic", "hive", "lamp"], 1), ...army(1, ["golem", "storm", "blades", "tinker", "grave"], 100)];
const fingerprint = (b: Battle) => b.bodies.map((x) => `${x.kind}:${x.hp.toFixed(3)}:${x.x.toFixed(3)}:${x.y.toFixed(3)}`).join("|");

describe("troop levels in the sim", () => {
  it("level 1 is exactly the base stats", () => {
    expect(levelHp(1)).toBe(1);
    expect(levelDmg(1)).toBe(1);
    const plain = new Battle(fight(), { seed: 5 });
    const lv1 = new Battle(fight(), { seed: 5, levels: [{}, Object.fromEntries(UNIT_KINDS.map((k) => [k, 1]))] });
    expect(lv1.bodies.map((b) => [b.maxHp, b.dmg, b.healMul])).toEqual(plain.bodies.map((b) => [b.maxHp, b.dmg, b.healMul]));
    // A level-1 battle plays out identically, body for body.
    expect(fingerprint(lv1.run() && lv1)).toBe(fingerprint(plain.run() && plain));
  });

  it("each level adds 8% health and damage, up to +88% at level 12", () => {
    expect(MAX_LEVEL).toBe(12);
    expect(levelHp(2)).toBeCloseTo(1.08);
    expect(levelHp(MAX_LEVEL)).toBeCloseTo(1.88);
    expect(levelDmg(99)).toBeCloseTo(1.88); // clamped
    const b = new Battle(army(0, ["bulwark"], 1), { levels: [{ bulwark: 5 }, undefined] });
    expect(b.bodies[0].maxHp).toBe(Math.round(UNITS.bulwark.hp * 1.32));
    expect(b.bodies[0].dmg).toBeCloseTo(UNITS.bulwark.dmg * 1.32);
  });

  it("levels are per side and spawned bodies share their maker's level", () => {
    const b = new Battle([...army(0, ["hive"], 1), ...army(1, ["hive"], 50)], { mods: [{ broodStart: true }, { broodStart: true }], levels: [{ hive: 10 }, undefined] });
    const mites = b.bodies.filter((x) => x.kind === "mite");
    const mine = mites.filter((x) => x.side === 0), theirs = mites.filter((x) => x.side === 1);
    expect(mine[0].maxHp).toBe(Math.round(22 * 1.72));
    expect(theirs[0].maxHp).toBe(22);
  });

  it("stays deterministic with levels", () => {
    const opts = { seed: 77, levels: [{ bulwark: 4, ranger: 7 }, uniformLevels(3)] as [any, any] };
    const a = simulate(fight(), opts), b = simulate(fight(), opts);
    expect(a).toEqual(b);
    const m1 = new Match({ seed: 3, levels: opts.levels }), m2 = new Match({ seed: 3, levels: opts.levels });
    for (const m of [m1, m2]) { m.buy(0, 0, 4.5, 11); m.buy(1, 0, 4.5, 3); }
    expect(m1.fight()).toEqual(m2.fight());
  });

  it("higher levels win more of a mirror match", () => {
    let lead = 0;
    for (let s = 1; s <= 12; s++) {
      const r = simulate(fight().map((p) => ({ ...p, kind: p.side === 0 ? p.kind : (["bulwark", "ranger", "medic", "hive", "lamp"] as UnitKind[])[p.id - 100] })), { seed: s, levels: [uniformLevels(8), undefined] });
      lead += r.winner === 0 ? 1 : r.winner === 1 ? -1 : 0;
    }
    expect(lead).toBeGreaterThan(4);
  });
});

describe("fairness: Daily and Breakpoint puzzles are always level 1", () => {
  beforeEach(() => resetSave());
  it("their configs carry no levels, even for a levelled player", () => {
    save((s) => { s.progression = { levels: { blades: 9, ranger: 9 } }; });
    const d = dailyConfig(dailyBoard("2026-11-07"));
    const p = puzzleConfig(PUZZLES[0]);
    expect(d.levels).toBeUndefined();
    expect(p.levels).toBeUndefined();
    expect(withLevels(d, "daily")).toBe(d);
    expect(withLevels(p, "puzzle")).toBe(p);
    expect(levelsFor("daily", { blades: 9 })).toBeUndefined();
    expect(levelsFor("puzzle", { blades: 9 })).toBeUndefined();
    // ...and no commander keep bonus either, however high the commander level.
    addXp(1e6);
    expect(commander()).toBe(MAX_COMMANDER);
    expect(withLevels(d, "daily")).toBe(d);
    expect(withLevels(p, "puzzle")).toBe(p);
  });
  it("campaign configs from content.ts stay level 1 until the game adds levels", () => {
    for (const l of LEVELS) expect(levelConfig(l).levels).toBeUndefined();
  });
});

describe("costs per rarity", () => {
  it("cards and coins rise every level for every rarity", () => {
    for (const r of RARITIES) {
      expect(UPGRADE_CARDS[r]).toHaveLength(MAX_LEVEL - 1);
      for (let l = 2; l < MAX_LEVEL; l++) {
        expect(upgradeCards(l, r)).toBeGreaterThanOrEqual(upgradeCards(l - 1, r));
        expect(upgradeCoins(l, r)).toBeGreaterThan(upgradeCoins(l - 1, r));
      }
      expect(upgradeCards(MAX_LEVEL, r)).toBe(Infinity);
      expect(upgradeCoins(MAX_LEVEL, r)).toBe(Infinity);
    }
    for (let i = 1; i < UPGRADE_COINS.length; i++) expect(UPGRADE_COINS[i]).toBeGreaterThan(UPGRADE_COINS[i - 1]);
  });
  it("rarer units need fewer cards but more coins", () => {
    const totals = RARITIES.map((r) => cardsBetween(1, MAX_LEVEL, r));
    expect(totals).toEqual([804, 402, 162, 72]);
    for (let i = 1; i < totals.length; i++) expect(totals[i]).toBeLessThan(totals[i - 1]);
    const coins = RARITIES.map((r) => coinsBetween(1, MAX_LEVEL, r));
    for (let i = 1; i < coins.length; i++) expect(coins[i]).toBeGreaterThan(coins[i - 1]);
    expect(COINS_TO_MAX).toBe(12800);
    expect(upgradeCards(1, "common")).toBe(2);
    expect(upgradeCoins(1, "common")).toBe(30);
    expect(upgradeCoins(1, "legendary")).toBe(60);
    expect(upgradeCards(11, "legendary")).toBe(20);
  });
});

describe("commander level", () => {
  beforeEach(() => resetSave());
  it("XP thresholds, progress and the troop cap", () => {
    expect(commanderLevel(0)).toBe(1);
    expect(commanderLevel(COMMANDER_XP[1] - 1)).toBe(1);
    expect(commanderLevel(COMMANDER_XP[1])).toBe(2);
    expect(commanderLevel(1e9)).toBe(MAX_COMMANDER);
    expect(commanderProgress(30)).toEqual({ level: 2, into: 10, span: 40 });
    expect(commanderProgress(1e9).span).toBe(0);
    expect(levelCap(1)).toBe(BASE_CAP);
    expect(levelCap(4)).toBe(5);
    expect(levelCap(MAX_COMMANDER)).toBe(MAX_LEVEL);
    expect(keepBonus(1)).toBe(0);
    expect(keepBonus(5)).toBe(4 * KEEP_HP_PER_LEVEL);
    for (let l = 3; l <= MAX_LEVEL; l++) expect(upgradeXp(l)).toBeGreaterThan(upgradeXp(l - 1));
  });
  it("acts cleared and the steep foe curve", () => {
    const c: Record<number, number> = {};
    expect(actsCleared(c)).toBe(0);
    for (let id = 1; id <= 6; id++) c[id] = 1;
    expect(actsCleared(c)).toBe(1);
    c[12] = 2; // Act 2's boss
    expect(actsCleared(c)).toBe(2);
    // A free player's commander level by act (see outputs/economy/progression.md) always covers the foe level.
    for (let act = 1; act <= 10; act++) expect(foeLevelForAct(act)).toBeLessThanOrEqual(levelCap(act));
    expect(EXPECTED_LEVEL_BY_ACT[0]).toBe(1);
    expect(EXPECTED_LEVEL_BY_ACT[7]).toBeGreaterThanOrEqual(8); // steep: an un-upgraded army stalls
    // Acts 9-10 keep climbing one level an act, under the level cap of 12.
    expect(EXPECTED_LEVEL_BY_ACT).toHaveLength(10);
    expect([foeLevelForAct(9), foeLevelForAct(10)]).toEqual([9, 10]);
    expect(foeLevelForAct(10)).toBeLessThanOrEqual(12);
    expect(gauntletFoeLevel(1, 10)).toBe(1);
    expect(gauntletFoeLevel(7, 10)).toBe(3);
    expect(gauntletFoeLevel(40, 4)).toBe(4);
  });
  it("adds keep health in the campaign and the Gauntlet, never in Skirmish", () => {
    addXp(COMMANDER_XP[4]); // commander 5
    expect(commander()).toBe(5);
    const l = LEVELS[0];
    const cfg = withLevels(levelConfig(l), "campaign", { act: 1 });
    expect(cfg.hp).toEqual([l.hp[0] + 4 * KEEP_HP_PER_LEVEL, l.hp[1]]);
    expect(withLevels({ seed: 1 }, "gauntlet", { stage: 1 }).hp).toEqual([400 + 4 * KEEP_HP_PER_LEVEL, 400]);
    expect(withLevels({ seed: 1, hp: [300, 500] }, "skirmish").hp).toEqual([300, 500]);
  });
});

describe("army level (recommended level check)", () => {
  it("averages the best 8 found units of the roster", async () => {
    const { armyLevelOf, recommendedLevel } = await import("../engine/progression/economy");
    const lv: Partial<Record<UnitKind, number>> = { blades: 5, ranger: 5, mine: 1, medic: 3 };
    const roster: UnitKind[] = ["blades", "ranger", "mine", "medic", "golem"];
    expect(armyLevelOf(roster, (k) => lv[k] ?? 1, (k) => k !== "golem")).toBeCloseTo(14 / 4);
    const ten = UNIT_KINDS.slice(0, 10);
    expect(armyLevelOf(ten, (k) => (k === ten[0] || k === ten[1] ? 1 : 4), () => true)).toBe(4); // the two level-1s fall out
    expect(armyLevelOf([], () => 9, () => true)).toBe(1);
    expect(recommendedLevel(4)).toBe(foeLevelForAct(4));
  });
});

describe("upgrade state", () => {
  it("locked, cap, cards, coins", () => {
    const c = { 1: 3, 2: 3 };
    expect(unlockedKinds(c)).toContain("bulwark"); // level 3 is reachable
    const base = { levels: {}, found: true, cards: 2, coins: 30, commander: 1 };
    expect(upgradeState("golem", { ...base, found: false }).why).toBe("locked");
    expect(upgradeState("blades", { ...base, cards: 1 }).why).toBe("cards");
    expect(upgradeState("blades", { ...base, coins: 29 }).why).toBe("coins");
    expect(upgradeState("blades", base)).toMatchObject({ why: null, need: 2, cost: 30, rarity: "common" });
    expect(upgradeState("blades", { ...base, levels: { blades: 2 }, cards: 1e6, coins: 1e6 })).toMatchObject({ why: "cap", cap: 2 });
    expect(upgradeState("golem", { ...base, levels: { golem: MAX_LEVEL }, commander: MAX_COMMANDER }).why).toBe("max");
    expect(upgradeState("golem", { ...base, cards: 1, coins: 60 })).toMatchObject({ why: null, need: 1, cost: 60, rarity: "legendary" });
  });
});

describe("upgrading on the device", () => {
  beforeEach(() => resetSave());
  it("spends cards and coins, saves the level and earns commander XP", () => {
    expect(upgradeTroop("blades")).toBeNull(); // not found
    grantCards("blades", 1, "test"); // finds it, no spares
    expect(upgradeTroop("blades")).toBeNull(); // no cards
    grantCards("blades", 5, "test");
    expect(upgradeTroop("blades")).toBeNull(); // no coins
    earn("coins", 100, "test");
    expect(upgradeTroop("blades")).toEqual({ level: 2, xp: upgradeXp(2), commanderUp: null });
    expect(wallet().coins).toBe(70);
    expect(cardsOf("blades")).toBe(3);
    expect(troopLevel("blades")).toBe(2);
    expect(troopState("blades").why).toBe("cap"); // commander 1: cap 2
    expect(upgradeTroop("blades")).toBeNull();
    expect(wallet().coins).toBe(70);
    addXp(COMMANDER_XP[1]);
    expect(commander()).toBe(2);
    expect(troopState("blades")).toMatchObject({ why: "cards", cards: 3, need: 4 }); // cap 3 now
    expect(load().progression?.levels).toEqual({ blades: 2 });
  });
  it("a big enough upgrade reports a commander level-up", () => {
    grantCards("golem", 5, "test");
    earn("coins", 1000, "test");
    addXp(COMMANDER_XP[1] - 1);
    expect(upgradeTroop("golem")?.commanderUp).toBe(2);
  });
  it("campaign wins grant cards: a first clear finds the units the level introduces", () => {
    const l = LEVELS.find((x) => x.unlock === "bulwark")!;
    expect(isFound("bulwark")).toBe(false);
    const r = awardCampaign(l, true, 3);
    expect(isFound("bulwark")).toBe(true);
    expect(r.cards?.length).toBeGreaterThan(0);
    expect(r.xp).toBeGreaterThan(0);
    expect(awardCampaign(l, false, 0).cards).toBeUndefined();
    const replay = campaignCards({ act: 2, roster: ["blades", "golem"], unlocks: [], first: false, won: true, salt: 1 });
    expect(replay).toHaveLength(1);
  });
});

describe("migration to the card collection", () => {
  it("old levels map to the new scale with about the same stats, rounded up", () => {
    expect(migrateLevel(1)).toBe(1);
    expect(migrateLevel(2)).toBe(2);
    expect(migrateLevel(4)).toBe(3);
    expect(migrateLevel(10)).toBe(5);
    for (let l = 1; l <= 10; l++) expect(levelHp(migrateLevel(l))).toBeGreaterThanOrEqual(1 + 0.03 * (l - 1) - 1e-9);
  });
  it("finds every unit met in the campaign plus the starters, converts levels, once", () => {
    const s = load();
    s.campaign = { 1: 3, 2: 3, 3: 2, 4: 1, 5: 1, 6: 1, 7: 1, 8: 1, 9: 1, 10: 1, 11: 1, 12: 1, 13: 1, 14: 1 };
    s.progression = { levels: { blades: 10, ranger: 4 }, legacyPaid: true };
    delete s.collection;
    expect(migrateArmySave(s)).toBe(true);
    expect(s.progression?.levels).toEqual({ blades: 5, ranger: 3 });
    expect(s.progression?.v).toBe(2);
    expect(s.progression?.xp).toBeGreaterThan(0);
    const found = s.collection!.found;
    for (const k of [...unlockedKinds(s.campaign), ...STARTER_KINDS]) expect(found).toContain(k);
    expect(found).not.toContain("golem");
    expect(Object.values(s.collection!.cards).reduce((x, y) => x + (y ?? 0), 0)).toBeGreaterThan(20); // first-clear cards back-paid
    expect(migrateArmySave(s)).toBe(false);
    expect(s.progression?.levels).toEqual({ blades: 5, ranger: 3 });
  });
  it("a new save starts with a handful of commons found", () => {
    const s = load();
    s.campaign = {};
    delete s.progression; delete s.collection;
    migrateArmySave(s);
    expect(s.collection!.found.sort()).toEqual([...STARTER_KINDS].sort());
  });
});

describe("levels in match configs", () => {
  beforeEach(() => resetSave());
  it("feeds levels into campaign, gauntlet and skirmish configs", () => {
    save((s) => { s.progression = { levels: { blades: 3 } }; });
    const l = LEVELS[20]; // Act 4
    const cfg = withLevels(levelConfig(l), "campaign", { act: l.act });
    expect(cfg.levels?.[0]).toEqual({ blades: 3 });
    expect(cfg.levels?.[1]?.golem).toBe(foeLevelForAct(4));
    expect(withLevels({ seed: 1 }, "skirmish").levels).toEqual([{ blades: 3 }, { blades: 3 }]);
    expect(withLevels({ seed: 1 }, "gauntlet", { stage: 1 }).levels).toEqual([{ blades: 3 }, undefined]);
    // Act 1-2 foes are level 1, so a level-1 player's campaign config is the old one.
    resetSave();
    const a1 = levelConfig(LEVELS[0]);
    expect(withLevels(a1, "campaign", { act: 1 })).toBe(a1);
  });
});

describe("coin rewards", () => {
  beforeEach(() => resetSave());
  it("campaign pays for wins, stars and a first clear; nothing for a loss", () => {
    expect(campaignReward({ act: 1, won: false, stars: 0, prevStars: 0 }).coins).toBe(0);
    const first = campaignReward({ act: 1, won: true, stars: 3, prevStars: 0 });
    const again = campaignReward({ act: 1, won: true, stars: 3, prevStars: 3 });
    expect(first.coins).toBe(38 + 45 + 125);
    expect(again.coins).toBe(38 + 45);
    expect(campaignReward({ act: 5, won: true, stars: 1, prevStars: 1 }).coins).toBeGreaterThan(campaignReward({ act: 1, won: true, stars: 1, prevStars: 1 }).coins);
  });
  it("first clear is read before the stars are saved, then paid once", () => {
    const l = LEVELS[0];
    expect(awardCampaign(l, true, 2).parts.map(([t]) => t)).toContain("First clear");
    save((s) => { s.campaign[l.id] = 2; });
    expect(awardCampaign(l, true, 3).parts.map(([t]) => t)).not.toContain("First clear");
    expect(wallet().coins).toBe(38 + 30 + 125 + 38 + 45);
  });
  it("caps replay coins a day; first clears are never capped and don't count", () => {
    expect(campaignReward({ act: 8, won: true, stars: 3, prevStars: 3, replayEarnedToday: REPLAY_DAILY_CAP }).coins).toBe(0);
    // Part-spent: the win is paid first, then what's left of the stars.
    const tail = campaignReward({ act: 1, won: true, stars: 3, prevStars: 3, replayEarnedToday: REPLAY_DAILY_CAP - 50 });
    expect(tail.coins).toBe(50);
    expect(tail.parts).toEqual([["Victory", 38], ["3 stars", 12]]);
    expect(campaignReward({ act: 1, won: true, stars: 3, prevStars: 0, replayEarnedToday: REPLAY_DAILY_CAP }).coins).toBe(38 + 45 + 125);

    const l = LEVELS[LEVELS.length - 1];
    save((s) => { s.campaign[l.id] = 3; });
    const day = new Date(2026, 10, 7, 12);
    let total = 0;
    for (let i = 0; i < 20; i++) total += awardCampaign(l, true, 3, day).coins;
    expect(total).toBe(REPLAY_DAILY_CAP);
    // A first clear the same day still pays in full, and doesn't eat into tomorrow.
    const fresh = LEVELS[0];
    save((s) => { delete s.campaign[fresh.id]; });
    expect(awardCampaign(fresh, true, 3, day).coins).toBe(38 + 45 + 125);
    expect(awardCampaign(l, true, 3, new Date(2026, 10, 8, 12)).coins).toBe(CAMPAIGN_WIN(l.act) + 45);
  });
  it("gauntlet, daily and skirmish", () => {
    expect(gauntletRivalReward(1).coins).toBe(40);
    expect(gauntletRivalReward(50).coins).toBe(150);
    expect(dailyReward({ won: true, scored: false, streak: 3 }).coins).toBe(0);
    expect(dailyReward({ won: true, scored: true, streak: 3 }).coins).toBe(230);
    expect(dailyReward({ won: false, scored: true, streak: 20 }).coins).toBe(160);
    expect(skirmishReward({ won: true, watch: true, difficulty: 1, hp: [400, 400], earnedToday: 0 }).coins).toBe(0);
    expect(skirmishReward({ won: true, watch: false, difficulty: 1, hp: [400, 400], earnedToday: 0 }).coins).toBe(80);
    expect(skirmishReward({ won: true, watch: false, difficulty: 1, hp: [800, 50], earnedToday: 0 }).coins).toBe(20);
    const day = new Date(2026, 10, 7, 12);
    let total = 0;
    for (let i = 0; i < 10; i++) total += awardSkirmish(true, false, 1, [400, 400], day).coins;
    expect(total).toBe(SKIRMISH_DAILY_CAP);
    expect(awardSkirmish(true, false, 1, [400, 400], new Date(2026, 10, 8, 12)).coins).toBe(80);
  });
});

describe("legacy coins for clears made before troop levels", () => {
  it("pays each cleared level's first-clear coins once, by act", async () => {
    const { legacyCoins } = await import("../engine/progression/troops");
    expect(legacyCoins({})).toBe(0);
    // Levels 1-6 are Act 1 (125 each), level 7 is Act 2 (150); unplayed and zero-star entries pay nothing.
    expect(legacyCoins({ 1: 3, 2: 1, 3: 2, 4: 3, 5: 1, 6: 3, 7: 2, 8: 0 })).toBe(6 * 125 + 150);
  });
});

describe("the deck", () => {
  beforeEach(() => resetSave());
  it("narrows your in-match shop when it covers enough of the roster", async () => {
    const { deckRoster, DECK_MIN } = await import("../engine/progression/economy");
    expect(deckRoster(["blades", "ranger", "mine"], [])).toBeUndefined(); // no deck: the whole roster, as tuned
    expect(deckRoster(["blades", "ranger", "mine", "medic", "bulwark"], ["medic", "blades", "ranger", "golem"])).toBeUndefined(); // 3 < DECK_MIN
    expect(DECK_MIN).toBe(4);
    expect(deckRoster(["blades", "ranger", "mine", "medic", "bulwark"], ["medic", "blades", "ranger", "bulwark"])).toEqual(["blades", "ranger", "medic", "bulwark"]);
  });
  it("only found units, at most 8, applied to campaign, Gauntlet and Skirmish but never the Daily or puzzles", async () => {
    const { deck, toggleDeck } = await import("../engine/progression/troops");
    expect(toggleDeck("golem")).toBe(false); // not found
    const kinds = UNIT_KINDS.slice(0, 9);
    for (const k of kinds) grantCards(k, 1, "test");
    for (const k of kinds) toggleDeck(k);
    expect(deck()).toEqual(kinds.slice(0, 8));
    expect(toggleDeck(kinds[0])).toBe(false); // removed
    expect(deck()).toHaveLength(7);
    const l = LEVELS[LEVELS.length - 1];
    const cfg = withLevels(levelConfig(l), "campaign", { act: l.act });
    expect(cfg.roster?.[0]).toEqual(l.roster.filter((k) => deck().includes(k)));
    expect(cfg.roster?.[1]).toEqual(levelConfig(l).roster?.[1]);
    expect(withLevels({ seed: 1 }, "skirmish").roster?.[0]).toEqual(UNIT_KINDS.filter((k) => deck().includes(k)));
    expect(withLevels({ seed: 1 }, "gauntlet", { stage: 1 }).roster?.[1]).toBeUndefined();
    const d = dailyConfig(dailyBoard("2026-11-07"));
    expect(withLevels(d, "daily")).toBe(d);
    expect(withLevels({ seed: 1 }, "watch").roster).toBeUndefined();
  });
});
