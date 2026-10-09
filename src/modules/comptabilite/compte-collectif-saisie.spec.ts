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

function service(opts: { portees?: string[]; tenusParUneCreance?: string[] } = {}) {
  const prisma = {
    compte: {
      // La doublure honore dossier, collectif, identifiants et « porte des
      // individuels » demandés.
      findMany: jest.fn(
        async ({
          where,
          take,
        }: {
          where: { tenantId: string; collectifId?: string; id?: { in: string[] }; individuels?: unknown };
          take?: number;
        }) => {
          const r = COMPTES.filter(
            (c) =>
              c.tenantId === where.tenantId &&
              (where.collectifId === undefined || c.collectifId === where.collectifId) &&
              (!where.id || where.id.in.includes(c.id)) &&
              (!where.individuels || COMPTES.some((i) => i.tenantId === where.tenantId && i.collectifId === c.id)),
          );
          return take ? r.slice(0, take) : r;
        },
      ),
    },
    ligneEcriture: {
      findMany: jest.fn(async () => (opts.portees ?? []).map((compteId) => ({ compteId }))),
    },
    creanceDouteuse: {
      findMany: jest.fn(async ({ where }: { where: { compte416Id: { in: string[] }; annuleeLe: null } }) =>
        (opts.tenusParUneCreance ?? []).filter((id) => where.compte416Id.in.includes(id)).map((compte416Id) => ({ compte416Id })),
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

  it('un montant déjà porté au collectif se reporte sur le compte du tiers par une pièce qui ne porte qu’eux', async () => {
    // Reclassement · le collectif et ses seuls comptes de tiers.
    await expect(service().verifierComptesCollectifs('t1', [{ compteId: 'c4111' }, { compteId: 'i1' }])).resolves.toBeUndefined();
    // Une autre ligne en fait une saisie ordinaire · refusée, l'issue nommée.
    await expect(
      service().verifierComptesCollectifs('t1', [{ compteId: 'c4111' }, { compteId: 'i1' }, { compteId: 'vente' }]),
    ).rejects.toThrow(/se reporte sur le compte du tiers par une pièce qui ne porte que ce collectif/);
  });

  it('le 416 qu’une créance douteuse tient reste ouvert à la correction par le résultat', async () => {
    await expect(
      service({ tenusParUneCreance: ['c4111'] }).verifierComptesCollectifs('t1', [{ compteId: 'c4111' }, { compteId: 'vente' }]),
    ).resolves.toBeUndefined();
  });

  it('à la modification, seul un compte que la pièce ne portait pas est jugé', async () => {
    await expect(
      service({ portees: ['c4111', 'vente'] }).verifierComptesCollectifs('t1', [{ compteId: 'c4111' }, { compteId: 'vente' }], 'e1'),
    ).resolves.toBeUndefined();
    await expect(
      service({ portees: ['vente'] }).verifierComptesCollectifs('t1', [{ compteId: 'c4111' }, { compteId: 'vente' }], 'e1'),
    ).rejects.toThrow(/Compte collectif : 41110000/);
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
    expect(svc.verifierComptesCollectifs).toHaveBeenCalledWith('t1', lignes, 'e1');
  });

  it('la réimputation et la fusion de comptes jugent le compte d’arrivée', async () => {
    const svc = {
      verifierComptesCollectifs: jest.fn(async () => {
        throw new Error('collectif');
      }),
      reimputer: jest.fn(),
      fusionnerComptes: jest.fn(),
    };
    const ctrl = new EcritureController(svc as never);
    const user = { tenantId: 't1', userId: 'u1', role: RoleUtilisateur.ADMIN_CABINET } as never;
    await expect(ctrl.reimputer(user, { compteCibleId: 'c4111' } as never)).rejects.toThrow('collectif');
    await expect(ctrl.fusionnerComptes(user, { compteSourceId: 'x', compteCibleId: 'c4111' } as never)).rejects.toThrow('collectif');
    expect(svc.reimputer).not.toHaveBeenCalled();
    expect(svc.fusionnerComptes).not.toHaveBeenCalled();
    expect(svc.verifierComptesCollectifs).toHaveBeenCalledWith('t1', [{ compteId: 'c4111' }]);
  });
});
