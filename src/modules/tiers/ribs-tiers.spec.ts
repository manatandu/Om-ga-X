import {
  coordonneesImprimees,
  motifRefusAnnulation,
  deviseDuDonneur,
  motifRefusDeviseDonneur,
  motifRefusImpression,
  motifRefusLignesHorsDeviseDonneur,
  motifRefusRibTiers,
} from './ribs-tiers';
import { RibsTiersService } from './ribs-tiers.service';

describe('RIB des tiers · ce qui permet de payer', () => {
  it('refuse un RIB sans banque, ou sans aucun numéro de compte', () => {
    expect(motifRefusRibTiers({ banque: '', numeroCompte: '123' })).toMatch(/banque/);
    expect(motifRefusRibTiers({ banque: 'Rawbank', iban: '', numeroCompte: '  ' })).toMatch(/ni numéro de compte/);
    expect(motifRefusRibTiers({ banque: 'Rawbank', numeroCompte: '00012' })).toBeNull();
  });

  it("contrôle l'IBAN par sa clé ISO 13616, et seulement lui", () => {
    expect(motifRefusRibTiers({ banque: 'B', iban: 'GB82 WEST 1234 5698 7654 32' })).toBeNull();
    expect(motifRefusRibTiers({ banque: 'B', iban: 'GB83WEST12345698765432' })).toMatch(/IBAN invalide/);
    // Le RIB national se conserve sans se vérifier · aucun format n'est au corpus.
    expect(motifRefusRibTiers({ banque: 'B', codeBanque: 'x', numeroCompte: '??' })).toBeNull();
  });

  it("imprime l'IBAN par groupes de quatre, sinon le RIB national dans l'ordre de la fiche", () => {
    expect(coordonneesImprimees({ iban: 'gb82west12345698765432', numeroCompte: '9' })).toBe('IBAN GB82 WEST 1234 5698 7654 32');
    expect(coordonneesImprimees({ codeBanque: '00011', codeGuichet: '01000', numeroCompte: '1234567', cle: '42' })).toBe(
      '00011 01000 1234567 42',
    );
  });
});

describe("ordre de virement · la monnaie du donneur d'ordre (n° 37, ligne sage-l3)", () => {
  it('lit la devise du RIB en code ISO, le franc et le RIB sans devise valant « aucune »', () => {
    expect(deviseDuDonneur(null)).toBeNull();
    expect(deviseDuDonneur('  ')).toBeNull();
    expect(deviseDuDonneur('cdf')).toBeNull();
    expect(deviseDuDonneur(' usd ')).toBe('USD');
  });

  it("l'ordre de paiement des SALAIRES reste en francs · un RIB en devise le refuse", () => {
    expect(motifRefusDeviseDonneur(null, 'BQ')).toBeNull();
    expect(motifRefusDeviseDonneur('cdf', 'BQ')).toBeNull();
    expect(motifRefusDeviseDonneur('USD', 'BQ')).toMatch(/USD.*CDF/);
    expect(motifRefusDeviseDonneur('USD', 'BQ')).toMatch(/salaires/);
  });

  it('chaque ligne réglée est dans la monnaie du donneur, sinon refus nommé avec son issue', () => {
    const base = { journalCode: 'BQ', monnaieDeTenue: 'CDF' };
    expect(motifRefusLignesHorsDeviseDonneur({ ...base, deviseDonneur: 'USD', lignes: [{ compte: '40110001', devise: 'USD' }] })).toBeNull();
    expect(motifRefusLignesHorsDeviseDonneur({ ...base, deviseDonneur: null, lignes: [{ compte: '40110001', devise: null }] })).toBeNull();
    // Une ligne en francs ne part pas d'un compte en dollars · l'ordre ferait exécuter une contrevaleur.
    expect(
      motifRefusLignesHorsDeviseDonneur({ ...base, deviseDonneur: 'USD', lignes: [{ compte: '40110001', devise: 'USD' }, { compte: '40110002', devise: null }] }),
    ).toMatch(/tenu en USD.*40110002.*Moyen de paiement en devise/);
    // Un donneur sans devise renseignée reçoit une ligne en dollars · l'issue est de renseigner le RIB, ou de changer de journal.
    expect(motifRefusLignesHorsDeviseDonneur({ ...base, deviseDonneur: null, lignes: [{ compte: '40110001', devise: 'USD' }] })).toMatch(
      /aucune devise renseignée.*40110001.*Structure > Banques/,
    );
    // Le franc écrit en toutes lettres sur une ligne vaut « aucune devise ».
    expect(motifRefusLignesHorsDeviseDonneur({ ...base, deviseDonneur: null, lignes: [{ compte: '40110001', devise: 'CDF' }] })).toBeNull();
  });
});

describe("ordre de virement · l'état « en attente d'impression »", () => {
  it('un ordre annulé ne se réimprime pas', () => {
    expect(motifRefusImpression('A_IMPRIMER')).toBeNull();
    expect(motifRefusImpression('IMPRIME')).toBeNull();
    expect(motifRefusImpression('ANNULE')).not.toBeNull();
  });

  it("l'annulation exige un motif, et ne se fait qu'une fois", () => {
    expect(motifRefusAnnulation('IMPRIME', '  ')).toMatch(/motif/);
    expect(motifRefusAnnulation('ANNULE', 'rejet banque')).toMatch(/déjà annulé/);
    expect(motifRefusAnnulation('IMPRIME', 'rejet banque')).toBeNull();
  });
});

describe('RibsTiersService · un seul principal par tiers', () => {
  function monter(existants: number) {
    const appels: string[] = [];
    const tx = {
      ribTiers: {
        updateMany: jest.fn(async () => {
          appels.push('retire');
          return { count: 1 };
        }),
        create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
          appels.push('cree');
          return data;
        }),
      },
    };
    const prisma = {
      tiers: { findFirst: jest.fn(async () => ({ id: 'ti' })) },
      ribTiers: { count: jest.fn(async () => existants) },
      $transaction: jest.fn((fn: (t: typeof tx) => unknown) => fn(tx)),
    };
    return { service: new RibsTiersService(prisma as never), tx, appels };
  }

  it("le premier RIB d'un tiers est principal d'office", async () => {
    const { service } = monter(0);
    const r = (await service.creer('t', 'ti', { banque: 'Rawbank', numeroCompte: '1' }, 'u1')) as unknown as { estPrincipal: boolean };
    expect(r.estPrincipal).toBe(true);
  });

  it("un second RIB n'est principal que s'il est coché, et retire alors la marque au précédent, AVANT de créer", async () => {
    const sans = monter(1);
    expect(((await sans.service.creer('t', 'ti', { banque: 'B', numeroCompte: '2' }, 'u1')) as unknown as { estPrincipal: boolean }).estPrincipal).toBe(false);
    expect(sans.tx.ribTiers.updateMany).not.toHaveBeenCalled();

    const avec = monter(1);
    await avec.service.creer('t', 'ti', { banque: 'B', numeroCompte: '2', estPrincipal: true }, 'u1');
    expect(avec.tx.ribTiers.updateMany).toHaveBeenCalledWith({ where: { tenantId: 't', tiersId: 'ti' }, data: { estPrincipal: false } });
    expect(avec.appels).toEqual(['retire', 'cree']);
  });

  it("normalise l'IBAN avant de le ranger, et refuse un RIB qui ne permet pas de payer", async () => {
    const { service } = monter(0);
    const r = (await service.creer('t', 'ti', { banque: 'B', iban: 'gb82 west 1234 5698 7654 32' }, 'u1')) as unknown as { iban: string };
    expect(r.iban).toBe('GB82WEST12345698765432');
    await expect(service.creer('t', 'ti', { banque: 'B' }, 'u1')).rejects.toThrow(/ni numéro de compte/);
  });
});

describe('suppression du tiers · ses RIB partent avec lui, un ordre de virement le retient', () => {
  function monter(comptes: Record<string, number>) {
    // Chaque retrait note s'il est fait DANS la transaction · la forme tableau
    // a disparu (audit final F159), c'est la fonction qui s'y exécute.
    let dansTransaction = false;
    const deleteMany = jest.fn(() => ({ dansTransaction }));
    const delegue = (nom: string) => ({
      count: jest.fn(async () => comptes[nom] ?? 0),
      deleteMany: nom === 'ribTiers' ? deleteMany : jest.fn(() => nom),
      delete: jest.fn(() => nom),
    });
    const prisma: Record<string, unknown> = new Proxy(
      {
        tiers: { findFirst: jest.fn(async () => ({ id: 'ti', code: 'F001', comptesRattaches: [] })), delete: jest.fn(() => ({ dansTransaction })) },
        $transaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) => {
          dansTransaction = true;
          try {
            return await fn(prisma);
          } finally {
            dansTransaction = false;
          }
        }),
      } as Record<string, unknown>,
      { get: (cible, nom: string) => (nom in cible ? cible[nom] : (cible[nom] = delegue(nom))) },
    );
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { TiersService } = require('./tiers.service');
    return { service: new TiersService(prisma as never), deleteMany, prisma };
  }

  it('un tiers qui porte des RIB se supprime, et ses RIB sont retirés dans la même transaction', async () => {
    const { service, deleteMany, prisma } = monter({ ribTiers: 2 });
    await expect(service.supprimer('t', 'ti')).resolves.toEqual({ supprime: true });
    expect(deleteMany).toHaveBeenCalledWith({ where: { tenantId: 't', tiersId: 'ti' } });
    // Les RIB d'abord, dans la même transaction que le tiers.
    expect(deleteMany.mock.results[0].value).toEqual({ dansTransaction: true });
    const supprimerTiers = (prisma.tiers as { delete: jest.Mock }).delete;
    expect(supprimerTiers.mock.results[0].value).toEqual({ dansTransaction: true });
    expect(deleteMany.mock.invocationCallOrder[0]).toBeLessThan(supprimerTiers.mock.invocationCallOrder[0]);
  });

  it("un tiers payé par un ordre de virement ne se supprime pas", async () => {
    const { service } = monter({ ligneOrdreVirement: 1 });
    await expect(service.supprimer('t', 'ti')).rejects.toThrow(/ordres de virement/);
  });
});
