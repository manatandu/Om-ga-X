import { BadRequestException, ConflictException } from '@nestjs/common';
import { arriereDuMois, calculerRappel, moisDuRappel, motifRefusMoisDePaiement, type BulletinSource } from './rappel-salaire';
import { RappelsSalaireService, elementsDesRappels, lierRappelsAuBulletin, rappelsAPorter, sourceDuBulletin } from './rappels-salaire.service';
import { salaireDeLaSaisie } from './salaire-pendant-le-conge';
import { ficheIndividuelle } from './fiche-individuelle';

/**
 * LIGNE PAIE-SUITE, FONCTION 87 · le rappel de salaires. Ce qui casserait en
 * silence · un arriéré compté deux fois (deux rappels sur un mois, ou porté
 * par deux bulletins), une baisse qui retient un salaire payé, un rappel porté
 * au bulletin d'un mois qu'il couvre, un centime perdu sur un gros salaire, un
 * rappel pris pour le salaire du mois par la garde des congés.
 */
const source = (mois: string, extra: Partial<BulletinSource> = {}): BulletinSource => ({
  id: `b-${mois}`,
  numero: Number(mois.slice(5)),
  moisDePaie: mois,
  salaireFc: 500_000,
  base: 500_000,
  periodicite: 'MOIS',
  devise: 'CDF',
  stipuleEnDollars: false,
  ...extra,
});
const declare = { nouvelleBase: 560_000, periodicite: 'MOIS', devise: 'CDF' };

describe('rappel de salaires · le calcul', () => {
  it('un mois entier rend la différence des bases, un mois incomplet sa part', () => {
    expect(arriereDuMois(500_000, 500_000, 560_000)).toBe(60_000);
    // Payé à moitié (entrée le 16) · la moitié de la hausse.
    expect(arriereDuMois(250_000, 500_000, 560_000)).toBe(30_000);
    // Au centime, sans flottant, sur un très gros salaire.
    expect(arriereDuMois(98_765_432.1, 98_765_432.1, 123_456_789.01)).toBe(24_691_356.91);
    expect(arriereDuMois(100, 300, 400)).toBe(33.33);
  });

  it('les mois se comptent de date à date, bornés à vingt-quatre', () => {
    expect(moisDuRappel('2026-11', '2027-02')).toEqual(['2026-11', '2026-12', '2027-01', '2027-02']);
    expect(moisDuRappel('2027-02', '2026-11')).toMatchObject({ refus: expect.stringMatching(/précède/) });
    expect(moisDuRappel('2026-01', '2028-01')).toMatchObject({ refus: expect.stringMatching(/24 mois/) });
  });

  it('chaque mois exclu dit pourquoi · rien de deviné', () => {
    const r = calculerRappel(
      ['2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07'],
      [
        source('2026-01'),
        source('2026-03', { stipuleEnDollars: true }),
        source('2026-04', { periodicite: 'JOUR' }),
        source('2026-05', { base: 600_000 }),
        source('2026-06', { salaireFc: null }),
        source('2026-07'),
      ],
      new Map([['2026-07', 'déclaré le 2026-10-01']]),
      declare,
    );
    expect(r.lignes.map((l) => [l.mois, l.arriereFc])).toEqual([['2026-01', 60_000]]);
    const motifs = Object.fromEntries(r.exclus.map((e) => [e.mois, e.motif]));
    expect(motifs['2026-02']).toMatch(/aucun bulletin émis/);
    expect(motifs['2026-03']).toMatch(/dollars/);
    expect(motifs['2026-04']).toMatch(/même unité/);
    // Une baisse rendrait un salaire payé · l'art. 112 ne l'autorise pas.
    expect(motifs['2026-05']).toMatch(/art\. 112/);
    expect(motifs['2026-06']).toMatch(/Salaire ou traitement/);
    expect(motifs['2026-07']).toMatch(/déjà couvert/);
    expect(r.totalFc).toBe(60_000);
  });

  it("se porte au bulletin d'un mois postérieur à tous ses mois", () => {
    expect(motifRefusMoisDePaiement('2026-12', ['2026-10', '2026-11'])).toBeNull();
    expect(motifRefusMoisDePaiement('2026-11', ['2026-10', '2026-11'])).toMatch(/postérieur/);
  });

  it("le salaire figé d'un bulletin exclut les rappels qu'il paie · le rappel n'est pas le salaire du mois", () => {
    const b = {
      id: 'b',
      numero: 1,
      moisDePaie: '2026-12',
      entree: { elements: [{ nature: 'SALAIRE_OU_TRAITEMENT', libelle: 'Salaire', montantFc: 560_000 }, ...elementsDesRappels([{ rappelId: 'r', totalFc: 60_000, motif: 'Avenant', lignes: [{ mois: '2026-11', bulletinId: 'x', numero: 1, salaireFigeFc: 500_000, ancienneBase: 500_000, arriereFc: 60_000 }] }])] },
      calcul: { contrat: { remunerationBase: 560_000, periodiciteRemuneration: 'MOIS', deviseRemuneration: 'CDF' } },
    };
    expect(sourceDuBulletin(b).salaireFc).toBe(560_000);
    expect(salaireDeLaSaisie(b.entree)).toEqual({ salaire: 560_000, devise: 'CDF' });
    // La fiche individuelle range le rappel sur sa propre ligne.
    const f = ficheIndividuelle(2026, [{ ...b, nature: 'MOIS', statut: 'EMIS', totalVerseFc: 620_000, assietteSocialeFc: 0, cotisationsTravailleurFc: 0, cotisationsEmployeurFc: 0, irppFc: 0, netAPayerFc: 0 }], new Map());
    expect(f.rubriques.find((r) => r.cle === 'RAPPEL')).toMatchObject({ total: 60_000 });
    expect(f.rubriques.find((r) => r.cle === 'N:SALAIRE_OU_TRAITEMENT')).toMatchObject({ total: 560_000 });
  });
});

describe('rappel de salaires · le service', () => {
  const ligne = { mois: '2026-11', bulletinId: 'b11', numero: 11, salaireFigeFc: 500_000, ancienneBase: 500_000, arriereFc: 60_000 };
  const rappel = (extra: Record<string, unknown> = {}) => ({
    id: 'r1',
    salarieId: 's1',
    annuleLe: null,
    createdAt: new Date('2026-12-01'),
    lignes: [ligne],
    totalFc: 60_000,
    motif: 'Avenant n° 3',
    bulletin: null,
    ...extra,
  });
  const db = (r: Record<string, unknown> | null, statutSource = 'EMIS') =>
    ({
      rappelSalaire: { findMany: async () => (r ? [r] : []) },
      bulletinPaie: { findMany: async () => [{ id: 'b11', numero: 11, statut: statutSource }] },
    }) as never;

  it('porte un rappel libre, et refuse celui qui est payé, annulé, du mois couvert ou dont la source est tombée', async () => {
    expect(await rappelsAPorter(db(rappel()), 't', 's1', '2026-12', ['r1'])).toMatchObject([{ rappelId: 'r1', totalFc: 60_000 }]);
    await expect(rappelsAPorter(db(rappel({ bulletin: { statut: 'EMIS', numero: 12 } })), 't', 's1', '2026-12', ['r1'])).rejects.toThrow(/déjà payé par le bulletin n° 12/);
    // Un porteur annulé libère le rappel.
    expect(await rappelsAPorter(db(rappel({ bulletin: { statut: 'ANNULE', numero: 12 } })), 't', 's1', '2026-12', ['r1'])).toHaveLength(1);
    await expect(rappelsAPorter(db(rappel({ annuleLe: new Date() })), 't', 's1', '2026-12', ['r1'])).rejects.toThrow(/annulé/);
    await expect(rappelsAPorter(db(rappel()), 't', 's1', '2026-11', ['r1'])).rejects.toThrow(/postérieur/);
    await expect(rappelsAPorter(db(rappel(), 'ANNULE'), 't', 's1', '2026-12', ['r1'])).rejects.toThrow(/annulé\(s\) depuis/);
    await expect(rappelsAPorter(db(rappel({ salarieId: 'autre' })), 't', 's1', '2026-12', ['r1'])).rejects.toBeInstanceOf(BadRequestException);
  });

  it("à l'émission, un rappel payé entre-temps refuse tout (409) · libre, il est lié", async () => {
    const update = jest.fn();
    const tx = (r: Record<string, unknown>) => ({ $executeRaw: jest.fn(async () => 1), $queryRaw: async () => [], rappelSalaire: { findFirst: async () => r, update } }) as never;
    await expect(lierRappelsAuBulletin(tx({ ...rappel(), bulletin: { statut: 'EMIS', numero: 9 } }), 't', 'b12', [{ rappelId: 'r1', totalFc: 60_000, lignes: [ligne], motif: 'x' }])).rejects.toBeInstanceOf(ConflictException);
    await lierRappelsAuBulletin(tx(rappel()), 't', 'b12', [{ rappelId: 'r1', totalFc: 60_000, lignes: [ligne], motif: 'x' }]);
    expect(update).toHaveBeenCalledWith({ where: { id: 'r1' }, data: { bulletinId: 'b12' } });
  });

  it("refuse de déclarer un rappel sans aucun mois à rappeler · les exclus sont nommés", async () => {
    const prisma = {
      salarie: { findFirst: async () => ({ id: 's1' }) },
      bulletinPaie: { findMany: async () => [] },
      rappelSalaire: { findMany: async () => [] },
    };
    const svc = new RappelsSalaireService(prisma as never);
    await expect(
      svc.creer('t', 'u', 's1', { moisDebut: '2026-10', moisFin: '2026-11', nouvelleBase: 560_000, periodicite: 'MOIS', deviseBase: 'CDF', motif: 'Avenant', pieceJustificative: 'Avenant n° 3' }),
    ).rejects.toThrow(/Aucun mois/);
  });

  it("un rappel payé ne s'annule pas · le bulletin d'abord", async () => {
    const prisma = {
      $transaction: async (f: (tx: unknown) => unknown) => f(prisma),
      $executeRaw: jest.fn(async () => 1), $queryRaw: async () => [],
      rappelSalaire: { findFirst: async () => ({ id: 'r1', annuleLe: null, bulletin: { statut: 'EMIS', numero: 12 } }), update: jest.fn() },
    };
    await expect(new RappelsSalaireService(prisma as never).annuler('t', 'u', 'r1', { motif: 'erreur' })).rejects.toThrow(/annulez d'abord le bulletin/);
  });
});
