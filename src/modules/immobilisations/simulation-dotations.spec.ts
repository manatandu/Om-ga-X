import { ModeAmortissement, Referentiel, SensDepreciation, SystemeComptableSyscohada } from '@prisma/client';
import { ImmobilisationService } from './immobilisation.service';
import { PrismaService } from '../../common/prisma.service';
import { EcritureService } from '../comptabilite/ecriture.service';
import { lireNombreDePeriodes, periodesDeSimulation, totauxDeLaSimulation } from './simulation-dotations';

/**
 * LA SIMULATION DES DOTATIONS FUTURES (ligne immos, fonction n° 72). Ce qui
 * casserait en silence · une formule à part qui annoncerait une annuité que la
 * dotation ne passerait pas ; une période fictive qui ne ferait pas douze mois
 * ; un bien aux unités d'œuvre simulé à zéro (« il ne s'amortit plus ») au
 * lieu d'être dit non calculé ; une dotation passée recalculée.
 */

const N = { id: 'ex2026', dateDebut: new Date('2026-01-01'), dateFin: new Date('2026-12-31') };
const N1 = { id: 'ex2027', dateDebut: new Date('2027-01-01'), dateFin: new Date('2027-12-31') };

describe('les périodes simulées', () => {
  it('l’exercice choisi, les exercices du dossier qui s’enchaînent, puis des années fictives de douze mois', () => {
    const p = periodesDeSimulation(N, [N1], 4);
    expect(p.map((x) => [x.dateDebut.toISOString().slice(0, 10), x.dateFin.toISOString().slice(0, 10), x.exerciceId])).toEqual([
      ['2026-01-01', '2026-12-31', 'ex2026'],
      ['2027-01-01', '2027-12-31', 'ex2027'],
      ['2028-01-01', '2028-12-31', null],
      ['2029-01-01', '2029-12-31', null],
    ]);
  });

  it('un exercice décalé (clôture au 30 juin) donne des années fictives au même rythme, février bissextile compris', () => {
    const p = periodesDeSimulation({ id: 'e', dateDebut: new Date('2027-07-01'), dateFin: new Date('2028-06-30') }, [], 2);
    expect(p[1].dateDebut.toISOString().slice(0, 10)).toBe('2028-07-01');
    expect(p[1].dateFin.toISOString().slice(0, 10)).toBe('2029-06-30');
  });

  it('un exercice du dossier qui ne suit pas jour pour jour arrête la reprise des exercices réels', () => {
    const trou = { id: 'ex2028', dateDebut: new Date('2028-01-01'), dateFin: new Date('2028-12-31') };
    const p = periodesDeSimulation(N, [trou], 3);
    expect(p.map((x) => x.exerciceId)).toEqual(['ex2026', null, null]);
  });

  it('le nombre demandé se lit, borné · illisible ou hors plage, un motif ; absent, cinq', () => {
    expect(lireNombreDePeriodes(undefined)).toBe(5);
    expect(lireNombreDePeriodes('3')).toBe(3);
    expect(lireNombreDePeriodes('0')).toEqual({ motif: expect.stringContaining('de 1 à 15') });
    expect(lireNombreDePeriodes('2,5')).toEqual({ motif: expect.any(String) });
  });

  it('les totaux somment au centime et comptent les annuités non calculées, jamais lues comme zéro', () => {
    const t = totauxDeLaSimulation(
      [
        { annuites: [0.1, 0.2], passees: [false, false] },
        { annuites: [0.2, null], passees: [false, false] },
      ],
      2,
    );
    expect(t).toEqual([
      { montant: 0.3, nonCalcules: 0 },
      { montant: 0.2, nonCalcules: 1 },
    ]);
  });
});

function bien(opts: Partial<Record<string, unknown>> & { id: string; valeurOrigine: number; dureeAns: number; dateMiseEnService: string | null }) {
  return {
    id: opts.id,
    designation: `Bien ${opts.id}`,
    numeroInventaire: null,
    compteImmobilisation: { id: 'c2441', numero: '24410000', intitule: 'Matériel de bureau' },
    dateAcquisition: new Date(opts.dateMiseEnService ?? '2026-01-01'),
    dateMiseEnService: opts.dateMiseEnService ? new Date(opts.dateMiseEnService) : null,
    valeurOrigine: opts.valeurOrigine,
    valeurResiduelle: 0,
    dureeAmortissementAns: opts.dureeAns,
    amortissementAnterieur: 0,
    modeAmortissement: (opts.mode as ModeAmortissement) ?? ModeAmortissement.LINEAIRE,
    unitesOeuvrePrevues: opts.unitesOeuvrePrevues ?? null,
    statut: 'EN_SERVICE',
    dateSortie: null,
    dureeNonLimitee: false,
    degressifFiscal: false,
    dateEntreeGroupe: null,
    dotations: (opts.dotations as unknown[]) ?? [],
    depreciations: (opts.depreciations as unknown[]) ?? [],
    consommationsUniteOeuvre: (opts.consommations as unknown[]) ?? [],
  };
}

function service(biens: ReturnType<typeof bien>[]) {
  const prisma = {
    tenant: {
      findUniqueOrThrow: jest.fn().mockResolvedValue({ referentiel: Referentiel.SYSCOHADA, systemeComptableSyscohada: SystemeComptableSyscohada.NORMAL }),
    },
    exercice: {
      findFirst: jest.fn(({ where }: { where: { id?: string; tenantId?: string } }) => Promise.resolve(where.id === N.id && where.tenantId === 'tn' ? N : null)),
      findMany: jest.fn().mockResolvedValue([N1]),
    },
    immobilisation: { findMany: jest.fn().mockResolvedValue(biens) },
  } as unknown as PrismaService;
  return new ImmobilisationService(prisma, {} as EcritureService);
}

describe('la simulation, par le moteur du plan', () => {
  it('un bien mis en service le 1er avril · 9/12 la première année, l’annuité pleine ensuite, le reste en dernier, puis zéro', async () => {
    // 1 200 000 sur quatre ans, en service le 01/04/2026 · 225 000, 300 000,
    // 300 000, 300 000, 75 000 · la somme fait le brut, au centime.
    const s = await service([bien({ id: 'a', valeurOrigine: 1_200_000, dureeAns: 4, dateMiseEnService: '2026-04-01' })]).simulerDotations('tn', 'ex2026', 6);
    expect(s.biens[0].annuites).toEqual([225_000, 300_000, 300_000, 300_000, 75_000, 0]);
    expect(s.biens[0].valeurNetteFin).toBe(0);
    expect(s.periodes.map((p) => p.fictive)).toEqual([false, false, true, true, true, true]);
  });

  it('une dotation déjà passée se lit au journal, jamais recalculée, et la suite part d’elle', async () => {
    const a = bien({
      id: 'a',
      valeurOrigine: 1_200_000,
      dureeAns: 4,
      dateMiseEnService: '2026-01-01',
      dotations: [{ montant: 299_999.99, exerciceId: 'ex2026', exercice: { dateFin: N.dateFin } }],
    });
    const s = await service([a]).simulerDotations('tn', 'ex2026', 2);
    expect(s.biens[0].annuites).toEqual([299_999.99, 300_000]);
    expect(s.biens[0].passees).toEqual([true, false]);
  });

  it('une dépréciation antérieure ré-étale le plan sur la durée restant à courir (AUDCIF Titre VIII ch. 12 § 2.4.1)', async () => {
    // 10 000 000 sur 5 ans depuis 2023, trois annuités passées, dépréciation
    // de 1 600 000 fin 2025 · 2 400 000 sur deux ans, 1 200 000 par an.
    const a = bien({
      id: 'a',
      valeurOrigine: 10_000_000,
      dureeAns: 5,
      dateMiseEnService: '2023-01-01',
      dotations: [2023, 2024, 2025].map((y) => ({ montant: 2_000_000, exerciceId: `ex${y}`, exercice: { dateFin: new Date(`${y}-12-31`) } })),
      depreciations: [{ sens: SensDepreciation.DOTATION, montant: 1_600_000, nature: 'CLOTURE', exercice: { dateFin: new Date('2025-12-31') } }],
    });
    const s = await service([a]).simulerDotations('tn', 'ex2026', 3);
    expect(s.biens[0].annuites).toEqual([1_200_000, 1_200_000, 0]);
    expect(s.biens[0].cumulAvant).toBe(6_000_000);
  });

  it('aux unités d’œuvre, une période sans relevé est NON CALCULÉE, et le total le dit', async () => {
    const u = bien({
      id: 'u',
      valeurOrigine: 1_000_000,
      dureeAns: 5,
      dateMiseEnService: '2026-01-01',
      mode: ModeAmortissement.UNITES_DOEUVRE,
      unitesOeuvrePrevues: 100_000,
      consommations: [{ exerciceId: 'ex2026', unitesConsommees: 9_000, exercice: { dateFin: N.dateFin } }],
    });
    const l = bien({ id: 'l', valeurOrigine: 120_000, dureeAns: 4, dateMiseEnService: '2026-01-01' });
    const s = await service([u, l]).simulerDotations('tn', 'ex2026', 2);
    expect(s.biens[0].annuites).toEqual([90_000, null]);
    expect(s.biens[0].valeurNetteFin).toBeNull();
    expect(s.totaux).toEqual([
      { montant: 120_000, nonCalcules: 0 },
      { montant: 30_000, nonCalcules: 1 },
    ]);
  });

  it('un bien pas encore mis en service ne simule rien · zéro, et il est dit tel', async () => {
    const s = await service([bien({ id: 'a', valeurOrigine: 500_000, dureeAns: 5, dateMiseEnService: null })]).simulerDotations('tn', 'ex2026', 2);
    expect(s.biens[0].annuites).toEqual([0, 0]);
    expect(s.biens[0].pasEnService).toBe(true);
  });

  it('un exercice d’un autre dossier est refusé en 404 nommé, avant toute lecture des biens', async () => {
    const svc = service([]);
    await expect(svc.simulerDotations('autre', 'ex2026', 2)).rejects.toThrow(/introuvable/i);
  });
});
