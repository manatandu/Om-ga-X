import { BadRequestException, NotFoundException } from '@nestjs/common';
import { RoleUtilisateur } from '@prisma/client';
import { ROLES_KEY } from '../../common/decorators/roles.decorator';
import { PrismaService } from '../../common/prisma.service';
import { sessionRevoquee } from '../auth/jwt.strategy';
import { UtilisateurController } from './utilisateur.controller';
import { MOTIF_DECONNEXION_DE_SOI, UtilisateurService } from './utilisateur.service';

/**
 * DÉCONNECTER UN UTILISATEUR (2026-10-21, gel levé par Manasse · « la 2e
 * possibilité. Fais le proprement », fonction vue chez Microfina++, p. 18).
 *
 * Ce qui casserait en silence · un geste qui retouche AUSSI le mot de passe,
 * le rôle ou le verrou (l'administrateur croit fermer une session et change
 * un accès), un geste qui atteint le compte d'un autre dossier, et une pose
 * que `JwtStrategy` ne lirait pas (le collaborateur resterait connecté).
 */

type Compte = { id: string; tenantId: string; role: RoleUtilisateur; estActif: boolean };

function prisma(comptes: Compte[]) {
  const ecrits: Array<{ id: string; data: Record<string, unknown> }> = [];
  const user = {
    findFirst: jest.fn(({ where }: { where: { id: string; tenantId: string } }) =>
      Promise.resolve(comptes.find((c) => c.id === where.id && c.tenantId === where.tenantId) ?? null),
    ),
    update: jest.fn(({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
      ecrits.push({ id: where.id, data });
      return Promise.resolve({ id: where.id });
    }),
  };
  return { p: { user } as unknown as PrismaService, ecrits };
}

const comptable: Compte = { id: 'c1', tenantId: 'd-1', role: RoleUtilisateur.COMPTABLE, estActif: true };
const admin: Compte = { id: 'a1', tenantId: 'd-1', role: RoleUtilisateur.ADMIN_CABINET, estActif: true };
const voisin: Compte = { id: 'v1', tenantId: 'd-2', role: RoleUtilisateur.COMPTABLE, estActif: true };

describe('déconnecter un utilisateur · ferme les sessions, et rien d’autre', () => {
  it('pose la seule révocation, que la stratégie de session lit aussitôt', async () => {
    const { p, ecrits } = prisma([admin, comptable]);
    const avant = Date.now();
    await new UtilisateurService(p).deconnecter('d-1', 'c1', 'a1');
    expect(ecrits).toHaveLength(1);
    expect(ecrits[0].id).toBe('c1');
    // AUCUN autre champ · ni mot de passe, ni rôle, ni verrou, ni second facteur.
    expect(Object.keys(ecrits[0].data)).toEqual(['sessionsInvalidesAvant']);
    const pose = ecrits[0].data.sessionsInvalidesAvant as Date;
    expect(pose).toBeInstanceOf(Date);
    expect(pose.getTime()).toBeGreaterThanOrEqual(avant);
    // Un jeton signé une seconde avant le geste est refusé, comme pour toute révocation.
    const iatAvant = Math.floor(pose.getTime() / 1000) - 1;
    expect(sessionRevoquee(iatAvant, pose)).toBe(true);
    // Une reconnexion après le geste repasse.
    expect(sessionRevoquee(Math.floor(pose.getTime() / 1000) + 1, pose)).toBe(false);
  });

  it('refuse sa propre session et renvoie à « Mon compte », sans rien écrire', async () => {
    const { p, ecrits } = prisma([admin]);
    const geste = new UtilisateurService(p).deconnecter('d-1', 'a1', 'a1');
    await expect(geste).rejects.toBeInstanceOf(BadRequestException);
    await expect(new UtilisateurService(p).deconnecter('d-1', 'a1', 'a1')).rejects.toThrow(MOTIF_DECONNEXION_DE_SOI);
    expect(ecrits).toHaveLength(0);
  });

  it('n’atteint jamais le compte d’un autre dossier', async () => {
    const { p, ecrits } = prisma([admin, voisin]);
    await expect(new UtilisateurService(p).deconnecter('d-1', 'v1', 'a1')).rejects.toBeInstanceOf(NotFoundException);
    expect(ecrits).toHaveLength(0);
  });

  it('déconnecte aussi un autre administrateur · le geste ne retire aucun droit', async () => {
    const autre: Compte = { ...admin, id: 'a2' };
    const { p, ecrits } = prisma([admin, autre]);
    await new UtilisateurService(p).deconnecter('d-1', 'a2', 'a1');
    expect(ecrits.map((e) => e.id)).toEqual(['a2']);
  });

  it('la route vit dans le contrôleur réservé à l’administrateur du dossier', () => {
    expect(Reflect.getMetadata(ROLES_KEY, UtilisateurController)).toEqual([RoleUtilisateur.ADMIN_CABINET]);
    const methode = UtilisateurController.prototype.deconnecter;
    expect(Reflect.getMetadata('path', methode)).toBe(':id/deconnecter');
    // 1 = RequestMethod.POST
    expect(Reflect.getMetadata('method', methode)).toBe(1);
  });
});
