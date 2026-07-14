import { describe, expect, it } from 'vitest';
import { buildDataset } from '../dataset';
import { buildGraph } from '../graph';
import { computeLayout, LAYER_GAP } from '../layout';
import { fixture } from './fixture';

describe('graph builder', () => {
  const ds = buildDataset(fixture());
  const graph = buildGraph(ds);

  it('creates union nodes only for 2-partner unions', () => {
    const unionNodes = graph.nodes.filter(n => n.kind === 'union');
    expect(unionNodes.map(n => n.id).sort()).toEqual([
      'un:u_dad_ex',
      'un:u_dad_mom',
      'un:u_gpaA',
      'un:u_gpaB',
      'un:u_love',
    ]);
  });

  it('links 1-partner unions directly parent→child', () => {
    expect(graph.links).toContainEqual({
      source: 'SoloMum',
      target: 'OutKid',
      kind: 'child',
      tag: 'biological',
    });
  });

  it('tags adoptive child links', () => {
    expect(graph.links).toContainEqual({
      source: 'un:u_dad_mom',
      target: 'AdoptedKid',
      kind: 'child',
      tag: 'adoptive',
    });
  });

  it('carries union status onto partner links', () => {
    const exLink = graph.links.find(l => l.source === 'Ex' && l.kind === 'partner');
    expect(exLink?.status).toBe('divorced');
  });
});

describe('layout', () => {
  const ds = buildDataset(fixture());
  const graph = buildGraph(ds);

  it('is deterministic: same graph in, identical positions out', () => {
    const a = computeLayout(graph);
    const b = computeLayout(graph);
    for (const [id, pos] of a) {
      expect(b.get(id)).toEqual(pos);
    }
  });

  it('locks y to generation', () => {
    const pos = computeLayout(graph);
    expect(pos.get('GpaA')!.y).toBe(0);
    expect(pos.get('Dad')!.y).toBe(-LAYER_GAP);
    expect(pos.get('Son')!.y).toBe(-2 * LAYER_GAP);
  });

  it('positions every node', () => {
    const pos = computeLayout(graph);
    for (const n of graph.nodes) {
      const v = pos.get(n.id)!;
      expect(Number.isFinite(v.x)).toBe(true);
      expect(Number.isFinite(v.y)).toBe(true);
      expect(Number.isFinite(v.z)).toBe(true);
    }
  });

  it('keeps couples adjacent: no stranger closer to a person than their spouse', () => {
    const pos = computeLayout(graph);
    const dist = (a: string, b: string) => {
      const pa = pos.get(a)!;
      const pb = pos.get(b)!;
      return Math.hypot(pa.x - pb.x, pa.y - pb.y, pa.z - pb.z);
    };
    // Each person's primary couple is welded exactly 2×offset apart.
    const primaryCouples = [
      ['GpaA', 'GmaA'],
      ['GpaB', 'GmaB'],
      ['Dad', 'Mom'],
      ['Son', 'Girlfriend'],
    ];
    const coSpouses = new Map<string, Set<string>>();
    for (const u of fixture().unions) {
      for (const p of u.partners) {
        if (!coSpouses.has(p)) coSpouses.set(p, new Set());
        for (const q of u.partners) if (q !== p) coSpouses.get(p)!.add(q);
      }
    }
    const personIds = graph.nodes.filter(n => n.kind === 'person').map(n => n.id);
    for (const [a, b] of primaryCouples) {
      const spouseDist = dist(a, b);
      expect(spouseDist).toBeCloseTo(30, 5);
      for (const other of personIds) {
        if (other === a || other === b) continue;
        for (const self of [a, b]) {
          if (coSpouses.get(self)?.has(other)) continue; // an ex may sit as close
          expect(dist(self, other)).toBeGreaterThanOrEqual(spouseDist);
        }
      }
    }
    // The remarried spouse sits in a row on Dad's other side, adjacent too.
    expect(dist('Dad', 'Ex')).toBeCloseTo(30, 5);
  });
});
