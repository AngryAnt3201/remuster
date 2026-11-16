// Cloud-save sync (engine/net/sync.ts) against the real Worker: the merge rule, the boot pull, debounced pushes,
// conflicts with another device, and backing off when the backend is away.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { blankArena } from "../../engine/core/arena";
import * as net from "../../engine/net/client";
import { mergeSaves, startSync, stopSync, syncNow, syncState } from "../../engine/net/sync";
import { load, resetSave, save, subscribe, type Save } from "../../engine/save";
import { handle } from "../src/worker";
import type { Env } from "../src/env";
import { localD1, migrate } from "../local/d1";
import { localR2 } from "../local/r2";

let env: Env, down = false, calls: string[] = [];
const mem = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) }; };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const until = async (ok: () => boolean, ms = 2000) => { for (let t = 0; !ok() && t < ms; t += 5) await sleep(5); expect(ok()).toBe(true); };
const cloud = async () => (await net.pullSave<Save>())!;
const base = (over: Partial<Save> = {}): Save => ({
  campaign: {}, puzzles: {}, gauntlet: { best: 0, runs: 0 }, daily: { streak: 0, bestStreak: 0, best: 0, played: 0, wins: 0 },
  settings: { sound: true, haptics: true, speed: 1 }, seen: [], arena: blankArena(), ...over,
});
const FAST = { debounceMs: 10, minGapMs: 0, backoffMs: 20, maxBackoffMs: 80 };

beforeEach(async () => {
  const DB = localD1(); await migrate(DB);
  env = { DB, GAMES: localR2(), TOKEN_SECRET: "s" };
  down = false; calls = [];
  net.configure({
    api: "https://api.test/", storage: mem(),
    fetch: ((url: string, init?: RequestInit) => { calls.push(`${init?.method} ${new URL(url).pathname}`); return down ? Promise.reject(new Error("net")) : handle(new Request(url, init), env); }) as typeof fetch,
  });
  resetSave();
});
afterEach(() => stopSync());

describe("the save's change hook", () => {
  it("counts every write and tells subscribers", () => {
    const seen: number[] = [];
    const off = subscribe((s) => seen.push(s.rev!));
    const r0 = load().rev!;
    save((s) => { s.campaign[1] = 3; });
    save();
    off();
    save();
    expect(seen).toEqual([r0 + 1, r0 + 2]);
    expect(load().rev).toBe(r0 + 3);
  });
});

describe("merging two saves", () => {
  it("takes the newer save whole and the best of both for what only grows", () => {
    const phone = base({
      rev: 40, campaign: { 1: 3, 2: 1 }, puzzles: { 1: 2 }, gauntlet: { best: 4, runs: 9 }, seen: ["blades", "ranger"],
      daily: { streak: 2, bestStreak: 6, best: 900, bestKey: "2026-01-02", played: 12, wins: 7, last: "2026-01-09" },
      wallet: { coins: 120, gems: 5, earned: { coins: 500, gems: 5 }, spent: { coins: 380, gems: 0 }, txIds: ["t1"] },
      progression: { levels: { ranger: 5, blades: 2 }, xp: 300, v: 2, deck: ["ranger"] },
      collection: { cards: { ranger: 3, golem: 2 }, found: ["ranger", "golem"] },
      cosmetics: { owned: ["keep-a", "keep-b"], equipped: { keep: "keep-b" } },
      arena: { ...blankArena(), trophies: 210, best: 240, wins: 9, played: 12 },
      settings: { sound: false, haptics: true, speed: 2 },
    });
    const tablet = base({
      rev: 55, campaign: { 1: 2, 2: 3, 3: 1 }, puzzles: {}, gauntlet: { best: 2, runs: 11 }, seen: ["ranger", "medic"],
      daily: { streak: 0, bestStreak: 3, best: 400, bestKey: "2026-01-05", played: 15, wins: 6 },
      wallet: { coins: 40, gems: 9, earned: { coins: 700, gems: 9 }, spent: { coins: 660, gems: 0 }, txIds: [] },
      progression: { levels: { ranger: 3, blades: 4, medic: 2 }, xp: 250, v: 2, deck: ["blades", "medic"] },
      collection: { cards: { ranger: 1, blades: 6 }, found: ["ranger", "blades"] },
      cosmetics: { owned: ["keep-a", "keep-c"], equipped: { keep: "keep-c" } },
      arena: { ...blankArena(), trophies: 180, best: 260, wins: 11, played: 16 },
    });
    const m = mergeSaves(phone, tablet);
    // newer (the tablet) whole: what can go down, and what belongs together
    expect(m.wallet).toEqual(tablet.wallet);
    expect(m.arena).toEqual(tablet.arena);
    expect(m.settings).toEqual(tablet.settings);
    expect(m.progression!.deck).toEqual(["blades", "medic"]);
    expect(m.cosmetics!.equipped).toEqual({ keep: "keep-c" });
    expect(m.daily.streak).toBe(0);
    // the best of both: what only grows
    expect(m.campaign).toEqual({ 1: 3, 2: 3, 3: 1 });
    expect(m.puzzles).toEqual({ 1: 2 });
    expect(m.gauntlet).toEqual({ best: 4, runs: 11 });
    expect([...m.seen].sort()).toEqual(["blades", "medic", "ranger"]);
    expect(m.daily).toMatchObject({ best: 900, bestKey: "2026-01-02", bestStreak: 6, played: 15, wins: 7 });
    expect(m.progression).toMatchObject({ levels: { ranger: 5, blades: 4, medic: 2 }, xp: 300, v: 2 });
    expect(m.collection).toEqual({ cards: { ranger: 1, blades: 6, golem: 2 }, found: ["ranger", "blades", "golem"] });
    expect([...m.cosmetics!.owned].sort()).toEqual(["keep-a", "keep-b", "keep-c"]);
    expect(m.rev).toBe(55);
    // the same whichever device does the merging, and merging again changes nothing
    const other = mergeSaves(tablet, phone);
    expect(other).toEqual(m);
    expect(mergeSaves(m, tablet)).toEqual(m);
    expect(mergeSaves(m, phone)).toEqual(m);
    // inputs untouched
    expect(phone.campaign).toEqual({ 1: 3, 2: 1 });
    expect(tablet.collection!.found).toEqual(["ranger", "blades"]);
  });

  it("a tie goes to the device, and old saves with missing parts merge", () => {
    const a = base({ rev: 7, wallet: { coins: 5, gems: 0, earned: { coins: 5, gems: 0 }, spent: { coins: 0, gems: 0 }, txIds: [] } });
    const b = base({ rev: 7, wallet: { coins: 9, gems: 0, earned: { coins: 9, gems: 0 }, spent: { coins: 0, gems: 0 }, txIds: [] } });
    expect(mergeSaves(a, b).wallet!.coins).toBe(5);
    const old = { campaign: { 4: 2 }, puzzles: {}, gauntlet: { best: 1, runs: 1 }, settings: { sound: true, haptics: true, speed: 1 }, seen: [] } as unknown as Save;
    const m = mergeSaves(base({ rev: 3, progression: { levels: { golem: 2 } } }), old);
    expect(m.campaign).toEqual({ 4: 2 });
    expect(m.progression!.levels).toEqual({ golem: 2 });
    expect(mergeSaves(old, base({ rev: 3 })).gauntlet).toEqual({ best: 1, runs: 1 });
  });
});

describe("the sync loop", () => {
  it("does nothing with no backend", async () => {
    net.configure({ api: null });
    startSync(FAST);
    save((s) => { s.campaign[1] = 3; });
    await sleep(40);
    expect(syncState().running).toBe(false);
    expect(calls).toEqual([]);
  });

  it("on a new account, pushes the device save up", async () => {
    save((s) => { s.campaign[1] = 3; });
    startSync(FAST);
    await until(() => syncState().rev === 1);
    expect((await cloud()).data).toEqual(load());
    expect(syncState()).toMatchObject({ pulled: true, dirty: false, fails: 0 });
  });

  it("on boot, pulls the cloud save and merges it into the device save", async () => {
    // Another device has been playing this account.
    await net.pushSave(0, base({ rev: 500, campaign: { 1: 3, 2: 2 }, wallet: { coins: 750, gems: 3, earned: { coins: 750, gems: 3 }, spent: { coins: 0, gems: 0 }, txIds: [] } }));
    save((s) => { s.campaign[2] = 3; s.campaign[7] = 1; }); // and this one has a little of its own
    const held = load();
    let told = 0;
    startSync({ ...FAST, onMerged: () => told++ });
    await until(() => syncState().pulled && !syncState().dirty && syncState().rev === 2);
    expect(told).toBe(1);
    expect(load()).toBe(held); // same object: nothing the game holds went stale
    expect(load().wallet!.coins).toBe(750);
    expect(load().campaign).toEqual({ 1: 3, 2: 3, 7: 1 });
    expect((await cloud()).data!.campaign).toEqual({ 1: 3, 2: 3, 7: 1 }); // and the merge went back up
  });

  it("pushes local writes after a quiet moment, several writes as one", async () => {
    startSync(FAST);
    await until(() => syncState().rev === 1);
    calls = [];
    for (let i = 1; i <= 5; i++) save((s) => { s.campaign[i] = 3; });
    expect(calls).toEqual([]); // nothing sent while the game is writing
    await until(() => syncState().rev === 2);
    expect(calls).toEqual(["PUT /v1/save"]);
    expect((await cloud()).data!.campaign).toEqual({ 1: 3, 2: 3, 3: 3, 4: 3, 5: 3 });
  });

  it("keeps pushes apart by the minimum gap", async () => {
    startSync({ ...FAST, minGapMs: 150 });
    await until(() => syncState().rev === 1);
    save((s) => { s.campaign[1] = 1; });
    await sleep(60);
    expect(syncState()).toMatchObject({ rev: 1, dirty: true });
    await until(() => syncState().rev === 2);
  });

  it("when another device wrote first, merges its copy and pushes the result", async () => {
    startSync(FAST);
    await until(() => syncState().rev === 1);
    const theirs = base({ ...JSON.parse(JSON.stringify(load())), campaign: { 9: 2 }, rev: 3 });
    expect((await net.pushSave(1, theirs)).ok).toBe(true); // the other device, based on the same revision
    save((s) => { s.campaign[1] = 3; s.puzzles[4] = 1; });
    await until(() => syncState().rev === 3 && !syncState().dirty);
    expect(load().campaign).toEqual({ 1: 3, 9: 2 });
    const c = await cloud();
    expect(c.rev).toBe(3);
    expect(c.data).toEqual(load());
    expect(c.data!.puzzles).toEqual({ 4: 1 });
  });

  it("backs off while the backend is away, never throws into the game, and catches up after", async () => {
    startSync(FAST);
    await until(() => syncState().rev === 1);
    down = true;
    save((s) => { s.campaign[1] = 3; });
    await until(() => syncState().fails >= 2);
    expect(syncState().dirty).toBe(true);
    save((s) => { s.campaign[2] = 2; }); // the game carries on
    const before = calls.length;
    await sleep(100);
    expect(calls.length - before).toBeLessThanOrEqual(3); // retries are spaced out, not a busy loop
    down = false;
    await until(() => !syncState().dirty && syncState().fails === 0);
    expect((await cloud()).data!.campaign).toEqual({ 1: 3, 2: 2 });
  });

  it("starts while the backend is away and pulls once it is back", async () => {
    await net.ensurePlayer();
    await net.pushSave(0, base({ rev: 900, campaign: { 5: 3 } }));
    down = true;
    startSync(FAST);
    await until(() => syncState().fails >= 1);
    expect(syncState().pulled).toBe(false);
    down = false;
    await until(() => syncState().pulled && !syncState().dirty);
    expect(load().campaign).toEqual({ 5: 3 });
    await syncNow();
  });
});
