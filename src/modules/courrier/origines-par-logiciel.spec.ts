import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';
import { RoleUtilisateur, StatutMessage } from '@prisma/client';
import { PrismaService } from '../../common/prisma.service';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { LOGICIELS } from '../utilisateurs/logiciels';
import { CourrierController } from './courrier.controller';
import { CourrierService } from './courrier.service';
import { LOGICIELS_PAR_ORIGINE, originesLisibles } from './origines-par-logiciel';
import { TransportCourriel } from './transport-courriel';

/**
 * Ligne commercial-site · la file des courriers lue par logiciel. Ce qu'une
 * tuile émet, elle le lit ; une origine non rangée n'est servie à aucun
 * utilisateur restreint.
 */

function fichiers(dossier: string): string[] {
  return readdirSync(dossier).flatMap((nom) => {
    const chemin = join(dossier, nom);
    if (statSync(chemin).isDirectory()) return fichiers(chemin);
    return nom.endsWith('.ts') && !nom.endsWith('.spec.ts') ? [chemin] : [];
  });
}

describe('la table des origines est fermée', () => {
  const valeurs = fichiers(join(__dirname, '..', '..'))
    .flatMap((f) => [...readFileSync(f, 'utf8').matchAll(/export const ORIGINE_\w+ = '([A-Z_]+)'/g)].map((m) => m[1]));

  it('le relevé trouve encore les origines', () => {
    expect(valeurs.length).toBeGreaterThanOrEqual(12);
  });

  it('chaque origine de courrier de src/ est rangée sous au moins un logiciel connu', () => {
    expect(valeurs.filter((v) => !(v in LOGICIELS_PAR_ORIGINE))).toEqual([]);
    for (const [o, ls] of Object.entries(LOGICIELS_PAR_ORIGINE)) {
      expect([o, ls.length > 0 && ls.every((l) => (LOGICIELS as readonly string[]).includes(l))]).toEqual([o, true]);
    }
  });

  it('la paie ne lit ni les relances ni les avis de règlement, les tiers les lisent', () => {
    expect(originesLisibles(['PAIE'])).toEqual([]);
    expect(originesLisibles(['TIERS_TRESORERIE'])).toEqual(expect.arrayContaining(['RELANCE', 'AVIS_REGLEMENT']));
    expect(originesLisibles(['TIERS_TRESORERIE'])).not.toContain('MOT_DE_PASSE_TEMPORAIRE');
    expect(originesLisibles(null)).toBeNull();
  });
});

describe('le contrôleur filtre la file, la cloche, la fiche et la reprise', () => {
  function monter() {
    const message = {
      count: jest.fn(async (_a: unknown) => 0),
      findMany: jest.fn(async (_a: unknown) => [] as unknown[]),
      findFirst: jest.fn(async (_a: unknown) => null),
      groupBy: jest.fn(async (_a: unknown) => [] as unknown[]),
    };
    const transport = { etat: () => ({ configure: true, manques: [] }) } as unknown as TransportCourriel;
    const service = new CourrierService({ message } as unknown as PrismaService, transport);
    return { c: new CourrierController(service), message };
  }
  const paie = { userId: 'u', tenantId: 't', email: 'x', role: RoleUtilisateur.COMPTABLE, restreindreLogiciels: true, logicielsAutorises: ['PAIE'] } as AuthenticatedUser;
  const tiers = { ...paie, logicielsAutorises: ['TIERS_TRESORERIE'] } as AuthenticatedUser;
  const libre = { ...paie, restreindreLogiciels: false } as AuthenticatedUser;
  const filtre = (appel: unknown) => (appel as { where: { origine?: unknown } }).where.origine;

  it('la paie ne reçoit aucun message, ni dans la liste ni dans la cloche', async () => {
    const { c, message } = monter();
    await c.lister(paie, {});
    expect(filtre(message.findMany.mock.calls[0][0])).toEqual({ in: [] });
    expect(filtre(message.count.mock.calls[0][0])).toEqual({ in: [] });
    await c.compteurs(paie);
    expect(filtre(message.groupBy.mock.calls[0][0])).toEqual({ in: [] });
  });

  it('un message hors de ses origines est introuvable (404), jamais servi', async () => {
    const { c, message } = monter();
    await expect(c.lire(paie, 'm1')).rejects.toThrow(/introuvable/);
    expect(filtre(message.findFirst.mock.calls[0][0])).toEqual({ in: [] });
  });

  it('la reprise ne fait partir que ce qu’émettent ses logiciels', async () => {
    const { c, message } = monter();
    await c.reprendre(tiers, {});
    const where = message.findMany.mock.calls[0][0] as unknown as { where: { origine: { in: string[] }; tenantId: string } };
    expect(where.where.tenantId).toBe('t');
    expect(where.where.origine.in).toEqual(expect.arrayContaining(['RELANCE', 'AVIS_REGLEMENT']));
    expect(where.where.origine.in).not.toContain('DEMANDE_INFORMATION');
  });

  it('un utilisateur non restreint lit toute la file', async () => {
    const { c, message } = monter();
    await c.lister(libre, { statut: StatutMessage.ECHEC });
    expect(filtre(message.findMany.mock.calls[0][0])).toBeUndefined();
  });
});
