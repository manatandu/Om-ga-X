import { BadRequestException, ConflictException } from '@nestjs/common';
import {
  deroulerArbre,
  formeUnCycle,
  motifRefusRattachement,
  motifRefusSuppressionUnite,
  motifRefusUnite,
  rattachementALaDate,
} from './organigramme';
import { OrganigrammeService } from './organigramme.service';

/**
 * LIGNE PAIE-SUITE · DÉPARTEMENTS ET DIRECTIONS. Ce qui casserait en silence ·
 * une boucle dans l'arbre (l'écran ne le déroulerait plus), une mutation qui
 * efface l'historique, une unité présumée avant le premier rattachement, une
 * unité supprimée alors que l'historique la nomme, une unité en sommeil qui
 * reçoit encore des salariés.
 */
const d = (s: string) => new Date(`${s}T00:00:00.000Z`);

describe("l'organigramme · règles", () => {
  it('le code, l’intitulé et le niveau sont bornés · le niveau est libre', () => {
    expect(motifRefusUnite({ code: 'DAF', intitule: 'Direction administrative et financière', niveau: 'Direction' })).toBeNull();
    expect(motifRefusUnite({ code: 'DAF', intitule: 'Direction', niveau: null })).toBeNull();
    expect(motifRefusUnite({ code: '', intitule: 'x' })).toMatch(/code/);
    expect(motifRefusUnite({ code: 'D A F', intitule: 'x' })).toMatch(/sans espace/);
    expect(motifRefusUnite({ code: 'DAF', intitule: ' ' })).toMatch(/intitulé/);
    expect(motifRefusUnite({ code: 'DAF', intitule: 'x', niveau: 'n'.repeat(41) })).toMatch(/niveau/);
  });

  it("une unité ne se range pas sous l'une de ses filles, ni sous elle-même", () => {
    const parents = new Map<string, string | null>([
      ['dg', null],
      ['daf', 'dg'],
      ['compta', 'daf'],
    ]);
    expect(formeUnCycle('daf', 'compta', parents)).toBe(true);
    expect(formeUnCycle('daf', 'daf', parents)).toBe(true);
    expect(formeUnCycle('compta', 'dg', parents)).toBe(false);
    expect(formeUnCycle('daf', null, parents)).toBe(false);
    // Une boucle déjà en base ne fait pas tourner la remontée sans fin.
    expect(formeUnCycle('x', 'a', new Map([['a', 'b'], ['b', 'a'], ['x', null]]))).toBe(true);
  });

  it("l'arbre se déroule parente avant filles, sœurs par code · une orpheline est dite", () => {
    const arbre = deroulerArbre([
      { id: 'compta', code: 'COMPTA', parentId: 'daf' },
      { id: 'dg', code: 'DG', parentId: null },
      { id: 'daf', code: 'DAF', parentId: 'dg' },
      { id: 'drh', code: 'DRH', parentId: 'dg' },
      { id: 'perdue', code: 'X', parentId: 'absente' },
    ]);
    expect(arbre.map((u) => [u.code, u.profondeur])).toEqual([
      ['DG', 0],
      ['DAF', 1],
      ['COMPTA', 2],
      ['DRH', 1],
      ['X', 0],
    ]);
    expect(arbre.find((u) => u.code === 'COMPTA')?.chemin).toEqual(['DG', 'DAF', 'COMPTA']);
    expect(arbre.find((u) => u.code === 'X')?.orpheline).toBe(true);
    // Une boucle en base est rendue, jamais tue.
    expect(deroulerArbre([{ id: 'a', code: 'A', parentId: 'b' }, { id: 'b', code: 'B', parentId: 'a' }])).toHaveLength(2);
  });

  it("l'unité à une date · le dernier rattachement non annulé au plus tard ce jour ; aucune avant le premier", () => {
    const r = [
      { id: '1', uniteId: 'daf', dateEffet: d('2026-01-01'), annuleLe: null },
      { id: '2', uniteId: 'drh', dateEffet: d('2026-07-01'), annuleLe: null },
      { id: '3', uniteId: 'dg', dateEffet: d('2026-09-01'), annuleLe: d('2026-09-02') },
    ];
    expect(rattachementALaDate(r, d('2025-12-31'))).toBeNull();
    expect(rattachementALaDate(r, d('2026-06-30'))?.uniteId).toBe('daf');
    expect(rattachementALaDate(r, d('2026-07-01'))?.uniteId).toBe('drh');
    // L'annulé ne compte plus · la mutation de septembre n'a jamais eu lieu.
    expect(rattachementALaDate(r, d('2026-10-01'))?.uniteId).toBe('drh');
  });

  it('refuse une unité en sommeil, deux rattachements à la même date, un rattachement qui ne change rien', () => {
    const existants = [{ id: '1', uniteId: 'daf', dateEffet: d('2026-01-01'), annuleLe: null }];
    expect(motifRefusRattachement({ code: 'DAF', estActive: false }, d('2026-03-01'), [], 'daf')).toMatch(/sommeil/);
    expect(motifRefusRattachement({ code: 'DRH', estActive: true }, d('2026-01-01'), existants, 'drh')).toMatch(/même date/);
    expect(motifRefusRattachement({ code: 'DAF', estActive: true }, d('2026-03-01'), existants, 'daf')).toMatch(/n'ajouterait rien/);
    expect(motifRefusRattachement({ code: 'DRH', estActive: true }, d('2026-03-01'), existants, 'drh')).toBeNull();
    // Une saisie annulée libère sa date.
    expect(motifRefusRattachement({ code: 'DRH', estActive: true }, d('2026-01-01'), [{ ...existants[0], annuleLe: new Date() }], 'drh')).toBeNull();
  });

  it("une unité qui porte un rattachement, même annulé, ou des filles, ne se supprime pas", () => {
    expect(motifRefusSuppressionUnite({ code: 'DAF', rattachements: 1, enfants: 0 })).toMatch(/sommeil/);
    expect(motifRefusSuppressionUnite({ code: 'DAF', rattachements: 0, enfants: 2 })).toMatch(/2 unité/);
    expect(motifRefusSuppressionUnite({ code: 'DAF', rattachements: 0, enfants: 0 })).toBeNull();
  });
});

describe("l'organigramme · le service", () => {
  const monter = (unites: { id: string; parentId: string | null; code: string; estActive: boolean }[], extra: Record<string, unknown> = {}) => {
    const prisma = {
      uniteOrganisation: {
        findMany: jest.fn(async () => unites),
        findFirst: jest.fn(async ({ where }: { where: { id: string; tenantId: string } }) => (where.tenantId === 't' ? unites.find((u) => u.id === where.id) ?? null : null)),
        create: jest.fn(async ({ data }: { data: unknown }) => data),
        update: jest.fn(async ({ data }: { data: unknown }) => data),
      },
      ...extra,
    };
    return { svc: new OrganigrammeService(prisma as never), prisma };
  };
  const unites = [
    { id: '11111111-1111-4111-8111-111111111111', parentId: null, code: 'DG', estActive: true, intitule: 'Direction générale', niveau: null },
    { id: '22222222-2222-4222-8222-222222222222', parentId: '11111111-1111-4111-8111-111111111111', code: 'DAF', estActive: true, intitule: 'DAF', niveau: null },
  ];

  it("refuse de ranger une unité sous sa fille · rien n'est écrit", async () => {
    const { svc, prisma } = monter(unites);
    await expect(svc.modifier('t', unites[0].id, { parentId: unites[1].id })).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.uniteOrganisation.update).not.toHaveBeenCalled();
  });

  it("une parente d'un autre dossier n'existe pas", async () => {
    const { svc } = monter(unites);
    await expect(svc.creer('t', 'x@y', { code: 'NEW', intitule: 'Nouvelle', parentId: '33333333-3333-4333-8333-333333333333' })).rejects.toThrow(/parente introuvable/);
  });

  it('le code se range en majuscules, un doublon dit son code', async () => {
    const { svc, prisma } = monter(unites);
    await svc.creer('t', 'x@y', { code: 'compta', intitule: 'Comptabilité', niveau: 'Service', parentId: unites[1].id });
    expect(prisma.uniteOrganisation.create.mock.calls[0][0].data).toMatchObject({ code: 'COMPTA', niveau: 'Service', parentId: unites[1].id, tenantId: 't' });
  });

  it('une unité qui porte un rattachement se met en sommeil, elle ne se supprime pas', async () => {
    const { svc } = monter(unites, {});
    (svc as unknown as { prisma: { uniteOrganisation: { findFirst: jest.Mock } } }).prisma.uniteOrganisation.findFirst = jest.fn(async () => ({
      id: 'u',
      code: 'DAF',
      _count: { rattachements: 3, enfants: 0 },
    }));
    await expect(svc.supprimer('t', 'u')).rejects.toBeInstanceOf(ConflictException);
  });
});
