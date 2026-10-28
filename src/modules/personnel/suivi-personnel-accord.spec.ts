import { ConflictException } from '@nestjs/common';
import { SuiviPersonnelService } from './suivi-personnel.service';

/**
 * M2 DE LA RELECTURE · l'accord d'une demande de congé en trois écritures
 * hors transaction laissait, au lien manqué, une demande ACCORDÉE sans congé,
 * enfermée. Le congé naît d'abord, la demande est prise en une écriture
 * conditionnelle qui porte le lien, et un compte nul annule le congé né.
 */
const demande = {
  id: 'd1',
  tenantId: 't1',
  salarieId: 's1',
  du: new Date('2027-03-01T00:00:00Z'),
  au: new Date('2027-03-12T00:00:00Z'),
  joursVoyage: 0,
  moisDePaie: '2027-03',
  statut: 'DEMANDEE',
  saisiePar: 'auteur@x.cd',
  congeId: null,
};

function monter(compte: number) {
  const ordre: string[] = [];
  const prisma = {
    demandeCongeSalarie: {
      findFirst: jest.fn(async () => demande),
      updateMany: jest.fn(async () => {
        ordre.push('prise');
        return { count: compte };
      }),
    },
  };
  const conges = {
    creerConge: jest.fn(async () => {
      ordre.push('conge');
      return { id: 'c1', jours: 10, avertissements: [] };
    }),
    annulerConge: jest.fn(async () => {
      ordre.push('annulation');
      return { annule: true };
    }),
  };
  return { prisma, conges, ordre, service: new SuiviPersonnelService(prisma as never, conges as never) };
}

describe('Demande de congé · l’accord ne laisse jamais une demande accordée sans congé (M2)', () => {
  it('le congé naît d’abord, puis la demande est prise en une écriture qui porte le lien', async () => {
    const { prisma, ordre, service } = monter(1);
    const r = await service.accorder('t1', 'decideur@x.cd', 'd1', {} as never);
    expect(r.congeId).toBe('c1');
    expect(ordre).toEqual(['conge', 'prise']);
    expect(prisma.demandeCongeSalarie.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 'd1', statut: 'DEMANDEE', congeId: null }),
        data: expect.objectContaining({ statut: 'ACCORDEE', congeId: 'c1' }),
      }),
    );
  });

  it('décidée entre-temps · 409, et le congé né de cet accord est annulé', async () => {
    const { conges, ordre, service } = monter(0);
    await expect(service.accorder('t1', 'decideur@x.cd', 'd1', {} as never)).rejects.toBeInstanceOf(ConflictException);
    expect(conges.annulerConge).toHaveBeenCalledWith('t1', 'decideur@x.cd', 'c1', expect.stringContaining('décidée entre-temps'));
    expect(ordre).toEqual(['conge', 'prise', 'annulation']);
  });

  it('un congé refusé ne touche pas la demande · elle reste en attente', async () => {
    const { prisma, conges, service } = monter(1);
    conges.creerConge.mockRejectedValueOnce(new Error('refus du congé'));
    await expect(service.accorder('t1', 'decideur@x.cd', 'd1', {} as never)).rejects.toThrow('refus du congé');
    expect(prisma.demandeCongeSalarie.updateMany).not.toHaveBeenCalled();
  });
});

describe('Demande de congé · l’issue de la demande accordée sans congé héritée', () => {
  function monterReparation(d: Record<string, unknown>, conge: Record<string, unknown> | null, autre: unknown = null) {
    const tx = {
      $queryRaw: jest.fn(async () => []),
      demandeCongeSalarie: {
        findFirst: jest.fn(async (a: { where: { congeId?: string } }) => (a.where.congeId ? autre : d)),
        update: jest.fn(async () => ({})),
      },
      congeSalarie: { findFirst: jest.fn(async () => conge) },
    };
    const prisma = { $transaction: jest.fn(async (fn: (t: unknown) => unknown) => fn(tx)) };
    return { tx, service: new SuiviPersonnelService(prisma as never, {} as never) };
  }
  const heritee = { ...demande, statut: 'ACCORDEE', congeId: null };

  it('remise en attente, motif écrit, par une mise à jour unitaire', async () => {
    const { tx, service } = monterReparation(heritee, null);
    const r = await service.reparerDemandeSansConge('t1', 'x@x.cd', 'd1', { action: 'REMETTRE_EN_ATTENTE', motif: 'lien perdu' });
    expect(r.statut).toBe('DEMANDEE');
    expect(tx.demandeCongeSalarie.update).toHaveBeenCalledWith({
      where: { id: 'd1' },
      data: expect.objectContaining({ statut: 'DEMANDEE', decisionPar: null, motifDecision: expect.stringContaining('lien perdu') }),
    });
  });

  it('reliée au congé posé pour elle · mêmes dates, même salarié', async () => {
    const conge = { id: 'c9', salarieId: 's1', du: demande.du, au: demande.au, annuleLe: null };
    const { tx, service } = monterReparation(heritee, conge);
    await service.reparerDemandeSansConge('t1', 'x@x.cd', 'd1', { action: 'RELIER', congeId: 'c9', motif: 'lien perdu' });
    expect(tx.demandeCongeSalarie.update).toHaveBeenCalledWith({ where: { id: 'd1' }, data: expect.objectContaining({ congeId: 'c9' }) });
  });

  it('une demande qui a son congé ne se répare pas', async () => {
    const { service } = monterReparation({ ...heritee, congeId: 'c1' }, null);
    await expect(service.reparerDemandeSansConge('t1', 'x@x.cd', 'd1', { action: 'REMETTRE_EN_ATTENTE', motif: 'xxx' })).rejects.toBeInstanceOf(ConflictException);
  });
});

describe('Demande de congé · chevauchement et double envoi', () => {
  it('une demande qui chevauche une demande en attente du même salarié est refusée, sous le verrou du salarié', async () => {
    const ordre: string[] = [];
    const tx = {
      $queryRaw: jest.fn(async () => {
        ordre.push('verrou');
        return [];
      }),
      demandeCongeSalarie: {
        findFirst: jest.fn(async () => {
          ordre.push('lecture');
          return { du: demande.du, au: demande.au, demandeLe: demande.du };
        }),
        create: jest.fn(),
      },
    };
    const prisma = {
      salarie: { findFirst: jest.fn(async () => ({ id: 's1' })) },
      $transaction: jest.fn(async (fn: (t: unknown) => unknown) => fn(tx)),
    };
    const service = new SuiviPersonnelService(prisma as never, {} as never);
    await expect(
      service.creerDemande('t1', 'a@x.cd', 's1', { du: '2027-03-05', au: '2027-03-08', moisDePaie: '2027-03', demandeLe: '2027-02-01' } as never),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(tx.demandeCongeSalarie.create).not.toHaveBeenCalled();
    expect(ordre).toEqual(['verrou', 'lecture']);
  });
});
