import { RoleUtilisateur } from '@prisma/client';
import { EcritureController } from './ecriture.controller';
import { EcritureService } from './ecriture.service';

/**
 * UNE SAISIE S'IMPUTE AU COMPTE DU TIERS, JAMAIS À SON COLLECTIF (décision
 * de Manasse du 2026-10-09, « Refus nommé »). Un collectif qui porte des
 * comptes individuels refuse la ligne saisie ; un collectif sans individuel
 * reste ouvert ; les modules, qui ne passent pas par le contrôleur, ne sont
 * pas touchés.
 */
type Compte = { id: string; tenantId: string; numero: string; intitule: string; collectifId: string | null };

const COMPTES: Compte[] = [
  { id: 'c4111', tenantId: 't1', numero: '41110000', intitule: 'Clients', collectifId: null },
  { id: 'i1', tenantId: 't1', numero: '41110001', intitule: 'Acme', collectifId: 'c4111' },
  { id: 'i2', tenantId: 't1', numero: '41110002', intitule: 'Bema', collectifId: 'c4111' },
  { id: 'c4011', tenantId: 't1', numero: '40110000', intitule: 'Fournisseurs', collectifId: null },
  { id: 'v1', tenantId: 't2', numero: '40110001', intitule: 'Voisin', collectifId: 'c4011' },
  { id: 'vente', tenantId: 't1', numero: '70110000', intitule: 'Ventes', collectifId: null },
];

function service() {
  const prisma = {
    compte: {
      // La doublure honore dossier, collectif et identifiants demandés.
      findMany: jest.fn(async ({ where }: { where: { tenantId: string; collectifId?: { in: string[] }; id?: { in: string[] } } }) =>
        COMPTES.filter(
          (c) =>
            c.tenantId === where.tenantId &&
            (!where.collectifId || (c.collectifId !== null && where.collectifId.in.includes(c.collectifId))) &&
            (!where.id || where.id.in.includes(c.id)),
        ),
      ),
    },
  };
  return new EcritureService(prisma as never, {} as never, {} as never, {} as never);
}

describe('saisie sur un compte collectif', () => {
  it('refuse le collectif qui porte des comptes de tiers, en nommant ces comptes', async () => {
    await expect(service().verifierComptesCollectifs('t1', [{ compteId: 'c4111' }, { compteId: 'vente' }])).rejects.toThrow(
      /Compte collectif : 41110000 \(41110001 Acme, 41110002 Bema\) · une écriture saisie s'impute au compte du tiers/,
    );
  });

  it('laisse passer le compte du tiers et le collectif sans compte individuel du dossier', async () => {
    await expect(service().verifierComptesCollectifs('t1', [{ compteId: 'i1' }, { compteId: 'vente' }])).resolves.toBeUndefined();
    // Le 4011 de t1 n'a d'individuel que dans un AUTRE dossier · il reste ouvert.
    await expect(service().verifierComptesCollectifs('t1', [{ compteId: 'c4011' }])).resolves.toBeUndefined();
  });

  it('le contrôleur le joue à la saisie et à la modification, avant d’écrire', async () => {
    const appels: string[] = [];
    const svc = {
      verifierComptesCollectifs: jest.fn(async () => {
        appels.push('collectif');
      }),
      verifierComptesEnSommeil: jest.fn(async () => {
        appels.push('sommeil');
      }),
      creer: jest.fn(async () => appels.push('creer')),
      modifier: jest.fn(async () => appels.push('modifier')),
    };
    const ctrl = new EcritureController(svc as never);
    const user = { tenantId: 't1', userId: 'u1', role: RoleUtilisateur.COMPTABLE } as never;
    const lignes = [{ compteId: 'c4111' }];
    await ctrl.creer(user, { lignes } as never);
    await ctrl.modifier(user, 'e1', { lignes } as never);
    expect(appels).toEqual(['collectif', 'sommeil', 'creer', 'collectif', 'sommeil', 'modifier']);
    expect(svc.verifierComptesCollectifs).toHaveBeenCalledWith('t1', lignes);
  });
});
