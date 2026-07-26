# Puranic lineages: the research behind the Hiranyagarbha tree

Every king, sage and side-story figure in `app/public/family-data.hiranyagarbha.json`,
with the text each one comes from. This file exists so the compilation never has to be
redone: when you want to add someone, look here first for where they attach and which
Purana says so.

The companion to this is `app/scripts/add-lineages.ts`, which holds the same chains in
executable form. **Doc and script must be edited together.**

## Citation convention

| Sigil | Text |
|---|---|
| `SB 9.7.4` | Śrīmad-Bhāgavatam, canto.chapter.verse |
| `VP 4.4` | Viṣṇu Purāṇa, book.chapter (Wilson) |
| `MBh 3.50` | Mahābhārata, parva.chapter (critical edition numbering) |
| `HV 58` | Harivaṃśa, chapter |
| `Rām 1.70` | Vālmīki Rāmāyaṇa, kāṇḍa.sarga |
| `RV 7.18` | Ṛgveda, maṇḍala.hymn |
| `ŚB 13.5.4` | Śatapatha Brāhmaṇa, kāṇḍa.adhyāya.brāhmaṇa |
| `AB 7.13` | Aitareya Brāhmaṇa, pañcikā.khaṇḍa |

Canto 9 of the Bhagavata is the spine of the whole compilation: it is the one text that
runs both dynasties end to end in a single voice. Where the Vishnu Purana disagrees, the
disagreement is noted rather than silently resolved.

## How the tree is built, and how to rebuild it

Two scripts, run in this order, and the second must always follow the first:

```bash
cd app
npm run add-lineages    # splices the king-lists in
npm run reanchor-eras   # puts every era back on its own level
```

Both are idempotent. `add-lineages.ts` refuses to write if it would collide with an id
already in the tree, or if the result fails `validateData`; `reanchor-eras.ts` prints a
checklist of fifty-one pairs the texts put in the same room and reports any that did not
land within a row of each other.

### The two levers

Both live in `core/generations.ts` and carry the entire chronology:

- **`childGap`** on a union: how many rows the children sit below the parents. A gap of 8
  says "the texts name the father and the descendant, not the seven kings between them".
  Research either fills those in, so the gap collapses to 1 and named kings take the rows,
  or widens them, where one dynasty's list is shorter than another's over the same span.
- **`genAnchor`** on a person: an absolute floor. For a clan whose ancestry the texts never
  give, or for a figure who slept through an age (Raivata, Mucukunda).

Anchors are floors only, and the leveler pushes strictly downward, so a descendant's
anchor never drags an ancestor out of place. This is what lets Mucukunda sit beside his
brothers in Mandhata's generation while his one famous act happens in Krishna's.

The one rule about which lever to use: **an anchor is for a lineage that floats, a gap is
for a lineage that is attached.** Anchoring a king halfway down a documented trunk leaves
him joined to his real father by an edge stretched across forty rows, which reads as forty
missing generations between a named father and his named son. Where the trunk is
continuous, the shortfall goes on the stretches where the Purana gives nothing but names
in a row.

### Where the eras landed

Two facts in the texts fix everything else, and neither is chosen:

- **Brihadbala was killed by Abhimanyu**, so they share a row. Brihadbala's row is Ikshvaku
  plus the eighty-six kings of `SB 9.6-9.12`. That is what decides where Kurukshetra falls.
- **Rama's row** follows from the same list, and lands **twenty-eight rows above the war**,
  which is exactly the twenty-eight kings `SB 9.12` counts from Kusha to Brihadbala.

Measured: Brahma at row 0, Ikshvaku 6, Mandhata 24, Sagara 41, **Rama 64**, Nala of
Nishadha 74, **Kurukshetra 92**, Janamejaya's line ending at 96. Ninety-seven rows,
1,079 people, 553 unions, 47 families.

The Paurava and Yadava lists are some forty generations shorter than the Aikshvaka one over
the same span, a shortfall old enough that Pargiter took the lunar list to be defective.
`reanchor-eras.ts` spreads it across `SB 9.20.1-3` (Puru to Raudrashva, a bare succession
with not one story attached) and the equivalent stretches of `SB 9.23.30-9.24.5`, so that
**from Bharata downward every row in this tree is a king the Purana actually names.**

---

# Part I. The two trunks

## I.1 Solar: Ikshvaku to Rama

`SB 9.6.4` through `SB 9.10.1`, cross-checked against `VP 4.2-4.4`. Fifty-eight steps.

| # | King | Note |
|---|---|---|
| 1 | **Ikṣvāku** | Son of Vaivasvata Manu. A hundred sons; Vikukṣi, Nimi and Daṇḍakā the eldest. `SB 9.6.4` |
| 2 | **Vikukṣi** (Śaśāda) | Banished for eating a hare from the sacrificial offering, hence "hare-eater"; recalled at his father's death. `SB 9.6.6-8` |
| 3 | **Purañjaya** (Kakutstha, Indravāha) | Fought the demons for the devas riding Indra in the form of a bull, on its hump: *kakud-stha*. `SB 9.6.11-15` |
| 4 | **Anenā** | `SB 9.6.16` |
| 5 | **Pṛthu** | Not Vena's son Prithu; see the namesake table. |
| 6 | **Viśvagandhi** | |
| 7 | **Candra** | |
| 8 | **Yuvanāśva I** | |
| 9 | **Śrāvasta** | Built Śrāvastī Purī. `SB 9.6.20` |
| 10 | **Bṛhadaśva** | |
| 11 | **Kuvalayāśva** (Dhundhumāra) | Killed the demon Dhundhu with twenty-one thousand sons; all but three burned in Dhundhu's fire. `SB 9.6.21-24` |
| 12 | **Dṛḍhāśva** | Brothers Kapilāśva and Bhadrāśva, the other two survivors. |
| 13 | **Haryaśva I** | |
| 14 | **Nikumbha** | |
| 15 | **Bahulāśva** | |
| 16 | **Kṛśāśva** | |
| 17 | **Senajit** | |
| 18 | **Yuvanāśva II** | A hundred wives, no son. Drank the consecrated water of his own Indra-yajña by mistake and bore the child himself, from his side. `SB 9.6.25-32` |
| 19 | **Māndhātā** (Trasaddasyu) | Suckled by Indra, who gave the newborn his index finger saying *mām ayaṁ dhāsyati*, "he shall suck me", hence the name. Emperor of the seven islands; called Trasaddasyu because thieves trembled. `SB 9.6.33-37` |
| 20 | **Purukutsa** | Married Narmadā, sister of the Nāgas; taken by her to Rasātala and empowered by Viṣṇu to kill the Gandharvas. `SB 9.7.2-3` |
| 21 | **Trasaddasyu** | Namesake of his grandfather's epithet. Rigvedic: `RV 4.42`. |
| 22 | **Anaraṇya** | |
| 23 | **Haryaśva II** | |
| 24 | **Prāruṇa** | |
| 25 | **Tribandhana** | |
| 26 | **Satyavrata** (**Triśaṅku**) | Cursed by his father to become a *caṇḍāla* for carrying off a brahmin's bride. Viśvāmitra sent him bodily to heaven; the devas threw him back; Viśvāmitra caught him mid-fall, and he hangs there still, head down. `SB 9.7.5-6` |
| 27 | **Hariścandra** | The truth-keeper. His quarrel-by-proxy turned Viśvāmitra and Vasiṣṭha into birds who fought for years. `SB 9.7.7` |
| 28 | **Rohita** | Promised to Varuṇa before birth and repeatedly deferred; lived six years in the forest to escape the knife. `SB 9.7.8-20` |
| 29 | **Harita** | |
| 30 | **Campā** | Built Campāpurī, later the Anga capital. `SB 9.8.1` |
| 31 | **Sudeva** | |
| 32 | **Vijaya** | |
| 33 | **Bharuka** | |
| 34 | **Vṛka** | |
| 35 | **Bāhuka** (Asita) | Driven from his kingdom, died in the forest; his widow was poisoned by co-wives while pregnant. `SB 9.8.2-5` |
| 36 | **Sagara** | Born *sa-gara*, "with poison". Reformed rather than killed the Yavanas, Śakas, Haihayas and Barbaras. His sixty thousand sons dug the ocean-trench (the Sāgara) and were burned to ash by Kapila. `SB 9.8.5-14` |
| 37 | **Asamañjas** | Son of the second queen Keśinī. The first queen Sumati bore the sixty thousand. |
| 38 | **Aṁśumān** | Recovered the sacrificial horse from Kapila and learned that only the Ganga could redeem his uncles. `SB 9.8.15-30` |
| 39 | **Dilīpa I** | Tried to bring the Ganga down and died without success. **Not** Kalidasa's Dilipa. `SB 9.9.1` |
| 40 | **Bhagīratha** | Brought her down. `SB 9.9.2-15` |
| 41 | **Śruta** | |
| 42 | **Nābha** | |
| 43 | **Sindhudvīpa** | |
| 44 | **Ayutāyu** | |
| 45 | **Ṛtuparṇa** | Friend of Nala. Gave Nala the *akṣa-hṛdaya*, the heart of dice, and took from him the *aśva-vidyā*, the science of horses. `SB 9.9.16-17` |
| 46 | **Sarvakāma** | |
| 47 | **Sudāsa** | Rigvedic Sudās belongs to the Bharatas, not here; see namesakes. |
| 48 | **Saudāsa** (Mitrasaha, **Kalmāṣapāda**) | Cursed by Vasiṣṭha into a Rākṣasa; devoured a brahmin and was cursed by the widow to die at his next embrace. Twelve years later Vasiṣṭha begot his heir on his queen **Madayantī**. `SB 9.9.20-38` |
| 49 | **Aśmaka** | Born when Vasiṣṭha struck the long-pregnant queen's womb with a stone: *aśman*. |
| 50 | **Bālika** (Mūlaka, Nārīkavaca) | Survived Parashurama's purge screened by women, "armoured in women"; refounded the kṣatriyas, hence *Mūlaka*, the root. `SB 9.9.39-40` |
| 51 | **Daśaratha I** | |
| 52 | **Aiḍaviḍi** | |
| 53 | **Viśvasaha** | |
| 54 | **Khaṭvāṅga** | Won the devas' war, asked how long he had left, was told a few moments, and spent them entirely on Hari. `SB 9.9.41-49` |
| 55 | **Dīrghabāhu** (**Dilīpa II**) | The Raghuvaṁśa's Dilipa, who served the cow Nandinī to win a son. `SB 9.10.1` |
| 56 | **Raghu** | Eponym of the Raghuvaṁśa. |
| 57 | **Aja** | Married Indumatī. |
| 58 | **Daśaratha** | |
| 59 | **Rāma** | With Lakṣmaṇa, Bharata, Śatrughna. `SB 9.10.2` |

## I.2 Solar: Rama to Brihadbala

`SB 9.12.1-9`. Twenty-eight steps, ending at the Kurukshetra generation.

Kuśa, **Atithi**, **Niṣadha**, Nabha, Puṇḍarīka, Kṣemadhanvā, Devānīka, Anīha,
Pāriyātra, Balasthala, Vajranābha, Sagaṇa, Vidhṛti, **Hiraṇyanābha** (disciple of Jaimini;
taught the yoga system to Yājñavalkya), Puṣpa, Dhruvasandhi, Sudarśana, Agnivarṇa, Śīghra,
**Maru** (perfected in yoga, still living in the village of Kalāpa, who will revive the
solar line at the end of the Kali age), Prasuśruta, Sandhi, Amarṣaṇa, Mahasvān, Viśvabāhu,
Prasenajit, Takṣaka, **Bṛhadbala**.

Brihadbala was killed by Abhimanyu at Kurukshetra. **That is the calibration point for the
whole tree**: he and Abhimanyu occupy the same row, which is what fixes where the war sits
relative to the solar count.

The Raghuvamsha corroborates this list down to Agnivarna. The future kings after Brihadbala
(`SB 9.12.10-16`, ending in **Sumitra**, last of the Ikshvakus) are catalogued in Part VI
and not in the tree.

## I.3 Lunar: Pururavas to Yudhishthira

`SB 9.14` through `SB 9.22`. Forty-five steps, against the solar line's eighty-six for the
same span. The asymmetry is real and old (Pargiter called the lunar list defective); the
tree absorbs it with `childGap` padding rather than by truncating the solar one.

**Pururavas to Dushyanta** (`SB 9.20.1-7`, filling the old `u_puru` gap of 4):
Āyu, **Nahuṣa**, **Yayāti**, **Pūru**, Janamejaya, Pracinvān, Pravīra, Manusyu, Cārupada,
Sudyu, Bahugava, Saṁyāti, Ahaṁyāti, Raudrāśva, Ṛteyu, Rantināva, Sumati, Rebhi,
**Duṣmanta**.

Raudrāśva had ten sons (Ṛteyu, Kakṣeyu, Sthaṇḍileyu, Kṛteyuka, Jaleyu, Sannateyu,
Dharmeyu, Satyeyu, Vrateyu, Vaneyu). Rantināva's third son **Apratiratha** fathered
**Kaṇva**, whose son **Medhātithi** heads a line of brahmins: this is the Kanva who
raised Shakuntala in his ashram. `SB 9.20.6-7`

**Bharata to Ajamidha** (`SB 9.20.37-38`, `SB 9.21.19-25`, filling `u_bharata` gap 3):
**Vitatha** (born **Bharadvāja** to Bṛhaspati and Mamatā, given to the sonless Bharata),
Manyu, **Bṛhatkṣatra**, **Hastī** (built Hastināpura), **Ajamīḍha**.

Manyu's other sons: Jaya, Mahāvīrya, **Nara**, **Garga**. Nara's son Saṅkṛti fathered
**Rantideva**, who fed every guest before himself through a forty-eight-day fast
(`SB 9.21.2-18`). Garga's line gives Śini and **Gārgya**, kṣatriya-born but brahmin by
practice: Gargya is Kalayavana's father (Part III).

**Kuru to Pratipa** (`SB 9.22.4-5`, `9.22.9-10`):
Kuru's four sons were **Parīkṣi**, **Sudhanu**, **Jahnu** and **Niṣadha**. The throne runs
through Jahnu: Suratha, **Vidūratha**, Sārvabhauma, Jayasena, Rādhika, Ayutāyu, Akrodhana,
Devātithi, **Ṛkṣa II**, **Dilīpa**, **Pratīpa**, then Devāpi, Śāntanu, Bāhlīka.

Sudhanu's branch goes to Uparichara Vasu and thence to Magadha, Matsya and Chedi
(Part II).

## I.4 The other sons of Ayus

`SB 9.17.1`. Ayus had five sons, and the tree previously carried only Nahusha.
**Nahuṣa**, **Kṣatravṛddha** (the Kashi line, Part II), **Rajī** (five hundred sons who
seized Indra's heaven and were undone by Brihaspati), **Rābha**, **Anenā**.

---

# Part II. Where each branch dynasty grafts on

The heart of this compilation. Every clan below sat in the tree as an island held by a
`genAnchor`; the Puranas name the kings that connect them.

## II.1 Kashi, from Kshatravriddha

`SB 9.17.1-9`. Attaches at **Āyu → Kṣatravṛddha**.

Suhotra → **Kāśya**, Kuśa, Gṛtsamada (→ Śunaka → **Śaunaka**, of the Śaunaka of the
Bhagavata's own frame story). Kāśya → **Kāśi** → Rāṣṭra → Dīrghatama → **Dhanvantari**
(inaugurator of medicine, a *śaktyāveśa* incarnation) → Ketumān → Bhīmaratha →
**Divodāsa of Kashi** → Dyumān (**Pratardana**, also Śatrujit, Vatsa, Ṛtadhvaja,
Kuvalayāśva) → **Alarka** (reigned sixty-six thousand years) → Santati, Sunītha,
Niketana, Dharmaketu, Satyaketu, Dhṛṣṭaketu, Sukumāra, Vītihotra, Bharga, Bhārgabhūmi.

This is where **Kāśirāja**, father of Amba, Ambikā and Ambālikā, belongs, and it makes
Bhishma's abduction of the three princesses a marriage between two branches of the same
lunar house.

Divodasa of Kashi is **not** the Panchala Divodasa already in the tree. See namesakes.

## II.2 Gandhara, from Druhyu

`SB 9.23.14-16`. Attaches at **Yayāti → Druhyu**.

Babhru → Setu → Ārabdha → **Gāndhāra** → Dharma → Dhṛta → Durmada → **Pracetā**, whose
hundred sons took the north.

Below Gandhara the texts go quiet until **Subala**, father of Gandhari and Shakuni, so a
single padded union carries the span. The payoff is that Shakuni and Duryodhana turn out to
be distant cousins through Yayati, which the Relation Finder can now trace.

## II.3 Ushinara, Shibi, Madra and Kekaya, from Anu

`SB 9.23.1-4`. Attaches at **Yayāti → Anu**.

Sabhānara (with brothers Cakṣu and Pareṣṇu) → Kālanara → Sṛñjaya → Janamejaya →
Mahāśāla → Mahāmanā → **Uśīnara** and **Titikṣu**.

Uśīnara → **Śibi**, Vara, Kṛmi, Dakṣa. Śibi, who cut his own flesh for a hawk to ransom a
dove, fathered Vṛṣādarbha, Sudhīra, **Madra** and **Kekaya**.

So `familyMadra` (Shalya, Madri) and `familyKekaya` (Ashvapati, Kaikeyi) are brother
kingdoms, both Anu's line, and Madri and Kaikeyi are kin across the two epics.

## II.4 Anga, Karna's throne, from Anu

`SB 9.23.4-14`. Attaches at **Yayāti → Anu → Titikṣu** (Ushinara's brother).

Ruṣadratha → Homa → Sutapā → **Bali**. Bali was sonless; the blind sage **Dīrghatamas**
begot on his queen six sons who each took a kingdom: **Aṅga**, Vaṅga, Kaliṅga, Suhma,
Puṇḍra, Oḍra.

Aṅga → Khalapāna → Diviratha → Dharmaratha → Citraratha, called **Romapāda** (in the tree,
Dasharatha's friend who adopted **Śāntā** and married her to **Ṛṣyaśṛṅga**) → **Caturaṅga**
(Rishyasringa's boon) → Pṛthulākṣa → Bṛhadratha, Bṛhatkarmā, Bṛhadbhānu → Bṛhanmanā →
Jayadratha (by his wife Sambhūti) → Vijaya → Dhṛti → Dhṛtavrata → Satkarmā → **Adhiratha**,
who found the basket on the Ganga and raised **Karṇa**.

This is the single most valuable graft in the batch: it puts Karna's adoptive house on the
tree with a real ancestry, and explains why Duryodhana had an Anga throne to give him.

## II.5 Turvasu

`SB 9.23.16-17`. Attaches at **Yayāti → Turvasu**.

Vahni → Bharga → Bhānumān → Tribhānu → Karandhama → **Maruta**, who had no son and
adopted **Duṣmanta** out of the Puru line. Dushyanta later went home to claim his own
throne, which is why the Puru succession reads unbroken.

## II.6 Vidarbha, from Kroshtu

`SB 9.23.30-38` and `SB 9.24.1-2`. Attaches at **Yadu → Kroṣṭu**.

The tree's existing spine follows the Vishnu Purana (Kroṣṭu → Vṛjinivat → Svāhi →
Ruṣadru). From there the Bhagavata continues: **Citraratha** → **Śaśabindu** (emperor of
the world, fourteen jewels, ten thousand wives) → **Pṛthuśravā** → Dharma → Uśanā (a
hundred horse-sacrifices) → **Rucaka** → **Jyāmagha**.

Jyamagha, too afraid of his barren queen **Śaibyā** to take a second wife, brought home a
captive girl and told his queen she was her daughter-in-law. The devas made the words true:
Shaibya bore **Vidarbha**, who grew up and married the girl.

Vidarbha → **Kuśa**, **Kratha**, **Romapāda** (the Vidarbha Romapada, not Anga's) →
Babhru → Kṛti → Uśika → **Cedi**, from whom the Caidyas: a second derivation of Chedi
alongside the Uparichara Vasu one in II.7. Both are recorded in the Bhagavata; the tree
uses the Vasu derivation for Damaghosha and notes this one.

**Śaśabindu is the hinge between the two dynasties**: his daughter **Bindumatī** married
Mandhata of the solar line and bore Purukutsa, Ambarisha and Mucukunda.

## II.7 Magadha, Matsya, Chedi and Satyavati, from Kuru

`SB 9.22.4-8` with `MBh 1.57`. Attaches at **Kuru → Sudhanu**.

Sudhanu → Suhotra → Cyavana → Kṛtī → **Uparicara Vasu**, the king whose aerial chariot
gave him his name. His sons, all rulers of Cedi: **Bṛhadratha** (founder of Magadha, father
of Jarāsandha), Kuśāmba, **Matsya**, Pratyagra and **Cedipa**.

By the apsara **Adrikā**, cursed into a fish, Uparichara Vasu fathered twins: the boy who
became the Matsya king, and the girl **Satyavatī**, raised by fishermen, mother of Vyāsa by
Parāśara and of Chitrangada and Vichitravirya by Shantanu.

Four islands attach at one point: `familyMagadha`, `familyMatsya`, `familyChedi`, and
Satyavati herself, who has stood in the tree with no parents at all. It also makes
Jarasandha a Kuru cousin, which sharpens rather than softens his war with Krishna.

## II.8 Haihaya and Kartavirya Arjuna, from Yadu

`SB 9.23.20-29`. Attaches at **Yadu → Sahasrajit**.

Yadu's four sons were **Sahasrajit**, **Kroṣṭā**, **Nala** and **Ripu**.

Sahasrajit → Śatajit → Mahāhaya, Reṇuhaya, **Haihaya** → Dharma → Netra → Kunti →
Sohañji → Mahiṣmān (Mahishmati) → Bhadrasenaka → Durmada, **Dhanaka** → **Kṛtavīrya**
(with Kṛtāgni, Kṛtavarmā, Kṛtaujā) → **Kārtavīrya Arjuna**.

Kartavirya received the eight *siddhis* from **Dattātreya** (already in the tree as Atri's
son) and ruled eighty-five thousand years; **Paraśurāma** killed him over the stolen cow,
and of his thousand sons five survived: Jayadhvaja, Śūrasena, Vṛṣabha, Madhu, Ūrjita.
Jayadhvaja → **Tālajaṅgha**, whose hundred sons were annihilated by Sagara with the power
Aurva gave him. This closes a loop: Aurva and Sagara are both already in the tree.

## II.9 The Vrishni spine, from Kratha

`SB 9.24.1-26`. Attaches at **Vidarbha → Kratha** and fills the old `u_madhu` gap of 8.

Kratha → Kunti → **Vṛṣṇi I** → Nirvṛti → **Daśārha** → Vyoma → Jīmūta → Vikṛti →
Bhīmaratha → Navaratha → Daśaratha → Śakuni → Karambhi → Devarāta → Devakṣatra →
**Madhu** → Kuruvaśa → Anu → Puruhotra → Ayu → **Sātvata**.

Sātvata's seven sons: Bhajamāna, Bhaji, Divya, **Vṛṣṇi II**, **Devāvṛdha**, **Andhaka**,
**Mahābhoja** (from whom the Bhoja kings).

- **Vṛṣṇi II** → Sumitra, **Yudhājit** → **Śini** and **Anamitra**. Anamitra → Nighna →
  **Satrājita** and Prasena (the Syamantaka jewel); a second **Śini** → **Satyaka** →
  **Yuyudhāna**, that is **Sātyaki**. A third son of Anamitra, **Vṛṣṇi III**, →
  **Śvaphalka** (with **Gāndinī**) → **Akrūra**, and Citraratha → Vidūratha → **Śūra** →
  **Vasudeva**.
- **Andhaka** → Kukura → Vahni → Vilomā → Kapotaromā → Anu → Andhaka → Dundubhi →
  Avidyota → Punarvasu → **Āhuka** → **Devaka** and **Ugrasena**.

Devaka's seven daughters, all married to Vasudeva, are named at `SB 9.24.22-23`:
Dhṛtadevā (eldest), Śāntidevā, Upadevā, Śrīdevā, Devarakṣitā, Sahadevā and **Devakī**.
Ugrasena's nine sons (**Kaṁsa**, Sunāmā, Nyagrodha, Kaṅka, Śaṅku, Suhū, Rāṣṭrapāla, Dhṛṣṭi,
Tuṣṭimān) and five daughters at `SB 9.24.24-25`.

## II.10 Panchala fill

`SB 9.21.25-33`, `SB 9.22.1-3`. Between Ajamidha and the Arka already in the tree:
Ajamīḍha → **Nīla** → **Śānti** → **Suśānti** → **Puruja** → **Arka** → **Bharmyāśva**.

Bhagavata has Mudgala fathering the twins **Divodāsa** and **Ahalyā** directly; the tree
follows the Vishnu Purana and Rigveda in putting **Vadhryaśva** (`RV 6.61`) between Mudgala
and Divodasa. Both readings are recorded; the tree keeps Vadhryashva.

Ajamidha's other branches, Bṛhadiṣu through Brahmadatta and Dvimīḍha through Yavīnara, are
catalogued at `SB 9.21.25-31` and left out for now (Part VI).

## II.11 The Kaushika line, from Amavasu

`SB 9.15.1-5`, filling the old `u_amavasu` gap of 6. Pururavas's six sons by Urvashi were
Āyu, Śrutāyu, Satyāyu, Raya, Jaya and Vijaya. The Kaushika branch runs
**Amāvasu** → ... → **Jahnu** (who drank the whole Ganga in one sip, hence *Jāhnavī*) →
Puru → Balāka → Ajaka → **Kuśa** → Kuśāmbu, Tanaya, Vasu, **Kuśanābha** → **Gādhi** →
**Viśvāmitra** and **Satyavatī** (who married Ṛcīka and bore Jamadagni).

## II.12 Videha, from Nimi

`SB 9.13.1-27`. Attaches at **Ikṣvāku → Nimi**, Ikshvaku's second son. Nimi and Vasishtha
cursed each other's bodies to fall; the sages churned Nimi's preserved body and **Janaka**
(Mithi, eponym of Mithila, called Vaideha because born of no womb) came out.

Udāvasu, Nandivardhana, Suketu, **Devarāta**, Bṛhadratha, Mahāvīrya, Sudhṛti, Dhṛṣṭaketu,
Haryaśva, Maru, Pratīpaka, Kṛtaratha, Devamīḍha, Viśruta, Mahādhṛti, Kṛtirāta, Mahāromā,
Svarṇaromā, **Hrasvaromā** (in the tree), **Śīradhvaja** (the Janaka of the Ramayana, who
found Sita in the furrow, *sīra*) and **Kuśadhvaja**.

After Siradhvaja: Dharmadhvaja → Kṛtadhvaja and Mitadhvaja → **Keśidhvaja** and
**Khāṇḍikya**, then Bhānumān down through Kṛti and Mahāvaśī, "and this completes the list
of the entire dynasty".

## II.13 Small fixes

- **Jayasena**, husband of Rājādhidevī and father of the Avanti brothers Vinda and
  Anuvinda, is missing from the tree. `SB 9.24.42`
- **Vṛddhaśarmā** of Karusha, husband of Śrutadevā and father of Dantavakra. `SB 9.24.37`
- **Śānta** should sit as Romapada's adopted daughter with Dasharatha as birth father,
  which the tree already does correctly. `SB 9.23.7-10`

---

# Part III. The side stories

## III.1 Nala and Damayanti

`MBh 3.50-78`, the Nalopākhyāna, told to Yudhishthira in the forest as consolation: another
king who lost everything at dice and got it back.

| Person | Role |
|---|---|
| **Vīrasena** | King of Niṣadha, Nala's father |
| **Nala** | Master of horses and of cookery; possessed by Kali |
| **Puṣkara** | Nala's brother, who won the kingdom at dice |
| **Bhīma of Vidarbha** | Damayanti's father, long sonless |
| **Damana** | The sage whose boon gave Bhima his children |
| **Damayantī** | Who chose Nala at her svayamvara over four devas wearing his face |
| **Dama, Dānta, Damana** | Her three brothers |
| **Indrasena** | Their son |
| **Indrasenā** (**Nalāyanī**) | Their daughter, in the tree, who married Mudgala |
| **Ṛtuparṇa** | King of Ayodhya; Nala served him as the cook-groom **Bāhuka** |

In the graph: Virasena, Nala (with **Bahuka** as his second name), Pushkara, Bhima of
Vidarbha, Damayanti, her brothers Dama, Danta and Damana, their son Indrasena, and their
daughter Indrasena, already present as **Nalayani**. Rituparna is in the solar line.

Not in the graph, because this is a kinship graph and they are kin to no one in it:
**Damana** the sage whose boon gave Bhima his children, the charioteer **Vārṣṇeya**,
Rituparna's groom **Jīvala**, the brahmins **Sudeva** who found Damayanti in Chedi and
**Parṇāda** whose riddle-verse drew Nala out, and the age-spirits **Kali** and **Dvāpara**,
who entered Nala and the dice. They live in the notes on Nala and Damayanti, and here.

**A chronology the tree cannot fully honour.** Rituparna is the forty-fifth solar king,
fourteen generations above Rama, so a strict reading puts Nala before the Ramayana. The
tree keeps Nala where he has always been, below Rama and above Kurukshetra, at row 74
against Rituparna's 50, because his daughter Nalayani married into the Panchala line at
that depth. Rituparna goes in his canonical solar slot. The friendship is recorded in the
notes, not as an edge.

Note also: Nala of **Niṣadha** (a janapada near Vidarbha) is not a **Niṣāda** (the forest
tribe of Ekalavya). The tree's `familyNishada` conflated them; the fix is a separate
`familyNishadha`.

## III.2 Muchukunda and Kalayavana

`SB 10.50-51`, with `VP 5.23` and `HV 58` for Kalayavana's birth.

**Mucukunda**, son of Māndhātā, guarded the devas through a long war until Kārttikeya
relieved him. Offered any boon but liberation, he asked for sleep, and for whoever woke
him to burn. He slept in a cave for ages.

**Kālayavana** was born to the brahmin **Gārgya**, who had been mocked as impotent by
**Śyāla** in the Yadava assembly and did twelve years of penance on iron filings until
Shiva granted him a son who would break the Yadavas. The child was born of the apsara
**Gopālī** (Rambhā in some recensions) and raised by the childless **king of the Yavanas**.
Narada pointed him at Mathura, and he came with thirty million soldiers.

Krishna, weaponless, ran until Kalayavana followed him into the cave, kicked the sleeping
man, and was ash before he understood. Then Mucukunda, who had slept since Mandhata's age,
woke to find Vishnu standing over him.

In the tree Mucukunda sits beside his brothers in Mandhata's generation, which is correct
and is exactly what `genAnchor` and the downward-only leveler make possible. The one
encounter is a note, not an edge.

## III.3 Mandhata and Saubhari

`SB 9.6.33-55`.

Mandhata's wife was **Bindumatī**, daughter of the Yadava emperor **Śaśabindu**: the
cleanest solar-lunar marriage in the Puranas, and the reason Mandhata's household appears
in both dynasty chapters. Their sons were **Purukutsa**, **Ambarīṣa** and **Mucukunda**,
and their daughters numbered **fifty**.

**Saubhari Muni** was performing austerity underwater in the Yamuna when he watched a pair
of fish mate, and desire took him. He asked Mandhata for a daughter. Mandhata, seeing an
old man with grey hair and a trembling head, would not refuse outright and said only that
his daughters chose for themselves. Saubhari made himself young and beautiful; all fifty
chose him; and they quarrelled over him afterwards, each certain he was hers alone.

By his mantra-power he gave each of them her own palace, and by `SB 9.6.52` he says it
plainly: *"I became the husband of fifty wives, and in each of them I begot one hundred
sons, and thus my family increased to five thousand members."* Then he saw what the fish
had cost him, took vanaprastha, and his wives followed him.

The tree carries Saubhari, Bindumati, Shashabindu, the three sons and a representative set
of the daughters; the five thousand are a note, in the same spirit as Sagara's sixty
thousand and Kartavirya's thousand.

## III.4 Harishchandra, Rohita and Shunahshepha

`SB 9.7.7-26`, with `AB 7.13-18` and `Rām 1.61` for the fuller version.

Harishchandra had no son until Varuna gave him **Rohita** on the promise that the boy
would be the sacrifice. He deferred until Rohita was grown, and Rohita fled to the forest.
Six years later the boy came back having bought a substitute: **Śunaḥśepha**, the middle
son of the starving brahmin **Ajīgarta**, who sold him. His brothers were Śunaḥpuccha and
Śunolāṅgūla; the father took a further fee to hold the knife.

Shunahshepha praised the devas from the stake and was released. **Viśvāmitra** adopted him
as **Devarāta**, "god-given", over the protests of his own sons. Viśvāmitra was *hotā* at
that sacrifice, **Jamadagni** *adhvaryu*, **Vasiṣṭha** *brahmā*, **Ayāsya** *udgātā*: four
sages of the tree in one room.

## III.5 Madhavi and Galava

`MBh 5.104-121`, the Gālavacarita.

**Gālava** owed Viśvāmitra eight hundred white horses each with one black ear. **Yayāti**
had no such horses and gave him his daughter **Mādhavī** instead, whose blessing was that
she regained her maidenhood after each birth and that her sons would be kings. She was lent
to three kings for two hundred horses each and to Vishvamitra for the last two hundred:

| King | Realm | Son |
|---|---|---|
| **Haryaśva** | Ayodhya, solar | **Vasumanas**, the great giver |
| **Divodāsa** | Kashi, lunar/Kshatravriddha | **Pratardana**, the brave |
| **Uśīnara** | Bhoja, lunar/Anu | **Śibi**, the truthful |
| **Viśvāmitra** | Kaushika | **Aṣṭaka**, the sacrificer |

Madhavi refused a fifth marriage and went to the forest as *mṛgacāriṇī*, "she who lives
like a deer". Later, when Yayati fell out of heaven for pride, these four grandsons gave
him the merit of their sacrifices and raised him back.

**One woman ties four dynasties together**, three of them separate grafts in Part II. In
the tree she is the densest cross-link outside Yayati himself, and the Relation Finder
will now walk Karna's grandmother Ambika back to Yayati through her.

Galava, who set all of it in motion, is kin to no one here and lives in this note only.

Her four marriages have a real consequence for the leveling: partners share a generation,
so Ushinara, Divodasa of Kashi, Haryashva of Ayodhya and Vishvamitra are welded to a single
row. That is correct, they were contemporaries, but it means none of those four lineages
can be padded independently, and it is why the Kashi, Ushinara and Kaushika king-lists are
left exactly where their own genealogies put them, with the distance to their era carried
on the last link instead. Vishvamitra in particular stays high, one of the sages who simply
walk through every age: son of Gadhi, priest at Harishchandra's sacrifice, and Rama's
escort thirty rows further down.

## III.6 Kishkindha, past where Valmiki stops

Valmiki leaves the vanaras at Rama's coronation. Two later sources carry them one
generation further, and a third gives Hanuman a son he could not have had.

**The house of Kishkindha.** `Brahmāṇḍa Purāṇa 3.7.215-221` picks up where the epic
stops: **Aṅgada**, son of Vali and Tara, has a son **Dhruva** (3.7.220), the only vanara
of the next generation the Puranas name, and not to be confused with Dhruva the son of
Uttanapada who became the pole star. **Rumā**, Sugriva's queen, is the daughter of the
vanara chief **Panasa** (3.7.221), one of the captains sent out to search for Sita, and
bore Sugriva **three sons whom the text does not name**. That silence is left as silence
here: the union carries the note, not three invented people.

**Hanuman's parentage.** His mother **Añjanā** was the apsara **Punjikasthala**, called
Managarva in the Puranic Encyclopaedia's account, cursed into the body of a vanara; she
and **Kesari** propitiated Vayu for a son. Kesari's own descent is thin. The Puranic
Encyclopaedia gives him none, calling him only a forest king of Mahameru; the tradition
that makes him a son of **Bṛhaspati and Tārā**, and so a brother of Bharadvaja and Kacha,
comes from Keshavadasa's sixteenth-century *Rāmacandrikā*. It is a tempting graft, since
Brihaspati and Tara are already married in this tree with no children between them, and it
would join the whole house of Hanuman to the Angirasa line. It is **not** made: one late
poem against an encyclopaedia's silence is not enough to hang a lineage on. The reading is
recorded here so the next person to notice it does not have to look it up.

**Makardhwaja.** Hanuman was a brahmachari from birth, and the *Ahiravana-vadha* still gives
him a son. Cooling himself in the sea after burning Lanka, he shed a drop of sweat; a
**makara** swallowed it and conceived. **Ahiravana**, the sorcerer-king of Patala who
carried Rama and Lakshmana off in their sleep, raised the fish-born child and set him to
guard his gates, where Hanuman, come to the rescue, had to fight a son he did not know he
had. He saw the truth in dhyana, killed Ahiravana, and gave Patala to Makardhwaja to rule.

None of this is in Valmiki. It is told in the **Krittivasi** and **Ananda Ramayanas**, in
the **Adbhuta Ramayana**, and across the folk retellings; the Thai **Ramakien** makes the
mother a mermaid, **Suvannamaccha**, and Ravana's own daughter, and calls the son Macchanu.
The retellings also differ over whether Ahiravana is Ravana's son or his brother, and often
pair him with Mahiravana; the tree follows the reading that makes him a son.

The makara is a person in the tree rather than a blank, because a one-partner union means
"the other parent is unknown" and here the mother is perfectly well known, she is simply a
fish. **Adrikā**, the apsara cursed into a fish who conceived Satyavati by swallowing
Uparichara Vasu's seed (II.7), is the precedent.

**Nala and Nila.** Each has a deva for a father and no vanara kin any text records, which
is why both stood alone in this tree. **Nala**, who built the bridge, is the son of
**Viśvakarma** the architect of the devas, and inherited the craft; **Nīla**, who commanded
the army, is the son of **Agni**, whose effulgence the epic says was his father's
(`Rām 1.17`, `6.22`; Puranic Encyclopaedia). Both sires are now in the tree as free-agent
devas, so each has a line upward. Note that Nala's own article calls Nila his twin brother,
which cannot hold with two different fathers; the Puranic Encyclopaedia keeps them apart
and so does this tree.

**Hanuman is marked `divine`.** He is not merely Vayu's son but a deva in his own right: a
**chiranjivi**, one of the immortals who never dies, and in the Shaiva reading an avatar of
Rudra. Because he is rooted in his parents' union the flag changes only how he is drawn,
never his row.

## III.7 Shorter ones already or newly in the tree

| Story | Source | Cast added |
|---|---|---|
| Purukutsa and Narmadā in Rasātala | `SB 9.7.2-3` | Narmadā |
| Sagara's sixty thousand and Kapila | `SB 9.8.5-30` | Sumatī, Keśinī, Kapila |
| Kalmashapada, Madayanti and Vasishtha | `SB 9.9.20-38` | Madayantī |
| Ambarisha and Durvasa's Sudarshana | `SB 9.4-9.5` | Ambarīṣa of Nabhaga's line, Virūpa, Ketumān, Śambhu |
| Rantideva's forty-eight-day fast | `SB 9.21.2-18` | Saṅkṛti, Rantideva, Guru |
| Rajī's five hundred sons and Indra's heaven | `SB 9.17.10-17` | Rajī |
| Chitraketu cursed by Parvati into **Vṛtra** | `SB 6.14-17` | note only; Vritra is already in the tree |

---

# Part IV. The Rigvedic end of the chain

Reference only. These are the figures whose names occur in the Samhitas and Brahmanas, with
the hymns; where the Vedic figure's identity with the Puranic king is contested, the tree
follows the Purana and this section records the doubt.

| Figure | Reference | Note |
|---|---|---|
| **Sudās Paijavana** | `RV 7.18`, `7.33`, `7.83` | The Battle of Ten Kings (*dāśarājña*), with Vasishtha as his priest |
| **Divodāsa Atithigva** | `RV 1.130`, `6.26` | Sudas's father, Bharadvaja's patron |
| **Vadhryaśva** | `RV 6.61` | Divodasa's father; the tree keeps him against the Bhagavata |
| **Purukutsa** | `RV 1.63.7`, `6.20.10` | Indra broke forts for the Purus through him |
| **Trasadasyu Paurukutsya** | `RV 4.42.8-9`, `7.19.3` | Called *ardhadeva*, half-god: a phrase used of no one else |
| **Māndhātṛ** | `RV 1.112.13`, `8.39-40` | |
| **Tryaruṇa Traivṛṣṇa** | `RV 5.27` | The Tryaruna of the Ikshvaku list |
| **Turvaśa and Yadu** | `RV 1.36`, `1.54`, `6.45` | Two of the *pañcajanāḥ*, the five peoples, with Anu, Druhyu and Puru |
| **Kakṣīvān Auśija** | `RV 1.116-126` | Son of Dirghatamas and the maid Ushij |
| **Dīrghatamas Māmateya** | `RV 1.140-164` | The blind sage who fathered Anga and his brothers on Bali's queen (II.4) |
| **Kuruśravaṇa Trāsadasyava** | `RV 10.33` | |
| **Abhyāvartin Cāyamāna**, **Sṛñjaya Daivavāta** | `RV 6.27` | The Srinjayas of the Panchala orbit |
| **Videgha Māthava** | `ŚB 1.4.1` | Carried Agni Vaiśvānara east with the priest Gotama Rāhūgaṇa and founded Videha: the charter myth behind Part II.12 |
| **Parikṣit** | `AV 20.127` | The "Parikshit hymn", praising his reign |
| **Janamejaya Pārikṣita** | `ŚB 13.5.4` | With his brothers Ugrasena, Bhīmasena and Śrutasena, performing the ashvamedha: the same four brothers as `SB 9.22.34` |
| **Janaka of Videha**, **Yājñavalkya**, **Gārgī**, **Ajātaśatru of Kashi**, **Pravāhaṇa Jaivali of Panchala** | `ŚB 11-14`, `BṛhU`, `ChU` | The Upanishadic court layer; the realms are in the tree, these individuals are not |

---

# Part V. Namesakes

Ids are unique; names are not. The rule: **suffix by realm** where two lines share a name
(`DivodasaKashi` beside the Panchala `Divodasa`), **suffix by ordinal** where one line
repeats a name (`YuvanashvaI`, `YuvanashvaII`), and record the pair here. `add-lineages.ts`
refuses to write if it would silently take an id the tree already holds, which is how the
Panchala Nila was caught before he could be adopted into the vanara army.

Two collisions were already in the data and are fixed by this pass:

- **Nanda** of Gokula, Krishna's foster father, had been conflated with **Nanda** the
  Kaurava, one of Dhritarashtra's hundred sons, which married a son of Dhritarashtra to
  Yashoda and made Krishna's foster father his own contemporary's brother. Now
  `NandaGokula` and `Nanda`.
- **Nishadha**, Nala's janapada, had been merged with **Nishada**, the forest tribe of
  Ekalavya. Now `familyNishadha` and `familyNishada`.

| Name | The people who share it |
|---|---|
| **Nala** | King of Niṣadha (`MBh 3.50`) · the vānara bridge-builder, Vishvakarma's son (`Rām 6.22`) · Yadu's third son (`SB 9.23.20`) · an Ikshvaku after Nishadha (`VP 4.4`) |
| **Nīla** | The vānara commander, Agni's son (`Rām 1.17`) · Ajamidha's son in the Panchala line (`SB 9.21.32`), here `NilaP` |
| **Dhruva** | Angada's son (`Brahmāṇḍa 3.7.220`), here `DhruvaV` · Uttanapada's son, the pole star (`SB 4.8-12`), not in the tree |
| **Divodāsa** | Kashi, son of Bhimaratha (`SB 9.17.5`) · Panchala, son of Vadhryashva (`SB 9.21.32`, `RV 6.26`) |
| **Bṛhadratha** | Magadha, Uparichara Vasu's son · Anga, Prithulaksha's son · the Ikshvaku future-king (`SB 9.12.11`) |
| **Romapāda** | Anga, who adopted Shanta · Vidarbha, Jyamagha's grandson |
| **Dilīpa** | Dilipa I, Amshuman's son · Dilipa II (Dīrghabāhu), Raghu's father · Dilipa of the Kuru line, Pratipa's father |
| **Sudāsa** | Ikshvaku, Sarvakama's son · Panchala, Mitrayu's son · Rigvedic Sudās Paijavana |
| **Aśvapati** | Kekaya, Kaikeyi's father · Madra, Savitri's father |
| **Bali** | The Daitya emperor, Prahlada's grandson · the Anu-line king, father of Anga and his brothers |
| **Pṛthu** | Vena's son, for whom the earth is Pṛthvī · the fifth Ikshvaku · a son of Rucaka |
| **Kunti** | Pṛthā, the Pandavas' mother · the Haihaya king, Netra's son · Kratha's son in the Vrishni spine |
| **Vṛṣṇi** | Satvata's son, the eponym · Kunti's son, ten generations earlier · Anamitra's son |
| **Madhu** | Devakshatra's son in the Kratha line · Vitihotra's son in the Haihaya line · Kartavirya's surviving son |
| **Śakuni** | Gandhara, Duryodhana's uncle · the Vrishni king, Dasharatha's son |
| **Devarāta** | Videha, Suketu's son · Shunahshepha, adopted by Vishvamitra |
| **Jarāsandha** | Magadha, torn apart by Bhima · a Kaurava namesake |
| **Nishadha** | Nala's kingdom · Atithi's son · Kuru's fourth son |
| **Maru** | The Ikshvaku still living in Kalapa · the Videha king |
| **Haryaśva** | Ikshvaku, twice (Dridhashva's son; Anaranya's son) · Ayodhya, Madhavi's first husband |
| **Janamejaya** | Parikshit's son · Puru's son · Srinjaya's son in the Anu line |
| **Prasenajit** | Ikshvaku, twice (before Yuvanashva II; before Takshaka) |
| **Śāntā**, **Suratha**, **Bhīmaratha**, **Ugrasena**, **Śatānīka**, **Sumitra**, **Daśaratha**, **Ṛkṣa**, **Citraratha**, **Somaka**, **Sṛñjaya**, **Sañjaya**, **Sahadeva** | Multiple; disambiguated at the point of use |

---

# Part VI. Catalogued but not added

Fully referenced here so a later pass can pick them up without new research.

**The Svayambhuva pre-history** (`SB 3.12`, `SB 4.8-4.31`, `SB 5.1-5.15`). Svayambhuva
Manu and Śatarūpā → Priyavrata and Uttānapāda; Uttanapada → **Dhruva** → Utkala and
Vatsara → ... → **Aṅga** → **Vena** → **Pṛthu** and **Arci** → Vijitāśva/Antardhāna →
Havirdhāna → Prācīnabarhi → the ten **Pracetas** → **Dakṣa** reborn. Priyavrata's ten sons
and daughter **Ūrjasvatī** (who married Shukracharya and bore Devayani, a link straight
into Yayati's marriage) → **Āgnīdhra** → **Nābhi** and Merudevī → **Ṛṣabha** → **Bharata**
of Bharatavarsha, the Jada Bharata of the deer.

**The Kali-yuga king lists.** Ikshvaku after Brihadbala down to **Sumitra**
(`SB 9.12.10-16`); the Kuru line after Janamejaya down to **Kṣemaka** (`SB 9.22.40-45`);
the Magadha line after Jarasandha's son Sahadeva down to **Ripuñjaya** (`SB 9.22.46-49`);
and the dynasties of `SB 12.1`: Barhadratha, Pradyota, Śiśunāga, **Nanda**, **Maurya**,
Śuṅga, Kaṇva, Āndhra. These extend the tree far below Kurukshetra and would roughly double
its height again.

**The Ajamidha side branches** (`SB 9.21.25-31`): Bṛhadiṣu → ... → Brahmadatta →
Viṣvaksena → Udaksena → Bhallāṭa, and Dvimīḍha → Yavīnara → ... → Bahuratha.

**The Kashi line below Alarka** (`SB 9.17.8-9`) and **the Videha line below Bhanuman**
(`SB 9.13.25-27`), both long lists of names without stories.

---

## Sources used

- Śrīmad-Bhāgavatam, cantos 4, 5, 6, 9, 10 and 12, Bhaktivedanta translation,
  <https://vedabase.io/en/library/sb/9/>. Canto 9 chapter by chapter is the spine.
- Viṣṇu Purāṇa, H. H. Wilson translation, book IV, via
  <https://www.wisdomlib.org/hinduism/book/vishnu-purana-wilson>
- Harivaṃśa, M. N. Dutt translation, ch. 58 (Kalayavana), via
  <https://www.wisdomlib.org/hinduism/book/harivamsha-purana-dutt>
- Mahābhārata: Vana Parva 50-78 (Nalopākhyāna), Udyoga Parva 104-121 (Gālavacarita),
  Ādi Parva 57, 63 (Uparichara Vasu, Satyavati)
- Aitareya Brāhmaṇa 7.13-18 (Śunaḥśepha)
- Ṛgveda hymn references per Griffith's numbering
