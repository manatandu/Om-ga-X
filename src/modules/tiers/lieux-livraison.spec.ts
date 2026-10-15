import {
  intituleDuLieu,
  intituleRenomme,
  LONGUEUR_INTITULE_LIEU,
  motifRefusIntitule,
  motifRefusTypeLieu,
  principalApres,
} from './lieux-livraison';
import { LieuxLivraisonService } from './lieux-livraison.service';

/**
 * LIEUX DE LIVRAISON DES CLIENTS (ligne sage-l2, fonction 31) · ce qui
 * casserait en silence · deux lieux principaux (un document livrerait au
 * hasard), un lieu en sommeil resté principal, un lieu ouvert chez un
 * fournisseur, deux « Entrepôt » indiscernables, une écriture faite hors de
 * la transaction qui pose la marque.
 */
describe('les règles du lieu', () => {
  it('un client seulement', () => {
    expect(motifRefusTypeLieu('CLIENT')).toBeNull();
    for (const t of ['FOURNISSEUR', 'SALARIE', 'AUTRE', 'ADHERENT'] as const) expect(motifRefusTypeLieu(t)).toMatch(/se rattache à un client/);
  });

  it('un intitulé rangé, exigé, borné, unique chez le client sans égard à la casse', () => {
    expect(intituleDuLieu('  Entrepôt   Limete ')).toBe('Entrepôt Limete');
    expect(motifRefusIntitule('', [], null)).toMatch(/obligatoire/);
    expect(motifRefusIntitule('x'.repeat(LONGUEUR_INTITULE_LIEU + 1), [], null)).toMatch(/au plus 35/);
    const autres = [{ id: 'a', intitule: 'Entrepôt' }];
    expect(motifRefusIntitule('ENTREPÔT', autres, null)).toMatch(/déjà un lieu « Entrepôt »/);
    expect(motifRefusIntitule('Entrepôt', autres, 'a')).toBeNull();
  });

  it('le premier lieu actif est principal d’office, jamais un lieu en sommeil', () => {
    expect(principalApres({ demande: undefined, actuel: false, actifApres: true, autresLieuxActifs: 0 })).toEqual({ estPrincipal: true });
    expect(principalApres({ demande: undefined, actuel: false, actifApres: true, autresLieuxActifs: 1 })).toEqual({ estPrincipal: false });
    expect(principalApres({ demande: true, actuel: false, actifApres: false, autresLieuxActifs: 0 })).toEqual({ motif: expect.stringMatching(/en sommeil/) });
    // Mis en sommeil, il perd la marque · le client reste sans principal.
    expect(principalApres({ demande: undefined, actuel: true, actifApres: false, autresLieuxActifs: 2 })).toEqual({ estPrincipal: false });
    // Une retouche sans demande garde la marque.
    expect(principalApres({ demande: undefined, actuel: true, actifApres: true, autresLieuxActifs: 2 })).toEqual({ estPrincipal: true });
  });

  it('à la fusion, un intitulé déjà pris prend le code du doublon, dans la colonne', () => {
    expect(intituleRenomme('Entrepôt', 'CLI-02')).toBe('Entrepôt · CLI-02');
    const long = intituleRenomme('x'.repeat(35), 'CLI-0002');
    expect(long).toHaveLength(LONGUEUR_INTITULE_LIEU);
    expect(long.endsWith(' · CLI-0002')).toBe(true);
  });
});

describe('le service · la marque principale posée dans la transaction', () => {
  function monter(type: string, existants: Array<{ id: string; intitule: string; estActif: boolean; estPrincipal?: boolean; tiersId?: string }>) {
    const ordre: string[] = [];
    const tx = {
      lieuLivraison: {
        updateMany: jest.fn(async () => {
          ordre.push('retire');
          return { count: 1 };
        }),
        create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
          ordre.push('cree');
          return data;
        }),
        update: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
          ordre.push('modifie');
          return data;
        }),
      },
    };
    const prisma = {
      tiers: { findFirst: jest.fn(async ({ where }: { where: { tenantId: string } }) => (where.tenantId === 't' ? { id: 'k', type } : null)) },
      lieuLivraison: {
        findMany: jest.fn(async () => existants),
        findFirst: jest.fn(async ({ where }: { where: { id: string; tenantId: string } }) => {
          const l = existants.find((x) => x.id === where.id);
          return l && where.tenantId === 't' ? { estPrincipal: false, tiersId: 'k', ...l } : null;
        }),
      },
      $transaction: jest.fn((fn: (t: typeof tx) => unknown) => fn(tx)),
    };
    return { service: new LieuxLivraisonService(prisma as never), tx, ordre, prisma };
  }

  it('refuse un lieu chez un fournisseur, AVANT toute écriture', async () => {
    const { service, ordre } = monter('FOURNISSEUR', []);
    await expect(service.creer('t', 'k', { intitule: 'Dépôt' })).rejects.toThrow(/se rattache à un client/);
    expect(ordre).toEqual([]);
  });

  it('le premier lieu est principal, retire la marque des autres AVANT de créer ; les coordonnées vides s’effacent', async () => {
    const { service, ordre } = monter('CLIENT', []);
    const r = (await service.creer('t', 'k', { intitule: ' Siège ', ville: '  ', adresse: ' Av. du Port 4 ' })) as Record<string, unknown>;
    expect(r).toEqual(expect.objectContaining({ intitule: 'Siège', estPrincipal: true, estActif: true, ville: null, adresse: 'Av. du Port 4', tenantId: 't', tiersId: 'k' }));
    expect(ordre).toEqual(['retire', 'cree']);
  });

  it('un second lieu n’est pas principal sans le demander', async () => {
    const { service, ordre } = monter('CLIENT', [{ id: 'a', intitule: 'Siège', estActif: true }]);
    const r = (await service.creer('t', 'k', { intitule: 'Entrepôt' })) as Record<string, unknown>;
    expect(r.estPrincipal).toBe(false);
    expect(ordre).toEqual(['cree']);
  });

  it('rendre principal un lieu retire la marque des autres ; le mettre en sommeil la lui retire', async () => {
    const lieux = [
      { id: 'a', intitule: 'Siège', estActif: true, estPrincipal: true },
      { id: 'b', intitule: 'Entrepôt', estActif: true },
    ];
    const deux = monter('CLIENT', lieux);
    await deux.service.modifier('t', 'b', { intitule: 'Entrepôt', estPrincipal: true });
    expect(deux.tx.lieuLivraison.updateMany).toHaveBeenCalledWith({ where: { tenantId: 't', tiersId: 'k' }, data: { estPrincipal: false } });
    expect(deux.ordre).toEqual(['retire', 'modifie']);
    const sommeil = monter('CLIENT', lieux);
    const r = (await sommeil.service.modifier('t', 'a', { intitule: 'Siège', estActif: false })) as Record<string, unknown>;
    expect(r).toEqual(expect.objectContaining({ estActif: false, estPrincipal: false }));
  });

  it('un lieu d’un autre dossier est introuvable', async () => {
    const { service } = monter('CLIENT', [{ id: 'a', intitule: 'Siège', estActif: true }]);
    await expect(service.modifier('autre', 'a', { intitule: 'Siège' })).rejects.toThrow(/introuvable/);
  });
});
