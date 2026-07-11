import { describe, expect, it } from 'vitest';
import { buildDataset } from '../dataset';
import { fixture } from './fixture';

describe('generation solver', () => {
  const ds = buildDataset(fixture());
  const gen = (id: string) => ds.generations.get(id);

  it('anchors the top generation at 0', () => {
    expect(gen('GpaA')).toBe(0);
    expect(gen('GpaB')).toBe(0);
  });

  it('places spouses in the same generation', () => {
    expect(gen('GmaA')).toBe(gen('GpaA'));
    expect(gen('Mom')).toBe(gen('Dad'));
    expect(gen('Ex')).toBe(gen('Dad'));
  });

  it('places children one generation below their parents', () => {
    expect(gen('Dad')).toBe(1);
    expect(gen('Son')).toBe(2);
    expect(gen('LoveChild')).toBe(3);
  });

  it('adopted children sit one below their adoptive parents too', () => {
    expect(gen('AdoptedKid')).toBe(2);
  });

  it('marrying across families aligns the in-law generations', () => {
    expect(gen('UncleB')).toBe(1); // Mom's brother, same gen as Dad
  });

  it('gives disconnected people their own component at generation 0', () => {
    expect(gen('Hermit')).toBe(0);
    const compHermit = ds.componentOf.get('Hermit');
    const compDad = ds.componentOf.get('Dad');
    expect(compHermit).not.toBe(compDad);
  });

  it('keeps the main web one connected component', () => {
    expect(ds.componentOf.get('GpaA')).toBe(ds.componentOf.get('LoveChild'));
    expect(ds.componentOf.get('GpaA')).toBe(ds.componentOf.get('OutKid')); // via adoption bridge
  });
});
