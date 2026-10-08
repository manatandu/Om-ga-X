import { GroupeService } from './groupe.service';
import { perimetreCourant } from '../../common/cloisonnement/contexte-cloisonnement';
import { PrismaService } from '../../common/prisma.service';

/**
 * LE 585 DU GROUPE, LU POUR LA CLÔTURE D'UN DE SES DOSSIERS (G1, relecture
 * du 2026-10-08). Fiche SYCEBNL du compte 58 · « soldés à la fin de
 * l'exercice », sur l'entité, qui est le groupe. Un transfert passé d'un
 * seul côté laissait clôturer les deux dossiers, puis la liasse du groupe
 * restait refusée, ses exercices clos.
 *
 * Ce spec tient trois propriétés · le groupe se lit sur le dossier de la
 * SESSION (sa mère, jamais un dossier reçu), ses dossiers sont lus DANS le
 * périmètre du groupe (la garde de cloisonnement continue de tourner), et la
 * somme ne prend que le livre-journal des exercices de même période.
 */
function monter(dossierMereId: string | null) {
  const perimetres: Array<ReadonlySet<string> | undefined> = [];
  const prisma = {
    tenant: {
      findUnique: jest.fn().mockResolvedValue({ dossierMereId }),
      findMany: jest.fn().mockResolvedValue([{ id: 'SIEGE' }, { id: 'C1' }, { id: 'C2' }]),
    },
    exercice: {
      findMany: jest.fn(() => {
        perimetres.push(perimetreCourant());
        return Promise.resolve([
          { id: 'eS', tenantId: 'SIEGE' },
          { id: 'e1', tenantId: 'C1' },
        ]);
      }),
    },
    ligneEcriture: {
      aggregate: jest.fn(() => {
        perimetres.push(perimetreCourant());
        return Promise.resolve({ _sum: { debit: 2_000_000, credit: 1_500_000 } });
      }),
    },
  };
  const service = new GroupeService(prisma as unknown as PrismaService, {} as never, {} as never, {} as never);
  return { service, prisma, perimetres };
}

const PERIODE = { dateDebut: new Date('2026-01-01'), dateFin: new Date('2026-12-31') };

describe('le 585 du groupe sur une période', () => {
  it('une cellule lit son groupe par SA mère, dans le périmètre du groupe', async () => {
    const { service, prisma, perimetres } = monter('SIEGE');
    const r = await service.virements585DuGroupe('C1', PERIODE);

    expect(prisma.tenant.findUnique).toHaveBeenCalledWith({ where: { id: 'C1' }, select: { dossierMereId: true } });
    expect(prisma.tenant.findMany.mock.calls[0][0].where).toEqual({ OR: [{ id: 'SIEGE' }, { dossierMereId: 'SIEGE' }] });
    // Chaque lecture cloisonnée tourne dans le périmètre des membres.
    for (const p of perimetres) expect([...(p ?? [])].sort()).toEqual(['C1', 'C2', 'SIEGE']);
    // Un solde débiteur de 500 000 · un transfert passé d'un seul côté.
    expect(r).toEqual({ solde: 500_000, dossiersSansExercice: 1 });
  });

  it('le siège est sa propre mère', async () => {
    const { service, prisma } = monter(null);
    await service.virements585DuGroupe('SIEGE', PERIODE);
    expect(prisma.tenant.findMany.mock.calls[0][0].where).toEqual({ OR: [{ id: 'SIEGE' }, { dossierMereId: 'SIEGE' }] });
  });

  it('exercices de même période, livre-journal seul, hors solde des comptes de gestion, au seul 585', async () => {
    const { service, prisma } = monter('SIEGE');
    await service.virements585DuGroupe('C1', PERIODE);
    expect(prisma.exercice.findMany.mock.calls[0]).toEqual([
      {
        where: { tenantId: { in: ['SIEGE', 'C1', 'C2'] }, dateDebut: PERIODE.dateDebut, dateFin: PERIODE.dateFin },
        select: { id: true, tenantId: true },
      },
    ]);
    expect(prisma.ligneEcriture.aggregate.mock.calls[0]).toEqual([
      {
        where: {
          compte: { tenantId: { in: ['SIEGE', 'C1', 'C2'] }, numero: { startsWith: '585' } },
          ecriture: {
            tenantId: { in: ['SIEGE', 'C1', 'C2'] },
            exerciceId: { in: ['eS', 'e1'] },
            statut: 'VALIDEE',
            estSoldeDesComptesDeGestion: false,
          },
        },
        _sum: { debit: true, credit: true },
      },
    ]);
  });
});
