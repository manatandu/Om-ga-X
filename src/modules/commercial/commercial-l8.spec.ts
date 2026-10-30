import { TypeTiers } from '@prisma/client';
import { motifRefusIntitule, motifRefusPas, prixNetArrondi } from './arrondi';
import { jugerEncours, motifRefusEncoursMaximum } from './encours-client';
import { motifRefusRepresentant, roleExigePour } from './collaborateurs';
import { StructuresCommercialesService } from './structures-commerciales.service';
import { EncoursClientService } from './encours-client.service';

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
      tiers: { findMany: jest.fn().mockResolvedValue([{ type: TypeTiers.CLIENT }, { type: TypeTiers.FOURNISSEUR }]) },
    };
    const s = new StructuresCommercialesService(prisma as never);
    await expect(s.modifierCollaborateur('t', 'c', { vendeur: false })).rejects.toThrow(/représente 1 tiers.*Changez d’abord leur représentant/);
    await expect(s.modifierCollaborateur('t', 'c', { actif: false })).rejects.toThrow(/représente 2 tiers/);
    expect(prisma.collaborateur.update).not.toHaveBeenCalled();
    expect(prisma.tiers.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { tenantId: 't', representantId: 'c' } }));
  });
});

describe('fonction 30 · le solde du client se lit dans son exercice, et ne se présume pas', () => {
  it('aucun exercice ne couvre la date · non calculé, avec le motif', async () => {
    const prisma = {
      tiers: { findFirst: jest.fn().mockResolvedValue({ code: 'C1', nom: 'Client', encoursMaximum: 1000, devise: null, comptesRattaches: [{ compteId: 'k' }] }) },
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
      tiers: { findFirst: jest.fn().mockResolvedValue({ code: 'C1', nom: 'Client', encoursMaximum: 700_000, devise: { code: 'USD' }, comptesRattaches: [{ compteId: 'k' }] }) },
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
