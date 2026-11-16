# Pixelkeep: direction

## The world

A cartridge nobody remembers buying, still warm in the slot: two tiny kingdoms on a tile map, forever at war over a
castle sixteen pixels wide. Everything is made of fat square pixels, a handful of colours, and a black outline.

Reference points, in our own words:

- **Materials**: tile maps. Dithered grass, brick castle walls, water tiles with two-frame sparkle, round pixel trees.
- **Era**: an 8-bit home console, about 1987. A fixed palette, no gradients, no anti-aliasing, one black pixel of ink.
- **Mood**: bright, toy-like and a little heroic. Arcade attract mode: "PRESS START" blinking over a tiny army.

## The two sides

| | name | colour | where |
| --- | --- | --- | --- |
| player | **P1**, the Blue Kingdom | light sky blue `#40a0ff` (dark `#0040c0`, light `#c0ffff`) | tunics, shields, wings, flags, keep roofs, health bars, deploy zone |
| rival | **CPU**, the Red Horde | dark cartridge red `#e02020` (dark `#800000`, light `#ffc080`) | the same surfaces |

Light and cool against dark and warm: they separate in lightness as well as hue. Team colour sits on the biggest
surface of every body (tunic, shield, wings, robe); skin, steel, wood and bone are shared.

## Palette and type

Every colour channel sits on five levels (`00 40 80 bf ff`), so the whole game draws from one small console palette.

| job | colour |
| --- | --- |
| ink / outline | `#101018` |
| page (behind everything) | `#080820` deep blue-black |
| window fill | `#000000` and `#101040` |
| window border, text | `#ffffff`, shadowed `#8080bf` |
| accent (cursor, coins, selected) | `#ffbf00` |
| go (start, confirm) | `#40bf40` |
| danger (hearts, damage) | `#ff4040` |
| ground | grass `#40bf40` / `#008000` dither, path `#ffbf80`, water `#4080ff`, brick `#bf4040`, stone `#bfbfbf` |

Type: **Press Start 2P** (SIL OFL, bundled in `public/fonts`) for everything, display and text. All capitals for
headings and buttons. Small sizes, wide line height, hard one-pixel drop shadow, no smoothing.

## What the interface is made of

A console's text windows. Black or deep-blue boxes with a thick white pixel border and a grey inner step, square
corners. Buttons are boxes that invert when pressed; the primary one has a blinking `▶` cursor. Health is hearts and
segmented bars; coins and gems are redrawn as pixel icons; tabs are a row of console "menu slots". The home screen
is a title screen (logo, blinking PRESS START, a text menu with a cursor) instead of the base game's stacked cards.
The battle canvas itself is drawn on a coarse pixel grid and scaled up with hard edges, so ground, units, buildings
and effects all share one pixel size.

## The cast

Small sprites lose detail fast, so each body is one bold silhouette plus one oversized prop, with a big head.

| kind | becomes | why its job still reads |
| --- | --- | --- |
| mine | **Spike Trap** | a low spiked ball in the grass with a blinking red pixel |
| blades | **Squires** | three tiny knights, short swords, a white slash arc |
| ranger | **Bowkin** | hooded archer with a bow as tall as he is |
| bulwark | **Bigshield** | fat knight hidden behind a door-sized team shield |
| medic | **Cleric** | white robe, staff with a green heart; green burst on the cast |
| grenadier | **Bomber** | stout fellow holding a round black bomb with a lit fuse over his head |
| shade | **Sneak** | black ninja, two daggers, team colour only on the headband |
| lancer | **Cavalier** | knight on a horse with a long levelled lance and pennant |
| ballista | **Long Cannon** | a long thin barrel on wheels behind a team gun shield |
| hive | **Slime Den** | a squat stone cave mouth that opens and spits slimes |
| storm | **Zap Wizard** | tall pointed hat, staff with a lightning bolt; yellow arcs on the blow |
| golem | **Blockhead** | the biggest body: two stacked stone blocks with huge fists |
| sapper | **Digger** | miner with a helmet lamp and a big pickaxe |
| harrier | **Bat** | wide team-colour wings, tiny body, fangs |
| banner | **Flagbearer** | a tall team flag on a pole is the whole silhouette |
| rime | **Frost Mage** | ice-blue robe, snowflake staff, a spray of white shards |
| ravager | **Berserker** | horned helmet, two-handed axe as big as he is |
| grave | **Necromancer** | dark hooded robe, skull staff burning green |
| bombard | **Mortar** | a fat stubby barrel pointing at the sky |
| tinker | **Smith** | apron, giant hammer, a pack of gears |
| duelist | **Fencer** | slim, feathered hat, a needle-thin rapier |
| pikeman | **Spearman** | kettle helm and a spear twice his height |
| keg | **Fuse Runner** | sprinting with a huge lit bomb held overhead |
| trickster | **Jester** | two-horned jester cap, cape, juggling stars |
| hook | **Chain Ogre** | heavy green brute with an anchor hook on a chain |
| thorn | **Druid** | antlers, leaf cloak, a sprouting staff |
| outrider | **Wolf Rider** | archer on a fast grey wolf |
| lamp | **Lantern Monk** | a glowing lantern on a long pole |
| griffin | **Drake Knight** | armoured rider with a lance on a winged drake |
| tide | **Wave Mage** | sea-green robe, trident, a blue wave blast forward |
| lion | **Hero** | bigger, caped, plumed helm, great sword held high |
| mite | **Slimelet** | tiny team-colour slime |
| queen | **Slime Queen** | big slime with a little crown |
| golemling | **Half Block** | one block of a fallen Blockhead |
| thrall | **Skeleton** | thin white bones with a rusty sword |
| turret | **Pop Gun** | a small cannon on a tripod |
| decoy | **Dummy** | a straw-and-sack copy of the Jester on a stick |

Ranks: 2 adds steel trim, 3 gold trim and a crest, 4 ("Max Level") a glowing team-light gem over the head and a
glowing weapon.
