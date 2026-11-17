# Neonhold: direction

**The world.** The Hold is a megacity that never sees daylight: forty storeys of signage over streets that are
always wet. Street crews and corporate security fight block by block for its rooftops, markets and server halls.

Reference points, in our own words: (1) *wet asphalt at 2 a.m.*: near-black indigo ground that mirrors every sign
above it; (2) *gas-tube light*: thin lines of pure colour with a soft halo, never a lit surface without an edge;
(3) *smoked glass and chrome*: dark bodies, dark panels, everything read by its glowing outline.

## The two sides

| | colour | where |
| --- | --- | --- |
| Player ("Volt") | argon cyan `#1fe5ff` (dark `#0b7fa8`, light `#b8f9ff`) | panels, shields, wings, visors, keep, health bar, deploy zone |
| Rival ("Blaze") | neon-gas orange-red `#ff5630` (dark `#a8260f`, light `#ffc4a6`) | the same parts |

Cyan is much lighter than the orange-red and sits on the other side of the blue/yellow axis, so the two hold apart
for colour-blind players. Neither is the city's own colour: the scenery is magenta, violet and deep blue, kept dimmer
and smaller than anything a unit wears. Team parts are always *lit* (emissive fill plus halo); everything else on a
unit is dark with an edge glow.

## Palette

| job | colour |
| --- | --- |
| ground (wet asphalt) | `#1d1f38`, puddle mirror `#2a2350` |
| shadow / ink | `#07051a` |
| panel glass | `rgba(12,10,34,0.78)` over a blur, hairline border |
| text | `#e9f3ff`, muted `#8d92bd` |
| city accent (signage, UI highlight, headings) | magenta `#ff2bd6`, violet `#8a5cff` |
| go | acid lime `#d4ff3a` |
| danger | hot red `#ff2e5b` |
| currency | amber `#ffc53d` (creds), ice `#7df9ff` (shards) |

**Type.** Display: *Chakra Petch* (bundled, SIL OFL): angular, squared, upper-case with wide tracking. Text and
numbers: *Share Tech Mono* (bundled, SIL OFL), falling back to `ui-monospace`.

## What the interface is made of

Smoked glass and light. Panels are dark translucent plates with a 1 px glowing border and **chamfered corners** (cut
at 45 degrees, never rounded); buttons are flat slabs of light with a cut corner that dim and shift when pressed;
bars are segmented tubes; headings are tracked capitals with a magenta underline tick. Scanlines appear only on the
page background and big sheets. The battle HUD is a visor overlay: corner brackets, thin read-outs, the shop as a
row of glass chips. The home screen is re-laid-out as a visor: the key art full height, a vertical rail of mode
chips on the left edge and one wide "JACK IN" slab at the bottom, instead of the base game's centred card stack.

## The cast

Every body is a dark chassis with a glowing edge; the team colour is one big lit surface (named below) plus the visor.

| kind | becomes | why its job still reads |
| --- | --- | --- |
| mine | **Prox Mine**: a hex puck with prongs and a blinking lamp | low, round, spiky, warning light |
| blades | **Razors**: three hooded kids with short glowing knives | small, quick, a blade and an arc |
| ranger | **Tracer**: a visor'd shooter with a long rail rifle | long weapon across the body, muzzle flash |
| bulwark | **Riotwall**: a huge trooper behind a hard-light riot shield | the biggest lit team surface in the game, in front |
| medic | **Medtech**: white hazard suit, injector gun, green cross halo | pale body, green burst |
| grenadier | **Lobber**: stout, bandolier, a glowing canister overarm | bomb in the throwing hand |
| shade | **Ghost**: cloaked, hood, twin mono-blades, team only as trim | dark, hooded, two blades |
| lancer | **Ramrider**: armoured rider on a heavy bike with a levelled shock lance | mount + long lance |
| ballista | **Railgun**: a long twin-rail barrel on a tripod | long barrel on a base |
| hive | **Dronebox**: a hacked vending machine whose hatch drops drones | squat box with a mouth that opens |
| storm | **Arcjack**: a hacker with a tall antenna staff that crackles | tall, arcs on the blow |
| golem | **Twin Rig**: a loader mech in two bolted halves with a lit seam | biggest body, heavy fists, two halves |
| sapper | **Borer**: hard hat, headlamp, a drill arm | digging tool + lamp |
| harrier | **Skyray**: a delta-wing strike drone | wide team wings, small body |
| banner | **Herald**: carries a tall holo-banner | tall team standard |
| rime | **Cryo**: coolant tank and spray nozzle, ice-blue | cold colours, spray |
| ravager | **Wrecker**: a chromed brute with a two-handed power hammer | brutal, heavy weapon, wide swing |
| grave | **Rebooter**: a tall hooded coder with a green terminal glow | dark, tall hood, eerie green |
| bombard | **Thumper**: a fat mortar tube pointing at the sky | fat barrel skyward |
| tinker | **Rigger**: a big wrench and a pack of parts | tool + pack |
| duelist | **Ronin**: slim, one long glowing katana | slim, thin blade |
| pikeman | **Stunpike**: a very long shock pole | very long polearm |
| keg | **Meltdown**: sprints with an unstable power cell on its back | obvious big bomb, leaning run |
| trickster | **Mirage**: a showman in a cape and tall hat, half hologram | showy, caped, tall hat |
| hook | **Grappler**: heavy, a mag-hook launcher and cable drum | hook + chain |
| thorn | **Biohacker**: a tank of glowing vines on the back, a seed gun | green and growing |
| outrider | **Skimmer**: a hoverbike rider with a machine pistol | fast vehicle + gun |
| lamp | **Prism**: a shield projector on a long pole | a light on a pole |
| griffin | **Jetlance**: a jet-pack trooper with wings and a lance | winged knight with lance |
| tide | **Washout**: riot-hose trooper with a pressure tank | water gear, big forward blast |
| lion | **Shogun**: the crew boss: bigger, crested helmet, long coat, great blade | bigger, grander, plumed |
| mite | **Bitbug**: a palm-sized spider drone | tiny crawler |
| queen | **Hubbug**: the big spider drone with an antenna | big crawler |
| golemling | **Half Rig**: one half of a fallen Twin Rig | smaller copy of the mech |
| thrall | **Glitch**: a thin flickering scrap-frame raised by the Rebooter | thin undead figure |
| turret | **Sentry**: a small tripod gun | small fixed gun |
| decoy | **Echo**: a see-through copy of the Mirage | clearly a fake Mirage |

## Rules of the picture

- Ground stays dark but not black (units must sit *on* something); light on the ground is reflections of signs,
  dim, in long vertical streaks.
- Signage, windows and the skyline carry magenta, violet and blue; cyan and orange-red are reserved for the teams.
- Ranks: 1 plain chassis, 2 chrome trim, 3 gold trim plus an extra part, 4 "Ascended": a team-light halo part.
