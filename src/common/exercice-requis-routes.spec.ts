import 'reflect-metadata';
import { BadRequestException, NotFoundException, PipeTransform } from '@nestjs/common';
import { ROUTE_ARGS_METADATA } from '@nestjs/common/constants';
import { RouteParamtypes } from '@nestjs/common/enums/route-paramtypes.enum';
import { EXERCICE_REQUIS, MESSAGE_EXERCICE_HORS_DOSSIER, MESSAGE_EXERCICE_REQUIS } from './exercice-requis';
import { dansContexteAudit } from './audit/contexte-audit';
import { AnalytiqueController } from '../modules/analytique/analytique.controller';
import { IfrsController } from '../modules/ifrs/ifrs.controller';
import { EngagementService } from '../modules/analytique/engagement.service';
import { PrismaService } from './prisma.service';

/**
 * TROIS ROUTES QUI LISAIENT `exerciceId` SANS LE PORTEUR.
 *
 * Le registre des engagements et ses écritures rattachables (analytique), et
 * le retrait d'un effet de change déclaré (IFRS). Un `@Query` ou un `@Param`
 * scalaire échappe au ValidationPipe global · absent, l'identifiant arrivait
 * `undefined` à Prisma, qui IGNORE le champ, et le registre rendait les
 * engagements de TOUS les exercices ; illisible, il rendait une liste vide ou
 * un 404 qui nommait un exercice que la requête ne désignait pas.
 *
 * Chaque route est lue sur les MÉTADONNÉES que Nest lit lui-même pour la
 * câbler (ROUTE_ARGS_METADATA), puis ses pipes sont JOUÉS sur un identifiant
 * illisible · c'est le refus qui est vérifié, pas la forme de la source.
 */

type Arg = { index: number; data?: unknown; pipes?: unknown[] };

/** Les pipes posés sur le paramètre `exerciceId` de la route, requête ou chemin. */
function pipesExercice(controleur: object, methode: string, type: RouteParamtypes): unknown[] {
  const args = (Reflect.getMetadata(ROUTE_ARGS_METADATA, controleur, methode) ?? {}) as Record<string, Arg>;
  const trouves = Object.entries(args).filter(
    ([cle, arg]) => Number(cle.split(':')[0]) === type && arg.data === 'exerciceId',
  );
  expect(trouves).toHaveLength(1);
  return trouves[0][1].pipes ?? [];
}

const ILLISIBLES: unknown[] = [undefined, '', 'ex-2026', '1'];
const ID = '0b5f9c1e-3a4d-4c2b-9f1e-2a7d6c8b1e30';
const ID_DU_VOISIN = '7c1d2e3f-4a5b-4c6d-8e7f-9a0b1c2d3e4f';
const DOSSIER = 'dossier-de-la-session';

/**
 * Joue les pipes de la route comme Nest les joue, dans l'ordre · une classe
 * (porteur injectable depuis C3) reçoit le client Prisma, ici une doublure qui
 * ne connaît l'exercice que dans le dossier de la session.
 */
async function jouer(pipes: unknown[], valeur: unknown, type: 'query' | 'param'): Promise<unknown> {
  const prisma = {
    exercice: {
      findFirst: async (a: { where: { id: string; tenantId: string } }) =>
        a.where.id === ID && a.where.tenantId === DOSSIER ? { id: ID } : null,
    },
  } as unknown as PrismaService;
  return dansContexteAudit({ acteurEmail: 'c@d.test', tenantId: DOSSIER }, async () => {
    let courant = valeur;
    for (const p of pipes) {
      const pipe = typeof p === 'function' ? new (p as new (x: PrismaService) => PipeTransform)(prisma) : (p as PipeTransform);
      courant = await pipe.transform(courant, { type, data: 'exerciceId' });
    }
    return courant;
  });
}

async function attendreRefusNomme(pipes: unknown[], type: 'query' | 'param') {
  for (const v of ILLISIBLES) {
    const refus = await jouer(pipes, v, type).catch((e: unknown) => e);
    expect(refus).toBeInstanceOf(BadRequestException);
    expect((refus as BadRequestException).message).toBe(MESSAGE_EXERCICE_REQUIS);
  }
  await expect(jouer(pipes, ID, type)).resolves.toBe(ID);
  // C3 · l'exercice d'un autre dossier est introuvable.
  const voisin = await jouer(pipes, ID_DU_VOISIN, type).catch((e: unknown) => e);
  expect(voisin).toBeInstanceOf(NotFoundException);
  expect((voisin as NotFoundException).message).toBe(MESSAGE_EXERCICE_HORS_DOSSIER);
}

describe('exerciceId exigé par le porteur · les trois routes qui y échappaient', () => {
  it('GET /analytique/engagements refuse un exercice absent ou illisible par un 400 nommé', async () => {
    const pipes = pipesExercice(AnalytiqueController, 'listerEngagements', RouteParamtypes.QUERY);
    expect(pipes).toContain(EXERCICE_REQUIS);
    await attendreRefusNomme(pipes, 'query');
  });

  it('GET /analytique/engagements/ecritures-rattachables refuse un exercice absent ou illisible par un 400 nommé', async () => {
    const pipes = pipesExercice(AnalytiqueController, 'ecrituresRattachables', RouteParamtypes.QUERY);
    expect(pipes).toContain(EXERCICE_REQUIS);
    await attendreRefusNomme(pipes, 'query');
  });

  it('DELETE /ifrs/effet-change/:exerciceId refuse un identifiant illisible par un 400 nommé', async () => {
    const pipes = pipesExercice(IfrsController, 'supprimerEffetChange', RouteParamtypes.PARAM);
    expect(pipes).toContain(EXERCICE_REQUIS);
    await attendreRefusNomme(pipes, 'param');
  });
});

describe('le registre des engagements exige aussi l’exercice au service', () => {
  // Un appel qui ne passe pas par la route (un autre module, un traitement)
  // ne mêle pas davantage les exercices · et le refus précède toute lecture.
  function service() {
    const prisma = {
      engagementDepense: { findMany: jest.fn().mockResolvedValue([]) },
      ecriture: { findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0) },
    };
    return { service: new EngagementService(prisma as unknown as PrismaService), prisma };
  }

  it('lister refuse un exercice absent sans rien lire', async () => {
    const { service: s, prisma } = service();
    await expect(s.lister('t1', undefined as unknown as string)).rejects.toThrow(MESSAGE_EXERCICE_REQUIS);
    expect(prisma.engagementDepense.findMany).not.toHaveBeenCalled();
  });

  it('ecrituresRattachables refuse un exercice absent sans rien lire', async () => {
    const { service: s, prisma } = service();
    await expect(s.ecrituresRattachables('t1', undefined as unknown as string)).rejects.toThrow(MESSAGE_EXERCICE_REQUIS);
    expect(prisma.ecriture.findMany).not.toHaveBeenCalled();
  });
});
