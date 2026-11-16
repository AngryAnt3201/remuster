"""The ten campaign act maps: palette, road, terrain and props per act, indexed like ACTS in engine/core/campaign.ts.

Colours are written for the Sunlit Meadow brightness. render_maps.py shifts them for the active style direction
(darker and cooler with lanterns lit for dusk, pastel for toy), so the acts stay recognisable in every direction.

Road points are (u, v) image fractions, v from the top. The road starts at the bottom (the player's camp) and ends at
the top at the act's boss landmark. Keep v inside 0.22 - 0.86 so the header and the act bar never cover a node.
"""

ACTS = [
    {   # 0: The Borderlands, farmland and fences, the river and the old bridge at the top
        "id": "borderlands",
        "ground": ["#86c45c", "#6aab49", "#acd975"], "noise": 0.55,
        "road": ["#ecd197", "#b98f5a"],
        "hills": 1.3, "edge": 1.6,
        "road_pts": [(0.36, 0.86), (0.66, 0.79), (0.70, 0.70), (0.34, 0.62), (0.28, 0.53), (0.62, 0.45), (0.70, 0.36), (0.42, 0.31), (0.50, 0.26)],
        "water": {"kind": "river", "v": 0.215, "width": 1.5, "color": ["#58b6e0", "#8fd6f2"]},
        "props": [("tree", 34), ("bush", 26), ("rock", 10), ("house", 4), ("fence", 10), ("flowers", 30), ("haystack", 5)],
        "boss": "bridge",
    },
    {   # 1: Ash Fields, scorched plain with ember cracks, dead trees and the Ashen Crown fort
        "id": "ash",
        "ground": ["#8c7a6a", "#6f5f53", "#a8957f"], "noise": 0.7,
        "road": ["#c9b08a", "#7e6650"],
        "hills": 1.6, "edge": 1.8,
        "road_pts": [(0.62, 0.86), (0.34, 0.79), (0.30, 0.69), (0.64, 0.61), (0.70, 0.51), (0.40, 0.44), (0.30, 0.35), (0.56, 0.27), (0.50, 0.22)],
        "lava": {"cracks": 16, "pools": 3, "color": "#ff8a3d", "hot": "#ffd27a"},
        "props": [("deadtree", 26), ("rock", 22), ("crater", 8), ("ember", 40), ("stump", 10), ("bones", 6)],
        "boss": "crownfort",
    },
    {   # 2: The Hollow Wood, deep forest, glowing mushrooms, the great hollow tree
        "id": "wood",
        "ground": ["#4f9a4f", "#3d7f42", "#6db55c"], "noise": 0.6,
        "road": ["#c8a874", "#8a6a43"],
        "hills": 1.0, "edge": 1.2,
        "road_pts": [(0.44, 0.86), (0.70, 0.78), (0.62, 0.68), (0.32, 0.62), (0.36, 0.52), (0.66, 0.45), (0.62, 0.36), (0.36, 0.29), (0.50, 0.22)],
        "props": [("tree", 60), ("pine", 24), ("mushroom", 22), ("bush", 30), ("log", 8), ("rock", 8)],
        "clear": 1.0,
        "boss": "hollowtree",
    },
    {   # 3: Iron Pass, a mountain road between cliffs, mine carts and the iron gate
        "id": "iron",
        "ground": ["#9a8f80", "#7c7266", "#b4a993"], "noise": 0.8,
        "road": ["#d2bf98", "#8c785b"],
        "hills": 2.2, "edge": 4.2, "relief": True,
        "road_pts": [(0.50, 0.86), (0.38, 0.78), (0.40, 0.69), (0.62, 0.62), (0.62, 0.53), (0.40, 0.45), (0.40, 0.36), (0.58, 0.29), (0.50, 0.22)],
        "props": [("pine", 30), ("rock", 34), ("boulder", 10), ("cart", 4), ("crystal_iron", 8), ("bush", 10)],
        "boss": "irongate",
    },
    {   # 4: The High Keep (5-act build: The Last Keep), walled hills, towers and the great keep
        "id": "keep",
        "ground": ["#7fb85a", "#669c49", "#9fcd70"], "noise": 0.55,
        "road": ["#ddd2bb", "#9a8e78"],
        "hills": 1.5, "edge": 2.0,
        "road_pts": [(0.32, 0.86), (0.60, 0.80), (0.68, 0.71), (0.40, 0.63), (0.34, 0.54), (0.62, 0.47), (0.64, 0.38), (0.42, 0.31), (0.50, 0.22)],
        "props": [("tree", 22), ("bush", 18), ("wall", 10), ("tower", 4), ("banner", 8), ("rock", 10), ("flowers", 16)],
        "boss": "castle",
    },
    {   # 5: The Frozen Reach, snowfields, ice crystals, a frozen lake and the ice citadel
        "id": "frozen",
        "ground": ["#e8f1f7", "#c9dbe8", "#ffffff"], "noise": 0.6,
        "road": ["#b9cfe0", "#7f9ab3"],
        "hills": 1.6, "edge": 2.4,
        "road_pts": [(0.60, 0.86), (0.36, 0.79), (0.32, 0.70), (0.58, 0.63), (0.68, 0.54), (0.44, 0.46), (0.34, 0.37), (0.56, 0.30), (0.50, 0.22)],
        "water": {"kind": "lake", "u": 0.74, "v": 0.70, "r": 1.7, "color": ["#a8dcf2", "#e2f6ff"]},
        "props": [("snowpine", 46), ("crystal", 16), ("rock_snow", 18), ("snowman", 2), ("drift", 20)],
        "boss": "icecitadel",
    },
    {   # 6: The Sky Throne, a golden causeway above the clouds and the throne on its dais
        "id": "sky",
        "ground": ["#f0e2bd", "#d8c596", "#fff4d6"], "noise": 0.45,
        "road": ["#fff1c9", "#c9a85e"],
        "hills": 0.4, "edge": 0.0,
        "sky": {"plateau": 1.9, "cloud": "#ffffff", "cloud_dk": "#cfe0f5", "below": "#9cc8f0"},
        "road_pts": [(0.46, 0.86), (0.66, 0.78), (0.62, 0.69), (0.36, 0.63), (0.34, 0.54), (0.62, 0.46), (0.64, 0.37), (0.40, 0.30), (0.50, 0.22)],
        "props": [("pillar", 16), ("crystal_gold", 14), ("cloudpuff", 46), ("bush_gold", 10), ("statue", 4)],
        "boss": "throne",
    },
    {   # 7: The Mirelight Fen, reed-banked meres, willows and lantern posts, Mother Wick's lantern hall on stilts
        "id": "fen",
        "ground": ["#86bb60", "#6aa24f", "#a6d27a"], "noise": 0.65,
        "road": ["#d9b98a", "#8a6440"],
        "hills": 0.8, "edge": 1.0,
        "road_pts": [(0.40, 0.86), (0.66, 0.80), (0.66, 0.70), (0.38, 0.64), (0.30, 0.55), (0.56, 0.48), (0.68, 0.39), (0.44, 0.31), (0.50, 0.22)],
        "water": {"kind": "ponds", "ponds": [(0.14, 0.74, 1.15), (0.88, 0.60, 1.2), (0.13, 0.44, 1.0), (0.86, 0.29, 0.95), (0.20, 0.97, 1.0), (0.84, 0.92, 0.9)],
                  "color": ["#3a9fb6", "#7fd2dc"]},
        "props": [("willow", 22), ("reeds", 46), ("lily", 26), ("lanternpost", 9), ("bush", 16), ("stump", 6), ("flowers", 14)],
        "boss": "lanternhall",
    },
    {   # 8: The Saltwind Coast, clifftop heath over a storm sea, gorse and wind-bent pines, the lighthouse on the point
        "id": "coast",
        "ground": ["#8fb87a", "#74a064", "#b0d095"], "noise": 0.6,
        "road": ["#e6d5a8", "#a8926a"],
        "hills": 1.0, "edge": 1.4,
        "road_pts": [(0.62, 0.86), (0.40, 0.80), (0.42, 0.70), (0.68, 0.63), (0.70, 0.54), (0.46, 0.47), (0.44, 0.38), (0.62, 0.30), (0.52, 0.22)],
        "water": {"kind": "coast", "color": ["#2f6f8c", "#5f9fb8"]},
        "props": [("pine", 22), ("gorse", 22), ("rock", 24), ("seastack", 7), ("house", 3), ("flowers", 18), ("fence", 6)],
        "boss": "lighthouse",
    },
    {   # 9: Crownfall Citadel, the ruined high fortress at dusk: broken walls, toppled pillars, braziers and the fallen crown
        "id": "citadel",
        "ground": ["#a0946c", "#82765a", "#bba881"], "noise": 0.6,
        "road": ["#dcc4a6", "#8f765f"],
        "hills": 1.4, "edge": 2.4, "relief": True,
        "road_pts": [(0.38, 0.86), (0.64, 0.80), (0.66, 0.70), (0.36, 0.63), (0.32, 0.54), (0.60, 0.47), (0.66, 0.38), (0.42, 0.31), (0.50, 0.22)],
        "props": [("ruinpillar", 16), ("wall", 12), ("deadtree", 12), ("rock", 20), ("brazier", 9), ("banner", 6), ("bush", 10)],
        "boss": "ruinedcitadel",
    },
]
