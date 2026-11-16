# Remuster: in-app purchases (Starter Pack and gem packs)

Generated from `store/metadata.json` (`inAppPurchase`, `gemPacks`) by `npm run release:config`. Edit that, not this file.
Free to play, every level open: every campaign act, the Gauntlet, every Breakpoint puzzle, the Daily Challenge and Skirmish are free. Nothing is locked behind a purchase; purchases only speed you up.
**Starter Pack** is a one-time offer: a consumable the app sells once per player (the Shop hides it after it's bought). It pays a fixed pack of gems, coins and unit cards (`engine/store/starter.ts`), credited once per App Store transaction and only then finished, so an interrupted purchase is credited on the next launch.
The app reads the price from the App Store (StoreKit 2), so changing the price here never needs a new build.
**No Restore Purchases.** Every product is a consumable, so there is nothing to restore and the app has no Restore button.
**Removed:** the old Full Army non-consumable (`co.inflect.muster.fullarmy`) is gone from the app. It was never created in App Store Connect; don't create it.

## 0. Once per account: Paid Apps Agreement (5 min, can take a day to go active)

App Store Connect > **Business** (Agreements, Tax, and Banking) > **Paid Apps** > accept the agreement, add a bank account and fill in the tax forms.
Until it says **Active**, the purchase cannot be sold and App Review cannot buy it in the sandbox.

## 1. Create the purchase (3 min)

Apps > Remuster > Monetization > **In-App Purchases** > **+**

| Field | Enter | Limit |
| --- | --- | --- |
| Type | **Consumable** | |
| Reference Name | `Starter Pack` | 12/64, only you see it |
| Product ID | `co.inflect.muster.starter` | must match the app exactly; can never be changed or reused |

Click **Create**, then on the purchase's page:

| Section | Field | Enter |
| --- | --- | --- |
| Availability | Countries or Regions | All countries and regions (same as the app) |
| Price Schedule | Base price | USD 4.99 (United States base price; let Apple set the other storefronts from it) |
| App Store Localization (English (U.S.)) | Display Name | `Starter Pack` (12/30) |
| App Store Localization (English (U.S.)) | Description | `1,200 gems, 6,000 coins and 142 cards` (37/45) |
| Family Sharing | | Off (consumables can't be shared) |
| Tax Category | | Match to parent app (the default) |
| Review Information | Screenshot | `store/screenshots/iap-review.png` (the Shop screen with the Starter Pack price, 1320x2868). Re-shoot with `node tools/store-shots.mjs --only=iap-review` while `npm run dev` runs. |
| Review Information | Review Notes | the block below |
| Promotional Image | | None (optional; only needed for App Store promotion or win-back offers) |

Review Notes:

```
Starter Pack is a one-time offer: a consumable that pays 1,200 gems, 6,000 coins and 142 unit cards (fixed contents, nothing random). The app sells it once per player and hides it after it is bought. It unlocks no content: every campaign act, the Gauntlet, the Daily Challenge, Skirmish and every Breakpoint puzzle are free to play, and purchases only speed progress up. It is credited once per transaction and only then finished. To find it: title screen > Shop, at the top.
```
475/4000.

The purchase's status should now read **Ready to Submit**. If it says Missing Metadata, one of the fields above is empty.

## 2. Submit it with version 1.0.0

Apple requires the first in-app purchase to go to review together with a new app version.
On the iOS App > 1.0.0 page, scroll to **In-App Purchases and Subscriptions** > **+** > tick **Starter Pack** > Done.
Then submit the version as usual (`store/RELEASE-CHECKLIST.md` step 7). The purchase and the build are reviewed together.

## 3. Test it before submitting (optional, 5 min)

- **Simulator, no Apple account needed:** `npm run ios:open`, pick an iPhone simulator, press Run. The shared App scheme already uses `ios/App/Muster.storekit` (Edit Scheme > Run > Options > StoreKit Configuration), so the Shop shows US$4.99 and buy, cancel, Ask to Buy and failure all work locally. Debug > StoreKit > Manage Transactions shows the Starter Pack finished once its contents are saved. The plugin's own StoreKit tests run from `ios/MusterStore/TestHost` (command at the top of its project.yml).
- **Sandbox on your iPhone:** App Store Connect > Users and Access > **Sandbox** > Test Accounts > **+**. On the iPhone, Settings > Developer > Sandbox Apple Account, sign in with it, then buy the Starter Pack from a TestFlight or Xcode build. Sandbox purchases are free. After it's bought the Shop shows "Owned" for a moment and the offer goes away.

## 4. Gem packs (five consumables, 15 min)

Gems are the optional premium currency: free players earn them by playing, and these packs sell them.
The app decides how many gems each product id gives (`engine/economy/gems.ts`) and shows StoreKit's own price, so prices can change here without a new build.
Each pack is credited once per App Store transaction and only then finished, so an interrupted purchase is credited on the next launch.
No Restore Purchases: gems are consumables and are used up when spent.

For each row: Apps > Remuster > Monetization > **In-App Purchases** > **+** > Type **Consumable**, then the Reference Name and Product ID, **Create**, then fill the page.

| Product ID | Reference Name | Price (US base) | Display Name | Description |
| --- | --- | --- | --- | --- |
| `co.inflect.muster.gems.pouch` | `Gems Pouch (80)` (15/64) | USD 0.99 | `80 Gems` (7/30) | `A pouch of 80 gems for the Shop` (31/45) |
| `co.inflect.muster.gems.sack` | `Gems Sack (450)` (15/64) | USD 4.99 | `450 Gems` (8/30) | `A sack of 450 gems for the Shop` (31/45) |
| `co.inflect.muster.gems.coffer` | `Gems Coffer (1000)` (18/64) | USD 9.99 | `1,000 Gems` (10/30) | `A coffer of 1,000 gems for the Shop` (35/45) |
| `co.inflect.muster.gems.trove` | `Gems Trove (2200)` (17/64) | USD 19.99 | `2,200 Gems` (10/30) | `A trove of 2,200 gems for the Shop` (34/45) |
| `co.inflect.muster.gems.hoard` | `Gems Hoard (6000)` (17/64) | USD 49.99 | `6,000 Gems` (10/30) | `A hoard of 6,000 gems for the Shop` (34/45) |

The same on every pack:

| Section | Field | Enter |
| --- | --- | --- |
| Availability | Countries or Regions | All countries and regions (same as the app) |
| Price Schedule | Base price | the row's price; let Apple set the other storefronts from it |
| App Store Localization (English (U.S.)) | Display Name, Description | the row's values |
| Family Sharing | | Not offered for consumables (the switch isn't shown). |
| Tax Category | | Match to parent app (the default) |
| Review Information | Screenshot | `store/screenshots/iap-gems-review.png` (the Shop's Gems section with prices, 1320x2868). Re-shoot with `PORT=<port> node tools/gems-shots.mjs` while the dev server runs. The same image works for all five. |
| Review Information | Review Notes | the block below |
| Promotional Image | | None |

Review Notes (same for every pack):

```
Gems are a consumable premium currency. Each pack gives the fixed number of gems in its name, credited the moment the purchase completes. Gems buy coin bundles (coins buy troop upgrades) and a once-per-run Gauntlet Rally; nothing gives random rewards. Gems are also earned free from three-star clears, bosses, Daily Challenge wins and streaks. No content is locked behind them: every level is free. To find them: title screen > Shop, the Gems section below the Starter Pack.
```
474/4000.

Then on the 1.0.0 version page, **In-App Purchases and Subscriptions** > **+**: tick all five gem packs as well as the Starter Pack.

Test: the simulator's `ios/App/Muster.storekit` already lists the five packs (US$0.99 to US$49.99), so buy, cancel, Ask to Buy and failure all work without an account. Debug > StoreKit > Manage Transactions shows each pack finished once its gems are saved.

## 5. War Pass Premium (one consumable, 5 min)

A consumable the app sells **once per 30-day season** (the app refuses a second purchase in the same season; if one ever arrives anyway, say an old Ask to Buy approved late, it pays 450 gems instead). It adds the season's premium reward track and is retroactive: tiers already reached become claimable at once. Credited once per App Store transaction and only then finished.

Apps > Remuster > Monetization > **In-App Purchases** > **+** > Type **Consumable**.

| Field | Enter | Limit |
| --- | --- | --- |
| Reference Name | `War Pass Premium` | 16/64 |
| Product ID | `co.inflect.muster.pass` | must match the app exactly |
| Base price | USD 4.99 | |
| Display Name | `War Pass Premium` | 16/30 |
| Description | `This season's premium reward track` | 34/45 |

| Section | Field | Enter |
| --- | --- | --- |
| Availability | Countries or Regions | All countries and regions (same as the app) |
| Price Schedule | Base price | the price above; let Apple set the other storefronts from it |
| Family Sharing | | Not offered for consumables (the switch isn't shown). |
| Tax Category | | Match to parent app (the default) |
| Review Information | Screenshot | `outputs/review/pass/01-pass-free.png` (phone review shot; any iPhone screenshot of the screen with the price showing also works). Re-shoot with `node tools/pass-shots.mjs` while `npx vite --port 5594` runs. |
| Review Information | Review Notes | the block below |
| Promotional Image | | None |

Review Notes:

```
War Pass Premium is a consumable the app sells once per 30-day season (the app refuses a second purchase in the same season). It adds a second reward track to the season's War Pass: gems, coins, chests, unit cards and a cosmetic keep skin, plus chests unlocking 20% faster. It is retroactive: rewards for tiers already reached become claimable at once. Every player progresses the pass for free through daily quests and wins, and the free track pays every player. Chest rewards show their odds (tap a chest). Nothing in battle changes and no content is locked: every level is free. It is credited once per transaction and only then finished. To find it: title screen > War Pass (or Pass tab), the Premium card below the daily quests.
```
733/4000.

## 6. Special offers (four consumable price tiers, 15 min)

Limited-time bundles in the Shop (gems + coins + cards for a named unit + one chest), 2 or 3 at a time, rotating every 2 days, each buyable once while it's up. They sell through these four generic price tiers: the game decides and shows each bundle's contents (`engine/store/offers.ts`), so the App Store description stays generic and bundles can change without touching App Store Connect. The chest inside is random with its odds one tap away (Odds button on the offer). Credited once per transaction and only then finished.

For each row: **+** > Type **Consumable**, the Reference Name and Product ID, **Create**, then fill the page.

| Product ID | Reference Name | Price (US base) | Display Name | Description |
| --- | --- | --- | --- | --- |
| `co.inflect.muster.offer.t1` | `Special Offer Tier 1 (1.99)` (27/64) | USD 1.99 | `Special Offer` (13/30) | `Limited-time bundle; contents shown in game` (43/45) |
| `co.inflect.muster.offer.t2` | `Special Offer Tier 2 (4.99)` (27/64) | USD 4.99 | `Special Offer` (13/30) | `Limited-time bundle; contents shown in game` (43/45) |
| `co.inflect.muster.offer.t3` | `Special Offer Tier 3 (9.99)` (27/64) | USD 9.99 | `Special Offer` (13/30) | `Limited-time bundle; contents shown in game` (43/45) |
| `co.inflect.muster.offer.t4` | `Special Offer Tier 4 (19.99)` (28/64) | USD 19.99 | `Special Offer` (13/30) | `Limited-time bundle; contents shown in game` (43/45) |

The same on every tier:

| Section | Field | Enter |
| --- | --- | --- |
| Availability | Countries or Regions | All countries and regions (same as the app) |
| Price Schedule | Base price | the price above; let Apple set the other storefronts from it |
| Family Sharing | | Not offered for consumables (the switch isn't shown). |
| Tax Category | | Match to parent app (the default) |
| Review Information | Screenshot | `outputs/review/pass/11-shop-offers.png` (phone review shot; any iPhone screenshot of the screen with the price showing also works). Re-shoot with `node tools/pass-shots.mjs` while `npx vite --port 5594` runs. |
| Review Information | Review Notes | the block below |
| Promotional Image | | None |

Review Notes (same for every tier):

```
Special offers are limited-time bundles shown in the Shop: 2 or 3 at a time, rotating every 2 days, each buyable once while it is up. Each bundle's exact contents are shown before purchase: a fixed number of gems and coins, a fixed number of cards for a named unit, and one chest. The chest's contents are random; its odds are shown by the Odds button on the offer card. These four products are price tiers the bundles sell through, so their App Store description is generic. Every bundle is credited once per transaction and only then finished. No content is locked: every level is free. To find them: title screen > Shop, Special offers below the Starter Pack.
```
662/4000.

Then on the 1.0.0 version page, **In-App Purchases and Subscriptions** > **+**: tick War Pass Premium and the four offer tiers too.

Test: `ios/App/Muster.storekit` lists War Pass Premium (US$4.99) and the four tiers (US$1.99 to US$19.99), so buy, cancel, Ask to Buy and failure work in the simulator without an account. On the web, `?pass` and `?shop` with `&store=pending|cancelled|failed|offline` show each state.
