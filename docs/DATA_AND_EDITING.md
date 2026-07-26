# Data, editing & publishing

How the family data is shaped, how editing works, and how the site gets deployed.
For the code architecture, see [DEVELOPER_GUIDE.md](DEVELOPER_GUIDE.md).

## The data file

`app/public/family-data.json`, schema v2, is the **single source of truth**. The
app keeps nothing in the browser — the file is fetched fresh on every load, so
what's deployed is always what visitors see.

The **union** (a partnership) is the sole carrier of relationships; people have no
parent/child/spouse arrays:

```jsonc
{
  "meta": { "schemaVersion": 2, "exportedAt": "…" },
  "families": { "familyPandya": { "name": "Pandya", "color": "#e74c3c" } },
  "people": [
    { "id": "Dhawal", "firstName": "Dhawal", "lastName": "Pandya", "gender": "male",
      "alive": true, "birthFamilyId": "familyPandya", "updatedAt": "…" }
  ],
  "unions": [
    { "id": "u_x", "partners": ["Ajaykumar", "Harsha"], "children": ["Dhawal"],
      "adoptedChildren": [], "familyId": "familyPandya", "status": "married",
      "updatedAt": "…" }
  ]
}
```

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

**The real family** (`family-data.json`, no `?data=` param) is a genealogy you read
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

Adding a lineage means one entry in `DATA_FILES`, `SHOWCASE_ORDER`, and
`SHOWCASE_LABELS` in `state/store.ts`. The view-mode lock and the picker both
follow from those, and `?data=` accepts any key `DATA_FILES` knows.

The Hiranyagarbha file is not hand-edited. Its Puranic king-lists come from
[PURANIC_LINEAGES.md](PURANIC_LINEAGES.md), which holds every chain with the text
it came from, and two scripts that must run in order:

```bash
cd app
npm run add-lineages    # splices the king-lists in; refuses to write on an id
                        # collision or a validation error
npm run reanchor-eras   # puts every era back on its own level, and checks
                        # forty-five pairs the texts put in the same room
```

Both are idempotent. Edit the doc and the scripts together, then re-run both.

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

- **Local dev** (`npm run dev`): every edit write-throughs to
  `app/public/family-data.json` via a dev-only Vite endpoint — debounced
  autosave plus a **Save** button for an immediate flush. Edit, then commit the
  changed JSON like any other file.
- **Deployed site**: there is no write endpoint; use **Export** to download a
  copy (e.g. to edit at home or send to a relative).
- **Import** additively merges someone else's exported file: new ids are added,
  known ids update only if newer, nothing is ever deleted, and a merge report
  shows exactly what changed.

### Deploy (GitHub Pages)

```bash
cd app && npm run deploy   # builds and force-pushes app/dist/ to gh-pages
```

`scripts/deploy-gh-pages.sh` publishes only the built artifact, never source
history. The site serves under the repo subpath (Vite `base: './'`). Share the
plain URL; keep `?edit=…` to yourself.

## Maintenance scripts (from `app/`)

```bash
npm run clean      # collapse "unknown lineage" placeholders; reconcile union families
npm run rename-ids # rewrite generated ids to readable ones
```
