import { closeDb } from "../src/db/database.ts";
import { investigationRepo } from "../src/db/repositories/investigationRepository.ts";
import { indexHistoricalInvestigation } from "../src/ai/graphSimilarity/service.ts";

let indexed = 0;
let skipped = 0;
for (const investigation of investigationRepo.getAllGlobal(10_000)) {
  try {
    if (indexHistoricalInvestigation(investigation)) indexed++;
    else skipped++;
  } catch (error) {
    skipped++;
    console.error(`Failed to backfill ${investigation.id}:`, error);
  }
}
console.log(JSON.stringify({ indexed, skipped }, null, 2));
closeDb();
