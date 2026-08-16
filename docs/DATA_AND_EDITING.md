# Data, editing & publishing

How the family data is shaped, how editing works, and how the site gets deployed.
For the code architecture, see [DEVELOPER_GUIDE.md](DEVELOPER_GUIDE.md).

## The data files

Each dataset is a **directory of one small file per family**, under
`app/public/data/<dataset>/`. Those files are the **single source of truth**, meant
to be opened and typed into. The app keeps nothing in the browser — they are
fetched fresh on every load, so what's deployed is always what visitors see.

```
app/public/data/hiranyagarbha/
  _manifest.json     meta + the list of shards
  ikshvaku.json      the solar line: people AND their unions, together
  yadava.json
  …
  _floating.json     anyone drawn with no family at all
```

The four datasets are 154 files, median 18 lines, largest 233. As one document
each they were 34,442 lines, of which about nine tenths was ceremony: every
person in the Hiranyagarbha tree carried `"lastName": ""` and `"alive": true`,
four in five were male and named exactly like their id, and 225 of its 612 unions
said nothing but "A begat B" in nineteen lines apiece.

So a shard hoists the constants into a `defaults` header, and collapses
father-son successions into arrays:

```jsonc
{
  "family": "familyNishadha", "name": "Nishadha", "color": "#8c7fbf",
  "defaults": { "stamp": "…", "gender": "male", "alive": true,
                "lastName": "", "status": "married" },
  "people": {
    "Virasena": "King of Nishadha, father of Nala. MBh 3.50",
    "Damayanti": { "gender": "female", "note": "Princess of Vidarbha…" },
    "Karna": { "fam": null, "note": "…" }
  },
  "unions": [
    ["Ikshvaku", "Vikukshi", "Puranjaya", "Anena"],
    { "id": "u_nala_damayanti", "p": ["NalaNishadha", "Damayanti"],
      "c": ["Nalayani", "IndrasenaN"] }
  ]
}
```

Reading it:

| Written | Means |
|---|---|
| `"Virasena": "…"` | a person; the bare string **is** the note, everything else from `defaults` |
| `"Damayanti": { … }` | a person, spelling out only what differs from `defaults` |
| `"fam"` | birth lineage, when it isn't the file's own family (`null` = no lineage) |
| an **array** in `unions` | a father-son chain; each adjacent pair is the union `u_<parent>_<child>` |
| an **object** in `unions` | a union carrying something a chain can't say — two partners, several children, a `childGap`, a note |

Chains and unions share one array so their file order is their real order.

The **union** (a partnership) is still the sole carrier of relationships; people
have no parent/child/spouse arrays. `p` is partners, `c` children, `a` adopted,
`gap` is `childGap`, `u` an `updatedAt` that differs from the header's `stamp`.

**A record lives in the file of the family it is drawn with**, which is not always
the one it was born into: Karna's `birthFamilyId` is null, but he is rendered
among the Sutas who raised him, so he is in `suta.json` — where someone looking at
him on screen would think to go. His own record still says `"fam": null`.

Nothing about the schema changed. `core/shards.ts` expands the directory back into
exactly the `FamilyDataV2` the app has always used, and `npm test` holds it to
being a **fixed point**: reading the files and writing them back must produce
byte-identical output, so an autosave can never reformat a file you organised by
hand.

Scanning is what the one-line-per-person rule is really for:

```
$ rg Haryashva app/public/data/hiranyagarbha/
ikshvaku.json:  "HaryashvaI":  "SB 9.6.24"
ikshvaku.json:  "HaryashvaII": "SB 9.7.4"
videha.json:    "HaryashvaV":  "SB 9.13.15"
ikshvaku.json:  ["Shravasta","Brihadashva","Kuvalayashva","Dridhashva","HaryashvaI", …]
```

The grep output *is* the record — name, citation, family, and place in the
succession. This tree is full of namesakes, so "is this name already taken, and
by whom" is the question on every addition; `npm run check` counts them.

The model distinguishes, without collapsing them into each other:

| Case | Encoding |
|---|---|
| Born out of wedlock | 2-partner union, `status: "partners"` |
| Partner unknown | 1-partner union (a data gap, not a status) |
| Adopted | child sits in `adoptedChildren` of the adoptive union; a biological union may coexist |
| Divorce + remarriage | multiple unions per person, each with its own `familyId`, `status`, `order` |
| Orphans / unknown lineage | no parent union; `birthFamilyId: null` |
| Same-named lineages | family **ids** are always unique; the UI disambiguates by branch note or eldest ancestor |

## URL parameters

| Param | Effect |
|---|---|
| `?family=<familyId>` | Opens on that family's 2D tree (what the **Share** button copies). The app also mirrors the on-screen family into this param as you navigate. |
| `?data=hiranyagarbha` \| `ramayan` \| `mahabharat` | Loads a showcase lineage (below). |
| `?edit=<key>` | Unlocks editing (below). Never included in shared links. |

## Two halves: the family, and the showcase

The app is deliberately split in two, and the split decides both the default view
and how a page is shared.

**The real family** (`data/family/`, no `?data=` param) is a genealogy you read
one family at a time. It opens in **2D**, the 2D/3D toggle is available, and every
family carries its own `?family=<id>` link, so any branch is directly shareable.

**The showcase** is the mythological lineages, listed in `SHOWCASE_ORDER`: `ramayan`
(रघुवंश Raghuvansh), `mahabharat` (कुरुवंश Kuruvansh), and `hiranyagarbha`
(हिरण्यगर्भ Hiranyagarbha, the golden womb every later line issues from). These only
make sense as whole constellations, so they are **3D-only**: there is no 2D/3D
toggle, the lineage label in the wordmark is instead a picker that switches between
them, and the shareable unit is the lineage itself (`?data=<lineage>`), not a family
inside it. Switching does a full page reload, so the next lineage starts clean and
carries over only `?edit=`.

The picker is a native `<select>` on purpose: on a phone that gets the platform's
own full-height wheel rather than a cramped custom menu.

Adding a lineage means a new directory under `public/data/`, one entry in
`DATA_DIRS`, `SHOWCASE_ORDER` and `SHOWCASE_LABELS` in `state/store.ts`, and its
name in the writable set in `vite.config.ts`. The view-mode lock and the picker
both follow from those, and `?data=` accepts any key `DATA_DIRS` knows.

The Hiranyagarbha lineage **is** hand-edited, like everything else: open the
family's file and type. It used to be generated by a stack of splice-and-graft
scripts, which existed only because a 21,000-line document could not be edited
any other way; the shard format removed the reason for them and they are gone.
[PURANIC_LINEAGES.md](PURANIC_LINEAGES.md) is now purely what it says it is — the
prose archive, holding every chain with the text it came from — rather than a
document that had to be kept in lockstep with code.

Adding a king is: put his name in the chain array where he belongs, and add one
line under `people` with his citation. Then:

```bash
cd app && npm run check
```

## Presentable vs. editable (the hidden edit key)

By default the app is **read-only**: visitors can navigate, search, trace
relations, and share — but see no Add / Import / Export / Save / Edit / Delete.
That's the link you give the family.

Editing unlocks with a secret key in the URL: `?edit=durga` (change `EDIT_KEY` in
`app/src/state/store.ts`). It's checked per load and never persisted; the
**Lock** button re-hides everything. Share links strip the key automatically.

Once unlocked, everything happens on the graph:

- From a focused person: **+ Spouse** (tick their existing single-parent children
  to co-parent them — no duplicate marriages — and choose which family the
  children take, even a brand-new one created inline), **+ Child**, **+ Parent**,
  **Edit**, **Delete** (cleans up every link; childless leftover unions are
  dropped), and ↑↓ to reorder siblings by birth.
- **Merge duplicates** with the merge dialog — always merge the two records;
  never delete one and reconnect by hand.
- Ids stay readable: `Firstname` / `Firstname_1`, `u_<partners>`, `family<Name>`.

## Saving and publishing

- **Local dev** (`npm run dev`): every edit write-throughs to the dataset's
  shard directory via a dev-only Vite endpoint — debounced autosave plus a
  **Save** button for an immediate flush. Only the files whose text actually
  changed are written, normally one, so an edit shows up as a one-file diff.
  Edit, then commit the changed JSON like any other file.
- **Deployed site**: there is no write endpoint; use **Export** to download a
  copy (e.g. to edit at home or send to a relative).
- **Import** additively merges someone else's exported file: new ids are added,
  known ids update only if newer, nothing is ever deleted, and a merge report
  shows exactly what changed.

## Tuning the 3D layout

`app/public/layout.json` holds every dial that shapes the 3D tree's spread —
repulsion and how far up and down the generations it carries, how hard children
are pulled under their own parents, family clustering, link lengths, collision
radii, tick counts — plus `backdropOpacity`, the strength of the warm vignette
behind the tree (`0` turns it off). It loads at boot exactly like a dataset, so
the deployed site reads whatever that file says and **changing the layout needs
no rebuild**.

Locally with editing unlocked, a **⚙ Layout** button opens the Layout Lab: a
slider per dial that re-runs the layout live under the camera where it stands and
then writes `layout.json` back through the same dev-only endpoint the datasets
use. Tune it, then commit the JSON.

Only known keys holding finite numbers are read, so a hand-edited typo falls back
to that one dial's default rather than feeding a NaN into the simulation. The
defaults are mirrored in `app/src/core/layoutTuning.ts`; keep the two in step.

### Deploy (GitHub Pages)

```bash
cd app && npm run deploy   # builds and force-pushes app/dist/ to gh-pages
```

`scripts/deploy-gh-pages.sh` publishes only the built artifact, never source
history. The site serves under the repo subpath (Vite `base: './'`). Share the
plain URL; keep `?edit=…` to yourself.

## Maintenance scripts (from `app/`)

```bash
npm run check   # structural integrity, validateData, the era checklist, namesakes
npm test        # the shard format is a fixed point; the app's own unit tests
```

`check` is the only script left, and it writes nothing. It reports an id defined
twice, a chain naming somebody with no record, a reference to an id no file
defines, every `validateData` error, and the fifty-five pairs the texts put in
the same room (Brihadbala beside Abhimanyu, Kapila beside Sagara) which must
still land within a row of each other. Because it owns no data it cannot drift
from the files the way the old doc-and-script pair did.
