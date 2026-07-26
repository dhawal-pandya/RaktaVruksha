/**
 * Put every era back on its own level, after add-lineages.ts has deepened the
 * trunks.
 *
 * Splicing the full Puranic king-lists in stretched the solar line from 11 rows
 * to 86 and left every clan that only had a `genAnchor` sitting where it used to
 * sit, thirty or forty rows above its own contemporaries. This script rewrites
 * that anchor table against two calibration points the texts themselves give:
 *
 *   Brihadbala was killed by Abhimanyu, so they share a row. Brihadbala's row is
 *   derived, not chosen: it is Ikshvaku plus the 86 kings SB 9.6-9.12 names. That
 *   single fact is what decides where Kurukshetra falls in this whole tree.
 *
 *   Rama's row, likewise derived, decides where the Ramayana falls. It lands 28
 *   rows above the war, which is exactly the 28 kings SB 9.12 counts from Kusha
 *   to Brihadbala.
 *
 * Everything else is expressed as an offset from one of those two. `genAnchor` is
 * a FLOOR and the leveler only ever pushes downward, so anchoring a clan head to
 * its era can never disturb the ancestors it now hangs from: the graft simply
 * renders as a long ray, which is the honest picture when a branch dynasty's
 * king-list is a tenth the length of the solar one over the same span.
 *
 * Idempotent, and safe to re-run after add-lineages.ts.
 *
 * Run: npm run reanchor-eras
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { FamilyDataV2, PersonRecord, UnionRecord } from "../src/core/types";
import { validateData } from "../src/core/validate";
import { computeGenerations } from "../src/core/generations";

const here = dirname(fileURLToPath(import.meta.url));
const PATH = resolve(here, "../public/family-data.hiranyagarbha.json");
const data: FamilyDataV2 = JSON.parse(readFileSync(PATH, "utf8"));
const STAMP = "2026-07-27T00:00:00.000Z";

const byId = new Map(data.people.map((p) => [p.id, p]));

const rows = (): Map<string, number> =>
  computeGenerations(data.people, data.unions).gen;

const setAnchor = (id: string, row: number): void => {
  const p = byId.get(id);
  if (!p) throw new Error(`reanchor: no person "${id}"`);
  if (p.genAnchor === row) return;
  p.genAnchor = row;
  p.updatedAt = STAMP;
};

const clearAnchor = (id: string): void => {
  const p = byId.get(id);
  if (!p || p.genAnchor === undefined) return;
  delete p.genAnchor;
  p.updatedAt = STAMP;
};

const unionsById = new Map(data.unions.map((u) => [u.id, u]));
const setGap = (id: string, gap: number): void => {
  const u = unionsById.get(id);
  if (!u) throw new Error(`reanchor: no union "${id}"`);
  if (gap > 1) u.childGap = gap;
  else delete u.childGap;
  u.updatedAt = STAMP;
};

/**
 * Drop a lineage to the row its era needs, by widening links rather than by
 * anchoring its end.
 *
 * An anchor is the right tool for a clan whose ancestry the texts never give:
 * it floats, and the floor says where. It is the WRONG tool halfway down a
 * documented trunk, because the anchored king keeps his real father, and the
 * edge between them stretches into a forty-row line that reads as forty missing
 * generations between a named father and his named son.
 *
 * The Paurava and Yadava lists are simply shorter than the Aikshvaka one over
 * the same span, forty-odd generations shorter. That shortfall is real, and it
 * belongs on the stretches where the Purana itself gives nothing but names in a
 * row. So it is spread evenly across those links, and every father below them
 * stands one row above his son, as he should.
 */
const padTo = (target: string, row: number, edges: string[], why: string): void => {
  const deficit = row - rows().get(target)!;
  if (deficit <= 0) return;
  const n = edges.length;
  edges.forEach((id, i) =>
    setGap(id, 1 + Math.floor(deficit / n) + (i < deficit % n ? 1 : 0)),
  );
  console.log(`  ${why}: ${target} down ${deficit} rows across ${n} link(s)`);
};

// ---------------------------------------------------------------------------
// The two calibration rows, read off the tree rather than chosen.
// ---------------------------------------------------------------------------

// Anchors from the old, shallow tree would fight the measurement, so drop every
// one of them first and read the trunks clean.
const previouslyAnchored = data.people.filter((p) => p.genAnchor !== undefined).map((p) => p.id);
for (const id of previouslyAnchored) clearAnchor(id);

const bare = rows();
const RAMA = bare.get("Rama")!;
const WAR = bare.get("Brihadbala")!; // the Kurukshetra generation
console.log(`measured: Rama at ${RAMA}, Kurukshetra at ${WAR} (${WAR - RAMA} rows apart)`);

// Two generations fought at Kurukshetra. Brihadbala fell to Abhimanyu, so WAR is
// the younger of them; the men who led the war stand one row above.
/** Arjuna, Krishna, Duryodhana, Karna, Bhima. */
const FIGHTERS = WAR - 1;
/** Their fathers: Pandu, Dhritarashtra, Vasudeva, Drupada, Subala, Virata. */
const ELDERS = WAR - 2;
/** Rama's parents: Dasharatha, Janaka, Kaikeyi's father, Romapada. */
const RAMA_ELDERS = RAMA - 1;

// ---------------------------------------------------------------------------
// The trunks and branches, dropped to meet the solar one
// ---------------------------------------------------------------------------

/**
 * Every stretch that carries era-padding, in the order it must be applied.
 * `row` is a thunk because a few targets are measured against another lineage
 * rather than against a fixed offset.
 *
 * Order matters: a shared stretch is always measured on its DEEPEST branch, and
 * each shallower branch then makes up the difference on a link of its own. That
 * is why Drupada comes before Pratipa and Ahuka before Shurasena.
 */
const PADS: { why: string; target: string; row: () => number; edges: string[] }[] = [
  {
    // SB 9.20.1-3 walks from Puru to Raudrashva as a bare succession of names
    // with not one story attached, which is exactly where the Paurava list has
    // thinned. Widening those six links carries Bharata, Ajamidha, Kuru,
    // Panchala and the whole Kuru trunk down together, so that from Bharata
    // onward every row in this tree is a king the Purana actually names. Below
    // Ajamidha the trunk forks and Panchala is the longer branch, so the shared
    // stretch is measured on Drupada.
    why: "the Paurava trunk",
    target: "Drupada",
    row: () => WAR - 2,
    edges: [
      "u_JanamejayaP_Prachinvan",
      "u_Pravira_Manusyu",
      "u_Charupada_Sudyu",
      "u_Bahugava_Samyati",
      "u_Samyati_Ahamyati",
      "u_Ahamyati_Raudrashva",
    ],
  },
  {
    // The Kuru branch is seven kings shorter than the Panchala one: the
    // Mahabharata gives six between Kuru and Pratipa where the Bhagavata gives
    // thirteen.
    why: "the Kuru branch",
    target: "Pratipa",
    row: () => WAR - 5,
    edges: [
      "u_Viduratha_Anashwan",
      "u_Anashwan_ParikshitI",
      "u_ParikshitI_Bhimasena",
      "u_Bhimasena_Pratishravas",
    ],
  },
  {
    // The same for the Yadus, on the stretches of SB 9.23.30-9.24.5 that are
    // pure name-lists. This also carries Vidarbha, and with it Damayanti's house
    // and Rukmini's, down toward their eras. Satvata forks like Ajamidha does,
    // and Andhaka is the deeper side.
    why: "the Yadava trunk",
    target: "Ahuka",
    row: () => WAR - 5,
    edges: [
      "u_kroshtu",
      "u_swahi",
      "u_Prithushrava_DharmaY",
      "u_Vyoma_Jimuta",
      "u_Navaratha_DasharathaY",
      "u_Karambhi_DevarataY",
    ],
  },
  {
    // Vrishni's side of that fork: SB 9.24.12-26 names six kings from Vrishni
    // down to Shura where this tree has one link, so that link carries them.
    why: "Vrishni to Shura",
    target: "Shurasena",
    row: () => WAR - 3,
    edges: ["u_vrishni_to_shurasena"],
  },
  {
    // Nimi's line is likewise a bare list from Udavasu to Svarnaroma.
    why: "Videha",
    target: "Hrasvaroma",
    row: () => RAMA - 2,
    edges: [
      "u_Udavasu_Nandivardhana",
      "u_BrihadrathaV_Mahavirya",
      "u_HaryashvaV_MaruV",
      "u_Kritaratha_Devamidha",
      "u_Mahadhriti_Kritirata",
    ],
  },
  {
    // Turvasu's line is six kings long and ends at Marutta, who adopted
    // Dushyanta out of the Puru line thirty rows further down.
    why: "Turvasu, to Dushyanta's adoptive father",
    target: "Marutta",
    row: () => rows().get("Dushyanta")! - 1,
    edges: ["u_Turvasu_VahniT", "u_Bharga_BhanumanT", "u_Tribhanu_Karandhama"],
  },

  // Below here, nothing is done to the branch dynasties' own king-lists, and
  // that is deliberate. Yayati's four younger sons and their immediate heirs,
  // Ushinara and Shibi, Kshatravriddha and Kashi, Anu and Titikshu, belong high
  // in the tree where their genealogy puts them, and Madhavi's four marriages
  // (MBh 5.113-115) weld four of those houses to a single row, which is right:
  // they were contemporaries. Each list then simply runs out, long before its
  // kingdom next appears in a story. That silence is what the final link
  // carries, so the named kings stay put and the gap sits where the texts have
  // nothing to say.
  //
  // The Kaushika line is left alone for a further reason. Shakuntala is
  // Vishvamitra's daughter and Dushyanta's queen, the same shape of problem as
  // Marutta above, but Vishvamitra is welded through Madhavi to Divodasa of
  // Kashi, to Ushinara and to Haryashva of Ayodhya, and through the Bhargavas to
  // Richika and Parashurama. Dropping him drags all of it, and in trial it moved
  // Rama himself eight rows. He stays where Gadhi puts him: one of the sages who
  // simply walk through every age.
  { why: "Anga, to Dasharatha's friend", target: "Romapada", row: () => RAMA - 1, edges: ["u_Anga_Khalapana"] },
  {
    // Romapada to Karna's foster father is nine named kings across twenty-seven rows.
    why: "Anga, to Karna's foster father",
    target: "Adhiratha",
    row: () => WAR - 2,
    edges: [
      "u_Chaturanga_Prithulaksha",
      "u_BrihadrathaAnga_Brihanmana",
      "u_VijayaAnga_DhritiAnga",
      "u_Satkarma_Adhiratha",
    ],
  },
  { why: "Kashi, to Amba's father", target: "Kashiraja", row: () => WAR - 4, edges: ["u_Alarka_Kashiraja"] },
  { why: "Kekaya, to Kaikeyi's father", target: "Ashvapati", row: () => RAMA - 2, edges: ["u_KekayaKing_Ashvapati"] },
  { why: "Madra, to Madri's father", target: "Dyutimanta", row: () => WAR - 3, edges: ["u_MadraKing_Dyutimanta"] },
  { why: "Druhyu, whose list stops at Gandhara", target: "Subala", row: () => WAR - 3, edges: ["u_Gandhara_Subala"] },
  { why: "Vidarbha, to Rukmini's father", target: "Bhishmaka", row: () => WAR - 2, edges: ["u_Vidarbha_Bhishmaka"] },
  { why: "Vidarbha, to Damayanti's father", target: "BhimaVidarbha", row: () => RAMA + 9, edges: ["u_Vidarbha_BhimaVidarbha"] },
  { why: "Matsya", target: "Virata", row: () => WAR - 2, edges: ["u_MatsyaKing_Virata"] },
  { why: "Chedi, to Shishupala's father", target: "Damaghosha", row: () => WAR - 2, edges: ["u_Cedipa_Damaghosha"] },
];

// Zero EVERY pad before measuring any of them. Clearing only each pad's own
// edges as it runs would let a previous run's widening of one lineage leak into
// the measurement of another, and the two would trade rows back and forth
// between runs instead of settling.
console.log("padding the trunks and branches:");
for (const p of PADS) for (const e of p.edges) setGap(e, 1);
for (const p of PADS) padTo(p.target, p.row(), p.edges, p.why);

// ---------------------------------------------------------------------------
// The Ramayana era
// ---------------------------------------------------------------------------

// Lanka: Sukesha is four rows above Ravana.
setAnchor("Sukesha", RAMA - 4);
// Kishkindha: the vanara sires are one row above their sons. Panasa, whose
// daughter Ruma married Sugriva, has no ancestry of his own and would otherwise
// sit at the root of the tree.
for (const id of ["Riksharaja", "SushenaR", "Kesari", "Panasa"]) setAnchor(id, RAMA_ELDERS);
// Nala who built the bridge and Nila who led the army have a deva for a father
// and no vanara kin the texts record, so nothing but an anchor holds them in the
// Ramayana at all. Drop it and they sink to the floor of the tree.
for (const id of ["Nala", "Nila"]) setAnchor(id, RAMA);
// Videha: Hrasvaroma fathers Siradhvaja Janaka, who gives Sita to Rama.
setAnchor("Hrasvaroma", RAMA - 2);
// Kekaya: Ashvapati fathers Kaikeyi, who marries Dasharatha.
setAnchor("Ashvapati", RAMA - 2);
// Anga: Romapada is Dasharatha's friend, and takes Shanta from him.
setAnchor("Romapada", RAMA_ELDERS);
// Agastya meets Rama in the Dandaka forest.
setAnchor("Agastya", RAMA_ELDERS);
// Jambavan saw Rama's age and wrestled Krishna in the next one. He is placed in
// the Ramayana, and the long ray to his daughter Jambavati is the whole point.
setAnchor("Jambavan", RAMA_ELDERS);

// Vishvamitra is one of the sages who walk through every age: son of Gadhi high
// in the Kaushika line, priest at Harishchandra's sacrifice thirteen rows below,
// and Rama's escort thirty rows below that. He stays where his father puts him,
// but the boy he saved and adopted belongs to the sacrifice, so Ajigarta's family
// is anchored to Rohita, who bought him.
const solar = rows();
setAnchor("Ajigarta", solar.get("Rohita")! - 1);
setAnchor("Shunahshepha", solar.get("Rohita")!);

// ---------------------------------------------------------------------------
// Between the epics
// ---------------------------------------------------------------------------

// Nala and Damayanti keep the slot they have always had in this tree, roughly a
// third of the way from the Ramayana to the war. Rituparna, Nala's friend, sits
// in the solar line where the Purana puts him, fourteen rows above Rama; the
// contradiction is real, old, and recorded in docs/PURANIC_LINEAGES.md.
const NALA = RAMA + Math.round((WAR - RAMA) * 0.35);
setAnchor("NalaNishadha", NALA);
setAnchor("Damayanti", NALA);
setAnchor("BhimaVidarbha", NALA - 1);
setAnchor("Virasena", NALA - 1); // Nala's father, with no ancestry of his own

// ---------------------------------------------------------------------------
// Kurukshetra
// ---------------------------------------------------------------------------

// The Kuru trunk. Shantanu four rows above Abhimanyu puts Bhishma and
// Vichitravirya at WAR-3, Dhritarashtra and Pandu at ELDERS, their sons on the
// FIGHTERS row, and Abhimanyu level with Brihadbala.
setAnchor("Shantanu", WAR - 4);
// Kashi: Ambika and Ambalika marry Vichitravirya, and Amba faces Bhishma.
setAnchor("Kashiraja", WAR - 4);
// Kripa and Kripi are of Bhishma's court; Ashwatthama fights beside Duryodhana.
setAnchor("Sharadvan", ELDERS - 1);

// The Yadavas. Shurasena fathers both Vasudeva and Kunti, so Krishna and the
// Pandavas land on the same row.
setAnchor("Shurasena", ELDERS - 1);
setAnchor("Ahuka", ELDERS - 3); // Devaka and Ugrasena, then Devaki and Kamsa
setAnchor("Kuntibhoja", ELDERS - 1); // raises Kunti
setAnchor("Banasura", WAR); // Usha marries Aniruddha, Krishna's grandson

// Houses that marry into the ELDERS generation stand a row higher again: Madri
// weds Pandu and Gandhari weds Dhritarashtra, so Shalya and Shakuni are uncles
// to the war, not fighters in it.
setAnchor("Dyutimanta", ELDERS - 1);
setAnchor("Subala", ELDERS - 1);

// Every house that sends someone to the war, one row above the one it sends.
for (const id of [
  "Drupada", // Draupadi and Dhrishtadyumna
  "Adhiratha", // raises Karna
  "Virata", // Sweta, Sankha, and Uttara who marries Abhimanyu
  "Sini", // Satyaki
  "Hridika", // Kritavarma
  "Satrajit", // Satyabhama marries Krishna
  "Bhishmaka", // Rukmini marries Krishna
  "Raivata", // Revati marries Balarama, an age after her own
  "Hiranyadhanus", // Ekalavya
  "Kauravya", // Ulupi
  "Chitravahana", // Chitrangada of Manipura
  "Narakasura", // Bhagadatta
  "Brihadratha", // Jarasandha
  "Gargya", // Kalayavana, whom Muchukunda burns
  "YavanaRaja",
] as const) setAnchor(id, ELDERS);

setAnchor("Sanjaya", FIGHTERS); // the suta who narrates the war as it happens
// Nanda of Gokula has no recorded ancestry, so without a floor he would sit at
// the root of the whole tree with a ninety-row ray down to his foster son.
setAnchor("NandaGokula", ELDERS);

// Parashurama and Kartavirya Arjuna have to meet. The Haihaya king-list runs
// deeper than the Bhargava one, so it is the sage who is anchored to the king,
// not the other way round: a genAnchor is a floor and can only push down.
const measured = rows();
setAnchor("Jamadagni", measured.get("KartaviryaArjuna")! - 1);

// ---------------------------------------------------------------------------
// Report, verify, write
// ---------------------------------------------------------------------------

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
  ["Mandhata", "Muchukunda", "father and son"],
  ["Rohita", "Shunahshepha", "bought as the sacrifice in his place"],
  ["Mandhata", "Bindumati", "marriage"],
  ["Mandhata", "Saubhari", "his fifty daughters"],
];

const final = rows();
const off = CONTEMPORARIES.filter(([a, b]) => {
  const x = final.get(a), y = final.get(b);
  return x === undefined || y === undefined || Math.abs(x - y) > 1;
});

const all = [...final.values()];
console.log(
  `rows ${Math.min(...all)}..${Math.max(...all)} | Rama ${final.get("Rama")} | ` +
    `Kurukshetra ${final.get("Brihadbala")} | Nala ${final.get("NalaNishadha")}`,
);
console.log(`contemporaries: ${CONTEMPORARIES.length - off.length}/${CONTEMPORARIES.length} level`);
for (const [a, b, why] of off) {
  console.log(`  OFF  ${a} ${final.get(a)} vs ${b} ${final.get(b)}  (${why})`);
}

// Anchors are cleared wholesale above and only the named ones are restored, so a
// lineage that floats free and is NOT named here silently sinks: the leveler
// bottom-aligns an unanchored component against the deepest point in the data,
// which for a two-orb island means the very floor of the tree. That is exactly
// how Nala and Nila, who have a deva for a father and no vanara kin, ended up
// ninety rows below Rama. Catch it rather than trusting the list to stay complete.
const stranded: string[] = [];
{
  const parentOf = new Set<string>();
  for (const u of data.unions) {
    for (const c of [...u.children, ...(u.adoptedChildren ?? [])]) parentOf.add(c);
  }
  const deepest = Math.max(...final.values());
  for (const p of data.people) {
    if (p.genAnchor !== undefined || parentOf.has(p.id) || p.divine) continue;
    // A parentless person is a root at row 0 unless a marriage carries them down.
    // Sitting at the very bottom instead means their whole island was bottom-aligned.
    if ((final.get(p.id) ?? 0) >= deepest - 1) stranded.push(p.id);
  }
}
if (stranded.length) {
  console.log(`${stranded.length} stranded at the floor of the tree, needing an era anchor:`);
  for (const id of stranded) console.log(`  ${id}`);
}

const { errors } = validateData(data);
if (errors.length) {
  console.error(`${errors.length} validation errors, nothing written:`);
  for (const e of errors.slice(0, 20)) console.error("  " + e);
  process.exit(1);
}
data.meta.exportedAt = STAMP;
writeFileSync(PATH, JSON.stringify(data, null, 2) + "\n");
console.log(`wrote ${data.people.length} people, ${data.unions.length} unions`);

// Keep the type imports honest.
export type _ = [PersonRecord, UnionRecord];
