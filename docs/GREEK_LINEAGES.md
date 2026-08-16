# The Greek descent: the research archive

Every figure in `app/public/data/chaos/`, with the text each one comes from, the
Roman name where there is one, and the English words that came down from the
Greek. This file exists so the work never has to be redone.

**State:** 388 people, 225 unions (40 of them cross-era), 21 families, rows 0..34.
Chaos at row 0, Troy at row 17, Romulus at row 34.

The tree is hand-edited, one file per family. See "The data files" in
[DATA_AND_EDITING.md](DATA_AND_EDITING.md) for the format, and run `npm run check`
after any change.

## Citation convention

| Sigil | Text |
|---|---|
| `Theog. 116` | Hesiod, *Theogony*, line |
| `WD 109` | Hesiod, *Works and Days*, line |
| `Il. 6.152` | Homer, *Iliad*, book.line |
| `Od. 11.235` | Homer, *Odyssey*, book.line |
| `Apollod. 1.2.1` | Pseudo-Apollodorus, *Bibliotheca*, book.chapter.section |
| `Epit. 3.21` | the *Epitome* of the same |
| `Hyg. Fab. 127` | Hyginus, *Fabulae* |
| `Ov. Met. 1.5` | Ovid, *Metamorphoses* |
| `Paus. 2.15.5` | Pausanias, *Description of Greece* |
| `Aen. 1.1` | Virgil, *Aeneid* |
| `Livy 1.3` | Livy, *Ab Urbe Condita* |
| `Hom. Hymn Dem.` | the *Homeric Hymns* |

Hesiod's *Theogony* is the spine, as canto 9 of the Bhāgavata is for the Puranic
tree: the one text that runs the descent end to end in a single voice. Where
Apollodorus or Homer disagrees, the disagreement is noted rather than resolved
silently — and in Greek myth they disagree far more often than the Puranas do.

## Confidence

Same three grades as [PURANIC_LINEAGES.md](PURANIC_LINEAGES.md): **read**,
**cited**, **thin**. A thin claim stays prose and never becomes an edge.

Greek material needs this more than the Puranic material does, because the
variants genuinely contradict rather than merely differing. Aphrodite is born
from the sea-foam in Hesiod and is Zeus and Dione's daughter in Homer; both are
ancient and neither is a corruption of the other. The tree draws Hesiod and
records Homer on the record itself.

---

# Part I. The shape of the tree

```
Chaos (0)
 └ Gaia ── Ouranos (1)
    └ the twelve Titans (2)
       └ Zeus and the Olympians (5)
          └ … the heroic houses …
             └ Troy (17)
                └ … the Alban kings …
                   └ Romulus (34)
```

Twenty families. Seven of them are heroic houses that each run from a god down to
a named mortal end:

| House | Runs | Ends at |
|---|---|---|
| Argos | Inachos → Io → Danaos → Akrisios → Perseus | Herakles, the Herakleidai |
| Thebes | Agenor → Kadmos → Labdakos → Laios | Oidipous, Antigone |
| Atreus | Tantalos → Pelops → Atreus | Agamemnon, Orestes, Tisamenos |
| Deukalion | Prometheus → Deukalion → Hellen | the Greek peoples; Bellerophon; Jason |
| Aiakos | Zeus + Aigina → Aiakos → Peleus | Achilles, Neoptolemos |
| Ithaka | Arkeisios → Laertes → Odysseus | Telemachos; Latinus and Italus |
| Troy → Alba Longa | Dardanos → Tros → Anchises → Aeneas | **Romulus and Remus** |

Plus Athens, Crete, Sparta, Pylos, the Okeanids and rivers, the old sea of
Pontos, the children of Nyx, Typhon's brood, and the Muses.

## Era calibration: Troy is the fixed point

The Greek genealogies disagree about depth as violently as the solar and lunar
Puranic lists do. The Argive line reaches the Trojan War in seventeen
generations; the Aiakid line reaches it in eight. Both are "correct" in their own
sources.

So the same two levers do the same work here. **The deepest documented line sets
the depth** — Inachos → Io → … → Perseus → Alkmene → Herakles → Tlepolemos, who
sailed to Troy with nine ships from Rhodes and was killed there by Sarpedon. Every
other line is pulled down to meet him with a **relative anchor** on `Tlepolemos`,
and the one genuinely bare stretch — the Alban king-list, eleven kings with no
story attached to any of them — is left to run at its natural length.

`npm run check` asserts thirty-five pairs the texts put in the same scene.

### Anchor the founder, not the grandson

The first calibration of this tree got it backwards and the result was visible at
a glance: **Tantalos, Arkeisios, Kekrops, Tyndareos and Leda sitting on row 0
beside Chaos**, with their lines stretched fourteen to sixteen rows down to a
pinned descendant. Tantalos is Zeus' son and has no parents in the tree, so
nothing held him up; anchoring Agamemnon four generations below him pulled only
Agamemnon.

The rule the Puranic archive already states, and the reason it states it: *an
anchor is for a lineage that floats, a gap is for one that is attached.* A
floating house is anchored **at its founder**, and the rest of it then falls into
place by ordinary descent:

| Founder | Anchor | Because |
|---|---|---|
| Tantalos | `Tlepolemos −3` | → Pelops → Atreus → Agamemnon |
| Arkeisios | `Tlepolemos −2` | → Laertes → Odysseus |
| Tyndareos | `Tlepolemos −1` | → Helen, Klytaimnestra, the twins |
| Kekrops | `Tlepolemos −7` | → six Athenian kings → Theseus |
| Lakedaimon | `Tlepolemos −5` | → Amyklas → Kynortes → Oibalos → Tyndareos → Helen |
| Teiresias | `Tlepolemos −2` | hangs off nothing, so he was bottom-aligned to the last row in the tree, a thousand years past his own city |

### Where the shortfall goes

The Argive line reaches Troy in seventeen generations, the Aiakid in eight. On an
**attached** line the difference cannot be anchored away without tearing a named
father from his named son, so it is carried as `childGap`, and only on stretches
where the sources make no depth claim at all:

| Edge | Gap | Because |
|---|---:|---|
| Asopos → Aigina | 11 | a river's daughter has no generation of her own |
| Helios → Kirke, Aietes, Pasiphae | 12 | a god's children, dated only by the mortals they marry |
| Nereus → the Nereids | 12 | the same, for the sea |
| Prometheus → Deukalion | 9 | the flood is undated |
| Epimetheus → Pyrrha | 8 | the first woman to the flood; nobody counts the steps |
| Elektra → Dardanos | 4 | at the head of a bare Trojan king-list |

What is left after that is 59 stretched edges, the worst of them six rows, and
every one explicable: a god dated by the era of his own story (Dionysos by
Thebes, Minos by Theseus), or a Titaness levelled onto Zeus' row by marrying him.

---

# Part II. Crossing the eras

A union LEVELS its partners onto one row. That is what makes a couple read as a
pair, and for most of a genealogy it is exactly right — but Greek myth is full of
bonds between people who are emphatically not contemporaries, and levelling those
asks the sky-father to sit below himself. The first build of this tree, which
tried, came out **4,032 rows deep**.

So a union may be marked **`"cross": true`**: drawn like any other bond, and then
ignored by the leveller. The thread simply stretches down the tree, which is the
truthful picture — *Zeus mates across generations, and now the tree says so.*

**Forty bonds cross the eras.** Twelve of them are Zeus':

| | reaches down |
|---|---:|
| Zeus → Leda | 11 rows |
| Zeus → Alkmene | 10 |
| Zeus → Aigina | 9 |
| Zeus → Danae, Antiope, **Ganymedes** | 7 |
| Zeus → Kallisto | 6 |
| Zeus → Semele, Europa, Io, Elektra, Taygete | 4 or fewer |

The longest reach in the tree is **Mars to Rhea Silvia, twenty-seven rows** — a
god at the top of the Olympian generation fathering the founder of Rome at the
very bottom. Then Eos to Kephalos at fourteen, and Poseidon to Tyro at eleven.

A cross-era bond **carries no children**, and `validateData` enforces it: a
child's generation has to come from a parent the leveller can see. Where such a
pairing has issue, the child hangs from the partner of its own era and takes a
`divineParents` ray to the other — Perseus from Danae, with Zeus' ray across.

This is also what lets the tree draw three things it previously refused:
**Oidipous and Iokaste**, mother and wife; **Aeneas and Lavinia**, who is the
daughter of Odysseus' son and so two generations below the man who marries her;
and Hyginus' **Telemachos and Kirke**, a wife shared by a father and his son.

## The one bond still undrawable

**Gaia and Ouranos.** Hesiod has her bear him from herself, "equal to herself, to
cover her all about", and then take him as consort — son and husband both. A
cross-era bond can refuse to level two people, but it cannot make a man his own
father, and the birth would be a child edge running backwards into the marriage
every Titan descends from. The marriage is drawn; the birth is in the note on her
solo union. Theog. 126-132

# Part II·a. Marriage, love, and seizure

Two rules about how a pairing is drawn, both added because this tree needed them.

**Only a marriage welds.** A couple that is married snaps into one rigid body,
two orbs at a fixed offset with a collide radius round the pair, so nothing can
ever come between them — that is what makes a couple read as a couple. A love
affair, an abduction or a divorce gets the thread and not the weld: they are not
a pair, and welding would say for good that they were. (`unknown` still welds,
because in the real family that means a couple whose ceremony simply was not
recorded.)

**`status: "abduction"`**, drawn in red, for what a great deal of this tree
actually is. Europa carried off on the bull. Ganymedes taken off the mountain by
the eagle, his father paid afterwards in horses. Persephone pulled down through a
split in the field with her father's consent and not her own. Alkmene, who
thought her husband had come home early. Twenty unions carry it, ten of them
Zeus'.

It covers seizure and deception alike — what unites them is that consent is
absent, not the method — and it exists because calling all of these `partners`
flattened something the sources are explicit about. Beside them, the affairs that
are affairs keep `partners`: Semele, Aphrodite and Anchises, Herakles and Hylas,
Achilles and Patroklos.

---

# Part II·b. The lovers

Fifty-eight figures were added in a second pass — wives, mistresses, beloved
youths, and the children born of them — and with cross-era bonds available,
**every relationship among them is drawn**. None of it sits in prose.

**Contemporaries**, drawn as ordinary unions and welded as couples: Herakles with
Megara, Omphale, Iole and **Hylas**; Achilles with Briseis, Deidameia and
**Patroklos**; Theseus with Hippolyte and Phaidra; Aeneas with Kreousa and
**Dido**; Orpheus with Eurydike; Amphion with Niobe; Narkissos with Echo — which
is not a union in any ordinary sense, one could not speak and the other would not
listen, but is the pairing the story is.

**Across the eras**, drawn as long threads: Zeus with Ganymedes, Io, Danae,
Alkmene, Leda, Europa, Semele, Kallisto, Antiope, Aigina, Elektra and Taygete;
Apollo with **Hyakinthos**, **Kyparissos**, Koronis and Kyrene, and Zephyros with
Hyakinthos too, whose jealousy turned the discus; Hermes with **Krokos**, Chione
and Dryope; Poseidon with **Pelops**, Amphitrite, Tyro and Aithra; Dionysos with
**Ampelos**; Pan with **Daphnis**; Selene with Endymion; Aphrodite *and*
Persephone each with Adonis, which is the quarrel Zeus settled by dividing his
year; Eos with Tithonos, Kephalos and Orion; and Herakles with Hebe, after the
pyre.

**Laios and Chrysippos.** Pelops' son, carried off while Laios was a guest in his
father's house — the act the tradition names as the first pederasty, and the
reason Pelops cursed the house of Laios. Everything Oidipous suffers begins there,
and the bond that causes it is now an edge like any other.

**The beloved who became things.** Almost every one of them ends as a plant, a
star or a word: Hyakinthos the hyacinth, Kyparissos the cypress, Krokos the
crocus and saffron from it, Ampelos the first grapevine (*ampelography*),
Narkissos the narcissus and *narcissism*, Adonis the anemone, Ganymedes the Latin
word for what he was, Echo the echo, Orion the constellation, Tithonos the cicada
that sings all summer and cannot die.

**Love-born children added:** Asklepios (and Hygieia → *hygiene*, Panakeia →
*panacea*, and Machaon and Podaleirios, the surgeons of the Greek camp),
Hermaphroditos (→ *hermaphrodite*), Pan (→ *panic*), Autolykos and through him
Antikleia, who gives Odysseus his mother; Triton, Phaethon, Memnon, Amphion and
Zethos, Arkas (→ Arcadia), Lakedaimon (→ Sparta), Telephos, Aristaios, Adonis,
Orpheus and Linos.

**One figure stands alone**, and honestly: Teiresias belongs to his city rather
than to any house. Everyone else who was stranded got the parents the sources
give them, which is how Sparta finally acquired its king-list — Lakedaimon →
Amyklas → Kynortes → Oibalos → Tyndareos, with Hyakinthos as Amyklas' son, so
the boy Apollo loved and the kings of Sparta turn out to be one house.

A rendering note, since it is visible: the 3D labels place men's names above the
orb and women's below, so a couple never writes over itself. Two men welded side
by side both print above and crowd a little — Herakles with Hylas, and Achilles
with Patroklos.

---

# Part III. The Roman names

The Romans did not translate the Greek gods; they identified their own with them,
which is why the fit is imperfect and the interesting cases are where it fails.

| Greek | Roman | Note |
|---|---|---|
| Zeus | **Jupiter** | *Iu-piter*, sky father — the same word as Sanskrit **Dyaus Pita** |
| Hera | **Juno** | June; Juno Moneta's temple held the mint |
| Poseidon | **Neptune** | far smaller at Rome; a minor water god until Greek contact |
| Haides | **Pluto**, Dis Pater | |
| Demeter | **Ceres** | cereal |
| Hestia | **Vesta** | the Vestals kept Rome's public fire |
| Athena | **Minerva** | |
| Apollon | **Apollo** | the one major god taken without renaming |
| Artemis | **Diana** | |
| Ares | **Mars** | **far greater at Rome**: father of Romulus, guardian of fields |
| Aphrodite | **Venus** | ancestress of the Julians through Aeneas |
| Hephaistos | **Vulcan** | |
| Hermes | **Mercury** | from *merx*, merchandise — a trader's god, not a herald's |
| Dionysos | **Bacchus**, Liber | |
| Persephone | **Proserpina** | |
| Kronos | **Saturn** | Saturnalia; **Saturday** |
| Rheia | **Ops** | |
| Helios / Selene / Eos | **Sol / Luna / Aurora** | |
| Nyx | **Nox** | literally Night |
| Hemera | **Dies** | |
| Gaia | **Terra**, Tellus | |
| Ouranos | **Caelus** | |
| Eros | **Cupid**, Amor | |
| Moirai | **Parcae** | Nona, Decuma, Morta |
| Erinyes | **Furiae**, Dirae | |
| Charites | **Gratiae** | grace |
| Mousai | **Camenae** | |
| Hekate | **Trivia** | three roads → trivial |
| Nike | **Victoria** | |
| Tyche | **Fortuna** | |
| Herakles | **Hercules** | |
| Odysseus | **Ulysses** | via Etruscan *Uluxe*, which is why it looks so different |

---

# Part IV. What English took

The reason this tree is worth reading in English. Grouped by how the word came
over.

**Seven chemical elements.** Uranium (Ouranos, via the planet), **helium**
(Helios — found in the sun's spectrum before it was found on earth), selenium
(Selene), tellurium's sister named for the moon, promethium (Prometheus, named in
1945 for the theft of fire), tantalum (Tantalos, because it sits in acid and
absorbs nothing), plutonium and neptunium (via the planets), and mercury
(Mercury, for its speed).

**Anatomy and medicine.** Achilles tendon (named by Verheyen, 1693), atlas
vertebra (it holds up the head), hypnosis, insomnia (Somnus), euthanasia and
thanatology, morphine (Morpheus, the shaper of dreams, named 1805), atropine
(Atropos, who cuts the thread), psychology (Psyche), hygiene (Hygieia), panacea,
analgesic and neuralgia (Algea), sphincter (from the same *sphingein*, to
squeeze, that names the Sphinx), venereal (Venus), aphrodisiac.

**Places.** Europe, Asia, the Aegean (Aigeus threw himself into it), the
Hellespont (Helle fell into it), the Ionian Sea and the Bosporos — the ox-ford —
both from Io's wandering, the Atlantic and the Atlas mountains, the Peloponnese
(Pelops' island), Latium and Italy, the Tiber (Tiberinus drowned in it), the
Aventine.

**Words worn down past recognition.** *Gas* (van Helmont coined it from khaos
around 1650). *Money* and *mint* (Juno Moneta). *Music*, *museum*, *mosaic* and
*amuse* (the Muses). *Grace*, *gratitude*, *gratis* (the Gratiae). *Trivial* (the
crossroads of Trivia). *Panic* (Pan). *Volcano* and *vulcanise* (Vulcan's forge
under Aitna; Goodyear's process, 1844). *Cereal* (Ceres). *Fortune* (Fortuna).
*Catamite* (Ganymedes, through Etruscan *Catmite*). *Hermetic* (the sealed
vessels of Hermes Trismegistos). *Disaster* — an ill star, from Asteria's root.
*Nostalgia* — the ache for return, built from Algea.

**Days and months.** Saturday (Saturn), March (Mars), May (Maia), June (Juno),
January (Janus), Friday (*dies Veneris* — still *vendredi*, still *Freitag*).

**Names that became nouns.** Odyssey, nemesis, chaos, echo, chimera, hydra,
python, cerberus, harpy, gorgon, titan and titanic, giant, siren, muse, iris and
iridescent, aurora, zephyr, boreal, atlas, phobia, mentor, protean, Sisyphean,
tantalise, narcissism, and the Oedipus and Electra complexes — Freud 1899, Jung
1913, which between them have made Oidipous the best-known Greek in English and
the least accurately remembered.

## One anti-etymology, recorded so nobody re-researches it

**Kronos is not chronos.** The Titan and the Greek word for time are unrelated.
The identification is a late pun that hardened into folklore, and it is the whole
reason Saturn carries a scythe and became Father Time. It is on Kronos' own
record as a false friend, on the same principle by which the Puranic archive
records thin claims rather than letting them be rediscovered.

Two more worth knowing: **Pandora's box was a jar** — *pithos*, a storage jar;
Erasmus mistranslated it in the 1500s. And **Achilles' heel is not in Homer**,
who has him simply mortal all through; the dipping in the Styx is late.

---

# Part V. Namesakes

Ids are unique, names are not. `npm run check` reports five shared names across
eleven people in this tree. The ones to know:

| Name | Who |
|---|---|
| **Elektra** | the Okeanid (`Elektra`), Agamemnon's daughter (`ElektraM`), and the Pleiad who bore Dardanos (`Elektra3`) |
| **Eros** | the primordial (`Eros`) and Aphrodite's son (`Eros2`) — Hesiod's cosmic force and the boy with the bow are different gods |
| **Erichthonios** | of Troy (`Erichthonios`) and the earth-born king of Athens (`Erichthonios2`) |
| **Deukalion** | of the flood (`Deukalion`) and Minos' son (`Deukalion2`) |
| **Kapys** | of Troy (`Kapys`) and the Alban king four generations below (`Capys`) |
| **Sarpedon** | Europa's son is in the tree; his Lykian namesake at Troy is not |
| **Latinus, Romulus, Aeneas** | each appears again as an Alban king's second name (`AeneasSilvius`, `LatinusSilvius`, `Romulus Silvius`) |

---

# Part VI. Not added, and why

- **The other 2,950 Okeanids.** Hesiod names all fifty Nereids and says of the
  Okeanids that it is not possible to tell all their names. The tree keeps the
  eleven the rest of the descent needs.
- **The forty-nine other Danaids and forty-nine other sons of Aigyptos.** One
  union each stands for all fifty, on the record of Hypermnestra and Lynkeus.
- **Priam's other thirty-one sons.** Homer gives him fifty; nineteen by Hekabe.
  Seven are in.
- **The Argonauts and the Kalydonian boar hunt** as catalogues. The named heroes
  who matter elsewhere are in; the crew lists are not.
- **Orphic theogony.** A wholly different cosmogony beginning with Chronos and
  Ananke and the world-egg, not compatible with Hesiod's and not merged into it.
  Recorded here as a decision, not an oversight.
- **The Homeric Hymn to Demeter's Eleusinian figures** (Keleos, Triptolemos).
  Worth adding; the descent is documented.

## Where to add next

Attic kings between Erichthonios and Aigeus; Lykaon and the Arcadian line; the
Kalydonian house (Oineus, Meleagros, Tydeus, Diomedes) — Diomedes is a major
Iliad figure and his absence is the largest single gap in the tree; the Lapiths;
and the rest of the Nereids.
