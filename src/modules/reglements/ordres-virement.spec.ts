import { Prisma } from '@prisma/client';
import { OrdresVirementService, PLAFOND_ORDRES_LISTES } from './ordres-virement.service';

const ribJournal = {
  id: 'rb',
  abrege: 'RAW-CDF',
  devise: 'CDF',
  codeBic: 'RAWBCDKI',
  codeBanque: null,
  codeGuichet: null,
  numeroCompte: '0001',
  cle: null,
  iban: null,
  banque: { intitule: 'Rawbank' },
  journal: { code: 'BQ' },
};

function comptes(ribs: Record<string, unknown[]>) {
  return [
    { id: 'c401', numero: '40110001', tiersCompte: { tiers: { id: 'tA', code: 'F001', nom: 'Fournisseur A', ribs: ribs.tA ?? [] } } },
    { id: 'c402', numero: '40110002', tiersCompte: { tiers: { id: 'tB', code: 'F002', nom: 'Fournisseur B', ribs: ribs.tB ?? [] } } },
    { id: 'c409', numero: '40110009', tiersCompte: null },
  ];
}

function monter(opts: { rib?: unknown; ribs?: Record<string, unknown[]>; visaRibs?: boolean } = {}) {
  const prisma = {
    tenant: { findUnique: jest.fn(async () => ({ visaRibs: opts.visaRibs === true })) },
    ribBanque: { findFirst: jest.fn(async () => (opts.rib === undefined ? ribJournal : opts.rib)) },
    journal: { findFirst: jest.fn(async () => ({ code: 'BQ' })) },
    compte: { findMany: jest.fn(async () => comptes(opts.ribs ?? {})) },
  };
  return { service: new OrdresVirementService(prisma as never), prisma };
}

const principal = (extra: Record<string, unknown> = {}) => ({
  banque: 'Equity BCDC',
  titulaire: null,
  iban: null,
  codeBanque: '00011',
  codeGuichet: null,
  numeroCompte: '777',
  cle: '12',
  codeBic: null,
  ...extra,
});

describe("préparer l'ordre · le visa des RIB, quand le dossier l'exige (tiers/visa-rib.ts)", () => {
  const vise = { visePar: 'u2', viseLe: new Date('2026-10-21T10:00:00Z') };

  it("sans l'option, un RIB principal non visé part comme avant", async () => {
    const { service } = monter({ ribs: { tA: [principal()] } });
    const p = await service.preparer('t', 'bq', ['c401']);
    expect(p.beneficiaires.get('c401')?.banque).toBe('Equity BCDC');
  });

  it("avec l'option, refuse AVANT toute pièce et nomme chaque tiers dont le RIB principal n'est pas visé", async () => {
    const { service } = monter({ visaRibs: true, ribs: { tA: [principal()], tB: [principal({ ...vise })] } });
    await expect(service.preparer('t', 'bq', ['c401', 'c402'])).rejects.toThrow(
      /F001 · Fournisseur A n'est pas visé.*autre que celui qui l'a saisi.*fiche du tiers/,
    );
    await expect(service.preparer('t', 'bq', ['c401', 'c402'])).rejects.not.toThrow(/F002/);
  });

  it("avec l'option, un RIB visé part, et l'ordre recopie ce qui a été visé", async () => {
    const { service } = monter({ visaRibs: true, ribs: { tA: [principal({ ...vise, titulaire: 'SARL A' })] } });
    const p = await service.preparer('t', 'bq', ['c401']);
    expect(p.beneficiaires.get('c401')).toMatchObject({ beneficiaire: 'SARL A', coordonnees: '00011 777 12' });
  });

  it("un dossier introuvable n'est pas un dossier qui n'exige rien · le contrôle se ferme", async () => {
    const { service, prisma } = monter({ ribs: { tA: [principal()] } });
    prisma.tenant.findUnique.mockResolvedValueOnce(null as never);
    await expect(service.preparer('t', 'bq', ['c401'])).rejects.toThrow(/Dossier introuvable/);
  });

  it("un visa à moitié posé (auteur sans date) n'est pas un visa", async () => {
    const { service } = monter({ visaRibs: true, ribs: { tA: [principal({ visePar: 'u2', viseLe: null })] } });
    await expect(service.preparer('t', 'bq', ['c401'])).rejects.toThrow(/n'est pas visé/);
  });
});

describe("préparer l'ordre · tout ce qu'il exige, avant la première pièce", () => {
  it('recopie le donneur (RIB du journal) et le RIB principal de chaque tiers', async () => {
    const { service, prisma } = monter({ ribs: { tA: [principal({ titulaire: 'SARL A' })], tB: [principal({ iban: 'GB82WEST12345698765432' })] } });
    const p = await service.preparer('t', 'bq', ['c401', 'c402']);
    expect(p.donneur).toEqual({ banque: 'Rawbank', coordonnees: '0001', codeBic: 'RAWBCDKI', devise: null });
    expect(p.beneficiaires.get('c401')).toMatchObject({ tiersId: 'tA', beneficiaire: 'SARL A', coordonnees: '00011 777 12' });
    expect(p.beneficiaires.get('c402')).toMatchObject({ beneficiaire: 'Fournisseur B', coordonnees: 'IBAN GB82 WEST 1234 5698 7654 32' });
    // Seul le principal est lu · le filtre est dans la REQUÊTE, pas dans une doublure qui rendrait tout.
    const select = (prisma.compte.findMany.mock.calls[0] as unknown as [{ select: { tiersCompte: { select: { tiers: { select: { ribs: unknown } } } } } }])[0];
    expect(select.select.tiersCompte.select.tiers.select.ribs).toEqual({ where: { tenantId: 't', estPrincipal: true }, orderBy: { createdAt: 'asc' } });
  });

  it("refuse un journal sans RIB · l'ordre n'aurait pas de compte à débiter", async () => {
    const { service } = monter({ rib: null, ribs: { tA: [principal()] } });
    await expect(service.preparer('t', 'bq', ['c401'])).rejects.toThrow(/Aucun RIB .* journal BQ/);
  });

  // N° 37 (ligne sage-l3) · un RIB en devise PORTE l'ordre (loi n° 23/053,
  // art. 141, 1° vise la tenue des comptes, non la monnaie du compte
  // bancaire) · le refus d'avant est levé, la devise est rendue, et c'est la
  // règle ligne à ligne qui garde que chaque règlement soit dans sa monnaie.
  it('rend la devise du donneur quand le RIB du journal est tenu en devise, le franc comme « aucune »', async () => {
    const usd = monter({ rib: { ...ribJournal, devise: 'usd' }, ribs: { tA: [principal()] } });
    expect((await usd.service.preparer('t', 'bq', ['c401'])).donneur.devise).toBe('USD');
    const cdf = monter({ rib: { ...ribJournal, devise: 'CDF' }, ribs: { tA: [principal()] } });
    expect((await cdf.service.preparer('t', 'bq', ['c401'])).donneur.devise).toBeNull();
  });

  it("refuse, avant la première pièce, une ligne réglée dans une autre monnaie que celle du donneur", async () => {
    const { service } = monter({ rib: { ...ribJournal, devise: 'USD' }, ribs: { tA: [principal()] } });
    const p = await service.preparer('t', 'bq', ['c401']);
    expect(() => service.refuserLignesHorsDevise(p, 'BQ', [{ compte: '40110001', devise: 'USD' }])).not.toThrow();
    expect(() => service.refuserLignesHorsDevise(p, 'BQ', [{ compte: '40110001', devise: null }])).toThrow(/tenu en USD.*40110001/);
    // Donneur en francs, ligne réglée en dollars · même refus, l'issue nommée.
    const francs = monter({ ribs: { tA: [principal()] } });
    const pf = await francs.service.preparer('t', 'bq', ['c401']);
    expect(() => francs.service.refuserLignesHorsDevise(pf, 'BQ', [{ compte: '40110001', devise: 'USD' }])).toThrow(/aucune devise renseignée.*Structure > Banques/);
  });

  it('nomme TOUS les tiers sans RIB principal et tout compte sans tiers, en un seul refus', async () => {
    const { service } = monter({ ribs: { tA: [principal()] } });
    await expect(service.preparer('t', 'bq', ['c401', 'c402', 'c409'])).rejects.toThrow(
      /F002 · Fournisseur B n'a pas de RIB principal ; le compte 40110009 n'est rattaché à aucun tiers/,
    );
  });
});

describe("créer, imprimer, annuler", () => {
  function monterOrdre(statut: string) {
    const ordre = { id: 'o1', statut, lignes: [], journal: { code: 'BQ', intitule: 'Banque' } };
    const update = jest.fn(async () => ordre);
    const lignesUpdate = jest.fn(async () => ({ count: 2 }));
    const prisma: Record<string, unknown> = {
      ordreVirement: { findFirst: jest.fn(async () => ordre), update },
      ligneOrdreVirement: { updateMany: lignesUpdate },
      // La transaction exécute sa fonction sur la doublure (audit final F159).
      $transaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(prisma)),
    };
    return { service: new OrdresVirementService(prisma as never), update, lignesUpdate };
  }

  it("la PREMIÈRE impression passe l'ordre à IMPRIMÉ et en garde l'auteur ; une réimpression ne change que le compteur", async () => {
    const a = monterOrdre('A_IMPRIMER');
    await a.service.imprimer('t', 'o1', 'x@y.cd');
    expect(a.update).toHaveBeenCalledWith({
      where: { id: 'o1' },
      data: expect.objectContaining({ nombreImpressions: { increment: 1 }, statut: 'IMPRIME', premiereImpressionPar: 'x@y.cd' }),
    });
    const b = monterOrdre('IMPRIME');
    await b.service.imprimer('t', 'o1', 'z@y.cd');
    expect(b.update).toHaveBeenCalledWith({ where: { id: 'o1' }, data: { nombreImpressions: { increment: 1 } } });
  });

  it('un ordre annulé ne se réimprime pas', async () => {
    const { service, update } = monterOrdre('ANNULE');
    await expect(service.imprimer('t', 'o1', 'x@y.cd')).rejects.toThrow(/annulé/);
    expect(update).not.toHaveBeenCalled();
  });

  it('annuler exige un motif et LIBÈRE les pièces sans les défaire', async () => {
    const sans = monterOrdre('IMPRIME');
    await expect(sans.service.annuler('t', 'o1', 'x@y.cd', ' ')).rejects.toThrow(/motif/);
    expect(sans.lignesUpdate).not.toHaveBeenCalled();

    const avec = monterOrdre('IMPRIME');
    await avec.service.annuler('t', 'o1', 'x@y.cd', 'rejet de la banque');
    expect(avec.lignesUpdate).toHaveBeenCalledWith({ where: { tenantId: 't', ordreId: 'o1' }, data: { ecritureId: null } });
    expect(avec.update).toHaveBeenCalledWith({
      where: { id: 'o1' },
      data: expect.objectContaining({ statut: 'ANNULE', annulePar: 'x@y.cd', motifAnnulation: 'rejet de la banque' }),
    });
  });

  it('numérote en continu par dossier et rejoue sur le numéro suivant quand deux créations se croisent', async () => {
    let dernier = 4;
    let collision = true;
    const create = jest.fn(async ({ data }: { data: { numero: number; total: number } }) => {
      if (collision) {
        collision = false;
        dernier = 5;
        throw new Prisma.PrismaClientKnownRequestError('unique', { code: 'P2002', clientVersion: 'x' });
      }
      return { id: 'o', numero: data.numero, total: data.total };
    });
    const tx = { ordreVirement: { aggregate: jest.fn(async () => ({ _max: { numero: dernier } })), create } };
    const prisma = { $transaction: jest.fn((fn: (t: typeof tx) => unknown) => fn(tx)) };
    const service = new OrdresVirementService(prisma as never);
    const preparation = {
      donneur: { banque: 'Rawbank', coordonnees: '0001', codeBic: null, devise: null },
      beneficiaires: new Map([['c401', { tiersId: 'tA', salarieId: null, beneficiaire: 'A', banque: 'B', coordonnees: '1', codeBic: null }]]),
    };
    const r = await service.creer('t', 'x@y.cd', 'bq', '2026-09-25', preparation, [
      { compteId: 'c401', montant: 100.1, reference: null, ecritureId: 'e1', pieceReglement: 'BQ 7' },
      { compteId: 'c401', montant: 0.2, reference: null, ecritureId: 'e2', pieceReglement: 'BQ 8' },
    ]);
    expect(r.numero).toBe(6);
    expect(r.total).toBe(100.3);
    const lignes = (create.mock.calls[1] as unknown as [{ data: { lignes: { create: { tiersId: string; ecritureId: string }[] } } }])[0].data.lignes.create;
    expect(lignes.map((l) => [l.tiersId, l.ecritureId])).toEqual([['tA', 'e1'], ['tA', 'e2']]);
  });

  // N° 37 · l'ordre en devise porte le montant que la banque exécute, ligne
  // par ligne et en total, à côté de la contrevaleur en francs du livre.
  it("en devise, l'ordre écrit la devise, le total et le montant en devise de chaque ligne ; une ligne en francs le refuse", async () => {
    const create = jest.fn(async ({ data }: { data: Record<string, unknown> }) => ({ id: 'o', ...data }));
    const tx = { ordreVirement: { aggregate: jest.fn(async () => ({ _max: { numero: null } })), create } };
    const prisma = { $transaction: jest.fn((fn: (t: typeof tx) => unknown) => fn(tx)) };
    const service = new OrdresVirementService(prisma as never);
    const preparation = {
      donneur: { banque: 'Rawbank', coordonnees: '0001', codeBic: null, devise: 'USD' },
      beneficiaires: new Map([['c401', { tiersId: 'tA', salarieId: null, beneficiaire: 'A', banque: 'B', coordonnees: '1', codeBic: null }]]),
    };
    await service.creer('t', 'x@y.cd', 'bq', '2026-09-25', preparation, [
      { compteId: 'c401', montant: 2_900_000, montantDevise: 1_000, devise: 'USD', reference: null, ecritureId: 'e1', pieceReglement: 'BQ 7' },
      { compteId: 'c401', montant: 290_000, montantDevise: 100.004, devise: 'USD', reference: null, ecritureId: 'e2', pieceReglement: 'BQ 8' },
      // Deux demi-centimes · chaque ligne s'écrit 0,01 et le total les somme (0,02), jamais la somme brute arrondie (0,01).
      { compteId: 'c401', montant: 14.5, montantDevise: 0.005, devise: 'USD', reference: null, ecritureId: 'e2b', pieceReglement: 'BQ 8b' },
      { compteId: 'c401', montant: 14.5, montantDevise: 0.005, devise: 'USD', reference: null, ecritureId: 'e2c', pieceReglement: 'BQ 8c' },
    ]);
    const data = (create.mock.calls[0] as unknown as [{ data: { devise: string; total: number; totalDevise: number; lignes: { create: { montantDevise: number }[] } } }])[0].data;
    expect(data.devise).toBe('USD');
    expect(data.total).toBe(3_190_029);
    expect(data.totalDevise).toBe(1_100.02);
    expect(data.lignes.create.map((l) => l.montantDevise)).toEqual([1_000, 100, 0.01, 0.01]);
    await expect(
      service.creer('t', 'x@y.cd', 'bq', '2026-09-25', preparation, [
        { compteId: 'c401', montant: 100, montantDevise: null, devise: null, reference: null, ecritureId: 'e3', pieceReglement: 'BQ 9' },
      ]),
    ).rejects.toThrow(/monnaie du donneur \(USD\)/);
    // Donneur en francs · une ligne qui porte une devise est aussi refusée, et rien n'est écrit en devise.
    const francs = { ...preparation, donneur: { ...preparation.donneur, devise: null } };
    await expect(
      service.creer('t', 'x@y.cd', 'bq', '2026-09-25', francs, [
        { compteId: 'c401', montant: 100, montantDevise: 1, devise: 'USD', reference: null, ecritureId: 'e4', pieceReglement: 'BQ 9' },
      ]),
    ).rejects.toThrow(/monnaie du donneur \(CDF\)/);
    await service.creer('t', 'x@y.cd', 'bq', '2026-09-25', francs, [
      { compteId: 'c401', montant: 100, reference: null, ecritureId: 'e5', pieceReglement: 'BQ 9' },
    ]);
    const enFrancs = (create.mock.calls[1] as unknown as [{ data: { devise: null; totalDevise: null; lignes: { create: { montantDevise: null }[] } } }])[0].data;
    expect([enFrancs.devise, enFrancs.totalDevise, enFrancs.lignes.create[0].montantDevise]).toEqual([null, null, null]);
  });
});

/**
 * AUDIT FINAL F207 · la liste s'arrêtait aux cinq cents plus récents sans le
 * dire, et un ordre ancien resté à imprimer sortait de l'onglet. La doublure
 * HONORE le filtre (dossier, état), le tri et la borne, pour que le total et
 * le décompte des ordres à imprimer se lisent sur ce que la base rendrait.
 */
describe('la liste des ordres est une tranche qui se dit', () => {
  function monterListe(nombre: number, aImprimer: number[]) {
    const tous = Array.from({ length: nombre }, (_, i) => ({
      id: `o${i + 1}`,
      tenantId: 't',
      numero: i + 1,
      statut: aImprimer.includes(i + 1) ? 'A_IMPRIMER' : 'IMPRIME',
    }));
    // Un ordre d'un autre dossier, que ni la liste ni les décomptes ne voient.
    tous.push({ id: 'x', tenantId: 'autre', numero: 1, statut: 'A_IMPRIMER' });
    const garde = (where: { tenantId: string; statut?: string }) =>
      tous.filter((o) => o.tenantId === where.tenantId && (where.statut === undefined || o.statut === where.statut));
    const prisma = {
      ordreVirement: {
        findMany: jest.fn(async ({ where, orderBy, take }: { where: { tenantId: string }; orderBy: { numero: 'desc' }; take: number }) => {
          expect(orderBy).toEqual({ numero: 'desc' });
          return [...garde(where)].sort((a, b) => b.numero - a.numero).slice(0, take);
        }),
        count: jest.fn(async ({ where }: { where: { tenantId: string; statut?: string } }) => garde(where).length),
      },
    };
    return { service: new OrdresVirementService(prisma as never), prisma };
  }

  it('au-delà du plafond · les plus récents, le total du dossier, et les ordres à imprimer restés hors de la tranche', async () => {
    const { service, prisma } = monterListe(PLAFOND_ORDRES_LISTES + 2, [1, PLAFOND_ORDRES_LISTES + 2]);
    const r = await service.lister('t');
    expect(prisma.ordreVirement.findMany.mock.calls[0][0].take).toBe(PLAFOND_ORDRES_LISTES);
    expect(r.ordres).toHaveLength(PLAFOND_ORDRES_LISTES);
    expect(r.ordres[0].numero).toBe(PLAFOND_ORDRES_LISTES + 2);
    expect(r.total).toBe(PLAFOND_ORDRES_LISTES + 2);
    expect(r.tronque).toBe(true);
    // L'ordre n° 1, à imprimer, n'est pas dans la tranche · il est compté quand même.
    expect(r.ordres.some((o) => o.numero === 1)).toBe(false);
    expect(r.enAttenteImpression).toBe(2);
  });

  it('une liste entière ne se dit pas tronquée', async () => {
    const { service } = monterListe(3, [2]);
    const r = await service.lister('t');
    expect(r).toMatchObject({ total: 3, tronque: false, enAttenteImpression: 1, statut: null });
    expect(r.ordres.map((o) => o.numero)).toEqual([3, 2, 1]);
  });

  /**
   * AUDIT FINAL F207, LE RESTE · le filtre par état. La liste et son total se
   * lisent sur le MÊME filtre, les ordres à imprimer sur le dossier entier.
   */
  it('filtrée par état · la liste et son total ne portent que cet état, et le filtre est rendu', async () => {
    const { service, prisma } = monterListe(6, [2, 5]);
    const r = await service.lister('t', 'A_IMPRIMER' as never);
    expect(prisma.ordreVirement.findMany.mock.calls[0][0].where).toEqual({ tenantId: 't', statut: 'A_IMPRIMER' });
    expect(r.ordres.map((o) => o.numero)).toEqual([5, 2]);
    expect(r).toMatchObject({ total: 2, tronque: false, enAttenteImpression: 2, statut: 'A_IMPRIMER' });
  });

  it('un filtre qui ne garde qu’une partie du dossier ne se dit pas tronqué pour autant', async () => {
    // Le dossier dépasse le plafond, l'état filtré non · un total pris sur le
    // dossier entier annoncerait une tranche sur une liste complète.
    const { service } = monterListe(PLAFOND_ORDRES_LISTES + 2, [1, 3]);
    const r = await service.lister('t', 'A_IMPRIMER' as never);
    expect(r.ordres.map((o) => o.numero)).toEqual([3, 1]);
    expect(r).toMatchObject({ total: 2, tronque: false });
  });

  it('filtrée au-delà du plafond · la tranche se dit, les ordres à imprimer restent comptés sur le dossier', async () => {
    const { service } = monterListe(PLAFOND_ORDRES_LISTES + 3, [1]);
    const r = await service.lister('t', 'IMPRIME' as never);
    expect(r.ordres).toHaveLength(PLAFOND_ORDRES_LISTES);
    expect(r.ordres.every((o) => o.statut === 'IMPRIME')).toBe(true);
    expect(r).toMatchObject({ total: PLAFOND_ORDRES_LISTES + 2, tronque: true, statut: 'IMPRIME' });
    // Aucun ordre à imprimer dans une liste filtrée sur « Imprimé » · celui du
    // dossier est compté quand même, pour que l'écran dise qu'il attend.
    expect(r.enAttenteImpression).toBe(1);
  });

  it('un état inconnu est refusé avant toute lecture, jamais ignoré', async () => {
    const { service, prisma } = monterListe(3, [2]);
    await expect(service.lister('t', 'INCONNU' as never)).rejects.toThrow(/État d'ordre de virement inconnu : INCONNU/);
    expect(prisma.ordreVirement.findMany).not.toHaveBeenCalled();
    expect(prisma.ordreVirement.count).not.toHaveBeenCalled();
  });
});
