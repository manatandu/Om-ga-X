import { readFileSync } from 'fs';
import { join } from 'path';
import { RoleUtilisateur } from '@prisma/client';
import { PrismaService } from '../../common/prisma.service';
import { UtilisateurService } from './utilisateur.service';
import { LOGICIELS, logicielsDeLaSession } from './logiciels';

/**
 * LOGICIELS ATTRIBUÉS · un affichage, jamais un droit. Ce qui casserait en
 * silence : un utilisateur existant qui perdrait ses tuiles, un administrateur
 * restreint, une attribution qui ferme les sessions ou qui sort du dossier.
 */
describe('logicielsDeLaSession · null veut dire toutes les tuiles', () => {
  it('un utilisateur sans restriction (les existants) reçoit null, jamais une liste vide', () => {
    expect(logicielsDeLaSession({ role: 'COMPTABLE', restreindreLogiciels: false, logicielsAutorises: [] })).toBeNull();
    expect(logicielsDeLaSession({ role: 'COMPTABLE' })).toBeNull();
  });

  it('un administrateur n’est jamais restreint, même si sa ligne porte le drapeau', () => {
    expect(logicielsDeLaSession({ role: 'ADMIN_CABINET', restreindreLogiciels: true, logicielsAutorises: ['PAIE'] })).toBeNull();
  });

  it('une restriction rend sa liste, sans la clé qu’aucune tuile ne porte plus', () => {
    expect(
      logicielsDeLaSession({ role: 'COMPTABLE', restreindreLogiciels: true, logicielsAutorises: ['PAIE', 'ANCIENNE_TUILE'] }),
    ).toEqual(['PAIE']);
  });
});

describe('la définition des logiciels attribués', () => {
  function service(role: RoleUtilisateur) {
    const update = jest.fn(async (a: unknown) => a);
    const findFirst = jest.fn(async () => ({ id: 'u2', role }));
    const p = { user: { findFirst, update } };
    return { s: new UtilisateurService(p as unknown as PrismaService), update, findFirst };
  }

  it('lit l’utilisateur BORNÉ au dossier (cloisonnement)', async () => {
    const { s, findFirst } = service(RoleUtilisateur.COMPTABLE);
    await s.definirLogiciels('t1', 'u2', { restreindre: true, logiciels: ['PAIE'] });
    expect(findFirst).toHaveBeenCalledWith({ where: { id: 'u2', tenantId: 't1' } });
  });

  it('refuse de restreindre un administrateur, sans rien écrire', async () => {
    const { s, update } = service(RoleUtilisateur.ADMIN_CABINET);
    await expect(s.definirLogiciels('t1', 'u2', { restreindre: true, logiciels: ['PAIE'] })).rejects.toThrow(/jamais restreint/);
    expect(update).not.toHaveBeenCalled();
  });

  it('refuse une restriction sans aucun logiciel et une clé inconnue', async () => {
    const { s, update } = service(RoleUtilisateur.COMPTABLE);
    await expect(s.definirLogiciels('t1', 'u2', { restreindre: true, logiciels: [] })).rejects.toThrow(/au moins un logiciel/);
    await expect(s.definirLogiciels('t1', 'u2', { restreindre: true, logiciels: ['PIRATE'] })).rejects.toThrow(/inconnu/);
    expect(update).not.toHaveBeenCalled();
  });

  it('pose la liste sans doublon et NE FERME AUCUNE SESSION (c’est un affichage)', async () => {
    const { s, update } = service(RoleUtilisateur.COMPTABLE);
    await s.definirLogiciels('t1', 'u2', { restreindre: true, logiciels: ['PAIE', 'COMPTABILITE', 'PAIE'] });
    const data = (update.mock.calls[0][0] as { data: Record<string, unknown> }).data;
    expect(data).toEqual({ restreindreLogiciels: true, logicielsAutorises: ['PAIE', 'COMPTABILITE'] });
    expect(data).not.toHaveProperty('sessionsInvalidesAvant');
  });

  it('lever la restriction (null = toutes) vide la liste', async () => {
    const { s, update } = service(RoleUtilisateur.COMPTABLE);
    await s.definirLogiciels('t1', 'u2', { restreindre: false, logiciels: ['PAIE'] });
    expect((update.mock.calls[0][0] as { data: Record<string, unknown> }).data).toEqual({
      restreindreLogiciels: false,
      logicielsAutorises: [],
    });
  });

  it('lever la restriction d’un administrateur reste permis (rien à restreindre)', async () => {
    const { s, update } = service(RoleUtilisateur.ADMIN_CABINET);
    await s.definirLogiciels('t1', 'u2', { restreindre: false, logiciels: [] });
    expect(update).toHaveBeenCalled();
  });
});

describe('la route et la session', () => {
  const controleur = readFileSync(join(__dirname, 'utilisateur.controller.ts'), 'utf8');
  const auth = readFileSync(join(__dirname, '..', 'auth', 'auth.service.ts'), 'utf8');

  it('la route d’écriture porte @Roles(ADMIN_CABINET) sur elle-même', () => {
    expect(controleur).toMatch(/@Roles\(RoleUtilisateur\.ADMIN_CABINET\)\s*@Put\(':id\/logiciels'\)/);
  });

  it('/auth/me rend les logiciels par la règle commune, sans relire le drapeau à la main', () => {
    expect(auth).toContain('logicielsAutorises: logicielsDeLaSession(user),');
  });

  it('le service ne ferme aucune session dans cette méthode', () => {
    const service = readFileSync(join(__dirname, 'utilisateur.service.ts'), 'utf8');
    const corps = service.slice(service.indexOf('async definirLogiciels'), service.indexOf('async modifier('));
    expect(corps).not.toContain('sessionsInvalidesAvant');
  });

  it('la liste fermée a neuf tuiles, sans doublon', () => {
    expect(new Set(LOGICIELS).size).toBe(LOGICIELS.length);
    expect(LOGICIELS).toHaveLength(9);
  });
});
