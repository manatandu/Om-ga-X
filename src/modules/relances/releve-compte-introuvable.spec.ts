import { NotFoundException } from '@nestjs/common';
import { MOTIF_COMPTE_INTROUVABLE_RELEVE, RelancesService } from './relances.service';

/**
 * LE RELEVÉ D'UN COMPTE D'UN AUTRE DOSSIER EST INTROUVABLE (paquet 1, ligne C,
 * point C3, passe V1 n° 2).
 *
 * `GET /relances/releve/:compteId` cherchait le compte dans les positions du
 * dossier et, faute de l'y trouver, répondait « Ce compte n'a rien de dû sur
 * cet exercice » · une affirmation sur un compte que le dossier ne porte pas.
 * Le compte est désormais jugé AVANT toute lecture des positions, sur le
 * dossier de la session, et le refus est le 404 nommé.
 */

/** Une doublure qui note tout appel · seul `compte.findFirst` répond. */
function doublure(compteDuDossier: boolean) {
  const appels: string[] = [];
  const wheres: unknown[] = [];
  const prisma = new Proxy(
    {},
    {
      get: (_c, modele) =>
        new Proxy(
          {},
          {
            get: (_m, operation) => async (args: { where?: unknown }) => {
              appels.push(`${String(modele)}.${String(operation)}`);
              if (modele === 'compte' && operation === 'findFirst') {
                wheres.push(args.where);
                return compteDuDossier ? { id: 'c-411' } : null;
              }
              throw new Error(`lecture inattendue ${String(modele)}.${String(operation)}`);
            },
          },
        ),
    },
  );
  return { svc: new RelancesService(prisma as never, {} as never), appels, wheres };
}

describe('relevé · le compte d’un autre dossier est introuvable (C3)', () => {
  it('refuse en 404 nommé, sans lire aucune position', async () => {
    const { svc, appels, wheres } = doublure(false);
    const refus = await svc.releve('dossier-a', 'compte-du-dossier-b', 'exercice-a').catch((e: unknown) => e);
    expect(refus).toBeInstanceOf(NotFoundException);
    expect((refus as NotFoundException).message).toBe(MOTIF_COMPTE_INTROUVABLE_RELEVE);
    // Le compte est cherché dans le dossier de la session, et rien d'autre
    // n'est lu.
    expect(wheres).toEqual([{ id: 'compte-du-dossier-b', tenantId: 'dossier-a' }]);
    expect(appels).toEqual(['compte.findFirst']);
  });

  it('le compte du dossier passe le contrôle et va jusqu’aux positions (le témoin n’est pas muet)', async () => {
    const { svc, appels } = doublure(true);
    await svc.releve('dossier-a', 'c-411', 'exercice-a').catch(() => undefined);
    expect(appels[0]).toBe('compte.findFirst');
    expect(appels.length).toBeGreaterThan(1);
  });
});
