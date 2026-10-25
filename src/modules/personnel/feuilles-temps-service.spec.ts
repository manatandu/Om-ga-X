import { FeuillesTempsService } from './feuilles-temps.service';
import { PrismaService } from '../../common/prisma.service';

/**
 * LIGNE SAGE-L5, FONCTION 78, RESTE · ce que le service ne doit pas faire en
 * silence · réécrire un jour qui ne change pas (le journal d'audit dirait un
 * geste qui n'a pas eu lieu), changer les heures d'une semaine qu'un bulletin
 * émis a déjà payée, saisir des heures sur un jour d'absence, lire un jour non
 * couvert comme un jour à zéro.
 */

const J = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

function doublure(p: {
  jours?: Array<{ id: string; jour: Date; heures: number; heuresNuit: number }>;
  bulletins?: Array<{ numero: number; moisDePaie: string }>;
  absences?: Array<{ du: Date; au: Date; demiJourneeDebut: boolean; demiJourneeFin: boolean }>;
  feuillesDuMois?: Array<{ id: string; du: Date; au: Date }>;
  joursDuMois?: Array<{ jour: Date; heures: number; heuresNuit: number }>;
}) {
  const ecrits: string[] = [];
  const salarie = { id: 's-1', contrats: [{ dateEntreeEnVigueur: J('2026-01-01'), dateFin: null }] };
  const tx = {
    $queryRaw: jest.fn().mockResolvedValue([]),
    feuilleTemps: {
      findFirst: jest.fn().mockResolvedValue({
        id: 'f-1',
        salarieId: 's-1',
        du: J('2026-07-01'),
        au: J('2026-07-31'),
        annuleLe: null,
        jours: (p.jours ?? []).map((j) => ({ ...j, heuresCompteurs: [] })),
      }),
      findMany: jest.fn().mockResolvedValue(p.feuillesDuMois ?? []),
      update: jest.fn(),
    },
    salarie: { findFirst: jest.fn().mockResolvedValue(salarie) },
    absenceSalarie: { findMany: jest.fn().mockResolvedValue(p.absences ?? []) },
    congeSalarie: { findMany: jest.fn().mockResolvedValue([]) },
    bulletinPaie: {
      findMany: jest.fn().mockImplementation(({ where }: { where: { moisDePaie: { in: string[] } } }) =>
        Promise.resolve((p.bulletins ?? []).filter((b) => where.moisDePaie.in.includes(b.moisDePaie))),
      ),
      findFirst: jest.fn().mockResolvedValue(null),
    },
    compteurHeures: { findMany: jest.fn().mockResolvedValue([]) },
    jourFeuilleTemps: {
      update: jest.fn().mockImplementation(() => {
        ecrits.push('update');
        return Promise.resolve({});
      }),
      create: jest.fn().mockImplementation(() => {
        ecrits.push('create');
        return Promise.resolve({ id: 'j-n' });
      }),
      findMany: jest.fn().mockResolvedValue(p.joursDuMois ?? []),
    },
    heuresCompteurJour: { create: jest.fn(), update: jest.fn(), groupBy: jest.fn().mockResolvedValue([]) },
    majorationHeures: { findMany: jest.fn().mockResolvedValue([{ id: 'm-hs', nature: 'HEURES_SUPPLEMENTAIRES', libelle: 'HS' }]) },
  };
  const prisma = { ...tx, $transaction: (fn: (t: typeof tx) => Promise<unknown>) => fn(tx) } as unknown as PrismaService;
  return { svc: new FeuillesTempsService(prisma), ecrits };
}

describe('la saisie des jours', () => {
  it('un jour qui ne change pas n’est pas réécrit', async () => {
    const { svc, ecrits } = doublure({ jours: [{ id: 'j-1', jour: J('2026-07-06'), heures: 8, heuresNuit: 0 }] });
    const r = await svc.enregistrerJours('t', 'u@x.cd', 'f-1', { jours: [{ jour: '2026-07-06', heures: 8, heuresNuit: 0 }] });
    expect(r).toEqual({ enregistre: true, gestes: 0 });
    expect(ecrits).toEqual([]);
  });

  it('LE BULLETIN ÉMIS GARDE SES HEURES · la semaine du 29 juin se paie en juillet, émis, la saisie du 30 juin est refusée', async () => {
    const { svc, ecrits } = doublure({ bulletins: [{ numero: 41, moisDePaie: '2026-07' }] });
    // Le 1er juillet 2026 est un mercredi de la semaine du lundi 29 juin ·
    // payée au mois de son dimanche, le 5 juillet.
    await expect(svc.enregistrerJours('t', 'u@x.cd', 'f-1', { jours: [{ jour: '2026-07-01', heures: 9 }] })).rejects.toThrow(
      /bulletin n° 41 de 2026-07, déjà émis/,
    );
    expect(ecrits).toEqual([]);
  });

  it('un jour d’absence ne reçoit pas d’heures · un jour n’a qu’une cause', async () => {
    const { svc } = doublure({ absences: [{ du: J('2026-07-06'), au: J('2026-07-08'), demiJourneeDebut: false, demiJourneeFin: false }] });
    await expect(svc.enregistrerJours('t', 'u@x.cd', 'f-1', { jours: [{ jour: '2026-07-07', heures: 8 }] })).rejects.toThrow(/un jour n'a qu'une cause/);
  });

  it('la demi-journée du dernier jour laisse l’autre moitié saisissable', async () => {
    const { svc, ecrits } = doublure({ absences: [{ du: J('2026-07-06'), au: J('2026-07-08'), demiJourneeDebut: false, demiJourneeFin: true }] });
    await svc.enregistrerJours('t', 'u@x.cd', 'f-1', { jours: [{ jour: '2026-07-08', heures: 4 }] });
    expect(ecrits).toEqual(['create']);
  });

  it('les heures de nuit au-delà de dix heures sont refusées avant toute écriture', async () => {
    const { svc, ecrits } = doublure({});
    await expect(svc.enregistrerJours('t', 'u@x.cd', 'f-1', { jours: [{ jour: '2026-07-06', heures: 12, heuresNuit: 11 }] })).rejects.toThrow(/art\. 124/);
    expect(ecrits).toEqual([]);
  });
});

describe('la proposition du mois', () => {
  it('UNE SEMAINE DONT UN JOUR N’EST COUVERT PAR AUCUNE FEUILLE · sa limite ne se calcule pas, la proposition est un minimum', async () => {
    // Une feuille du 6 au 31 juillet · la semaine du 29 juin (payée en
    // juillet) n'est couverte que du 1er au 5 · les 29 et 30 juin manquent.
    const { svc } = doublure({
      feuillesDuMois: [{ id: 'f-1', du: J('2026-07-01'), au: J('2026-07-31') }],
      joursDuMois: [
        { jour: J('2026-07-01'), heures: 10, heuresNuit: 0 },
        { jour: J('2026-07-06'), heures: 8, heuresNuit: 0 },
        { jour: J('2026-07-07'), heures: 8, heuresNuit: 0 },
        { jour: J('2026-07-08'), heures: 8, heuresNuit: 0 },
        { jour: J('2026-07-09'), heures: 8, heuresNuit: 0 },
        { jour: J('2026-07-10'), heures: 8, heuresNuit: 0 },
        { jour: J('2026-07-11'), heures: 8, heuresNuit: 0 },
      ],
    });
    const r = await svc.duMois('t', 's-1', '2026-07');
    expect(r.semaines[0]).toMatchObject({ lundi: '2026-06-29', supplementairesDuJour: 2, supplementairesDeLaSemaine: null, joursNonCouverts: ['2026-06-29', '2026-06-30'] });
    expect(r.semaines[1]).toMatchObject({ lundi: '2026-07-06', supplementairesDeLaSemaine: 3 });
    expect(r.totaux).toMatchObject({ supplementaires: 5, supplementairesIncompletes: true });
    // Une seule majoration de cette nature · présélectionnée ; le samedi 11
    // juillet sans majoration déclarée · proposé sans majoration, jamais
    // rattaché à une autre nature.
    expect(r.lignes).toEqual([
      { nature: 'HEURES_SUPPLEMENTAIRES', libelle: 'Heures supplémentaires', heures: 5, minimum: true, majorationId: 'm-hs', majorations: 1 },
      { nature: 'TRAVAIL_REPOS_OU_FERIE', libelle: 'Heures du samedi', heures: 8, minimum: false, majorationId: null, majorations: 0 },
    ]);
  });
});
