import { TiersService } from './tiers.service';

const fiche = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  code: id.toUpperCase(),
  type: 'FOURNISSEUR',
  adresse: null,
  boitePostale: null,
  ville: null,
  pays: null,
  telephone: null,
  email: null,
  numeroImpot: null,
  contact: null,
  ...extra,
});

describe('Fusion de tiers · le service', () => {
  it('reporte TOUTES les relations lues dans le schéma, comble les vides, puis supprime le doublon', async () => {
    const maj = () => ({ updateMany: jest.fn().mockResolvedValue({ count: 1 }) });
    const tx = {
      tiersCompte: maj(),
      relance: maj(),
      demandeConfirmation: maj(),
      facture: maj(),
      devis: maj(),
      consignation: maj(),
      documentTiers: { ...maj(), findMany: jest.fn().mockResolvedValue([]), deleteMany: jest.fn() },
      ribTiers: { ...maj(), count: jest.fn().mockResolvedValue(1), findMany: jest.fn().mockResolvedValue([{ id: 'rib-doublon' }]), update: jest.fn() },
      // Ligne sage-l2, fonction 31 · les lieux de livraison suivent la fiche conservée.
      lieuLivraison: { ...maj(), count: jest.fn().mockResolvedValue(0), findMany: jest.fn().mockResolvedValue([]), update: jest.fn() },
      ligneOrdreVirement: maj(),
      abonnementCabinet: maj(),
      contratLocationAcquisition: maj(),
      bonCommandeFournisseur: maj(), tarifClient: { ...maj(), findMany: jest.fn().mockResolvedValue([]), deleteMany: jest.fn() },
      tiers: { update: jest.fn().mockResolvedValue({}), delete: jest.fn().mockResolvedValue({}) },
      $executeRaw: jest.fn().mockResolvedValue(1),
    };
    const prisma = {
      tiers: {
        findFirst: jest.fn(({ where }: { where: { id: string } }) =>
          Promise.resolve(
            where.id === 'doublon'
              ? fiche('doublon', { numeroImpot: 'A123' })
              : { ...fiche('garde', { adresse: 'Av. X' }), comptesRattaches: [{ estPrincipal: true }] },
          ),
        ),
      },
      $transaction: jest.fn((fn: (t: typeof tx) => unknown) => fn(tx)),
    };
    const s = new TiersService(prisma as never);
    const r = await s.fusionner('t', 'doublon', 'garde', 'u1');

    for (const m of ['relance', 'demandeConfirmation', 'facture', 'devis', 'consignation', 'documentTiers', 'ligneOrdreVirement', 'bonCommandeFournisseur'] as const) {
      expect(tx[m].updateMany).toHaveBeenCalledWith({ where: { tiersId: 'doublon', tenantId: 't' }, data: { tiersId: 'garde' } });
    }
    // Le compte principal de la fiche conservée reste le seul.
    expect(tx.tiersCompte.updateMany).toHaveBeenCalledWith({ where: { tiersId: 'doublon' }, data: { estPrincipal: false } });
    // L'abonnement de l'éditeur pointe le client facturé · il suit la fiche
    // conservée, sans borne de dossier (la table est hors dossier).
    expect(tx.abonnementCabinet.updateMany).toHaveBeenCalledWith({ where: { tiersId: 'doublon' }, data: { tiersId: 'garde' } });
    // Même règle pour les RIB · le prochain virement part sur le principal de la fiche gardée.
    expect(tx.ribTiers.count).toHaveBeenCalledWith({ where: { tenantId: 't', tiersId: 'garde', estPrincipal: true } });
    expect(tx.ribTiers.updateMany).toHaveBeenCalledWith({ where: { tenantId: 't', tiersId: 'doublon' }, data: { estPrincipal: false } });
    // UN RIB QUI CHANGE DE BÉNÉFICIAIRE PERD SON VISA (visa-rib.ts, règle 6) ·
    // tenu pour saisi par l'auteur de la fusion, une mise à jour par RIB,
    // AVANT le report (le RIB est encore celui du doublon quand il est lu).
    expect(tx.ribTiers.findMany).toHaveBeenCalledWith({ where: { tenantId: 't', tiersId: 'doublon' }, select: { id: true } });
    expect(tx.ribTiers.update).toHaveBeenCalledWith({
      where: { id: 'rib-doublon' },
      data: { saisiPar: 'u1', saisiLe: expect.any(Date), visePar: null, viseLe: null },
    });
    const report = tx.ribTiers.updateMany.mock.calls.findIndex((c: [{ data: Record<string, unknown> }]) => 'tiersId' in c[0].data);
    expect(tx.ribTiers.update.mock.invocationCallOrder[0]).toBeLessThan(tx.ribTiers.updateMany.mock.invocationCallOrder[report]);
    expect(tx.tiers.update).toHaveBeenCalledWith({ where: { id: 'garde' }, data: { numeroImpot: 'A123' } });
    expect(tx.tiers.delete).toHaveBeenCalledWith({ where: { id: 'doublon' } });
    // Le contrat de location-acquisition suit le bailleur conservé.
    expect(tx.contratLocationAcquisition.updateMany).toHaveBeenCalledWith({
      where: { bailleurTiersId: 'doublon', tenantId: 't' },
      data: { bailleurTiersId: 'garde' },
    });
    // 14 avec les tarifs propres au client (ligne commercial-l8).
    expect(r.reporte).toHaveLength(14);
    expect(tx.lieuLivraison.updateMany).toHaveBeenCalledWith({ where: { tiersId: 'doublon', tenantId: 't' }, data: { tiersId: 'garde' } });
  });

  it('une pièce que la fiche conservée détient déjà n’est pas reportée · l’unicité (tiers, empreinte) tiendrait sinon la fusion en échec', async () => {
    const maj = () => ({ updateMany: jest.fn().mockResolvedValue({ count: 0 }) });
    const ordre: string[] = [];
    const documentTiers = {
      findMany: jest.fn().mockResolvedValue([{ empreinte: 'abc' }]),
      deleteMany: jest.fn(async () => {
        ordre.push('deleteMany');
        return { count: 1 };
      }),
      updateMany: jest.fn(async () => {
        ordre.push('updateMany');
        return { count: 0 };
      }),
    };
    const tx: Record<string, unknown> = {
      tiersCompte: maj(), relance: maj(), demandeConfirmation: maj(), facture: maj(), devis: maj(), consignation: maj(),
      ribTiers: { ...maj(), count: jest.fn().mockResolvedValue(0), findMany: jest.fn().mockResolvedValue([]), update: jest.fn() }, ligneOrdreVirement: maj(), abonnementCabinet: maj(),
      lieuLivraison: { ...maj(), count: jest.fn().mockResolvedValue(0), findMany: jest.fn().mockResolvedValue([]), update: jest.fn() },
      contratLocationAcquisition: maj(),
      bonCommandeFournisseur: maj(), tarifClient: { ...maj(), findMany: jest.fn().mockResolvedValue([]), deleteMany: jest.fn() }, documentTiers,
      tiers: { update: jest.fn(), delete: jest.fn() },
      $executeRaw: jest.fn().mockResolvedValue(1),
    };
    const prisma = {
      tiers: {
        findFirst: jest.fn(({ where }: { where: { id: string } }) =>
          Promise.resolve(where.id === 'doublon' ? fiche('doublon') : { ...fiche('garde'), comptesRattaches: [] }),
        ),
      },
      $transaction: jest.fn((fn: (t: typeof tx) => unknown) => fn(tx)),
    };
    await new TiersService(prisma as never).fusionner('t', 'doublon', 'garde', 'u1');
    expect(documentTiers.findMany).toHaveBeenCalledWith({ where: { tenantId: 't', tiersId: 'garde' }, select: { empreinte: true } });
    expect(documentTiers.deleteMany).toHaveBeenCalledWith({
      where: { tenantId: 't', tiersId: 'doublon', empreinte: { in: ['abc'] } },
    });
    expect(ordre).toEqual(['deleteMany', 'updateMany']);
  });

  it("sans RIB principal sur la fiche gardée, ceux du doublon arrivent tels quels", async () => {
    const maj = () => ({ updateMany: jest.fn().mockResolvedValue({ count: 0 }) });
    const ribTiers = { ...maj(), count: jest.fn().mockResolvedValue(0), findMany: jest.fn().mockResolvedValue([]), update: jest.fn() };
    const tx: Record<string, unknown> = {
      tiersCompte: maj(), relance: maj(), demandeConfirmation: maj(), facture: maj(), devis: maj(), consignation: maj(),
      ribTiers, ligneOrdreVirement: maj(), abonnementCabinet: maj(), contratLocationAcquisition: maj(),
      bonCommandeFournisseur: maj(), tarifClient: { ...maj(), findMany: jest.fn().mockResolvedValue([]), deleteMany: jest.fn() },
      lieuLivraison: { ...maj(), count: jest.fn().mockResolvedValue(0), findMany: jest.fn().mockResolvedValue([]), update: jest.fn() },
      documentTiers: { ...maj(), findMany: jest.fn().mockResolvedValue([]), deleteMany: jest.fn() },
      tiers: { update: jest.fn(), delete: jest.fn() },
      $executeRaw: jest.fn().mockResolvedValue(1),
    };
    const prisma = {
      tiers: {
        findFirst: jest.fn(({ where }: { where: { id: string } }) =>
          Promise.resolve(where.id === 'doublon' ? fiche('doublon') : { ...fiche('garde'), comptesRattaches: [] }),
        ),
      },
      $transaction: jest.fn((fn: (t: typeof tx) => unknown) => fn(tx)),
    };
    await new TiersService(prisma as never).fusionner('t', 'doublon', 'garde', 'u1');
    expect(ribTiers.updateMany).not.toHaveBeenCalledWith(expect.objectContaining({ data: { estPrincipal: false } }));
    expect(ribTiers.updateMany).toHaveBeenCalledWith({ where: { tiersId: 'doublon', tenantId: 't' }, data: { tiersId: 'garde' } });
  });
  it('les lieux de livraison du doublon · sans principal si la fiche gardée en a un, renommés quand l’intitulé est déjà pris (ligne sage-l2, fonction 31)', async () => {
    const maj = () => ({ updateMany: jest.fn().mockResolvedValue({ count: 0 }) });
    const lieuLivraison = {
      ...maj(),
      count: jest.fn().mockResolvedValue(1),
      findMany: jest.fn(async ({ where }: { where: { tiersId: string } }) =>
        where.tiersId === 'garde' ? [{ intitule: 'Entrepôt' }] : [{ id: 'l1', intitule: 'ENTREPÔT' }, { id: 'l2', intitule: 'Siège' }],
      ),
      update: jest.fn(),
    };
    const tx: Record<string, unknown> = {
      tiersCompte: maj(), relance: maj(), demandeConfirmation: maj(), facture: maj(), devis: maj(), consignation: maj(),
      ribTiers: { ...maj(), count: jest.fn().mockResolvedValue(0), findMany: jest.fn().mockResolvedValue([]), update: jest.fn() }, ligneOrdreVirement: maj(), abonnementCabinet: maj(),
      contratLocationAcquisition: maj(),
      bonCommandeFournisseur: maj(), tarifClient: { ...maj(), findMany: jest.fn().mockResolvedValue([]), deleteMany: jest.fn() }, lieuLivraison,
      documentTiers: { ...maj(), findMany: jest.fn().mockResolvedValue([]), deleteMany: jest.fn() },
      tiers: { update: jest.fn(), delete: jest.fn() },
      $executeRaw: jest.fn().mockResolvedValue(1),
    };
    const prisma = {
      tiers: {
        findFirst: jest.fn(({ where }: { where: { id: string } }) =>
          Promise.resolve(where.id === 'doublon' ? fiche('doublon', { type: 'CLIENT' }) : { ...fiche('garde', { type: 'CLIENT' }), comptesRattaches: [] }),
        ),
      },
      $transaction: jest.fn((fn: (t: typeof tx) => unknown) => fn(tx)),
    };
    await new TiersService(prisma as never).fusionner('t', 'doublon', 'garde', 'u1');
    expect(lieuLivraison.updateMany).toHaveBeenCalledWith({ where: { tenantId: 't', tiersId: 'doublon' }, data: { estPrincipal: false } });
    expect(lieuLivraison.update).toHaveBeenCalledTimes(1);
    expect(lieuLivraison.update).toHaveBeenCalledWith({ where: { id: 'l1' }, data: { intitule: 'ENTREPÔT · DOUBLON' } });
    // Second tour, m5 · les lieux des deux clients sous leur verrou, dans un
    // ordre fixe, avant la lecture des intitulés.
    const verrous = (tx.$executeRaw as jest.Mock).mock.calls.map((c: unknown[]) => c[1]);
    expect(verrous).toEqual(['lieux-livraison:t:doublon', 'lieux-livraison:t:garde']);
    expect((tx.$executeRaw as jest.Mock).mock.invocationCallOrder[1]).toBeLessThan(lieuLivraison.findMany.mock.invocationCallOrder[0]);
  });
});
