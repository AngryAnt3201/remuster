-- The server-authoritative Arena ladder (infra/src/arena.ts).

-- The player's whole ladder as the engine keeps it (ArenaSave JSON: trophies, best, streak, played, per-arena wins).
-- The trophies/best/wins/losses columns stay as the indexed copy the leaderboard reads.
ALTER TABLE ladder ADD COLUMN save TEXT;

-- What an issued match was built from: { save, levels, roster, hp } (the ladder as it stood, and what the player
-- brought), so the result is replayed against exactly the match that was issued.
ALTER TABLE matches ADD COLUMN setup TEXT NOT NULL DEFAULT '{}';
-- settled: 0 open, 1 replayed and recorded, 2 forfeited, 3 expired unplayed. won: 1/0 once settled as 1 or 2.
ALTER TABLE matches ADD COLUMN won INTEGER;
ALTER TABLE matches ADD COLUMN rounds INTEGER;

CREATE INDEX ghosts_player ON ghosts(player, id);
