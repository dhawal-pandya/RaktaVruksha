# The current lineage work

The live working document. `PURANIC_LINEAGES.md` beside it is the **archive**: the original
1,099-person compilation, Parts I-IX, plus the build mechanics that still govern everything
here. Read that one for how the tree works and where its first thousand people came from;
read this one for what is being done to it now.

**State:** 1,188 people, 612 unions, 58 families, rows 0..101.
Rama at row 66, Kurukshetra at row 94. All anchors relative.

> The row numbers quoted throughout the archive (Rama 64, Kurukshetra 92) are from before
> the Kardama graft in pass two; they are two rows shallow. Trust the numbers here.

## Rebuilding

```bash
cd app
npm run add-lineages          # pass one   (archive, Parts I-IX)
npm run add-more-lineages     # pass two   (below)
npm run add-primordial-lines  # pass three (below; trimmed after this pass, see Pass three note)
npm run add-daksha-daughters  # pass four  (below)
npm run reanchor-eras         # era placement; idempotent
npm test && npx tsc --noEmit && npm run build
```

All the add-scripts are idempotent and refuse to write on an id collision or a
`validateData` error. `reanchor-eras` prints a contemporaries checklist and a stranded-person
check; both must come back clean.

One footgun in the idempotency, worth knowing rather than being surprised by: pass four
(`add-daksha-daughters.ts`) flags `Prasuti` divine, which bumps her `updatedAt` stamp past
pass three's. Re-running `add-primordial-lines` *after* pass four has already run will then
false-flag her as a collision and refuse to write — she isn't one, the script is just
conservative about a timestamp it doesn't recognize. Not a problem for the documented
sequence above, only for re-running a pass out of order.

---

## Pass two — the second splice (22 people)

Found while researching what else the tree could carry, after the 1099-person pass above
was already complete. Executable form: `scripts/add-more-lineages.ts`, run after
`add-lineages.ts` and idempotent the same way. Twenty-one people, sixteen unions. Thirteen
are Bhagavata; Suvarchala (X.4) is not, and says so on her own record; Savitri, Satyavan,
Dyumatsena, Ashvapati of Madra (X.3b), Jaratkaru, Jaratkaru and Astika (X.5) are Mahabharata;
Kardama's own parentage (below) is Vishnu Purana, not Bhagavata.

### X.1 Kardama, Devahuti, and eight of the nine daughters

`SB 3.24.13-32`, read. The single highest-value graft of this pass: Brahma has **Kardama**
give his daughters to the nine sages, and two of those wives — **Anasuya** (Atri's wife) and
**Arundhati** (Vasishtha's wife) — were already in the tree with no parents at all. This is
the union that gives them one.

| Daughter | Husband | Verse |
|---|---|---|
| **Kalā** | Marīci | `3.24.15` |
| **Anasūyā** (in the tree) | Atri | `3.24.15` |
| **Śraddhā**, here `ShraddhaAngirasa` | Aṅgirā | `3.24.16` |
| **Havirbhū** | Pulastya | `3.24.17` |
| ~~Gati~~ | ~~Pulaha~~ | `3.24.18` — **omitted**, see below |
| **Kriyā** | Kratu, here `KratuRishi` | `3.24.19` |
| **Khyāti** | Bhṛgu (second wife, beside Puloma) | `3.24.20` |
| **Arundhatī** (in the tree) | Vasiṣṭha | `3.24.21` |
| **Śānti**, here `ShantiAtharva` | Atharvā | `3.24.22` |

Two namesake clashes, resolved the way the tree already resolves them (suffix by role):
`Shraddha` was taken by Manu's wife (`SB 9.1`), and `Shanti` by a son of Krishna and Kalindi
(`SB 10.61`). Both keep their plain name as `firstName`; only the id is disambiguated.

**Kratu and two sages who didn't exist.** `Kratu` was also taken, by a son of Krishna and
Jambavati, and the sage himself was not in the tree under any id — he was findable only as
that Yadava namesake, sitting alone at row 92 with no parents, which is what first suggested
this whole branch was worth pulling forward. **Pulaha** and **Atharva** did not exist at
all. All three now join Marichi, Atri, Angiras, Bhrigu and Vasishtha as Brahma's sons in
`u_brahma_extra`, completing the nine of `SB 3.24.13`.

**Kapila, promoted.** Kardama and Devahuti's ninth child is **Kapila**, already in the tree
as a suspended avatar (anchored beside Sagara) whose own notes already named his parents —
the edge simply never existed. His anchor is relative (`at("Sagara")` in `reanchor-eras.ts`),
so it now reads 43 rather than 41, following Sagara's own two-row drop below, but the effect
is the same: he now has real parents feeding into Part VIII's "connected" column instead of
"suspended."

**Kardama's own parentage, and why it cost the tree two rows.** The Bhagavata's own account
(`SB 3.12`) has Kardama arise directly from Brahma's shadow, a Prajapati of the first
generation with no father to speak of. The Vishnu Purana gives a different, minor tradition
instead (`VP 1.10`): Pulaha and his wife Kṣamā have three sons, Kardama, Urvarīyān and
Sahiṣṇu — a bare name in a list, nothing more, and almost certainly a *different* Kardama
from the one who marries Devahuti, going by how thin the Vishnu Purana's own mention is next
to the Bhagavata's forty-verse story. The tree adopts it anyway, on request, over the
Bhagavata's reading, and the reason is worth recording plainly: with Kardama one of Brahma's
own, level with Brahma's other sons rather than below them, his marriage to daughters who
wed those same sons had **no row left to occupy but Brahma and Saraswati's own** — a hard
rule this tree holds without exception. Making him Pulaha's son instead gives him a real
floor one row under his father, and that edge is what does the actual work: Kardama's
daughters still marry Atri, Vasishtha, Marichi, Pulastya and the rest, so those sons of
Brahma — and everyone under them, the whole solar line down to Rama, the whole rakshasa line
down to Ravana — move two rows deeper to keep the marriages one row below their new
father-in-law. `reanchor-eras.ts` needed no new code for this: Rama and Kurukshetra are
measured fresh off the bare graph on every run rather than hardcoded, so the whole tree
re-settles on its own. Before this graft: Rama at 64, Kurukshetra at 92. After: **Rama at
66, Kurukshetra at 94** — the two calibration numbers cited everywhere else in this document
before Part X are now two rows shallow; read them as historical, not current.

**Gati, omitted.** `SB 3.24.18` marries her to Pulaha — the same Pulaha who is now Kardama's
father in this tree. Keeping her would make Pulaha his own son's father-in-law, which is
nowhere in either source; rather than silently resolve a contradiction the texts don't
actually contain, she is left out. Kardama has eight wed daughters here, not nine.
Devahuti's own father, Svayambhuva Manu, stays out of the tree exactly as Part VI.1 already
recommends; this graft does not reopen that branch.

### X.2 Rati's second marriage

`SB 10.55`, read. Kāmadeva, burned by Rudra, is reborn as **Pradyumna** — both already in
the tree, and so is his widow **Rati**, married to him with no children (`u_kama_rati`),
waiting for his next body. The missing middle: the demon **Śambara** stole the ten-day-old
Pradyumna and threw him in the sea; a fish swallowed him; the fish reached Śambara's own
kitchen, where his cook **Māyāvatī** found the child inside it and raised him, not knowing
that Māyāvatī was Rati herself, working under that name while she waited. When Pradyumna
was grown, killed Śambara, and heard the truth from her, he married her — the same wife, the
second time.

The tree does not add a `Mayavati` person: Rati already exists, and Māyāvatī is her, so this
is a second union between two people already there, not a new name (`u_pradyumna_rati`,
alongside her existing marriage to Kamadeva).

### X.3 Markandeya's vision

`SB 12.8-10`, read for the vision; the descent from Bhrigu is cited (Vettam Mani, *Puranic
Encyclopaedia*) rather than chapter-and-verse, since the Bhagavata itself doesn't state it.
**Mrikandu**, a new son of Bhrigu alongside Shukracharya and Chyavana, fathers **Markandeya**,
granted a life without end. In the waters of pralaya he sees an infant Nārāyaṇa asleep on a
banyan leaf, is drawn in on the child's in-breath, sees the whole universe running its course
again inside the infant's body, and is breathed back out into the flood — the one sage who
remembers every dissolution, when even the gods forget the one before.

#### X.3b Savitri and Satyavan

`MBh 3.277-283`, the Pativrata-mahatmya, told to Yudhishthira in the Vana Parva — the exact
same frame and the same consolation role as the Nalopakhyana (III.1), and, like Nala, absent
from the tree until now. **Ashvapati**, king of Madra, propitiates the goddess Savitri for a
child after eighteen sonless years and names his daughter for her. **Savitri** chooses the
exiled prince **Satyavan** for herself knowing from Narada that he has exactly a year to
live, and marries him anyway; when **Yama** comes in person for his soul, she follows on
foot, out-argues him on dharma until he grants her boons — sight and kingdom back for
Satyavan's blind, deposed father **Dyumatsena**, a hundred sons of her own — and wins her
husband back by asking, last, for children only he could give her.

**Ashvapati of Madra is not chained to the tree's own Madra line** (Dyutimanta, father of
Shalya and Madri, II.3): nothing in the source identifies the two kings, and forcing one
would be inventing a link the text doesn't give, exactly the restraint the tree already
applies to Rituparna and NalaNishadha. He is `AshvapatiMadra`, distinct from the
already-present Ashvapati of Kekaya, Kaikeyi's father. The whole family — Ashvapati, Savitri,
Satyavan, Dyumatsena — is anchored beside Nala and Damayanti in `reanchor-eras.ts`, the same
slot, for the same reason: a consolation tale with no genealogical anchor of its own.

### X.4 Suvarchala: found, and added anyway

The story that prompted this pass — Hanuman married to **Suvarchalā**, Sūrya's daughter,
given as *guru-dakṣiṇā* when Sūrya taught him the nine grammars — is not in the Bhagavatam.
Its source is the **Parashara Samhita**, a text devoted to Hanuman, and it survives today
mainly as a regional Telangana tradition (the Suvarchala Anjaneya Swamy temple). By the
same reasoning as the Kesari-Brihaspati case in III.6 — one late text with a devotional
afterlife, against no epic or Purana support — this would ordinarily stay **thin**: recorded
in prose, not drawn as an edge, the way Hanuman's own entry still notes it is *not* the
Bhagavata.

It is added anyway, on request, because the tree is allowed to carry more than the
Bhagavata alone once that's the explicit choice, so long as the sourcing stays honest on the
record rather than silently upgraded to **read**. `Suvarchala` is Sūrya's daughter by a
single-parent union (her mother is unnamed in the sources — the same convention the tree
uses for Adrikā and Makardhwaja) and Hanuman's wife by a second. Surya himself frames the
marriage, in his own words to Hanuman, as *brahmāṇḍa kalyāṇa* — for the world's good — and
not a breach of the brahmacharya vow; the note on both her record and Hanuman's carries that
framing rather than silently resolving the tension.

### X.5 Astika, closing the frame

`MBh 1.13-53`, cited, exactly the connection Part VII.3 flagged as ready and never made:
Janamejaya, Vasuki and Takshaka were all three already in the tree, and this is the one edge
that closes the loop the whole epic is narrated inside. The sage **Jaratkaru** refused to
marry until his own ancestors, seen hanging over a pit by a fraying rope of grass, told him
only a son could save them, and that the son must share his name; Vasuki gave him his sister
— also, by the same prophecy, named **Jaratkaru** — and their son **Astika** grew up to
interrupt Janamejaya's snake sacrifice with the nagas already falling into the fire, winning
the boon that stopped it before the king understood what he was granting.

Mother and father share one id-clash each with nothing (there is no other Jaratkaru in the
tree) but need distinguishing from each other, so they are `JaratkaruSage` and
`JaratkaruNagi`, the same suffix-by-role convention as `ShraddhaAngirasa` and `ShantiAtharva`
in X.1. Jaratkaru-nagi is added as a daughter of Kashyap and Kadru, alongside Vasuki and the
tree's other principal nagas, since she is Vasuki's sister and the text gives no other
mother.

**Astika's row is anchored to Janamejaya's, not to his parents'.** Left to his ancestry alone
he would float three rows below Kashyap, ages before the king whose court is his entire
story — the same shape of problem the tree already accepts for Surya fathering Karna an age
after his own generation, and solves the same way, with a long ray rather than a forced
chronology.

---

---

## Pass three — the primordial lines (56 people, later trimmed to 26)

`scripts/add-primordial-lines.ts`. Fifty-six people, thirty unions, added in one sitting.
Measured before and after: **not one existing person changed row**, except Daksha, who moved
from 1 to 2 when his marriage to Prasuti was drawn. Rama 66, Kurukshetra 94, Kalki 101, 55/55
contemporaries, all unchanged.

Thirty of those fifty-six people and seventeen of those thirty unions — the whole Priyavrata/
Uttanapada chain in XI.2 below — were removed later in the same session, on request: see
"XI.2, trimmed" for what left and why. Twenty-six people and thirteen unions from this pass
survive. The paragraphs below describe the pass as it was **first drawn**; where the trim
changed something, a note says so.

### XI.1 Bhumi, the Earth

`SB 3.13-19`, `10.59`. **Bhumi** enters beside **Varaha**, who lifted her out of the cosmic
waters, and like him she is **parentless by nature** — she is the ground the rest of the tree
stands on, not a descendant of anything in it. Her own family and colour (green).

She closes two things at once. **Narakāsura**, who stood in the tree with no parents at all,
is her son by Varaha (`SB 10.59.2-3`) — a link the archive's Part VII.1 catalogued and never
drew. His era anchor is a floor, so the edge renders as a long ray across eighty-seven rows
rather than dragging either parent down, exactly like Surya fathering Karna. And **Mangala**,
the red planet and the last of the nine grahas missing from the tree, is her son too — Bhauma
and Kuja both mean "born of the Earth". The Shaiva account gives him a father as well, a drop
of Shiva's sweat; the union carries one partner, because Shiva is deliberately not here.

### XI.2 The Svayambhuva pre-history, trimmed

`SB 3.12`, `4.1`. The archive's Part VI.1 deferred this branch for years on the fear that it
"would give the tree a second root above the one it has." **That fear was unfounded.**
Svāyambhuva Manu and Śatarūpā are born of Brahma's own body (`SB 3.12.54`), so the pair hangs
off row 0 like everything else — one root, unchanged.

It also closed a hole already in the data: **Devahuti** sat at row 2 with no parents, and her
own note already called her Svayambhuva Manu's daughter. Manu at row 1 puts her exactly where
she already was. Nothing moved. Their three daughters are what this branch is kept for:
**Akūti** (→ Ruci → the avatar **Yajña** and his twin **Dakṣiṇā**), **Devahūti** (→ Kardama,
above), and **Prasūti** (→ Daksha — the join Part VI.1 singled out, and the one change in this
pass that moved anybody: it makes the entire deva world a son-in-law of the first Manu, and
costs exactly one row on Daksha).

**Everything else this pass drew from here was removed later the same session, on request.**
The Bhagavata carries two long lines from Manu's two sons — Uttānapāda → Dhruva → Vatsara →
... → Aṅga → Vena → Pṛthu and Arci → ... → the Pracetas → **Dakṣa reborn**; and Priyavrata →
Āgnīdhra → Nābhi → **Ṛṣabha** → Bharata, for whom the land is Bhāratavarṣa — and both were
drawn in full before the call was made to cut them: twelve-plus generations of thin
king-list names for two payoffs (Ṛṣabha and Pṛthu as avatars; Daksha reborn, needed for his
own sixty daughters in `SB 6.6`), at a cost of dragging that reborn Daksha to row 19 and
requiring the `divineParents` workaround pass four uses anyway. Removed: `Priyavrata`,
`Uttanapada`, `Suniti`, `Suruchi`, `Dhruva`, `Uttama`, `Bhrami`, `Kalpa`, `Vatsara`,
`ChakshushaManu`, `UlmukaS`, `AngaS`, `Sunitha`, `Vena`, `Prithu`, `Archi`, `Vijitashva`,
`Havirdhana`, `Prachinabarhi`, `Pracetas`, `Marisha`, `DakshaPracetasa`, `Barhishmati`,
`Agnidhra`, `Urjasvati`, `Purvachitti`, `Nabhi`, `Merudevi`, `Rishabha`, `BharataJada` — thirty
people, seventeen unions. `Ṛṣabha` and `Pṛthu` are consequently *not* in this tree as avatars
after all; Part VIII's archive table, which excludes them, is correct again. Yajña alone
survives of the "three avatars gained ancestry" the pass first claimed, since he only needed
Akūti and Ruci, neither of them part of the cut.

Two side-effects of the removed lines were reverted with them. **Jayanti**'s note is back to
"Daughter of Indra; wed to Shukracharya," its pre-pass-three text — the marriage this pass gave
her to Ṛṣabha (`SB 5.4.8`) went with him. And **Devayani**'s mother-link is undone: `u_shukra`
is a one-partner union again, exactly as it was before this pass, since her mother `Ūrjasvatī`
was Priyavrata's daughter.

**Namesakes, of what remains:** `ManuSvayambhuva` (Vaivasvata Manu holds `Manu`).

### XI.3 The Angirasa house

`MBh 1.98`; `RV 1.116-126`. **Utathya**, **Saṁvarta** and **Mamatā** enter, and with them
**Dirghatamas** — who had stood in the tree fathering Anga on Bali's queen with no ancestry of
his own — finally has parents. Brihaspati forced himself on his brother's pregnant wife; the
unborn child kicked the seed away and was cursed blind for it, *dīrgha-tamas*, "long
darkness." His son **Kakṣīvān** is a Rigvedic seer in his own right.

This is the graft the archive graded **read** in Part VII.2, and it does what it promised:
**Karna's whole foster house now has a line back to Angiras.** Utathya sits at row 4 and
Dirghatamas at 24, twenty rows below his own father — an honest long ray, since the Angirasa
list is short and the Anu line he married into is long. Nothing is padded to hide it.

### XI.4 Manu's other sons, and Mali

`SB 9.2.16-28`. **Nṛga**, **Nariṣyanta** and **Pṛṣadhra** sat in the tree as names with
nothing under them; Nriga's line (Sumati, Bhūtajyoti, Vasu → Pratīka → Oghavān) and
Narishyanta's (five of the ten sons, down to **Agniveśya**, from whom the Āgniveśyāyana
brahmins) now hang from them. **Mali**, Sukesha's third son with Sumali and Malyavan, joins
the rakshasa house of Lanka (`Rām 7.5-7.8`).

---

## Pass four — Daksha's sixty daughters (20 people)

`scripts/add-daksha-daughters.ts`. `SB 6.6.1-31`, read directly and cross-checked (gitabase,
vedabase), not recalled from memory: the popular secondary literature is genuinely
inconsistent about which Daksha this chapter belongs to, and getting it wrong was the first
draft of this pass.

**The correction, caught before it shipped.** `SB 6.6.1` names the father "Daksa, who is known
as Prācetasa" and his wife **Asiknī**, daughter of Prajāpati Pañcajana (`SB 6.4.51`) — the
Bhagavata's own **reborn** Daksha, not the first one who married Prasuti. The gap table below
used to say this cluster was "unblocked — Prasuti is in"; that was wrong, and the first version
of this pass built all sixty daughters onto `DakshaPracetasa` and a new `Asikni` accordingly.
Then XI.2 was trimmed (above) and took `DakshaPracetasa` with it. Rather than rebuild that
whole chain for one wife, the sixty daughters were re-pointed to the **first** Daksha and
Prasuti instead — the simpler single-Daksha reading most retellings already use, and the one
the Vishnu Purana itself gives, since it never splits Daksha into two births at all. Said
plainly because it departs from the Bhagavata's own precise chronology: a deliberate
simplification, not a misreading, and the record says so on `u_daksha_prasuti`'s own note.

**Still `divineParents`, even against the closer Daksha.** Daksha sits at row 2, only one to
five rows above Kashyap (4), Chandra (6), Angiras (3) and Yama (7), so the era gap that forced
`divineParents` against row-19 `DakshaPracetasa` looks gone. It isn't, for a different reason:
the twelve of these wives already in the tree from the original archive were never children of
any Daksha union to begin with, just free-floating "Daughter of Daksha" records with a prose
note and no graph edge. Kashyap's own row is held up by his whole merged fifteen-wife group,
not by an ancestor above him. Making even one of them a real union-child of Daksha and Prasuti
would union-find-merge that entire group into Daksha's, and the leveler's reverse constraint (a
parent sits above its children) would then pull Daksha's own group — Prasuti, Svayambhuva Manu,
Shatarupa, Akuti, Devahuti and everything under them — down to sit no higher than one row above
Kashyap's wives, deepening all of it for no reason the texts give. So every one of the sixty
still carries `divineParents: ["Daksha", "Prasuti"]` for her scriptural parentage, same as
before the correction; only the two names inside that array changed. Measured before and after
on the corrected version: **not one existing person's row moved**.

**Four sub-clusters, all confirmed by direct verse lookup, not memory:**

- **Ten to Dharma/Yama** (`6.6.4`): Bhānu, Lambā, Kakud, Yāmi, Viśvā, Sādhyā, Marutvatī, Vasu,
  Muhūrtā, Saṅkalpā — ids suffixed `...Dharma` where the plain name collided (`BhanuDharma`,
  `YamiDharma`, `VasuDharma`). **Vasu is the prize**: her eight sons are the Vasus (`6.6.10-11`)
  — but the Bhagavata names them **Droṇa, Prāṇa, Dhruva, Arka, Agni, Doṣa, Vāstu, Vibhāvasu**,
  and the Mahabharata gives the same eight gods, born a second time as Ganga's sons, a
  *different* name each — Dhara, Dhruva, Soma, Aha, Anila, Anala, Pratyusha, Bhishma, already
  in this tree at row 90-91. Only `Dhruva` survives both namings. Rather than mint eight
  duplicate person records that map to no one in particular, Ganga's eight sons each got
  `divineParents: ["Yama", "VasuDharma"]` — their divine origin, stated once on Vasu's own note
  in full, without disturbing the union that actually places them.
- **Five more to Kashyap** (`6.6.21-31`), closing the seventeen: `Patangi`, `Yamini`, `Kashtha`,
  `SaramaKashyap` (collides with the Ramayana's Sarama, Vibhishana's wife), `Timi`. The other
  twelve of the seventeen were already here from the original archive and only needed the
  `divineParents` citation, not new records: Aditi, Diti, Danu, Kadru, Vinata, Surabhi, Tamra,
  Muni, Arishta, Surasa, Krodhavasha, Ira. Chandra's twenty-seven — the nakshatras, already
  fully drawn — got the same citation-only treatment.
- **Two to Angiras** (`6.6.19`): `Svadha` and `SatiAngirasa`. The second shares a name with
  Shiva's wife and nothing else — a different wife, a different husband, flagged inline; that
  other Sati stays out, as Shiva does.
- **Two to a Krishashva who is not the Ikshvaku king** already in this tree (`6.6.20`, `6.6.2`):
  a new `KrishashvaRishi`, anchored beside Kashyap, married to `ArcisKrishashva` (collides with
  Archi, Prithu's wife in the now-removed XI.2) and `Dhishana`. The archive's own namesake table
  (`PURANIC_LINEAGES.md:767`) already lists the two Krishashvas as distinct men; `SB 9.6.24`
  confirms the existing one is genuinely nothing but a name in a succession list, so his bare
  citation stays as it was.

**Left out.** `Bhuta` (`6.6.17-18`): his two wives mother "ten million Rudras," and Rudra is
Shiva — the tree's decision holds. The individual sons and grandsons `SB 6.6.5-9` names for the
ten Dharma-wives (Deva-rishabha, Vidyota, Sankata, Svarga, the Vishvadevas, the Sadhyas,
Marutvan, Jayanta, the Mauhurtikas) and three of Krishashva's four sons — either classes of
gods rather than individuals, or names the source gives nothing else to hang on — are recorded
in prose on their mothers' notes rather than as new person records.

### XII.1 Correction: Prasuti is `u_daksha`'s real second partner, not a `divineParents` citation

Found on request, after pass four above had already shipped: `u_daksha` is not a bare prose
note. It's a real, pre-existing 1-partner union — mother unconfirmed — going back to the
original archive, holding forty-two children: Aditi, Diti, Danu, Kadru, Vinata, Chandra's
twenty-seven nakshatra-wives, Surabhi, Tamra, Muni, Danayus, Arishta, Surasa, Krodhavasha, Ira,
Khasa and Rati. Pass four's `divineParents` links onto a separate `u_daksha_prasuti` were built
on the wrong assumption that these people had no graph edge to Daksha to begin with.

**Measured before touching anything**, per the standing rule: adding Prasuti as `u_daksha`'s
second partner moves not one existing person's row. Daksha and Prasuti were already merged as
a couple through `u_daksha_prasuti`, so filling in the "unknown" mother on the union that
actually holds the children is not a new cross-era link — it's the same couple, the same
group, just written down once instead of split across two unions.

**Confirmed per daughter before adding, not assumed:**

- The thirty-nine already linked via `divineParents` in pass four (Aditi, Diti, Danu, Kadru,
  Vinata, the twenty-seven nakshatras, Surabhi, Tamra, Muni, Arishta, Surasa, Krodhavasha, Ira)
  and the nineteen new people pass four added — all confirmed directly against `SB 6.6`.
- **Danayus and Khasa**, newly confirmed here: the Vishnu Purana names Daksha's wife
  **Panchajani** — the same figure this tree already equates with Prasuti, per pass four's own
  single-Daksha reading — as Danu's mother in the very passage that lists Khasa among her
  sisters.
- **Rati is NOT confirmed**, and stays out. Sources disagree on her mother outright, and one
  tradition has her born of Daksha's own perspiration — no mother at all. Rather than assume
  either way, she was split off `u_daksha` into her own `u_daksha_rati` (Daksha, one partner,
  mother still unconfirmed) before Prasuti was added, so the addition doesn't sweep her in by
  accident of sharing a union with her sisters.

**Cleanup that came with it.** `u_daksha_prasuti` — childless, and now fully redundant with
`u_daksha` — is retired; its note is folded into `u_daksha`'s. The `divineParents` fields pass
four had put on the thirty-nine already-linked people and the nineteen new ones are removed,
since they'd otherwise state the same fact twice, once as a citation and once as a real edge.
The one `divineParents` link pass four still uses — Ganga's eight sons to `["Yama",
"VasuDharma"]` — is a different shape of problem (a free-agent deva's parentage of a mortal-era
figure ninety rows deeper) and stays exactly as it was.

`add-daksha-daughters.ts` was rewritten to perform this connection directly (`addPartner`,
`addChild`) rather than leaving it as a follow-on patch, so a fresh build produces the final
state in one pass.

### XII.2 Correction: named grandchildren belong in the tree, not in a note

Also found on request: a note is a reference, not a decision to exclude. The first draft of
pass four mentioned several of Dharma's grandsons and Krishashva's sons only in their mothers'
notes — the wrong call for anyone the text names as an actual individual. Sixteen people added:

- **Bhanu → Deva-rishabha → Indrasena** (`SB 6.6.5`).
- **Lamba → Vidyota**, who "generated every cloud in the sky" (`6.6.6`).
- **Kakud → Sankata → Kikata** (`6.6.6`); Kikata's own descendants are called the Durgas —
  guardians of fortresses, *durga* being the word for fort, nothing to do with the goddess —
  and stay a class, not individuals, for the same reason the Vishvadevas do below.
- **Yami → Svarga → Nandi** (`6.6.6`). Flagged inline: not Shiva's bull and gatekeeper, an
  unrelated figure sharing only the name, added anyway since the collision is in name only.
- **Sadhya → Arthasiddhi**, named individually among the otherwise-ungrouped Sadhyas (`6.6.7`).
- **Marutvati → Marutvan and Jayanta** (`6.6.9`), the Bhagavata's own words calling both
  "expansions of Vasudeva." The second is `JayantaMarutvati`, suffixed against Indra's son.
- **Sankalpa → a son of the same name**, `SankalpaS`, "will and intention made a person twice
  over" (`6.6.9`).
- **Krishashva's sons, corrected, not just added.** The first draft blurred Archis and Dhishana
  together ("mother with Dhishana of Dhumaketu," "three more sons") and silently dropped one of
  the four. `SB 6.6.20` is precise: **Archis** alone bore **Dhumaketu**, the comet; **Dhishana**
  alone bore four — **Vedashira**, **Devala** (flagged: not the Mahabharata sage of the same
  name), **Vayuna**, and **Manu** (`ManuKrishashva`, suffixed against both Manus already here).
  Both mothers' own notes and the two unions were corrected to match.

**Still left as prose, correctly — classes, not people:** the Vishvadevas (Vishva's sons, no
progeny given at all), the Sadhyas as an unenumerated body, the Mauhurtikas, and Kikata's
Durgas. None of these are a single name a record could be built around; the individuals the
text does single out inside those same verses (Arthasiddhi among the Sadhyas) were pulled out
and added.

Measured before writing: **not one existing person's row moved.** All sixteen hang off unions
that already existed (the ten wives' own marriages to Dharma, or Krishashva's two), so they
inherit their parents' row exactly as any other child would.

---

## Decided against: Shiva, Vishnu, and their families

**They are not being added.** This is a decision, not a gap, and it should not be reopened
casually — but the reasoning is worth keeping, because it is a real property of the layout.

The leveler merges the partners of a union into one group, so **partners always share a row.**
That is right for a family tree and wrong for the gods. Measured against the real dataset:
putting Shiva at row 0 and marrying him to Sati — Daksha's daughter, two rows down — **drags
Shiva to row 2**, and a relative anchor pinning him to Brahma cannot hold him, because an
anchor is a floor and the union-find merge outranks it.

A fix exists and was prototyped: a `bindsGenerations: false` flag on a union, which skips the
partner merge while still emitting the parent→child edges. It worked — Shiva held row 0, each
wife sat with her own father, children landed a row below the lower parent, and the rest of
the tree did not move. **The prototype was reverted.** The judgement is that Shiva and Vishnu
sit genuinely outside a kinship graph: Vishnu in particular has almost no kinship edges at
all, since the avatars are not his children but himself, and the tree already represents him
the honest way, through the descents.

What survived that decision: **Bhumi**, who is primordial in her own right and needed no god
above her, and the Varaha→Narakasura link she made possible.

---

## Directive 1 — more people, every one grounded in a text

**The requirement: every person added must be traceable to a named text**, cited in the
archive's sigil style (`SB 9.7.4`, `VP 4.4`, `MBh 3.50`, `Rām 1.70`, `RV 7.18`). A figure
existing only in a modern retelling, a website, or an AI's recall is not eligible. A late,
regional or contradicted source is still addable — but the record must say so, as
`Suvarchala`'s does. Never promote a **thin** claim to a **read** one.

The tree is nowhere near its ceiling: `core/layout.ts` already drops its tick count above
2,500 nodes and `layerGapFor` compresses rows past 42 deep.

| Cluster | Sources | Note |
|---|---|---|
| **Daksha's sixty daughters** | `SB 6.6.1-31` (read) | **Done in pass four** — see above. Fifty-eight of sixty landed (all but Bhuta's two, excluded with Shiva). |
| **Bhuta's two Daksha-daughter wives** | `SB 6.6.17-18` | Reachable only if the Shiva decision is ever reversed — their sons are "ten million Rudras." |
| **Ajamidha's side branches** | `SB 9.21.25-31` | Bṛhadiṣu → Brahmadatta; Dvimīḍha → Yavīnara. |
| **Kashi below Alarka; Videha below Bhanuman** | `SB 9.17.8-9`, `9.13.25-27` | Long name-lists; low story value, and mostly exempt under Directive 2. |
| **Daksha's first sacrifice** | `SB 4.2-4.7` | The Sati story. Reachable only if the Shiva decision is ever reversed. |
| **Part VII of the archive** | various | Islands and parentless figures with links found but never drawn. Several were closed in passes two and three; the rest stand. |

Untouched sources: Skanda, Padma, Brahma, Vāyu, Matsya, Liṅga, Devī Bhāgavata and Bhaviṣya
Purāṇas, and the Rāmāyaṇa's Uttara Kāṇḍa.

---

## Directive 2 — a story for every person, or a verified reason there is none

**The rule:** every person should carry a note with something in it — a story, an epithet, a
deed, a pointer someone could look up. A note that is only a citation (`"SB 9.6.24"`) or only
a bare relation (`"Son of Yadu."`) is unfinished.

**The only exemption:** a figure who genuinely appears in the texts as *nothing but a name in
a succession list* keeps the bare citation and is left alone. That exemption is real and
covers much of the king-lists. **It must be verified, never assumed.**

| Bucket | Count | Share |
|---|---|---|
| Empty | 1 | 0.1% |
| Citation only | 131 | 11.1% |
| Under 60 chars | 258 | 21.8% |
| Under 120 chars | 428 | 36.2% |
| Substantial | 364 | 30.8% |

**"Citation only" is not "genuinely bare."** Real stories found hiding in the thin buckets:

- **Anaraṇya** (`"SB 9.7.4"`) — cursed Rāvaṇa that one of his own line would kill him.
- **Pratīpa** (`"husband of Sunanda"`) — Ganga sat on his right thigh; he told her the right
  thigh is a daughter-in-law's seat, and so she married his son Śantanu.
- **Subala** (`"father of Gandhari and Shakuni"`) — the starving of his line, and the dying
  instruction to Shakuni that drives the whole Kaurava plot.

**House style.** Dense, name-first, no throat-clearing; roughly 100-350 characters for a
figure with a story — `Saubhari`, `Madhavi`, `Kali`, `Makardhwaja` are the target. For figures
too large for one note (Krishna, Rama, Arjuna, Bhishma, Vyasa, Ravana), use the index form: a
short identification, then `By name — ` and a list of episode names. End with the citation.
Flag namesakes inline. Never state as fact what the source hedges.

---

## The handoff prompt

Everything below the line can be given to another AI working in this repository.

---

You are continuing long-running work on **RaktaVruksha**, a 3D/2D kinship-graph app. Your
dataset is `app/public/family-data.hiranyagarbha.json` — a Puranic family tree of 1,188
people across 102 generation rows, compiled from primary sources.

**Read first, in this order:**
1. `docs/LINEAGES_CURRENT.md` — the live working doc: the last passes, the standing
   directives, and the decisions already made. **Start here.**
2. `docs/PURANIC_LINEAGES.md` — the archive: the original 1,099-person compilation (Parts
   I-IX) and the build mechanics that still govern everything. Its row numbers are two rows
   shallow; its Part VIII is stale on Yajna (though not Rishabha and Prithu — see XI.2, trimmed).
3. `app/scripts/add-daksha-daughters.ts` — the most recent pass, and the pattern to copy.
   `app/scripts/add-primordial-lines.ts` is worth reading too, including its own note on why
   part of it was removed after being added.

**Your mission, both parts ongoing:**

**(1) Add more people, every one grounded in a named scripture.** Work the gap table in
`LINEAGES_CURRENT.md`. Cite chapter and verse. A person who cannot be traced to a text does
not go in; one from a late or contradicted source may, but must say so on their record.

**(2) Give every person a real note.** Only-a-citation or only-"Son of X" is unfinished. The
sole exemption is a figure genuinely nothing but a name in a succession list — and you must
**verify that, not assume it.** `Anaranya`, `Pratipa` and `Subala` all had real stories behind
thin notes.

**Hard rules. Violating these breaks the tree:**

- **Nobody shares Brahma and Saraswati's row.** Row 0 is theirs. If a graft would put someone
  there, give them a real parent instead — Kardama was made Pulaha's son (`VP 1.10`) for
  exactly this. Expect the tree below to shift; that is correct and the pipeline absorbs it.
- **Shiva and Vishnu are decided against**, with reasons recorded. Do not add them, or their
  consorts and children, without explicit instruction.
- **Anchors say WHO, not which row.** Always `anchor: { beside: "Sagara" }` in the scripts,
  never a bare number. Relative anchors resolve at load time and never go stale.
- **An anchor is for a lineage that floats; a `childGap` is for one that is attached.**
- **Keep row = generation.** It is the tree's most valuable property.
- **A rebirth is two records** (Amba/Shikhandi), never one record with an `altName`.
- **A known non-person parent becomes a person** (the makara, Adrika, Bhumi) rather than a
  1-partner union, which means "unknown".
- **A person is a child of at most one union.** If someone already hangs off a 1-partner
  union, add the second parent to *that* union; never create a second.
- **Ids are unique, names are not.** Suffix by realm or role on collision and keep the plain
  name in `firstName`. Let the scripts' collision guard run — it has caught real conflations
  (the sage Kratu vs Krishna's son; two Ulmukas; two Jayantis).
- **`divineParents` never binds generations.** It is the right tool whenever a parentage would
  otherwise drag someone into the wrong era.

**Before drawing any link that crosses eras, measure it.** Compute generations before and
after and report exactly who moves. Three separate times this session a plausible-looking link
would have shifted the whole tree; each was caught by measuring first.

**Workflow:**
```bash
cd app
npm run add-primordial-lines   # or a new sibling script for a new branch
npm run reanchor-eras
npm test && npx tsc --noEmit && npm run build
```

**Definition of done:** `validateData` zero errors; contemporaries N/N; nothing stranded; all
three gates clean; `LINEAGES_CURRENT.md` updated in the same commit with sources and
namesakes. Report honestly what was added, what was left out and why, and anything you could
not source. Do not overstate coverage.

Work in reviewable batches — one cluster, verified and documented — not one enormous change.
Ask before anything that would restructure era calibration, add a second root, or change the
schema.
