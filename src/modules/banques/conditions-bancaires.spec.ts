import 'reflect-metadata';
import { ConflictException } from '@nestjs/common';
import { Referentiel } from '@prisma/client';
import {
  MOTIF_SANS_HORS_BILAN_SYCEBNL,
  conditionsEnVigueur,
  inscriptionHorsBilan,
  motifRefusAutorisation,
  motifRefusConditions,
  motifRefusUnion,
  positionUnion,
  situationAutorisation,
  type ConditionsSaisies,
} from './conditions-bancaires';
import { ConditionsBancairesService, motifRibRetenu } from './conditions-bancaires.service';
import { BanquesService } from './banques.service';
import { PLAN_COMPTES_SYSCOHADA } from '../comptes/compte-seed-syscohada';
import { PLAN_COMPTES_SYCEBNL } from '../comptes/compte-seed';
import type { PrismaService } from '../../common/prisma.service';

/**
 * CONDITIONS BANCAIRES, AUTORISATIONS, UNIONS (ligne sage-l3, fonction 46 ·
 * décision D15). Ce qui casserait en silence · une déclaration sans sa
 * convention, des paliers qui se recouvrent, un découvert utilisé lu comme
 * nul, un hors-bilan proposé au SYCEBNL (dont la classe 9 porte autre chose),
 * une union qui additionne des francs et des dollars, une position partielle
 * servie comme entière, un RIB retiré qui emporterait ses déclarations.
 */

const BASE: ConditionsSaisies = { dateEffet: '2026-01-01', referenceConvention: 'CONV-RAW-2026', dateConvention: '2025-12-15' };

describe('Conditions bancaires · la convention est recopiée, jamais présumée', () => {
  it('exige la référence et la date de la convention', () => {
    expect(motifRefusConditions({ ...BASE, referenceConvention: '  ' })).toMatch(/référence de la convention/);
    expect(motifRefusConditions({ ...BASE, dateConvention: '2025-02-31' })).toMatch(/date de la convention/);
    expect(motifRefusConditions(BASE)).toBeNull();
  });

  it('les paliers montent strictement, trois au plus, et disent leur type', () => {
    const paliers = [
      { plafond: 1_000_000, taux: 12 },
      { plafond: 5_000_000, taux: 15 },
    ];
    expect(motifRefusConditions({ ...BASE, paliers })).toMatch(/par intervalle ou par seuil/);
    expect(motifRefusConditions({ ...BASE, typePalier: 'SEUIL', paliers })).toBeNull();
    expect(motifRefusConditions({ ...BASE, typePalier: 'SEUIL', paliers: [paliers[1], paliers[0]] })).toMatch(/montent strictement/);
    expect(motifRefusConditions({ ...BASE, typePalier: 'SEUIL', paliers: [...paliers, { plafond: 6e6, taux: 16 }, { plafond: 7e6, taux: 17 }] })).toMatch(/3 paliers au plus/);
    expect(motifRefusConditions({ ...BASE, typePalier: 'INTERVALLE' })).toMatch(/type de palier sans palier/);
  });

  it('taux de 0 à 100 à six décimales, frais au centime avec leur périodicité, base de 360 ou 365 jours', () => {
    expect(motifRefusConditions({ ...BASE, tauxInteretsCrediteurs: 101 })).toMatch(/de 0 à 100/);
    expect(motifRefusConditions({ ...BASE, tauxCommissionMouvement: 0.1234567 })).toMatch(/six décimales/);
    expect(motifRefusConditions({ ...BASE, fraisTenueCompte: 15_000 })).toMatch(/périodicité/);
    expect(motifRefusConditions({ ...BASE, fraisTenueCompte: 15_000.005, periodiciteFrais: 'MENSUELLE' })).toMatch(/au centime/);
    expect(motifRefusConditions({ ...BASE, periodiciteFrais: 'MENSUELLE' })).toMatch(/sans frais/);
    expect(motifRefusConditions({ ...BASE, baseCalcul: 364 })).toMatch(/360 ou de 365/);
    expect(motifRefusConditions({ ...BASE, fraisTenueCompte: 15_000, periodiciteFrais: 'TRIMESTRIELLE', baseCalcul: 360 })).toBeNull();
  });

  it('la version en vigueur est la plus tardive sans dépasser la date, et aucune avant la première', () => {
    const v = [
      { id: 'a', dateEffet: new Date('2025-01-01T00:00:00Z') },
      { id: 'b', dateEffet: new Date('2026-04-01T00:00:00Z') },
    ];
    expect(conditionsEnVigueur(v, new Date('2026-03-31T00:00:00Z'))?.id).toBe('a');
    expect(conditionsEnVigueur(v, new Date('2026-04-01T00:00:00Z'))?.id).toBe('b');
    expect(conditionsEnVigueur(v, new Date('2024-12-31T00:00:00Z'))).toBeNull();
  });
});

describe("Autorisation de financement · un engagement de la banque, jamais une dette (fiche du compte 56)", () => {
  const A = { nature: 'DECOUVERT' as const, montant: 100_000, dateDebut: '2026-01-01', irrevocable: false, referenceConvention: 'AUT-1', dateConvention: '2025-12-20' };

  it('refuse un montant nul, une fin avant le début, une convention absente', () => {
    expect(motifRefusAutorisation({ ...A, montant: 0 })).toMatch(/strictement positif/);
    expect(motifRefusAutorisation({ ...A, dateFin: '2025-12-31' })).toMatch(/précède sa date de début/);
    expect(motifRefusAutorisation({ ...A, referenceConvention: '' })).toMatch(/convention/);
    expect(motifRefusAutorisation(A)).toBeNull();
  });

  it('le découvert utilisé est le solde CRÉDITEUR du compte · le dépassement se dit, il ne se refuse pas', () => {
    expect(situationAutorisation(A, -150_000)).toEqual({ utilise: 150_000, nonUtilise: 0, depassement: 50_000 });
    expect(situationAutorisation(A, -40_000.5)).toEqual({ utilise: 40_000.5, nonUtilise: 59_999.5, depassement: 0 });
    expect(situationAutorisation(A, 25_000)).toEqual({ utilise: 0, nonUtilise: 100_000, depassement: 0 });
  });

  it("un solde non lu, ou une nature qui ne se lit pas sur le compte bancaire, ne vaut jamais zéro", () => {
    expect(situationAutorisation(A, null)).toEqual({ utilise: null, nonUtilise: null, depassement: null });
    expect(situationAutorisation({ ...A, nature: 'CREDIT_TRESORERIE' }, -150_000)).toEqual({ utilise: null, nonUtilise: null, depassement: null });
  });

  it("le hors-bilan est PROPOSÉ au SYSCOHADA sur des comptes semés, jamais au SYCEBNL", () => {
    const syscohada = new Set(PLAN_COMPTES_SYSCOHADA.map((c) => c.numero));
    const sycebnl = new Set(PLAN_COMPTES_SYCEBNL.map((c) => c.numero));
    const irrevocable = inscriptionHorsBilan(Referentiel.SYSCOHADA, true)!;
    const autre = inscriptionHorsBilan(Referentiel.SYSCOHADA, false)!;
    expect([irrevocable.debit, irrevocable.credit, autre.debit, autre.credit]).toEqual(['90110000', '91110000', '90180000', '91180000']);
    for (const n of [irrevocable.debit, irrevocable.credit, autre.debit, autre.credit]) expect(syscohada.has(n)).toBe(true);
    // Un numéro, deux sens · aucun de ces comptes au plan du SYCEBNL, dont la classe 9 porte les contributions en nature.
    for (const n of [irrevocable.debit, autre.debit]) expect(sycebnl.has(n)).toBe(false);
    expect(inscriptionHorsBilan(Referentiel.SYCEBNL, true)).toBeNull();
    expect(MOTIF_SANS_HORS_BILAN_SYCEBNL).toMatch(/contributions volontaires en nature/);
  });
});

describe("Union de comptes · une vue, sans compensation au bilan (fiche du compte 52)", () => {
  const RIBS = [
    { id: 'r1', abrege: 'RAW-CDF', devise: null },
    { id: 'r2', abrege: 'RAW-CDF2', devise: 'CDF' },
    { id: 'r3', abrege: 'RAW-USD', devise: 'USD' },
  ];

  it('au moins deux comptes du dossier, d’une même monnaie', () => {
    expect(motifRefusUnion({ code: 'U1', intitule: 'Rawbank', ribIds: ['r1'] }, RIBS)).toMatch(/au moins deux/);
    expect(motifRefusUnion({ code: 'U1', intitule: 'Rawbank', ribIds: ['r1', 'r1'] }, RIBS)).toMatch(/au moins deux|deux fois/);
    expect(motifRefusUnion({ code: 'U1', intitule: 'Rawbank', ribIds: ['r1', 'zz'] }, RIBS)).toMatch(/introuvable/);
    expect(motifRefusUnion({ code: 'U1', intitule: 'Rawbank', ribIds: ['r1', 'r3'] }, RIBS)).toMatch(/même monnaie · RAW-CDF \(CDF\), RAW-USD \(USD\)/);
    expect(motifRefusUnion({ code: 'u-1', intitule: 'Rawbank', ribIds: ['r1', 'r2'] }, RIBS)).toMatch(/code de l'union/);
    expect(motifRefusUnion({ code: 'u1', intitule: 'Rawbank', ribIds: ['r1', 'r2'] }, RIBS)).toBeNull();
  });

  it('la position est la somme des soldes, ou rien quand un solde manque', () => {
    expect(positionUnion([{ abrege: 'A', solde: 100.1 }, { abrege: 'B', solde: -40.05 }])).toEqual({ total: 60.05, nonLus: [] });
    expect(positionUnion([{ abrege: 'A', solde: 100 }, { abrege: 'B', solde: null }])).toEqual({ total: null, nonLus: ['B'] });
  });
});

describe('Un RIB qui porte ses déclarations ne se retire pas en silence', () => {
  const compteur = (n: number) => ({ count: jest.fn(async () => n) });

  it('motifRibRetenu nomme chaque usage', async () => {
    const prisma = { conditionBancaire: compteur(2), autorisationFinancement: compteur(0), elementUnionComptesBancaires: compteur(1) } as unknown as PrismaService;
    expect(await motifRibRetenu(prisma, 't1', ['r1'])).toBe(
      "Le RIB porte 2 version(s) de conditions bancaires, 1 appartenance(s) à une union de comptes · retirez-les d'abord (Structure › Paramètres de saisie › Banques).",
    );
    const vide = { conditionBancaire: compteur(0), autorisationFinancement: compteur(0), elementUnionComptesBancaires: compteur(0) } as unknown as PrismaService;
    expect(await motifRibRetenu(vide, 't1', ['r1'])).toBeNull();
  });

  it('BanquesService.supprimerRib refuse en 409 avant la base', async () => {
    const supprime = jest.fn();
    const prisma = {
      ribBanque: { findFirst: jest.fn(async () => ({ id: 'r1', tenantId: 't1' })), delete: supprime },
      conditionBancaire: compteur(1),
      autorisationFinancement: compteur(0),
      elementUnionComptesBancaires: compteur(0),
    } as unknown as PrismaService;
    await expect(new BanquesService(prisma).supprimerRib('t1', 'r1')).rejects.toBeInstanceOf(ConflictException);
    expect(supprime).not.toHaveBeenCalled();
  });
});

describe('Le solde du compte d’un RIB · lu, ou dit non lu', () => {
  it('un RIB sans journal ou en devise n’a pas de solde, jamais un zéro', async () => {
    const service = new ConditionsBancairesService({} as PrismaService);
    expect(await service.soldeDuRib('t1', { devise: null, journal: null }, new Date())).toEqual({ solde: null, motif: expect.stringMatching(/sans journal/) });
    expect(await service.soldeDuRib('t1', { devise: 'USD', journal: { compteTresorerieId: 'c1' } }, new Date())).toEqual({ solde: null, motif: expect.stringMatching(/USD/) });
  });

  it("remonte l'exercice précédent non clôturé quand l'ouverture ne porte pas le compte", async () => {
    const N = { id: 'n', dateDebut: new Date('2027-01-01T00:00:00Z') };
    const N1 = { id: 'n1', dateDebut: new Date('2026-01-01T00:00:00Z'), dateFin: new Date('2026-12-31T00:00:00Z'), statut: 'OUVERT' };
    const aggregate = jest.fn(async ({ where }: { where: { ecriture: { exerciceId: string } } }) =>
      where.ecriture.exerciceId === 'n' ? { _sum: { debit: 0, credit: 30_000 } } : { _sum: { debit: 100_000, credit: 250_000 } },
    );
    const prisma = {
      exercice: {
        // Le précédent de N est N1, et N1 n'en a aucun · la doublure honore la borne `lt`.
        findFirst: jest.fn(async ({ where }: { where: { dateFin?: { lt?: Date } } }) =>
          where.dateFin?.lt === undefined ? N : where.dateFin.lt.getTime() > N1.dateFin.getTime() ? N1 : null,
        ),
      },
      ecriture: { count: jest.fn(async () => 0) },
      ligneEcriture: { aggregate },
    } as unknown as PrismaService;
    const lu = await new ConditionsBancairesService(prisma).soldeDuRib('t1', { devise: null, journal: { compteTresorerieId: 'c1' } }, new Date('2027-01-10T00:00:00Z'));
    expect(lu).toEqual({ solde: -180_000, motif: null });
  });
});
