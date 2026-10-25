import 'reflect-metadata';
import { ConflictException } from '@nestjs/common';
import { Referentiel } from '@prisma/client';
import {
  MONTANT_MAX,
  MOTIF_SANS_HORS_BILAN_SYCEBNL,
  conditionsEnVigueur,
  motifFormeUnion,
  inscriptionHorsBilan,
  motifRefusAutorisation,
  motifRefusConditions,
  motifRefusUnion,
  positionUnion,
  situationAutorisation,
  situationSurLeTotal,
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

  it('une forme illisible est refusée par son nom, jamais en erreur 500 ni lue de travers (premier tour, M2, M4, m1)', () => {
    const c = (x: unknown) => motifRefusConditions({ ...BASE, ...(x as object) } as ConditionsSaisies);
    expect(c({ typePalier: 'FOO', paliers: [{ plafond: 1, taux: 1 }] })).toMatch(/par intervalle ou par seuil/);
    expect(c({ typePalier: 'SEUIL', paliers: 'abcd' })).toMatch(/une liste de plafonds et de taux/);
    expect(c({ typePalier: 'SEUIL', paliers: {} })).toMatch(/une liste de plafonds et de taux/);
    expect(c({ typePalier: 'SEUIL', paliers: [null] })).toMatch(/une liste de plafonds et de taux/);
    // Un plafond absent se nomme, jamais « les plafonds montent strictement ».
    expect(c({ typePalier: 'SEUIL', paliers: [{ plafond: null, taux: 12 }] })).toBe('Palier 1 · le plafond est exigé.');
    expect(c({ typePalier: 'SEUIL', paliers: [{ plafond: 1_000, taux: null }] })).toBe('Palier 1 · le taux est exigé.');
    expect(c({ fraisTenueCompte: 1e17, periodiciteFrais: 'MENSUELLE' })).toMatch(/plus grand montant/);
    // 1e16 a dix-sept chiffres · `Decimal(18,2)` n'en tient que seize (second tour, m2).
    expect(c({ fraisTenueCompte: MONTANT_MAX, periodiciteFrais: 'MENSUELLE' })).toMatch(/plus grand montant/);
    // Au centime en décimal exact · un montant juste au-delà de cent mille milliards passe.
    expect(c({ fraisTenueCompte: 123_456_789_012_345.67, periodiciteFrais: 'MENSUELLE' })).toBeNull();
    expect(c({ fraisTenueCompte: 0.125, periodiciteFrais: 'MENSUELLE' })).toMatch(/au centime/);
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

  it('un montant illisible ou démesuré se nomme (premier tour, m1, m3)', () => {
    expect(motifRefusAutorisation({ ...A, montant: null as unknown as number })).toMatch(/exigé, en chiffres/);
    expect(motifRefusAutorisation({ ...A, montant: 1e17 })).toMatch(/plus grand montant/);
  });

  it("plusieurs autorisations sur le même solde se lisent sur leur TOTAL, jamais chacune contre le solde entier (premier tour, M4)", () => {
    // Découvert de 1 000 000 et facilité de 500 000, compte créditeur de 1 200 000 · aucun dépassement, 300 000 non utilisés.
    expect(situationSurLeTotal([1_000_000, 500_000], -1_200_000)).toEqual({ autorise: 1_500_000, utilise: 1_200_000, nonUtilise: 300_000, depassement: 0 });
    // Confrontées une à une, elles auraient rendu deux dépassements fabriqués.
    expect(situationAutorisation({ ...A, montant: 1_000_000 }, -1_200_000).depassement).toBe(200_000);
    expect(situationSurLeTotal([1_000_000, 500_000], null)).toEqual({ autorise: 1_500_000, utilise: null, nonUtilise: null, depassement: null });
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

  it('la forme se juge avant toute requête (premier tour, M3)', () => {
    const u = (ribIds: unknown) => motifFormeUnion({ code: 'U1', intitule: 'Rawbank', ribIds: ribIds as string[] });
    expect(u(5)).toMatch(/une liste de RIB/);
    expect(u({})).toMatch(/une liste de RIB/);
    expect(u('ab')).toMatch(/une liste de RIB/);
    expect(u([1, 2])).toMatch(/une liste de RIB/);
    expect(u([null, 'x'])).toMatch(/une liste de RIB/);
    expect(u(Array.from({ length: 201 }, (_, i) => `r${i}`))).toMatch(/200 comptes au plus/);
    expect(u(['r1', 'r2'])).toBeNull();
  });

  it('un compte en devise que le RIB tait, ou un compte lu deux fois, est refusé (premier tour, M3 et M4)', () => {
    const avec = [
      { id: 'r1', abrege: 'RAW-CDF', devise: null, compteId: 'c1' },
      { id: 'r2', abrege: 'RAW-5215', devise: null, compteId: 'c2', compteEnDevise: true },
      { id: 'r4', abrege: 'RAW-BIS', devise: null, compteId: 'c1' },
    ];
    expect(motifRefusUnion({ code: 'U1', intitule: 'R', ribIds: ['r1', 'r2'] }, avec)).toMatch(/RAW-5215 est tenu en devise/);
    // Un RIB qui DIT « CDF » contredit son compte (second tour, m5).
    expect(motifRefusUnion({ code: 'U1', intitule: 'R', ribIds: ['r1', 'r5'] }, [...avec, { id: 'r5', abrege: 'RAW-DIT', devise: 'CDF', compteId: 'c5', compteEnDevise: true }])).toMatch(/RAW-DIT se dit en francs, et son compte est tenu en devise/);
    expect(motifRefusUnion({ code: 'U1', intitule: 'R', ribIds: ['r1', 'r4'] }, avec)).toMatch(/RAW-CDF et RAW-BIS lisent le même compte/);
  });

  it('la position est la somme des soldes, ou rien quand un solde manque ou qu’un compte est lu deux fois', () => {
    expect(positionUnion([{ abrege: 'A', solde: 100.1 }, { abrege: 'B', solde: -40.05 }])).toEqual({ total: 60.05, nonLus: [], motif: null });
    expect(positionUnion([{ abrege: 'A', solde: 100 }, { abrege: 'B', solde: null }])).toEqual({ total: null, nonLus: ['B'], motif: null });
    const double = positionUnion([{ abrege: 'A', solde: -1_000_000, compteId: 'c1' }, { abrege: 'B', solde: -1_000_000, compteId: 'c1' }]);
    expect(double.total).toBeNull();
    expect(double.motif).toMatch(/même compte comptable/);
  });
});

describe('Un RIB qui porte ses déclarations ne se retire pas en silence', () => {
  const compteur = (n: number) => ({ count: jest.fn(async () => n) });

  it('motifRibRetenu nomme chaque usage', async () => {
    const prisma = { conditionBancaire: compteur(2), autorisationFinancement: compteur(0), elementUnionComptesBancaires: compteur(1), chequier: compteur(0) } as unknown as PrismaService;
    expect(await motifRibRetenu(prisma, 't1', ['r1'])).toBe(
      "Le RIB porte 2 version(s) de conditions bancaires, 1 appartenance(s) à une union de comptes · retirez-les d'abord (Structure › Paramètres de saisie › Conditions bancaires).",
    );
    const vide = { conditionBancaire: compteur(0), autorisationFinancement: compteur(0), elementUnionComptesBancaires: compteur(0), chequier: compteur(0) } as unknown as PrismaService;
    expect(await motifRibRetenu(vide, 't1', ['r1'])).toBeNull();
    // Ligne microfina-m2, idée 9 · un carnet de chèques retient son RIB (les souches font pièce).
    const avecCarnet = { conditionBancaire: compteur(0), autorisationFinancement: compteur(0), elementUnionComptesBancaires: compteur(0), chequier: compteur(1) } as unknown as PrismaService;
    expect(await motifRibRetenu(avecCarnet, 't1', ['r1'])).toMatch(/1 chéquier\(s\)/);
  });

  it('BanquesService.supprimerRib refuse en 409 avant la base', async () => {
    const supprime = jest.fn();
    const prisma = {
      ribBanque: { findFirst: jest.fn(async () => ({ id: 'r1', tenantId: 't1' })), delete: supprime },
      conditionBancaire: compteur(1),
      autorisationFinancement: compteur(0),
      elementUnionComptesBancaires: compteur(0),
      chequier: compteur(0),
    } as unknown as PrismaService;
    await expect(new BanquesService(prisma).supprimerRib('t1', 'r1')).rejects.toBeInstanceOf(ConflictException);
    expect(supprime).not.toHaveBeenCalled();
  });

  it('BanquesService.modifierRib refuse de changer la devise d’un RIB qui porte des déclarations (premier tour, M2)', async () => {
    const maj = jest.fn();
    const prisma = {
      ribBanque: { findFirst: jest.fn(async () => ({ id: 'r1', tenantId: 't1', devise: 'USD', journalId: null })), update: maj },
      conditionBancaire: compteur(0),
      autorisationFinancement: compteur(1),
      elementUnionComptesBancaires: compteur(0),
      chequier: compteur(0),
    } as unknown as PrismaService;
    const service = new BanquesService(prisma);
    await expect(service.modifierRib('t1', 'r1', { devise: '' } as never)).rejects.toThrow(/La devise de ce RIB ne change pas.*1 autorisation/);
    expect(maj).not.toHaveBeenCalled();
  });
});

describe('Le solde du compte d’un RIB · lu, ou dit non lu', () => {
  it('un RIB sans journal, en devise, ou dont le compte est tenu en devise n’a pas de solde, jamais un zéro (premier tour, M3)', async () => {
    const sansLigne = { ligneEcriture: { findFirst: jest.fn(async () => null) } } as unknown as PrismaService;
    const service = new ConditionsBancairesService(sansLigne);
    expect(await service.soldeDuRib('t1', Referentiel.SYSCOHADA, { devise: null, journal: null }, new Date())).toEqual({ solde: null, motif: expect.stringMatching(/sans journal/) });
    expect(await service.soldeDuRib('t1', Referentiel.SYSCOHADA, { devise: 'USD', journal: { compteTresorerieId: 'c1' } }, new Date())).toEqual({ solde: null, motif: expect.stringMatching(/USD/) });
    // Le 5215 est semé « en devises » au SYSCOHADA · la contrevaleur en francs ne se confronte pas à une autorisation en francs.
    const racine = PLAN_COMPTES_SYSCOHADA.find((c) => c.numero === '52150000')!.numero;
    expect(await service.soldeDuRib('t1', Referentiel.SYSCOHADA, { devise: null, journal: { compteTresorerieId: 'c1', compteTresorerie: { numero: racine } } }, new Date())).toEqual({ solde: null, motif: expect.stringMatching(/tenu en devise/) });
    const avecLigne = { ligneEcriture: { findFirst: jest.fn(async () => ({ id: 'l1' })) } } as unknown as PrismaService;
    expect(await new ConditionsBancairesService(avecLigne).soldeDuRib('t1', Referentiel.SYSCOHADA, { devise: null, journal: { compteTresorerieId: 'c1', compteTresorerie: { numero: '52110000' } } }, new Date())).toEqual({ solde: null, motif: expect.stringMatching(/52110000 porte des lignes en devise/) });
  });

  /**
   * La doublure HONORE la requête (CLAUDE.md, passe F4b) · le jour du solde
   * se lit jusqu'au LENDEMAIN exclu, et l'exercice précédent sans borne de
   * date. Une correction horodatée à 14 h le jour lu compte (premier tour,
   * constat M1 de la relecture serveur).
   */
  it("lit le jour en entier, et remonte l'exercice précédent non clôturé quand l'ouverture ne porte pas le compte", async () => {
    const N = { id: 'n', dateDebut: new Date('2027-01-01T00:00:00Z') };
    const N1 = { id: 'n1', dateDebut: new Date('2026-01-01T00:00:00Z'), dateFin: new Date('2026-12-31T00:00:00Z'), statut: 'OUVERT' };
    const lignes = [
      { exerciceId: 'n', date: new Date('2027-01-10T14:00:00Z'), debit: 0, credit: 30_000 },
      { exerciceId: 'n', date: new Date('2027-01-11T00:00:00Z'), debit: 0, credit: 999_000 },
      { exerciceId: 'n1', date: new Date('2026-12-31T16:00:00Z'), debit: 100_000, credit: 250_000 },
    ];
    const aggregate = jest.fn(async ({ where }: { where: { ecriture: { exerciceId: string; date?: { lt: Date } } } }) => {
      const retenues = lignes.filter((l) => l.exerciceId === where.ecriture.exerciceId && (!where.ecriture.date || l.date < where.ecriture.date.lt));
      return { _sum: { debit: retenues.reduce((s, l) => s + l.debit, 0), credit: retenues.reduce((s, l) => s + l.credit, 0) } };
    });
    const prisma = {
      exercice: {
        findFirst: jest.fn(async ({ where }: { where: { dateFin?: { lt?: Date } } }) =>
          where.dateFin?.lt === undefined ? N : where.dateFin.lt.getTime() > N1.dateFin.getTime() ? N1 : null,
        ),
      },
      ecriture: { count: jest.fn(async () => 0) },
      ligneEcriture: { aggregate, findFirst: jest.fn(async () => null) },
    } as unknown as PrismaService;
    const lu = await new ConditionsBancairesService(prisma).soldeDuRib('t1', Referentiel.SYSCOHADA, { devise: null, journal: { compteTresorerieId: 'c1' } }, new Date('2027-01-10T00:00:00Z'));
    expect(lu).toEqual({ solde: -180_000, motif: null });
    const bornes = aggregate.mock.calls.map(([a]) => a.where.ecriture.date?.lt?.toISOString() ?? null);
    expect(bornes).toEqual(['2027-01-11T00:00:00.000Z', null]);
  });

  it("au-delà de la remontée bornée, le solde n'est pas servi plutôt que partiel (premier tour, m9)", async () => {
    let n = 0;
    const prisma = {
      exercice: {
        findFirst: jest.fn(async () => ({ id: `e${n++}`, dateDebut: new Date('2027-01-01T00:00:00Z'), dateFin: new Date('2026-12-31T00:00:00Z'), statut: 'OUVERT' })),
      },
      ecriture: { count: jest.fn(async () => 0) },
      ligneEcriture: { aggregate: jest.fn(async () => ({ _sum: { debit: 0, credit: 0 } })), findFirst: jest.fn(async () => null) },
    } as unknown as PrismaService;
    const lu = await new ConditionsBancairesService(prisma).soldeDuRib('t1', Referentiel.SYSCOHADA, { devise: null, journal: { compteTresorerieId: 'c1' } }, new Date('2027-01-10T00:00:00Z'));
    expect(lu.solde).toBeNull();
    expect(lu.motif).toMatch(/exercices ouverts se suivent/);
  });
});

describe('Les jumeaux et le câblage (second tour)', () => {
  const compteur = (n: number) => ({ count: jest.fn(async () => n) });

  it("JournalService.modifier refuse de repointer le compte d'un journal dont le RIB porte des déclarations (M1)", async () => {
    const { JournalService } = await import('../journaux/journal.service');
    const maj = jest.fn();
    const prisma = {
      journal: { findFirst: jest.fn(async () => ({ id: 'j1', tenantId: 't1', code: 'BQ1', type: 'TRESORERIE', compteTresorerieId: 'c1' })), update: maj },
      ribBanque: { findFirst: jest.fn(async ({ where }: { where: { journalId: string } }) => (where.journalId === 'j1' ? { id: 'r1', abrege: 'RAW' } : null)) },
      conditionBancaire: compteur(0),
      autorisationFinancement: compteur(1),
      elementUnionComptesBancaires: compteur(0),
      chequier: compteur(0),
    } as unknown as PrismaService;
    const service = new JournalService(prisma);
    (service as unknown as { verifierCompteTresorerie: () => Promise<void> }).verifierCompteTresorerie = jest.fn(async () => undefined);
    (service as unknown as { trouver: () => Promise<unknown> }).trouver = jest.fn(async () => ({ id: 'j1', tenantId: 't1', code: 'BQ1', type: 'TRESORERIE', compteTresorerieId: 'c1' }));
    await expect(service.modifier('t1', 'j1', { compteTresorerieId: 'c2' } as never)).rejects.toThrow(/Le compte du journal BQ1 ne change pas tant que son RIB RAW porte des déclarations · il porte 1 autorisation/);
    expect(maj).not.toHaveBeenCalled();
  });

  it("la création d'une union lit les lignes en devise par un groupBy filtré sur les comptes (M2, câblage de M3)", async () => {
    const groupBy = jest.fn(async ({ where }: { where: { compteId: { in: string[] }; deviseId: { not: null } } }) =>
      // La doublure honore la requête · seul c2 porte une ligne en devise.
      where.deviseId.not === null ? where.compteId.in.filter((c) => c === 'c2').map((compteId) => ({ compteId })) : [],
    );
    const prisma = {
      tenant: { findUniqueOrThrow: jest.fn(async () => ({ referentiel: 'SYSCOHADA' })) },
      ribBanque: {
        findMany: jest.fn(async () => [
          { id: 'r1', abrege: 'RAW-CDF', devise: null, journal: { compteTresorerieId: 'c1', compteTresorerie: { numero: '52110000' } } },
          { id: 'r2', abrege: 'RAW-X', devise: null, journal: { compteTresorerieId: 'c2', compteTresorerie: { numero: '52120000' } } },
        ]),
      },
      ligneEcriture: { groupBy },
    } as unknown as PrismaService;
    await expect(new ConditionsBancairesService(prisma).creerUnion('t1', { code: 'U1', intitule: 'R', ribIds: ['r1', 'r2'] })).rejects.toThrow(/RAW-X est tenu en devise/);
    expect(groupBy).toHaveBeenCalledWith(expect.objectContaining({ by: ['compteId'] }));
  });
});
