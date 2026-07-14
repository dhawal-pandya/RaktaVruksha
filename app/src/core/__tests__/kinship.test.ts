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

  it('narrates siblings as a single chain hop, not up-and-down through the parent', () => {
    // Full siblings: no parent hop in the chain.
    expect(relate('Son', 'Dau')!.chain.map(h => h.label)).toEqual([
      'Son famA',
      'sister Dau famA',
    ]);
    // Half-siblings collapse too, labeled as such.
    expect(relate('Son', 'HalfSis')!.chain.map(h => h.label)).toEqual([
      'Son famA',
      'half-sister HalfSis famA',
    ]);
    // Adoptive: the pair carries an adoptive tag.
    expect(relate('AdoptedKid', 'Son')!.chain.map(h => h.label)).toEqual([
      'AdoptedKid famC',
      'adoptive brother Son famA',
    ]);
  });

  it('collapses sibling hops mid-chain (uncles, nephews)', () => {
    // Son → Mom → (GpaB → UncleB) reads as mother's brother.
    expect(relate('Son', 'UncleB')!.chain.map(h => h.label)).toEqual([
      'Son famA',
      'mother Mom famB',
      'brother UncleB famB',
    ]);
    // UncleB → (GpaB → Mom) → Son reads as sister's son.
    expect(relate('UncleB', 'Son')!.chain.map(h => h.label)).toEqual([
      'UncleB famB',
      'sister Mom famB',
      'son Son famA',
    ]);
  });

  it('gives Sanskrit (Gujarati) terms with paternal/maternal distinctions', () => {
    expect(relate('Son', 'Dad')!.local).toBe('pita (bapa)');
    expect(relate('Dad', 'Son')!.local).toBe('putra (dikro)');
    // paternal grandmother vs maternal grandfather — distinct words
    expect(relate('Son', 'GmaA')!.local).toBe('pitamahi (dadi)');
    expect(relate('Son', 'GpaB')!.local).toBe('matamaha (nana)');
    // maternal uncle
    expect(relate('Son', 'UncleB')!.local).toBe('matula (mama)');
    // elder/younger from birth order (u_dad_mom children: Son then Dau)
    expect(relate('Dau', 'Son')!.local).toBe('agraj (moto bhai)'); // Son is elder brother
    expect(relate('Son', 'Dau')!.local).toBe('anuja (nani ben)'); // Dau is younger sister
    // half-siblings live in different unions, so order can't rank them → generic
    expect(relate('Son', 'HalfSis')!.local).toBe('half-bhagini (ben)');
    // paternal aunt (father's sister)
    expect(relate('LoveChild', 'HalfSis')!.local).toBe('pitrusvasa (foi)');
    // spouse by status
    expect(relate('Dad', 'Mom')!.local).toBe('patni (bairi)');
    expect(relate('Dad', 'Ex')!.local).toBe('ex-patni (bairi)');
    // in-law
    expect(relate('Mom', 'GpaA')!.local).toBe('shvashura (sasro)');
    // deep lineage uses the pra-/par- prefix
    expect(relate('LoveChild', 'GpaA')!.local).toBe('pra-pitamaha (par-dada)');
    expect(relate('GpaA', 'LoveChild')!.local).toBe('pra-pautri (par-pautri)');
  });

  it('names ancestral chains at any depth', () => {
    expect(relate('LoveChild', 'GpaA')!.name).toBe('great-grandfather');
    expect(relate('GpaA', 'LoveChild')!.name).toBe('great-granddaughter');
    expect(relate('GmaA', 'LoveChild')!.name).toBe('great-granddaughter');
  });
});
