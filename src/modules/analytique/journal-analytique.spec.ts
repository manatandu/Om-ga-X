import { EtatsAnalytiquesService } from './etats-analytiques.service';
import { PrismaService } from '../../common/prisma.service';
import {
  PLAFOND_LIGNES_JOURNAL_ANALYTIQUE,
  comparerLignesJournal,
  lireOrigineJournal,
  premieresDeLUnion,
  type LigneJournalAnalytique,
} from './journal-analytique';

/**
 * Fonction n° 52 · ce qui casserait en silence · une tranche du journal qui
 * ne serait pas faite des PREMIÈRES lignes de l'union (une OD de janvier
 * cachée derrière deux mille ventilations de mars), un ordre qui changerait
 * d'un appel à l'autre, une origine inconnue lue comme « toutes », et un grand
 * livre des non ventilées qui ne parlerait pas des mêmes lignes que le
 * contrôle des cumuls.
 */
function ligne(id: string, jour: string, journal = 'AC', numeroPiece: number | null = 1): LigneJournalAnalytique {
  return {
    id,
    origine: journal === 'OD ANA' ? 'OD' : 'VENTILATION',
    date: new Date(`${jour}T00:00:00Z`),
    journal,
    numeroPiece,
    sectionCode: 'P1',
    sectionIntitule: 'Projet',
    compteNumero: '60400000',
    compteIntitule: 'Achats',
    libelle: 'x',
    debit: 10,
    credit: 0,
  };
}

describe('journal analytique · règles pures (fonction n° 52)', () => {
  it('lit l’origine · absente vaut toutes, inconnue vaut null', () => {
    expect(lireOrigineJournal(undefined)).toBe('TOUTES');
    expect(lireOrigineJournal('od')).toBe('OD');
    expect(lireOrigineJournal('reports')).toBeNull();
  });

  it('l’ordre est total · date, journal, pièce, identifiant', () => {
    const a = ligne('b', '2026-01-05', 'AC', 2);
    const b = ligne('a', '2026-01-05', 'AC', 2);
    const c = ligne('z', '2026-01-05', 'AC', 1);
    const d = ligne('y', '2026-01-04', 'VT', 9);
    expect([a, b, c, d].sort(comparerLignesJournal).map((l) => l.id)).toEqual(['y', 'z', 'a', 'b']);
  });

  it('la tranche est faite des premières lignes de l’union', () => {
    const ventilations = [ligne('v1', '2026-03-01'), ligne('v2', '2026-03-02')];
    const od = [ligne('o1', '2026-01-15', 'OD ANA', null)];
    expect(premieresDeLUnion(ventilations, od, 2).map((l) => l.id)).toEqual(['o1', 'v1']);
  });
});

function serviceAvecCapture() {
  const appels: { modele: string; where: unknown }[] = [];
  const capture = (modele: string, valeur: unknown) =>
    jest.fn((args: { where: unknown }) => {
      appels.push({ modele, where: args.where });
      return Promise.resolve(valeur);
    });
  const prisma = {
    planAnalytique: {
      findFirst: jest.fn().mockResolvedValue({ id: 'p1', code: 'PROJ', intitule: 'Projets', classesVentilees: '6,7', estActif: true }),
      findMany: jest.fn().mockResolvedValue([{ id: 'p1', code: 'PROJ', intitule: 'Projets', classesVentilees: '6,7' }]),
    },
    exercice: {
      findFirst: jest.fn().mockResolvedValue({ id: 'e1', dateDebut: new Date('2026-01-01'), dateFin: new Date('2026-12-31') }),
    },
    ligneEcriture: {
      findMany: capture('ligneEcriture.findMany', [
        {
          id: 'l1',
          debit: 100,
          credit: 0,
          libelle: null,
          compte: { numero: '60400000', intitule: 'Achats' },
          ecriture: { id: 'e', date: new Date('2026-02-01'), libelle: 'Facture', numeroPiece: 3, statut: 'VALIDEE', journal: { code: 'AC' } },
        },
        {
          id: 'l2',
          debit: 0,
          credit: 40,
          libelle: 'Avoir',
          compte: { numero: '60400000', intitule: 'Achats' },
          ecriture: { id: 'f', date: new Date('2026-02-03'), libelle: 'Avoir', numeroPiece: 4, statut: 'BROUILLARD', journal: { code: 'AC' } },
        },
      ]),
      aggregate: capture('ligneEcriture.aggregate', { _sum: { debit: 100, credit: 40 } }),
      count: capture('ligneEcriture.count', 2),
    },
    ventilationAnalytique: {
      aggregate: capture('ventilationAnalytique.aggregate', { _sum: { debit: 0, credit: 0 } }),
      findMany: capture('ventilationAnalytique.findMany', []),
      count: capture('ventilationAnalytique.count', 0),
    },
    ligneOdAnalytique: {
      findMany: capture('ligneOdAnalytique.findMany', []),
      aggregate: capture('ligneOdAnalytique.aggregate', { _sum: { debit: null, credit: null } }),
      count: capture('ligneOdAnalytique.count', 0),
    },
  } as unknown as PrismaService;
  return { service: new EtatsAnalytiquesService(prisma), appels };
}

describe('grand livre des lignes non ventilées (fonction n° 52)', () => {
  it('lit les MÊMES lignes que le contrôle des cumuls', async () => {
    const { service, appels } = serviceAvecCapture();
    await service.controleCumuls('t1', { exerciceId: 'e1', planId: 'p1' });
    const duControle = appels.filter((a) => a.modele === 'ligneEcriture.count').map((a) => a.where);
    appels.length = 0;
    await service.nonVentilees('t1', { planId: 'p1', exerciceId: 'e1' });
    const duLivre = appels.filter((a) => a.modele === 'ligneEcriture.count').map((a) => a.where);
    expect(duLivre).toEqual(duControle);
    // Ni écriture de situation, ni écriture qui solde les comptes de gestion.
    expect(JSON.stringify(duLivre[0])).toContain('"estSoldeDesComptesDeGestion":false');
    expect(JSON.stringify(duLivre[0])).toContain('SITUATION');
  });

  it('rend le solde progressif, les totaux de la base et le décompte', async () => {
    const { service } = serviceAvecCapture();
    const r = await service.nonVentilees('t1', { planId: 'p1', exerciceId: 'e1' });
    expect(r.lignes.map((l) => l.soldeProgressif)).toEqual([100, 60]);
    expect(r.totaux).toEqual({ debit: 100, credit: 40, solde: 60 });
    expect(r.total).toBe(2);
    expect(r.tronque).toBe(false);
  });
});

describe('journal analytique · le service (fonction n° 52)', () => {
  it('« OD seules » ne lit aucune ventilation', async () => {
    const { service, appels } = serviceAvecCapture();
    const r = await service.journal('t1', { planId: 'p1', exerciceId: 'e1', origine: 'OD' });
    expect(appels.some((a) => a.modele.startsWith('ventilationAnalytique'))).toBe(false);
    expect(r.total).toBe(0);
    expect(r.tronque).toBe(false);
  });

  it('lit les ventilations du plan seul, bornées au plafond, hors situation', async () => {
    const { service, appels } = serviceAvecCapture();
    await service.journal('t1', { planId: 'p1', exerciceId: 'e1', origine: 'TOUTES' });
    const where = appels.find((a) => a.modele === 'ventilationAnalytique.findMany')!.where as Record<string, unknown>;
    expect(where.planId).toBe('p1');
    expect(JSON.stringify(where)).toContain('SITUATION');
    expect(PLAFOND_LIGNES_JOURNAL_ANALYTIQUE).toBeGreaterThan(0);
  });
});
