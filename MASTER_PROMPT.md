# Raktavruksha v2: Master Prompt

You are rebuilding **Raktavruksha** (रक्तवृक्ष, "blood tree") from scratch: an interactive **3D family-graph explorer** for large, interconnected family networks. This is a complete restart of the frontend. Read this whole document before writing any code: every architectural decision below is deliberate.

---

## 1. Vision

One living 3D web of families. The user flies through it like a galaxy: each person is a glowing node, families are color constellations, marriages are bridges between constellations. Clicking a person flies the camera to them and lights up their bloodline. A **family lens** dims the rest of the world to show one family: everyone born or married into it: without ever relayouting or reloading. A **relation finder** lights up the shortest kinship path between any two people and names the relationship. There is **no page reload, no view swap, no re-filtering of data**: one continuous world, one camera.

The app is **frontend-only**. There is no backend, no auth, no database. Data lives in a single JSON file fed by the owner, all computation happens in the browser, and sharing works through file export/import with additive merging.

## 2. What exists today (context, then delete)

The repo currently contains a v1 you will replace:

- `raktavruksha-frontend/`: React 19 + Vite + D3 SVG force graph. Its fatal flaws: clicking a person **swaps the entire filtered view** to another family and re-runs the force simulation from scratch (jarring, loses context); calculation and rendering are tangled inside the D3 component; the layout re-randomizes on every interaction.
- `RaktaVruksha/`: a Go + Neo4j backend that the frontend **never calls**. Dead weight.
- `add_person.py`: a CLI data-entry script, superseded.

**Worth salvaging (as reference, not code):**
- `raktavruksha-frontend/public/family-data.json`: the real data: 46 people, 13 families. Migrate it (Section 4).
- The **generation solver** in `raktavruksha-frontend/src/utils/treeUtils.ts` (`calculateGenerations`): an iterative constraint propagator (spouses same generation; parents = children − 1). The algorithm is sound; port it into the new core with tests.
- The domain concepts: birth family vs married-into family (a person marries *into* a family: an Indian-family-convention modeling choice; keep and deepen it, Section 4), "unknown parent" handling, marriage nodes.

**Cleanup (do this in M0):** delete `RaktaVruksha/` (Go backend), `add_person.py`, and the root `.DS_Store`. Delete `raktavruksha-frontend/` only at the end of M4, once v2 renders the migrated data correctly.

## 3. Stack (fixed: do not substitute)

- **Vite + React + TypeScript** (strict mode).
- **react-force-graph-3d** (+ `three`, `three-spritetext`) for the 3D scene. It provides WebGL rendering, orbit/zoom/pan controls, node click/hover, and programmatic camera transitions out of the box.
- **zustand** for state (small, no boilerplate).
- **vitest** for unit tests on the core layer.
- No CSS framework: hand-written CSS with custom properties (design tokens, Section 8). No router. No other runtime dependencies without strong justification.

Project lives in a new top-level directory: **`app/`**.

## 4. Data model v2: the union is the source of truth

The single source of truth for relationships is the **union** (à la GEDCOM's FAM record). People do **not** store `parents`/`children`/`spouses` arrays: v1 stored all three redundantly and they drifted out of sync. All of that is derived at load time.

This model must carry the full messiness of real kinship, and each case maps cleanly:

| Real-world case | How the model holds it |
|---|---|
| Multiple spouses (serial or concurrent) | One person appears as a partner in multiple unions |
| Children across different spouses | Each child is the **biological** child of exactly one union; half-siblings share a parent but not a union |
| Divorce, then remarriage into a third family | Two unions on the same person, `status: "divorced"` then `"married"`, each with its own `familyId` and children |
| **Born out of wedlock** (both parents known, never married) | 2-partner union with `status: "partners"`: the parentage is complete, only the marriage is absent |
| **Partner unknown** (one parent known, the other simply not recorded) | 1-partner union: a data gap, not a relationship status; `status` is typically `"unknown"` |
| **Adopted** (raised by a union that is not the biological one) | Child appears in the adoptive union's `adoptedChildren`; their biological union: if known, even partially: may *also* exist listing them in `children`. The two parentages coexist and stay distinguishable |
| Orphans / unknown lineage | Person is no union's child; `birthFamilyId` may be `null` (rendered neutral) |

These three: out of wedlock, partner unknown, adopted: are **distinct and must never collapse into each other**: the first is a complete biological parentage without marriage, the second is incomplete knowledge, the third is a non-biological parentage that can coexist with a biological one.
| Lineage: which family are the children born into? | **The union owns it**: `union.familyId` is the family its children are born into: explicit, never guessed from gender |
| A woman's family history (born fam1 → married fam2 → divorced → married fam3) | Derived: `[birth: fam1, married-into: fam2 (divorced), married-into: fam3]`, ordered by `union.order` |

### Schema

```jsonc
{
  "meta": {
    "schemaVersion": 2,
    "exportedAt": "2026-07-11T00:00:00Z"   // set on every export
  },
  "families": {
    "familyPandya": { "name": "Pandya", "color": "#e74c3c" }
  },
  "people": [
    {
      "id": "Dhawal",                  // stable, unique, never reused
      "firstName": "Dhawal",
      "lastName": "Pandya",
      "gender": "male",                // "male" | "female"
      "alive": true,
      "birthFamilyId": "familyPandya", // null = unknown lineage; if the person is a union's child, must equal that union's familyId (validator enforces)
      "notes": "",                     // optional free text
      "updatedAt": "2026-07-11T00:00:00Z"
    }
  ],
  "unions": [
    {
      "id": "u_ajay_harsha",
      "partners": ["Ajaykumar", "Harsha"], // 1 or 2 ids; 1 = other parent unknown
      "children": ["Dhawal"],              // biological children of this union
      "adoptedChildren": [],               // optional; children raised by this union but not biologically its own
      "familyId": "familyPandya",          // family this union's children are born into / adopted into
      "status": "married",                 // "married" | "divorced" | "partners" | "unknown"
      "order": 1,                          // optional: sequence of this union among each partner's unions
      "updatedAt": "2026-07-11T00:00:00Z"
    }
  ]
}
```

Rules:
- IDs are opaque strings. Migrated people keep their v1 ids; **new** people get `p_<nanoid(8)>`, new unions `u_<nanoid(8)>`. Never derive ids from names for new records (v1's name-based ids collide).
- **Child membership:** a person is the *biological* child of **at most one** union and may *additionally* be the *adopted* child of at most one union: never both roles in the same union. An adopted child's `birthFamilyId` stays their biological lineage when known (else `null`); their affiliation with the adoptive family is derived from the adoptive union's `familyId`, exactly like a married-in affiliation.
- There is **no `currentFamilyId`** on a person. Family affiliation is derived: `familiesOf(person)` = birth family + adoptive union's family (if any) + the `familyId` of every union they partner in, ordered, each tagged with how it was acquired (birth / adopted-into / married-into, with union status). This is what the detail card shows as family chips.
- Derived at load into indexed maps (in `core/`): `parentsOf` (each parent tagged `biological | adoptive`), `childrenOf` (same tagging), `spousesOf` (with union status), `unionsOf`, `siblingsOf` (distinguishing full / half / adoptive), `membersOfFamily(familyId)` = everyone born into, adopted into, **or** married into it. All O(1) lookups after one O(n) pass.
- `updatedAt` on every record powers merge (Section 7).

### Migration

Write `app/scripts/migrate-v1.ts` (run with `npx tsx`): reads `raktavruksha-frontend/public/family-data.json`, emits `app/public/family-data.json` in v2:
- Every `parents: [a, b]` pair across children ⇒ one union keyed on the sorted partner pair, children accumulated. Single known parent ⇒ 1-partner union. `unknown_*` placeholder ids dropped entirely.
- Childless `spouses` pairs ⇒ 2-partner union with `children: []`.
- `union.familyId`: the children's shared `birth_family_id`; for childless unions, the partner's `current_family_id` where it differs from their birth family (that's who married in). `status` defaults to `"married"`.
- v1 `current_family_id` is otherwise discarded: it's now derived.
- Validate the output: every referenced id exists, no duplicate ids, partner pairs unique, each person a biological child of at most one union and adopted child of at most one (v1 has no adoption data, so `adoptedChildren` stays empty in migration), biological child `birthFamilyId` matches its union's `familyId`. Print a summary (people in/out, unions created, placeholders dropped, inferred familyIds). Fail loudly on inconsistency: v1's hand-maintained redundant links may disagree; when `children` and `parents` disagree, trust `parents`.

## 5. Architecture: calculation strictly split from rendering

```
app/src/
  core/        # PURE TypeScript. No imports from react, three, zustand, DOM.
    types.ts           # Person, Union, FamilyDataV2, GraphNode, GraphLink, LayoutResult
    dataset.ts         # parse/validate JSON, build indexed maps, derive relations & family membership
    generations.ts     # generation solver (ported from v1, reformulated over unions)
    graph.ts           # dataset -> { nodes, links } (union nodes included)
    layout.ts          # headless d3-force-3d: computes fixed x/y/z per node
    kinship.ts         # shortest kinship path (BFS) + relation namer (Section 6c)
    merge.ts           # additive import merge + merge report
    exporter.ts        # dataset -> v2 JSON string
  state/       # zustand store: dataset, focus, family lens, relation-mode, ui flags. Imports core only.
  render/      # the 3D scene. Imports core + state. NO business logic.
    Scene3D.tsx        # react-force-graph-3d wrapper: draws precomputed layout, camera, dimming
  ui/          # HUD, panels, search, forms. Imports state only (never render/ internals).
  App.tsx
```

**The dependency rule is law:** `core` imports nothing from the other layers; `render` and `ui` never compute anything domain-related: if a component needs a derived fact, it comes from `core` via `state`. Every module in `core/` gets vitest coverage. Test the hard cases explicitly: half-siblings, remarriage chains, orphans, out-of-wedlock unions, 1-partner (unknown-parent) unions, adopted children (including one with a partially known biological union coexisting), disconnected components, spouse-only links.

**Layout is precomputed, not live-simulated.** `core/layout.ts` runs d3-force-3d headlessly (`simulation.tick(n)` for ~300 ticks, no rendering):
- **Y axis = generation.** Each node's y is *fixed* to `-generation * LAYER_GAP` (ancestors up). This is the 3D version of v1's row layout and it's what makes a family web readable.
- X/Z: link force (short distances for union↔partner/child links), charge repulsion, collision. Seeded per family cluster so families form spatial neighborhoods: this is what makes the family lens (6b) feel spatial rather than scattered.
- Output: deterministic `{ id, x, y, z }` for every node. The renderer receives nodes with `fx/fy/fz` set, so react-force-graph-3d's own engine (`cooldownTicks={0}`) does no work: it is purely a camera + draw layer. Same data in ⇒ same layout out; the world never reshuffles under the user.

Union nodes are small dim spheres (the v1 "marriage node" idea, kept); person↔union and union↔child links replace direct edges where both parents are known. A person with multiple unions has multiple union nodes around them: the polygamy/remarriage structure is directly visible.

## 6. Interaction spec (this fixes v1's broken selection)

The whole graph is always loaded and rendered: "simply everyone" is the default mode. Navigation = camera movement + opacity, never data swapping, never relayout.

### 6a. Focus (click a person)

- **Click a person** → camera flies to them over ~800 ms (`cameraPosition({x,y,z}, lookAtNode, 800)`), stopping at a distance where the person and their immediate relatives fill the view. The person becomes **focused**: their node brightens, direct relatives (parents, spouses, children) stay at full opacity with highlighted links, everything else dims to ~15% opacity.
- A **detail card** (left panel) shows: name, birth-family chip, adopted-into chip (if any), one chip per married-into family (with ⚮ marker if divorced), and clickable relatives: parents (tagged *adoptive* where applicable), spouses (grouped per union with status), children (grouped under the union they belong to: so "children with spouse A / children with spouse B" reads directly: with adopted children tagged inside their union group). Clicking any name flies to that person. This is how you hop family-to-family seamlessly.
- The detail card also carries **grow actions**: "+ Spouse", "+ Child", "+ Parent": for adding members directly at the graph's extremities (Section 7).
- **Click empty space / Esc** → clear focus, restore opacity. Camera stays put.
- **Search** (top bar): fuzzy match on person and family names. Selecting a person = clicking them. Selecting a family = activating its lens (6b).
- **Orbit / zoom / pan**: library defaults. No node dragging: layout is fixed.
- **Labels**: `three-spritetext` name sprites, fading out with camera distance so the far web stays clean. Hover: tooltip with full name + families.
- **Double-click a person** → "isolate mode": everything outside their connected component fades to near-zero and the camera fits the component. Esc exits.

### 6b. Family lens (family sections without reload)

- Activating a lens on family F (via search, legend click, or detail-card chip): every member of F: **born into or married into it**: stays at full opacity; everyone else fades to ~3% (positions untouched; the world's shape never changes). Camera glides to fit F's cluster. Optionally render a faint translucent halo sphere around the lens family.
- **While a lens on F is active**, clicking a member who was *born in F* simply focuses them (6a). Clicking a member who **married into F** (born in family G) focuses them **and switches the lens to G**, camera gliding to G's cluster: this is the v1 "click a wife to see her birth family" behavior done right: the world holds still, only light and camera move. (Keyed on "married-in", not gender: it also covers men who married in.)
- The detail card's family chips switch the lens explicitly at any time.
- **"Everyone" button** (and Esc when no focus is set) clears the lens back to the full web.
- Lens and focus compose: you can be lensed on F with a person focused inside it.

### 6c. Relation finder (shortest path between two people)

- **Relation mode** (HUD button or pressing `r`): pick person A and person B (click or search, in either order). The app computes the shortest kinship path and:
  - **Lights the route in 3D**: nodes and links on the path glow at full brightness, everything else dims; camera pulls back to fit the whole path.
  - **Names the relationship** in a result panel: a composed name when the pattern is known: grandfather/grandmother, uncle/aunt (paternal/maternal: the model distinguishes them), first cousin, brother/sister-in-law, step/half-sibling (same parent, different union: free with the union model), and adoptive relations named as such ("adoptive father", "adopted son", "adoptive sister") since adoption edges are tagged in the graph: otherwise a readable chain: "Dhawal → father Ajaykumar → sister X → husband Y". Every hop in the chain is clickable (flies to that person).
- Implementation lives in `core/kinship.ts`, fully unit-tested: BFS over kinship edges (child→parent, parent→child, partner↔partner with status), all edges weight 1, deterministic tie-breaking. The namer is a composition table over step sequences (up/down/side) covering common patterns to ~4 steps, with the chain as fallback. Indian kinship terms (mama/kaka/masi…) are a natural later extension: the model already distinguishes maternal/paternal and blood/marriage sides.

## 7. Additive data workflow (owner-fed, file-based)

### Growing the graph at its extremities (on-graph adding)

The primary way to add people is **directly on the graph**, from a focused person's detail card:

- **"+ Child"** → mini-form pre-filled from context: pick which of the focused person's unions the child belongs to (or create one: including a 1-partner union if the other parent is unknown), biological or adopted, name/gender/alive. The union's `familyId` prefills the child's `birthFamilyId`.
- **"+ Spouse"** → creates a union with the focused person: new or existing person as partner, `status` (married/divorced/partners), `familyId` (default: the focused person's birth family).
- **"+ Parent"** → creates or completes the focused person's parent union: add one/two people, or attach to an existing union; adoptive variant supported.
- On confirm, the new node **materializes at the graph's edge next to its relatives**: layout recomputes with deterministic seeding so existing nodes stay roughly in place, and the camera nudges to include the newcomer. No reload, no reshuffle.
- A global **Add** button (HUD) opens the same form un-prefilled for standalone people (e.g., a new root ancestor or a disconnected person). Editing a person allows adding further unions (remarriage), marking a union divorced, and fixing fields. Everything stamps `updatedAt`.

### Persistence: edits become the default data

The working dataset **autosaves to IndexedDB** on every change, so edits survive reloads with zero ceremony. Load order at startup: IndexedDB draft if present, else the bundled `app/public/family-data.json`. A small "unsaved draft" indicator shows when the draft differs from the bundled file.

- **Save** → writes the full v2 JSON back to disk via the **File System Access API** where available (the owner picks `app/public/family-data.json` once; the handle is remembered for one-click saves thereafter): the saved file **is** the new default data. Where the API is unavailable, fall back to a download the owner drops into `app/public/` manually. `meta.exportedAt` refreshed on every save.
- **Reset to file** → discards the IndexedDB draft and reloads the bundled JSON (with a confirm dialog stating what will be lost).
- **Export** → same serialization as Save, always as a download: for sharing with relatives rather than persisting.
- **Import** (file picker) → `core/merge.ts` merges additively into the working draft: unknown ids are **added**; known ids are **updated only if** incoming `updatedAt` is newer; nothing is ever deleted; family color conflicts keep the local color. Then a **merge report** modal: N people added/updated, N unions added/updated, list of names. This is the "relatives send me a file" workflow: no auth needed because merge is additive and the owner reviews the report before saving.
- Malformed imports (bad schema, dangling ids, a person as biological child of two unions) are rejected with a readable error, never a crash.

## 8. Design direction

Dark-first, cosmic, restrained. The tree of blood as a constellation map.

- **Canvas**: near-black with a blue cast (`#0a0e1a`-ish), subtle radial vignette. Light theme optional, later; dark is primary.
- **Nodes**: soft-glow spheres tinted by **birth family color** (emissive material; gentle bloom feel without a heavy postprocessing dependency). Unknown lineage: neutral gray. Deceased: same hue, desaturated ~50%. Focused node: brighter + slightly larger. Union nodes: small, neutral, dim.
- **Links**: parent-child cool gray at low opacity; union bridges warmer and brighter: marriages are the visually interesting edges (they connect constellations). **Divorced unions: dashed/darker**: the history remains visible but reads as past. **Adoptive child links: dotted**: visibly distinct from biological at a glance. Relation-finder path: the brightest thing on screen while active.
- **HUD** (floating over the canvas; glassmorphism-lite: translucent dark panels, 1px borders):
  - top-left: wordmark "Raktavruksha", "रक्तवृक्ष" beneath it, small.
  - top-right: search, Add, Import, Export, Relation-mode toggle.
  - bottom-right: family legend: color dot + name, clickable (= lens). "Everyone" appears here while a lens is active.
  - left: detail card (focus) or relation result panel (relation mode).
  - bottom-left: one-line hint ("click a person to focus · scroll to zoom · esc to reset"), dismissible.
- **Typography**: system stack or Inter (self-hosted if used, no CDN fonts). Sizes/spacings/colors as CSS custom properties in one `tokens.css`.
- No emoji buttons (v1's ☀️/🌙), no default-browser-widget look. Every interactive element gets hover/focus states. All transitions (opacity dims, camera) eased: nothing snaps.
- **Responsive / mobile**: the app must work well on phones. Touch orbit/pinch-zoom/tap come from the 3D controls; the HUD adapts: on small screens the detail card and relation panel become bottom sheets, the top bar collapses (search expands on tap, actions into a menu), the legend becomes a horizontal scroll strip, and all touch targets are ≥44px. Forms/modals go full-screen on mobile.

## 9. Milestones: build in this order, each ends verified

**M0: Clean slate.** Delete `RaktaVruksha/`, `add_person.py`, root `.DS_Store`. Scaffold `app/` (Vite react-ts), install deps, set up vitest, write `core/types.ts`, write and run the migration script. Also write `app/scripts/generate-stress-data.ts`: emits a synthetic valid v2 dataset (~2,000 people, ~40 families, realistic union structure incl. remarriages and half-siblings) for performance testing. ✅ *Done when: `app/public/family-data.json` is valid v2, migration summary printed, stress file generates, `npm test` runs.*

**M1: The world exists.** `core/dataset.ts`, `generations.ts`, `graph.ts`, `layout.ts` with tests; `Scene3D` renders the full migrated graph: generation-layered 3D layout, family colors, labels, orbit/zoom/pan. ✅ *Done when: `npm run dev` shows all 46 people as a stable 3D web; reloading produces the identical layout; the 2,000-node stress file renders and orbits fluidly; solver tests pass.*

**M2: Navigation.** Focus (6a): click-to-fly, relative highlighting + dimming, detail card with union-grouped relatives, empty-click/Esc deselect, search, isolate mode. Family lens (6b): lens activation from search/legend/chips, married-in click switching, "Everyone". ✅ *Done when: you can start in one family, lens into it, click a married-in member and land in her birth family, and reach a person three families away purely by clicking: camera gliding every hop, the world never reshuffling.*

**M3: Data in/out.** On-graph grow actions (+ Child incl. adopted, + Spouse, + Parent) and the global add/edit panel (union-based, incl. remarriage, divorce marking, adoption); IndexedDB draft autosave with load-order and reset-to-file; Save via File System Access API with download fallback; export; import + additive merge with merge report; error handling for malformed files. ✅ *Done when: from a focused person you can add a child, a spouse, and an adoptive child, each materializing beside its relatives without the world reshuffling; reload the page and the additions are still there (draft); Save writes the file and it round-trips as the new default; add a second spouse to someone and both unions render distinctly; import a relative's file → merge report is sane.*

**M4: Polish.** Full design pass per Section 8: tokens, HUD styling, label distance fading, divorced-link styling, hover states, loading/empty states. Delete `raktavruksha-frontend/`. Update the repo README (what it is, `cd app && npm i && npm run dev`, data workflow). ✅ *Done when: no default-styled controls remain; a stranger could open the README and run it.*

**M5: Relation finder.** `core/kinship.ts` (BFS + namer, unit-tested incl. half-sibling, in-law, and adoptive cases) and the relation mode UI/rendering (6c). ✅ *Done when: picking any two people in the migrated data lights a path and names or chains the relation; picking two people in disconnected components reports "no known relation" gracefully.*

**M6 (optional, later)**: 2D fallback mode (react-force-graph's 2D component shares the API; core needs zero changes: the payoff of the split), Indian kinship terms in the namer, GEDCOM export, photos on nodes.

## 10. Non-goals

No backend, no auth, no database, no Neo4j, no server-side anything, no collaborative real-time editing. (Mobile responsiveness **is** in scope: see Section 8.)

## 11. Performance: fluid at thousands of nodes

This is a hard requirement, verified with the stress dataset from M0:

- **60 fps orbit/zoom at 2,000 nodes; usable at 5,000+.** Techniques: shared sphere geometry across nodes (per-node material or per-instance color for family tint and dimming), sprite labels only within camera distance (labels are the usual killer: distance-fading is the mitigation), no per-frame allocations in render callbacks, dim/lens changes applied as batched material updates rather than object rebuilds.
- Layout is headless and one-shot: under ~2 s for 2,000 nodes is acceptable (cache by dataset hash in memory so lens/focus changes never re-run it).
- Focus/lens/relation transitions must never drop the frame rate visibly: they change opacity and camera only, never geometry or layout.
