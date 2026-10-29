import { acteurCourant, dansContexteAudit } from '../../common/audit/contexte-audit';
import { GroupeService } from './groupe.service';

/**
 * LA PREMIÈRE LIASSE D'UN GROUPE TOMBAIT EN 500 (vu sur vraie base le
 * 2026-10-29) · le dossier de combinaison naissait au nom du SIÈGE, et la
 * garde de cloisonnement refusait le maillon d'audit qui ouvre la chaîne du
 * nouveau dossier, comme une écriture chez un voisin. Il naît désormais au nom
 * du dossier qui naît, son identifiant tiré avant, comme `AuthService.register`
 * · et la requête part DANS ce contexte (une requête Prisma ne part qu'à son
 * `await`, une version qui la rendait sans l'attendre retombait sur le siège).
 */
describe('dossier de combinaison · il naît au nom du dossier qui naît', () => {
  it('crée le dossier sous son propre identifiant, dans le contexte de ce dossier, dans une transaction', async () => {
    const vus: Array<{ id: string; contexte: string | undefined }> = [];
    const tx = {
      tenant: {
        // Paresseuse comme une requête Prisma · le contexte se lit au moment où elle part.
        create: ({ data }: { data: { id: string } }) => ({
          then: (ok: (v: unknown) => unknown, ko?: (e: unknown) => unknown) => {
            vus.push({ id: data.id, contexte: acteurCourant()?.tenantId });
            return Promise.resolve({ id: data.id }).then(ok, ko);
          },
        }),
      },
    };
    const prisma = {
      tenant: {
        findUnique: async () => ({ nom: 'Siège', dossierCombinaisonId: null, referentiel: 'SYSCOHADA', systemeComptableSyscohada: 'NORMAL', jeuEtatsFinanciersSycebnl: null }),
        update: jest.fn(async () => ({})),
      },
      $transaction: jest.fn(async (fn: (t: typeof tx) => unknown) => fn(tx)),
    };
    const s = new GroupeService(prisma as never, {} as never, {} as never, {} as never);
    const id = await dansContexteAudit({ acteurEmail: 'siege@exemple.invalid', tenantId: 'siege' }, () =>
      (s as unknown as { assurerDossierCombinaison: (t: string) => Promise<string> }).assurerDossierCombinaison('siege'),
    );
    expect(vus).toEqual([{ id, contexte: id }]);
    expect(id).not.toBe('siege');
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.tenant.update).toHaveBeenCalledWith({ where: { id: 'siege' }, data: { dossierCombinaisonId: id } });
  });
});
