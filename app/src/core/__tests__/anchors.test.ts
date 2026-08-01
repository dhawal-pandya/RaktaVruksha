import { describe, expect, it } from 'vitest';
import { computeGenerations } from '../generations';
import { validateData } from '../validate';
import { fixture } from './fixture';
import type { FamilyDataV2, PersonRecord } from '../types';

/**
 * Relative anchors: `genAnchor: { relativeTo, offset }`.
 *
 * The property that matters is that they DON'T GO STALE. An absolute anchor is a
 * row someone measured once; deepen the tree above it and it silently means the
 * wrong thing until a script rewrites it by hand. A relative anchor is resolved
 * against wherever its target actually landed, every run, so the same stored
 * value keeps meaning "beside that person" no matter what moves above it.
 */

const T0 = '2026-01-01T00:00:00.000Z';

/** The fixture plus a floating outsider anchored beside someone in the main tree. */
const withAnchoredOutsider = (
  anchor: PersonRecord['genAnchor'],
  extra: PersonRecord[] = [],
): FamilyDataV2 => {
  const data = fixture();
  data.people.push({
    id: 'Outsider',
    firstName: 'Outsider',
    lastName: 'X',
    gender: 'male',
    alive: true,
    birthFamilyId: null,
    updatedAt: T0,
    genAnchor: anchor,
  });
  data.people.push(...extra);
  return data;
};

const rowsOf = (data: FamilyDataV2) => computeGenerations(data.people, data.unions).gen;

describe('relative generation anchors', () => {
  it('places the anchored person at target + offset', () => {
    const gen = rowsOf(withAnchoredOutsider({ relativeTo: 'Dad', offset: 0 }));
    expect(gen.get('Outsider')).toBe(gen.get('Dad'));
  });

  it('honours a negative offset as "rows above the target"', () => {
    const gen = rowsOf(withAnchoredOutsider({ relativeTo: 'Son', offset: -1 }));
    expect(gen.get('Outsider')).toBe(gen.get('Son')! - 1);
  });

  it('tracks its target when the tree deepens above it, where an absolute anchor would not', () => {
    // Baseline: Son sits at row 2, so both anchors mean the same thing today.
    const before = rowsOf(withAnchoredOutsider({ relativeTo: 'Son', offset: 0 }));
    expect(before.get('Outsider')).toBe(before.get('Son'));
    const sonBefore = before.get('Son')!;

    // Now deepen the trunk: give GpaA a parent, pushing every descendant down a row.
    const deepen = (data: FamilyDataV2): FamilyDataV2 => {
      data.people.push({
        id: 'GreatGpa',
        firstName: 'GreatGpa',
        lastName: 'A',
        gender: 'male',
        alive: true,
        birthFamilyId: 'famA',
        updatedAt: T0,
      });
      data.unions.push({
        id: 'u_great',
        partners: ['GreatGpa'],
        children: ['GpaA'],
        adoptedChildren: [],
        familyId: 'famA',
        status: 'married',
        updatedAt: T0,
      });
      return data;
    };

    const relative = rowsOf(deepen(withAnchoredOutsider({ relativeTo: 'Son', offset: 0 })));
    const absolute = rowsOf(deepen(withAnchoredOutsider(sonBefore)));

    // Son really did move.
    expect(relative.get('Son')).toBe(sonBefore + 1);

    // The relative anchor followed him; the absolute one stayed on the old row.
    expect(relative.get('Outsider')).toBe(relative.get('Son'));
    expect(absolute.get('Outsider')).toBe(sonBefore);
    expect(absolute.get('Outsider')).not.toBe(absolute.get('Son'));
  });

  it('is a floor, so a deeper natural row wins over a shallower anchor', () => {
    // LoveChild's own ancestry puts them at row 3; anchoring to row-0 GpaA must not lift them.
    const data = fixture();
    data.people.find(p => p.id === 'LoveChild')!.genAnchor = { relativeTo: 'GpaA', offset: 0 };
    const gen = rowsOf(data);
    expect(gen.get('LoveChild')).toBe(3);
  });

  it("carries the anchored person's own descendants down with it", () => {
    const child: PersonRecord = {
      id: 'OutsiderKid',
      firstName: 'OutsiderKid',
      lastName: 'X',
      gender: 'male',
      alive: true,
      birthFamilyId: null,
      updatedAt: T0,
    };
    const data = withAnchoredOutsider({ relativeTo: 'Son', offset: 0 }, [child]);
    data.unions.push({
      id: 'u_outsider',
      partners: ['Outsider'],
      children: ['OutsiderKid'],
      adoptedChildren: [],
      familyId: null,
      status: 'married',
      updatedAt: T0,
    });
    const gen = rowsOf(data);
    expect(gen.get('OutsiderKid')).toBe(gen.get('Outsider')! + 1);
  });

  it('does not bottom-align a component that a relative anchor points into', () => {
    // Anchoring INTO the main tree must not let the main tree drift out from under it.
    const gen = rowsOf(withAnchoredOutsider({ relativeTo: 'Dad', offset: 2 }));
    expect(gen.get('Outsider')).toBe(gen.get('Dad')! + 2);
  });

  it('still supports plain absolute anchors', () => {
    const gen = rowsOf(withAnchoredOutsider(9));
    expect(gen.get('Outsider')).toBe(9);
  });
});

describe('relative anchor validation', () => {
  const validate = (anchor: PersonRecord['genAnchor']) =>
    validateData(withAnchoredOutsider(anchor)).errors;

  it('rejects a target that does not exist', () => {
    expect(validate({ relativeTo: 'NoSuchPerson', offset: 0 }).join()).toMatch(/names no one/);
  });

  it('rejects a self-reference', () => {
    expect(validate({ relativeTo: 'Outsider', offset: 0 }).join()).toMatch(/points at itself/);
  });

  it('rejects a cycle between two anchors', () => {
    const data = fixture();
    for (const [id, to] of [['A1', 'A2'], ['A2', 'A1']] as const) {
      data.people.push({
        id,
        firstName: id,
        lastName: 'X',
        gender: 'male',
        alive: true,
        birthFamilyId: null,
        updatedAt: T0,
        genAnchor: { relativeTo: to, offset: 1 },
      });
    }
    expect(validateData(data).errors.join()).toMatch(/cycle/);
  });

  it('accepts a valid chain of relative anchors', () => {
    const data = withAnchoredOutsider({ relativeTo: 'Dad', offset: 1 });
    data.people.push({
      id: 'Second',
      firstName: 'Second',
      lastName: 'X',
      gender: 'male',
      alive: true,
      birthFamilyId: null,
      updatedAt: T0,
      genAnchor: { relativeTo: 'Outsider', offset: 1 },
    });
    expect(validateData(data).errors).toEqual([]);
    const gen = rowsOf(data);
    expect(gen.get('Second')).toBe(gen.get('Dad')! + 2);
  });
});
