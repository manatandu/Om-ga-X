import { ConflictException } from '@nestjs/common';
import { Referentiel, SystemeComptableSyscohada } from '@prisma/client';
import { ImmobilisationService } from './immobilisation.service';
import { PrismaService } from '../../common/prisma.service';
import { EcritureService } from '../comptabilite/ecriture.service';

/**
 * LE VERROU DE LA FICHE ENTRE LA DOTATION ET L'ANNULATION D'UN TRAITEMENT
 * (ligne sage-l4, relecture). Ce qui casserait en silence · une dotation de
 * N+1 calculée pendant que la dotation de N s'annule, enregistrée APRÈS sur un
 * cumul que le journal ne porte plus, sur une écriture équilibrée.
 */

type Faux = Record<string, unknown>;

function fiche(dotations: Array<{ id: string; montant: number }>) {
  return {
    id: 'i1',
    designation: 'Camion',
    statut: 'EN_SERVICE',
    valeurOrigine: 12_000_000,
    valeurResiduelle: 0,
    dureeAmortissementAns: 4,
    dateMiseEnService: new Date('2025-01-01'),
    amortissementAnterieur: 0,
    compteDotationId: 'cd',
    compteAmortissementId: 'ca',
    compteImmobilisation: { numero: '24510000' },
    dotations: dotations.map((d) => ({ ...d, exerciceId: `ex-${d.id}` })),
    depreciations: [],
  };
}

function fabrique(relue: ReturnType<typeof fiche>) {
  const lue = fiche([{ id: 'dN', montant: 3_000_000 }]);
  const prisma: Faux = {
    tenant: {
      findUniqueOrThrow: jest.fn().mockResolvedValue({ referentiel: Referentiel.SYSCOHADA, systemeComptableSyscohada: SystemeComptableSyscohada.NORMAL }),
    },
    immobilisation: {
      // La première lecture calcule ; la seconde, sous le verrou, relit.
      findFirst: jest.fn().mockResolvedValueOnce(lue).mockResolvedValueOnce(relue),
    },
    exercice: {
      findFirst: jest.fn().mockResolvedValue({ id: 'exN1', dateDebut: new Date('2026-01-01'), dateFin: new Date('2026-12-31') }),
    },
    dotationAmortissement: {
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ id: 'dN1', montant: 3_000_000 }),
    },
    ligneReevaluationBilan: { findFirst: jest.fn().mockResolvedValue(null), findMany: jest.fn().mockResolvedValue([]) },
    ligneEcriture: { deleteMany: jest.fn().mockResolvedValue({ count: 2 }) },
    ecriture: { delete: jest.fn().mockResolvedValue({}) },
  };
  prisma.$transaction = jest.fn((f: (tx: unknown) => unknown) => f(prisma));
  prisma.$queryRaw = jest.fn().mockResolvedValue([]);
  const ecritures = { creer: jest.fn().mockResolvedValue({ id: 'e-dot' }) } as unknown as EcritureService;
  return { svc: new ImmobilisationService(prisma as unknown as PrismaService, ecritures), prisma: prisma as Record<string, any> };
}

describe('la dotation relit la fiche sous son verrou', () => {
  it('la fiche inchangée · la dotation s’enregistre, après le verrou de la ligne du bien', async () => {
    const { svc, prisma } = fabrique(fiche([{ id: 'dN', montant: 3_000_000 }]));
    await svc.passerDotation('t1', 'u1', 'i1', { exerciceId: 'exN1', journalId: 'j1' } as never);
    expect(prisma.dotationAmortissement.create).toHaveBeenCalledTimes(1);
    const sql = (prisma.$queryRaw.mock.calls[0][0] as string[]).join('?');
    expect(sql).toMatch(/FROM "immobilisations" WHERE id = \? AND "tenantId" = \? FOR UPDATE/);
  });

  it('la dotation de N annulée entre le calcul et l’enregistrement · 409, rien au journal', async () => {
    const { svc, prisma } = fabrique(fiche([]));
    await expect(svc.passerDotation('t1', 'u1', 'i1', { exerciceId: 'exN1', journalId: 'j1' } as never)).rejects.toThrow(ConflictException);
    expect(prisma.dotationAmortissement.create).not.toHaveBeenCalled();
    // L'écriture de la dotation, passée avant le verrou, est retirée.
    expect(prisma.ecriture.delete).toHaveBeenCalledWith({ where: { id: 'e-dot' } });
  });
});
