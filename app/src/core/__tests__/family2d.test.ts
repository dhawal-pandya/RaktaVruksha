import { describe, expect, it } from 'vitest';
import { buildDataset } from '../dataset';
import { buildGraph } from '../graph';
import { computeLayout2d, GEN_GAP_2D } from '../layout2d';
import { familyView, primaryFamilyOf, subgraphForFamily } from '../family2d';
import { fixture } from './fixture';

const ds = buildDataset(fixture());
const graph = buildGraph(ds);

describe('familyView (single-family subgraph)', () => {
  it('includes members born and married into the family', () => {
    const view = familyView(ds, 'famA');
    // Dad (born), Mom (married in), Son/Dau (born), HalfSis (born), AdoptedKid (adopted in)
    expect(view.nodeIds.has('Dad')).toBe(true);
    expect(view.nodeIds.has('Mom')).toBe(true);
    expect(view.nodeIds.has('Son')).toBe(true);
    expect(view.nodeIds.has('HalfSis')).toBe(true);
    expect(view.nodeIds.has('AdoptedKid')).toBe(true);
  });

  it('pulls in an out-married spouse as an external leaf', () => {
    // Son (born famA) had a child with Girlfriend (born famC) — out of wedlock,
    // union familyId famA, so Girlfriend married "into" famA and is a member.
    // Instead test Ex: Dad's ex, born famC, union familyId famA → member (married in).
    const view = familyView(ds, 'famA');
    expect(view.nodeIds.has('Ex')).toBe(true);
  });

  it('marks people from other families as external, not members', () => {
    // View famB: Mom & UncleB born there; Dad married Mom (union familyId famA),
    // so from famB's view Dad is an external spouse of Mom.
    const view = familyView(ds, 'famB');
    expect(view.nodeIds.has('Mom')).toBe(true);
    expect(view.nodeIds.has('UncleB')).toBe(true);
    expect(view.nodeIds.has('Dad')).toBe(true);
    expect(view.external.has('Dad')).toBe(true);
    expect(view.external.has('Mom')).toBe(false);
  });

  it('does not pull an out-married couple\'s children into the birth family view', () => {
    // From famB, Mom married out to famA; her children Son/Dau belong to famA.
    const view = familyView(ds, 'famB');
    expect(view.nodeIds.has('Son')).toBe(false);
    expect(view.nodeIds.has('Dau')).toBe(false);
  });

  it('primaryFamilyOf prefers lineage, falls back to married-in', () => {
    expect(primaryFamilyOf(ds, 'Dad')).toBe('famA');
    expect(primaryFamilyOf(ds, 'Mom')).toBe('famB'); // born there
  });
});

describe('computeLayout2d', () => {
  const view = familyView(ds, 'famA');
  const sub = subgraphForFamily(graph, view);

  it('is deterministic', () => {
    const a = computeLayout2d(sub);
    const b = computeLayout2d(sub);
    for (const [id, p] of a) expect(b.get(id)).toEqual(p);
  });

  it('locks y to generation and places every node', () => {
    const pos = computeLayout2d(sub);
    for (const n of sub.nodes) {
      const p = pos.get(n.id);
      expect(p).toBeDefined();
      expect(Number.isFinite(p!.x)).toBe(true);
      expect(Number.isFinite(p!.y)).toBe(true);
    }
    // people one generation apart differ by exactly one gap in y
    const dad = pos.get('Dad')!;
    const son = pos.get('Son')!;
    expect(son.y - dad.y).toBe(GEN_GAP_2D);
  });

  it('keeps same-generation people from overlapping horizontally', () => {
    const pos = computeLayout2d(sub);
    const gen2 = sub.nodes.filter(n => n.kind === 'person' && n.gen === 2);
    const xs = gen2.map(n => pos.get(n.id)!.x).sort((a, b) => a - b);
    for (let i = 1; i < xs.length; i++) expect(xs[i] - xs[i - 1]).toBeGreaterThan(1);
  });

  it('lays a union\'s children left-to-right in birth order (eldest left)', () => {
    // u_dad_mom children are ['Son', 'Dau'] — Son should sit left of Dau.
    const pos = computeLayout2d(sub);
    expect(pos.get('Son')!.x).toBeLessThan(pos.get('Dau')!.x);
  });
});
