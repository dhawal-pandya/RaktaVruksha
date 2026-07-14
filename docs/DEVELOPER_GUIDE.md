# Developer guide

Welcome to Raktavruksha. This is the tour you need before touching code: what the
pieces are, why they're shaped that way, and where to make which kind of change.
For the data format, editing workflow, and deployment, see
[DATA_AND_EDITING.md](DATA_AND_EDITING.md).

The app is frontend-only: React 19 + TypeScript + Vite, rendered with
`react-force-graph-3d`/`-2d` (three.js under the hood), state in zustand, tests in
vitest. There is no backend — the entire family lives in
`app/public/family-data.json` and everything is computed in the browser.

Before anything else, internalize the one architectural rule:

> **All intelligence lives in pure TypeScript; the renderers are dumb.**
> `src/core/` has zero imports of React, three.js, or the DOM — which is why it is
> fully unit-tested. `src/render/` only draws precomputed positions and moves the
> camera.

## Layout of the code

```
app/src/
  core/     pure TS, fully unit-tested — no react/three/DOM imports
  state/    zustand store (one brain for both views) + persistence helpers
  render/   Scene3D + Scene2D: draw the precomputed layout, no business logic
  ui/       HUD: top bar, search, families dropdown, detail card, relation
            panel, person/family forms, modals
```

## The data model: unions, not parent pointers

The single most important design decision, in `core/types.ts`: **people carry no
parent/child/spouse arrays.** All relationships flow through a `UnionRecord` — a
partnership with `partners` (1 or 2 people), `children`, `adoptedChildren`, a
`status` (married / divorced / partners), and a `familyId` (the family its
children belong to).

That one shape encodes every hard case without special-casing: a single known
parent is a 1-partner union (a data gap, not a status); adoption is a child
sitting in `adoptedChildren` of one union while possibly also being a biological
child of another; divorce and remarriage are simply multiple unions per person.
Every person has a `birthFamilyId`; families are the coloring and clustering unit
for the whole app.

## The pipeline: JSON → Dataset → Graph → Layout

On boot (and after every edit) the store re-runs four pure steps:

1. **Index** — `core/dataset.ts`. One O(n) pass builds every lookup the app ever
   needs: `parentsOf`, `childrenOf`, `spousesOf`, `unionsOf`, `membersOfFamily`,
   each person's family-affiliation history, and display labels that
   disambiguate same-named lineages ("Pandya · Kevalji" vs "Pandya · Jayantilal").
   Nothing downstream ever walks the raw unions again.

2. **Generations** — `core/generations.ts`. A BFS over edge deltas (partners = 0,
   parent→child = +1) assigns every person a generation, normalized per connected
   component. This number is the **vertical axis in both views** — it's why
   ancestors always sit above descendants and why the 3D camera never tumbles
   past level.

3. **Graph build** — `core/graph.ts`. Person nodes for everyone, plus a small
   **union node** for every 2-partner union (the "marriage bridge"). Both
   partners link to it; children hang off it — so a couple's children visually
   descend from the *marriage*, not from one parent. 1-partner unions skip the
   bridge and link parent→child directly.

4. **Layout** — where 3D and 2D diverge (below).

## The 3D layout: rigid couples in a force field

`core/layout.ts` runs **d3-force-3d headlessly** — a fixed number of ticks,
synchronously, before anything renders. Same graph in → same positions out; the
world never reshuffles under the user. Three structural constraints:

- **Y is locked to generation** (`fy = -gen × 110`); the forces only settle X/Z.
- **Families are seeded as clusters** on a ring, members placed in a
  deterministic phyllotaxis spiral, held loosely together by a gentle
  `forceX`/`forceZ` pull.
- **Each couple is one rigid body.** A 2-partner union is simulated as a single
  sim node whose collide radius covers the whole pair; the two orbs are only
  split out (±15 around the center) when positions are emitted. That makes
  couple adjacency a geometric guarantee rather than a force outcome: no orb can
  end up *between* partners, and no stranger can end up closer to a person than
  their own spouse. When someone has several unions, their **primary** union
  (married beats divorced) is the welded one; extra spouses are seated in a row
  on the other side — Jasodaben—Arun—Taraben.

If the graph ever feels cramped, `CHARGE_STRENGTH` in `layout.ts` is the one dial
to turn; the file's comments explain why the family-pull constants are best left
alone.

`render/Scene3D.tsx` feeds these positions to `react-force-graph-3d` as *fixed*
coordinates — the library's own simulation is effectively off. The scene handles
presentation only: emissive sphere materials, `three-spritetext` labels (men's
names above the orb, women's below, so couples never overprint), OrbitControls
clamped so the vertical axis stays upright, and camera choreography consumed from
the store's `cameraRequest` stream. Dim/glow states are applied as batched
material updates — never geometry rebuilds.

## The 2D layout: one family at a time, as a real tree

The full intermarried web doesn't lay out legibly on a plane, so 2D deliberately
scopes to a single family:

- `core/family2d.ts` computes the subgraph: everyone born, married, or adopted
  into the family, plus each married-away spouse as a faded external leaf.
  Clicking an external person navigates to *their* birth family — that's how you
  hop across the web in 2D.
- `core/layout2d.ts` is a from-scratch **Reingold–Tilford tidy tree**: one walk
  measures each subtree's width in slots, a second assigns X, centering couples
  over their children; siblings sit in birth order; each union is "owned" by the
  blood-family partner. Fully deterministic, no live simulation.

`render/Scene2D.tsx` draws it in pure-canvas mode (`cooldownTicks={0}`, fixed
positions) with greedy label collision avoidance, and hosts the small **Share**
button (bottom-right) that copies a `?family=<id>` link — always stripping the
`edit` key so the secret never leaks into a shared URL.

## One brain, two views

`state/store.ts` (zustand) owns everything: the derived data, `viewMode`,
`focusId`, `lensFamilyId` (3D family spotlight), `family2d` (the single family
shown in 2D), relation-finder state, and a sequenced `cameraRequest` stream that
whichever scene is mounted consumes. A store subscription mirrors the on-screen
family into the URL's `?family=` param (via `replaceState`), which `boot()` reads
back — that's the whole share mechanism.

`render/visuals.ts` is the shared "what should be dimmed or glowing" calculator
for both scenes — given focus/lens/isolate/relation state it returns per-node
opacity and a glow set, so focusing a person behaves identically in 2D and 3D.

## Kinship: the relation finder

`core/kinship.ts` finds the shortest path between two people (BFS over
up/down/side edges from the indexed dataset), then names it twice:

- **English**: "8× great-grandfather", "half-sister", "maternal uncle",
  "mother-in-law", with adoptive/step variants.
- **Sanskrit (Gujarati)**: *pitamaha (dada)* vs *matamaha (nana)*, *bhatrijo* vs
  *bhanej*, elder/younger siblings from birth order — distinctions the data model
  was designed to support.

The clickable hop chain narrates the path, and collapses any up-then-down pair
through a shared parent into a single sibling hop — "Dhawal → sister Hitarthi",
never "Dhawal → father Ajaykumar → daughter Hitarthi"; uncles read as "mother's
brother", the way people actually speak.

## Editing

All mutations (`core/mutate.ts`) are pure functions over the raw data: grow a
spouse/child/parent, edit, delete with full link cleanup, merge duplicate people
(`core/merge.ts` — always merge, never delete-and-reconnect), reorder siblings.
After any edit the store re-runs the whole pipeline — index, generations, graph,
layout — which is cheap at family scale and keeps everything consistent by
construction. See [DATA_AND_EDITING.md](DATA_AND_EDITING.md) for the unlock key
and the save/publish flow.

## Working on it

```bash
cd app
npm run dev        # vite dev server on :5173
npm test           # vitest — the core layer is the tested surface
npm run build      # tsc --noEmit + vite build
npm run stress     # generate ~1,700-person synthetic data → ?data=stress
```

Conventions worth keeping:

- New logic that isn't drawing belongs in `core/`, with a test in
  `core/__tests__/`. The layout tests assert real invariants (determinism,
  y-locking, couple adjacency) — extend them when you touch `layout*.ts`.
- Verify visually before calling UI work done. The repo's pattern: install
  `playwright-core` in a scratch dir (not the project), launch the system Chrome
  (`chromium.launch({ channel: 'chrome', headless: true })`), drive the dev
  server, screenshot, and actually look at the PNGs. Search inputs are most
  reliably driven by filling `.search-input` and pressing Enter.
- Ids stay human-readable: people are `Firstname` (then `Firstname_1`), unions
  `u_<partners>`, families `family<Name>`. `npm run rename-ids` rewrites any
  stray generated ids.
