-- Remuster backend, first release. Applied by `npm run infra:deploy` (wrangler d1 migrations) and by the local server.
CREATE TABLE players (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created INTEGER NOT NULL,
  seen INTEGER NOT NULL,
  banned INTEGER NOT NULL DEFAULT 0
);

-- One cloud save per player: the engine's save, the same in every game (they are all the same game underneath).
CREATE TABLE saves (
  player TEXT PRIMARY KEY REFERENCES players(id),
  rev INTEGER NOT NULL,
  data TEXT NOT NULL,
  updated INTEGER NOT NULL
);

-- Published games: a player's re-themed frontend, served from R2 at /g/<id>/.
CREATE TABLE games (
  id TEXT PRIMARY KEY,
  owner TEXT NOT NULL REFERENCES players(id),
  name TEXT NOT NULL,
  tagline TEXT NOT NULL DEFAULT '',
  theme TEXT NOT NULL DEFAULT '#0b0f17',
  engine INTEGER NOT NULL DEFAULT 0,       -- engine release the game was built against
  version INTEGER NOT NULL DEFAULT 0,      -- live version (0 = nothing published yet)
  draft INTEGER NOT NULL DEFAULT 0,        -- version being uploaded
  status TEXT NOT NULL DEFAULT 'live',     -- live | hidden (taken down)
  bytes INTEGER NOT NULL DEFAULT 0,
  plays INTEGER NOT NULL DEFAULT 0,
  created INTEGER NOT NULL,
  updated INTEGER NOT NULL
);
CREATE INDEX games_listing ON games(status, plays DESC);

CREATE TABLE game_files (
  game TEXT NOT NULL REFERENCES games(id),
  version INTEGER NOT NULL,
  path TEXT NOT NULL,
  size INTEGER NOT NULL,
  type TEXT NOT NULL,
  PRIMARY KEY (game, version, path)
);

CREATE TABLE reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  game TEXT NOT NULL,
  player TEXT,
  reason TEXT NOT NULL,
  created INTEGER NOT NULL
);

-- The Arena ladder. Results are re-simulated by the engine on the server before trophies move.
CREATE TABLE ladder (
  player TEXT PRIMARY KEY REFERENCES players(id),
  trophies INTEGER NOT NULL DEFAULT 0,
  best INTEGER NOT NULL DEFAULT 0,
  wins INTEGER NOT NULL DEFAULT 0,
  losses INTEGER NOT NULL DEFAULT 0,
  updated INTEGER NOT NULL
);
CREATE INDEX ladder_top ON ladder(trophies DESC);

-- A match the server has issued and is waiting to hear the result of.
CREATE TABLE matches (
  id TEXT PRIMARY KEY,
  player TEXT NOT NULL REFERENCES players(id),
  seed INTEGER NOT NULL,
  arena TEXT NOT NULL,
  trophies INTEGER NOT NULL,             -- the player's trophies when it was issued
  ghost INTEGER,                         -- ghosts.id of the opponent, or NULL for an AI rival
  created INTEGER NOT NULL,
  settled INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX matches_player ON matches(player, settled);

-- Armies players fielded, replayed as other players' opponents.
CREATE TABLE ghosts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player TEXT NOT NULL REFERENCES players(id),
  name TEXT NOT NULL,
  trophies INTEGER NOT NULL,
  arena TEXT NOT NULL,
  engine INTEGER NOT NULL,
  data TEXT NOT NULL,                    -- the army round by round (engine/core/ghost.ts)
  created INTEGER NOT NULL
);
CREATE INDEX ghosts_pick ON ghosts(arena, trophies);

CREATE TABLE events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player TEXT,
  game TEXT,
  name TEXT NOT NULL,
  props TEXT,
  at INTEGER NOT NULL
);
CREATE INDEX events_name ON events(name, at);

-- Fixed-window request counters (per player or IP, per action).
CREATE TABLE rate (
  key TEXT PRIMARY KEY,
  win INTEGER NOT NULL,
  n INTEGER NOT NULL
);
