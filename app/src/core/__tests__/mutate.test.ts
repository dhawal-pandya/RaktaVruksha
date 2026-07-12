import { describe, expect, it } from 'vitest';
import { buildDataset } from '../dataset';
import {
  deletePerson,
  growChild,
  growParent,
  growSpouse,
  mergePerson,
  mergeBlockReason,
  moveChildInUnion,
} from '../mutate';
import { validateData } from '../validate';
import { fixture } from './fixture';

const fields = (over: Record<string, unknown> = {}) => ({
  firstName: 'Test',
  lastName: 'Person',
  gender: 'female' as const,
  alive: true,
  birthFamilyId: 'famA' as string | null,
  ...over,
});

describe('grow flows', () => {
  it('grows a biological child into an existing union', () => {
    const raw = fixture();
    const { raw: next, personId } = growChild(raw, {
      parentId: 'Dad',
      unionId: 'u_dad_mom',
      adopted: false,
      child: fields(),
    });
    expect(validateData(next).errors).toEqual([]);
    const union = next.unions.find(u => u.id === 'u_dad_mom')!;
    expect(union.children).toContain(personId);
    // biological child inherits the union's family regardless of the form value
    expect(next.people.find(p => p.id === personId)!.birthFamilyId).toBe('famA');
  });

  it('grows a child with unknown other parent via a fresh 1-partner union', () => {
    const raw = fixture();
    const { raw: next, personId } = growChild(raw, {
      parentId: 'Dau',
      unionId: null,
      adopted: false,
      child: fields(),
    });
    expect(validateData(next).errors).toEqual([]);
    const union = next.unions.find(u => u.partners.length === 1 && u.partners[0] === 'Dau')!;
    expect(union.children).toContain(personId);
  });

  it('grows an adopted child without touching biological parentage', () => {
    const raw = fixture();
    const { raw: next, personId } = growChild(raw, {
      parentId: 'Son',
      unionId: 'u_love',
      adopted: true,
      child: fields({ birthFamilyId: null }),
    });
    expect(validateData(next).errors).toEqual([]);
    const union = next.unions.find(u => u.id === 'u_love')!;
    expect(union.adoptedChildren).toContain(personId);
    expect(union.children).not.toContain(personId);
  });

  it('attaches an existing person as a biological child without overwriting their family', () => {
    const raw = fixture();
    const { raw: next, personId } = growChild(raw, {
      parentId: 'Dad',
      unionId: 'u_dad_mom',
      adopted: false,
      existingId: 'Hermit',
    });
    expect(personId).toBe('Hermit');
    expect(validateData(next).errors).toEqual([]);
    expect(next.unions.find(u => u.id === 'u_dad_mom')!.children).toContain('Hermit');
    // The existing person's record is left untouched (not reborn into the union's family).
    expect(next.people.find(p => p.id === 'Hermit')!.birthFamilyId).toBeNull();
  });

  it('attaches an existing person as an adopted child', () => {
    const raw = fixture();
    const { raw: next } = growChild(raw, {
      parentId: 'Son',
      unionId: 'u_love',
      adopted: true,
      existingId: 'Hermit',
    });
    expect(validateData(next).errors).toEqual([]);
    const u = next.unions.find(u => u.id === 'u_love')!;
    expect(u.adoptedChildren).toContain('Hermit');
    expect(u.children).not.toContain('Hermit');
  });

  it('refuses to attach a person who is already a biological child elsewhere', () => {
    const raw = fixture();
    expect(() =>
      growChild(raw, { parentId: 'Son', unionId: 'u_love', adopted: false, existingId: 'Dau' }),
    ).toThrow(/already a biological child/);
  });

  it('refuses to make a person their own child', () => {
    const raw = fixture();
    expect(() =>
      growChild(raw, { parentId: 'Dad', unionId: null, adopted: false, existingId: 'Dad' }),
    ).toThrow(/own child/);
  });

  it('grows a spouse as a new union with status and family', () => {
    const raw = fixture();
    const { raw: next, unionId } = growSpouse(raw, {
      anchorId: 'Dau',
      existingId: null,
      spouse: fields({ gender: 'male', birthFamilyId: 'famC' }),
      status: 'married',
      familyId: 'famC',
    });
    expect(validateData(next).errors).toEqual([]);
    const union = next.unions.find(u => u.id === unionId)!;
    expect(union.partners).toContain('Dau');
    expect(union.familyId).toBe('famC');
    // Dau's family history now shows the marriage
    const ds = buildDataset(next);
    expect(ds.familiesOf.get('Dau')).toContainEqual({
      familyId: 'famC',
      kind: 'married-into',
      status: 'married',
      unionId,
    });
  });

  it('completes a 1-partner union when growing the missing parent', () => {
    const raw = fixture();
    const { raw: next, personId } = growParent(raw, {
      childId: 'OutKid',
      adoptive: false,
      existingId: null,
      parent: fields({ gender: 'male', birthFamilyId: 'famC' }),
    });
    expect(validateData(next).errors).toEqual([]);
    const union = next.unions.find(u => u.id === 'u_solo')!;
    expect(union.partners).toEqual(['SoloMum', personId]);
  });

  it('refuses a third biological parent', () => {
    const raw = fixture();
    expect(() =>
      growParent(raw, {
        childId: 'Son',
        adoptive: false,
        existingId: null,
        parent: fields(),
      }),
    ).toThrow(/already has two/);
  });

  it('adds a spouse and completes a single-parent union with existing children', () => {
    // SoloMum has a 1-partner union u_solo → OutKid. Marry her to a new husband and
    // mark OutKid as his child too: the solo union should be completed in place.
    const raw = fixture();
    const before = raw.unions.length;
    const { raw: next, personId, unionId } = growSpouse(raw, {
      anchorId: 'SoloMum',
      existingId: null,
      spouse: fields({ gender: 'male', birthFamilyId: 'famC' }),
      status: 'married',
      familyId: 'famC',
      childIds: ['OutKid'],
    });
    expect(validateData(next).errors).toEqual([]);
    expect(unionId).toBe('u_solo'); // completed in place, not duplicated
    expect(next.unions.length).toBe(before); // no new union created
    const u = next.unions.find(u => u.id === 'u_solo')!;
    expect(u.partners).toEqual(['SoloMum', personId]);
    expect(u.children).toContain('OutKid');
    // OutKid now has two biological parents
    const ds = buildDataset(next);
    expect(ds.parentsOf.get('OutKid')!.map(p => p.id).sort()).toEqual(['SoloMum', personId].sort());
  });
});

describe('mergePerson (same-person reconciliation)', () => {
  it('fuses a duplicate empty marriage back into the real one (the Shantaben case)', () => {
    // Dad ⚭ Mom (Son, Dau). A duplicate "Mom2" was married to Dad in an empty union —
    // exactly the artifact that delete+reconnect leaves behind. Merging Mom2 into Mom
    // must collapse the two marriages into one, keeping the children.
    const raw = fixture();
    raw.people.push({
      id: 'Mom2', firstName: 'Mom', lastName: 'B', gender: 'female',
      alive: true, birthFamilyId: 'famB', updatedAt: '2026-01-02T00:00:00.000Z',
    });
    raw.unions.push({
      id: 'u_dad_mom2', partners: ['Dad', 'Mom2'], children: [], adoptedChildren: [],
      familyId: 'famA', status: 'married', updatedAt: '2026-01-02T00:00:00.000Z',
    });

    const next = mergePerson(raw, 'Mom', 'Mom2');
    expect(validateData(next).errors).toEqual([]);
    const marriages = next.unions.filter(
      u => u.partners.length === 2 && u.partners.includes('Dad') && u.partners.includes('Mom'),
    );
    expect(marriages.length).toBe(1); // fused, not two
    expect(marriages[0].children.slice().sort()).toEqual(['Dau', 'Son']);
    expect(next.people.some(p => p.id === 'Mom2')).toBe(false);
    // Children still resolve to both real parents.
    const ds = buildDataset(next);
    for (const k of ['Son', 'Dau'])
      expect(ds.parentsOf.get(k)!.map(p => p.id).sort()).toEqual(['Dad', 'Mom']);
  });

  it('folds an absorbed stub’s marriage and children onto the kept person', () => {
    // SoloMum has a 1-partner union → OutKid (+adopted AdoptedKid). Merge her into
    // Hermit (no relations, unknown lineage): Hermit inherits the union and children,
    // and picks up her family only because his own was blank.
    const next = mergePerson(fixture(), 'Hermit', 'SoloMum');
    expect(validateData(next).errors).toEqual([]);
    expect(next.people.some(p => p.id === 'SoloMum')).toBe(false);
    expect(next.people.find(p => p.id === 'Hermit')!.birthFamilyId).toBe('famC'); // blank filled
    const ds = buildDataset(next);
    expect(ds.childrenOf.get('Hermit')!.map(c => c.id)).toContain('OutKid');
  });

  it('blocks when both people already have (different) biological parents', () => {
    // Son is a bio child of u_dad_mom; HalfSis of u_dad_ex — merging would give one
    // person two sets of biological parents, which validate.ts forbids.
    expect(mergeBlockReason(fixture(), 'Son', 'HalfSis')).toMatch(/biological/);
    expect(() => mergePerson(fixture(), 'Son', 'HalfSis')).toThrow(/biological/);
  });

  it('refuses to merge a person with themselves', () => {
    expect(mergeBlockReason(fixture(), 'Dad', 'Dad')).toMatch(/two different/);
    expect(() => mergePerson(fixture(), 'Dad', 'Dad')).toThrow(/two different/);
  });

  it('just deletes the record when the absorbed person has no relations', () => {
    const next = mergePerson(fixture(), 'Ex', 'Hermit');
    expect(validateData(next).errors).toEqual([]);
    expect(next.people.some(p => p.id === 'Hermit')).toBe(false);
    // Ex is untouched relationally.
    expect(next.unions.find(u => u.id === 'u_dad_ex')!.partners).toEqual(['Dad', 'Ex']);
  });
});

describe('moveChildInUnion (birth order)', () => {
  it('swaps a child with its neighbour, clamping at the ends', () => {
    const raw = fixture(); // u_dad_mom children: ['Son', 'Dau']
    const down = moveChildInUnion(raw, 'u_dad_mom', 'Son', 1);
    expect(down.unions.find(u => u.id === 'u_dad_mom')!.children).toEqual(['Dau', 'Son']);
    // moving the first child earlier is a no-op
    const up = moveChildInUnion(raw, 'u_dad_mom', 'Son', -1);
    expect(up.unions.find(u => u.id === 'u_dad_mom')!.children).toEqual(['Son', 'Dau']);
  });
});

describe('deletePerson', () => {
  it('removes the person and every reference to them', () => {
    const raw = fixture();
    const next = deletePerson(raw, 'Ex');
    expect(validateData(next).errors).toEqual([]);
    expect(next.people.some(p => p.id === 'Ex')).toBe(false);
    // u_dad_ex kept (still has child HalfSis) but Ex removed as a partner
    const u = next.unions.find(u => u.id === 'u_dad_ex')!;
    expect(u.partners).toEqual(['Dad']);
    expect(u.children).toContain('HalfSis');
  });

  it('drops a union left with a lone partner and no children', () => {
    // Marry Dau to a new husband (childless 2-partner union), then delete him.
    const grown = growSpouse(fixture(), {
      anchorId: 'Dau',
      existingId: null,
      spouse: fields({ gender: 'male', birthFamilyId: 'famC' }),
      status: 'married',
      familyId: 'famC',
    });
    const husbandUnions = grown.raw.unions.length;
    const next = deletePerson(grown.raw, grown.personId);
    expect(validateData(next).errors).toEqual([]);
    expect(next.people.some(p => p.id === grown.personId)).toBe(false);
    expect(next.unions.length).toBe(husbandUnions - 1); // childless union removed
  });
});
