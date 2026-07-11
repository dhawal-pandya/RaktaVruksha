import { describe, expect, it } from 'vitest';
import { buildDataset } from '../dataset';
import { growChild, growParent, growSpouse } from '../mutate';
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
});
