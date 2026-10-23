import 'reflect-metadata';
import { CanActivate, ExecutionContext, INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { TiersController } from './tiers.controller';
import { TiersService } from './tiers.service';
import { PrismaService } from '../../common/prisma.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { LicenceGuard } from '../licence/licence.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { configurerApplication } from '../../bootstrap';

/**
 * UNE ENTRÉE MALFORMÉE EST UN 400 NOMMÉ, JAMAIS UNE PANNE 500 (relevé de
 * sécurité du 2026-10-23, sondé sur instance jetable). `?type[]=X` arrivait au
 * contrôleur en TABLEAU et tombait sur le filtre d'énumération de Prisma · 500.
 * Le filtre `type` est validé par un ParseEnumPipe, `recherche` refuse un
 * tableau · ce spec monte un vrai serveur Nest avec le pipe de production, seul
 * endroit où le pipe est vraiment joué. Même modèle que F207 (ordres de virement).
 */
describe('la liste des tiers juge son entrée · 400, pas 500', () => {
  let app: INestApplication;
  let port: number;

  const session: CanActivate = {
    canActivate(ctx: ExecutionContext) {
      ctx.switchToHttp().getRequest().user = { id: 'u-1', tenantId: 'dossier-1', role: 'ADMIN_CABINET' };
      return true;
    },
  };

  const prisma = { tiers: { findMany: jest.fn(async () => []) } };

  beforeAll(async () => {
    const mod = await Test.createTestingModule({
      controllers: [TiersController],
      providers: [{ provide: TiersService, useValue: new TiersService(prisma as never) }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(session)
      .overrideGuard(LicenceGuard)
      .useValue(session)
      .overrideGuard(RolesGuard)
      .useValue(session)
      .compile();
    app = mod.createNestApplication();
    configurerApplication(app);
    await app.listen(0);
    port = (app.getHttpServer().address() as { port: number }).port;
  });

  afterAll(async () => {
    await app.close();
  });

  const lire = async (requete: string) => (await fetch(`http://127.0.0.1:${port}/tiers${requete}`)).status;

  it('un type en tableau est refusé en 400, pas en 500', async () => {
    expect(await lire('?type[]=FOURNISSEUR&type[]=CLIENT')).toBe(400);
  });

  it('un type hors énumération est refusé en 400', async () => {
    expect(await lire('?type=INEXISTANT')).toBe(400);
  });

  it('une recherche en tableau est refusée en 400', async () => {
    expect(await lire('?recherche[]=a&recherche[]=b')).toBe(400);
  });

  it('un type valide, ou aucun, passe', async () => {
    expect(await lire('?type=FOURNISSEUR')).toBe(200);
    expect(await lire('')).toBe(200);
  });
});
