import { TypeTiers } from '@prisma/client';
import { motifRefusIntitule, motifRefusPas, prixNetArrondi } from './arrondi';
import { jugerEncours, motifRefusEncoursMaximum } from './encours-client';
import { motifRefusRepresentant, roleExigePour } from './collaborateurs';
import { StructuresCommercialesService } from './structures-commerciales.service';
import { EncoursClientService } from './encours-client.service';
import { ArticlesCommerciauxService } from './articles.service';
import { ArticlesCommerciauxController } from './articles.controller';
import { prixPropose } from './articles';

type Faux = Record<string, unknown>;

const collaborateur = (roles: Partial<Record<'vendeur' | 'acheteur', boolean>> = {}, actif = true) => ({
  nom: 'Kabila',
  prenom: 'Joseph',
  actif,
  vendeur: false,
  caissier: false,
  acheteur: false,
  controleur: false,
  financier: false,
  recouvrement: false,
  ...roles,
});

describe('fonction 94 · le prix net proposé s’arrondit au pas, en centimes entiers', () => {
  it('sans mode, au centime le plus proche, le demi-centime au-dessus', () => {
    expect(prixNetArrondi(1000, 0, null)).toBe(1000);
    expect(prixNetArrondi(1999.99, 12.5, null)).toBe(1749.99); // 1 749,99125
    expect(prixNetArrondi(0.05, 10, null)).toBe(0.05); // 0,045 → 0,05
  });
  it('les trois méthodes au pas de 5 francs', () => {
    const p = 1999.99 * 1; // net 1 749,99125 avec 12,5 %
    expect(prixNetArrondi(p, 12.5, { methode: 'PROCHE', pas: 5 })).toBe(1750);
    expect(prixNetArrondi(p, 12.5, { methode: 'INFERIEUR', pas: 5 })).toBe(1745);
    expect(prixNetArrondi(p, 12.5, { methode: 'SUPERIEUR', pas: 5 })).toBe(1750);
    expect(prixNetArrondi(1750, 0, { methode: 'SUPERIEUR', pas: 5 })).toBe(1750); // déjà au pas · rien ne monte
    expect(prixNetArrondi(1750.01, 0, { methode: 'SUPERIEUR', pas: 100 })).toBe(1800);
  });
  it('le pas et l’intitulé se jugent', () => {
    expect(motifRefusPas(0.01)).toBeNull();
    expect(motifRefusPas(0)).toMatch(/au moins un centime/);
    expect(motifRefusPas(0.001)).toMatch(/au centime/);
    expect(motifRefusPas(2_000_000)).toMatch(/au plus/);
    expect(motifRefusIntitule('  ')).toMatch(/exigé/);
  });
});

describe('fonction 30 · l’encours averti, jamais refusé, jamais zéro sur un solde illisible', () => {
  const base = { facturesNonComptabilisees: 0, nombreFacturesNonComptabilisees: 0, venteEnCours: 0, aDesLignesEnDevise: false, motifSolde: null };
  it('sous le maximum, rien à dire ; au-delà, l’avertissement chiffre le dépassement', () => {
    expect(jugerEncours({ ...base, encoursMaximum: 1_000_000, soldeComptable: 400_000 }).avertissement).toBeNull();
    const r = jugerEncours({ ...base, encoursMaximum: 1_000_000, soldeComptable: 800_000, facturesNonComptabilisees: 300_000, nombreFacturesNonComptabilisees: 1 });
    expect(r.encours).toBe(1_100_000);
    expect(r.depassement).toBe(100_000);
    expect(r.avertissement).toMatch(/dépassé.*n'est pas refusée/);
  });
  it('à égalité, pas de dépassement (au centime)', () => {
    expect(jugerEncours({ ...base, encoursMaximum: 1000.1, soldeComptable: 1000.1 }).depassement).toBeNull();
  });
  it('un solde illisible rend « non calculé », jamais un encours nul', () => {
    const r = jugerEncours({ ...base, encoursMaximum: 1000, soldeComptable: null, motifSolde: 'aucun exercice' });
    expect(r.encours).toBeNull();
    expect(r.avertissement).toMatch(/non calculé · aucun exercice/);
  });
  it('les lignes en devise sont dites', () => {
    expect(jugerEncours({ ...base, aDesLignesEnDevise: true, encoursMaximum: 1, soldeComptable: 2 }).avertissement).toMatch(/contrevaleur en francs/);
  });
  it('l’encours maximum vaut pour un client ou un adhérent, en francs au centime', () => {
    expect(motifRefusEncoursMaximum(500_000, 'CLIENT')).toBeNull();
    expect(motifRefusEncoursMaximum(null, 'FOURNISSEUR')).toBeNull();
    expect(motifRefusEncoursMaximum(500_000, 'FOURNISSEUR')).toMatch(/client ou un adhérent/);
    expect(motifRefusEncoursMaximum(-1, 'CLIENT')).toMatch(/positif/);
    expect(motifRefusEncoursMaximum(1.001, 'ADHERENT')).toMatch(/centime/);
  });
});

describe('fonction 91 · le représentant porte le rôle que le tiers exige', () => {
  it('vendeur pour un client ou un adhérent, acheteur pour un fournisseur, aucun ailleurs', () => {
    expect(roleExigePour(TypeTiers.CLIENT)).toBe('vendeur');
    expect(roleExigePour(TypeTiers.FOURNISSEUR)).toBe('acheteur');
    expect(roleExigePour(TypeTiers.SALARIE)).toBeNull();
    expect(motifRefusRepresentant(TypeTiers.CLIENT, collaborateur({ vendeur: true }))).toBeNull();
    expect(motifRefusRepresentant(TypeTiers.CLIENT, collaborateur({ acheteur: true }))).toMatch(/rôle de vendeur/);
    expect(motifRefusRepresentant(TypeTiers.FOURNISSEUR, collaborateur({ acheteur: true }, false))).toMatch(/en sommeil/);
    expect(motifRefusRepresentant(TypeTiers.AUTRE, collaborateur({ vendeur: true }))).toMatch(/pas de représentant/);
  });

  it('un rôle ne se retire pas tant qu’un tiers qui l’exige est représenté · le refus dit l’issue', async () => {
    const prisma = {
      collaborateur: { findFirst: jest.fn().mockResolvedValue({ id: 'c', ...collaborateur({ vendeur: true, acheteur: true }) }), update: jest.fn() },
      tiers: { groupBy: jest.fn().mockResolvedValue([{ type: TypeTiers.CLIENT, _count: { _all: 1 } }, { type: TypeTiers.FOURNISSEUR, _count: { _all: 1 } }]) },
    };
    const s = new StructuresCommercialesService(prisma as never);
    await expect(s.modifierCollaborateur('t', 'c', { vendeur: false })).rejects.toThrow(/représente 1 tiers.*Changez d’abord leur représentant/);
    await expect(s.modifierCollaborateur('t', 'c', { actif: false })).rejects.toThrow(/représente 2 tiers/);
    expect(prisma.collaborateur.update).not.toHaveBeenCalled();
    expect(prisma.tiers.groupBy).toHaveBeenCalledWith(expect.objectContaining({ where: { tenantId: 't', representantId: 'c' } }));
  });
});

describe('fonction 30 · le solde du client se lit dans son exercice, et ne se présume pas', () => {
  it('aucun exercice ne couvre la date · non calculé, avec le motif', async () => {
    const prisma = {
      tiers: { findFirst: jest.fn().mockResolvedValue({ code: 'C1', nom: 'Client', encoursMaximum: 1000, devise: null, comptesRattaches: [{ compteId: 'k', compte: { numero: '41110001', _count: { individuels: 0 } } }] }) },
      exercice: { findFirst: jest.fn().mockResolvedValue(null) },
      ligneFacture: { aggregate: jest.fn().mockResolvedValue({ _sum: { montantHT: null, montantTva: null } }) },
      facture: { aggregate: jest.fn().mockResolvedValue({ _sum: { autresImpotsEtTaxes: null } }), count: jest.fn().mockResolvedValue(0) },
      ligneEcriture: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    const r = await new EncoursClientService(prisma as never).encours('t', 'x', new Date('2026-03-01T00:00:00Z'));
    expect(r.soldeComptable).toBeNull();
    expect(r.avertissement).toMatch(/non calculé · aucun exercice ne couvre/);
    expect(prisma.tiers.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'x', tenantId: 't' } }));
  });

  it('les factures de vente non passées comptent, en TTC, et la remontée suit un exercice précédent ouvert sans ouverture', async () => {
    const agg = jest
      .fn()
      .mockResolvedValueOnce({ _sum: { debit: 500_000, credit: 100_000 } }) // N
      .mockResolvedValueOnce({ _sum: { debit: 200_000, credit: 0 } }); // N-1 ouvert
    const prisma = {
      tiers: { findFirst: jest.fn().mockResolvedValue({ code: 'C1', nom: 'Client', encoursMaximum: 700_000, devise: { code: 'USD' }, comptesRattaches: [{ compteId: 'k', compte: { numero: '41110001', _count: { individuels: 0 } } }] }) },
      exercice: {
        findFirst: jest
          .fn()
          .mockResolvedValueOnce({ id: 'n', dateDebut: new Date('2026-01-01T00:00:00Z') })
          .mockResolvedValueOnce({ id: 'n1', dateDebut: new Date('2025-01-01T00:00:00Z'), statut: 'OUVERT' })
          .mockResolvedValueOnce(null),
      },
      ecriture: { count: jest.fn().mockResolvedValue(0) },
      ligneEcriture: { aggregate: agg, findFirst: jest.fn().mockResolvedValue(null) },
      ligneFacture: { aggregate: jest.fn().mockResolvedValueOnce({ _sum: { montantHT: 100_000, montantTva: 16_000 } }).mockResolvedValueOnce({ _sum: { montantHT: 0, montantTva: 0 } }) },
      facture: { aggregate: jest.fn().mockResolvedValue({ _sum: { autresImpotsEtTaxes: null } }), count: jest.fn().mockResolvedValueOnce(1).mockResolvedValueOnce(0) },
    };
    const r = await new EncoursClientService(prisma as never).encours('t', 'x', new Date('2026-03-01T00:00:00Z'));
    expect(r.soldeComptable).toBe(600_000);
    expect(r.facturesNonComptabilisees).toBe(116_000);
    expect(r.encours).toBe(716_000);
    expect(r.depassement).toBe(16_000);
    expect(r.tiers.devise).toBe('USD');
  });
});

describe('relecture indépendante · M3, M4 et mineurs', () => {
  const baseEncours = (rattaches: Faux[]) => {
    const agg = jest.fn().mockResolvedValue({ _sum: { debit: 100, credit: 0 } });
    return {
      agg,
      prisma: {
        tiers: { findFirst: jest.fn().mockResolvedValue({ code: 'C0', nom: 'Ancien', encoursMaximum: 1000, devise: null, comptesRattaches: rattaches }) },
        exercice: { findFirst: jest.fn().mockResolvedValueOnce({ id: 'n', dateDebut: new Date('2026-01-01T00:00:00Z') }).mockResolvedValue(null) },
        ecriture: { count: jest.fn().mockResolvedValue(1) },
        ligneEcriture: { aggregate: agg, findFirst: jest.fn().mockResolvedValue(null) },
        ligneFacture: { aggregate: jest.fn().mockResolvedValue({ _sum: {} }) },
        facture: { aggregate: jest.fn().mockResolvedValue({ _sum: {} }), count: jest.fn().mockResolvedValue(0) },
      },
    };
  };
  it('M3 · un tiers rattaché au seul collectif commun · non calculé, avec le motif', async () => {
    const { prisma, agg } = baseEncours([{ compteId: 'coll', compte: { numero: '41110000', _count: { individuels: 12 } } }]);
    const r = await new EncoursClientService(prisma as never).encours('t', 'x', new Date('2026-03-01T00:00:00Z'));
    expect(r.soldeComptable).toBeNull();
    expect(r.avertissement).toMatch(/collectif 41110000, qui porte les comptes d'autres tiers/);
    expect(agg).not.toHaveBeenCalled();
  });
  it('M3 · le collectif est écarté, le compte individuel lu', async () => {
    const { prisma, agg } = baseEncours([
      { compteId: 'coll', compte: { numero: '41110000', _count: { individuels: 12 } } },
      { compteId: 'ind', compte: { numero: '41110007', _count: { individuels: 0 } } },
    ]);
    await new EncoursClientService(prisma as never).encours('t', 'x', new Date('2026-03-01T00:00:00Z'));
    expect(agg.mock.calls[0][0].where.compteId).toEqual({ in: ['ind'] });
  });
  it('mineurs 1 et 2 · toute pièce non passée datée au plus tard du jour, la note retranchée sans condition sur sa facture', async () => {
    const { prisma } = baseEncours([{ compteId: 'ind', compte: { numero: '41110007', _count: { individuels: 0 } } }]);
    await new EncoursClientService(prisma as never).encours('t', 'x', new Date('2026-03-01T00:00:00Z'));
    const filtres = (prisma.facture.count as jest.Mock).mock.calls.map((c) => c[0].where);
    expect(filtres[0]).toEqual(expect.objectContaining({ nature: 'FACTURE', ecritureId: null, dateFacture: { lt: new Date('2026-03-02T00:00:00Z') } }));
    expect(filtres[0]).not.toHaveProperty('noteDeCredit');
    expect(filtres[1]).toEqual(expect.objectContaining({ nature: 'NOTE_DE_CREDIT', ecritureId: null }));
    expect(filtres[1]).not.toHaveProperty('factureAnnulee');
  });

  it('M4 · un article dont le taux est en sommeil se met en sommeil sans relire le taux', async () => {
    const actuel = { id: 'a', tenantId: 't', reference: 'A1', unite: 'sac', compteVenteId: null, compteAchatId: null, tauxTvaId: 'tv', articleStockId: null, modeArrondiId: 'm', exonere: false };
    const prisma = {
      articleCommercial: { findFirst: jest.fn().mockResolvedValue(actuel), update: jest.fn().mockResolvedValue({ ...actuel, prixVenteHT: null, prixAchatHT: null, actif: false, tauxTva: null, modeArrondi: null, compteVente: null, compteAchat: null, articleStock: null }) },
      tauxTva: { findFirst: jest.fn().mockResolvedValue({ estActif: false, code: 'T16' }) },
      modeArrondi: { findFirst: jest.fn().mockResolvedValue({ actif: false, intitule: 'Cent' }) },
      compte: { findMany: jest.fn().mockResolvedValue([]) },
    };
    await new ArticlesCommerciauxService(prisma as never).modifier('t', 'a', { actif: false });
    expect(prisma.tauxTva.findFirst).not.toHaveBeenCalled();
    expect(prisma.modeArrondi.findFirst).not.toHaveBeenCalled();
    expect(prisma.articleCommercial.update).toHaveBeenCalled();
  });

  it('mineur 4 · taux et mode en sommeil ne se proposent plus, et c’est dit', async () => {
    const article = {
      id: 'a', reference: 'A1', designation: 'Ciment', unite: 'sac', compteVenteId: 'k', compteAchatId: null, tauxTvaId: 'tv', exonere: false,
      prixVenteHT: 1000, prixAchatHT: null, articleStockId: null, modeArrondiId: 'm', actif: true, compteVente: null, compteAchat: null, articleStock: null,
      tauxTva: { code: 'T16', taux: 16, estActif: false }, modeArrondi: { intitule: 'Cent sup', methode: 'SUPERIEUR', pas: 100, actif: false },
    };
    const prisma = { articleCommercial: { findFirst: jest.fn().mockResolvedValue(article) }, tarifClient: { findFirst: jest.fn().mockResolvedValue(null) } };
    const p = await new ArticlesCommerciauxService(prisma as never).propositionPrix('t', 'a', undefined, 'VENTE');
    expect(p.tauxTvaId).toBeNull();
    expect(p.prixNetUnitaireHT).toBe(1000);
    expect(p.avertissement).toMatch(/taux T16.*en sommeil.*« Cent sup » est en sommeil/);
  });

  it('mineur 3 · un arrondi au-dessus du prix sans remise, ou à zéro, se dit', () => {
    expect(prixPropose(1050, null, { methode: 'SUPERIEUR', pas: 100 }).avertissement).toMatch(/au-dessus du prix sans remise/);
    expect(prixPropose(40, null, { methode: 'INFERIEUR', pas: 100 }).avertissement).toMatch(/à zéro/);
    expect(prixPropose(1000, { prixHT: null, remisePourcent: 10 }, { methode: 'PROCHE', pas: 100 }).avertissement).toBeNull();
  });

  it('mineur 4 · un mode porté par des articles, mis en sommeil, le dit', async () => {
    const prisma = {
      modeArrondi: { findFirst: jest.fn().mockResolvedValue({ id: 'm' }), update: jest.fn().mockResolvedValue({ id: 'm', intitule: 'Cent', methode: 'PROCHE', pas: 100, actif: false }) },
      articleCommercial: { count: jest.fn().mockResolvedValue(3) },
    };
    const r = await new StructuresCommercialesService(prisma as never).modifierMode('t', 'm', { actif: false });
    expect(r.avertissement).toMatch(/3 article\(s\) portent ce mode/);
  });

  it('mineur 8 · une date absente du calendrier est refusée en 400', async () => {
    const encours = { encours: jest.fn() };
    const c = new ArticlesCommerciauxController({} as never, encours as never);
    expect(() => c.encoursDuClient({ tenantId: 't' } as never, 'x', { date: '2026-02-30' })).toThrow(/absente du calendrier/);
    expect(encours.encours).not.toHaveBeenCalled();
  });
});
