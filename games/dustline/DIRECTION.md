# Dustline: direction

**The world.** A railroad town at high noon on a sun-baked frontier: two posses face each other down a dirt main
street while the buzzards circle. Everything is dust, dry timber, rope, hot iron and sweat; nothing is polished.

Reference points, in our own words: (1) sun-bleached pine boards and adobe under a white-hot sky, shadows short and
plum-dark; (2) letterpress wanted posters: slab woodtype, ragged paper, a brass tack in each corner; (3) the pulp
western's props, bigger than life: ten-gallon hats, serapes, dynamite, iron horses, snake-oil bottles.

**The two sides.** The player rides for the **Star** (lawmen): a clear denim-sky blue, the lighter of the two.
The rival is the **Brand** (outlaws): a dark blood-red bandana red. Blue is light and cool, red is dark and warm, so
they separate in lightness as well as hue. Each owns its units' big surfaces (serapes, coats, hat bands, shields,
wings, flags), its keep's awning, roof and flag, its health bars and its deploy-zone wash.

| job | colour |
| --- | --- |
| ground (sunlit dirt) | `#d9b47a` sand, `#c79a5e` rut, `#e6c891` bleached |
| shadow | `#5a2f4a` plum-brown |
| ink | `#2a1608` burnt umber |
| panel (poster paper) | `#ecd9ae`, aged edge `#c9a86a` |
| boards (frames, bars) | `#6e4526` pine, `#3f2614` dark |
| accent (brass tack, star) | `#e2a93b` |
| go | `#b5372a` barn red (the big "DRAW" button) |
| danger | `#8f1d16` |
| Star (player) | `#45a3ec` / dark `#1c5c9c` / light `#bfe4ff` |
| Brand (rival) | `#d63b2a` / dark `#861d12` / light `#ffb9a3` |

**Type.** Display: **Rye** (SIL OFL), a woodtype slab with spurs, for headings, buttons and numbers. Text:
**Bitter**-like system slab stack (`Rockwell, "Roboto Slab", Georgia, serif`), bold. Both read at 11 px on paper.

**What the interface is made of.** Nailed pine boards and wanted-poster paper. Panels are sheets of ragged cream
paper with a printed double rule and a brass tack in each corner; bars and the tab rail are dark boards with
visible plank seams and nail heads; buttons are painted wooden signs (square corners, a routed inner border) that
sink on their nails when pressed; the main button is a barn-red sign that says what a duel says. Health bars are
rope-edged slots; costs are stamped on a tin sheriff star rather than a gold coin; unit cards are small wanted
posters (portrait in a printed frame, name in woodtype, the price as the bounty). Nothing is rounded, glossy or
gem-like. The home screen is one large wanted poster nailed to a plank wall (layout changed in `src/ui/home.ts`),
and the tab bar is a hitching rail of hanging wooden shingles (`src/ui/tabs.ts`).

**The battlefield.** Sunlit dirt with wagon ruts, boardwalks down both sides, a railroad track across the neutral
strip, false-front saloons, adobe, water towers, cacti and mesas beyond. Ten acts, ten places: the Junction's main
street, an oil field, a cottonwood ranch, the railhead, a cavalry fort, a blizzard pass, a red mesa top, a lantern
bayou, a mission on the coast, and the boomtown Goldspur at sundown. Effects are gunsmoke, muzzle flash and dust.

**The cast.** Hats do the work: the camera looks down, so each unit has its own hat shape plus one big prop.

| kind | becomes | why its job still reads |
| --- | --- | --- |
| ranger | **Deadeye**: rifleman in a serape and stetson | long rifle across the body, muzzle flash |
| blades | **Bowie Trio**: three masked knife bandits | small, quick, machete and slash arc, in threes |
| bulwark | **Barndoor**: a smith behind a barn door | huge plank shield in team paint, slow |
| medic | **Sawbones**: frontier doctor, white coat, tonic | white, bottle, green mist |
| grenadier | **Dynamiter**: stout blaster with a lit bundle | red sticks in the throwing hand, overarm |
| shade | **Bushwhacker**: black duster, hat low, twin knives | dark, masked, team colour only as bandana |
| lancer | **Trooper**: cavalryman on a bay horse | horse + levelled lance with pennon |
| ballista | **Buffalo Gun**: a wall-gun on wagon wheels | very long barrel on a carriage |
| hive | **Scorpion Den**: rock burrow with a plank hatch | squat mound whose hatch opens to spawn |
| storm | **Rainmaker**: a showman flying a kite on a wire | tall crackling kite, arcs on the blow |
| golem | **Hoodoo**: a walking stack of red rock | biggest body, two stacked slabs, boulder fists |
| sapper | **Prospector**: bearded miner, pick, candle hat | pickaxe, lamp, pan |
| harrier | **Buzzard**: a vulture in team feathers | wide team wings, small body |
| banner | **Bugler**: cavalry guidon on a tall staff | tall swallowtail flag |
| rime | **Frostbite**: mountain trapper in pale furs | cold colours, ice block, shards |
| ravager | **Spikedriver**: rail hand with a spike maul | brutal, bare arms, huge hammer, wide swing |
| grave | **Undertaker**: black top hat, shovel, green lamp | dark, tall hat, eerie green |
| bombard | **Thumper**: stubby siege mortar on a sled | fat barrel at the sky, cannonballs |
| tinker | **Gunsmith**: apron, big hammer, crate of barrels | tool + pack; builds a Gatling |
| duelist | **Cardsharp**: gambler with a sword-cane | slim, flat hat, thin blade, cards on the parry |
| pikeman | **Sodbuster**: farmer with a long hay fork | very long pole, straw hat |
| keg | **Nitro Kid**: boy sprinting with a red powder keg | obvious big bomb, leaning run |
| trickster | **Huckster**: medicine-show barker | striped tall hat, cape, cane |
| hook | **Wrangler**: big cowhand in woolly chaps | lasso loop overhead, rope flies on the cast |
| thorn | **Cholla**: seed-sower with a cactus on her back | tall green cactus pack |
| outrider | **Pistolero**: sombrero rider on a palomino | light horse + carbine, no lance |
| lamp | **Switchman**: railroad signalman | lantern on a long pole |
| griffin | **War Eagle**: lancer on a giant eagle | big wings + rider + lance |
| tide | **Dowser**: water-witch with a rod and barrel | water barrel, flood blast |
| lion | **Marshal**: the hero in a long coat and plumed hat | bigger, grander, plume, long sabre |
| mite / queen | **Scorpling** / **Scorpion Queen** | tiny crawler / bigger one, raised stingers |
| golemling | **Rubble**: one slab of a fallen Hoodoo | small copy of the Hoodoo |
| thrall | **Stiff**: a boot-hill skeleton | thin bone figure |
| turret | **Gatling**: a crank gun on a tripod | small fixed gun |
| decoy | **Dummy**: a burlap scarecrow in the Huckster's hat | plainly a fake Huckster |
| mine | **Powder Trap**: half-buried dynamite ring | low, round, spiky, blinking fuse |

Rank reads as metal and finery: iron and rawhide, then tin conchos, then brass, then gold with a hovering star in
the team's light colour.
