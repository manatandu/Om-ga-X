import { BadRequestException } from '@nestjs/common';
import { ClasseCompte, StatutExercice, TypeCompteDetailTotal } from '@prisma/client';
import { PrismaService } from '../../common/prisma.service';
import { BudgetsComptesService } from './budgets-comptes.service';
import {
  ligneDuBudget,
  moisDeLExercice,
  motifRefusCompteBudgetable,
  motifRefusMontantBudget,
  repartirSurLesMois,
  totauxDeLaNature,
} from './budget-compte';

/**
 * Fonction n° 51 · ce qui casserait en silence · un réalisé lu au solde (zéro
 * partout sur un exercice clos), l'écriture qui solde les comptes de gestion
 * comptée dans le réalisé (le double de la charge), un produit lu au débit
 * (un chiffre d'affaires négatif), un compte non doté pris pour un budget à
 * zéro (jamais « hors budget »), une dotation dont les mois ne font pas
 * l'année, et un N-1 lu sur le mauvais exercice.
 */
describe('budget par compte · règles pures', () => {
  it('ne dote qu’un compte de détail des classes 6 et 7', () => {
    expect(motifRefusCompteBudgetable({ numero: '60400000', classe: 'CLASSE_6', estTotal: false })).toBeNull();
    expect(motifRefusCompteBudgetable({ numero: '70100000', classe: 'CLASSE_7', estTotal: false })).toBeNull();
    expect(motifRefusCompteBudgetable({ numero: '60', classe: 'CLASSE_6', estTotal: true })).toMatch(/regroupement/);
    expect(motifRefusCompteBudgetable({ numero: '82100000', classe: 'CLASSE_8', estTotal: false })).toMatch(/classes 6 et 7/);
    expect(motifRefusCompteBudgetable({ numero: '24400000', classe: 'CLASSE_2', estTotal: false })).toMatch(/classes 6 et 7/);
  });

  it('refuse un montant négatif ou au-delà du centime', () => {
    expect(motifRefusMontantBudget(1200)).toBeNull();
    expect(motifRefusMontantBudget(0)).toBeNull();
    expect(motifRefusMontantBudget(-1)).toMatch(/négatif/);
    expect(motifRefusMontantBudget(10.005)).toMatch(/centime/);
  });

  it('répartit l’année au centime, le reliquat sur le dernier mois', () => {
    const parts = repartirSurLesMois(1000, 12);
    expect(parts.slice(0, 11).every((p) => p === 83.33)).toBe(true);
    expect(parts[11]).toBe(83.37);
    expect(Math.round(parts.reduce((t, p) => t + p, 0) * 100)).toBe(100_000);
  });

  it('lit les mois de calendrier de l’exercice, en UTC, même décalé', () => {
    expect(moisDeLExercice(new Date('2026-01-01T00:00:00Z'), new Date('2026-12-31T00:00:00Z'))).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    expect(moisDeLExercice(new Date('2026-07-01T00:00:00Z'), new Date('2027-06-30T00:00:00Z'))).toEqual([7, 8, 9, 10, 11, 12, 1, 2, 3, 4, 5, 6]);
  });

  it('une charge qui dépasse son budget est défavorable, un produit qui n’y arrive pas aussi', () => {
    const charge = ligneDuBudget({ compteId: 'c', numero: '604', intitule: '', nature: 'CHARGE', budget: 100, realise: 120, realiseN1: 90 });
    expect(charge).toMatchObject({ ecart: -20, defavorable: true, horsBudget: false, tauxRealisation: 120 });
    const produit = ligneDuBudget({ compteId: 'p', numero: '701', intitule: '', nature: 'PRODUIT', budget: 500, realise: 400, realiseN1: null });
    expect(produit).toMatchObject({ ecart: 100, defavorable: true });
    const bon = ligneDuBudget({ compteId: 'p', numero: '701', intitule: '', nature: 'PRODUIT', budget: 500, realise: 600, realiseN1: null });
    expect(bon.defavorable).toBe(false);
  });

  it('sans budget, le compte mouvementé est hors budget · jamais un budget à zéro', () => {
    const l = ligneDuBudget({ compteId: 'c', numero: '605', intitule: '', nature: 'CHARGE', budget: null, realise: 50, realiseN1: 0 });
    expect(l).toMatchObject({ budget: null, ecart: null, tauxRealisation: null, horsBudget: true, defavorable: false });
    const doteAZero = ligneDuBudget({ compteId: 'c', numero: '605', intitule: '', nature: 'CHARGE', budget: 0, realise: 50, realiseN1: 0 });
    expect(doteAZero).toMatchObject({ horsBudget: false, defavorable: true, tauxRealisation: null });
    expect(totauxDeLaNature([l, doteAZero], 'CHARGE')).toMatchObject({ budget: 0, realise: 100, horsBudget: 50 });
  });
});

function serviceBudget(options: { exerciceLong?: boolean; sansPrecedent?: boolean; precedentCourt?: boolean; sousComptes?: string[] } = {}) {
  const appels: { modele: string; args: Record<string, unknown> }[] = [];
  const exercice = {
    id: 'e2',
    dateDebut: new Date('2026-01-01T00:00:00Z'),
    dateFin: options.exerciceLong ? new Date('2027-06-30T00:00:00Z') : new Date('2026-12-31T00:00:00Z'),
    statut: StatutExercice.OUVERT,
  };
  const precedent = {
    id: 'e1',
    dateDebut: new Date(options.precedentCourt ? '2025-07-01T00:00:00Z' : '2025-01-01T00:00:00Z'),
    dateFin: new Date('2025-12-31T00:00:00Z'),
    statut: StatutExercice.CLOTURE,
  };
  const prisma = {
    tenant: { findFirst: jest.fn().mockResolvedValue({ referentiel: 'SYSCOHADA' }) },
    exercice: {
      findFirst: jest.fn(({ where }: { where: Record<string, unknown> }) => {
        if (where.id === 'e2') return Promise.resolve(exercice);
        if (where.dateFin) return Promise.resolve(options.sansPrecedent ? null : precedent);
        return Promise.resolve(null);
      }),
    },
    budgetCompte: {
      findMany: jest.fn((args: Record<string, unknown>) => {
        appels.push({ modele: 'budgetCompte.findMany', args });
        return Promise.resolve([{ compteId: 'c604', montant: 1000, mois: null }]);
      }),
    },
    ligneEcriture: {
      groupBy: jest.fn((args: { where: { ecriture: { exerciceId: string } } }) => {
        appels.push({ modele: 'ligneEcriture.groupBy', args });
        const n = args.where.ecriture.exerciceId === 'e2';
        return Promise.resolve(
          n
            ? [
                { compteId: 'c604', _sum: { debit: 1300, credit: 100 } },
                { compteId: 'c701', _sum: { debit: 50, credit: 2050 } },
              ]
            : [{ compteId: 'c604', _sum: { debit: 900, credit: 0 } }],
        );
      }),
    },
    compte: {
      findFirst: jest.fn().mockResolvedValue({ id: 'c604', numero: '60410000', intitule: 'Achats', classe: ClasseCompte.CLASSE_6, typeCompte: TypeCompteDetailTotal.DETAIL, estActif: true }),
      findMany: jest.fn(({ where }: { where: { numero?: unknown } }) =>
        where.numero !== undefined ? Promise.resolve((options.sousComptes ?? []).map((numero) => ({ numero }))) : Promise.resolve([
        { id: 'c604', numero: '60400000', intitule: 'Achats', classe: ClasseCompte.CLASSE_6 },
        { id: 'c701', numero: '70100000', intitule: 'Ventes', classe: ClasseCompte.CLASSE_7 },
      ])),
    },
  } as unknown as PrismaService;
  return { service: new BudgetsComptesService(prisma), appels };
}

describe('budget par compte · l’état', () => {
  it('lit le réalisé en MOUVEMENT, sans l’écriture qui solde les comptes de gestion, hors situation', async () => {
    const { service, appels } = serviceBudget();
    await service.etat('t1', { exerciceId: 'e2' });
    const lecture = appels.find((a) => a.modele === 'ligneEcriture.groupBy')!.args as { where: { ecriture: Record<string, unknown> } };
    expect(lecture.where.ecriture.estGenereeParCloture).toBe(false);
    expect(JSON.stringify(lecture.where.ecriture)).toContain('SITUATION');
  });

  it('rend budget, réalisé dans le sens de la nature, N-1 et le hors budget', async () => {
    const { service } = serviceBudget();
    const e = await service.etat('t1', { exerciceId: 'e2' });
    const achats = e.lignes.find((l) => l.numero === '60400000')!;
    expect(achats).toMatchObject({ budget: 1000, realise: 1200, realiseN1: 900, ecart: -200, defavorable: true });
    const ventes = e.lignes.find((l) => l.numero === '70100000')!;
    expect(ventes).toMatchObject({ budget: null, realise: 2000, realiseN1: 0, horsBudget: true });
    expect(e.totaux.resultat).toEqual({ budget: -1000, realise: 800, realiseN1: -900 });
    expect(e.exercicePrecedent).toEqual({ id: 'e1', du: '2025-01-01', au: '2025-12-31' });
  });

  it('sans exercice précédent, N-1 vaut null et le motif le dit', async () => {
    const { service } = serviceBudget({ sansPrecedent: true });
    const e = await service.etat('t1', { exerciceId: 'e2' });
    expect(e.lignes.every((l) => l.realiseN1 === null)).toBe(true);
    expect(e.motifN1).toMatch(/pas d'exercice précédent/);
  });

  it('un mois choisi lit la dotation du mois et le même mois de N-1', async () => {
    const { service, appels } = serviceBudget();
    const e = await service.etat('t1', { exerciceId: 'e2', mois: 3 });
    expect((appels.find((a) => a.modele === 'budgetCompte.findMany')!.args as { where: { mois: number } }).where.mois).toBe(3);
    expect(e.periode).toEqual({ du: '2026-03-01', au: '2026-03-31', mois: 3 });
    expect(e.exercicePrecedent).toEqual({ id: 'e1', du: '2025-03-01', au: '2025-03-31' });
  });

  it('un N-1 de durée différente n’est jamais servi comme comparable', async () => {
    const { service } = serviceBudget({ precedentCourt: true });
    const e = await service.etat('t1', { exerciceId: 'e2' });
    expect(e.lignes.every((l) => l.realiseN1 === null)).toBe(true);
    expect(e.exercicePrecedent).toBeNull();
    expect(e.motifN1).toMatch(/12 mois et le précédent 6/);
    expect(e.motifN1).toMatch(/AUDCIF art. 34/);
  });

  it('un compte du plan subdivisé ne se dote pas · le motif nomme le sous-compte', async () => {
    const { service } = serviceBudget({ sousComptes: ['60410001'] });
    await expect(service.doter('t1', 'c604', { exerciceId: 'e2', montantAnnuel: 100 })).rejects.toThrow(/subdivisé.*60410001/);
  });

  it('un mois sur un exercice de plus de douze mois est refusé', async () => {
    const { service } = serviceBudget({ exerciceLong: true });
    await expect(service.etat('t1', { exerciceId: 'e2', mois: 3 })).rejects.toBeInstanceOf(BadRequestException);
  });
});
