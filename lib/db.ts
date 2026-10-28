import fs from "fs";
import path from "path";
import { DatabaseSync } from "node:sqlite";
import type { Candidate, CandidatePage, Stage } from "./stages";

const SEED: Array<[string, string, Stage]> = [
  ["Amaka Obi", "Frontend Engineer", "Sourced"],
  ["Chioma Adeyemi", "Backend Engineer", "Interview"],
  ["Daniel Brooks", "Product Designer", "Screening"],
  ["Fatima Bello", "Support Lead", "Sourced"],
  ["Helen Cho", "Account Executive", "Hired"],
  ["Luis Ortega", "Data Analyst", "Screening"],
  ["Noah Williams", "Engineering Manager", "Interview"],
  ["Priya Shah", "Product Manager", "Hired"],
];

export const EXTRA: Array<[string, string, Stage]> = [
  ["Ifeoma Nwosu", "QA Engineer", "Sourced"],
  ["Marcus Reid", "DevOps Engineer", "Screening"],
  ["Sara Mensah", "Product Designer", "Interview"],
  ["Owen Blake", "Data Engineer", "Hired"],
];

function createSchema(db: DatabaseSync) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS candidates (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL CHECK (length(trim(name)) > 0),
      role TEXT NOT NULL CHECK (length(trim(role)) > 0),
      stage TEXT NOT NULL CHECK (stage IN ('Sourced', 'Screening', 'Interview', 'Hired'))
    )
  `);
} 

// sqlite hands back a null-prototype row. copy it before sending json.
function toCandidate(row: Candidate): Candidate {
  return {
    id: Number(row.id),
    name: String(row.name),
    role: String(row.role),
    stage: row.stage,
  };
}

export function openDatabase(filename: string) {
  if (filename !== ":memory:") {
    fs.mkdirSync(path.dirname(filename), { recursive: true });
  }

  const db = new DatabaseSync(filename);
  if (filename !== ":memory:") db.exec("PRAGMA journal_mode = WAL");
  createSchema(db);

  const count = db.prepare("SELECT COUNT(*) AS n FROM candidates").get() as { n: number };
  if (count.n === 0) {
    const insert = db.prepare(
      "INSERT INTO candidates (name, role, stage) VALUES (?, ?, ?)",
    );
    for (const [name, role, stage] of SEED) {
      insert.run(name, role, stage);
    }
  }

  return db;
}

// dev reloads this file. keep the same connection or sqlite complains.
const globalForDb = globalThis as unknown as { pipelineDb?: DatabaseSync };

export function getDb() {
  if (!globalForDb.pipelineDb) {
    globalForDb.pipelineDb = openDatabase(path.join(process.cwd(), "data", "pipeline.db"));
  }
  return globalForDb.pipelineDb;
}

function likePattern(q: string) {
  return `%${q.replace(/[\\%_]/g, (ch) => `\\${ch}`)}%`;
}

export function listCandidates(
  db: DatabaseSync,
  query: { q: string; stage: string; limit: number; offset: number },
): CandidatePage {
  const q = query.q.trim();
  const where: string[] = [];
  const params: string[] = [];

  if (q) {
    where.push("name LIKE ? ESCAPE '\\'");
    params.push(likePattern(q));
  }
  if (query.stage) {
    where.push("stage = ?");
    params.push(query.stage);
  }

  const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const total = db.prepare(`SELECT COUNT(*) AS n FROM candidates ${clause}`).get(...params) as {
    n: number;
  };
  const rows = db
    .prepare(
      `SELECT id, name, role, stage FROM candidates ${clause} ORDER BY name COLLATE NOCASE LIMIT ? OFFSET ?`,
    )
    .all(...params, query.limit, query.offset) as Candidate[];

  const countRows = db
    .prepare("SELECT stage, COUNT(*) AS n FROM candidates GROUP BY stage")
    .all() as Array<{ stage: Stage; n: number }>;
  const counts: Record<Stage, number> = {
    Sourced: 0,
    Screening: 0,
    Interview: 0,
    Hired: 0,
  };
  for (const row of countRows) counts[row.stage] = Number(row.n);

  return {
    candidates: rows.map(toCandidate),
    total: Number(total.n),
    counts,
  };
}

export function addCandidate(db: DatabaseSync, name: string, role: string, stage: Stage) {
  const row = db
    .prepare(
      "INSERT INTO candidates (name, role, stage) VALUES (?, ?, ?) RETURNING id, name, role, stage",
    )
    .get(name.trim(), role.trim(), stage) as Candidate;

  return toCandidate(row);
}

export function addExtraCandidates(db: DatabaseSync) {
  const names = db.prepare("SELECT name FROM candidates").all() as Array<{ name: string }>;
  const existing = new Set(names.map((row) => row.name.toLowerCase()));
  const added: Candidate[] = [];

  for (const [name, role, stage] of EXTRA) {
    if (existing.has(name.toLowerCase())) continue;
    added.push(addCandidate(db, name, role, stage));
  }

  return added;
}

export function updateCandidate(
  db: DatabaseSync,
  id: number,
  input: { name?: string; role?: string; stage?: Stage },
) {
  const current = db
    .prepare("SELECT id, name, role, stage FROM candidates WHERE id = ?")
    .get(id) as Candidate | undefined;
  if (!current) return null;

  const name = input.name !== undefined ? input.name.trim() : String(current.name);
  const role = input.role !== undefined ? input.role.trim() : String(current.role);
  const stage = input.stage ?? current.stage;
  const row = db
    .prepare(
      "UPDATE candidates SET name = ?, role = ?, stage = ? WHERE id = ? RETURNING id, name, role, stage",
    )
    .get(name, role, stage, id) as Candidate | undefined;

  return row ? toCandidate(row) : null;
}

export function updateCandidateStage(db: DatabaseSync, id: number, stage: Stage) {
  return updateCandidate(db, id, { stage });
}
