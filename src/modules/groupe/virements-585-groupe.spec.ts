import { StatutExercice } from '@prisma/client';
import { GroupeService } from './groupe.service';
import { perimetreCourant } from '../../common/cloisonnement/contexte-cloisonnement';
import { PrismaService } from '../../common/prisma.service';

/**
 * LE 585 DU GROUPE, LU POUR LA CLÔTURE D'UN DE SES DOSSIERS (G1, relectures
 * du 2026-10-08). Fiche SYCEBNL du compte 58 · « soldés à la fin de
 * l'exercice », sur l'entité, qui est le groupe.
 *
 * Chaque membre se lit COMME IL SE LIT LUI-MÊME · son exercice qui contient
 * la date, ouverture comprise, en remontant un exercice précédent non
 * clôturé quand aucune ouverture validée n'est passée au premier jour. Trois
 * lectures antérieures ont été refusées en relecture, et chacune a son cas
 * ici · par « l'exercice de même période » (bornes décalées), par la date
 * seule hors écritures de clôture (import écarté, ouverture en OD comptée
 * deux fois).
 */

interface Exercice {
  id: string;
  tenantId: string;
  dateDebut: Date;
  statut: StatutExercice;
}

type R = Record<string, unknown>;

/**
 * Évaluateur des filtres que la lecture pose (périmètre de l'ouverture du
 * premier jour) · il honore chaque opérateur rencontré, relations `is`
 * comprises. Ce qui dépend de ce qu'une requête ramène se teste sur la
 * requête (CLAUDE.md, F4b).
 */
const evaluer = (r: R, w: unknown): boolean =>
  Object.entries((w ?? {}) as R).every(([cle, f]) => {
    if (cle === 'AND') return (f as unknown[]).every((x) => evaluer(r, x));
    if (cle === 'OR') return (f as unknown[]).some((x) => evaluer(r, x));
    if (cle === 'lignes') return !((r.lignes as R[]) ?? []).some((l) => evaluer(l, (f as { none: unknown }).none));
    if (f !== null && typeof f === 'object' && !(f instanceof Date) && ('is' in (f as R) || cle === 'journal' || cle === 'compte')) {
      const x = r[cle] as R | null | undefined;
      const is = 'is' in (f as R) ? (f as R).is : f;
      return is === null ? !x : !!x && evaluer(x, is);
    }
    if (f !== null && typeof f === 'object' && 'in' in (f as R)) return ((f as R).in as unknown[]).includes(r[cle]);
    if (f instanceof Date) return r[cle] instanceof Date && (r[cle] as Date).getTime() === f.getTime();
    return (r[cle] ?? null) === f;
  });

/** Une écriture du premier jour, telle que la base la rendrait · OD validée, lignes de bilan. */
const ecritureDuPremierJour = (id: string, tenantId: string, exerciceId: string, debut: string, x: R = {}): R => ({
  id,
  tenantId,
  exerciceId,
  numeroPiece: 1,
  statut: 'VALIDEE',
  date: new Date(debut),
  dateValeur: null,
  estANouveauProvisoire: false,
  estSoldeDesComptesDeGestion: false,
  estGenereeParCloture: false,
  journal: { type: 'GENERAL', code: 'OD' },
  corrigeEcriture: null,
  corrigeEcritureId: null,
  reevaluationExtourne: null,
  reevaluationContrePassationDeclaree: null,
  lignes: [
    { id: `${id}-1`, ecritureId: id, compteId: 'c521', debit: 100, credit: 0, deviseId: null, montantDevise: null, compte: { classe: 'CLASSE_5' } },
    { id: `${id}-2`, ecritureId: id, compteId: 'c101', debit: 0, credit: 100, deviseId: null, montantDevise: null, compte: { classe: 'CLASSE_1' } },
  ],
  ...x,
});

/**
 * Doublure qui HONORE les requêtes · les sommes du 585 par exercice ; les
 * écritures du premier jour ÉVALUÉES contre le filtre de la lecture
 * (comptage des lignes, écritures, lignes par tranches) ; les exercices
 * filtrés par la date. `ouvertures` · une OD d'ouverture validée, non nulle,
 * au premier jour de chaque exercice nommé.
 */
function monter(options: {
  dossierMereId: string | null;
  membres: string[];
  exercices: Exercice[];
  soldes585: Record<string, number>;
  ouvertures?: string[];
  ecritures?: R[];
}) {
  const perimetres: Array<ReadonlySet<string> | undefined> = [];
  const premierJour: R[] = [
    ...(options.ouvertures ?? []).map((id) => {
      const e = options.exercices.find((x) => x.id === id)!;
      return ecritureDuPremierJour(`od-${id}`, e.tenantId, id, e.dateDebut.toISOString().slice(0, 10));
    }),
    ...(options.ecritures ?? []),
  ];
  const retenues = (where: unknown) => premierJour.filter((e) => evaluer(e, where));
  const prisma = {
    tenant: {
      findUnique: jest.fn().mockResolvedValue({ dossierMereId: options.dossierMereId }),
      findMany: jest.fn().mockResolvedValue(options.membres.map((id) => ({ id }))),
    },
    exercice: {
      findMany: jest.fn((args: { where: { dateDebut: { lte: Date } } }) => {
        perimetres.push(perimetreCourant());
        return Promise.resolve(
          options.exercices
            .filter((e) => e.dateDebut <= args.where.dateDebut.lte)
            .sort((a, b) => a.dateDebut.getTime() - b.dateDebut.getTime()),
        );
      }),
    },
    ligneEcriture: {
      aggregate: jest.fn((args: { where: { ecriture: { exerciceId: string } } }) => {
        perimetres.push(perimetreCourant());
        const s = options.soldes585[args.where.ecriture.exerciceId] ?? 0;
        return Promise.resolve({ _sum: { debit: s > 0 ? s : 0, credit: s < 0 ? -s : 0 } });
      }),
      count: jest.fn((args: { where: { ecriture: unknown } }) => {
        perimetres.push(perimetreCourant());
        return Promise.resolve(retenues(args.where.ecriture).reduce((n, e) => n + (e.lignes as R[]).length, 0));
      }),
      // Une seule tranche · le jeu d'essai tient sous la taille d'un lot.
      findMany: jest.fn((args: { where: { ecriture: unknown }; cursor?: unknown }) => {
        perimetres.push(perimetreCourant());
        return Promise.resolve(args.cursor ? [] : retenues(args.where.ecriture).flatMap((e) => e.lignes as R[]));
      }),
    },
    ecriture: {
      findMany: jest.fn((args: { where: unknown }) => {
        perimetres.push(perimetreCourant());
        return Promise.resolve(retenues(args.where));
      }),
    },
  };
  const service = new GroupeService(prisma as unknown as PrismaService, {} as never, {} as never, {} as never);
  return { service, prisma, perimetres };
}

const ex = (id: string, tenantId: string, debut: string, statut: StatutExercice = StatutExercice.OUVERT): Exercice => ({
  id,
  tenantId,
  dateDebut: new Date(debut),
  statut,
});
const AU_31_12_2026 = new Date('2026-12-31');

describe('le 585 du groupe à la date de clôture', () => {
  it('une cellule lit son groupe par SA mère, dans le périmètre du groupe', async () => {
    const { service, prisma, perimetres } = monter({
      dossierMereId: 'SIEGE',
      membres: ['SIEGE', 'C1'],
      exercices: [ex('s26', 'SIEGE', '2026-01-01'), ex('c26', 'C1', '2026-01-01')],
      soldes585: { s26: 2_000_000 },
    });
    const r = await service.virements585DuGroupe('C1', AU_31_12_2026);
    expect(prisma.tenant.findUnique).toHaveBeenCalledWith({ where: { id: 'C1' }, select: { dossierMereId: true } });
    expect(prisma.tenant.findMany.mock.calls[0][0].where).toEqual({ OR: [{ id: 'SIEGE' }, { dossierMereId: 'SIEGE' }] });
    for (const p of perimetres) expect([...(p ?? [])].sort()).toEqual(['C1', 'SIEGE']);
    // Le virement du siège n'a pas sa réception à la cellule.
    expect(r).toEqual({ solde: 2_000_000 });
  });

  it('bornes décalées · le premier exercice long du siège et l’exercice civil de la cellule se lisent tous deux', async () => {
    const { service } = monter({
      dossierMereId: null,
      membres: ['SIEGE', 'C1'],
      exercices: [ex('sLong', 'SIEGE', '2025-08-01'), ex('c26', 'C1', '2026-01-01')],
      soldes585: { sLong: 2_000_000, c26: -2_000_000 },
    });
    expect(await service.virements585DuGroupe('SIEGE', AU_31_12_2026)).toEqual({ solde: 0 });
  });

  it('un bilan d’ouverture IMPORTÉ de la cellule compte, il ne sort pas de la somme', async () => {
    // Le siège a viré 2 000 000 en 2025, 2025 clôturé, report validé en 2026 ;
    // la cellule arrive en 2026 avec un import qui porte C 585 de 2 000 000.
    const { service } = monter({
      dossierMereId: null,
      membres: ['SIEGE', 'C1'],
      exercices: [
        ex('s25', 'SIEGE', '2025-01-01', StatutExercice.CLOTURE),
        ex('s26', 'SIEGE', '2026-01-01'),
        ex('c26', 'C1', '2026-01-01'),
      ],
      soldes585: { s25: 2_000_000, s26: 2_000_000, c26: -2_000_000 },
    });
    // Le siège se lit sur 2026 (report compris) ; 2025, clôturé, ne s'ajoute pas.
    expect(await service.virements585DuGroupe('SIEGE', AU_31_12_2026)).toEqual({ solde: 0 });
  });

  it('une ouverture saisie en OD n’est pas comptée deux fois avec l’historique qu’elle reprend', async () => {
    // La cellule a viré en 2025 (non clôturé) et saisi son ouverture 2026 en
    // OD, validée · elle fait foi, 2025 ne s'ajoute pas.
    const { service, prisma } = monter({
      dossierMereId: null,
      membres: ['SIEGE', 'C1'],
      exercices: [
        ex('s26', 'SIEGE', '2026-01-01'),
        ex('c25', 'C1', '2025-01-01'),
        ex('c26', 'C1', '2026-01-01'),
      ],
      soldes585: { s26: 2_000_000, c25: -2_000_000, c26: -2_000_000 },
      ouvertures: ['c26'],
    });
    expect(await service.virements585DuGroupe('SIEGE', AU_31_12_2026)).toEqual({ solde: 0 });
    expect(prisma.ligneEcriture.aggregate.mock.calls.map((c) => c[0].where.ecriture.exerciceId).sort()).toEqual(['c26', 's26']);
  });

  it('un exercice précédent non clôturé, sans ouverture validée, se remonte · l’à-nouveau n’est que le provisoire', async () => {
    const { service } = monter({
      dossierMereId: null,
      membres: ['SIEGE', 'C1'],
      exercices: [
        ex('s25', 'SIEGE', '2025-01-01'),
        ex('s26', 'SIEGE', '2026-01-01'),
        ex('c25', 'C1', '2025-01-01', StatutExercice.CLOTURE),
        ex('c26', 'C1', '2026-01-01'),
      ],
      // Siège · 2 000 000 virés en 2025, 2026 sans ouverture (provisoire) ;
      // cellule · réception en 2025, reportée en 2026.
      soldes585: { s25: 2_000_000, s26: 0, c25: -2_000_000, c26: -2_000_000 },
    });
    expect(await service.virements585DuGroupe('C1', AU_31_12_2026)).toEqual({ solde: 0 });
  });

  /**
   * Paquet 1, A8 (relevé majeur après le second tour de G1) · la
   * contre-passation d'une réévaluation des devises passée par le module au
   * premier jour, l'exercice précédent encore ouvert, n'est pas une ouverture
   * (`filtreOuverturePasseeAuPremierJour`) · elle n'arrête plus la remontée.
   * La doublure ÉVALUE la requête de comptage sur les écritures du premier
   * jour de chaque exercice, au lieu de répondre par l'exercice seul.
   */
  it('A8 · une contre-passation de réévaluation au premier jour n’arrête pas la remontée vers l’exercice précédent ouvert', async () => {
    const extourne = ecritureDuPremierJour('ext', 'C1', 'c26', '2026-01-01', { reevaluationExtourne: { id: 'r25' } });
    const jouer = () =>
      monter({
        dossierMereId: null,
        membres: ['SIEGE', 'C1'],
        exercices: [ex('s26', 'SIEGE', '2026-01-01'), ex('c25', 'C1', '2025-01-01'), ex('c26', 'C1', '2026-01-01')],
        // La cellule a reçu le virement du siège en 2025, encore ouvert ; 2026
        // ne porte que la contre-passation au premier jour.
        soldes585: { s26: 2_000_000, c25: -2_000_000, c26: 0 },
        ecritures: [extourne],
      }).service.virements585DuGroupe('SIEGE', AU_31_12_2026);
    expect(await jouer()).toEqual({ solde: 0 });
    // Liée à rien, la même OD est une ouverture validée · la remontée s'arrête.
    extourne.reevaluationExtourne = null;
    expect(await jouer()).toEqual({ solde: 2_000_000 });
  });

  /**
   * Relecture du paquet 1, B2 · une OD d'ouverture validée au premier jour,
   * puis annulée par son négatif daté plus tard (AUDCIF art. 20, al. 2) ·
   * l'exercice n'a plus d'ouverture, la remontée vers l'exercice précédent
   * encore ouvert se fait. Lue comme la clôture la lit (position nette).
   */
  it('B2 · une OD d’ouverture annulée par son négatif n’arrête pas la remontée', async () => {
    const od = ecritureDuPremierJour('od', 'C1', 'c26', '2026-01-01');
    const negatif = ecritureDuPremierJour('neg', 'C1', 'c26', '2026-02-15', {
      corrigeEcritureId: 'od',
      corrigeEcriture: od,
      lignes: (od.lignes as R[]).map((l, i) => ({ ...l, id: `neg-${i}`, ecritureId: 'neg', debit: -(l.debit as number), credit: -(l.credit as number) })),
    });
    const jouer = (ecritures: R[]) =>
      monter({
        dossierMereId: null,
        membres: ['SIEGE', 'C1'],
        exercices: [ex('s26', 'SIEGE', '2026-01-01'), ex('c25', 'C1', '2025-01-01'), ex('c26', 'C1', '2026-01-01')],
        soldes585: { s26: 2_000_000, c25: -2_000_000, c26: 0 },
        ecritures,
      }).service.virements585DuGroupe('SIEGE', AU_31_12_2026);
    expect(await jouer([od, negatif])).toEqual({ solde: 0 });
    // Sans son négatif, l'OD fait foi · la remontée s'arrête.
    expect(await jouer([od])).toEqual({ solde: 2_000_000 });
  });

  it('lignes validées du 585 de l’exercice, datées au plus tard la date, hors solde des comptes de gestion', async () => {
    const { service, prisma } = monter({
      dossierMereId: null,
      membres: ['SIEGE'],
      exercices: [ex('s26', 'SIEGE', '2026-01-01')],
      soldes585: {},
    });
    await service.virements585DuGroupe('SIEGE', AU_31_12_2026);
    expect(prisma.exercice.findMany.mock.calls[0][0]).toEqual({
      where: { tenantId: { in: ['SIEGE'] }, dateDebut: { lte: AU_31_12_2026 } },
      select: { id: true, tenantId: true, dateDebut: true, statut: true },
      orderBy: { dateDebut: 'asc' },
    });
    expect(prisma.ligneEcriture.aggregate.mock.calls[0][0]).toEqual({
      where: {
        compte: { tenantId: 'SIEGE', numero: { startsWith: '585' } },
        ecriture: {
          tenantId: 'SIEGE',
          exerciceId: 's26',
          date: { lte: AU_31_12_2026 },
          statut: 'VALIDEE',
          estSoldeDesComptesDeGestion: false,
        },
      },
      _sum: { debit: true, credit: true },
    });
  });
});
