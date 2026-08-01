/**
 * Fourth splice pass: Daksha's sixty daughters.
 *
 * SB 6.6.1-31, read directly (gitabase.com, cross-checked against vedabase's
 * own summary) rather than recalled, because the popular secondary
 * literature is inconsistent about which Daksha these daughters belong to.
 *
 * SB 6.6.1 is precise about it, and it is NOT the first Daksha in this tree:
 * it names the father "Daksa, who is known as Pracetasa" and his wife
 * Asikni, daughter of Prajapati Panchajana (SB 6.4.51) -- the Bhagavata's
 * own reborn Daksha, after the first one's sacrifice was destroyed. This
 * tree carried that second birth as its own record, DakshaPracetasa, for
 * exactly one session, until the whole chain that produced him (Priyavrata,
 * Uttanapada, Dhruva, Vena, Prithu, the Pracetas -- see
 * add-primordial-lines.ts) was removed as not worth its cost to the tree's
 * shape. Rather than resurrect that chain for one wife, the sixty daughters
 * are attached here to the FIRST Daksha and Prasuti instead -- the simpler,
 * single-Daksha reading most secondary literature already uses, and the one
 * Vishnu Purana itself gives (it never splits Daksha into two births at
 * all). Said plainly, because it departs from the Bhagavata's own precise
 * chronology: this is a deliberate simplification, not a misreading.
 *
 * **A real union, not divineParents.** The first draft of this pass used
 * `divineParents` for all sixty, on the assumption that Daksha's existing
 * wives (Aditi, Diti, etc.) were bare prose notes with no graph edge to him
 * at all. That assumption was wrong: `u_daksha` is a real, pre-existing
 * 1-partner union (mother unconfirmed) with forty-two children, going back
 * to the original archive. Measured non-destructively before changing
 * anything: adding Prasuti as `u_daksha`'s second partner shifts NOT ONE
 * existing person's row, because Daksha and Prasuti were already merged as
 * a couple (via a separate, then-childless `u_daksha_prasuti`) -- so this
 * is just filling in the "unknown" mother slot on the union that actually
 * holds the children, not creating a new cross-era link. `u_daksha_prasuti`
 * is retired as a result: two unions for the same couple was never the
 * intent, just an accident of when each daughter was added.
 *
 * **Confirmed per daughter, not assumed.** Thirty-nine of `u_daksha`'s
 * forty-two children (Aditi, Diti, Danu, Kadru, Vinata, Chandra's
 * twenty-seven nakshatra-wives, Surabhi, Tamra, Muni, Arishta, Surasa,
 * Krodhavasha, Ira) plus the nineteen new people this pass adds are
 * confirmed via SB 6.6 directly. Two more, Danayus and Khasa, are confirmed
 * via the Vishnu Purana, which names Daksha's wife Panchajani -- the same
 * figure this tree equates with Prasuti, per the single-Daksha reading
 * above -- as Danu's mother in the same passage that lists Khasa among her
 * sisters. The last of the forty-two, **Rati**, is NOT confirmed: sources
 * disagree on her mother, and at least one tradition has her born of
 * Daksha's own perspiration, no mother at all. She is split into her own
 * union, `u_daksha_rati`, rather than assumed into Prasuti's either way.
 *
 * Four sub-clusters among the nineteen new people, all confirmed by direct
 * verse lookup:
 *
 *   1. Ten to Dharma/Yama (6.6.4): Bhanu, Lamba, Kakud, Yami, Vishva, Sadhya,
 *      Marutvati, Vasu, Muhurta, Sankalpa. Vasu is the prize: her eight sons
 *      are the Vasus (6.6.10-11), the same class of gods already in this
 *      tree as Ganga's eight sons -- under a wholly different set of names,
 *      a genuine textual variance between the Bhagavata and the
 *      Mahabharata, recorded honestly rather than papered over. Rather than
 *      mint eight duplicate person records that map to no one in
 *      particular, Ganga's eight sons each carry `divineParents: ["Yama",
 *      "VasuDharma"]` instead -- their divine origin, without disturbing
 *      the union (`u_shantanu_ganga`) that actually places them at row
 *      90-91. That is the one `divineParents` link this pass still uses,
 *      and it is a different kind of link from the one the first draft
 *      leaned on: a free-agent deva's parentage of a mortal-era figure, not
 *      a stand-in for a same-era union that would otherwise be safe to draw.
 *   2. Five more to Kashyap (6.6.21-31), closing the seventeen: Patangi,
 *      Yamini, Kashtha, Sarama, Timi.
 *   3. Two to Angiras (6.6.19): Svadha and Sati -- a different Sati from
 *      Shiva's wife, sharing only a name; that Sati stays out, as Shiva
 *      does.
 *   4. Two to a Krishashva who is NOT the Ikshvaku king already in this
 *      tree (a different man; the archive's own namesake table at
 *      PURANIC_LINEAGES.md:767 already lists them as distinct people).
 *
 * Left out: Bhuta (6.6.17-18), whose two wives mother "ten million Rudras" --
 * Rudra is Shiva, and the tree's decision to leave Shiva and his family out
 * holds for this too.
 *
 * **Named grandchildren, added directly, not left in prose.** The first
 * draft of this pass mentioned Deva-rishabha, Vidyota, Sankata, Svarga,
 * Marutvan, Jayanta, Dhumaketu and Krishashva's other sons only in their
 * mothers' notes. On review, that was the wrong call for anyone the text
 * actually names as an individual: a note is a reference, not a substitute
 * for the person it's about. Section 1a below adds all of them as real
 * people (Deva-rishabha → Indrasena; Vidyota; Sankata → Kikata; Svarga →
 * Nandi, not Shiva's bull; Arthasiddhi, named among the Sadhyas; Marutvan
 * and Jayanta, suffixed `...Marutvati` for the Indra's-son collision;
 * Sankalpa's own son, suffixed `SankalpaS`), and section 4 corrects
 * Krishashva's sons to their actual per-wife attribution (SB 6.6.20:
 * Dhumaketu is Archis's alone, and Dhishana's four are Vedashira, Devala,
 * Vayuna and Manu — the first draft had dropped Manu and blurred both
 * mothers together). What's still left as prose, correctly: the Vishvadevas,
 * the Sadhyas as a body, the Mauhurtikas and Kikata's own "Durga"
 * descendants (guardians of fortresses, durga meaning fort) — these are
 * classes the text names collectively, not individuals with names of their
 * own to add.
 *
 * Idempotent: people and unions that already exist are left alone; the
 * addChild/addPartner calls are no-ops once applied.
 *
 * Run: npm run add-daksha-daughters
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
const STAMP = "2026-08-02T02:00:00.000Z";

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
  divineParents?: string[];
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
    ...(spec.divineParents ? { divineParents: spec.divineParents } : {}),
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

/** Supply the missing second parent of an existing 1-partner union. */
const addPartner = (unionId: string, partnerId: string): void => {
  const u = unionsById.get(unionId);
  if (!u) throw new Error(`no union "${unionId}"`);
  if (u.partners.includes(partnerId)) return;
  if (u.partners.length >= 2) throw new Error(`union "${unionId}" already has two partners`);
  u.partners.push(partnerId);
  u.updatedAt = STAMP;
};

/** Add a divine-parent link to an EXISTING person without touching anything else. */
const addDivineParents = (id: string, parents: string[]): void => {
  const p = peopleById.get(id);
  if (!p) throw new Error(`no person "${id}"`);
  const set = new Set([...(p.divineParents ?? []), ...parents]);
  p.divineParents = [...set];
  p.updatedAt = STAMP;
};

/** Rewrite an existing person's note (used where a correction sharpens one already written). */
const renote = (id: string, note: string): void => {
  const p = peopleById.get(id);
  if (!p) throw new Error(`no person "${id}"`);
  p.notes = note;
  p.updatedAt = STAMP;
};

const family = (id: string, name: string, color: string): void => {
  if (!data.families[id]) data.families[id] = { name, color };
};

const DK = "familyDakshakanya";
family(DK, "Daksha's Daughters", "#d4915c");

// ===========================================================================
// 1. Ten to Dharma (Yama), SB 6.6.4
// ===========================================================================
person("BhanuDharma", {
  name: "Bhanu",
  family: DK,
  gender: "female",
  note:
    "One of ten daughters Daksha gave to Dharma (Yamaraja); her son Deva-rishabha fathered Indrasena. Not Bhanu, Krishna's son by Satyabhama. SB 6.6.2, 4-5",
});
person("Lamba", {
  family: DK,
  gender: "female",
  note: "Wife of Dharma; her son Vidyota generated every cloud in the sky. SB 6.6.4, 6",
});
person("Kakud", {
  family: DK,
  gender: "female",
  note: "Wife of Dharma; her son Sankata fathered Kikata. SB 6.6.4, 7",
});
person("YamiDharma", {
  name: "Yami",
  family: DK,
  gender: "female",
  note:
    "Wife of Dharma, one of Daksha's ten daughters given to him -- not Yami, Surya's own daughter and Yama's twin sister, the river Yamuna, already in this tree by a wholly different mother. Her son Svarga presides over the heaven that bears his name. SB 6.6.4, 7",
});
person("Vishva", {
  family: DK,
  gender: "female",
  note: "Wife of Dharma; mother of the Vishvadevas, the class of gods named for her. SB 6.6.4, 8",
});
person("Sadhya", {
  family: DK,
  gender: "female",
  note:
    "Wife of Dharma; mother of the Sadhyas, the class of gods named for her, old enough that the Rigveda already speaks of them as the gods before the gods. SB 6.6.4, 8",
});
person("Marutvati", {
  family: DK,
  gender: "female",
  note:
    "Wife of Dharma; her sons Marutvan and Jayanta are named for the storm-gods and for victory. Not the Jayanta already in this tree as Indra's own son. SB 6.6.4, 9",
});
person("VasuDharma", {
  name: "Vasu",
  family: DK,
  gender: "female",
  divine: true,
  note:
    "Wife of Dharma, and the most consequential of Daksha's sixty daughters: her eight sons are the Vasus -- Drona, Prana, Dhruva, Arka, Agni, Dosha, Vastu and Vibhavasu in the Bhagavata's own naming (SB 6.6.10-11). The Mahabharata gives the same eight gods a different name each when they are born a second time, cursed, as Ganga's sons -- Dhara, Dhruva, Soma, Aha, Anila, Anala, Pratyusha and Bhishma, already in this tree at Kurukshetra's era -- and only Dhruva's name survives both tellings. Not Vasu, Jamadagni's son. SB 6.6.4, 10-11",
});
person("Muhurta", {
  family: DK,
  gender: "female",
  note: "Wife of Dharma; mother of the Mauhurtikas, the minor gods who preside over the day's auspicious moments. SB 6.6.4, 9",
});
person("Sankalpa", {
  family: DK,
  gender: "female",
  note: "Wife of Dharma; her son, also named Sankalpa, is will and intention itself made a person. SB 6.6.4, 9",
});
for (const wife of ["BhanuDharma", "Lamba", "Kakud", "YamiDharma", "Vishva", "Sadhya", "Marutvati", "VasuDharma", "Muhurta", "Sankalpa"]) {
  union(`u_yama_${wife}`, ["Yama", wife], [], { family: DK });
}

// ===========================================================================
// 1a. Named sons and grandsons of Dharma's ten wives, SB 6.6.5-9
// ===========================================================================
// The notes above are references, not a decision to exclude: every INDIVIDUAL
// the text actually names gets added directly, added as a child of the
// marriage union that already exists rather than a fresh one. Left out are
// only the true classes, which are not individuals to add: the Vishvadevas
// (Vishva's sons, no progeny), the Sadhyas as a body (one of whom,
// Arthasiddhi, IS named and is added below), the Mauhurtikas, and the
// "Durgas" -- Kikata's own descendants, guardians of fortresses (durga is
// just the word for fort), a class left ungrouped for the same reason
// Vishvadevas is, and no relation to the goddess who shares the word.
person("DevaRishabha", { name: "Deva-rishabha", family: DK, note: "Son of Bhanu and Dharma; father of Indrasena. SB 6.6.5" });
person("Vidyota", { family: DK, note: "Son of Lamba and Dharma; generated every cloud in the sky. SB 6.6.6" });
person("Sankata", { family: DK, note: "Son of Kakud and Dharma; father of Kikata. SB 6.6.6" });
person("Svarga", { family: DK, note: "Son of Yami and Dharma; presides over the heaven that bears his name. SB 6.6.6" });
person("Arthasiddhi", {
  family: DK,
  note: "Son of Sadhya and Dharma, named among the Sadhyas; the rest of that class is left ungrouped, as Vishvadevas is for Vishva. SB 6.6.7",
});
person("Marutvan", {
  family: DK,
  note: "Son of Marutvati and Dharma, named for the storm-gods; the Bhagavata calls him and his brother Jayanta expansions of Vasudeva himself. SB 6.6.9",
});
person("JayantaMarutvati", {
  name: "Jayanta",
  family: DK,
  note: "Son of Marutvati and Dharma, named for victory; the Bhagavata calls him and his brother Marutvan expansions of Vasudeva himself. Not the Jayanta already in this tree as Indra's own son. SB 6.6.9",
});
person("SankalpaS", {
  name: "Sankalpa",
  family: DK,
  note: "Son of Sankalpa and Dharma, sharing his mother's name: will and intention itself made a person twice over. SB 6.6.9",
});
addChild("u_yama_BhanuDharma", "DevaRishabha");
addChild("u_yama_Lamba", "Vidyota");
addChild("u_yama_Kakud", "Sankata");
addChild("u_yama_YamiDharma", "Svarga");
addChild("u_yama_Sadhya", "Arthasiddhi");
addChild("u_yama_Marutvati", "Marutvan");
addChild("u_yama_Marutvati", "JayantaMarutvati");
addChild("u_yama_Sankalpa", "SankalpaS");

// Third generation: each has a wife the text doesn't name, hence 1-partner unions.
person("Indrasena", { family: DK, note: "Son of Deva-rishabha, in Bhanu's line from Dharma. SB 6.6.5" });
person("Kikata", {
  family: DK,
  note:
    "Son of Sankata, in Kakud's line from Dharma; his own descendants are called the Durgas, guardians of fortresses (durga is the word for fort) -- a class left ungrouped rather than named individually, and no relation to the goddess who shares the word. SB 6.6.6",
});
person("Nandi", {
  family: DK,
  note: "Son of Svarga, in Yami's line from Dharma. Not Nandi, Shiva's bull and gatekeeper -- an unrelated figure sharing only the name. SB 6.6.6",
});
union("u_devarishabha", ["DevaRishabha"], ["Indrasena"], { family: DK, note: "SB 6.6.5." });
union("u_sankata", ["Sankata"], ["Kikata"], { family: DK, note: "SB 6.6.6." });
union("u_svarga", ["Svarga"], ["Nandi"], { family: DK, note: "SB 6.6.6." });

// The prize: Ganga's eight sons already carry the Mahabharata's own account of
// their birth and curse; this adds their divine origin as Dharma and Vasu's
// sons in the Bhagavata's telling, without touching the union that actually
// places them (u_shantanu_ganga, row 90-91). Unlike Vasu's OWN parentage
// (below, a real union-child of u_daksha), this stays divineParents: these
// eight are mortal-era people whose free-agent divine origin would otherwise
// drag them to Vasu's row, exactly the case divineParents exists for.
for (const vasu of ["VasuDhara", "VasuDhruva", "VasuSoma", "VasuAha", "VasuAnila", "VasuAnala", "VasuPratyusha", "Bhishma"]) {
  addDivineParents(vasu, ["Yama", "VasuDharma"]);
}

// ===========================================================================
// 2. Five more to Kashyap, closing the seventeen (SB 6.6.21-31)
// ===========================================================================
person("Patangi", {
  family: DK,
  gender: "female",
  note: "One of Kashyapa's seventeen wives, a daughter of Daksha; mother of every bird. SB 6.6.2, 21-22",
});
person("Yamini", {
  family: DK,
  gender: "female",
  note: "Wife of Kashyapa, a daughter of Daksha; mother of the locusts. SB 6.6.21-22",
});
person("Kashtha", {
  family: DK,
  gender: "female",
  note:
    "Wife of Kashyapa, a daughter of Daksha; mother of every hoofed animal whose hoof does not split, the horse foremost among them. SB 6.6.29-31",
});
person("SaramaKashyap", {
  name: "Sarama",
  family: DK,
  gender: "female",
  note:
    "Wife of Kashyapa, a daughter of Daksha; mother of the tigers, lions and other predatory beasts. Not Sarama the rakshasi who comforted Sita in captivity, already in this tree as Vibhishana's wife. SB 6.6.24-26",
});
person("Timi", {
  family: DK,
  gender: "female",
  note: "Wife of Kashyapa, a daughter of Daksha; mother of every creature that lives in water. SB 6.6.24-26",
});
for (const wife of ["Patangi", "Yamini", "Kashtha", "SaramaKashyap", "Timi"]) {
  union(`u_kashyap_${wife}`, ["Kashyap", wife], [], { family: DK });
}

// ===========================================================================
// 3. Two to Angiras (SB 6.6.19)
// ===========================================================================
person("Svadha", {
  family: DK,
  gender: "female",
  note: "Wife of Angiras, a daughter of Daksha; mother of the Pitrs, the ancestors to whom every shraddha offering is made. SB 6.6.2, 19",
});
person("SatiAngirasa", {
  name: "Sati",
  family: DK,
  gender: "female",
  note:
    "Wife of Angiras, a daughter of Daksha, and mother by him of the Atharvangirasa -- the fourth Veda, in verse form. Not the Sati of the Shiva story, another daughter of Daksha who shares only the name: a different wife, a different husband, and not in this tree, by the same decision that leaves Shiva out of it. SB 6.6.2, 19",
});
union("u_angiras_svadha", ["Angiras", "Svadha"], [], { family: DK });
union("u_angiras_sati", ["Angiras", "SatiAngirasa"], [], { family: DK });

// ===========================================================================
// 4. Two to a Krishashva who is not the Ikshvaku king (SB 6.6.20)
// ===========================================================================
person("KrishashvaRishi", {
  name: "Krishashva",
  family: null,
  anchor: { beside: "Kashyap" },
  note:
    "A husband of two of Daksha's daughters, Archis and Dhishana, by whom he fathered the comet Dhumaketu and four more sons. Not Krishashva the Ikshvaku king who came before Senajit, already in this tree several eras later -- the archive's own namesake table already lists them as distinct men. SB 6.6.2, 20",
});
person("ArcisKrishashva", {
  name: "Archis",
  family: DK,
  gender: "female",
  note:
    "Wife of the sage Krishashva, a daughter of Daksha; mother of the comet Dhumaketu. Not Archi, wife of Prithu -- a different woman the same word, arci ('flame'), also names. SB 6.6.2, 20",
});
person("Dhishana", {
  family: DK,
  gender: "female",
  note:
    "Wife of the sage Krishashva, a daughter of Daksha; mother of four sons -- Vedashira, Devala, Vayuna and Manu. Krishashva's first wife, Archis, mothered Dhumaketu alone; the text (SB 6.6.20) attributes each set of children to one wife, not both. SB 6.6.2, 20",
});
// The three person() calls above only take effect on a fresh build; all
// three already existed from the first draft, so the corrected notes are
// force-applied here too.
renote(
  "KrishashvaRishi",
  "A husband of two of Daksha's daughters, Archis and Dhishana, by whom he fathered the comet Dhumaketu and four more sons. Not Krishashva the Ikshvaku king who came before Senajit, already in this tree several eras later -- the archive's own namesake table already lists them as distinct men. SB 6.6.2, 20",
);
renote(
  "ArcisKrishashva",
  "Wife of the sage Krishashva, a daughter of Daksha; mother of the comet Dhumaketu. Not Archi, wife of Prithu -- a different woman the same word, arci ('flame'), also names. SB 6.6.2, 20",
);
renote(
  "Dhishana",
  "Wife of the sage Krishashva, a daughter of Daksha; mother of four sons -- Vedashira, Devala, Vayuna and Manu. Krishashva's first wife, Archis, mothered Dhumaketu alone; the text (SB 6.6.20) attributes each set of children to one wife, not both. SB 6.6.2, 20",
);

// Named children the notes above only referenced in prose: added directly,
// per SB 6.6.20's own attribution of Dhumaketu to Archis alone and the other
// four to Dhishana alone.
person("Dhumaketu", { family: DK, note: "Son of Krishashva and Archis; the comet, an ill omen given a father and a name of his own. SB 6.6.20" });
person("Vedashira", { family: DK, note: "Son of Krishashva and Dhishana. SB 6.6.20" });
person("Devala", {
  family: DK,
  note: "Son of Krishashva and Dhishana. Not the sage Devala of the Mahabharata, a much later figure sharing only the name. SB 6.6.20",
});
person("Vayuna", { family: DK, note: "Son of Krishashva and Dhishana. SB 6.6.20" });
person("ManuKrishashva", {
  name: "Manu",
  family: DK,
  note:
    "Son of Krishashva and Dhishana, sharing a common name ('the thinking one') rather than any connection to Svayambhuva or Vaivasvata Manu, both already in this tree. SB 6.6.20",
});
union("u_krishashvaR_arcis", ["KrishashvaRishi", "ArcisKrishashva"], ["Dhumaketu"], { family: DK });
union("u_krishashvaR_dhishana", ["KrishashvaRishi", "Dhishana"], ["Vedashira", "Devala", "Vayuna", "ManuKrishashva"], { family: DK });

// ===========================================================================
// 5. Connecting Prasuti to Daksha's existing children, where confirmed
// ===========================================================================
// u_daksha is the pre-existing 1-partner union (mother unconfirmed) that
// already holds Aditi, Diti, Danu, Kadru, Vinata, Chandra's twenty-seven
// nakshatra-wives, Surabhi, Tamra, Muni, Arishta, Surasa, Krodhavasha, Ira,
// Danayus, Khasa and Rati. All but Rati are confirmed Prasuti's (see header);
// Rati is split off first so adding Prasuti as second partner doesn't sweep
// her in unconfirmed.
if (unionsById.get("u_daksha")?.children.includes("Rati")) {
  const uDaksha = unionsById.get("u_daksha")!;
  uDaksha.children = uDaksha.children.filter((c) => c !== "Rati");
  uDaksha.updatedAt = STAMP;
  union("u_daksha_rati", ["Daksha"], [], {
    family: "familyBrahma",
    note:
      "Rati stays on her own union, mother unconfirmed: most sources call her Daksha's daughter without naming which wife, and at least one tradition (see her own note) has her born of Daksha's own perspiration, no mother at all. Not merged into u_daksha with her sisters, whose mother is confirmed as Prasuti.",
  });
  const rati = peopleById.get("Rati");
  if (rati) {
    rati.notes =
      "Goddess of desire; daughter of Daksha, wife of Kamadeva. Sources disagree on her mother: most simply call her Daksha's daughter, but one tradition holds she was born of Daksha's own perspiration, without a mother at all -- so, unlike her sisters, she is not attached to Prasuti here.";
    rati.updatedAt = STAMP;
  }
}

addPartner("u_daksha", "Prasuti");
for (const id of [
  "BhanuDharma", "Lamba", "Kakud", "YamiDharma", "Vishva", "Sadhya", "Marutvati",
  "VasuDharma", "Muhurta", "Sankalpa", "Patangi", "Yamini", "Kashtha",
  "SaramaKashyap", "Timi", "Svadha", "SatiAngirasa", "ArcisKrishashva", "Dhishana",
]) {
  addChild("u_daksha", id);
}

// u_daksha_prasuti was a separate, childless union for the same couple,
// created before this confirmation; retire it rather than leave a duplicate.
{
  const dup = unionsById.get("u_daksha_prasuti");
  if (dup && dup.children.length === 0) {
    data.unions = data.unions.filter((u) => u.id !== "u_daksha_prasuti");
    unionsById.delete("u_daksha_prasuti");
    const uDaksha = unionsById.get("u_daksha")!;
    uDaksha.notes =
      (uDaksha.notes ? uDaksha.notes + " " : "") +
      "Prasuti confirmed as mother of these children (all but Rati -- see u_daksha_rati) via SB 6.6 and, for Danayus and Khasa, the Vishnu Purana's naming of Panchajani -- the same figure this tree treats as Prasuti -- as their mother. Formerly split across this union and a separate childless u_daksha_prasuti; merged into one. SB 4.1.2's sixteen daughters by Prasuti and SB 6.6's sixty are, under this tree's single-Daksha reading, the same event told two ways, not two broods.";
    uDaksha.updatedAt = STAMP;
  }
}

// --- write ---------------------------------------------------------------
if (collisions.length) {
  console.error("add-daksha-daughters: refusing to write, id collisions:", collisions);
  process.exit(1);
}
const { errors } = validateData(data);
if (errors.length) {
  console.error("add-daksha-daughters: refusing to write, validateData errors:");
  for (const e of errors) console.error(" -", e);
  process.exit(1);
}
writeFileSync(PATH, JSON.stringify(data, null, 2) + "\n");
console.log(`add-daksha-daughters: +${addedPeople} people, +${addedUnions} unions`);
