// [pass] War Pass Premium and special offers on the shared store. Premium is a consumable (co.inflect.muster.pass)
// the app sells once per season; offers are four generic consumable price tiers. Both credit once per transaction
// and save before finishing (engine/store/consumable.ts). passShops() is the one place the screens get them from:
// main.ts hands over its store with usePassStore(store) at boot; a screen mounted without that builds its own.
import { foundKinds, grantCards } from "../progression/collection";
import { findable, makeChest } from "../progression/chests";
import { creditPremium, queueChest, type PassCredit } from "../progression/pass";
import { earn } from "../economy/wallet";
import { load, save, type Save } from "../save";
import { ConsumableShop } from "./consumable";
import { createStore } from "./index";
import { OFFER_IDS, activeOffers, creditOfferIn, intendIn, normalizeOffers, offerBought, offerPayout, type Offer, type OfferSave } from "./offers";
import type { Purchase, Store } from "./types";

import { PASS } from "./types";
import { premiumActive } from "../progression/pass";
export { PASS } from "./types";
/** US base price set in App Store Connect (docs and tests; the screen shows StoreKit's displayPrice). */
export const PASS_USD = 4.99;

// ---------------------------------------------------------------- offers on the device save
type WithOffers = Save & { offers?: OfferSave };
export const offerSave = (): OfferSave => normalizeOffers((load() as WithOffers).offers);
const commitOffers = <T>(f: (o: OfferSave) => T): T => {
  let out!: T;
  save((s) => { const w = s as WithOffers; w.offers = normalizeOffers(w.offers); out = f(w.offers); });
  return out;
};
export const currentOffers = (): Offer[] => activeOffers(Date.now());
export const isOfferBought = (id: string) => offerBought(offerSave(), id);
export const offerPool = () => findable(load().campaign, foundKinds());

export interface OfferPaid { offer: Offer; cards: { kind: string; n: number } | null }
/** Credits one offer transaction: marks it (saved), then pays gems, coins, cards and queues the chest. */
export function creditOffer(p: Purchase): { paid: boolean; what: OfferPaid | null } {
  const o = commitOffers((s) => creditOfferIn(s, p.txId, p.productId, Date.now()));
  if (!o) return { paid: false, what: null };
  const pay = offerPayout(o, offerPool());
  earn("gems", pay.gems, `offer ${o.id}`);
  earn("coins", pay.coins, `offer ${o.id}`);
  if (pay.cards) grantCards(pay.cards.kind, pay.cards.n, `offer ${o.id}`);
  queueChest(makeChest(pay.chest));
  return { paid: true, what: { offer: o, cards: pay.cards } };
}

// ---------------------------------------------------------------- the shops
export interface PassShops {
  store: Store;
  pass: ConsumableShop<PassCredit>;
  offers: ConsumableShop<OfferPaid | null>;
  /** Buys Premium for this season (refused when it's already active: one a season, enforced by the app). */
  buyPass(): ReturnType<ConsumableShop<PassCredit>["buy"]>;
  /** Buys this offer: records which offer the tier's purchase is for, then buys the tier. */
  buyOffer(o: Offer): ReturnType<ConsumableShop<OfferPaid | null>["buy"]>;
}

let shops: PassShops | null = null;
function build(store: Store): PassShops {
  const passShop = new ConsumableShop<PassCredit>(store, [PASS], (p) => { const r = creditPremium(p.txId); return { paid: r !== "dup", what: r }; });
  const offers = new ConsumableShop<OfferPaid | null>(store, OFFER_IDS, creditOffer);
  void passShop.start();
  void offers.start();
  return {
    store, pass: passShop, offers,
    buyPass: async () => (premiumActive() ? { status: "failed", message: "War Pass Premium is already active this season." } : passShop.buy(PASS)),
    buyOffer: async (o) => {
      if (isOfferBought(o.id)) return { status: "failed", message: "You already have this offer." };
      if (Date.now() >= o.endsAt) return { status: "failed", message: "This offer has ended." };
      commitOffers((s) => intendIn(s, o));
      return offers.buy(o.productId);
    },
  };
}
/** main.ts calls this at boot with the app's one store, so every purchase goes through it. */
export function usePassStore(store: Store): PassShops {
  if (!shops || shops.store !== store) { shops?.pass.dispose(); shops?.offers.dispose(); shops = build(store); }
  return shops;
}
export const passShops = (): PassShops => shops ?? usePassStore(createStore(typeof location === "undefined" ? "" : location.search));
