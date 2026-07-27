/**
 * Splice the Puranic king-lists into the Hiranyagarbha showcase tree.
 *
 * This is the executable form of docs/PURANIC_LINEAGES.md. Every chain below
 * carries the citation it came from; the doc carries the same chains in prose
 * with the stories attached. EDIT THEM TOGETHER.
 *
 * Two things happen here, and only these two:
 *   1. Named kings are spliced INTO the tree, either between two people already
 *      linked by a union (`splice`) or hanging below someone (`descend`).
 *      Where a union carried a `childGap` standing in for "the texts name the
 *      father and a far descendant, not the kings between", the gap collapses to
 *      1 and the real names take those rows.
 *   2. Floating clans, which sat in the tree held only by a `genAnchor`, are
 *      grafted onto the trunk at the point the Puranas give (`graft`).
 *
 * Era anchors are NOT touched here. They are rewritten afterwards, by
 * scripts/reanchor-eras.ts, once everybody is present: only then is it knowable
 * which row Kurukshetra and the Ramayana actually land on.
 *
 * Idempotent: people and unions that already exist are left alone.
 *
 * Run: npm run add-lineages
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type {
  FamilyDataV2,
  Gender,
  PersonRecord,
  UnionRecord,
} from "../src/core/types";
import { validateData } from "../src/core/validate";

const here = dirname(fileURLToPath(import.meta.url));
const PATH = resolve(here, "../public/family-data.hiranyagarbha.json");
const data: FamilyDataV2 = JSON.parse(readFileSync(PATH, "utf8"));
const STAMP = "2026-07-27T00:00:00.000Z";

const peopleById = new Map(data.people.map((p) => [p.id, p]));
const unionsById = new Map(data.unions.map((u) => [u.id, u]));
const created = new Set<string>();
let addedPeople = 0;
let addedUnions = 0;

// --- primitives -------------------------------------------------------------

interface PersonSpec {
  /** Display name; defaults to the id. */
  name?: string;
  family?: string | null;
  gender?: Gender;
  /** Second name of a dual-life or renamed figure, shown opposite the primary. */
  alt?: string;
  note?: string;
  anchor?: number;
}

/** Ids this script tried to create that were already taken: silent name clashes. */
const collisions: string[] = [];

const person = (id: string, spec: PersonSpec = {}): string => {
  const existing = peopleById.get(id);
  if (existing) {
    // A clash only matters if the name was already taken by someone this script
    // did not write. Records it wrote on an earlier run carry STAMP, so a re-run
    // recognises its own work instead of reporting the whole batch as collisions.
    if (!created.has(id) && existing.updatedAt !== STAMP) collisions.push(id);
    return id;
  }
  created.add(id);
  const p: PersonRecord = {
    id,
    firstName: spec.alt ? `${spec.name ?? id} (${spec.alt})` : (spec.name ?? id),
    lastName: "",
    gender: spec.gender ?? "male",
    alive: true,
    birthFamilyId: spec.family === undefined ? null : spec.family,
    updatedAt: STAMP,
    ...(spec.note ? { notes: spec.note } : {}),
    ...(typeof spec.anchor === "number" ? { genAnchor: spec.anchor } : {}),
  };
  data.people.push(p);
  peopleById.set(id, p);
  addedPeople++;
  return id;
};

interface UnionSpec {
  family?: string | null;
  gap?: number;
  adopted?: string[];
  note?: string;
  status?: UnionRecord["status"];
}

const union = (
  id: string,
  partners: string[],
  children: string[],
  spec: UnionSpec = {},
): string => {
  const existing = unionsById.get(id);
  if (existing) {
    for (const c of children) if (!existing.children.includes(c)) existing.children.push(c);
    return id;
  }
  const u: UnionRecord = {
    id,
    partners,
    children,
    adoptedChildren: spec.adopted ?? [],
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

/** One link in a chain: an id, plus whatever the texts say about him. */
type King = string | (PersonSpec & { id: string });
const spec = (k: King): PersonSpec & { id: string } =>
  typeof k === "string" ? { id: k } : k;

/**
 * Lay a father-to-son chain below `from`, ending at `to` when given. Each king
 * gets his own single-partner union, because the Puranas name the succession,
 * not the queens.
 */
const chain = (
  from: string,
  kings: King[],
  family: string | null,
  to?: string,
  opts: { tailGap?: number; tailNote?: string; skipFirstLink?: boolean } = {},
): string => {
  let prev = from;
  for (const [i, k] of kings.entries()) {
    const s = spec(k);
    person(s.id, { family, ...s });
    // The first link is skipped when the caller has already re-pointed an
    // existing union at kings[0] (see `splice`), so the edge isn't drawn twice.
    if (!(i === 0 && opts.skipFirstLink)) {
      union(`u_${prev}_${s.id}`, [prev], [s.id], { family });
    }
    prev = s.id;
  }
  if (to) {
    union(`u_${prev}_${to}`, [prev], [to], {
      family,
      gap: opts.tailGap,
      note: opts.tailNote,
    });
  }
  return prev;
};

/**
 * Insert a chain between a union's partner and one of its children: the child
 * is detached, the chain takes its place, and the child hangs off the last king.
 * This is what turns a `childGap: 8` placeholder into eight named rows.
 */
const splice = (
  unionId: string,
  child: string,
  kings: King[],
  family: string | null,
): void => {
  const u = unionsById.get(unionId);
  if (!u) throw new Error(`splice: no union "${unionId}"`);
  const first = spec(kings[0]);
  const at = u.children.indexOf(child);
  if (at < 0) {
    if (u.children.includes(first.id)) return; // already spliced on an earlier run
    throw new Error(`splice: "${child}" is not a child of "${unionId}"`);
  }
  u.children[at] = first.id;
  delete u.childGap;
  u.updatedAt = STAMP;
  chain(u.partners[0], kings, family, child, { skipFirstLink: true });
};

/** Hang a floating clan off the trunk: `ancestor` becomes the parent of `head`. */
const graft = (
  ancestor: string,
  head: string,
  family: string | null,
  gap: number,
  note: string,
): void => {
  union(`u_${ancestor}_${head}`, [ancestor], [head], { family, gap, note });
};

const family = (id: string, name: string, color: string, note?: string): string => {
  if (!data.families[id]) data.families[id] = { name, color, ...(note ? { note } : {}) };
  return id;
};

const note = (id: string, text: string): void => {
  const p = peopleById.get(id);
  if (p) {
    p.notes = text;
    p.updatedAt = STAMP;
  }
};

// ============================================================================
// New families
// ============================================================================

const NISHADHA = family("familyNishadha", "Nishadha", "#8c7fbf",
  "Nala's janapada, distinct from the Nishada forest tribe of Ekalavya");
const USHINARA = family("familyUshinara", "Ushinara", "#d4a05a");
const HAIHAYA = family("familyHaihaya", "Haihaya", "#c25b4e");
const TURVASU = family("familyTurvasu", "Turvasu", "#6fae7d");
const DRUHYU = family("familyDruhyu", "Druhyu", "#9d8ac4");
const KAUSHIKA = family("familyKaushika", "Kaushika", "#c9a23f");
const YAVANA = family("familyYavana", "Yavana", "#7a8fa3");
const SAUBHARI = family("familySaubhari", "Saubhari", "#bfae7a");

const IKSHVAKU = "familyIkshvaku";
const VIDEHA = "familyVideha";
const SOMA = "familySoma";
const KURU = "familyKuru";
const KASHI = "familyKashi";
const ANGA = "familyAnga";
const GANDHARA = "familyGandhara";
const MADRA = "familyMadra";
const KEKAYA = "familyKekaya";
const VIDARBHA = "familyVidarbha";
const YADAVA = "familyYadava";
const MATSYA = "familyMatsya";
const CHEDI = "familyChedi";
const PANCHALA = "familyPanchala";
const BRAHMA = "familyBrahma";

// ============================================================================
// PART I.1 — Solar trunk: Ikshvaku to Rama.  SB 9.6.4 - 9.10.1
// ============================================================================

// Ikshvaku -> Mandhata, seventeen kings where the tree had one step.  SB 9.6.4-37
splice("r_u_ikshvaku", "Mandhata", [
  { id: "Vikukshi", alt: "Shashada",
    note: "Eldest of Ikshvaku's hundred sons. Banished for eating a hare from the sacrificial offering, hence Shashada, the hare-eater; recalled to the throne at his father's death. SB 9.6.6-8" },
  { id: "Puranjaya", alt: "Kakutstha",
    note: "Fought the demons for the devas mounted on Indra, who had taken the form of a bull: seated on its hump he is Kakutstha, and as the vehicle of Indra, Indravaha. SB 9.6.11-15" },
  { id: "Anena", note: "Son of Puranjaya. SB 9.6.16" },
  { id: "PrithuI", name: "Prithu",
    note: "Fifth of the solar kings. Not Vena's son Prithu, for whom the earth is named. SB 9.6.16" },
  { id: "Vishvagandhi", note: "SB 9.6.16" },
  { id: "ChandraI", name: "Chandra", note: "Son of Vishvagandhi. Not Chandra Deva of the lunar line. SB 9.6.17" },
  { id: "YuvanashvaI", name: "Yuvanashva", note: "SB 9.6.17" },
  { id: "Shravasta", note: "Built Shravasti Puri, the city that kept his name. SB 9.6.20" },
  { id: "Brihadashva", note: "SB 9.6.20" },
  { id: "Kuvalayashva", alt: "Dhundhumara",
    note: "Killed the demon Dhundhu with twenty-one thousand sons at his side, and took the name Dhundhumara, slayer of Dhundhu. All but three of the sons burned in the fire the demon breathed. SB 9.6.21-24" },
  { id: "Dridhashva", note: "One of the three sons who survived Dhundhu's fire, with Kapilashva and Bhadrashva. SB 9.6.23-24" },
  { id: "HaryashvaI", name: "Haryashva", note: "SB 9.6.24" },
  { id: "NikumbhaI", name: "Nikumbha", note: "Son of Haryashva. Not the rakshasa Nikumbha of Lanka. SB 9.6.24" },
  { id: "Bahulashva", note: "SB 9.6.24" },
  { id: "Krishashva", note: "SB 9.6.24" },
  { id: "Senajit", note: "SB 9.6.24" },
  { id: "YuvanashvaII", name: "Yuvanashva",
    note: "A hundred wives and no son. The sages held an Indra-yajna for him in the forest; thirsty in the night he drank the consecrated water himself, and in time bore the child from his own right side. SB 9.6.25-32" },
], IKSHVAKU);

note("Mandhata",
  "Born from his father Yuvanashva's side. Crying for milk, he was given Indra's own index finger to suck, the deva saying mam ayam dhasyati, he shall suck me: hence Mandhata. Emperor of all seven islands, from where the sun rises to where it sets. Also called Trasaddasyu, because thieves trembled at him. SB 9.6.33-37");

// Mandhata -> Harishchandra, seven kings.  SB 9.7.1-7
splice("r_u_mandhata", "Harishchandra", [
  { id: "Purukutsa",
    note: "Given Narmada, sister of the Nagas, by her serpent brothers; she carried him down to Rasatala where, empowered by Vishnu, he killed the Gandharvas. Whoever remembers it is safe from snakes. SB 9.7.2-3; RV 6.20.10" },
  { id: "Trasaddasyu",
    note: "Bears his great-grandfather's epithet as his name. In the Rigveda he is called ardhadeva, half-god, a word used of no one else. SB 9.7.4; RV 4.42.8-9" },
  { id: "Anaranya", note: "SB 9.7.4" },
  { id: "HaryashvaII", name: "Haryashva", note: "SB 9.7.4" },
  { id: "Praruna", note: "SB 9.7.4" },
  { id: "Tribandhana", note: "SB 9.7.4" },
  { id: "Trishanku", alt: "Satyavrata",
    note: "Cursed by his own father into a chandala for carrying off a brahmin's bride at her wedding. Vishvamitra sent him bodily to heaven; the devas threw him back; Vishvamitra stopped him mid-fall, and he hangs there yet, head downward. SB 9.7.5-6" },
], IKSHVAKU);

note("Harishchandra",
  "The king who kept his word past every ruin. Over him Vishvamitra and Vasishtha quarrelled so long that both were turned into birds and fought on as birds for years. Sonless, he begged a son of Varuna against the promise of sacrificing him. SB 9.7.7-8");

// Harishchandra -> Sagara, eight kings.  SB 9.8.1-2
splice("r_u_harishchandra", "Sagara", [
  { id: "Rohita",
    note: "The son promised to Varuna before his birth and deferred past every excuse; he took bow and arrows to the forest to stay alive, and came back six years later having bought Shunahshepha in his place. SB 9.7.9-20" },
  { id: "Harita", note: "SB 9.8.1" },
  { id: "Champa", note: "Built Champapuri, which later became the capital of Anga. SB 9.8.1" },
  { id: "SudevaI", name: "Sudeva", note: "SB 9.8.1" },
  { id: "VijayaI", name: "Vijaya", note: "SB 9.8.1" },
  { id: "Bharuka", note: "SB 9.8.1" },
  { id: "VrikaI", name: "Vrika", note: "SB 9.8.2" },
  { id: "Bahuka", alt: "Asita",
    note: "Driven out by his enemies, he died in the forest. His pregnant widow was poisoned by her co-wives but the child was born alive, carrying the poison: sa-gara. SB 9.8.2-5" },
], IKSHVAKU);

// Dilipa I, between Amshuman and Bhagiratha.  SB 9.9.1
splice("r_u_amshuman", "Bhagiratha", [
  { id: "DilipaI", name: "Dilipa",
    note: "Tried to bring the Ganga down to redeem Sagara's sons and died without succeeding. Not the Dilipa of the Raghuvamsha, who is four generations below Khatvanga. SB 9.9.1" },
], IKSHVAKU);

// Bhagiratha -> Dilipa II, fifteen kings.  SB 9.9.16-49
splice("r_u_bhagiratha", "Dilipa", [
  { id: "ShrutaI", name: "Shruta", note: "Son of Bhagiratha. SB 9.9.16" },
  { id: "Nabha", note: "SB 9.9.16" },
  { id: "Sindhudvipa", note: "SB 9.9.16" },
  { id: "Ayutayu", note: "SB 9.9.16" },
  { id: "Rituparna",
    note: "King of Ayodhya, and the friend of Nala. He gave Nala the akshahridaya, the heart of the dice, and took from him the ashvavidya, the science of horses. Nala served in his kitchen and at his reins under the name Bahuka. SB 9.9.16-17; MBh 3.65-70" },
  { id: "Sarvakama", note: "SB 9.9.18" },
  { id: "SudasaI", name: "Sudasa", note: "Not Sudasa of Panchala, nor the Rigvedic Sudas Paijavana of the Bharatas. SB 9.9.18" },
  { id: "Saudasa", alt: "Kalmashapada",
    note: "Also Mitrasaha. Cursed by Vasishtha into a rakshasa; in that state he devoured a brahmin, and the widow cursed him to die at his next embrace. Twelve years sonless, he let Vasishtha beget his heir on his queen Madayanti. SB 9.9.20-38" },
  { id: "Ashmaka",
    note: "Carried for years and finally born when Vasishtha struck his mother's womb with a stone, ashman. SB 9.9.38" },
  { id: "Balika", alt: "Mulaka",
    note: "Survived Parashurama's purge of the kshatriyas screened by a ring of women, hence Narikavacha, armoured in women; and because the kshatriyas began again from him, Mulaka, the root. SB 9.9.39-40" },
  { id: "DasharathaI", name: "Dasharatha", note: "Son of Balika, and not the father of Rama. SB 9.9.41" },
  { id: "Aidavidi", note: "SB 9.9.41" },
  { id: "Vishvasaha", note: "SB 9.9.41" },
  { id: "Khatvanga",
    note: "Fought at the devas' side and won; offered a boon, he asked only how long he had to live, was told a few moments, left heaven at once and gave those moments entirely to Hari. SB 9.9.41-49" },
], IKSHVAKU);

note("Dilipa",
  "Dilipa II, also Dirghabahu, son of Khatvanga. The ideal king of Kalidasa's Raghuvamsha, whose service of the divine cow Nandini won him his son Raghu. SB 9.10.1");
const dilipa = peopleById.get("Dilipa");
if (dilipa) {
  dilipa.firstName = "Dilipa (Dirghabahu)";
  dilipa.updatedAt = STAMP;
}

// ============================================================================
// PART I.2 — Solar trunk: Rama to Brihadbala.  SB 9.12.1-9
// ============================================================================

for (const [u, child] of [
  ["r_u_kusha", "Atithi"],
  ["r_u_atithi", "Nishadha"],
] as const) {
  const uu = unionsById.get(u);
  if (uu) {
    delete uu.childGap;
    uu.updatedAt = STAMP;
  }
  void child;
}

splice("r_u_nishadha", "Hiranyanabha", [
  { id: "NabhaI", name: "Nabha", note: "Son of Nishadha. SB 9.12.1" },
  { id: "Pundarika", note: "SB 9.12.1" },
  { id: "Kshemadhanva", note: "SB 9.12.1" },
  { id: "Devanika", note: "SB 9.12.1" },
  { id: "Aniha", note: "SB 9.12.2" },
  { id: "Pariyatra", note: "SB 9.12.2" },
  { id: "Balasthala", note: "SB 9.12.2" },
  { id: "Vajranabha", note: "Said to be born of the sun's effulgence. SB 9.12.2" },
  { id: "Sagana", note: "SB 9.12.2" },
  { id: "Vidhriti", note: "SB 9.12.2" },
], IKSHVAKU);

note("Hiranyanabha",
  "Disciple of Jaimini, master of the yoga of the mystics, and the teacher from whom Yajnavalkya received that yoga. SB 9.12.3-4");

splice("r_u_hiranyanabha", "Maru", [
  { id: "Pushpa", note: "SB 9.12.4" },
  { id: "Dhruvasandhi", note: "SB 9.12.4" },
  { id: "Sudarshana", note: "SB 9.12.5" },
  { id: "Agnivarna", note: "The last king the Raghuvamsha follows. SB 9.12.5" },
  { id: "Shighra", note: "SB 9.12.5" },
], IKSHVAKU);

note("Maru",
  "Perfected in yoga and living still, the Puranas say, in the village of Kalapa. At the end of the age of Kali he will begin the solar dynasty again. SB 9.12.5-6");

splice("r_u_maru", "Brihadbala", [
  { id: "Prasushruta", note: "SB 9.12.6" },
  { id: "Sandhi", note: "SB 9.12.6" },
  { id: "Amarshana", note: "SB 9.12.6" },
  { id: "Mahasvan", note: "SB 9.12.7" },
  { id: "Vishvabahu", note: "SB 9.12.7" },
  { id: "PrasenajitI", name: "Prasenajit", note: "SB 9.12.7" },
  { id: "TakshakaI", name: "Takshaka", note: "Son of Prasenajit. Not Takshaka the Naga who killed Parikshit. SB 9.12.7" },
], IKSHVAKU);

note("Brihadbala",
  "The last of the solar kings the Purana counts as past: he fought at Kurukshetra on the Kaurava side and was killed by Abhimanyu. He and Abhimanyu therefore stand on the same generation, which is what fixes the war's place in this whole tree. SB 9.12.8-9");

// ============================================================================
// PART II.12 — Videha, from Nimi.  SB 9.13.1-27
// ============================================================================

const ikshvakuUnion = unionsById.get("r_u_ikshvaku");
person("Nimi", { family: IKSHVAKU,
  note: "Second son of Ikshvaku. He would not wait for Vasishtha to finish Indra's sacrifice before beginning his own, and the two cursed each other's bodies to fall. From his preserved body, churned by the sages, Janaka was born. SB 9.13.1-11" });
if (ikshvakuUnion && !ikshvakuUnion.children.includes("Nimi")) ikshvakuUnion.children.push("Nimi");

chain("Nimi", [
  { id: "MithiJanaka", name: "Janaka", alt: "Mithi",
    note: "Born of no womb, from the churning of his father's body: hence Vaideha, the bodiless-born, and Mithi, the churned, and Mithila for the city he founded. Every king of this line is called Janaka after him. SB 9.13.12-13" },
  { id: "Udavasu", note: "SB 9.13.13" },
  { id: "Nandivardhana", note: "SB 9.13.13" },
  { id: "Suketu", note: "SB 9.13.14" },
  { id: "DevarataV", name: "Devarata", note: "Not Shunahshepha, whom Vishvamitra adopted under the same name. SB 9.13.14" },
  { id: "BrihadrathaV", name: "Brihadratha", note: "SB 9.13.14" },
  { id: "Mahavirya", note: "SB 9.13.14" },
  { id: "Sudhriti", note: "SB 9.13.15" },
  { id: "DhrishtaketuV", name: "Dhrishtaketu", note: "SB 9.13.15" },
  { id: "HaryashvaV", name: "Haryashva", note: "SB 9.13.15" },
  { id: "MaruV", name: "Maru", note: "Not Maru of Kalapa in the Ikshvaku line. SB 9.13.15" },
  { id: "Pratipaka", note: "SB 9.13.16" },
  { id: "Kritaratha", note: "SB 9.13.16" },
  { id: "Devamidha", note: "SB 9.13.16" },
  { id: "Vishruta", note: "SB 9.13.16" },
  { id: "Mahadhriti", note: "SB 9.13.17" },
  { id: "Kritirata", note: "SB 9.13.17" },
  { id: "Maharoma", note: "SB 9.13.17" },
  { id: "Svarnaroma", note: "SB 9.13.17" },
], VIDEHA, "Hrasvaroma");

note("Janaka",
  "Siradhvaja, the Janaka of the Ramayana. Ploughing the sacrificial ground he turned up Sita from the furrow, sira, and took her as his daughter. SB 9.13.18-19");

chain("Kushadhvaja", [
  { id: "Dharmadhvaja", note: "SB 9.13.20" },
  { id: "Kritadhvaja", note: "SB 9.13.21" },
  { id: "Keshidhvaja", note: "A self-realized king; his cousin Khandikya was expert in ritual, and the two exchanged what each lacked. SB 9.13.21-22" },
], VIDEHA);
person("Mitadhvaja", { family: VIDEHA, note: "Brother of Kritadhvaja. SB 9.13.21" });
union("u_Dharmadhvaja_Mitadhvaja", ["Dharmadhvaja"], ["Mitadhvaja"], { family: VIDEHA });
person("Khandikya", { family: VIDEHA, note: "Son of Mitadhvaja, master of ritual, who fled Keshidhvaja and later taught him karma-kanda in exchange for knowledge of the self. SB 9.13.22" });
union("u_Mitadhvaja_Khandikya", ["Mitadhvaja"], ["Khandikya"], { family: VIDEHA });

// ============================================================================
// PART III.3 — Mandhata's household, and Saubhari.  SB 9.6.38-55
// ============================================================================

person("Shashabindu", { family: YADAVA, gender: "male",
  note: "Yadava emperor of the world, a great mystic who held fourteen jewels; ten thousand wives and a lakh of sons by each. His daughter Bindumati married Mandhata of the solar line, and their two houses meet in her. SB 9.23.31-32" });
person("Bindumati", { family: YADAVA, gender: "female",
  note: "Daughter of the Yadava emperor Shashabindu; queen of Mandhata, mother of Purukutsa, Ambarisha and Muchukunda and of fifty daughters. The cleanest marriage between the solar and lunar lines in the Puranas. SB 9.6.38" });

const mandhataUnion = unionsById.get("r_u_mandhata");
if (mandhataUnion) {
  if (!mandhataUnion.partners.includes("Bindumati")) mandhataUnion.partners.push("Bindumati");
  mandhataUnion.updatedAt = STAMP;
}

person("AmbarishaM", { name: "Ambarisha", family: IKSHVAKU,
  note: "Son of Mandhata, and the most prominent of the three; accepted as son by his own grandfather Yuvanashva. Not Ambarisha the devotee, of Nabhaga's branch, whom Durvasa cursed. SB 9.7.1" });
person("Muchukunda", { family: IKSHVAKU,
  note: "Son of Mandhata. He guarded the devas through a war of ages until Kartikeya came to relieve him, and when they offered him any boon but liberation he asked for sleep, and that whoever woke him should burn. He slept in a cave through the ages. Krishna led Kalayavana into that cave; Kalayavana kicked the sleeping man, and was ash before he understood. Then Muchukunda, who had lain down in his father's age, opened his eyes on Vishnu. SB 9.6.38, 10.51" });
if (mandhataUnion) {
  for (const c of ["AmbarishaM", "Muchukunda"]) {
    if (!mandhataUnion.children.includes(c)) mandhataUnion.children.push(c);
  }
}

chain("AmbarishaM", [
  { id: "Yauvanashva", note: "Son of Ambarisha. SB 9.7.1" },
  { id: "HaritaM", name: "Harita", note: "With Ambarisha and Yauvanashva, one of the three most prominent in Mandhata's line. SB 9.7.1" },
], IKSHVAKU);

person("MandhatriKanya", { name: "Mandhatri", family: IKSHVAKU, gender: "female",
  note: "One of the fifty daughters of Mandhata and Bindumati. The Puranas name none of them individually, so she stands here for all fifty, who chose Saubhari together and then quarrelled over him, each certain he was hers alone. SB 9.6.38-44" });
if (mandhataUnion && !mandhataUnion.children.includes("MandhatriKanya")) {
  mandhataUnion.children.push("MandhatriKanya");
}

person("Saubhari", { family: SAUBHARI,
  note: "Deep in the Yamuna at his austerity he watched a pair of fish mate, and desire took him. He asked Mandhata for a daughter; the king, seeing grey hair and a trembling head, said only that his daughters chose for themselves. So Saubhari made himself young, and all fifty chose him. By his mantras he built each of them a palace, and in his own words: I became the husband of fifty wives, and in each of them I begot one hundred sons, and thus my family increased to five thousand. Then he saw what the fish had cost him, took vanaprastha, and his wives followed him. SB 9.6.39-55" });
union("u_saubhari", ["Saubhari", "MandhatriKanya"], [], { family: SAUBHARI,
  note: "One marriage standing for fifty. Their five thousand sons are named nowhere. SB 9.6.52" });

person("Narmada", { gender: "female",
  note: "Sister of the Nagas, given to Purukutsa by her serpent brothers at Vasuki's bidding, and the river of that name. SB 9.7.2" });
union("u_purukutsa_narmada", ["Purukutsa", "Narmada"], [], { family: IKSHVAKU });

// ============================================================================
// PART III.2 — Kalayavana.  SB 10.50-51; VP 5.23; HV 58
// ============================================================================

person("Gargya", { family: BRAHMA,
  note: "A brahmin of Garga's line, mocked as impotent by Syala in the Yadava assembly. He went to the western sea and lived twelve years on iron filings until Shiva granted him a son who would break the Yadavas. HV 58; VP 5.23" });
person("Gopali", { gender: "female",
  note: "The apsara who took the form of a cowherd woman and bore Gargya his son. Called Rambha in some recensions. HV 58" });
person("Kalayavana", { family: YAVANA,
  note: "Born of Gargya and the apsara Gopali, and raised by the childless king of the Yavanas. Narada pointed him at Mathura and he came with thirty million soldiers. Krishna, carrying no weapon, ran from him into a mountain cave, where Kalayavana kicked a sleeping man he took for Krishna, and Muchukunda's first waking glance burned him to ash. SB 10.50-51" });
person("YavanaRaja", { name: "Yavanaraja", family: YAVANA,
  note: "The childless king of the Yavanas, Gargya's friend, who raised Kalayavana as his own. VP 5.23" });
union("u_gargya_gopali", ["Gargya", "Gopali"], ["Kalayavana"], { family: YAVANA, status: "partners" });
union("u_yavanaraja", ["YavanaRaja"], [], { family: YAVANA, adopted: ["Kalayavana"] });

// ============================================================================
// PART III.4 — Shunahshepha.  SB 9.7.20-26; AB 7.13-18
// ============================================================================

person("Ajigarta", { family: BRAHMA,
  note: "A starving brahmin who sold his middle son to be Harishchandra's sacrifice, and took a further fee to hold the knife himself. SB 9.7.20; AB 7.13-16" });
person("Shunahshepha", { family: BRAHMA, alt: "Devarata",
  note: "Bought by Rohita to die in his place, he praised the devas from the stake until his bonds fell away. Vishvamitra adopted him as Devarata, god-given, over the protests of his own sons. His brothers were Shunahpuccha and Shunolangula. SB 9.7.20-26; AB 7.13-18" });
person("Shunahpuccha", { family: BRAHMA, note: "Eldest son of Ajigarta, whom his father would not sell. AB 7.15" });
person("Shunolangula", { family: BRAHMA, note: "Youngest son of Ajigarta, whom his mother would not give. AB 7.15" });
union("u_ajigarta", ["Ajigarta"], ["Shunahpuccha", "Shunahshepha", "Shunolangula"], { family: BRAHMA });
union("u_vishvamitra_devarata", ["Vishvamitra"], [], { family: KAUSHIKA, adopted: ["Shunahshepha"] });

// ============================================================================
// PART I.3 — Lunar trunk
// ============================================================================

// Puru -> Dushyanta, fourteen kings.  SB 9.20.1-7
splice("u_puru", "Dushyanta", [
  { id: "JanamejayaP", name: "Janamejaya", note: "Son of Puru. Not Parikshit's son. SB 9.20.1" },
  { id: "Prachinvan", note: "SB 9.20.1" },
  { id: "Pravira", note: "SB 9.20.2" },
  { id: "Manusyu", note: "SB 9.20.2" },
  { id: "Charupada", note: "SB 9.20.2" },
  { id: "Sudyu", note: "SB 9.20.2" },
  { id: "Bahugava", note: "SB 9.20.2" },
  { id: "Samyati", note: "SB 9.20.3" },
  { id: "Ahamyati", note: "SB 9.20.3" },
  { id: "Raudrashva",
    note: "Ten sons by the apsara Ghritachi: Riteyu, Kaksheyu, Sthandileyu, Kriteyuka, Jaleyu, Sannateyu, Dharmeyu, Satyeyu, Vrateyu and Vaneyu. SB 9.20.3-4" },
  { id: "Riteyu", note: "Eldest of Raudrashva's ten. SB 9.20.5" },
  { id: "Rantinava", note: "Three sons: Sumati, Dhruva and Apratiratha, whose son Kanva raised Shakuntala. SB 9.20.6" },
  { id: "SumatiP", name: "Sumati", note: "SB 9.20.7" },
  { id: "Rebhi", note: "SB 9.20.7" },
], SOMA);

person("Apratiratha", { family: SOMA, note: "Son of Rantinava. SB 9.20.6" });
union("u_Rantinava_Apratiratha", ["Rantinava"], ["Apratiratha"], { family: SOMA });
person("Kanva", { family: BRAHMA,
  note: "Son of Apratiratha, kshatriya-born and a brahmin by life. He found the infant Shakuntala in the forest where Menaka had left her, brought her to his ashram and raised her; it was under his roof that Dushyanta met her. SB 9.20.6-11" });
union("u_Apratiratha_Kanva", ["Apratiratha"], ["Kanva"], { family: BRAHMA });
person("Medhatithi", { family: BRAHMA, note: "Son of Kanva; his sons, headed by Praskanna, were all brahmins. SB 9.20.7" });
union("u_Kanva_Medhatithi", ["Kanva"], ["Medhatithi"], { family: BRAHMA });
union("u_Kanva_Shakuntala", ["Kanva"], [], { family: BRAHMA, adopted: ["Shakuntala"] });

// Bharata -> Hastin, three kings.  SB 9.20.37-38, 9.21.19-21
splice("u_bharata", "Hastin", [
  { id: "Vitatha", alt: "Bharadvaja",
    note: "Bharata's sacrifices gave him no worthy heir, and Bharadvaja, the son Brihaspati begot on Mamata, was given to him instead: given away he is Vitatha, the one who was otherwise. The same sage appears in this tree in his own right, in the Angirasa line, as the father of Drona. SB 9.20.37-38" },
  { id: "Manyu", note: "Five sons: Brihatkshatra, Jaya, Mahavirya, Nara and Garga. SB 9.21.19" },
  { id: "Brihatkshatra", note: "Eldest of Manyu's five. SB 9.21.19, 9.21.21" },
], SOMA);

note("Hastin", "Son of Brihatkshatra; he built Hastinapura, which carries his name. SB 9.21.21");

person("Nara", { family: SOMA, note: "Son of Manyu. SB 9.21.19" });
union("u_Manyu_Nara", ["Manyu"], ["Nara"], { family: SOMA });
person("Sankriti", { family: SOMA, note: "Son of Nara; father of Guru and of Rantideva. SB 9.21.1" });
union("u_Nara_Sankriti", ["Nara"], ["Sankriti"], { family: SOMA });
person("Rantideva", { family: SOMA,
  note: "He gave away his own food until he and his household fasted. After forty-eight days without even water, food came, and with it a brahmin guest, then a shudra, then a stranger, then a thirsty man for the last of the water: he gave each of them everything, and asked for nothing but that all beings be free of suffering. SB 9.21.2-18" });
person("Guru", { family: SOMA, note: "Brother of Rantideva. SB 9.21.1" });
union("u_Sankriti", ["Sankriti"], ["Guru", "Rantideva"], { family: SOMA });
person("Garga", { family: SOMA, note: "Son of Manyu; his line, kshatriya by birth, became brahmins. SB 9.21.19, 9.21.31" });
union("u_Manyu_Garga", ["Manyu"], ["Garga"], { family: SOMA });
union("u_Garga_Gargya", ["Garga"], ["Gargya"], { family: BRAHMA, gap: 2,
  note: "Garga's son was Shini and Shini's son Gargya, kshatriya-born and brahmin by practice. SB 9.21.31" });

// Panchala fill: Ajamidha -> Arka.  SB 9.21.25-33
splice("u_Ajamidha_Arka", "Arka", [
  { id: "NilaP", name: "Nila", note: "Son of Ajamidha by Nalini. Not Nila the vanara commander. SB 9.21.32" },
  { id: "ShantiP", name: "Shanti", note: "SB 9.21.32" },
  { id: "Sushanti", note: "SB 9.21.32" },
  { id: "Puruja", note: "SB 9.21.32" },
], PANCHALA);

// Kuru's other sons, and the branch to Uparichara Vasu.  SB 9.22.4-8
const kuruUnion = unionsById.get("u_kuru_to_pratipa");
for (const [id, n] of [
  ["Parikshi", "Eldest son of Kuru, who left no sons. SB 9.22.4, 9.22.9"],
  ["Sudhanu", "Son of Kuru, from whom the line runs to Uparichara Vasu and thence to Magadha, Matsya and Chedi. SB 9.22.4-6"],
  ["JahnuK", "Son of Kuru. The Bhagavata runs the Kuru succession through him; this tree keeps the Mahabharata's line through Viduratha, and both are recorded. SB 9.22.4, 9.22.9"],
  ["NishadhaK", "Youngest son of Kuru. Not Nishadha of the solar line, nor Nala's kingdom. SB 9.22.4"],
] as const) {
  person(id, { name: id === "JahnuK" ? "Jahnu" : id === "NishadhaK" ? "Nishadha" : id, family: KURU, note: n });
  if (kuruUnion && !kuruUnion.children.includes(id)) kuruUnion.children.push(id);
}

chain("Sudhanu", [
  { id: "SuhotraK", name: "Suhotra", note: "SB 9.22.5" },
  { id: "ChyavanaK", name: "Chyavana", note: "Not Chyavana the Bhargava sage, nor Chyavana of Panchala. SB 9.22.5" },
  { id: "Kriti", note: "SB 9.22.5" },
], KURU);

person("UparicharaVasu", { name: "Uparichara Vasu", family: KURU,
  note: "King of Chedi, called Uparichara, the sky-goer, for the crystal chariot Indra gave him. His sons became the kings of Chedi, of Magadha and of Matsya, and his daughter, born of a fish, became Satyavati. SB 9.22.6; MBh 1.57" });
union("u_Kriti_UparicharaVasu", ["Kriti"], ["UparicharaVasu"], { family: KURU });

person("Girika", { gender: "female", family: KURU, note: "Queen of Uparichara Vasu. MBh 1.57" });
for (const [id, n] of [
  ["Kushamba", "Son of Uparichara Vasu, a king of Chedi. SB 9.22.6"],
  ["Pratyagra", "Son of Uparichara Vasu, a king of Chedi. SB 9.22.6"],
  ["Cedipa", "Son of Uparichara Vasu, and the king from whom the Chedis take their name. SB 9.22.6"],
] as const) person(id, { family: CHEDI, note: n });
union("u_uparichara_girika", ["UparicharaVasu", "Girika"], ["Kushamba", "Pratyagra", "Cedipa"], { family: CHEDI });
const upariUnion = unionsById.get("u_uparichara_girika");
if (upariUnion && !upariUnion.children.includes("Brihadratha")) upariUnion.children.push("Brihadratha");

person("Adrika", { gender: "female",
  note: "An apsara cursed into a fish in the Yamuna. She swallowed the seed of Uparichara Vasu and bore twins: the boy who founded the Matsya kingdom, and the girl Satyavati, who was raised by fishermen. MBh 1.57" });
person("MatsyaKing", { name: "Matsya", family: MATSYA,
  note: "Born of the fish with his sister Satyavati; the Matsya kingdom keeps his name. Also counted among Uparichara Vasu's sons at SB 9.22.6. MBh 1.57" });
const satyavatiP = peopleById.get("Satyavati");
if (satyavatiP && satyavatiP.birthFamilyId === null) {
  satyavatiP.birthFamilyId = MATSYA;
  satyavatiP.updatedAt = STAMP;
}
union("u_uparichara_adrika", ["UparicharaVasu", "Adrika"], ["MatsyaKing", "Satyavati"], {
  family: MATSYA, status: "partners",
  note: "The fish-born twins. MBh 1.57" });

// Ayus's other four sons.  SB 9.17.1
const ayusUnion = unionsById.get("u_ayus");
for (const [id, name, n] of [
  ["Kshatravriddha", "Kshatravriddha", "Son of Ayus, from whom the kings of Kashi descend. SB 9.17.1"],
  ["Raji", "Raji", "Son of Ayus. Indra gave him the kingdom of heaven for his help against the demons; his five hundred sons would not give it back, and Brihaspati's rites unmade their intelligence until Indra took it. SB 9.17.1, 9.17.10-17"],
  ["Rabha", "Rabha", "Son of Ayus. His line: Rabhasa, Gambhira, Akriya, Brahmavit. SB 9.17.1, 9.17.11"],
  ["AnenaS", "Anena", "Son of Ayus. His line: Shuddha, Shuchi, Chitrakrit, Shantaraja. Not Anena of the solar line. SB 9.17.1, 9.17.11"],
] as const) {
  person(id, { name, family: SOMA, note: n });
  if (ayusUnion && !ayusUnion.children.includes(id)) ayusUnion.children.push(id);
}

// ============================================================================
// PART II.1 — Kashi, from Kshatravriddha.  SB 9.17.1-9
// ============================================================================

chain("Kshatravriddha", [
  { id: "SuhotraKashi", name: "Suhotra", note: "Three sons: Kashya, Kusha and Gritsamada. SB 9.17.2" },
  { id: "Kashya", note: "SB 9.17.2-3" },
  { id: "Kashi", note: "The king from whom Kashi takes its name. SB 9.17.4" },
  { id: "Rashtra", note: "SB 9.17.4" },
  { id: "Dirghatama", note: "SB 9.17.4" },
  { id: "Dhanvantari",
    note: "Who brought medicine into the world: the founder of Ayurveda, and a shaktyavesha incarnation of Vasudeva. Merely remembering him, the Purana says, quiets disease. SB 9.17.4" },
  { id: "Ketuman", note: "SB 9.17.5" },
  { id: "BhimarathaKashi", name: "Bhimaratha", note: "SB 9.17.5" },
  { id: "DivodasaKashi", name: "Divodasa",
    note: "King of Kashi. One of the four to whom Yayati's daughter Madhavi was lent, and by her the father of Pratardana. Not Divodasa of Panchala. SB 9.17.5; MBh 5.113" },
  { id: "Pratardana", alt: "Dyuman",
    note: "Son of Divodasa of Kashi by Madhavi; called also Shatrujit, Vatsa, Ritadhvaja and Kuvalayashva. SB 9.17.5-6; MBh 5.113" },
  { id: "Alarka",
    note: "Reigned, the Purana says, sixty-six thousand years, and no other king enjoyed the earth so long in the vigour of youth. SB 9.17.6-7" },
], KASHI);

graft("Alarka", "Kashiraja", KASHI, 6,
  "Alarka's line runs on through Santati, Sunitha, Niketana, Dharmaketu, Satyaketu, Dhrishtaketu, Sukumara, Vitihotra, Bharga and Bhargabhumi, all of Kashi. Kashiraja, father of Amba, Ambika and Ambalika, stands at its end. SB 9.17.8-9");

// ============================================================================
// PART II.2 — Gandhara, from Druhyu.  SB 9.23.14-16
// ============================================================================

chain("Druhyu", [
  { id: "BabhruD", name: "Babhru", note: "Son of Druhyu. SB 9.23.14" },
  { id: "Setu", note: "SB 9.23.15" },
  { id: "Arabdha", note: "SB 9.23.15" },
  { id: "Gandhara", note: "The king from whom Gandhara takes its name. SB 9.23.15" },
], DRUHYU);

chain("Gandhara", [
  { id: "DharmaD", name: "Dharma", note: "SB 9.23.15" },
  { id: "Dhrita", note: "SB 9.23.15" },
  { id: "DurmadaD", name: "Durmada", note: "SB 9.23.15" },
  { id: "Praceta", note: "A hundred sons, who took the north of India and ruled there. SB 9.23.15-16" },
], DRUHYU);

graft("Gandhara", "Subala", GANDHARA, 8,
  "The texts fall silent between Gandhara and Subala, father of Gandhari and Shakuni. SB 9.23.15");

// ============================================================================
// PART II.3 — Ushinara, Shibi, Madra, Kekaya, from Anu.  SB 9.23.1-4
// ============================================================================

chain("Anu", [
  { id: "Sabhanara", note: "Eldest of Anu's three sons, with Chakshu and Pareshnu. SB 9.23.1" },
  { id: "Kalanara", note: "SB 9.23.1" },
  { id: "SrinjayaA", name: "Srinjaya", note: "SB 9.23.1" },
  { id: "JanamejayaA", name: "Janamejaya", note: "Son of Srinjaya of the Anu line. SB 9.23.2" },
  { id: "Mahashala", note: "SB 9.23.2" },
  { id: "Mahamana", note: "Two sons, Ushinara and Titikshu, and from them the two great Anu branches: Madra and Kekaya on one side, Anga and Karna's throne on the other. SB 9.23.2" },
], USHINARA);

person("Ushinara", { family: USHINARA,
  note: "King of the Bhojas. One of the four to whom Yayati's daughter Madhavi was lent, and by her the father of Shibi. SB 9.23.2-3; MBh 5.114" });
person("Titikshu", { family: USHINARA, note: "Brother of Ushinara; the Anga line descends from him. SB 9.23.2-4" });
union("u_Mahamana", ["Mahamana"], ["Ushinara", "Titikshu"], { family: USHINARA });

person("Shibi", { family: USHINARA,
  note: "Son of Ushinara by Madhavi. A hawk claimed a dove that had taken refuge with him, and rather than give up the one who trusted him he cut flesh from his own body to pay the weight. Four sons: Vrishadarbha, Sudhira, Madra and Kekaya. SB 9.23.3; MBh 3.131, 5.114" });
for (const [id, n] of [
  ["Vara", "Son of Ushinara. SB 9.23.3"],
  ["Krimi", "Son of Ushinara. SB 9.23.3"],
  ["DakshaU", "Son of Ushinara. Not Daksha the Prajapati. SB 9.23.3"],
] as const) person(id, { name: id === "DakshaU" ? "Daksha" : id, family: USHINARA, note: n });
union("u_Ushinara", ["Ushinara"], ["Vara", "Krimi", "DakshaU"], { family: USHINARA });

person("Vrishadarbha", { family: USHINARA, note: "Son of Shibi. SB 9.23.3" });
person("Sudhira", { family: USHINARA, note: "Son of Shibi. SB 9.23.3" });
person("MadraKing", { name: "Madra", family: MADRA, note: "Son of Shibi, and the king from whom Madra takes its name. SB 9.23.3" });
person("KekayaKing", { name: "Kekaya", family: KEKAYA, note: "Son of Shibi, called atma-tattva-vit, knower of the truth of the self; the Kekaya kingdom keeps his name. SB 9.23.3" });
union("u_Shibi", ["Shibi"], ["Vrishadarbha", "Sudhira", "MadraKing", "KekayaKing"], { family: USHINARA });

graft("MadraKing", "Dyutimanta", MADRA, 8,
  "Madra's line runs unnamed down to Dyutimanta, father of Shalya and Madri. SB 9.23.3");
graft("KekayaKing", "Ashvapati", KEKAYA, 6,
  "Kekaya's line runs unnamed down to Ashvapati, father of Kaikeyi and Yudhajit. SB 9.23.3");

// ============================================================================
// PART II.4 — Anga, Karna's throne, from Titikshu.  SB 9.23.4-14
// ============================================================================

chain("Titikshu", [
  { id: "Rushadratha", note: "SB 9.23.4" },
  { id: "Homa", note: "SB 9.23.4" },
  { id: "Sutapa", note: "SB 9.23.4" },
], ANGA);

person("BaliAnu", { name: "Bali", family: ANGA,
  note: "Emperor of the world in the Anu line, and sonless. Not Bali the Daitya, Prahlada's grandson. SB 9.23.4-5" });
union("u_Sutapa_BaliAnu", ["Sutapa"], ["BaliAnu"], { family: ANGA });
person("SudeshnaAnga", { name: "Sudeshna", gender: "female", family: ANGA,
  note: "Queen of Bali. Six sons by the sage Dirghatamas, each of whom took a kingdom in the east. SB 9.23.5-6" });
union("u_BaliAnu_Sudeshna", ["BaliAnu", "SudeshnaAnga"], [], { family: ANGA });

person("Dirghatamas", { family: BRAHMA,
  note: "The blind sage of the Rigveda, son of Mamata and Utathya, and by Bali's queen the father of Anga, Vanga, Kalinga, Suhma, Pundra and Odra: six kings and six kingdoms of the east. His own son by the maid Ushij was Kakshivan. SB 9.23.5; RV 1.140-164" });
person("Anga", { family: ANGA, note: "Eldest of the six; the Anga kingdom, whose throne Duryodhana would one day give to Karna, keeps his name. SB 9.23.5-6" });
for (const [id, n] of [
  ["Vanga", "One of the six sons of Dirghatamas by Bali's queen. SB 9.23.5"],
  ["Kalinga", "One of the six sons of Dirghatamas by Bali's queen. SB 9.23.5"],
  ["Suhma", "One of the six sons of Dirghatamas by Bali's queen. SB 9.23.5"],
  ["Pundra", "One of the six sons of Dirghatamas by Bali's queen. SB 9.23.5"],
  ["Odra", "One of the six sons of Dirghatamas by Bali's queen. SB 9.23.5"],
] as const) person(id, { family: ANGA, note: n });
union("u_dirghatamas_sudeshna", ["Dirghatamas", "SudeshnaAnga"], ["Anga", "Vanga", "Kalinga", "Suhma", "Pundra", "Odra"], {
  family: ANGA, status: "partners",
  note: "Niyoga: begotten for the sonless Bali, and counted as his. SB 9.23.5-6" });

chain("Anga", [
  { id: "Khalapana", note: "SB 9.23.6" },
  { id: "Diviratha", note: "SB 9.23.6" },
  { id: "Dharmaratha", note: "SB 9.23.7" },
], ANGA, "Romapada");
note("Romapada",
  "Citraratha, called Romapada, king of Anga. Sonless, he was given his friend Dasharatha's daughter Shanta as his own, and married her to Rishyasringa; by the sage's grace he got a son at last. SB 9.23.7-10");

chain("Romapada", [
  { id: "Chaturanga", note: "Born to Romapada by the grace of Rishyasringa. SB 9.23.10" },
  { id: "Prithulaksha", note: "Three sons: Brihadratha, Brihatkarma and Brihadbhanu. SB 9.23.10-11" },
  { id: "BrihadrathaAnga", name: "Brihadratha", note: "Eldest son of Prithulaksha. Not Brihadratha of Magadha. SB 9.23.11" },
  { id: "Brihanmana", note: "SB 9.23.11" },
  { id: "JayadrathaAnga", name: "Jayadratha", note: "Not Jayadratha of Sindhu, Dushala's husband. SB 9.23.11-12" },
  { id: "VijayaAnga", name: "Vijaya", note: "Son of Jayadratha by his wife Sambhuti. SB 9.23.12" },
  { id: "DhritiAnga", name: "Dhriti", note: "SB 9.23.12" },
  { id: "Dhritavrata", note: "SB 9.23.12" },
  { id: "Satkarma", note: "SB 9.23.12" },
], ANGA, "Adhiratha");
note("Adhiratha",
  "Son of Satkarma, of the Anga line, and a suta by office. Playing on the bank of the Ganga he found a basket with a child in it, and having no son of his own he raised him: Karna. SB 9.23.12-13");
for (const [id, name, n] of [
  ["Brihatkarma", "Brihatkarma", "Son of Prithulaksha. SB 9.23.11"],
  ["BrihadbhanuA", "Brihadbhanu", "Son of Prithulaksha. SB 9.23.11"],
] as const) person(id, { name, family: ANGA, note: n });
union("u_Prithulaksha_more", ["Prithulaksha"], ["Brihatkarma", "BrihadbhanuA"], { family: ANGA });
person("Sambhuti", { gender: "female", family: ANGA, note: "Wife of Jayadratha of Anga, mother of Vijaya. SB 9.23.12" });
const jayaU = unionsById.get("u_JayadrathaAnga_VijayaAnga");
if (jayaU && !jayaU.partners.includes("Sambhuti")) jayaU.partners.push("Sambhuti");

// ============================================================================
// PART II.5 — Turvasu.  SB 9.23.16-17
// ============================================================================

chain("Turvasu", [
  { id: "VahniT", name: "Vahni", note: "Son of Turvasu. SB 9.23.16" },
  { id: "Bharga", note: "SB 9.23.16" },
  { id: "BhanumanT", name: "Bhanuman", note: "SB 9.23.16" },
  { id: "Tribhanu", note: "SB 9.23.17" },
  { id: "Karandhama", note: "SB 9.23.17" },
  { id: "Marutta", note: "Sonless, he adopted Dushyanta out of the Puru line; Dushyanta later went home to claim his own throne, which is why the Puru succession reads unbroken. SB 9.23.17-18" },
], TURVASU);
union("u_Marutta_Dushyanta", ["Marutta"], [], { family: TURVASU, adopted: ["Dushyanta"],
  note: "SB 9.23.17-18" });

// ============================================================================
// PART II.8 — Haihaya and Kartavirya Arjuna.  SB 9.23.20-29
// ============================================================================

const yaduUnion = unionsById.get("u_yadu");
for (const [id, name, n] of [
  ["SahasrajitY", "Sahasrajit", "Eldest of Yadu's four sons; the Haihayas descend from him. SB 9.23.20-21"],
  ["NalaY", "Nala", "Third son of Yadu. Not Nala of Nishadha, nor Nala the vanara. SB 9.23.20"],
  ["Ripu", "Ripu", "Fourth son of Yadu. SB 9.23.20"],
] as const) {
  person(id, { name, family: SOMA, note: n });
  if (yaduUnion && !yaduUnion.children.includes(id)) yaduUnion.children.push(id);
}

chain("SahasrajitY", [
  { id: "ShatajitH", name: "Shatajit", note: "Three sons: Mahahaya, Renuhaya and Haihaya. SB 9.23.21" },
  { id: "Haihaya", note: "The king from whom the Haihayas take their name. SB 9.23.21" },
  { id: "DharmaH", name: "Dharma", note: "SB 9.23.22" },
  { id: "Netra", note: "SB 9.23.22" },
  { id: "KuntiH", name: "Kunti", note: "Son of Netra, a Haihaya king. Not Pritha, the Pandavas' mother. SB 9.23.22" },
  { id: "Sohanji", note: "SB 9.23.22" },
  { id: "Mahishman", note: "Whose city Mahishmati stood on the Narmada. SB 9.23.22" },
  { id: "Bhadrasenaka", note: "Two sons: Durmada and Dhanaka. SB 9.23.22-23" },
  { id: "Dhanaka", note: "Four sons: Kritavirya, Kritagni, Kritavarma and Kritauja. SB 9.23.23" },
  { id: "Kritavirya", note: "SB 9.23.23-24" },
], HAIHAYA);

person("KartaviryaArjuna", { name: "Kartavirya Arjuna", family: HAIHAYA,
  note: "Emperor of all seven islands, who received the eight mystic perfections from Dattatreya and ruled eighty-five thousand years with his strength and memory unbroken. He took Jamadagni's cow, and Parashurama killed him for it, and then killed the kshatriyas twenty-one times over. Of his thousand sons five survived. SB 9.23.24-27" });
union("u_Kritavirya_Kartavirya", ["Kritavirya"], ["KartaviryaArjuna"], { family: HAIHAYA });

for (const [id, name, n] of [
  ["Jayadhvaja", "Jayadhvaja", "One of the five sons of Kartavirya Arjuna who survived Parashurama. SB 9.23.27"],
  ["ShurasenaH", "Shurasena", "A surviving son of Kartavirya Arjuna. Not Shurasena the Yadava, Vasudeva's father. SB 9.23.27"],
  ["Vrishabha", "Vrishabha", "A surviving son of Kartavirya Arjuna. SB 9.23.27"],
  ["MadhuH", "Madhu", "A surviving son of Kartavirya Arjuna. SB 9.23.27"],
  ["Urjita", "Urjita", "A surviving son of Kartavirya Arjuna. SB 9.23.27"],
] as const) person(id, { name, family: HAIHAYA, note: n });
union("u_Kartavirya", ["KartaviryaArjuna"], ["Jayadhvaja", "ShurasenaH", "Vrishabha", "MadhuH", "Urjita"], { family: HAIHAYA });

chain("Jayadhvaja", [
  { id: "Talajangha",
    note: "A hundred sons, the Talajanghas, and every kshatriya of that house was destroyed by Sagara with the power Aurva Rishi had given him. SB 9.23.28" },
  { id: "Vitihotra", note: "Eldest of Talajangha's hundred. SB 9.23.29" },
], HAIHAYA);

// ============================================================================
// PART II.6 + II.9 — Vidarbha, and the Vrishni spine.  SB 9.23.30-38, 9.24.1-26
// ============================================================================

splice("u_rushadru", "Madhu", [
  { id: "ChitrarathaY", name: "Chitraratha", note: "Son of Rushadru in the Kroshtu line. Not Chitraratha the Gandharva. SB 9.23.31" },
  { id: "Shashabindu", note: "SB 9.23.31-32" },
  { id: "Prithushrava", note: "Foremost among Shashabindu's sons, with Prithukirti. SB 9.23.33" },
  { id: "DharmaY", name: "Dharma", note: "SB 9.23.33" },
  { id: "Ushana", note: "Performer of a hundred horse sacrifices. SB 9.23.33" },
  { id: "Rucaka", note: "Five sons: Purujit, Rukma, Rukmeshu, Prithu and Jyamagha. SB 9.23.34" },
  { id: "Jyamagha",
    note: "Sonless, and too afraid of his barren queen Shaibya to take another wife. He brought a captive girl home on his chariot, and when Shaibya demanded to know who sat in her seat he said, your daughter-in-law. The devas made the words true: Shaibya bore Vidarbha, and Vidarbha grew up and married the girl. SB 9.23.34-38" },
  { id: "Vidarbha", note: "Born to Jyamagha and Shaibya by the mercy of the devas; three sons, Kusha, Kratha and Romapada. The Vidarbha kingdom keeps his name. SB 9.23.38, 9.24.1" },
  { id: "Kratha", note: "Son of Vidarbha; the Vrishni line runs through him. SB 9.24.1, 9.24.3" },
  { id: "KuntiV", name: "Kunti", note: "Son of Kratha. SB 9.24.3" },
  { id: "VrishniI", name: "Vrishni", note: "Son of Kunti of the Kratha line, generations above the Vrishni for whom the clan is named. SB 9.24.3" },
  { id: "Nirvriti", note: "SB 9.24.3" },
  { id: "Dasharha", note: "The Dasharhas take their name from him. SB 9.24.3" },
  { id: "Vyoma", note: "SB 9.24.4" },
  { id: "Jimuta", note: "SB 9.24.4" },
  { id: "Vikriti", note: "SB 9.24.4" },
  { id: "BhimarathaY", name: "Bhimaratha", note: "SB 9.24.4" },
  { id: "Navaratha", note: "SB 9.24.4" },
  { id: "DasharathaY", name: "Dasharatha", note: "SB 9.24.4" },
  { id: "ShakuniY", name: "Shakuni", note: "Son of Dasharatha of the Yadava line. Not Shakuni of Gandhara. SB 9.24.5" },
  { id: "Karambhi", note: "SB 9.24.5" },
  { id: "DevarataY", name: "Devarata", note: "SB 9.24.5" },
  { id: "Devakshatra", note: "SB 9.24.5" },
], SOMA);

person("Shaibya", { gender: "female", family: SOMA,
  note: "Queen of Jyamagha, barren and jealous, whose sharp question became a blessing: she bore Vidarbha, and the captive girl she had objected to became her daughter-in-law. SB 9.23.35-38" });
const jyaU = unionsById.get("u_Jyamagha_Vidarbha");
if (jyaU && !jyaU.partners.includes("Shaibya")) jyaU.partners.push("Shaibya");

for (const [id, name, n] of [
  ["Purujit_2", "Purujit", "Son of Rucaka. SB 9.23.34"],
  ["Rukma", "Rukma", "Son of Rucaka. SB 9.23.34"],
  ["Rukmeshu", "Rukmeshu", "Son of Rucaka. SB 9.23.34"],
  ["PrithuY", "Prithu", "Son of Rucaka. SB 9.23.34"],
] as const) person(id, { name, family: SOMA, note: n });
union("u_Rucaka_more", ["Rucaka"], ["Purujit_2", "Rukma", "Rukmeshu", "PrithuY"], { family: SOMA });

person("KushaV", { name: "Kusha", family: VIDARBHA, note: "Son of Vidarbha. SB 9.24.1" });
person("RomapadaV", { name: "Romapada", family: VIDARBHA,
  note: "Son of Vidarbha and the favourite of that house. Not Romapada of Anga. SB 9.24.1" });
union("u_Vidarbha_more", ["Vidarbha"], ["KushaV", "RomapadaV"], { family: VIDARBHA });
chain("RomapadaV", [
  { id: "BabhruV", name: "Babhru", note: "SB 9.24.2" },
  { id: "KritiV", name: "Kriti", note: "SB 9.24.2" },
  { id: "Ushika", note: "SB 9.24.2" },
  { id: "Cedi", note: "From him the Caidyas. A second derivation of Chedi beside Cedipa of the Uparichara Vasu line; the Bhagavata gives both. SB 9.24.2" },
], VIDARBHA);

graft("Vidarbha", "Bhishmaka", VIDARBHA, 12,
  "Between Vidarbha and Bhishmaka of Kundina, father of Rukmi and Rukmini, the texts name no one. SB 9.24.1");

// Madhu -> Vrishni, six kings.  SB 9.24.5-8
splice("u_madhu", "Vrishni", [
  { id: "Kuruvasha", note: "SB 9.24.5" },
  { id: "AnuY", name: "Anu", note: "Son of Kuruvasha. Not Anu the son of Yayati. SB 9.24.5" },
  { id: "Puruhotra", note: "SB 9.24.6" },
  { id: "AyuY", name: "Ayu", note: "SB 9.24.6" },
  { id: "Satvata",
    note: "Seven sons: Bhajamana, Bhaji, Divya, Vrishni, Devavridha, Andhaka and Mahabhoja, and the branches of the whole Yadava house run from them. SB 9.24.6-8" },
], SOMA);

note("Vrishni", "Son of Satvata, and the Vrishni for whom the clan of Krishna is named. SB 9.24.6-12");

for (const [id, name, n] of [
  ["Bhajamana", "Bhajamana", "Son of Satvata. Six sons by two wives: Nimloci, Kinkana and Dhrishti; Shatajit, Sahasrajit and Ayutajit. SB 9.24.7-8"],
  ["Bhaji", "Bhaji", "Son of Satvata. SB 9.24.7"],
  ["Divya", "Divya", "Son of Satvata. SB 9.24.7"],
  ["Devavridha", "Devavridha", "Son of Satvata. Of him and his son Babhru the old verse says that Babhru is the best of men and Devavridha the equal of the devas, and that fourteen thousand and sixty-five of their descendants attained liberation by their company. SB 9.24.7-11"],
  ["Mahabhoja", "Mahabhoja", "Son of Satvata, an exceedingly religious king, from whom the Bhoja kings descend. SB 9.24.7, 9.24.11"],
] as const) person(id, { name, family: YADAVA, note: n });
const satvataU = unionsById.get("u_Satvata_Vrishni");
if (satvataU) {
  for (const c of ["Bhajamana", "Bhaji", "Divya", "Devavridha", "Mahabhoja"]) {
    if (!satvataU.children.includes(c)) satvataU.children.push(c);
  }
}
person("AndhakaY", { name: "Andhaka", family: YADAVA,
  note: "Son of Satvata; four sons, Kukura, Bhajamana, Shuchi and Kambalabarhisha, and from Kukura the line runs to Ahuka, Devaka and Ugrasena. Not Andhaka the Daitya. SB 9.24.7, 9.24.19" });
if (satvataU && !satvataU.children.includes("AndhakaY")) satvataU.children.push("AndhakaY");
person("BabhruDv", { name: "Babhru", family: YADAVA, note: "Son of Devavridha, praised with his father in an old verse. SB 9.24.9-10" });
union("u_Devavridha_Babhru", ["Devavridha"], ["BabhruDv"], { family: YADAVA });

chain("AndhakaY", [
  { id: "Kukura", note: "Eldest of Andhaka's four sons, with Bhajamana, Shuchi and Kambalabarhisha. SB 9.24.19" },
  { id: "VahniY", name: "Vahni", note: "SB 9.24.19" },
  { id: "Viloma", note: "SB 9.24.19" },
  { id: "Kapotaroma", note: "SB 9.24.20" },
  { id: "AnuK", name: "Anu", note: "Whose friend was the gandharva Tumburu. SB 9.24.20" },
  { id: "AndhakaK", name: "Andhaka", note: "SB 9.24.20" },
  { id: "Dundubhi", note: "SB 9.24.20" },
  { id: "Avidyota", note: "SB 9.24.20" },
  { id: "Punarvasu", note: "A son, Ahuka, and a daughter, Ahuki. SB 9.24.20-21" },
], YADAVA, "Ahuka");

person("Ahuki", { gender: "female", family: YADAVA, note: "Daughter of Punarvasu, sister of Ahuka. SB 9.24.21" });
const punarU = unionsById.get("u_Punarvasu_Ahuka");
if (punarU && !punarU.children.includes("Ahuki")) punarU.children.push("Ahuki");

// Vrishni's own branch, down to the people already in the tree.  SB 9.24.12-18
person("Sumitra_3", { name: "Sumitra", family: YADAVA, note: "Son of Vrishni. SB 9.24.12" });
person("Yudhajit_2", { name: "Yudhajit", family: YADAVA, note: "Son of Vrishni; father of Shini and Anamitra. Not Yudhajit of Kekaya. SB 9.24.12" });
// Sumitra and Yudhajit get a union of their own rather than joining Shurasena's.
// The Bhagavata runs Shurasena six kings below Vrishni (Yudhajit, Anamitra, a
// second Vrishni, Chitraratha, Viduratha, Shura) where this tree has one link,
// so that link carries a gap; his brothers must not be dragged down it with him.
union("u_Vrishni_Yudhajit", ["Vrishni"], ["Sumitra_3", "Yudhajit_2"], { family: YADAVA });
person("Anamitra", { family: YADAVA,
  note: "Son of Yudhajit. Three sons: Nighna, a second Shini, and Vrishni. SB 9.24.12-14" });
union("u_Yudhajit_Anamitra", ["Yudhajit_2"], ["Anamitra", "Sini"], { family: YADAVA });
person("Nighna", { family: YADAVA, note: "Son of Anamitra; his sons were Satrajita and Prasena. SB 9.24.12-13" });
person("VrishniIII", { name: "Vrishni", family: YADAVA,
  note: "Son of Anamitra, and father of Shvaphalka and Chitraratha. SB 9.24.14" });
union("u_Anamitra_more", ["Anamitra"], ["Nighna", "VrishniIII"], { family: YADAVA });
person("Prasena_2", { name: "Prasena", family: YADAVA,
  note: "Son of Nighna, brother of Satrajit; he wore the Syamantaka jewel to the hunt and was killed by a lion. SB 9.24.13; 10.56" });
union("u_Nighna", ["Nighna"], ["Satrajit", "Prasena_2"], { family: YADAVA });
person("Shvaphalka", { family: YADAVA, note: "Son of Vrishni; by his wife Gandini the father of Akrura and twelve more, and a daughter Suchara. SB 9.24.15-18" });
person("Gandini", { gender: "female", family: YADAVA, note: "Wife of Shvaphalka, mother of Akrura. SB 9.24.15" });
person("ChitrarathaV", { name: "Chitraratha", family: YADAVA,
  note: "Son of Vrishni, brother of Shvaphalka; his son Viduratha fathered Shura. SB 9.24.15, 9.24.26" });
union("u_VrishniIII", ["VrishniIII"], ["Shvaphalka", "ChitrarathaV"], { family: YADAVA });
union("u_Shvaphalka_Gandini", ["Shvaphalka", "Gandini"], [], { family: YADAVA });
const svaU = unionsById.get("u_Shvaphalka_Gandini");
if (svaU && !svaU.children.includes("Akrura")) svaU.children.push("Akrura");
person("Suchara", { gender: "female", family: YADAVA, note: "Sister of Akrura. SB 9.24.18" });
if (svaU && !svaU.children.includes("Suchara")) svaU.children.push("Suchara");
person("Devavan", { family: YADAVA, note: "Son of Akrura. SB 9.24.18" });
person("Upadeva", { family: YADAVA, note: "Son of Akrura. SB 9.24.18" });
union("u_Akrura", ["Akrura"], ["Devavan", "Upadeva"], { family: YADAVA });
person("Vidhuratha", { family: YADAVA, note: "Son of Chitraratha, father of Shura. SB 9.24.26" });
union("u_ChitrarathaV", ["ChitrarathaV"], ["Vidhuratha"], { family: YADAVA });
note("Shurasena",
  "Shura, son of Vidhuratha of the Vrishni house; ten sons, of whom Vasudeva was the chief, and five daughters, one of them Pritha whom he gave to his friend Kunti. The Bhagavata runs his descent through Chitraratha and Vidhuratha, this tree through Vrishni, and both are recorded. SB 9.24.26-28");

// Devaka's and Ugrasena's households.  SB 9.24.21-25
const devakaU = unionsById.get("u_devaka");
for (const [id, name, gender, n] of [
  ["DevavanD", "Devavan", "male", "Son of Devaka. SB 9.24.22"],
  ["UpadevaD", "Upadeva", "male", "Son of Devaka. SB 9.24.22"],
  ["SudevaD", "Sudeva", "male", "Son of Devaka. SB 9.24.22"],
  ["Devavardhana", "Devavardhana", "male", "Son of Devaka. SB 9.24.22"],
  ["Dhritadeva", "Dhritadeva", "female", "Eldest of Devaka's seven daughters, all of whom Vasudeva married. SB 9.24.22-23"],
  ["Shantideva", "Shantideva", "female", "Daughter of Devaka, wife of Vasudeva. SB 9.24.23"],
  ["UpadevaF", "Upadeva", "female", "Daughter of Devaka, wife of Vasudeva. SB 9.24.23"],
  ["Shridevi", "Shridevi", "female", "Daughter of Devaka, wife of Vasudeva. SB 9.24.23"],
  ["Devarakshita", "Devarakshita", "female", "Daughter of Devaka, wife of Vasudeva. SB 9.24.23"],
  ["Sahadeva_2", "Sahadeva", "female", "Daughter of Devaka, wife of Vasudeva. SB 9.24.23"],
] as const) {
  person(id, { name, gender: gender as Gender, family: YADAVA, note: n });
  if (devakaU && !devakaU.children.includes(id)) devakaU.children.push(id);
}

const ugraU = unionsById.get("u_ugrasena");
for (const [id, name, gender, n] of [
  ["Sunama", "Sunama", "male", "Son of Ugrasena. SB 9.24.24"],
  ["Nyagrodha", "Nyagrodha", "male", "Son of Ugrasena. SB 9.24.24"],
  ["Kanka_2", "Kanka", "male", "Son of Ugrasena. SB 9.24.24"],
  ["ShankuU", "Shanku", "male", "Son of Ugrasena. SB 9.24.24"],
  ["Suhu", "Suhu", "male", "Son of Ugrasena. SB 9.24.24"],
  ["Rashtrapala", "Rashtrapala", "male", "Son of Ugrasena. SB 9.24.24"],
  ["Dhrishti", "Dhrishti", "male", "Son of Ugrasena. SB 9.24.24"],
  ["Tushtiman", "Tushtiman", "male", "Son of Ugrasena. SB 9.24.24"],
  ["Kamsa_F", "Kamsa", "female", "Daughter of Ugrasena; the five sisters married Vasudeva's younger brothers. SB 9.24.25"],
  ["Kamsavati", "Kamsavati", "female", "Daughter of Ugrasena. SB 9.24.25"],
  ["Kanka_F", "Kanka", "female", "Daughter of Ugrasena. SB 9.24.25"],
  ["Shurabhu", "Shurabhu", "female", "Daughter of Ugrasena. SB 9.24.25"],
  ["Rashtrapalika", "Rashtrapalika", "female", "Daughter of Ugrasena. SB 9.24.25"],
] as const) {
  person(id, { name, gender: gender as Gender, family: YADAVA, note: n });
  if (ugraU && !ugraU.children.includes(id)) ugraU.children.push(id);
}

// ============================================================================
// PART II.7 — Magadha, Matsya, Chedi grafts
// ============================================================================

graft("MatsyaKing", "Virata", MATSYA, 10,
  "Between Matsya, the fish-born son of Uparichara Vasu, and Virata of the Matsya kingdom the texts name no one. MBh 1.57; SB 9.22.6");
graft("Cedipa", "Damaghosha", CHEDI, 10,
  "Cedipa's line runs down to Damaghosha of Chedi, father of Shishupala. SB 9.22.6");

// ============================================================================
// PART II.11 — The Kaushika line, from Amavasu.  SB 9.15.1-5; VP 4.7
// ============================================================================

splice("u_amavasu", "Gadhi", [
  { id: "BhimaK", name: "Bhima", note: "Of the Amavasu branch of the lunar line. Not Bhima the Pandava, nor Bhima of Vidarbha. VP 4.7; SB 9.15.2" },
  { id: "Kanchana", note: "SB 9.15.2" },
  { id: "Hotraka", note: "SB 9.15.2" },
  { id: "Jahnu", note: "Who drank the whole of the Ganga in one sip when her waters flooded his sacrifice, and released her again from his ear: hence she is Jahnavi, daughter of Jahnu. SB 9.15.3" },
  { id: "PuruK", name: "Puru", note: "Son of Jahnu. Not Puru the son of Yayati. SB 9.15.3" },
  { id: "Balaka", note: "SB 9.15.3" },
  { id: "Ajaka", note: "SB 9.15.3" },
  { id: "KushaK", name: "Kusha", note: "Four sons: Kushambu, Tanaya, Vasu and Kushanabha. SB 9.15.3-4" },
  { id: "Kushambu", note: "Son of Kusha, and the father of Gadhi. SB 9.15.4" },
], KAUSHIKA);
for (const [id, name, n] of [
  ["Tanaya", "Tanaya", "Son of Kusha. SB 9.15.4"],
  ["VasuK", "Vasu", "Son of Kusha. SB 9.15.4"],
  ["Kushanabha", "Kushanabha", "Son of Kusha. SB 9.15.4"],
] as const) person(id, { name, family: KAUSHIKA, note: n });
union("u_KushaK_more", ["KushaK"], ["Tanaya", "VasuK", "Kushanabha"], { family: KAUSHIKA });

// Pururavas's other sons by Urvashi.  SB 9.15.1
const pururavasU = unionsById.get("u_pururavas");
for (const [id, name, n] of [
  ["Shrutayu", "Shrutayu", "Son of Pururavas and Urvashi; his son was Vasuman. SB 9.15.1-2"],
  ["Satyayu", "Satyayu", "Son of Pururavas and Urvashi; his son was Shrutanjaya. SB 9.15.1-2"],
  ["Raya", "Raya", "Son of Pururavas and Urvashi; his son was Eka. SB 9.15.1-2"],
  ["JayaP", "Jaya", "Son of Pururavas and Urvashi; his son was Amita. SB 9.15.1-2"],
  ["VijayaP", "Vijaya", "Son of Pururavas and Urvashi. SB 9.15.1-2"],
] as const) {
  person(id, { name, family: SOMA, note: n });
  if (pururavasU && !pururavasU.children.includes(id)) pururavasU.children.push(id);
}

// ============================================================================
// PART III.1 — Nala and Damayanti.  MBh 3.50-78
// ============================================================================

const nalaP = peopleById.get("NalaNishadha");
if (nalaP) {
  nalaP.birthFamilyId = NISHADHA;
  nalaP.firstName = "Nala (Bahuka)";
  nalaP.notes =
    "King of Nishadha, son of Virasena. Master of horses and of cookery, and beloved of Damayanti before either had seen the other. Possessed by Kali, he gambled his kingdom away to his brother Pushkara, abandoned Damayanti in the forest, and lived disfigured as Bahuka, charioteer and cook to Rituparna of Ayodhya, until the science of horses he traded for the science of dice gave him both back. MBh 3.50-78";
  nalaP.updatedAt = STAMP;
}
const nalaU = unionsById.get("u_nala_damayanti");
if (nalaU) {
  nalaU.familyId = NISHADHA;
  nalaU.updatedAt = STAMP;
}
const nalayani = peopleById.get("Nalayani");
if (nalayani) {
  nalayani.birthFamilyId = NISHADHA;
  nalayani.firstName = "Nalayani (Indrasena)";
  nalayani.updatedAt = STAMP;
}

person("Virasena", { family: NISHADHA,
  note: "King of Nishadha, father of Nala. MBh 3.50" });
person("Pushkara", { family: NISHADHA,
  note: "Brother of Nala, who won the kingdom from him at dice with Dvapara riding the throw, and lost it back on a single cast when Nala returned. MBh 3.56, 3.78" });
union("u_virasena", ["Virasena"], ["NalaNishadha", "Pushkara"], { family: NISHADHA });

person("IndrasenaN", { name: "Indrasena", family: NISHADHA,
  note: "Son of Nala and Damayanti; with his sister he was sent to Vidarbha by the charioteer Varshneya when their parents' fortune turned. MBh 3.59" });
if (nalaU && !nalaU.children.includes("IndrasenaN")) nalaU.children.push("IndrasenaN");

person("BhimaVidarbha", { name: "Bhima", family: VIDARBHA,
  note: "King of Vidarbha, long childless, who got his four children by the grace of the sage Damana; father of Damayanti. Not Bhima the Pandava. MBh 3.50" });
for (const [id, n] of [
  ["Dama", "Son of Bhima of Vidarbha, brother of Damayanti. MBh 3.50"],
  ["Danta", "Son of Bhima of Vidarbha, brother of Damayanti. MBh 3.50"],
  ["DamanaS", "Son of Bhima of Vidarbha, brother of Damayanti, named for the sage whose boon gave them all. MBh 3.50"],
] as const) person(id, { name: id === "DamanaS" ? "Damana" : id, family: VIDARBHA, note: n });
union("u_bhima_vidarbha", ["BhimaVidarbha"], ["Damayanti", "Dama", "Danta", "DamanaS"], { family: VIDARBHA });
graft("Vidarbha", "BhimaVidarbha", VIDARBHA, 10,
  "Bhima of Vidarbha, Damayanti's father, stands in Vidarbha's line at an unrecorded remove. MBh 3.50");

// The rest of the Nalopakhyana's cast, Damana the sage who gave Bhima his
// children, the charioteer Varshneya, Rituparna's groom Jivala, the brahmins
// Sudeva and Parnada, and the age-spirits Kali and Dvapara, have no kinship to
// anyone here. This is a kinship graph, so they live in the notes above and in
// docs/PURANIC_LINEAGES.md rather than as orphan orbs.

note("Damayanti",
  "Princess of Vidarbha, daughter of King Bhima, who loved Nala on report alone and knew him at her svayamvara among four devas wearing his face, because only his feet touched the ground. Abandoned in the forest, she made her way back by a brahmin's recognition and drew her husband out of hiding with a riddling verse. MBh 3.50-78");

// ============================================================================
// PART III.5 — Madhavi and Galava.  MBh 5.104-121
// ============================================================================

person("Madhavi", { gender: "female", family: SOMA,
  note: "Daughter of Yayati, given not in marriage but in loan: her blessing was that she recovered her maidenhood after each birth and that her sons would be kings. Galava lent her to three kings for two hundred white horses each and to Vishvamitra for the last two hundred, and she bore Vasumanas, Pratardana, Shibi and Ashtaka. Offered a svayamvara afterwards she chose the forest instead and lived as a deer lives. When Yayati fell out of heaven for pride, these four grandsons gave him the merit of their sacrifices and raised him back. MBh 5.113-121" });
const yayatiU = unionsById.get("u_yayati_devayani");
if (yayatiU && !yayatiU.children.includes("Madhavi")) yayatiU.children.push("Madhavi");

// Galava, Vishvamitra's disciple, set all of this in motion but is kin to no
// one in it; he belongs to Madhavi's note and to the doc, not to the graph.

person("HaryashvaAyodhya", { name: "Haryashva", family: IKSHVAKU,
  note: "King of Ayodhya, the first of the four to whom Madhavi was lent, and by her the father of Vasumanas. MBh 5.113" });
person("Vasumanas", { family: IKSHVAKU,
  note: "Son of Haryashva of Ayodhya by Madhavi, renowned for giving; one of the four grandsons who lifted Yayati back to heaven. MBh 5.113, 5.118" });
union("u_haryashva_madhavi", ["HaryashvaAyodhya", "Madhavi"], ["Vasumanas"], { family: IKSHVAKU, status: "partners" });
// The second of Madhavi's four: Pratardana already hangs off Divodasa in the
// Kashi chain, so she joins that union rather than getting one of her own.
const dkU = unionsById.get("u_DivodasaKashi_Pratardana");
if (dkU && !dkU.partners.includes("Madhavi")) {
  dkU.partners.push("Madhavi");
  dkU.status = "partners";
  dkU.notes = "The second of Madhavi's four. MBh 5.113";
  dkU.updatedAt = STAMP;
}
union("u_ushinara_madhavi", ["Ushinara", "Madhavi"], ["Shibi"], { family: USHINARA, status: "partners",
  note: "The third of Madhavi's four. MBh 5.114" });

person("Ashtaka", { family: KAUSHIKA,
  note: "Son of Vishvamitra by Madhavi, renowned for his sacrifices; one of the four grandsons who lifted Yayati back to heaven. MBh 5.115, 5.118" });
union("u_vishvamitra_madhavi", ["Vishvamitra", "Madhavi"], ["Ashtaka"], { family: KAUSHIKA, status: "partners" });

// ============================================================================
// PART VII — Kishkindha: the vanaras beyond Valmiki
// ============================================================================

// Hanuman is a deva in his own right, not merely Vayu's son: a chiranjivi, one
// of the immortals, and in the Shaiva reading a Rudra avatar. He keeps his
// generation because he is rooted in Kesari and Anjana's union; `divine` only
// changes how he is rendered.
const hanumanP = peopleById.get("Hanuman");
if (hanumanP) {
  hanumanP.divine = true;
  hanumanP.notes =
    "Son of Kesari and Anjana, begotten by Vayu the wind-god, and himself counted among the devas: a chiranjivi, one of the immortals who never dies, and in the Shaiva reading an avatar of Rudra. He leapt the ocean to Lanka and found Sita, carried the mountain of herbs whole because he could not tell which one healed, and burned the city with his own tail. Rama 1.17, 4.66, 5.1; Shiva Purana 3.20";
  hanumanP.updatedAt = STAMP;
}

const anjanaP = peopleById.get("Anjana");
if (anjanaP) {
  anjanaP.firstName = "Anjana (Punjikasthala)";
  anjanaP.notes =
    "The apsara Punjikasthala, called Managarva in the Puranic account, cursed into the body of a vanara and born a princess of Kishkindha. She and Kesari propitiated Vayu for a son and got Hanuman. Rama 4.66; Puranic Encyclopaedia, Anjana";
  anjanaP.updatedAt = STAMP;
}

// Makardhwaja, born of Hanuman's sweat. Not in Valmiki: the Ahiravana-vadha is
// told in the Krittivasi and Ananda Ramayanas, in the Adbhuta Ramayana, and
// across the folk and Southeast Asian retellings, where the Thai Ramakien calls
// him Macchanu, son of Hanuman and the mermaid Suvannamaccha.
person("Makardhwaja", { family: "familyVanara",
  note: "Son of Hanuman, born without a mother's womb. Cooling himself in the sea after burning Lanka, Hanuman shed a drop of sweat; a makara swallowed it and conceived, and when the fish was cut open the child inside was part vanara and part reptile. Ahiravana's people raised him and set him to guard the gates of Patala, where his own father, come to rescue Rama and Lakshmana, had to fight him without knowing him. Hanuman, who had been a brahmachari since birth, saw the truth in dhyana, and afterwards gave him Patala to rule. Krittivasi and Ananda Ramayanas; Ramakien, where he is Macchanu" });
// A one-partner union would read as "other parent unknown", which is the one
// thing this is not: the mother is known, she is simply a fish. Adrika, the
// apsara cursed into a fish who conceived Satyavati the same way, is already in
// this tree as a person, so the makara is too.
person("Makari", { gender: "female",
  note: "The makara of the ocean who swallowed a drop of Hanuman's sweat as he cooled himself after burning Lanka, and conceived Makardhwaja by it. The Indian retellings leave her unnamed and call her only the makara, so she carries the creature's name here; the Thai Ramakien names her Suvannamaccha and makes her a mermaid, and Ravana's daughter. Krittivasi Ramayana; Ramakien" });
union("u_hanuman", ["Hanuman", "Makari"], ["Makardhwaja"], {
  family: "familyVanara", status: "partners",
  note: "Not a marriage: a drop of sweat in the sea, swallowed. Krittivasi Ramayana" });

person("Ahiravana", { family: "familyRakshasa",
  note: "Rakshasa king of Patala, a sorcerer who carried Rama and Lakshmana off in their sleep to sacrifice them to his goddess. He raised the fish-born Makardhwaja and made him his gatekeeper, and Hanuman killed him. The retellings differ over whether he is Ravana's son or his brother, and often pair him with Mahiravana. Krittivasi Ramayana; Ananda Ramayana" });
const ravanaU = unionsById.get("r_u_ravana");
if (ravanaU && !ravanaU.children.includes("Ahiravana")) ravanaU.children.push("Ahiravana");
union("u_ahiravana", ["Ahiravana"], [], { family: "familyRakshasa", adopted: ["Makardhwaja"],
  note: "Ahiravana's people found the child in the fish and brought him up. Krittivasi Ramayana" });

// Angada's son, and Ruma's father: the Brahmanda Purana carries the Kishkindha
// line one generation past the war, where Valmiki stops.
person("DhruvaV", { name: "Dhruva", family: "familyVanara",
  note: "Son of Angada, and so Vali's grandson: the Brahmanda Purana carries the house of Kishkindha one generation past the war, where Valmiki leaves it. Not Dhruva the son of Uttanapada, who became the pole star. Brahmanda Purana 3.7.220" });
union("u_angada", ["Angada"], ["DhruvaV"], { family: "familyVanara" });

person("Panasa", { family: "familyVanara",
  note: "A vanara chief of Kishkindha, one of the captains Sugriva sent out to search for Sita, and the father of Ruma. Rama 4.39; Brahmanda Purana 3.7.221" });
union("u_panasa", ["Panasa"], ["Ruma"], { family: "familyVanara" });
const sugrivaU = unionsById.get("r_u_sugriva_ruma");
if (sugrivaU) {
  sugrivaU.notes =
    "The Brahmanda Purana says Ruma, daughter of Panasa, bore Sugriva three sons, and does not name them. Brahmanda Purana 3.7.221";
  sugrivaU.updatedAt = STAMP;
}

// Nala and Nila each had a deva for a father and no vanara kin the texts record,
// which is why they have stood alone in this tree. Their sires give them a line.
person("Vishvakarma", { note: "The architect of the devas, who built Lanka for Kubera and the chariots and weapons of heaven. His son Nala inherited the craft, which is how a bridge of floating stone reached across the sea. Rama 6.22" });
person("Agni", { note: "The deva of fire, who carries the offering. Father of the vanara Nila, whose effulgence the epic says was his father's. Rama 1.17" });
for (const id of ["Vishvakarma", "Agni"]) {
  const p = peopleById.get(id);
  if (p) { p.divine = true; p.updatedAt = STAMP; }
}
const nalaV = peopleById.get("Nala");
if (nalaV) { nalaV.divineParents = ["Vishvakarma"]; nalaV.updatedAt = STAMP; }
const nilaV = peopleById.get("Nila");
if (nilaV) { nilaV.divineParents = ["Agni"]; nilaV.updatedAt = STAMP; }

// ============================================================================
// PART VIII — The avatars of Vishnu.  SB 1.3.6-25
// ============================================================================
//
// Sukadeva counts twenty-two in order at SB 1.3.6-25; the familiar count of
// twenty-four comes from the later enumerations that add Hamsa and Hayagriva,
// and SB 1.3.26 says outright that they are innumerable, "like rivulets from an
// inexhaustible source". Both are followed here.
//
// Eight of them were already in this tree with a genealogy of their own, and
// five of those eight already carried `divine`. The rest fall into two kinds:
//
//   - Those born into a line the tree holds (Narada and the four Kumaras, mind-
//     born of Brahma) are CONNECTED, and take their family's colour, because
//     they do come from a genealogy.
//   - Those with no ancestry to hang from at all (Matsya, Kurma, Varaha,
//     Narasimha and the rest) are SUSPENDED: a genAnchor alone, floating at the
//     row of the story they belong to, exactly as Raivata and Mucukunda are
//     placed. Each gets a family of its own so that each carries a distinct
//     colour, since none of them shares a genealogy with anything else here.

/** An avatar already in the tree: flag it divine and say where it stands in the series. */
const avatar = (id: string, place: string, note: string): void => {
  const p = peopleById.get(id);
  if (!p) throw new Error(`avatar: no person "${id}"`);
  p.divine = true;
  p.notes = `${note} ${place}`;
  p.updatedAt = STAMP;
};

avatar("Dattatreya", "The sixth of the avatars, SB 1.3.11.",
  "Son of Atri and Anasuya, born because she prayed for an incarnation. He gave the teaching of transcendence to Alarka, to Prahlada and to Kartavirya Arjuna, all three of whom stand in this tree, and the mystic perfections he gave Kartavirya are what made that king unkillable by anyone but Parashurama.");
avatar("Dhanvantari", "The twelfth of the avatars, SB 1.3.17 and 9.17.4.",
  "He rose from the churned ocean carrying the pot of nectar, and was born again in the Kashi line of Kshatravriddha to bring medicine into the world: the founder of Ayurveda. Merely remembering him, the Purana says, quiets disease.");
avatar("Vamana", "The fifteenth of the avatars, SB 1.3.19.",
  "The dwarf brahmin who came to Bali's sacrifice and asked for three steps of ground, then took the earth with one and the sky with the second, and set the third on Bali's own head. Son of Kashyapa and Aditi, and so a brother of Indra, whose lost heaven he was recovering.");
avatar("Parashurama", "The sixteenth of the avatars, SB 1.3.20.",
  "Rama of the axe, called Bhrigupati for his house. He killed Kartavirya Arjuna over the stolen cow and then cleared the earth of kshatriyas twenty-one times, and lived on to teach Bhishma, Drona and Karna, three ages of this tree apart.");
avatar("Vyasa", "The seventeenth of the avatars, SB 1.3.21.",
  "Born to Satyavati by Parashara on an island in the Yamuna, hence Krishna Dvaipayana. He divided the one Veda into four because the age had grown too dull to hold it whole, fathered Dhritarashtra, Pandu and Vidura by niyoga, and composed the epic his own descendants are the cast of.");
avatar("Rama", "The eighteenth of the avatars, SB 1.3.22.",
  "Eldest son of Dasharatha and Kausalya of the solar line. He bound the ocean and killed Ravana, and the Purana counts him the eighteenth descent.");
avatar("Balarama", "The nineteenth of the avatars, SB 1.3.23.",
  "Elder brother of Krishna, carried from Devaki's womb into Rohini's, and counted with him as the nineteenth and twentieth descents, born in the house of Vrishni to take the burden off the earth. He carried the plough and the pestle, taught both Duryodhana and Bhima the mace, and would take neither side in the war.");
avatar("Krishna", "The twentieth of the avatars, SB 1.3.23 and 1.3.28.",
  "Eighth son of Vasudeva and Devaki, carried across the Yamuna the night he was born and raised by Nanda and Yashoda in Gokula. Of the whole list the Bhagavata sets him apart: krsnas tu bhagavan svayam, the others are portions and portions of portions, and he is the source Himself.");

// --- suspended: no ancestry to hang from, so an anchor and a colour of its own -

interface Suspended {
  id: string;
  name?: string;
  gender?: Gender;
  colour: string;
  /** Whose row it floats at, and why that is the right room. */
  beside: string;
  note: string;
}

const SUSPENDED: Suspended[] = [
  { id: "Hamsa", colour: "#dfe3ea", beside: "Brahma's mind-born sons",
    note: "The swan, who came to Brahma and the Kumaras when they asked what the highest good was, and answered them. One of the two the later enumerations add to reach twenty-four. SB 11.13" },
  { id: "Hayagriva", colour: "#6fc7b8", beside: "Brahma's mind-born sons",
    note: "The horse-headed one, who killed the demon Madhu and brought the Vedas back from the bottom of the sea when they were stolen at the dissolution. The second of the two that make the count twenty-four. SB 2.7.11" },
  { id: "Yajna", colour: "#c7b04a", beside: "the Svayambhuva age",
    note: "The seventh of the avatars: son of the Prajapati Ruchi and Akuti, daughter of Svayambhuva Manu. He was the Indra of that first manvantara, with his own sons the Yamas for demigods. SB 1.3.12" },
  { id: "NaraNarayana", name: "Nara-Narayana", colour: "#7d9fd6", beside: "the Svayambhuva age",
    note: "The fourth of the avatars, counted as one though they are two: the twin sons of Dharma by Murti, who went to Badarikashrama and took on austerities no one has matched. Arjuna and Krishna are held to be these two returned, which is why the Gita is spoken between them. SB 1.3.9" },
  { id: "Rishabha", colour: "#a3c46a", beside: "the Svayambhuva age",
    note: "The eighth of the avatars: son of Nabhi and Merudevi, who showed the path of perfection and then wandered the earth as an avadhuta, naked and silent, letting himself be taken for a madman. His eldest son Bharata gave Bharatavarsha its name. Not Vrishabha, Kartavirya's son. SB 1.3.13, 5.3-6" },
  { id: "Prithu", colour: "#cf7a52", beside: "the Svayambhuva age",
    note: "The ninth of the avatars: son of the wicked Vena, churned from his dead father's arm. When the earth withheld her yield he took up his bow against her, and she fled as a cow until she consented to be milked; he levelled her and taught her to be tilled, and she is Prithvi after him. Not Prithu of the solar line, nor Rucaka's son. SB 1.3.14, 4.15-23" },
  { id: "Kurma", colour: "#6a8f7a", beside: "the churning of the ocean",
    note: "The eleventh of the avatars: the tortoise whose shell held Mandara up as the devas and asuras churned the ocean with it. Everything that came out of that churning stands in this tree, Surabhi, Airavata, Varuni, and Dhanvantari with the pot of nectar. SB 1.3.16, 8.7" },
  { id: "Mohini", gender: "female", colour: "#e07ab0", beside: "the churning of the ocean",
    note: "The thirteenth of the avatars, and the only one in the form of a woman: she took the nectar from the asuras by charm alone and served it to the devas, which is the whole reason Rahu and Ketu, both here, are two halves of one severed body. SB 1.3.17, 8.8-9" },
  { id: "Matsya", colour: "#4aa8d8", beside: "Vaivasvata Manu",
    note: "The tenth of the avatars: the fish that grew until no water could hold it, and at the deluge that ended the Chakshusha age drew Manu's boat by a rope of serpent through the flood. Every line in this tree runs down from the man in that boat. SB 1.3.15, 8.24" },
  { id: "Varaha", colour: "#8b5e3c", beside: "Hiranyaksha",
    note: "The second of the avatars: the boar who lifted the earth out of the waters on his tusks and killed Hiranyaksha, who had rolled her down there. On the earth herself he fathered Naraka, who stands in this tree with Bhagadatta. SB 1.3.7, 3.13-19" },
  { id: "Narasimha", colour: "#e0913a", beside: "Hiranyakashipu",
    note: "The fourteenth of the avatars: neither man nor lion, at neither day nor night, on neither earth nor sky, killing Hiranyakashipu with no weapon on the threshold of his own hall, because the boon had covered everything else. He came for Prahlada, who is here as the demon's son. SB 1.3.18, 7.8" },
  { id: "Kapila", colour: "#b8862b", beside: "Sagara",
    note: "The fifth of the avatars: son of Kardama and Devahuti, daughter of Svayambhuva Manu, and the founder of Sankhya. Sagara's sixty thousand sons dug the earth open looking for their horse, found it beside him at his meditation, took him for the thief, and were ash before they finished the thought. Amshuman came after them and learned that only the Ganga could redeem them, which is the errand Bhagiratha finally completed. SB 1.3.10, 9.8" },
  { id: "Buddha", colour: "#d9a441", beside: "the opening of the Kali age",
    note: "The twenty-first of the avatars: born, the Purana says, to Anjana at Gaya at the beginning of Kali, to draw away by gentleness those who would have used the sacrifice for cruelty. The Bhagavata's own Ikshvaku list places him among the kings still to come, after Shakya and Shuddhoda, so the solar line runs on into him; those future kings are deliberately not in this tree, so he floats here instead. Not Anjana the mother of Hanuman. SB 1.3.24, 9.12.10-16" },
  { id: "Kalki", colour: "#9fb8e0", beside: "the close of the Kali age",
    note: "The twenty-second and last: to be born to Vishnu Yasha in the village of Shambhala at the joint of two ages, when the kings have all turned to plunder, and to ride out on a white horse with a sword like a comet. The only avatar in this tree who has not happened. SB 1.3.25, 12.2" },
];

for (const s of SUSPENDED) {
  const fam = family(`familyAvatar${s.id}`, s.name ?? s.id, s.colour,
    `Suspended: an avatar with no ancestry, floated beside ${s.beside}`);
  person(s.id, { name: s.name, family: fam, gender: s.gender, note: s.note });
  const p = peopleById.get(s.id)!;
  p.divine = true;
  p.updatedAt = STAMP;
}
// Nara and Narayana are one incarnation counted as two people.
person("NarayanaRishi", { name: "Narayana", family: "familyAvatarNaraNarayana",
  note: "The second of the twin sages, and the one Krishna is held to be returned as. SB 1.3.9" });
const nnP = peopleById.get("NarayanaRishi");
if (nnP) { nnP.divine = true; nnP.updatedAt = STAMP; }
const nnMain = peopleById.get("NaraNarayana");
if (nnMain) { nnMain.firstName = "Nara"; nnMain.updatedAt = STAMP; }

// --- connected: these two do come from a genealogy the tree already holds -----

person("Narada", { family: BRAHMA,
  note: "The third of the avatars, SB 1.3.8. Mind-born son of Brahma, who walks through every age of this tree and sets half of it moving: he sends Kalayavana at Mathura, curses Kubera's sons into a pair of trees, teaches Dhruva and Prahlada, and gathers the parts of the Veda that are about devotion alone. SB 1.3.8" });
for (const [id, n] of [
  ["Sanaka", "Eldest of the four Kumaras, the first of the avatars: Brahma's mind-born sons, who refused to father anything and stayed four boys for ever, in a vow of celibacy older than the world. SB 1.3.6, 3.15"],
  ["Sananda", "One of the four Kumaras, the first of the avatars. SB 1.3.6"],
  ["Sanatana", "One of the four Kumaras, the first of the avatars. SB 1.3.6"],
  ["Sanatkumara", "One of the four Kumaras, the first of the avatars. SB 1.3.6"],
] as const) person(id, { family: BRAHMA, note: n });
for (const id of ["Narada", "Sanaka", "Sananda", "Sanatana", "Sanatkumara"]) {
  const p = peopleById.get(id);
  if (p) { p.divine = true; p.updatedAt = STAMP; }
}
const brahmaU = unionsById.get("u_brahma_extra");
if (brahmaU) {
  for (const c of ["Narada", "Sanaka", "Sananda", "Sanatana", "Sanatkumara"]) {
    if (!brahmaU.children.includes(c)) brahmaU.children.push(c);
  }
  brahmaU.updatedAt = STAMP;
}

// ============================================================================
// Small fixes
// ============================================================================

person("Jayasena_2", { name: "Jayasena", family: "familyAvanti",
  note: "King of Avanti, husband of Rajadhidevi and father of Vinda and Anuvinda. SB 9.24.42" });
const rajaU = unionsById.get("u_rajadhidevi");
if (rajaU && !rajaU.partners.includes("Jayasena_2")) rajaU.partners.push("Jayasena_2");

person("Madayanti", { gender: "female", family: IKSHVAKU,
  note: "Queen of Saudasa Kalmashapada. Her husband cursed to die at his next embrace, she bore his heir Ashmaka to Vasishtha by his own leave, and carried the child for years until Vasishtha struck her womb with a stone. Also called Damayanti in some recensions, and not to be confused with Damayanti of Vidarbha. SB 9.9.33-38" });
const saudasaU = unionsById.get("u_Saudasa_Ashmaka");
if (saudasaU && !saudasaU.partners.includes("Madayanti")) saudasaU.partners.push("Madayanti");

person("Sumati_3", { name: "Sumati", gender: "female", family: IKSHVAKU,
  note: "First queen of Sagara, and mother of the sixty thousand who dug the ocean-trench and were burned to ash by Kapila. SB 9.8.8-13" });
person("Keshini", { gender: "female", family: IKSHVAKU,
  note: "Second queen of Sagara, mother of Asamanjas, through whom the solar line continued. SB 9.8.14-16" });
const sagaraU = unionsById.get("r_u_sagara");
if (sagaraU && !sagaraU.partners.includes("Keshini")) sagaraU.partners.push("Keshini");
union("u_sagara_sumati", ["Sagara", "Sumati_3"], [], { family: IKSHVAKU,
  note: "Their sixty thousand sons are counted, not named. SB 9.8.8" });

person("AmbarishaN", { name: "Ambarisha", family: IKSHVAKU,
  note: "Son of Nabhaga, emperor of the world and the great devotee. Durvasa, offended over a broken fast, loosed a demon from his own hair at him; the Sudarshana chakra burned the demon and chased the sage through every world until he came back and begged pardon of the king he had wronged. Three sons: Virupa, Ketuman and Shambhu. SB 9.4-9.5, 9.6.1" });
union("u_Nabhaga_Ambarisha", ["Nabhaga"], ["AmbarishaN"], { family: IKSHVAKU });
chain("AmbarishaN", [
  { id: "Virupa", note: "Son of Ambarisha. SB 9.6.1" },
  { id: "Prishadashva", note: "Son of Virupa. SB 9.6.1" },
  { id: "Rathitara", note: "Sonless; at his request the sage Angira begot sons in his wife's womb, and they were counted to both houses, Angirasa and Rathitara at once. SB 9.6.1-3" },
], IKSHVAKU);
for (const [id, n] of [
  ["Ketuman_2", "Son of Ambarisha. SB 9.6.1"],
  ["Shambhu", "Son of Ambarisha. SB 9.6.1"],
] as const) person(id, { name: id === "Ketuman_2" ? "Ketuman" : id, family: IKSHVAKU, note: n });
union("u_AmbarishaN_more", ["AmbarishaN"], ["Ketuman_2", "Shambhu"], { family: IKSHVAKU });

// Nanda of Gokula had been conflated with Nanda the Kaurava, one of
// Dhritarashtra's hundred sons, which married a son of Dhritarashtra to Yashoda
// and made Krishna's foster father his own contemporary's brother. Two men, one
// name.
person("NandaGokula", { name: "Nanda", family: "familyGokula",
  note: "Chief of the cowherds of Gokula, husband of Yashoda, and Krishna's foster father. The child was carried across the Yamuna to him the night he was born, and his own newborn daughter carried back in exchange. Not Nanda the Kaurava, who shares the name. BhP 10.3-10.5" });
const nandaU = unionsById.get("u_nanda");
if (nandaU) {
  const i = nandaU.partners.indexOf("Nanda");
  if (i >= 0) {
    nandaU.partners[i] = "NandaGokula";
    nandaU.updatedAt = STAMP;
  }
}
note("Nanda", "One of the hundred sons of Dhritarashtra and Gandhari. Not Nanda of Gokula, who raised Krishna. MBh 1.108");

person("Vriddhasharma", { name: "Vriddhasharma", family: CHEDI,
  note: "King of Karusha, husband of Shrutadeva and father of Dantavakra. SB 9.24.37" });
const shrutadevaU = data.unions.find(
  (u) => u.children.includes("Dantavakra") || (u.partners.includes("Shrutadeva") && u.children.length),
);
if (shrutadevaU && !shrutadevaU.partners.includes("Vriddhasharma")) {
  shrutadevaU.partners.push("Vriddhasharma");
}

// ============================================================================
// Write
// ============================================================================

data.meta.exportedAt = STAMP;
const { errors, warnings } = validateData(data);
if (errors.length) {
  console.error(`${errors.length} validation errors, nothing written:`);
  for (const e of errors.slice(0, 40)) console.error("  " + e);
  process.exit(1);
}
if (collisions.length) {
  console.error(`${collisions.length} id collisions with people already in the tree, nothing written:`);
  for (const c of [...new Set(collisions)]) console.error(`  ${c}`);
  process.exit(1);
}
writeFileSync(PATH, JSON.stringify(data, null, 2) + "\n");
console.log(
  `added ${addedPeople} people, ${addedUnions} unions -> ${data.people.length} people, ${data.unions.length} unions`,
);
if (warnings.length) console.log(`${warnings.length} warnings (family mismatches, expected on grafts)`);
