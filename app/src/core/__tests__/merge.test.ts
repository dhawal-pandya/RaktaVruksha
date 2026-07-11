import { describe, expect, it } from 'vitest';
import { mergeData } from '../merge';
import { fixture } from './fixture';

describe('additive merge', () => {
  it('adds unknown people and unions, never deletes', () => {
    const local = fixture();
    const incoming = fixture();
    incoming.people.push({
      id: 'NewCousin',
      firstName: 'New',
      lastName: 'Cousin',
      gender: 'male',
      alive: true,
      birthFamilyId: 'famB',
      updatedAt: '2026-06-01T00:00:00.000Z',
    });
    incoming.unions.push({
      id: 'u_new',
      partners: ['UncleB'],
      children: ['NewCousin'],
      adoptedChildren: [],
      familyId: 'famB',
      status: 'unknown',
      updatedAt: '2026-06-01T00:00:00.000Z',
    });
    // incoming also silently "deleted" someone — must not propagate
    incoming.people = incoming.people.filter(p => p.id !== 'Hermit');

    const { merged, report } = mergeData(local, incoming);
    expect(report.peopleAdded).toEqual(['New Cousin']);
    expect(report.unionsAdded).toBe(1);
    expect(merged.people.some(p => p.id === 'Hermit')).toBe(true); // never deleted
    expect(merged.people.length).toBe(local.people.length + 1);
  });

  it('updates only when incoming is newer', () => {
    const local = fixture();
    const incoming = fixture();
    const newer = incoming.people.find(p => p.id === 'Son')!;
    newer.notes = 'updated remotely';
    newer.updatedAt = '2026-06-01T00:00:00.000Z';
    const stale = incoming.people.find(p => p.id === 'Dau')!;
    stale.notes = 'stale edit';
    stale.updatedAt = '2020-01-01T00:00:00.000Z';

    const { merged, report } = mergeData(local, incoming);
    expect(report.peopleUpdated).toEqual(['Son famA']);
    expect(merged.people.find(p => p.id === 'Son')!.notes).toBe('updated remotely');
    expect(merged.people.find(p => p.id === 'Dau')!.notes).toBeUndefined();
  });

  it('keeps local family colors on conflict, adds new families', () => {
    const local = fixture();
    const incoming = fixture();
    incoming.families.famA = { name: 'A-renamed', color: '#000000' };
    incoming.families.famNew = { name: 'New', color: '#123456' };

    const { merged, report } = mergeData(local, incoming);
    expect(merged.families.famA).toEqual({ name: 'A', color: '#e74c3c' });
    expect(merged.families.famNew).toEqual({ name: 'New', color: '#123456' });
    expect(report.familiesAdded).toEqual(['New']);
  });
});
