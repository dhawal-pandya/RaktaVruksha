# Raktavruksha — रक्तवृक्ष

An interactive **3D family-graph explorer**. One living web of families rendered as a
constellation map: people are glowing nodes colored by birth family, marriages are golden
bridges, generations stack vertically. Click anyone to fly to them; trace the shortest
kinship path between any two people; grow the tree directly on the graph.

Frontend-only — no backend, no auth, no database. Data is a single JSON file; all
computation happens in the browser.

## Run

```bash
cd app
npm install
npm run dev        # → http://localhost:5173
```

Other scripts (from `app/`):

```bash
npm test           # core-layer unit tests (vitest)
npm run build      # typecheck + production build
npm run clean      # collapse "unknown lineage" placeholders to null; reconcile union families
npm run rename-ids # rewrite nanoid ids to readable ones (First_1, u_a_b, familyX_1)
npm run stress     # generate a ~1,700-person synthetic dataset
                   #   → view at http://localhost:5173/?data=stress
```

## Using it

- **Click a person** → camera flies to them; their relatives stay lit, the rest dims; a
  detail card opens with clickable relatives and grow actions.
- **Double-click** → isolate that person's connected web. **Esc** steps back out of
  anything (isolate → focus → lens).
- **Family lens** (legend, search, or a chip in the detail card) → dims everyone not born
  or married into that family, without moving a single node. Clicking someone who
  *married into* the lens family follows them home — the lens switches to their birth
  family.
- **Relation finder** (`r` or the Relation button) → pick two people (click or search);
  the shortest kinship path lights up and gets named: *"Kevalji Pandya is Dhawal
  Pandya's 8× great-grandfather"*, half-siblings, in-laws, adoptive relations included.
- **⌂ Fit** re-frames the whole tree. **2D / 3D** toggles views (the choice is
  remembered; **2D is the default**). **3D** is the full multi-family constellation.
  **2D** shows **one family at a time** as a clean top-down genealogical tree — the full
  web doesn't lay out legibly on a single plane, so 2D scopes to a family: everyone born
  or married into it, plus each married-away spouse as a faded leaf. **Clicking any
  person navigates to their birth family**, so you hop across families through the people
  who married between them (click a wife → her birth family; click her husband there →
  back). Pick a family directly from the legend, search, or a detail-card chip.
- **Navigation** — the generational (vertical) axis is fixed and never tumbles.
  **Drag** pans the view; **Ctrl/Cmd-drag** (or right-drag) spins the graph around the
  vertical axis; **scroll** zooms. On phones: one finger pans, two fingers pinch-zoom and
  twirl; panels become bottom sheets.

## Data

`app/public/family-data.json`, schema v2. The **union** (a partnership) is the single
source of truth for relationships — people carry no parent/child/spouse arrays:

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

### Presentable vs. editable (the hidden edit key)

By default the app is **read-only** — visitors can navigate, search, lens, and trace
relations, but see no Add / Import / Export / Save / Edit / Delete affordances. This is
what you share.

Editing unlocks with a **secret key** in the URL: append `?edit=durga` (change the
key in `app/src/state/store.ts`, `EDIT_KEY`). The unlock persists locally, so you only
pass it once per browser; a **Lock** button re-hides everything. The key never appears in
the plain link you share, so the public site stays presentation-only.

Once unlocked:

- **On-graph editing** — from a focused person: **+ Spouse** (tick their existing
  single-parent children to make the new spouse the co-parent — no duplicate marriage;
  and choose whose family the children take, so a **son-in-law's family** — even a
  brand-new one created inline — flows to the kids), **+ Child**, **+ Parent**, **Edit**,
  and **Delete** (removes the person and cleans up every link; childless leftover unions
  are dropped). **Reorder children** by birth order with the ↑↓ arrows — the graph lays
  siblings oldest-to-youngest.
- **Ids stay readable** — new people are `Firstname` (then `Firstname_1` on collision),
  unions `u_<partners>`, families `family<Name>` / `family<Name>_1`.
- **Same-named lineages** — family ids are always unique, so two "Pandya" families
  coexist; the UI disambiguates them by an optional branch/place note, else by their
  eldest ancestor ("Pandya · Kevalji" vs "Pandya · Jayantilal").
- Every edit autosaves to an **IndexedDB draft** (survives reloads; "Reset" discards it).
- **On `npm run dev` (local), edits write straight through to
  `app/public/family-data.json`** — a debounced autosave after every change, plus
  **Save** for an immediate flush. No export/pick-a-file step: just edit, then commit the
  updated JSON. (A dev-only Vite endpoint does the write; the page doesn't reload.)
- On the **deployed** site there's no such endpoint, so **Save** falls back to the File
  System Access API (pick the file once) or a plain download.
- **Export** — downloads a copy to send to relatives.
- **Import** — additively merges a relative's file: new ids are added, known ids update
  only if newer, nothing is ever deleted; a merge report shows exactly what changed.

### Deploy (GitHub Pages)

```bash
cd app && npm run deploy      # builds and force-pushes app/dist/ to the gh-pages branch
```

`scripts/deploy-gh-pages.sh` publishes only the built artifact (never source history).
The site serves under the repo subpath (Vite `base: './'`). Share the plain URL; use
`…/?edit=durga` yourself to edit, then Export → commit the JSON → redeploy.

## Architecture

```
app/src/
  core/     pure TypeScript, fully unit-tested — no react/three/DOM imports
            (dataset indexing, generation solver, graph build, deterministic
             3D layout, kinship BFS + relation namer, merge, validation)
  state/    zustand store + IndexedDB/File System Access persistence
  render/   the 3D scene (react-force-graph-3d) — draws precomputed layout,
            camera choreography, batched opacity updates; no business logic
  ui/       HUD: top bar, search, legend, detail card, relation panel, forms
```

The layout is computed **headlessly and deterministically** in `core/layout.ts`
(d3-force-3d, Y locked to generation, families seeded as clusters, couples snapped
around their union node) — the renderer only draws and moves the camera, so the world
never reshuffles under you.

## Repo layout

- `app/` — the application (v2). The only code that runs.
- `MASTER_PROMPT.md` — the full v2 specification this rebuild was executed from.

The legacy v1 (`raktavruksha-frontend/`, React + D3 SVG) and the unused Go/Neo4j
backend were removed once v2 was verified; their data was migrated into
`app/public/family-data.json`.
