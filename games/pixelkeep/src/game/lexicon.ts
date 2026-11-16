// This game's words. The engine and the base UI speak in the base game's vocabulary ("Ranger", "Gems", "War Pass",
// "The Borderlands"); a game renames anything by listing it here: exact phrase in, your phrase out. It applies to
// every piece of text on screen (DOM text, titles, aria-labels) and to text drawn on the battle canvas, with no other
// code change. Matching is case-sensitive on whole words, longest phrase first, one pass (so swapping two words is
// safe). List plurals and capitalisations you care about separately.
//
//   npm run text -- <game>     writes games/<game>/lexicon.todo.json: every name the engine ships (units, abilities,
//                              acts, levels, rivals, modes, chests...) so nothing gets missed.
//
// The base game uses its own vocabulary, so this is empty here. A game shadows this file:
//   games/<id>/src/game/lexicon.ts
export const LEXICON: Record<string, string> = {};
