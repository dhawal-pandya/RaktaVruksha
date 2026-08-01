/**
 * Second splice pass: additions found after docs/PURANIC_LINEAGES.md's first
 * pass, documented in Part X there. Same discipline as add-lineages.ts — this
 * is its executable twin for the newer material, kept as a separate file so
 * the original 1099-person pass stays a historical record on its own.
 *
 * Six pieces. Four are Bhagavata-sourced; Suvarchala is not, and is added
 * anyway, on request, with that noted in her record; Savitri and Satyavan
 * are Mahabharata, not Bhagavata either:
 *   1. The missing two of Brahma's nine mind-born sages (the sage Kratu did
 *      not exist — "Kratu" was already taken by a son of Krishna and
 *      Jambavati, so the sage is `KratuRishi` here; Pulaha and Atharva did
 *      not exist at all).
 *   2. Kardama and Devahuti, and eight of their nine daughters married to
 *      eight of the nine sages (SB 3.24) — the single highest-value graft
 *      found in the second pass, since two of those wives (Anasuya,
 *      Arundhati) were already in the tree with no parents, and it
 *      promotes Kapila from a suspended avatar to a connected one (his own
 *      notes already named Kardama and Devahuti as his parents; the edge
 *      just never existed). Two more daughters' names were already taken by
 *      unrelated people (Shraddha is already Manu's wife; Shanti is already
 *      a son of Krishna and Kalindi), so those two get realm-suffixed ids,
 *      matching the tree's existing namesake convention (DivodasaKashi
 *      beside Divodasa). Kardama himself is given a father, Pulaha (Vishnu
 *      Purana 1.10), on request, over the Bhagavata's own "born of Brahma's
 *      shadow" reading — enforcing the tree's hard rule that no one shares
 *      Brahma and Saraswati's row. The ninth daughter, Gati, is left out:
 *      SB 3.24.18 marries her to Pulaha, which this tree's Pulaha cannot
 *      take without marrying his own son's daughter.
 *   3. Rati's second marriage: Pradyumna is already noted as Kamadeva
 *      reborn, and Rati is already Kamadeva's wife with no children — this
 *      adds the second union (SB 10.55) that makes both notes cohere: she
 *      raised the reborn child as "Mayavati" then married him once grown.
 *   4. Mrikandu, Bhrigu's son, and his son Markandeya, who saw the infant
 *      Vishnu on the banyan leaf during pralaya (SB 12.8-10).
 *   4b. Savitri and Satyavan (MBh 3.277-283), told to Yudhishthira in the
 *      Vana Parva exactly as the Nalopakhyana is, and just as absent from
 *      the tree until now. Ashvapati of Madra is kept separate from the
 *      tree's own Madra king-list (Dyutimanta), since nothing in the text
 *      identifies the two; the whole family is anchored in
 *      reanchor-eras.ts, beside Nala and Damayanti.
 *   5. Suvarchala, Surya's daughter, married to Hanuman as guru-dakshina —
 *      Parashara Samhita, a Telangana temple tradition, not the Bhagavata.
 *
 * Idempotent: people and unions that already exist are left alone.
 *
 * Run: npm run add-more-lineages
 * Then: npm run reanchor-eras (safe/idempotent; nothing here needs new eras)
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { FamilyDataV2, Gender, PersonRecord, UnionRecord } from "../src/core/types";
import { validateData } from "../src/core/validate";

const here = dirname(fileURLToPath(import.meta.url));
const PATH = resolve(here, "../public/family-data.hiranyagarbha.json");
const data: FamilyDataV2 = JSON.parse(readFileSync(PATH, "utf8"));
const STAMP = "2026-08-01T00:00:00.000Z";

const peopleById = new Map(data.people.map((p) => [p.id, p]));
const unionsById = new Map(data.unions.map((u) => [u.id, u]));
const created = new Set<string>();
let addedPeople = 0;
let addedUnions = 0;

interface PersonSpec {
  name?: string;
  family?: string | null;
  gender?: Gender;
  note?: string;
  /**
   * Era placement for someone the texts give no ancestry for. Say who they
   * share a scene with, not what row that is:
   *
   *   anchor: { beside: "Janamejaya" }              // same row
   *   anchor: { beside: "Sagara", offset: -1 }      // one row above
   *
   * This is a RELATIVE anchor, resolved when the file loads. It never needs
   * recomputing when the tree deepens, and -- unlike the old numeric form --
   * `reanchor-eras.ts` leaves it alone instead of clearing it, so a person
   * added here is placed once and stays placed. Prefer it to a bare row.
   */
  anchor?: { beside: string; offset?: number };
}

const collisions: string[] = [];

// Every id this script has ever created, across all runs — checked instead of
// `updatedAt === STAMP`, because a later script in the pipeline (reanchor-eras)
// legitimately rewrites that field with its own stamp when an anchor changes,
// which would otherwise make a second, idempotent run of this script report
// its own earlier work as a collision.
const OWNED_IDS = new Set([
  "KratuRishi", "Pulaha", "Atharva",
  "Kardama", "Devahuti", "Kala", "ShraddhaAngirasa", "Havirbhu",
  "Kriya", "Khyati", "ShantiAtharva",
  "Mrikandu", "Markandeya",
  "AshvapatiMadra", "Savitri", "Satyavan", "Dyumatsena",
  "Suvarchala",
  "JaratkaruSage", "JaratkaruNagi", "Astika",
]);

const person = (id: string, spec: PersonSpec = {}): string => {
  const existing = peopleById.get(id);
  if (existing) {
    if (!created.has(id) && existing.updatedAt !== STAMP && !OWNED_IDS.has(id)) {
      collisions.push(id);
    }
    return id;
  }
  created.add(id);
  const p: PersonRecord = {
    id,
    firstName: spec.name ?? id,
    lastName: "",
    gender: spec.gender ?? "male",
    alive: true,
    birthFamilyId: spec.family === undefined ? null : spec.family,
    updatedAt: STAMP,
    ...(spec.note ? { notes: spec.note } : {}),
    ...(spec.anchor
      ? { genAnchor: { relativeTo: spec.anchor.beside, offset: spec.anchor.offset ?? 0 } }
      : {}),
  };
  data.people.push(p);
  peopleById.set(id, p);
  addedPeople++;
  return id;
};

interface UnionSpec {
  family?: string | null;
  gap?: number;
  note?: string;
  status?: UnionRecord["status"];
}

const union = (id: string, partners: string[], children: string[], spec: UnionSpec = {}): string => {
  const existing = unionsById.get(id);
  if (existing) {
    for (const c of children) if (!existing.children.includes(c)) existing.children.push(c);
    return id;
  }
  const u: UnionRecord = {
    id,
    partners,
    children,
    adoptedChildren: [],
    familyId: spec.family === undefined ? null : spec.family,
    status: spec.status ?? "married",
    ...(spec.gap && spec.gap > 1 ? { childGap: spec.gap } : {}),
    ...(spec.note ? { notes: spec.note } : {}),
    updatedAt: STAMP,
  };
  data.unions.push(u);
  unionsById.set(id, u);
  addedUnions++;
  return id;
};

/** Add a child id to an existing union's children array, in place. */
const addChild = (unionId: string, childId: string): void => {
  const u = unionsById.get(unionId);
  if (!u) throw new Error(`add-more-lineages: no union "${unionId}"`);
  if (!u.children.includes(childId)) {
    u.children.push(childId);
    u.updatedAt = STAMP;
  }
};

const FAM = "familyBrahma";

// --- 1. The missing sages. SB 3.24.13 names the nine as Marichi, Atri,
// Angira, Pulastya, Pulaha, Kratu, Bhrigu, Vasishtha, Atharva; all but the
// last three are already in the tree as Brahma's sons in u_brahma_extra.
person("KratuRishi", {
  name: "Kratu",
  family: FAM,
  note: "Mind-born son of Brahma, one of the Saptarishi; married Kriya, daughter of Kardama and Devahuti. Not the Yadava Kratu, son of Krishna and Jambavati.",
});
person("Pulaha", {
  family: FAM,
  note: "Mind-born son of Brahma, one of the Saptarishi; by his wife Kshama, father of Kardama (among others), and so grandfather of Kapila. Vishnu Purana 1.10.",
});
person("Atharva", {
  family: FAM,
  note: "Mind-born son of Brahma, eponym of the Atharvaveda; married Shanti (here ShantiAtharva), daughter of Kardama and Devahuti.",
});
addChild("u_brahma_extra", "KratuRishi");
addChild("u_brahma_extra", "Pulaha");
addChild("u_brahma_extra", "Atharva");

// --- 2. Kardama and Devahuti, and eight of the nine daughters (SB 3.24,
// cited). No anchor: Kardama is Pulaha's son (Vishnu Purana 1.10, added on
// request over the Bhagavata's own "born of Brahma's shadow" reading, SB
// 3.12), and a real edge from Pulaha places him naturally one row below his
// father — never level with Brahma and Saraswati, who share no row with
// anyone else in the tree by the same hard rule. That edge is also what
// pushed Atri, Vasishtha, Marichi, Pulastya and everyone under them (the
// whole solar line to Rama, the whole Lanka line to Ravana) two rows
// deeper than before: Kardama's daughters marry those already-placed sons
// of Brahma, so their father has to sit above them, and now that "above"
// runs through Pulaha instead of touching Brahma's own row, the sons-in-law
// move to make room. reanchor-eras.ts absorbs this on its own, since Rama
// and Kurukshetra are measured fresh each run rather than hardcoded.
person("Kardama", {
  family: FAM,
  note: "Son of Pulaha and Kshama, per Vishnu Purana 1.10; husband of Devahuti, father of Kapila and of eight daughters married to the other eight of the nine sages. Not Brahma's own son, and not on his row: the tree follows Pulaha's own generation for him, one below Brahma. SB 3.24 for Devahuti, Kapila and the daughters.",
});
person("Devahuti", {
  family: FAM,
  gender: "female",
  note: "Daughter of Svayambhuva Manu; wife of Kardama; mother of Kapila and of eight daughters married to eight of the nine sages. Taught Sankhya by her own son. SB 3.24-33.",
});
person("Kala", {
  family: FAM,
  gender: "female",
  note: "Daughter of Kardama and Devahuti; wife of Marichi. SB 3.24.15.",
});
person("ShraddhaAngirasa", {
  name: "Shraddha",
  family: FAM,
  gender: "female",
  note: "Daughter of Kardama and Devahuti; wife of Angiras, so grandmother of Brihaspati. Not Shraddha, wife of Vaivasvata Manu. SB 3.24.16.",
});
person("Havirbhu", {
  family: FAM,
  gender: "female",
  note: "Daughter of Kardama and Devahuti; wife of Pulastya. SB 3.24.17.",
});
// No Gati: SB 3.24.18 gives her to Pulaha, but Pulaha is now Kardama's
// father in this tree (Vishnu Purana 1.10), which would make him his own
// son's father-in-law. Left out rather than kept and silently contradicted.
person("Kriya", {
  family: FAM,
  gender: "female",
  note: "Daughter of Kardama and Devahuti; wife of Kratu. SB 3.24.19.",
});
person("Khyati", {
  family: FAM,
  gender: "female",
  note: "Daughter of Kardama and Devahuti; second wife of Bhrigu, alongside Puloma. SB 3.24.20.",
});
person("ShantiAtharva", {
  name: "Shanti",
  family: FAM,
  gender: "female",
  note: "Daughter of Kardama and Devahuti; wife of Atharva. Not Shanti, son of Krishna and Kalindi. SB 3.24.22.",
});

union(
  "u_kardama_devahuti",
  ["Kardama", "Devahuti"],
  ["Kala", "Anasuya", "ShraddhaAngirasa", "Havirbhu", "Kriya", "Khyati", "Arundhati", "ShantiAtharva", "Kapila"],
  {
    family: FAM,
    note: "Eight daughters given to eight of the nine sages on Brahma's instruction (the ninth, Gati, is omitted — see the note by her name below), and Kapila, the ninth-avatar son. Anasuya (already wed to Atri) and Arundhati (already wed to Vasishtha) are two of the tree's own already in the tree; this is the union that gives them a mother and father. SB 3.24.",
  },
);

union("u_pulaha_kardama", ["Pulaha"], ["Kardama"], {
  family: FAM,
  note: "Vishnu Purana 1.10: Pulaha and Kshama's sons were Kardama, Urvarivat and Sahishnu. Kshama herself is not added, for the same reason so many mothers along a bare king-list stay unnamed: the source gives no more than her name at this remove.",
});

union("u_marichi_kala", ["Marichi", "Kala"], [], { family: FAM, note: "SB 3.24.15." });
union("u_angiras_shraddha", ["Angiras", "ShraddhaAngirasa"], [], { family: FAM, note: "SB 3.24.16." });
union("u_pulastya_havirbhu", ["Pulastya", "Havirbhu"], [], { family: FAM, note: "SB 3.24.17." });
union("u_kratu_kriya", ["KratuRishi", "Kriya"], [], { family: FAM, note: "SB 3.24.19." });
union("u_bhrigu_khyati", ["Bhrigu", "Khyati"], [], { family: FAM, note: "SB 3.24.20. A second, earlier union alongside Bhrigu's marriage to Puloma." });
union("u_atharva_shanti", ["Atharva", "ShantiAtharva"], [], { family: FAM, note: "SB 3.24.22." });

// --- 3. Rati's second marriage. She already stands in the tree as
// Kamadeva's wife with no children (u_kama_rati); Pradyumna already stands
// as Kamadeva reborn. This is the missing middle: Shambara stole the infant
// Pradyumna, a fish swallowed him, and Rati — serving in Shambara's kitchen
// under the name Mayavati, awaiting her husband's next body — raised him
// without knowing him, then married him once he was grown and had killed
// Shambara. SB 10.55.
union("u_pradyumna_rati", ["Pradyumna", "Rati"], [], {
  family: "familyYadava",
  status: "married",
  note: "Rati, serving Shambara as his cook under the name Mayavati, raised the infant Pradyumna after a fish swallowed him; she recognised him as Kamadeva reborn, and married him once grown, after he killed Shambara. SB 10.55.",
});

// --- 4. Mrikandu and Markandeya (SB 12.8-10, cited for the descent from
// Bhrigu; read for the vision itself).
person("Mrikandu", {
  family: "familyBhargava",
  note: "Son of Bhrigu; father of Markandeya.",
});
person("Markandeya", {
  family: "familyBhargava",
  note: "Son of Mrikandu; boon of an unending life. In the waters of pralaya saw the infant Narayana on a banyan leaf, was drawn in on its breath, saw the whole universe inside the child's body, and was breathed out again — the one sage who remembers every dissolution. SB 12.8-10.",
});
addChild("u_bhrigu", "Mrikandu");
union("u_mrikandu_markandeya", ["Mrikandu"], ["Markandeya"], { family: "familyBhargava" });

// --- 4b. Savitri and Satyavan (MBh 3.277-283, the Pativrata-mahatmya), told
// to Yudhishthira in the Vana Parva as a consolation, exactly like the
// Nalopakhyana (III.1) — and, like Nala, absent from the tree until now.
// Savitri's father is named Ashvapati, king of Madra, in the epic's own
// telling; the tree already carries a Madra line (Dyutimanta -> Shalya,
// Madri, per II.3), but nothing in the text identifies the two kings, so
// this is kept a separate, anchored figure rather than forced into that
// chain — the same restraint the tree already applies to Nala's
// chronology. Anchored near the Pandavas' own generation, since that is
// when the story is told, not because any genealogical link fixes it there.
// No anchor here: reanchor-eras.ts owns this family's era placement, right
// beside Nala and Damayanti, the same consolation-tale slot.
person("AshvapatiMadra", {
  name: "Ashvapati",
  family: "familyMadra",
  note: "King of Madra; long sonless, he propitiated the goddess Savitri for eighteen years and was given a daughter, whom he named for her. Not Ashvapati of Kekaya, Kaikeyi's father. MBh 3.277.",
});
person("Savitri", {
  family: "familyMadra",
  gender: "female",
  note: "Daughter of Ashvapati of Madra; chose the exiled prince Satyavan for herself knowing, from the sage Narada, that he had exactly one year to live, and married him anyway. When Yama himself came for Satyavan's soul, she followed him on foot into death, answered his questions on dharma so well he granted her boons — sight for Satyavan's blind father, his kingdom back, a hundred sons for herself — and, tricked at last into asking for Satyavan's own life among them, won her husband back by the letter of Yama's own word. MBh 3.277-283.",
});
person("Satyavan", {
  family: "familyMadra",
  note: "Son of the blind, exiled king Dyumatsena of Shalva; husband of Savitri, who married him knowing he was fated to die within the year. Died of a sudden pain in the head exactly on the day foretold, in the forest, his head in Savitri's lap; brought back when she out-argued Yama himself. MBh 3.277-283.",
});
person("Dyumatsena", {
  family: null,
  note: "Blind king of Shalva, deposed and exiled to the forest; father of Satyavan. Regained both his sight and his throne the moment his son was restored to life, on Yama's earlier boon to Savitri. MBh 3.277-283.",
});
union("u_ashvapati_savitri", ["AshvapatiMadra"], ["Savitri"], { family: "familyMadra" });
union("u_dyumatsena", ["Dyumatsena"], ["Satyavan"], { family: "familyMadra", note: "Mother unnamed in the source." });
union("u_satyavan_savitri", ["Satyavan", "Savitri"], [], {
  family: "familyMadra",
  note: "Savitri chose him at her own svayamvara-equivalent, over her father's objection, knowing Narada's forecast of his death within the year. MBh 3.277-283.",
});

// --- 5. Suvarchala, Hanuman's wife. Not Bhagavata — the Parashara Samhita,
// a text devoted entirely to Hanuman, and today a living Telangana temple
// tradition (Suvarchala Anjaneya Swamy). Added on request despite the
// thin sourcing recorded in Part X.4; single-parent union to Surya since no
// text names her mother, the same convention the tree already uses for a
// known parent and an unknown one (Adrika the fish, for Makardhwaja).
person("Suvarchala", {
  family: "familyAditya",
  gender: "female",
  note: "Daughter of Surya; wife of Hanuman. Parashara Samhita, not the Bhagavata; a Telangana temple tradition (Suvarchala Anjaneya Swamy).",
});
union("u_surya_suvarchala", ["Surya"], ["Suvarchala"], {
  family: "familyAditya",
  note: "Mother unnamed in the sources. Parashara Samhita.",
});
union("u_hanuman_suvarchala", ["Hanuman", "Suvarchala"], [], {
  family: "familyVanara",
  note:
    "To finish teaching Hanuman the nine grammars, Surya told him the last lesson required a married man, and offered his own daughter Suvarchala as the guru-dakshina; Surya himself framed it as brahmanda-kalyana, for the world's good, and no part of Hanuman's brahmacharya vow. She lives from then in tapas, apart from him. Parashara Samhita; the marriage is kept alive today at the Suvarchala Anjaneya Swamy temple in Telangana.",
});

// --- 6. Astika (MBh 1.13-53), the connection Part VII.3 already flagged as
// ready: Janamejaya, Vasuki and Takshaka are all three already in the tree,
// and this is the one edge that closes the loop the whole Mahabharata is
// framed inside. Both parents are named Jaratkaru — the sage, and Vasuki's
// sister, given to him because a prophecy said only a woman of his own name
// would be accepted — so they need realm-suffixed ids like any other clash.
person("JaratkaruSage", {
  name: "Jaratkaru",
  family: null,
  note: "Ascetic sage; refused to marry until his ancestors, seen hanging over a pit by a fraying rope of grass, told him only a son could save them, and that the son must share his own name. Vasuki gave him his sister, also named Jaratkaru, on that condition alone. Left her, as he had warned he would at the first word he took as disrespect, once Astika was conceived. MBh 1.13-16.",
});
person("JaratkaruNagi", {
  name: "Jaratkaru",
  family: "familyNaga",
  gender: "female",
  note: "Sister of Vasuki, king of the nagas; given to the sage Jaratkaru, who shared her name, as the wife the prophecy demanded, to save both her own ancestors and the whole naga race from Janamejaya's sacrifice through their son Astika. MBh 1.13-16.",
});
person("Astika", {
  family: "familyNaga",
  note: "Son of the sage Jaratkaru and Vasuki's sister, also named Jaratkaru; interrupted Janamejaya's snake sacrifice with the nagas already falling into the fire, invoked as a boon before the king knew what he was granting, and stopped it with the serpents, Vasuki and Takshaka among them, saved mid-air. The frame the whole Mahabharata is recited inside. MBh 1.13-53.",
});
union("u_jaratkaru", ["JaratkaruSage", "JaratkaruNagi"], ["Astika"], { family: null, note: "MBh 1.13-16." });
// Vasuki's sister, so a daughter of Kashyap and Kadru alongside him.
addChild("u_kashyap_kadru", "JaratkaruNagi");

// --- write ---------------------------------------------------------------
if (collisions.length) {
  console.error("add-more-lineages: refusing to write, id collisions:", collisions);
  process.exit(1);
}

const { errors, warnings } = validateData(data);
if (errors.length) {
  console.error("add-more-lineages: refusing to write, validateData errors:");
  for (const e of errors) console.error(" -", e);
  process.exit(1);
}
if (warnings.length) {
  console.warn("add-more-lineages: validateData warnings:");
  for (const w of warnings) console.warn(" -", w);
}

writeFileSync(PATH, JSON.stringify(data, null, 2) + "\n");
console.log(`add-more-lineages: +${addedPeople} people, +${addedUnions} unions`);
