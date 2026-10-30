import { BadRequestException, ConflictException } from '@nestjs/common';
import { StatutBulletinPaie } from '@prisma/client';
import { lierMissionsAuBulletin, MissionsService } from './missions.service';

/**
 * M1 DE LA RELECTURE · la course entre un frais ajouté et l'émission. La
 * simulation a porté 90 000 ; un frais de 30 000 est entré avant que la
 * transaction de l'émission ne lie la mission. Sans relecture, le bulletin
 * figeait 90 000 et la mission, liée, en portait 120 000.
 */
const portee = { missionId: 'm1', numero: 4, destination: 'Goma', forfaitFc: 90_000, justifieFc: 0 };

function txAvecFrais(frais: { element: string; qualification: string; montantFc: number }[], ordre: string[]) {
  return {
    $executeRaw: jest.fn(async () => 1), $queryRaw: jest.fn(async (parts: TemplateStringsArray) => {
      ordre.push(parts.join('?').includes('FOR UPDATE') ? 'verrou' : 'autre');
      return [];
    }),
    missionSalarie: {
      findFirst: jest.fn(async () => {
        ordre.push('lecture');
        return { id: 'm1', numero: 4, annuleLe: null, bulletin: null, frais: frais.map((f) => ({ ...f, montantFc: { toString: () => String(f.montantFc), valueOf: () => f.montantFc } })) };
      }),
      update: jest.fn(async () => ({})),
    },
  };
}

describe('Mission · la course entre un frais et l’émission (M1)', () => {
  it('des frais qui ont changé depuis la simulation refusent l’émission en 409, rien n’est lié', async () => {
    const ordre: string[] = [];
    const tx = txAvecFrais(
      [
        { element: 'HEBERGEMENT', qualification: 'FORFAIT', montantFc: 90_000 },
        { element: 'RESTAURATION', qualification: 'FORFAIT', montantFc: 30_000 },
      ],
      ordre,
    );
    await expect(lierMissionsAuBulletin(tx as never, 't1', 'b1', [portee])).rejects.toBeInstanceOf(ConflictException);
    expect(tx.missionSalarie.update).not.toHaveBeenCalled();
    // Le verrou de la mission précède la relecture de ses frais.
    expect(ordre.slice(0, 2)).toEqual(['verrou', 'lecture']);
  });

  it('des frais inchangés lient la mission au bulletin', async () => {
    const tx = txAvecFrais([{ element: 'HEBERGEMENT', qualification: 'FORFAIT', montantFc: 90_000 }], []);
    await lierMissionsAuBulletin(tx as never, 't1', 'b1', [portee]);
    expect(tx.missionSalarie.update).toHaveBeenCalledWith({ where: { id: 'm1' }, data: { bulletinId: 'b1' } });
  });

  it("l'ajout d'un frais relit le porteur DANS la transaction, sous le verrou · une mission portée entre-temps refuse", async () => {
    const ordre: string[] = [];
    const tx = {
      $executeRaw: jest.fn(async () => 1), $queryRaw: jest.fn(async () => {
        ordre.push('verrou');
        return [];
      }),
      missionSalarie: {
        findFirst: jest.fn(async () => {
          ordre.push('lecture');
          return { id: 'm1', numero: 4, annuleLe: null, dateDepart: new Date(), bulletin: { statut: StatutBulletinPaie.EMIS, numero: 12 }, _count: { frais: 1 } };
        }),
      },
      fraisMission: { create: jest.fn() },
    };
    const prisma = { $transaction: jest.fn(async (fn: (t: unknown) => unknown) => fn(tx)), missionSalarie: { findFirst: jest.fn() } };
    const service = new MissionsService(prisma as never);
    await expect(
      service.ajouterFrais('t1', 'a@b.c', 'm1', { element: 'RESTAURATION', qualification: 'FORFAIT', montantFc: 30_000 } as never),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(tx.fraisMission.create).not.toHaveBeenCalled();
    expect(prisma.$transaction).toHaveBeenCalled();
    // La lecture hors transaction n'est plus le juge · seul le client de la transaction a lu.
    expect(prisma.missionSalarie.findFirst).not.toHaveBeenCalled();
    expect(ordre).toEqual(['verrou', 'lecture']);
  });

  it('un ordre de mission sans contrat en vigueur au départ est refusé, nommé', async () => {
    const prisma = {
      salarie: { findFirst: jest.fn(async () => ({ id: 's1' })) },
      contratTravail: { findFirst: jest.fn(async () => null) },
      $transaction: jest.fn(),
    };
    const service = new MissionsService(prisma as never);
    const refus = service.creer('t1', 'a@b.c', 's1', { objet: 'Audit', destination: 'Goma', dateDepart: '2027-01-10', dateRetour: '2027-01-12' } as never);
    await expect(refus).rejects.toBeInstanceOf(BadRequestException);
    await expect(refus).rejects.toThrow(/Aucun contrat du salarié n'est en vigueur le 2027-01-10/);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
