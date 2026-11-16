// Gems: Muster's premium currency. What packs exist, what free play earns, and what gems buy.
// Pure rules over save-shaped objects (tests need no storage); engine/economy/rewards.ts binds them to the device save.
// The model and the reasoning behind every number is in outputs/economy/gems.md.

/** What players see. */
export const GEM_NAME = "Gems";

// ---------------------------------------------------------------- packs (App Store consumables)

export interface GemPack {
  /** App Store product id (Consumable). Never changes once created in App Store Connect. */
  id: string;
  /** Short name on the card. */
  name: string;
  gems: number;
  /** The US base price set in App Store Connect. Docs and tests only: the Shop always shows StoreKit's displayPrice. */
  usd: number;
}

export const GEM_PACK_PREFIX = "co.inflect.muster.gems.";

/** The ladder: about 81 gems per US dollar at the bottom, rising ~12 points a step to 120 at the top. */
export const GEM_PACKS: GemPack[] = [
  { id: `${GEM_PACK_PREFIX}pouch`, name: "Pouch", gems: 80, usd: 0.99 },
  { id: `${GEM_PACK_PREFIX}sack`, name: "Sack", gems: 450, usd: 4.99 },
  { id: `${GEM_PACK_PREFIX}coffer`, name: "Coffer", gems: 1000, usd: 9.99 },
  { id: `${GEM_PACK_PREFIX}trove`, name: "Trove", gems: 2200, usd: 19.99 },
  { id: `${GEM_PACK_PREFIX}hoard`, name: "Hoard", gems: 6000, usd: 49.99 },
];
export const GEM_PACK_IDS = GEM_PACKS.map((p) => p.id);

export const packFor = (productId: string) => GEM_PACKS.find((p) => p.id === productId);
/** Gems a product id pays out (0 for anything that isn't a gem pack). The app decides this, never the store. */
export const gemsFor = (productId: string) => packFor(productId)?.gems ?? 0;

/**
 * Bonus of each pack over the smallest one, in whole percent, from live store prices when they're known
 * (another storefront's price ladder can bend), else from the US base prices.
 */
export function packBonus(prices: Record<string, number | undefined> = {}): Record<string, number> {
  const rate = (p: GemPack) => p.gems / (prices[p.id] && prices[p.id]! > 0 ? prices[p.id]! : p.usd);
  const base = rate(GEM_PACKS[0]);
  return Object.fromEntries(GEM_PACKS.map((p) => [p.id, Math.max(0, Math.round((rate(p) / base - 1) * 100))]));
}
/** The pack with the most gems per unit of money (the "Best value" tag). */
export function bestValue(prices: Record<string, number | undefined> = {}): string {
  const b = packBonus(prices);
  return GEM_PACKS.reduce((best, p) => (b[p.id] > b[best.id] ? p : best), GEM_PACKS[0]).id;
}

// ---------------------------------------------------------------- sinks

export interface CoinBundle { id: string; gems: number; coins: number }

/** 1 gem is about 10 coins; bigger bundles add a bulk bonus. Coins buy troop upgrades (capped by campaign progress). */
export const COIN_BUNDLES: CoinBundle[] = [
  { id: "coins.s", gems: 30, coins: 300 },
  { id: "coins.m", gems: 120, coins: 1300 },
  { id: "coins.l", gems: 400, coins: 4600 },
];
export const coinBonus = (b: CoinBundle) => Math.round((b.coins / (b.gems * 10) - 1) * 100);

/** A Gauntlet "Rally": after a lost duel, refight the same rival with health topped up. Once per run. */
export const RALLY_GEMS = 40;
/** Health a Rally restores the run to, as a share of max health. */
export const RALLY_HP = 0.5;
export const RALLIES_PER_RUN = 1;

// ---------------------------------------------------------------- free earning

/** Save fields the earn rules read. */
export interface EarnSave {
  campaign: Record<number, number>;
  puzzles: Record<number, number>;
  gauntlet: { best: number; runs: number };
  daily: { streak: number; bestStreak: number; wins: number; today?: { key: string; done: boolean; won: boolean } };
}

/** Which one-time rewards were paid, so nothing pays twice (kept in the save). */
export interface RewardSave { claimed: string[] }
export const blankRewards = (): RewardSave => ({ claimed: [] });

export interface Reward { id: string; gems: number; label: string }

export const EARN = {
  /** First time a campaign level reaches three stars. */
  campaignThreeStar: 4,
  /** First win over an act boss. */
  boss: 20,
  /** First three-star solve of a Breakpoint puzzle. */
  puzzleThreeStar: 2,
  /** Each scored Daily Challenge won. */
  dailyWin: 4,
} as const;

/** One-time rewards for reaching a Daily streak (counted on the best streak, so a reset never pays twice). */
export const STREAK_MILESTONES: [days: number, gems: number][] = [[3, 10], [7, 25], [14, 40], [30, 80]];

export interface Achievement { id: string; name: string; text: string; gems: number; done: (s: EarnSave, ctx: EarnCtx) => boolean }
export interface EarnCtx { levels: { id: number; act: number; boss?: boolean }[]; acts: number }

const cleared = (s: EarnSave) => Object.values(s.campaign).filter((n) => n > 0).length;
/** A short list, all reachable in the free game except the last two. */
export const ACHIEVEMENTS: Achievement[] = [
  { id: "first-win", name: "First Blood", text: "Win a campaign battle", gems: 5, done: (s) => cleared(s) >= 1 },
  { id: "perfect-act", name: "Flawless Act", text: "Three stars on every level of an act", gems: 25,
    done: (s, c) => Array.from({ length: c.acts }, (_, i) => i + 1).some((a) => { const ls = c.levels.filter((l) => l.act === a); return ls.length > 0 && ls.every((l) => (s.campaign[l.id] ?? 0) >= 3); }) },
  { id: "puzzler", name: "Breakpoint", text: "Solve 5 Breakpoint puzzles", gems: 15, done: (s) => Object.values(s.puzzles).filter((n) => n > 0).length >= 5 },
  { id: "daily-10", name: "Regular", text: "Win 10 Daily Challenges", gems: 25, done: (s) => s.daily.wins >= 10 },
  { id: "gauntlet-5", name: "Gauntlet Runner", text: "Beat 5 rivals in one Gauntlet run", gems: 25, done: (s) => s.gauntlet.best >= 5 },
  { id: "campaign-all", name: "Warlord", text: "Clear every campaign level", gems: 60, done: (s, c) => c.levels.every((l) => (s.campaign[l.id] ?? 0) > 0) },
];

/**
 * Every reward the save has earned that isn't in `claimed` yet. Derived from progress, so it is idempotent and also
 * pays players for progress made before gems existed.
 */
export function rewardsOwed(s: EarnSave, r: RewardSave, ctx: EarnCtx): Reward[] {
  const have = new Set(r.claimed);
  const out: Reward[] = [];
  const add = (id: string, gems: number, label: string) => { if (!have.has(id) && gems > 0) out.push({ id, gems, label }); };
  for (const l of ctx.levels) {
    const n = s.campaign[l.id] ?? 0;
    if (l.boss && n > 0) add(`boss:${l.id}`, EARN.boss, "Boss defeated");
    if (n >= 3) add(`3star:${l.id}`, EARN.campaignThreeStar, "Three stars");
  }
  for (const [id, n] of Object.entries(s.puzzles)) if (n >= 3) add(`puzzle3:${id}`, EARN.puzzleThreeStar, "Puzzle solved in full");
  const t = s.daily.today;
  if (t?.done && t.won) add(`daily:${t.key}`, EARN.dailyWin, "Daily won");
  for (const [days, gems] of STREAK_MILESTONES) if (s.daily.bestStreak >= days) add(`streak:${days}`, gems, `${days}-day streak`);
  for (const a of ACHIEVEMENTS) if (a.done(s, ctx)) add(`ach:${a.id}`, a.gems, a.name);
  return out;
}

/** Marks rewards paid. Returns the gems to credit (the caller earns them in the same save write). */
export function claimIn(r: RewardSave, owed: Reward[]): number {
  let total = 0;
  for (const w of owed) if (!r.claimed.includes(w.id)) { r.claimed.push(w.id); total += w.gems; }
  return total;
}

export function normalizeRewards(r: Partial<RewardSave> | undefined): RewardSave {
  return { claimed: Array.isArray(r?.claimed) ? r!.claimed.filter((x) => typeof x === "string") : [] };
}

// ---------------------------------------------------------------- Gauntlet rally (pure)

export interface RallyRun { hp: number; maxHp: number; over: boolean; rallies?: number }
export const canRally = (run: RallyRun) => run.over && (run.rallies ?? 0) < RALLIES_PER_RUN;
/** Puts a lost run back on its feet against the same rival. Call only after the gems are spent. */
export function applyRally(run: RallyRun): boolean {
  if (!canRally(run)) return false;
  run.rallies = (run.rallies ?? 0) + 1;
  run.over = false;
  run.hp = Math.max(run.hp, Math.round(run.maxHp * RALLY_HP));
  return true;
}
