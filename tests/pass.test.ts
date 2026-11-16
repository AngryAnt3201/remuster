// Daily quests and the War Pass: seeding, progress, XP and tiers, retroactive Premium, one Premium a season,
// crediting once per transaction, the skip price and the chest-speed perk.
import { describe, expect, it } from "vitest";
import {
  QUESTS_PER_DAY, blankQuests, claimQuestIn, normalizeQuests, progressIn, questsFor, rollIn, type QuestSave,
} from "../engine/progression/quests";
import {
  CROWN_XP, CROWN_XP_DAILY_CAP, FREE_TRACK, MAX_XP, PREMIUM_TRACK, SEASON_EPOCH, SEASON_MS, SKIP_TIER_GEMS, TIERS, XP_PER_TIER,
  addXpIn, blankPass, cardTarget, claimIn, claimable, claimableCount, creditPremiumIn, crownXpIn, normalizePass, seasonAt,
  seasonEnd, seasonIn, seasonStart, skipCost, skipIn, themeOf, tierOf, trackGems,
} from "../engine/progression/pass";
import { chestUnlockFactor, setChestUnlockFactor } from "../engine/progression/passEvents";
import { CHESTS, blankChests, startIn } from "../engine/progression/chests";
import { KEEP_SKINS } from "../engine/progression/cosmetics";

describe("daily quests", () => {
  it("are three different kinds, the same for everyone on a date, and change from day to day", () => {
    const a = questsFor("2026-11-07");
    expect(a).toHaveLength(QUESTS_PER_DAY);
    expect(new Set(a.map((q) => q.kind)).size).toBe(3);
    expect(questsFor("2026-11-07")).toEqual(a);
    const days = Array.from({ length: 20 }, (_, i) => questsFor(`2026-12-${String(i + 1).padStart(2, "0")}`).map((q) => q.kind).join());
    expect(new Set(days).size).toBeGreaterThan(5);
    for (const q of a) { expect(q.coins).toBeGreaterThan(0); expect(q.xp).toBeGreaterThan(0); expect(q.text).toBeTruthy(); }
  });

  it("count the right events, cap at the target, and pay once when tapped", () => {
    // Find a day with a "stars" quest so the test reads clearly.
    let day = "", i = -1;
    for (let d = 1; d < 60 && i < 0; d++) { day = `2027-01-${String(d).padStart(2, "0")}`; i = questsFor(day).findIndex((q) => q.kind === "stars"); }
    if (i < 0) { day = "2027-02-01"; i = questsFor(day).findIndex((q) => q.kind === "stars"); }
    expect(i).toBeGreaterThanOrEqual(0);
    const q = blankQuests(day), need = questsFor(day)[i].n;
    progressIn(q, day, { kind: "upgrade" });
    expect(q.have[i]).toBe(0);
    progressIn(q, day, { kind: "win", stars: 3 });
    expect(q.have[i]).toBe(3);
    expect(claimQuestIn(q, day, i)).toBeNull(); // not finished
    const done = progressIn(q, day, { kind: "win", stars: 20 });
    expect(q.have[i]).toBe(need);
    expect(done).toContain(i);
    const pay = claimQuestIn(q, day, i);
    expect(pay).toEqual({ coins: questsFor(day)[i].coins, xp: questsFor(day)[i].xp, quests: 1 });
    expect(claimQuestIn(q, day, i)).toBeNull();
  });

  it("reset at the day's end and pay yesterday's finished-but-unclaimed quests once", () => {
    const day = "2026-11-07", q: QuestSave = blankQuests(day);
    const ds = questsFor(day);
    q.have = ds.map((d) => d.n);
    q.claimed = [true, false, false];
    const owed = rollIn(q, "2026-11-08");
    expect(owed.quests).toBe(2);
    expect(owed.coins).toBe(ds[1].coins + ds[2].coins);
    expect(owed.xp).toBe(ds[1].xp + ds[2].xp);
    expect(q).toEqual(blankQuests("2026-11-08"));
    expect(rollIn(q, "2026-11-08").quests).toBe(0);
  });

  it("normalise junk from an old or broken save", () => {
    expect(normalizeQuests(undefined)).toEqual(blankQuests(""));
    expect(normalizeQuests({ day: "x", have: [-3, 2.7, "a" as unknown as number], claimed: [1 as unknown as boolean, true] })).toEqual({ day: "x", have: [0, 2, 0], claimed: [false, true, false] });
  });
});

describe("the season clock", () => {
  it("numbers 30-day seasons from a fixed UTC epoch, with a name and theme", () => {
    expect(seasonAt(SEASON_EPOCH)).toBe(1);
    expect(seasonAt(SEASON_EPOCH - 1)).toBe(1);
    expect(seasonAt(SEASON_EPOCH + SEASON_MS - 1)).toBe(1);
    expect(seasonAt(SEASON_EPOCH + SEASON_MS)).toBe(2);
    expect(seasonEnd(1)).toBe(seasonStart(2));
    expect(SEASON_MS).toBe(30 * 86_400_000);
    expect(themeOf(1).name).toBeTruthy();
    expect(themeOf(1 + 5).name).toBe(themeOf(1).name);
  });
});

describe("pass XP and tiers", () => {
  it("fills a tier every 120 XP up to 30, and stops there", () => {
    const p = blankPass();
    expect(tierOf(0)).toBe(0);
    expect(addXpIn(p, XP_PER_TIER - 1)).toEqual({ from: 0, to: 0 });
    expect(addXpIn(p, 1)).toEqual({ from: 0, to: 1 });
    addXpIn(p, 1e9);
    expect(p.xp).toBe(MAX_XP);
    expect(tierOf(p.xp)).toBe(TIERS);
    expect(addXpIn(p, -50).to).toBe(TIERS);
  });

  it("gives crown XP per star or crown up to a daily cap", () => {
    const p = blankPass();
    expect(crownXpIn(p, "d1", 3)).toBe(3 * CROWN_XP);
    expect(crownXpIn(p, "d1", 1000)).toBe(CROWN_XP_DAILY_CAP - 3 * CROWN_XP);
    expect(crownXpIn(p, "d1", 3)).toBe(0);
    expect(crownXpIn(p, "d2", 2)).toBe(2 * CROWN_XP);
  });

  it("claims free rewards of tiers reached, once each", () => {
    const p = blankPass();
    addXpIn(p, 2 * XP_PER_TIER);
    expect(claimIn(p, "free", 3)).toBeNull();
    expect(claimIn(p, "free", 1)).toEqual(FREE_TRACK[0]);
    expect(claimIn(p, "free", 1)).toBeNull();
    expect(claimIn(p, "premium", 1)).toBeNull(); // no Premium
    expect(claimableCount(p)).toBe(1);
  });

  it("has 30 tiers a track, Blossom at free 15, Gilded at premium 30, and premium worth more", () => {
    expect(FREE_TRACK).toHaveLength(TIERS);
    expect(PREMIUM_TRACK).toHaveLength(TIERS);
    expect(FREE_TRACK[14]).toMatchObject({ kind: "skin", id: "keep:blossom" });
    expect(PREMIUM_TRACK[29]).toMatchObject({ kind: "skin", id: "keep:gilded" });
    for (const r of [...FREE_TRACK, ...PREMIUM_TRACK]) if (r.kind === "skin") expect(KEEP_SKINS as readonly string[]).toContain(r.id);
    expect(PREMIUM_TRACK.some((r) => r.kind === "cards" && r.rarity === "legendary")).toBe(true);
    expect(FREE_TRACK.some((r) => r.kind === "cards" && r.rarity === "legendary")).toBe(false);
    expect(trackGems("premium")).toBeGreaterThan(3 * trackGems("free"));
  });

  it("prices a tier skip by the XP still needed, and fills exactly that tier", () => {
    const p = blankPass();
    expect(skipCost(p)).toBe(SKIP_TIER_GEMS);
    addXpIn(p, XP_PER_TIER / 2);
    expect(skipCost(p)).toBe(SKIP_TIER_GEMS / 2);
    expect(skipIn(p)).toBe(true);
    expect(p.xp).toBe(XP_PER_TIER);
    addXpIn(p, MAX_XP);
    expect(skipCost(p)).toBe(0);
    expect(skipIn(p)).toBe(false);
  });
});

describe("War Pass Premium", () => {
  it("is retroactive: every tier already reached becomes claimable at once", () => {
    const p = blankPass(3);
    addXpIn(p, 12 * XP_PER_TIER + 5);
    expect(claimable(p, "premium", 1)).toBe(false);
    expect(creditPremiumIn(p, "tx-1", 3)).toBe("paid");
    for (let t = 1; t <= 12; t++) expect(claimable(p, "premium", t)).toBe(true);
    expect(claimable(p, "premium", 13)).toBe(false);
    expect(claimableCount(p)).toBe(24);
  });

  it("credits once per transaction, and a second purchase in the same season pays gems instead", () => {
    const p = blankPass(2);
    expect(creditPremiumIn(p, "tx-a", 2)).toBe("paid");
    expect(creditPremiumIn(p, "tx-a", 2)).toBe("dup");
    expect(creditPremiumIn(p, "tx-b", 2)).toBe("extra");
    expect(p.premium).toEqual([2]);
    expect(creditPremiumIn(p, "", 2)).toBe("dup");
  });

  it("is per season: a new season starts at tier 0 without Premium, keeping the transaction record", () => {
    const p = blankPass(1);
    creditPremiumIn(p, "tx-1", 1);
    addXpIn(p, 5 * XP_PER_TIER);
    claimIn(p, "free", 1);
    seasonIn(p, 2);
    expect(p.xp).toBe(0);
    expect(p.free).toEqual([]);
    expect(claimable(p, "premium", 1)).toBe(false);
    expect(p.txIds).toEqual(["tx-1"]);
    expect(creditPremiumIn(p, "tx-1", 2)).toBe("dup");
    expect(creditPremiumIn(p, "tx-2", 2)).toBe("paid");
  });

  it("survives a broken save", () => {
    const p = normalizePass({ season: 2, xp: 1e9, free: [0, 1, 1, 31, 2.5 as number], premium: [2, -1], txIds: ["a", 3 as unknown as string] });
    expect(p.xp).toBe(MAX_XP);
    expect(p.free).toEqual([1]);
    expect(p.premium).toEqual([2]);
    expect(p.txIds).toEqual(["a"]);
  });

  it("makes chests unlock 20% faster through the chest timer hook, and only while the factor is set", () => {
    const c = blankChests();
    c.slots[0] = { id: 1, type: "iron", act: 1, seed: 1, contents: { coins: 0, gems: 0, cards: [] } };
    setChestUnlockFactor(() => 0.8);
    expect(chestUnlockFactor()).toBe(0.8);
    expect(startIn(c, 0, 1000)).toBe(true);
    expect(c.slots[0]!.readyAt).toBe(1000 + 0.8 * CHESTS.iron.unlockMs);
    setChestUnlockFactor(() => 5); // nonsense never slows a chest down
    expect(chestUnlockFactor()).toBe(1);
    setChestUnlockFactor(() => 1);
  });
});

describe("card rewards go to a specific unit, never a random one", () => {
  it("picks the found unit of that rarity with the fewest spare cards", () => {
    const spare = (k: string) => ({ blades: 30, ranger: 2 } as Record<string, number>)[k] ?? 0;
    expect(cardTarget("common", 10, ["blades", "ranger", "medic"], ["blades", "ranger"], spare as never)).toEqual({ kind: "ranger", n: 10, rarity: "common" });
  });
  it("drops a rarity at the same coin value when none of that rarity can be found yet", () => {
    const t = cardTarget("legendary", 1, ["blades", "shade"], ["blades"], () => 0);
    expect(t).toEqual({ kind: "shade", n: 7, rarity: "epic" });
    expect(cardTarget("rare", 1, [], [], () => 0)).toBeNull();
  });
});
