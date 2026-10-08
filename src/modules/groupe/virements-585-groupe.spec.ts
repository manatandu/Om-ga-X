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

/**
 * Doublure qui HONORE les requêtes · les sommes du 585 par exercice, les
 * ouvertures validées par exercice ; les exercices filtrés par la date.
 */
function monter(options: {
  dossierMereId: string | null;
  membres: string[];
  exercices: Exercice[];
  soldes585: Record<string, number>;
  ouvertures?: string[];
}) {
  const perimetres: Array<ReadonlySet<string> | undefined> = [];
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
    },
    ecriture: {
      count: jest.fn((args: { where: { exerciceId: string } }) => {
        perimetres.push(perimetreCourant());
        return Promise.resolve((options.ouvertures ?? []).includes(args.where.exerciceId) ? 1 : 0);
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
