// Daily quests: three a day, the same for everyone on a date (seeded by the local day, like the daily deals), each
// paying coins plus War Pass XP when tapped. Progress comes from the [pass] events (engine/progression/passEvents.ts).
// A finished quest left unclaimed at midnight is paid automatically on the next day's first look, so nothing is lost.
// Pure rules over a save-shaped object, plus a thin binding to the device save. Numbers: outputs/economy/pass.md.
import { load, save, type Save } from "../save";
import { earn } from "../economy/wallet";
import { hash, localDay, rng } from "./chests";
import { onPassEvent, type PassEvent } from "./passEvents";

export type QuestKind = "win" | "stars" | "upgrade" | "chest" | "bastion" | "daily";

export interface QuestDef { kind: QuestKind; n: number; coins: number; xp: number; text: string }

/** The pool: each kind's target options and its pay. The harder asks pay more. */
export const QUEST_KINDS: Record<QuestKind, { ns: number[]; coins: number; xp: number; text: (n: number) => string }> = {
  win:     { ns: [2, 3], coins: 120, xp: 50, text: (n) => `Win ${n} battles` },
  stars:   { ns: [6, 9], coins: 150, xp: 60, text: (n) => `Earn ${n} stars or crowns` },
  upgrade: { ns: [1, 2], coins: 100, xp: 40, text: (n) => (n === 1 ? "Upgrade a unit" : `Upgrade units ${n} times`) },
  chest:   { ns: [1, 2], coins: 100, xp: 40, text: (n) => (n === 1 ? "Open a chest" : `Open ${n} chests`) },
  bastion: { ns: [1],    coins: 120, xp: 50, text: () => "Play Bastion" },
  daily:   { ns: [1],    coins: 100, xp: 40, text: () => "Play the Daily Challenge" },
};
export const QUESTS_PER_DAY = 3;
const KINDS = Object.keys(QUEST_KINDS) as QuestKind[];

/** The day's three quests: three different kinds, picked and sized by a seed from the date. */
export function questsFor(day: string): QuestDef[] {
  const rand = rng(hash(`muster-quests-${day}`));
  const left = [...KINDS], out: QuestDef[] = [];
  while (out.length < QUESTS_PER_DAY) {
    const kind = left.splice(Math.floor(rand() * left.length), 1)[0];
    const k = QUEST_KINDS[kind];
    const i = Math.floor(rand() * k.ns.length), n = k.ns[i];
    // A bigger target pays a little more of both.
    const bump = 1 + 0.25 * i;
    out.push({ kind, n, coins: Math.round((k.coins * bump) / 10) * 10, xp: Math.round((k.xp * bump) / 5) * 5, text: k.text(n) });
  }
  return out;
}

export interface QuestSave { day: string; have: number[]; claimed: boolean[] }
export const blankQuests = (day = ""): QuestSave => ({ day, have: [0, 0, 0], claimed: [false, false, false] });

export function normalizeQuests(q: Partial<QuestSave> | undefined): QuestSave {
  const b = blankQuests(typeof q?.day === "string" ? q.day : "");
  const nums = Array.isArray(q?.have) ? q!.have : [];
  const flags = Array.isArray(q?.claimed) ? q!.claimed : [];
  return { day: b.day, have: b.have.map((_, i) => Math.max(0, Math.floor(Number(nums[i]) || 0))), claimed: b.claimed.map((_, i) => flags[i] === true) };
}

export interface QuestPay { coins: number; xp: number; quests: number }

/**
 * Moves the save to `day`. Quests finished but not claimed on the old day are returned as owed pay (the caller
 * credits it), then today's start at zero.
 */
export function rollIn(q: QuestSave, day: string): QuestPay {
  const owed: QuestPay = { coins: 0, xp: 0, quests: 0 };
  if (q.day === day) return owed;
  if (q.day) {
    questsFor(q.day).forEach((d, i) => {
      if (!q.claimed[i] && q.have[i] >= d.n) { owed.coins += d.coins; owed.xp += d.xp; owed.quests++; }
    });
  }
  Object.assign(q, blankQuests(day));
  return owed;
}

/** What an event adds to each of a day's quests. */
export function stepFor(d: QuestDef, e: PassEvent): number {
  switch (d.kind) {
    case "win": return e.kind === "win" ? 1 : 0;
    case "stars": return e.kind === "win" ? Math.max(0, Math.floor(e.stars)) : 0;
    case "upgrade": return e.kind === "upgrade" ? 1 : 0;
    case "chest": return e.kind === "chest" ? 1 : 0;
    case "bastion": return e.kind === "play" && e.mode === "bastion" ? 1 : 0;
    case "daily": return e.kind === "play" && e.mode === "daily" ? 1 : 0;
  }
}

/** Counts an event towards today's quests (capped at each target). Returns the indexes that just finished. */
export function progressIn(q: QuestSave, day: string, e: PassEvent): number[] {
  rollIn(q, day);
  const done: number[] = [];
  questsFor(day).forEach((d, i) => {
    const add = stepFor(d, e);
    if (add <= 0 || q.have[i] >= d.n) return;
    q.have[i] = Math.min(d.n, q.have[i] + add);
    if (q.have[i] >= d.n) done.push(i);
  });
  return done;
}

export const questDone = (q: QuestSave, day: string, i: number) => q.day === day && q.have[i] >= questsFor(day)[i].n;
export const questClaimable = (q: QuestSave, day: string, i: number) => questDone(q, day, i) && !q.claimed[i];

/** Tap to claim a finished quest: marks it and returns its pay (the caller credits coins and pass XP). */
export function claimQuestIn(q: QuestSave, day: string, i: number): QuestPay | null {
  if (!questClaimable(q, day, i)) return null;
  q.claimed[i] = true;
  const d = questsFor(day)[i];
  return { coins: d.coins, xp: d.xp, quests: 1 };
}

// ---------------------------------------------------------------- device-save binding
type WithQuests = Save & { quests?: QuestSave };
type Listener = () => void;
const listeners = new Set<Listener>();
let payXp: (xp: number) => void = () => undefined;
/** The War Pass registers where quest XP goes (engine/progression/pass.ts startPass). */
export const setQuestXpSink = (f: (xp: number) => void) => { payXp = f; };

function commit<T>(apply: (q: QuestSave) => T): T {
  let out!: T, owed: QuestPay = { coins: 0, xp: 0, quests: 0 };
  save((s) => {
    const w = s as WithQuests;
    w.quests = normalizeQuests(w.quests);
    owed = rollIn(w.quests, localDay());
    out = apply(w.quests);
  });
  if (owed.coins > 0) earn("coins", owed.coins, "quests: yesterday's, unclaimed");
  if (owed.xp > 0) payXp(owed.xp);
  for (const f of listeners) f();
  return out;
}
export const todaysQuests = (): QuestDef[] => questsFor(localDay());
export function questState(): QuestSave {
  const q = normalizeQuests((load() as WithQuests).quests);
  return q.day === localDay() ? q : blankQuests(localDay());
}
/** Pays yesterday's finished-but-unclaimed quests, if any (call on boot; it also happens on any quest write). */
export const settleQuests = () => commit(() => undefined);
export function claimQuest(i: number): QuestPay | null {
  const pay = commit((q) => claimQuestIn(q, localDay(), i));
  if (!pay) return null;
  earn("coins", pay.coins, `quest ${i}`);
  payXp(pay.xp);
  return pay;
}
export function onQuestsChange(f: Listener): () => void {
  listeners.add(f);
  return () => listeners.delete(f);
}
let started = false;
/** Listens for [pass] events once. */
export function startQuests() {
  if (started) return;
  started = true;
  onPassEvent((e) => { commit((q) => progressIn(q, localDay(), e)); });
}
/** Debug and review shots: today's first quest finished, the second half way. */
export function seedQuestDemo() {
  commit((q) => {
    const ds = questsFor(localDay());
    q.have = [ds[0].n, Math.floor(ds[1].n / 2), 0];
    q.claimed = [false, false, false];
  });
}
