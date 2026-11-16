# Remuster: App Store listing

Generated from `store/metadata.json` by `npm run release:config` (name, version and URLs come from `app.config.json`). Edit those, not this file. Copy each block into App Store Connect as is.

## Name

```
Remuster
```
8/30. Home-screen name under the icon: **Remuster** (`displayName` in app.config.json).

Availability, checked 2026-11-06 by searching `https://itunes.apple.com/search?term=<name>&entity=software` (US, AU, GB):

| Name | Status | Note |
| --- | --- | --- |
| Muster: Tactics | free (no exact match) | Chosen by Jack. Existing 'Muster' apps are social, lifestyle, education and utility apps, none are games. |
| Muster: Army Battler | free (no exact match) | Says the genre in the name; strong for search. |
| Muster & Clash | free (no exact match) | Echoes the in-game tagline build, place, clash. |
| Muster: Auto Battler | free (no exact match) | Genre term people search for. |
| Musterfield | free (no exact match) | One original word, easy to own. |
| Muster Up: Tactics | free (no exact match) | Fallback if Muster: Tactics is reserved by someone. |
| Muster | TAKEN | Exact matches: Muster (Stalefish Labs, Social Networking) and muster (HATCH COLLECTIBLES, Lifestyle). |

A name someone has reserved in App Store Connect but not shipped won't show up in search; App Store Connect tells you when you create the app record. If it says the name is taken, use the next free option above, put it in `app.config.json` as `storeName` and run `npm run release:config`.

## Subtitle

```
Auto battler army strategy
```
26/30. Alternatives: "Build. Place. Clash.", "Place your army. Watch it win", "Turn-based army battler".

## Promotional text

```
New: a Daily Challenge for everyone, three new acts and seven new units. Free to play with every level open. No ads, no tracking, offline.
```
138/170. Can be changed any time without a new build.

## Description

```
Muster an army. Place it. Watch it fight.

Remuster is a turn-based army battler for one player. Each round you buy units from a shop of four and place them anywhere on your half of the field. Then you press Fight and the battle plays out on its own. Your units stay on the board and come back every round, so your army grows as the match goes on. Lose a round and your commander takes damage. First commander to zero loses.

31 UNITS, EACH WITH A MIND OF ITS OWN
No grid and no lanes: every unit steers freely and fights its own way. Blade Trios surround a target and slash as a pack. Rangers hold their distance and back off when rushed. Lancers charge straight through a line, wheel round and charge again. Shades cloak, blink behind the weakest enemy and strike. Mines lie buried until someone steps too close. Harriers fly over the melee, Sappers tunnel to the backline, Stormcallers chain lightning through tight formations. Where you place them decides the fight.

EVOLVE THEM. ASCEND THEM.
Rank a unit up from Recruit to Veteran to Elite and it looks tougher and hits harder at every step. From round 5 you can Ascend it: a transformed unit with a signature ability. Whirlwind slashes, Volley arrows, a Revive, Firebombs, Trample charges, Deep Freeze, Shrapnel shells and more. One Ascended ability for every unit, 31 in all.

RIVALS THAT THINK
Rivals plan their own draft and formation, and the toughest ones test their plans against your board before they commit. Buried mines stay hidden from them, so a good trap still springs. In the AI Lab you can tune a rival yourself: difficulty, aggression, tactic (swarm, fortress, artillery, ambush, blitz or siege), economy, rerolls and formation width. Or set two AIs against each other and watch.

FIVE WAYS TO PLAY
• Campaign: 60 levels across ten acts, each act ending in a boss fight. Unlock new units as you go and earn up to three stars on every level.
• Daily Challenge: one board a day, the same for every player. Win it, keep your streak going and beat your best.
• Gauntlet: one health pool against rival after rival. Your army carries over and every win brings a boon.
• Breakpoint: 18 one-battle puzzles against a fixed board with fixed gold. Find the win, then find a cheaper one for the stars.
• Skirmish: any rival, any settings, any starting health.

FREE TO PLAY, EVERY LEVEL OPEN
Every act of the campaign, the Gauntlet, every Breakpoint puzzle, the Daily Challenge and Skirmish are free, for as long as you like. Nothing is locked behind a purchase.
Optional purchases only speed you up. A one-time Starter Pack gives gems, coins and unit cards to get your army going. Gems are earned free from three-star clears, bosses, Daily wins and streaks, and spent on coins for troop upgrades or a Gauntlet Rally; gem packs in the Shop speed that up. Each season's War Pass fills as you play, with free rewards for everyone and an optional Premium track; limited-time special offers rotate in the Shop. Every purchase says exactly what you get, and every chest shows its odds before you open or buy it: no subscriptions, no energy.

PLAYS YOUR WAY
• Short rounds that fit a spare minute, with 2× and 3× battle speed
• Fully offline: no account, no sign-in, no internet needed to play
• No ads, no tracking, no energy
• Your progress stays on your device
```
3318/4000.

## What's New in This Version

```
Daily Challenge: a new board every day, the same for every player, with a streak to keep. Free for everyone.
Three new acts: Act 8, the Saltwind Coast in Act 9 and the Crownfall Citadel finale in Act 10, with eighteen new levels, three new bosses and an ending.
Seven new units, each with its own Ascended ability, among them three legendaries: the Griffin Knight, the Tidecaller and the Lionheart.
Free to play: every act, the Gauntlet and every Breakpoint puzzle are open to everyone. Optional purchases (a one-time Starter Pack and gem packs) only speed you up.
Gems: earn them free from three-star clears, bosses, Daily wins and streaks, or buy a pack in the Shop. Spend them on coins for troop upgrades or a Gauntlet Rally.
Sunlit new art across units, arenas and menus.
War Pass: a 30-day season of rewards filled by three daily quests and your wins, free for everyone, with an optional Premium track. Special offers rotate in the Shop.
```
942/4000. App Store Connect only asks for What's New on an update. If 1.0 was never released, this is the first version and the field does not appear: skip it.

## Keywords

```
turn based,wargame,battle,tactical,fantasy,medieval,knights,soldiers,puzzle,offline,commander,war
```
97/100. Comma separated, no spaces after commas, no competitor names, no words already in the name or subtitle (Apple indexes those anyway).

## App information

| Field | Value |
| --- | --- |
| Bundle ID | `co.inflect.remuster` |
| SKU | `co.inflect.remuster` |
| Version | 1.0.0 (build 1) |
| Primary language | English (U.S.) |
| Category | Games, subcategories Strategy and Casual; no secondary category |
| Price | Free (USD 0.00), all countries and regions. Free to play, every level open. Optional consumable in-app purchases (a one-time Starter Pack, gem packs, War Pass Premium once per season and special-offer tiers), see store/IAP.md |
| Copyright | 2026 Jack Wakem |
| Content rights | No, it does not contain, show, or access third-party content |
| Support URL | https://remuster.example/support.html |
| Privacy Policy URL | https://remuster.example/privacy.html |
| Marketing URL | https://remuster.example |
| Export compliance | Handled in the binary: ITSAppUsesNonExemptEncryption = NO in Info.plist, so App Store Connect does not ask. |
| Release | Automatically release this version after App Review approval |

## Age rating (expected 9+)

App Store Connect > App Information > Age Rating > Edit. Answer every question with None / No except the one below. If Apple shows a question not listed here, the answer for this game is None / No.

| Question | Answer |
| --- | --- |
| Parental controls / age assurance in the app | No |
| Unrestricted web access | No |
| User-generated content | No |
| Messaging and chat | No |
| Advertising | No |
| Profanity or crude humor | None |
| Horror or fear themes | None |
| Alcohol, tobacco, or drug use or references | None |
| Medical or treatment information | None |
| Health or wellness topics | No |
| Mature or suggestive themes | None |
| Sexual content or nudity | None |
| Graphic sexual content and nudity | None |
| Cartoon or fantasy violence | **Infrequent/Mild** |
| Realistic violence | None |
| Prolonged graphic or sadistic realistic violence | None |
| Simulated gambling | None |
| Gambling (real money) | No |
| Contests | None |
| Loot boxes | No |

Battles are top-down fantasy units (swords, bows, bombs, lightning) knocking each other out: no blood, no gore, no realistic people. Infrequent/Mild cartoon or fantasy violence maps to 9+.

## In-app purchase

Free to play, every level open: nothing is locked behind a purchase, purchases only speed you up. All in-app purchases are consumables.

**Starter Pack** (`co.inflect.muster.starter`, consumable, sold once per player), USD 4.99 (United States base price; let Apple set the other storefronts from it). Every field to enter in App Store Connect is in `store/IAP.md`.

Plus 5 consumable gem packs (`co.inflect.muster.gems.*`): 80 Gems US$0.99, 450 Gems US$4.99, 1,000 Gems US$9.99, 2,200 Gems US$19.99, 6,000 Gems US$49.99. Also in `store/IAP.md` (section 4). No Restore Purchases: there are no non-consumables.

Plus **War Pass Premium** (`co.inflect.muster.pass`, consumable, sold once per 30-day season), USD 4.99: the War Pass's premium track, retroactive. `store/IAP.md` section 5.

Plus 4 special-offer price tiers (`co.inflect.muster.offer.*`, consumables): US$1.99, US$4.99, US$9.99, US$19.99. Limited-time bundles whose contents the game shows; chest odds one tap away. `store/IAP.md` section 6.

## App Privacy

**Data Not Collected.** App Privacy > Get Started > 'Do you or your third-party partners collect data from this app?' = No, we do not collect data from this app. Then Publish. Still true with the in-app purchases: Apple takes the payment outside the app, and what was bought is credited and remembered on the device only. Apple's rule: data processed only on device is not 'collected' (https://developer.apple.com/support/app-privacy-on-the-app-store/). No tracking. No third-party SDKs (StoreKit is Apple's own). No analytics, ads or crash reporting.

## App Review information

Sign-in required: **No** (untick "Sign-in required").

Contact: Jack Wakem, jackwakem@gmail.com, phone (fill in: your mobile with country code).

Notes:

```
Remuster is a single-player strategy game. No account or sign-in, no ads, no tracking. The game itself never uses the network; the only network use is Apple's own purchase sheet (StoreKit 2).

Free to play: every campaign act, the Gauntlet, the Daily Challenge, Skirmish (AI Lab) and every Breakpoint puzzle. Nothing is locked behind a purchase; purchases only speed progress up.
In-app purchases, all consumables: a one-time Starter Pack (co.inflect.muster.starter), sold once per player and hidden after it's bought, with 1,200 gems, 6,000 coins and 142 unit cards; and five gem packs (co.inflect.muster.gems.pouch, .sack, .coffer, .trove, .hoard). Gems are a premium currency spent on coin bundles (troop upgrades) and a once-per-run Gauntlet Rally. Also War Pass Premium (co.inflect.muster.pass), a consumable sold once per 30-day season that adds the season's premium reward track (title screen > War Pass), and four special-offer price tiers (co.inflect.muster.offer.t1-t4) for limited-time bundles whose fixed gems, coins and cards are shown in the Shop with one chest. Every purchase states its contents; the only random part is a chest's contents, and every chest's odds are shown (Odds button) before it is bought or opened. Gems are also earned free by playing. There are no non-consumables, so there is no Restore Purchases button.

To test with a sandbox account: on the title screen tap Shop, then tap the Starter Pack price button (or a gem pack's, or a special offer's) and confirm; War Pass Premium is on the War Pass screen. The price shown comes from the App Store.

How to play: tap Campaign, then level 1. Drag a unit card from the shop at the bottom onto your (lower) half of the board and tap FIGHT; the battle plays itself, and winning rounds brings the rival's health to zero.
Daily Challenge and Skirmish are open from the title screen for everyone.
```

## Screenshots

iPhone 6.9" display (1320 x 2868 portrait). iPhone only, so no iPad screenshots. Apple scales these down for smaller iPhones. Upload in this order from `store/screenshots/`:

1. `01-battle.png`
2. `02-deploy.png`
3. `03-ascended.png`
4. `04-campaign.png`
5. `05-breakpoint.png`
6. `06-ai-lab.png`

Re-shoot after art changes: `npm run dev` in one terminal, then `npm run store:shots`.
