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
type Compte = {
  id: string;
  tenantId: string;
  numero: string;
  intitule: string;
  collectifId: string | null;
  typeCompte?: 'DETAIL' | 'TOTAL';
  estActif?: boolean;
  journauxTresorerie?: { id: string }[];
};

const COMPTES_DE_BASE: Compte[] = [
  { id: 'c4111', tenantId: 't1', numero: '41110000', intitule: 'Clients', collectifId: null },
  { id: 'i1', tenantId: 't1', numero: '41110001', intitule: 'Acme', collectifId: 'c4111' },
  { id: 'i2', tenantId: 't1', numero: '41110002', intitule: 'Bema', collectifId: 'c4111' },
  { id: 'c4011', tenantId: 't1', numero: '40110000', intitule: 'Fournisseurs', collectifId: null },
  { id: 'v1', tenantId: 't2', numero: '40110001', intitule: 'Voisin', collectifId: 'c4011' },
  { id: 'vente', tenantId: 't1', numero: '70110000', intitule: 'Ventes', collectifId: null },
];

type Where = {
  tenantId: string;
  collectifId?: string;
  id?: { in: string[] };
  individuels?: unknown;
  typeCompte?: string;
  estActif?: boolean;
  numero?: { startsWith: string; not: string };
  NOT?: { numero: { startsWith: string } }[];
};

function service(opts: { portees?: string[]; tenusParUneCreance?: string[]; comptes?: Compte[] } = {}) {
  const COMPTES = [...COMPTES_DE_BASE, ...(opts.comptes ?? [])];
  const prisma = {
    tenant: { findFirst: jest.fn(async () => ({ referentiel: 'SYSCOHADA' })) },
    compte: {
      // La doublure honore dossier, collectif, identifiants, « porte des
      // individuels », type, activité, préfixe et exclusions demandés.
      findMany: jest.fn(async ({ where, take }: { where: Where; take?: number }) => {
        const r = COMPTES.filter(
          (c) =>
            c.tenantId === where.tenantId &&
            (where.collectifId === undefined || c.collectifId === where.collectifId) &&
            (!where.id || where.id.in.includes(c.id)) &&
            (!where.individuels || COMPTES.some((i) => i.tenantId === where.tenantId && i.collectifId === c.id)) &&
            (where.typeCompte === undefined || (c.typeCompte ?? 'DETAIL') === where.typeCompte) &&
            (where.estActif === undefined || (c.estActif ?? true) === where.estActif) &&
            (!where.numero || (c.numero.startsWith(where.numero.startsWith) && c.numero !== where.numero.not)) &&
            !(where.NOT ?? []).some((n) => c.numero.startsWith(n.numero.startsWith)),
        );
        r.sort((a, b) => a.numero.localeCompare(b.numero));
        return take ? r.slice(0, take) : r;
      }),
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

  it('refuse le compte du plan que le dossier subdivise, en nommant ses sous-comptes', async () => {
    const comptes: Compte[] = [
      { id: 'b5211', tenantId: 't1', numero: '52110000', intitule: 'Banques locales', collectifId: null },
      { id: 'bcdc', tenantId: 't1', numero: '52110001', intitule: 'BCDC', collectifId: null },
      { id: 'raw', tenantId: 't1', numero: '52110002', intitule: 'Rawbank', collectifId: null },
    ];
    await expect(
      service({ comptes }).verifierComptesCollectifs('t1', [{ compteId: 'b5211' }, { compteId: 'vente' }]),
    ).rejects.toThrow(/Compte du plan subdivisé par le dossier : 52110000 \(52110001 BCDC, 52110002 Rawbank\) · une écriture saisie s'impute/);
    // Le sous-compte du dossier, lui, reçoit la saisie.
    await expect(
      service({ comptes }).verifierComptesCollectifs('t1', [{ compteId: 'bcdc' }, { compteId: 'vente' }]),
    ).resolves.toBeUndefined();
  });

  it('un sous-compte en sommeil ou TOTAL ne ferme pas le compte du plan', async () => {
    const comptes: Compte[] = [
      { id: 'b5211', tenantId: 't1', numero: '52110000', intitule: 'Banques locales', collectifId: null },
      { id: 'dort', tenantId: 't1', numero: '52110001', intitule: 'BCDC', collectifId: null, estActif: false },
      { id: 'tot', tenantId: 't1', numero: '521100', intitule: 'Regroupement', collectifId: null, typeCompte: 'TOTAL' },
    ];
    await expect(
      service({ comptes }).verifierComptesCollectifs('t1', [{ compteId: 'b5211' }, { compteId: 'vente' }]),
    ).resolves.toBeUndefined();
  });

  it('le 490 ne se ferme pas pour un sous-compte du 4911 · la racine est le numéro officiel', async () => {
    const comptes: Compte[] = [
      { id: 'd490', tenantId: 't1', numero: '49000000', intitule: 'Dépréciations des comptes fournisseurs', collectifId: null },
      { id: 'd4911', tenantId: 't1', numero: '49110000', intitule: 'Créances litigieuses', collectifId: null },
      { id: 'x', tenantId: 't1', numero: '49110001', intitule: 'Client X', collectifId: null },
    ];
    await expect(
      service({ comptes }).verifierComptesCollectifs('t1', [{ compteId: 'd490' }, { compteId: 'vente' }]),
    ).resolves.toBeUndefined();
    await expect(
      service({ comptes }).verifierComptesCollectifs('t1', [{ compteId: 'd4911' }, { compteId: 'vente' }]),
    ).rejects.toThrow(/Compte du plan subdivisé par le dossier : 49110000 \(49110001 Client X\)/);
  });

  it('le solde porté au compte du plan se reporte sur ses sous-comptes par une pièce qui ne porte qu’eux', async () => {
    const comptes: Compte[] = [
      { id: 'b5211', tenantId: 't1', numero: '52110000', intitule: 'Banques locales', collectifId: null },
      { id: 'bcdc', tenantId: 't1', numero: '52110001', intitule: 'BCDC', collectifId: null },
    ];
    await expect(
      service({ comptes }).verifierComptesCollectifs('t1', [{ compteId: 'b5211' }, { compteId: 'bcdc' }]),
    ).resolves.toBeUndefined();
    await expect(
      service({ comptes }).verifierComptesCollectifs('t1', [{ compteId: 'b5211' }, { compteId: 'bcdc' }, { compteId: 'vente' }]),
    ).rejects.toThrow(/se reporte par une pièce qui ne porte que lui et ses sous-comptes/);
  });

  it('un compte du plan sans sous-compte du dossier reste ouvert, celui d’un autre dossier ne compte pas', async () => {
    const comptes: Compte[] = [
      { id: 'b5211', tenantId: 't1', numero: '52110000', intitule: 'Banques locales', collectifId: null },
      { id: 'ailleurs', tenantId: 't2', numero: '52110001', intitule: 'Voisin', collectifId: null },
    ];
    await expect(
      service({ comptes }).verifierComptesCollectifs('t1', [{ compteId: 'b5211' }, { compteId: 'vente' }]),
    ).resolves.toBeUndefined();
  });

  it('le compte d’un journal de banque reste ouvert quand un autre journal a son compte dessous', async () => {
    const comptes: Compte[] = [
      { id: 'b5211', tenantId: 't1', numero: '52110000', intitule: 'Banques locales', collectifId: null, journauxTresorerie: [{ id: 'BQ' }] },
      { id: 'bq2', tenantId: 't1', numero: '52110001', intitule: 'Rawbank', collectifId: null, journauxTresorerie: [{ id: 'BQ2' }] },
    ];
    await expect(
      service({ comptes }).verifierComptesCollectifs('t1', [{ compteId: 'b5211' }, { compteId: 'vente' }]),
    ).resolves.toBeUndefined();
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
