// SQLite storage for the server leaderboard (built-in node:sqlite, Node >= 22: no native npm dependency).
// Two tables: one row per finished mission and one per astronaut in it. All limits come from config.mjs.

import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS missions (
  id           TEXT PRIMARY KEY,
  room_code    TEXT,
  mode         TEXT NOT NULL,
  site         TEXT NOT NULL,
  difficulty   TEXT NOT NULL,
  grade        TEXT NOT NULL,
  team_score   INTEGER NOT NULL,
  tasks_done   INTEGER NOT NULL,
  tasks_total  INTEGER NOT NULL,
  stranded_cnt INTEGER NOT NULL DEFAULT 0,
  player_count INTEGER NOT NULL DEFAULT 1,
  created_at   INTEGER NOT NULL,
  experiments  TEXT,
  run_seed     INTEGER,
  score_mult   REAL
);
CREATE TABLE IF NOT EXISTS mission_players (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  mission_id  TEXT NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
  player_name TEXT NOT NULL,
  seat        TEXT NOT NULL,
  score       INTEGER NOT NULL,
  grade       TEXT NOT NULL,
  stranded    INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_missions_rank ON missions(team_score DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_missions_filter ON missions(difficulty, site, team_score DESC);
CREATE INDEX IF NOT EXISTS idx_players_rank ON mission_players(score DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_players_name ON mission_players(player_name);
`;

const where = ({ difficulty, site }) => {
  const clauses = [], params = [];
  if (difficulty && difficulty !== 'all') { clauses.push('m.difficulty = ?'); params.push(difficulty); }
  if (site && site !== 'all') { clauses.push('m.site = ?'); params.push(site); }
  return { sql: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '', params };
};

export function openDatabase(dbPath = ':memory:') {
  if (dbPath !== ':memory:') mkdirSync(dirname(dbPath), { recursive: true });
  const db = new DatabaseSync(dbPath);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  db.exec(SCHEMA);
  // Databases created before the experiment draw (v1.5) lack the last three columns: add them in place.
  const columns = new Set(db.prepare('PRAGMA table_info(missions)').all().map(c => c.name));
  for (const [name, type] of [['experiments', 'TEXT'], ['run_seed', 'INTEGER'], ['score_mult', 'REAL']]) {
    if (!columns.has(name)) db.exec(`ALTER TABLE missions ADD COLUMN ${name} ${type}`);
  }

  const insertMission = db.prepare('INSERT OR IGNORE INTO missions (id, room_code, mode, site, difficulty, grade, team_score, tasks_done, tasks_total, stranded_cnt, player_count, created_at, experiments, run_seed, score_mult) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
  const insertPlayer = db.prepare('INSERT INTO mission_players (mission_id, player_name, seat, score, grade, stranded) VALUES (?, ?, ?, ?, ?, ?)');
  const playersOf = db.prepare('SELECT player_name AS playerName, seat, score, grade, stranded FROM mission_players WHERE mission_id = ? ORDER BY score DESC, id ASC');

  return {
    // Returns { recorded } or { recorded: false, duplicate: true } when this mission id was already stored.
    recordMission(m) {
      db.exec('BEGIN');
      try {
        const res = insertMission.run(m.id, m.roomCode ?? null, m.mode, m.site, m.difficulty, m.grade, m.teamScore, m.tasksDone, m.tasksTotal, m.strandedCount, m.players.length, m.createdAt ?? Date.now(),
          m.experiments ? JSON.stringify(m.experiments) : null, m.runSeed ?? null, m.scoreMultiplier ?? null);
        if (!res.changes) { db.exec('ROLLBACK'); return { recorded: false, duplicate: true }; }
        for (const p of m.players) insertPlayer.run(m.id, p.playerName, p.seat, p.score, p.grade, p.stranded ? 1 : 0);
        db.exec('COMMIT');
        return { recorded: true, duplicate: false };
      } catch (err) {
        try { db.exec('ROLLBACK'); } catch { /* no transaction left */ }
        throw err;
      }
    },
    getMissionLeaderboard({ difficulty = 'all', site = 'all', limit = 25 } = {}) {
      const w = where({ difficulty, site });
      const rows = db.prepare(`SELECT m.id, m.room_code AS roomCode, m.mode, m.site, m.difficulty, m.grade, m.team_score AS teamScore, m.tasks_done AS tasksDone, m.tasks_total AS tasksTotal, m.stranded_cnt AS strandedCount, m.player_count AS playerCount, m.created_at AS createdAt, m.experiments, m.run_seed AS runSeed, m.score_mult AS scoreMultiplier FROM missions m ${w.sql} ORDER BY m.team_score DESC, m.created_at DESC LIMIT ?`).all(...w.params, limit);
      const parse = text => { try { return text ? JSON.parse(text) : null; } catch { return null; } };
      return rows.map(r => ({ ...r, experiments: parse(r.experiments), players: playersOf.all(r.id).map(p => ({ ...p, stranded: !!p.stranded })) }));
    },
    getPlayerLeaderboard({ difficulty = 'all', site = 'all', limit = 25 } = {}) {
      const w = where({ difficulty, site });
      return db.prepare(`SELECT (SELECT p2.player_name FROM mission_players p2 JOIN missions m2 ON m2.id = p2.mission_id WHERE LOWER(p2.player_name) = LOWER(p.player_name) ORDER BY m2.created_at DESC, p2.id DESC LIMIT 1) AS playerName,
          MAX(p.score) AS bestScore, SUM(p.score) AS totalScore, COUNT(*) AS missions, MAX(m.created_at) AS lastPlayedAt,
          (SELECT p3.grade FROM mission_players p3 WHERE LOWER(p3.player_name) = LOWER(p.player_name) ORDER BY p3.score DESC, p3.id DESC LIMIT 1) AS bestGrade,
          (SELECT p4.seat FROM mission_players p4 JOIN missions m4 ON m4.id = p4.mission_id WHERE LOWER(p4.player_name) = LOWER(p.player_name) ORDER BY m4.created_at DESC, p4.id DESC LIMIT 1) AS lastSeat
        FROM mission_players p JOIN missions m ON m.id = p.mission_id ${w.sql}
        GROUP BY LOWER(p.player_name) ORDER BY bestScore DESC, missions DESC, lastPlayedAt DESC LIMIT ?`).all(...w.params, limit);
    },
    stats() { return { missionsRecorded: db.prepare('SELECT COUNT(*) AS n FROM missions').get().n }; },
    close() { db.close(); },
  };
}
