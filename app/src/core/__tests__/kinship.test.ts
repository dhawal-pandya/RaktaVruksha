import { describe, expect, it } from 'vitest';
import { buildDataset } from '../dataset';
import { nameRelation, shortestKinPath } from '../kinship';
import { fixture } from './fixture';

const ds = buildDataset(fixture());

const relate = (a: string, b: string) => {
  const steps = shortestKinPath(ds, a, b);
  if (steps === null) return null;
  return nameRelation(ds, a, steps);
};

describe('shortest kinship path + namer', () => {
  it('names direct blood relations', () => {
    expect(relate('Son', 'Dad')!.name).toBe('father');
    expect(relate('Dad', 'Son')!.name).toBe('son');
    expect(relate('Son', 'GmaA')!.name).toBe('paternal grandmother');
    expect(relate('Son', 'GpaB')!.name).toBe('maternal grandfather');
  });

  it('names spouses by union status', () => {
    expect(relate('Dad', 'Mom')!.name).toBe('wife');
    expect(relate('Dad', 'Ex')!.name).toBe('ex-wife');
    expect(relate('Son', 'Girlfriend')!.name).toBe('partner');
  });

  it('distinguishes full and half siblings', () => {
    expect(relate('Son', 'Dau')!.name).toBe('sister');
    expect(relate('Son', 'HalfSis')!.name).toBe('half-sister');
  });

  it('names adoptive relations as such', () => {
    expect(relate('AdoptedKid', 'Dad')!.name).toBe('adoptive father');
    expect(relate('Dad', 'AdoptedKid')!.name).toBe('adopted son');
    expect(relate('AdoptedKid', 'SoloMum')!.name).toBe('mother'); // biological stays plain
  });

  it('names uncles with the paternal/maternal side', () => {
    expect(relate('Son', 'UncleB')!.name).toBe('maternal uncle');
  });

  it('names in-laws', () => {
    expect(relate('Mom', 'GpaA')!.name).toBe('father-in-law');
    expect(relate('GpaA', 'Mom')!.name).toBe('daughter-in-law');
  });

  it('reports no relation across disconnected components', () => {
    expect(shortestKinPath(ds, 'Son', 'Hermit')).toBeNull();
  });

  it('falls back to a readable clickable chain for long paths', () => {
    // LoveChild → HalfSis: up to Son... actually LoveChild→Son(up)→Dad(up)→HalfSis(down) = 'uud' → aunt
    const r = relate('LoveChild', 'HalfSis')!;
    expect(r.name).toBe('paternal aunt');
    // Girlfriend → Dau: side + up... chain exists even when the pattern is unnamed
    const r2 = relate('Girlfriend', 'GmaA')!;
    expect(r2.chain.length).toBeGreaterThan(2);
    expect(r2.chain[0].personId).toBe('Girlfriend');
    expect(r2.chain.at(-1)!.personId).toBe('GmaA');
  });

  it('handles identity', () => {
    expect(relate('Son', 'Son')!.name).toBe('the same person');
  });

  it('names ancestral chains at any depth', () => {
    expect(relate('LoveChild', 'GpaA')!.name).toBe('great-grandfather');
    expect(relate('GpaA', 'LoveChild')!.name).toBe('great-granddaughter');
    expect(relate('GmaA', 'LoveChild')!.name).toBe('great-granddaughter');
  });
});
