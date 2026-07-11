import { describe, expect, it } from 'vitest';
import { buildDataset } from '../dataset';
import { deletePerson, growChild, growParent, growSpouse } from '../mutate';
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
