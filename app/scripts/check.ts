/**
 * Read every dataset from its shard directory and report anything wrong with it.
 *
 * This is the one script that survived the move to hand-edited shards, because
 * it is the only one that never wrote anything. It replaces what the retired
 * generators used to assert on their way past:
 *
 *   - structural integrity, from core/shards.ts (an id defined twice, a chain
 *     naming somebody with no record, a reference to an id no file defines)
 *   - the app's own validateData
 *   - the era checklist that reanchor-eras.ts used to print: pairs the texts put
 *     in the same room, which must still land within a row of each other
 *   - namesakes, so a new addition can be checked against the names already used
 *
 * A checker owns no data, so it cannot drift from the files the way the old
 * doc-and-script pair did.
 *
 * Run: npm run check
 */
import { readFileSync, readdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { MANIFEST, checkShards, expand } from "../src/core/shards";
import { buildDataset } from "../src/core/dataset";
import { validateData } from "../src/core/validate";
import type { FamilyDataV2 } from "../src/core/types";

const here = dirname(fileURLToPath(import.meta.url));
const DATA = resolve(here, "../public/data");
const DATASETS = ["family", "ramayan", "mahabharat", "hiranyagarbha"];

const readShards = (dir: string): Map<string, string> => {
  const files = new Map<string, string>();
  for (const name of readdirSync(resolve(DATA, dir))) {
    if (name.endsWith(".json"))
      files.set(name, readFileSync(resolve(DATA, dir, name), "utf8"));
  }
  if (!files.has(MANIFEST)) throw new Error(`${dir}: no ${MANIFEST}`);
  return files;
};

/** Pairs the texts put in the same room. Each must land within a row of the other. */
const CONTEMPORARIES: [string, string, string][] = [
  ["Brihadbala", "Abhimanyu", "Abhimanyu killed him at Kurukshetra"],
  ["Rama", "Ravana", "Lanka"],
  ["Rama", "Sugriva", "Kishkindha"],
  ["Rama", "Hanuman", "Kishkindha"],
  ["Rama", "Sita", "marriage"],
  ["Rama", "Vibhishana", "Lanka"],
  ["Dasharatha", "Janaka", "the four brothers wed the four princesses"],
  ["Dasharatha", "Romapada", "friends; Shanta was given between them"],
  ["Dasharatha", "Ashvapati", "Kaikeyi's father"],
  ["Rama", "Angada", "Kishkindha"],
  ["Rama", "Nala", "who built the bridge"],
  ["Rama", "Nila", "who led the army"],
  ["Rama", "Jambavan", "Kishkindha"],
  ["Hanuman", "Makardhwaja", "father and son"],
  ["Angada", "Makardhwaja", "the next vanara generation"],
  ["Sugriva", "Ruma", "marriage"],
  ["Krishna", "Arjuna", "the Gita"],
  ["Krishna", "Duryodhana", "the embassy"],
  ["Krishna", "Shishupala", "the Rajasuya"],
  ["Krishna", "Jarasandha", "Mathura"],
  ["Krishna", "Kalayavana", "Mathura"],
  ["Krishna", "Rukmini", "marriage"],
  ["Krishna", "Satyabhama", "marriage"],
  ["Krishna", "Jambavati", "marriage"],
  ["Krishna", "Balarama", "brothers"],
  ["Pradyumna", "Usha", "Aniruddha's wife"],
  ["Duryodhana", "Ashwatthama", "the war"],
  ["Duryodhana", "Kritavarma", "the war"],
  ["Yudhishthira", "Karna", "half-brothers"],
  ["Yudhishthira", "Draupadi", "marriage"],
  ["Bhishma", "Drona", "the Kuru court"],
  ["Bhishma", "Kripa", "the Kuru court"],
  ["Bhishma", "Amba", "the abduction"],
  ["Dhritarashtra", "Gandhari", "marriage"],
  ["Pandu", "Madri", "marriage"],
  ["Pandu", "Kunti", "marriage"],
  ["Dhritarashtra", "Shakuni", "brothers-in-law"],
  ["Pandu", "Shalya", "brothers-in-law"],
  ["Arjuna", "Satyaki", "the war"],
  ["Arjuna", "Ekalavya", "Drona's pupils"],
  ["Arjuna", "Ashwatthama", "the war"],
  ["Arjuna", "Bhagadatta", "the war"],
  ["Arjuna", "Uttara", "Virata's court"],
  ["Abhimanyu", "Uttara", "marriage"],
  ["Balarama", "Revati", "marriage"],
  ["Parashurama", "KartaviryaArjuna", "the stolen cow"],
  ["NalaNishadha", "Damayanti", "marriage"],
  ["Satyavan", "Savitri", "marriage"],
  ["AshvapatiMadra", "Savitri", "father and daughter"],
  ["Dyumatsena", "Satyavan", "father and son"],
  ["Mandhata", "Muchukunda", "father and son"],
  ["Rohita", "Shunahshepha", "bought as the sacrifice in his place"],
  ["Mandhata", "Bindumati", "marriage"],
  ["Mandhata", "Saubhari", "his fifty daughters"],
  ["Astika", "Janamejaya", "stopped the snake sacrifice"],
];

let failed = false;
const fail = (msg: string) => { failed = true; console.log(`  ✗ ${msg}`); };

for (const dir of DATASETS) {
  console.log(`\n${dir}`);
  const files = readShards(dir);
  const orphans = [...files.keys()].filter((f) => f !== MANIFEST);
  const listed = new Set(
    (JSON.parse(files.get(MANIFEST)!) as { shards: string[] }).shards,
  );
  for (const f of orphans)
    if (!listed.has(f)) fail(`${f} is on disk but not in ${MANIFEST}`);

  for (const e of checkShards(files)) fail(e);

  let raw: FamilyDataV2;
  try {
    raw = expand(files);
  } catch (e) {
    fail(String(e));
    continue;
  }
  const v = validateData(raw);
  for (const e of v.errors) fail(e);

  const ds = buildDataset(raw);
  const rows = Math.max(...ds.generations.values()) + 1;
  console.log(
    `  ${listed.size} files · ${raw.people.length} people · ${raw.unions.length} unions · ` +
      `${Object.keys(raw.families).length} families · ${rows} rows` +
      (v.warnings.length ? ` · ${v.warnings.length} warnings` : ""),
  );

  // Namesakes: the tree is full of them (PrithuI, ChandraI, MaruV), so this is
  // the list to check a new name against before adding it.
  const byName = new Map<string, string[]>();
  for (const p of raw.people) {
    const key = p.firstName.replace(/\s*\(.*\)$/, "").trim().toLowerCase();
    const arr = byName.get(key);
    if (arr) arr.push(p.id);
    else byName.set(key, [p.id]);
  }
  const shared = [...byName.values()].filter((ids) => ids.length > 1);
  if (shared.length)
    console.log(`  ${shared.length} shared names (${shared.reduce((n, i) => n + i.length, 0)} people)`);

  // The era checklist, only where both figures exist in this dataset.
  const off = CONTEMPORARIES.filter(([a, b]) => {
    const [x, y] = [ds.generations.get(a), ds.generations.get(b)];
    return x !== undefined && y !== undefined && Math.abs(x - y) > 1;
  });
  const known = CONTEMPORARIES.filter(
    ([a, b]) => ds.generations.has(a) && ds.generations.has(b),
  );
  if (known.length)
    console.log(`  ${known.length - off.length}/${known.length} era pairs within a row`);
  for (const [a, b, why] of off)
    fail(`${a} and ${b} should share a row (${why}): rows ${ds.generations.get(a)} and ${ds.generations.get(b)}`);
}

console.log(failed ? "\nFAILED" : "\nok");
process.exit(failed ? 1 : 0);
