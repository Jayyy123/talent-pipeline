import { addExtraCandidates, getDb } from "../lib/db.ts";

const added = addExtraCandidates(getDb());

if (added.length === 0) {
  console.log("Those people are already in the list.");
} else {
  console.log(`Added ${added.length}.`);
  for (const candidate of added) {
    console.log(`- ${candidate.name}, ${candidate.role}, ${candidate.stage}`);
  }
}
