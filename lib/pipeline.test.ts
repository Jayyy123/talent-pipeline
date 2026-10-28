import assert from "node:assert/strict";
import fs from "fs";
import os from "os";
import path from "path";
import test from "node:test";
import { addCandidate, addExtraCandidates, listCandidates, openDatabase, updateCandidate, updateCandidateStage } from "./db.ts";
import { isStage } from "./stages.ts";

const all = { q: "", stage: "", limit: 50, offset: 0 };

test("name search ignores case and does not treat % as a wildcard", () => {
  const db = openDatabase(":memory:");
  const found = listCandidates(db, { q: "  CHIOMA ", stage: "", limit: 5, offset: 0 });
  assert.deepEqual(found.candidates.map((c) => c.name), ["Chioma Adeyemi"]);

  const both = listCandidates(db, { q: "a", stage: "Screening", limit: 10, offset: 0 });
  assert.equal(both.total, both.candidates.length);
  assert.ok(both.candidates.every((c) => c.stage === "Screening"));

  assert.equal(listCandidates(db, { q: "%", stage: "", limit: 20, offset: 0 }).total, 0);
});

test("pages come from the database, not the whole table", () => {
  const db = openDatabase(":memory:");
  const first = listCandidates(db, { q: "", stage: "Hired", limit: 1, offset: 0 });
  const second = listCandidates(db, { q: "", stage: "Hired", limit: 1, offset: 1 });

  assert.equal(first.total, 2);
  assert.equal(first.candidates.length, 1);
  assert.equal(second.candidates.length, 1);
  assert.notEqual(first.candidates[0].id, second.candidates[0].id);
  assert.equal(first.counts.Hired, 2);
});

test("blank query returns everyone", () => {
  const db = openDatabase(":memory:");
  assert.equal(listCandidates(db, all).total, 8);
});

test("only the four hiring stages are valid", () => {
  assert.equal(isStage("Interview"), true);
  assert.equal(isStage("interview"), false);
  assert.equal(isStage("Offer"), false);
});

test("stage updates stick and a missing candidate returns null", () => {
  const file = path.join(os.tmpdir(), `pipeline-${process.pid}.db`);
  fs.rmSync(file, { force: true });

  const db = openDatabase(file);
  const seeded = listCandidates(db, all).candidates;
  assert.equal(seeded.length, 8);

  const updated = updateCandidateStage(db, seeded[0].id, "Hired");
  assert.equal(updated?.stage, "Hired");
  assert.equal(
    listCandidates(db, all).candidates.find((c) => c.id === seeded[0].id)?.stage,
    "Hired",
  );
  assert.equal(updateCandidateStage(db, 9999, "Sourced"), null);

  const again = openDatabase(file);
  assert.equal(listCandidates(again, all).total, 8);

  fs.rmSync(file, { force: true });
});

test("extra seed skips names that are already there", () => {
  const db = openDatabase(":memory:");
  const first = addExtraCandidates(db);
  assert.equal(first.length, 4);
  assert.equal(addExtraCandidates(db).length, 0);
  assert.equal(listCandidates(db, all).total, 12);

  const added = addCandidate(db, "  Ada Okonkwo  ", "Recruiter", "Sourced");
  assert.equal(added.name, "Ada Okonkwo");
  assert.equal(added.stage, "Sourced");
});

test("name and role can change without losing the stage", () => {
  const db = openDatabase(":memory:");
  const first = listCandidates(db, all).candidates[0];
  const updated = updateCandidate(db, first.id, { name: "New Name", role: "New Role" });
  assert.equal(updated?.name, "New Name");
  assert.equal(updated?.role, "New Role");
  assert.equal(updated?.stage, first.stage);
  assert.equal(updateCandidateStage(db, first.id, "Hired")?.stage, "Hired");
});
