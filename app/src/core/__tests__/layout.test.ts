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
});
