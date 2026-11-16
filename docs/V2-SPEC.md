# Muster v2: 24 units, evolutions, Ascended abilities, Blender art, App Store

Shared contract for everyone working on v2. Short on purpose.

## Ranks and evolutions
- Ranks 1-4. Rank up costs: 1→2 = cost, 2→3 = 2×cost, 3→4 = 3×cost (`upgradeCost`).
- Every rank changes how the unit LOOKS (four visual tiers): 1 Recruit (plain cloth/wood), 2 Veteran (metal pieces, helmet, team-colour trim), 3 Elite (full ornate armour, cape or banners, bigger weapon, team-colour accents glow faintly), 4 Ascended (transformed silhouette, emissive team-colour energy, crystals/halo/runes).
- Rank 4 is **Ascended**: stats as rank 3 ×1.15 plus the unit's **signature ability** (table below). Ascend is only offered from round 5 on.
- Stats: hp × (1 + 0.65·(r-1)), dmg × (1 + 0.5·(r-1)) for r ≤ 3.

## The 24 units
Kind ids are fixed (code, sprites and content all use them). Names are display names.

| # | kind | Name | Cost | Role | Behaviour | Ascended ability |
|---|---|---|---|---|---|---|
| 1 | mine | Mine | 2 | trap | Buried, untargetable; fuse when an enemy steps close; 1-unit blast | **Cluster**: the blast throws 3 bomblets that burst 0.6 s later |
| 2 | blades | Blade Trio | 3 | melee | 3 swords, shared target, surround, arc slash | **Whirlwind**: every 3rd slash is a 360° spin |
| 3 | ranger | Ranger | 3 | ranged | Holds bow range, strafes, backs off | **Volley**: every 4th shot is 3 arrows in a fan |
| 4 | bulwark | Bulwark | 4 | tank | Front shield (-60%), guards the ally in danger, taunts melee | **Bastion**: allies within 1.5 behind it take 30% less damage; bash stuns longer |
| 5 | medic | Medic | 3 | support | Heals most hurt ally, hides behind it | **Revive**: once a battle, brings back the first ally that falls within 3 at 50% |
| 6 | grenadier | Grenadier | 4 | artillery | Lobs at where enemies will bunch | **Firebomb**: bombs leave burning ground 3 s |
| 7 | shade | Shade | 4 | assassin | Cloaked flank, blink behind softest, backstab | **Shadow Step**: a kill resets the blink |
| 8 | lancer | Lancer | 4 | cavalry | Aim, straight charge through a line, wheel, again | **Trample**: charges never stop on big units and stun all they pass |
| 9 | ballista | Ballista | 3 | structure | Fixed, slow turret, piercing bolts | **Twin Bolt**: two bolts in a narrow spread |
| 10 | hive | Hive | 4 | spawner | Breeds mites | **Brood Queen**: a queen mite (tough) once; mites pop on death |
| 11 | storm | Stormcaller | 5 | caster | Chain lightning | **Overcharge**: +3 jumps, longer stun |
| 12 | golem | Stone Colossus | 5 | siege | Slow giant, structures first, splits into two shardlings | **Quake**: every 3rd slam is a wide stunning quake |
| 13 | sapper | Sapper | 4 | assassin | Burrows (untargetable, leaves a dirt trail) under the field to the enemy backline, erupts with a stun burst, then fights | **Cave-in**: the eruption is twice as wide and damages |
| 14 | harrier | Harrier | 4 | air | FLYING: only ranged/caster/structure attacks can hit it; it ignores ground collision and mines; dives on a target, climbs, circles, dives again | **Talon Dive**: dives knock back and hit everything under it |
| 15 | banner | Standard Bearer | 3 | support | Walks behind the main group; allies within 2 attack 25% faster | **Rally**: aura also +20% damage and heals 2%/s |
| 16 | rime | Rimecaller | 4 | caster | Frost shards; hits slow enemies 50% for 2 s; keeps distance | **Deep Freeze**: every 3rd cast freezes the target solid 1.5 s |
| 17 | ravager | Ravager | 4 | melee | Berserker: goes for the toughest enemy; attack speed rises as it loses health | **Bloodlust**: heals 20% of damage dealt |
| 18 | grave | Gravecaller | 4 | spawner | When any unit dies within 3, raises a bone thrall for its side (cap 4) | **Ossuary**: thralls are tougher and it raises one every 6 s regardless |
| 19 | bombard | Bombard | 4 | structure | Fixed, very long range (8), min range 2.5, slow huge-arc shell, big blast | **Shrapnel**: shells split into 4 on impact |
| 20 | tinker | Tinker | 3 | support | Builds a small auto-turret (one at a time) and repairs damaged structures | **Workshop**: builds two turrets, turrets fire faster |
| 21 | duelist | Duelist | 3 | melee | Parries one hit every 3 s (no damage) and ripostes; hunts enemy melee | **Perfect Parry**: parry every 1.5 s, riposte crits |
| 22 | pikeman | Pikeman | 3 | tank | Long reach; braces when cavalry/chargers come (they stop and take big damage) | **Hedgehog**: braced pikes also reflect 30% of melee damage |
| 23 | keg | Kegrunner | 3 | siege | Sprints at the densest enemy group and explodes (dies) | **Chain Keg**: leaves a second keg that blows 1 s later |
| 24 | trickster | Trickster | 4 | assassin | Spawns 2 decoys of itself that draw attacks; re-casts when they pop | **Mirror Hall**: 4 decoys and decoys explode when struck |

Spawned bodies: `mite`, `golemling` (display "Shardling"), `thrall`, `turret`, `decoy`, `queen`.

Air: `harrier` is the only flyer. A flyer can be hit only by bodies with a ranged attack (ranger, ballista, storm, rime, bombard? no (shells land on ground), turret, harrier itself, grenadier? no). Melee ignores flyers when picking targets.

## Art contract (Blender → sprites)
- Sprites: top-down orthographic, unit FACING +X (to the right of the image), transparent background, no baked ground shadow (the game draws its own), lit from above so rotation looks right.
- Pixels per world unit: 120 (manifest says so). Image square, unit centred.
- Files: `base/public/sprites/<kind>/t<tier>_<team>_<pose>.png`, team = `tide` (player, #3fd0c9) or `ember` (rival, #ff6a4d), pose = `idle` or `attack`. Spawned bodies: tier 1 only.
- Portraits (cards, menus): 3/4 view, `base/public/portraits/<kind>_t<tier>.png`, 256×256, tide team.
- `base/public/sprites/manifest.json`: `{ "ppu": 120, "units": { "<kind>": { "size": <px>, "tiers": [1,2,3,4], "poses": ["idle","attack"] } } }`.

## App Store
- Bundle id `co.inflect.muster`, iPhone only, portrait, no accounts, no data collected, no tracking, offline.
- Team `F4ZF9VS4GN` (Jack Wakem). Store name: "Muster" is taken; final name pending Jack.
