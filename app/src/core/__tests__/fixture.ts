import type { FamilyDataV2, PersonRecord, UnionRecord } from '../types';

const T0 = '2026-01-01T00:00:00.000Z';

const p = (
  id: string,
  gender: 'male' | 'female',
  birthFamilyId: string | null,
  over: Partial<PersonRecord> = {},
): PersonRecord => ({
  id,
  firstName: id,
  lastName: birthFamilyId ? birthFamilyId.replace('family', '') : 'X',
  gender,
  alive: true,
  birthFamilyId,
  updatedAt: T0,
  ...over,
});

const u = (
  id: string,
  partners: string[],
  children: string[],
  familyId: string | null,
  over: Partial<UnionRecord> = {},
): UnionRecord => ({
  id,
  partners,
  children,
  adoptedChildren: [],
  familyId,
  status: 'married',
  updatedAt: T0,
  ...over,
});

/**
 * Test family covering every hard case:
 *
 *   gen 0:  GpaA ⚭ GmaA (famA)          GpaB ⚭ GmaB (famB)
 *   gen 1:  Dad(A) ⚭ Mom(born B, married into A) → Son, Dau
 *           Dad ⚮ Ex(born C) [divorced, order 2... order 1 actually first]
 *              → HalfSis (famA)
 *           UncleB (B): Mom's brother
 *           SoloMum (C): 1-partner union → OutKid
 *           Dad&Mom also ADOPTED AdoptedKid (biological child of SoloMum's union)
 *   gen 2:  Son ⚯ (partners, never married) Girlfriend(C) → LoveChild
 *   isolated: Hermit (no relations)
 */
export const fixture = (): FamilyDataV2 => ({
  meta: { schemaVersion: 2, exportedAt: T0 },
  families: {
    famA: { name: 'A', color: '#e74c3c' },
    famB: { name: 'B', color: '#3498db' },
    famC: { name: 'C', color: '#2ecc71' },
  },
  people: [
    p('GpaA', 'male', 'famA'),
    p('GmaA', 'female', 'famB'),
    p('GpaB', 'male', 'famB'),
    p('GmaB', 'female', 'famC'),
    p('Dad', 'male', 'famA'),
    p('Mom', 'female', 'famB'),
    p('Ex', 'female', 'famC'),
    p('UncleB', 'male', 'famB'),
    p('Son', 'male', 'famA'),
    p('Dau', 'female', 'famA'),
    p('HalfSis', 'female', 'famA'),
    p('SoloMum', 'female', 'famC'),
    p('OutKid', 'male', 'famC'),
    p('Girlfriend', 'female', 'famC'),
    p('LoveChild', 'female', 'famA'),
    p('AdoptedKid', 'male', 'famC'),
    p('Hermit', 'male', null),
  ],
  unions: [
    u('u_gpaA', ['GpaA', 'GmaA'], ['Dad'], 'famA'),
    u('u_gpaB', ['GpaB', 'GmaB'], ['Mom', 'UncleB'], 'famB'),
    // Dad's first marriage, divorced, one child.
    u('u_dad_ex', ['Dad', 'Ex'], ['HalfSis'], 'famA', { status: 'divorced', order: 1 }),
    // Dad's second marriage; also adopted AdoptedKid.
    u('u_dad_mom', ['Dad', 'Mom'], ['Son', 'Dau'], 'famA', {
      order: 2,
      adoptedChildren: ['AdoptedKid'],
    }),
    // Partner unknown: 1-partner union.
    u('u_solo', ['SoloMum'], ['OutKid', 'AdoptedKid'], 'famC', { status: 'unknown' }),
    // Out of wedlock: both parents known, never married.
    u('u_love', ['Son', 'Girlfriend'], ['LoveChild'], 'famA', { status: 'partners' }),
  ],
});
