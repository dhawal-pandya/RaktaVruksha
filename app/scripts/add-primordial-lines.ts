/**
 * Third splice pass: the primordial lines.
 *
 * The executable form of docs/LINEAGES_CURRENT.md. Three pieces, all
 * Bhagavata except where noted:
 *
 *   1. Bhumi, the Earth herself, beside Varaha who lifted her out of the water.
 *      Parentless by nature, as he is. She closes Narakasura's parentage
 *      (SB 10.59) and gives Mangala, the last missing Navagraha, a mother.
 *   2. Svayambhuva Manu and Shatarupa (SB 3.12, 4.1), born of Brahma's own
 *      body, with their three daughters -- Akuti (given to Ruchi, mother of
 *      the avatar Yajna and his twin Dakshina), Devahuti (Kardama's wife,
 *      already in this tree with no parents at all) and Prasuti (given to
 *      Daksha, already in this tree as Brahma's son). Part VI.1 of the old
 *      research doc hesitated over this branch, fearing it would give the
 *      tree a second root; it does not, since the whole pair hangs off row 0
 *      like everything else.
 *
 *      Manu's two sons, Priyavrata and Uttanapada, and everything the
 *      Bhagavata hangs off them -- Dhruva, Vena, Prithu, the Pracetas and
 *      Daksha reborn on one side, Agnidhra, Nabhi and Rishabha on the other
 *      -- were drawn here once and then deliberately removed: the chain ran
 *      twelve-plus generations deep for two names in a king-list at each
 *      step, dragged Daksha's reborn self to row 19 while his own new
 *      wife's sixty daughters (pass four) needed him at the primordial
 *      layer, and was judged not worth what it cost the tree's shape.
 *      docs/LINEAGES_CURRENT.md records the removal and what depends on it.
 *   3. The Angirasa house (MBh 1.98; RV 1.140-164): Utathya, Samvarta and
 *      Mamata, which closes Dirghatamas -- and with him Karna's whole foster
 *      house -- against Angiras.
 *   4. Manu's other sons' lines (SB 9.2.16-28), and Mali of Lanka (Ram 7).
 *
 * Shiva, Vishnu and their families are deliberately NOT here. See
 * docs/LINEAGES_CURRENT.md for that decision.
 *
 * Idempotent: people and unions that already exist are left alone.
 *
 * Run: npm run add-primordial-lines
 * Then: npm run reanchor-eras
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { FamilyDataV2, Gender, PersonRecord, UnionRecord } from "../src/core/types";
import { validateData } from "../src/core/validate";

const here = dirname(fileURLToPath(import.meta.url));
const PATH = resolve(here, "../public/family-data.hiranyagarbha.json");
const data: FamilyDataV2 = JSON.parse(readFileSync(PATH, "utf8"));
const STAMP = "2026-08-02T00:00:00.000Z";

const peopleById = new Map(data.people.map((p) => [p.id, p]));
const unionsById = new Map(data.unions.map((u) => [u.id, u]));
const created = new Set<string>();
let addedPeople = 0;
let addedUnions = 0;
const collisions: string[] = [];

interface PersonSpec {
  name?: string;
  family?: string | null;
  gender?: Gender;
  note?: string;
  divine?: boolean;
  /** Relative era anchor: "beside this person, this many rows off". */
  anchor?: { beside: string; offset?: number };
}

const person = (id: string, spec: PersonSpec = {}): string => {
  const existing = peopleById.get(id);
  if (existing) {
    if (!created.has(id) && existing.updatedAt !== STAMP) collisions.push(id);
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
    ...(spec.divine ? { divine: true } : {}),
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
    status: "married",
    ...(spec.gap && spec.gap > 1 ? { childGap: spec.gap } : {}),
    ...(spec.note ? { notes: spec.note } : {}),
    updatedAt: STAMP,
  };
  data.unions.push(u);
  unionsById.set(id, u);
  addedUnions++;
  return id;
};

const addChild = (unionId: string, childId: string): void => {
  const u = unionsById.get(unionId);
  if (!u) throw new Error(`no union "${unionId}"`);
  if (!u.children.includes(childId)) {
    u.children.push(childId);
    u.updatedAt = STAMP;
  }
};

const family = (id: string, name: string, color: string): void => {
  if (!data.families[id]) data.families[id] = { name, color };
};

// ===========================================================================
// 1. Bhumi, the Earth
// ===========================================================================
family("familyBhumi", "Bhumi", "#3fa34d");

person("Bhumi", {
  family: "familyBhumi",
  gender: "female",
  divine: true,
  anchor: { beside: "Varaha" },
  // Primordial, and so parentless, exactly as Varaha is. She is not given a
  // descent from anyone: she is the ground the rest of the tree stands on.
  note: "The Earth herself, and a devi in her own right. Hiranyaksha rolled her down into the cosmic waters and Varaha lifted her out on his tusks; by him she bore Narakasura, who ruled Pragjyotisha until Krishna killed him. Also called Bhu, Prithvi and Vasudha, and mother of Mangala the red planet, who is Bhauma, 'of the Earth', after her. Parentless by nature, as Varaha is. SB 3.13-19, 10.59",
});

// The union that closes a parentage the old research doc flagged as ready and
// never drew (Part VII.1). Narakasura keeps his own era anchor, which is a
// floor, so the edge renders as a long ray across the eras rather than
// dragging either parent down -- the same shape as Surya fathering Karna.
union("u_varaha_bhumi", ["Varaha", "Bhumi"], ["Narakasura"], {
  family: "familyBhumi",
  note: "Varaha fathered Naraka on the Earth he had just rescued. SB 10.59.2-3; the link was catalogued in the old Part VII.1 and left undrawn until now.",
});

person("Mangala", {
  family: "familyBhumi",
  divine: true,
  note: "Mangala, the red planet Mars, last of the nine grahas to enter this tree. Called Bhauma and Kuja, both meaning 'born of the Earth', and Angaraka, 'the burning coal'. The Shaiva account has him born of a drop of Shiva's sweat falling to the ground and raised by Bhumi; the tree carries only the mother, since Shiva is not in it. Lord of Tuesday, and of the fierce, martial temperament his colour names.",
});
union("u_bhumi_mangala", ["Bhumi"], ["Mangala"], {
  family: "familyBhumi",
  note: "One partner only: the father the Shaiva sources name is Shiva, who is deliberately not in this tree.",
});

// ===========================================================================
// 2. The Svayambhuva pre-history
// ===========================================================================
const SV = "familySvayambhuva";
family(SV, "Svayambhuva", "#a9c4e8");

// Brahma's own first pair. SB 3.12.54: both came from his body, so both join
// his existing union with Saraswati rather than arriving as strangers.
person("ManuSvayambhuva", {
  name: "Svayambhuva Manu",
  family: SV,
  divine: true,
  note: "The first Manu, born of Brahma's own body with Shatarupa, and the first man to rule. Father, the Bhagavata says, of Priyavrata and Uttanapada as well -- not carried in this tree, their own descent judged not worth its cost to the tree's shape -- and of three daughters whose marriages seeded the rest: Akuti to Ruchi, Devahuti to Kardama, Prasuti to Daksha. Not Vaivasvata Manu, the seventh, who is this tree's own ancestor of the solar and lunar houses. SB 3.12.54, 4.1",
});
person("Shatarupa", {
  family: SV,
  gender: "female",
  divine: true,
  note: "The first woman, born of Brahma's body alongside Svayambhuva Manu, whom she married; mother of Akuti, Devahuti and Prasuti in this tree, and of Priyavrata and Uttanapada in the Bhagavata's own account, not carried here. Her name, 'she of a hundred forms', is the ground of every later account of Brahma's creation of a consort. SB 3.12.54",
});
addChild("u_brahma_extra", "ManuSvayambhuva");
addChild("u_brahma_extra", "Shatarupa");

person("Akuti", {
  family: SV,
  gender: "female",
  note: "Daughter of Svayambhuva Manu, given to the Prajapati Ruchi on the condition that her son be counted her father's; by him she bore the twins Yajna and Dakshina. SB 4.1.1-6",
});
person("Prasuti", {
  family: SV,
  gender: "female",
  note: "Youngest daughter of Svayambhuva Manu; wife of Daksha, and so the mother of the sixteen daughters through whom the whole deva world descends. Her marriage is the join between the first Manu's house and Brahma's own. SB 4.1.2, 4.1.64",
});
union("u_svayambhuva", ["ManuSvayambhuva", "Shatarupa"], ["Akuti", "Prasuti", "Devahuti"], {
  family: SV,
  note: "SB 3.12.56, 4.1. Devahuti was already in this tree as Kardama's wife with no parents at all; this is the union that gives her one.",
});

// Prasuti marries Daksha, who is already here as Brahma's son. This is the join
// the old Part VI.1 singled out: it makes the entire deva world a son-in-law of
// the first Manu. Measured before drawing it: exactly one person's row changes,
// Daksha's, from 1 to 2. Nothing else in the tree moves at all -- his children
// were already held where they are by Kashyap's marriages.
union("u_daksha_prasuti", ["Daksha", "Prasuti"], [], {
  family: "familyBrahma",
  note: "SB 4.1.2. Daksha's sixteen daughters by Prasuti (SB 4.1.64) are catalogued in the current lineage doc and not yet added.",
});

person("Ruchi", {
  family: SV,
  note: "A Prajapati; husband of Akuti, daughter of Svayambhuva Manu, and father by her of the twins Yajna and Dakshina. SB 4.1.1-6",
});
person("Yajna", {
  family: SV,
  divine: true,
  note: "Son of Ruchi and Akuti; the seventh of the avatars, sacrifice itself made a person. He became the Indra of the Svayambhuva age, with his own sons the devas of it. Counted at SB 1.3.12 and left out of this tree until his parents entered it. SB 4.1.7",
});
person("Dakshina", {
  family: SV,
  gender: "female",
  note: "Twin sister of Yajna, born to Ruchi and Akuti, and afterwards his wife; the sacrificial fee personified, without which a sacrifice does not complete. SB 4.1.7",
});
union("u_ruchi_akuti", ["Ruchi", "Akuti"], ["Yajna", "Dakshina"], { family: SV, note: "SB 4.1.1-7." });
union("u_yajna_dakshina", ["Yajna", "Dakshina"], [], {
  family: SV,
  note: "Twins, and afterwards husband and wife; their twelve sons were the Tushita devas of the Svayambhuva age. SB 4.1.7-8",
});

// ===========================================================================
// 3. The Angirasa house
// ===========================================================================
person("Utathya", {
  family: "familyAngirasa",
  note: "Son of Angiras and brother of Brihaspati; husband of Mamata and, by her, father of Dirghatamas. His own brother's quarrel with his wife in her pregnancy is what blinded that son in the womb. MBh 1.98",
});
person("Samvarta", {
  family: "familyAngirasa",
  note: "Son of Angiras and brother of Brihaspati; the naked, ash-smeared ascetic who acted as priest at Marutta's sacrifice when Brihaspati, serving Indra, refused it -- and made it so rich that Indra sent Agni to threaten him over it. MBh 14.4-10",
});
person("Mamata", {
  family: "familyAngirasa",
  gender: "female",
  note: "Wife of Utathya. Already carrying Dirghatamas when Brihaspati forced himself on her; the unborn child kicked the seed away, and Brihaspati cursed him to be born blind for it -- dirgha-tamas, 'long darkness'. MBh 1.98",
});
person("Kakshivan", {
  family: "familyAngirasa",
  note: "Son of Dirghatamas by the maid Ushij, hence Auśija; a Rigvedic seer in his own right, with the hymns of RV 1.116-126 to his name, and remembered for winning a thousand cows and the king's daughters from Svanaya. RV 1.116-126, 1.18",
});
addChild("u_angiras", "Utathya");
addChild("u_angiras", "Samvarta");
// Dirghatamas already stands in the tree at his wife's era, twenty rows below
// his father: an honest long ray, since the Angirasa list is short and the Anu
// line he married into is long. Nothing is padded to hide it.
union("u_utathya_mamata", ["Utathya", "Mamata"], ["Dirghatamas"], {
  family: "familyAngirasa",
  note: "MBh 1.98. Dirghatamas stood in this tree with no ancestry at all until now; giving him one also gives Karna's whole foster house, through Anga, a line back to Angiras.",
});
union("u_dirghatamas_kakshivan", ["Dirghatamas"], ["Kakshivan"], {
  family: "familyAngirasa",
  note: "By the maid Ushij, who is not carried here as a person. RV 1.18.1",
});

// ===========================================================================
// 4. Manu's other sons, and Mali
// ===========================================================================
person("Mali", {
  family: "familyRakshasa",
  anchor: { beside: "Sumali" },
  note: "Third son of Sukesha, with Malyavan and Sumali; one of the three rakshasa brothers who held Lanka before Ravana. Killed by Vishnu in the war that drove his brothers south and left the city empty for Kubera. Ram 7.5-7.8",
});
addChild("r_u_sukesha", "Mali");

// SB 9.2.16-28: the lines of Manu's sons that stood in this tree as bare names.
person("Sumati", { family: "familyIkshvaku", note: "Son of Nriga, in the line of Manu's sons. SB 9.2.17" });
person("Bhutajyoti", { family: "familyIkshvaku", note: "Son of Nriga. SB 9.2.17" });
person("VasuN", { name: "Vasu", family: "familyIkshvaku", note: "Son of Nriga; father of Pratika. Not Uparichara Vasu of Chedi, nor Vasu son of Jamadagni. SB 9.2.17" });
person("Pratika", { family: "familyIkshvaku", note: "Son of Vasu in Nriga's line; father of Oghavan. SB 9.2.17" });
person("Oghavan", { family: "familyIkshvaku", note: "Son of Pratika, and the last of Nriga's line the Purana names. His daughter Oghavati married Sudarshana. SB 9.2.17-18" });
union("u_nriga", ["Nriga"], ["Sumati", "Bhutajyoti", "VasuN"], { family: "familyIkshvaku", note: "SB 9.2.17." });
union("u_vasuN", ["VasuN"], ["Pratika"], { family: "familyIkshvaku", note: "SB 9.2.17." });
union("u_pratika", ["Pratika"], ["Oghavan"], { family: "familyIkshvaku", note: "SB 9.2.17." });

person("Agnivesya", {
  family: "familyIkshvaku",
  note: "Youngest son of Narishyanta, also called Kanina and Jatukarnya; the brahmin gotra of the Agnivesyayanas descends from him. SB 9.2.21-22",
});
person("Chitrasena_3", { name: "Chitrasena", family: "familyIkshvaku", note: "Son of Narishyanta. SB 9.2.20" });
person("Midhvan", { family: "familyIkshvaku", note: "Son of Narishyanta. SB 9.2.20" });
person("Satyashrava", { family: "familyIkshvaku", note: "Son of Narishyanta. SB 9.2.21" });
person("Urushrava", { family: "familyIkshvaku", note: "Son of Narishyanta. SB 9.2.21" });
person("Devadatta", { family: "familyIkshvaku", note: "Son of Narishyanta, and father of Agnivesya. SB 9.2.21" });
union("u_narishyanta", ["Narishyanta"], ["Chitrasena_3", "Midhvan", "Satyashrava", "Urushrava", "Devadatta"], {
  family: "familyIkshvaku",
  note: "Ten sons at SB 9.2.20-21; the five carried here are those the Purana follows any further.",
});
union("u_devadatta", ["Devadatta"], ["Agnivesya"], { family: "familyIkshvaku", note: "SB 9.2.21-22." });

// --- write ---------------------------------------------------------------
if (collisions.length) {
  console.error("add-primordial-lines: refusing to write, id collisions:", collisions);
  process.exit(1);
}
const { errors } = validateData(data);
if (errors.length) {
  console.error("add-primordial-lines: refusing to write, validateData errors:");
  for (const e of errors) console.error(" -", e);
  process.exit(1);
}
writeFileSync(PATH, JSON.stringify(data, null, 2) + "\n");
console.log(`add-primordial-lines: +${addedPeople} people, +${addedUnions} unions`);
