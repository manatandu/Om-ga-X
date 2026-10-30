import { ClasseCompte, TypeCompteDetailTotal, TypeTiers } from '@prisma/client';
import {
  motifRefusCompteAchat,
  motifRefusCompteVente,
  motifRefusPrix,
  motifRefusRemise,
  motifRefusTiersDuTarif,
  motifRefusUniteStockee,
  prixPropose,
} from './articles';
import { ArticlesCommerciauxService } from './articles.service';

const compte = (numero: string, classe: ClasseCompte, detail = true, actif = true) => ({
  numero,
  classe,
  typeCompte: detail ? TypeCompteDetailTotal.DETAIL : TypeCompteDetailTotal.TOTAL,
  estActif: actif,
});

describe('articles commerciaux · règles pures (ligne commercial-l8, étape a)', () => {
  it('la vente se passe en classe 7, l’achat en classe 6 hors 603, sur un compte d’imputation actif', () => {
    expect(motifRefusCompteVente(compte('70110000', ClasseCompte.CLASSE_7))).toBeNull();
    expect(motifRefusCompteVente(compte('60110000', ClasseCompte.CLASSE_6))).toMatch(/classe 7/);
    expect(motifRefusCompteVente(compte('701', ClasseCompte.CLASSE_7, false))).toMatch(/en-tête/);
    expect(motifRefusCompteVente(compte('70110000', ClasseCompte.CLASSE_7, true, false))).toMatch(/sommeil/);
    expect(motifRefusCompteAchat(compte('60110000', ClasseCompte.CLASSE_6))).toBeNull();
    expect(motifRefusCompteAchat(compte('60310000', ClasseCompte.CLASSE_6))).toMatch(/sauf 603/);
    expect(motifRefusCompteAchat(compte('24410000', ClasseCompte.CLASSE_2))).toMatch(/immobilisations/);
  });

  it('un prix est positif au centime, une remise de 0 à moins de 100', () => {
    expect(motifRefusPrix(null, 'prix')).toBeNull();
    expect(motifRefusPrix(1500.25, 'prix')).toBeNull();
    expect(motifRefusPrix(-1, 'prix')).toMatch(/positif/);
    expect(motifRefusPrix(1.234, 'prix')).toMatch(/centime/);
    expect(motifRefusRemise(0)).toBeNull();
    expect(motifRefusRemise(12.5)).toBeNull();
    expect(motifRefusRemise(100)).toMatch(/moins de 100/);
    expect(motifRefusRemise(-2)).toMatch(/moins de 100/);
  });

  it('un tarif se pose pour un client ou un adhérent, jamais un fournisseur', () => {
    expect(motifRefusTiersDuTarif(TypeTiers.CLIENT)).toBeNull();
    expect(motifRefusTiersDuTarif(TypeTiers.ADHERENT)).toBeNull();
    expect(motifRefusTiersDuTarif(TypeTiers.FOURNISSEUR)).not.toBeNull();
  });

  it('l’unité d’un article stocké est celle de sa fiche, à la casse près', () => {
    expect(motifRefusUniteStockee('Pièce', 'pièce')).toBeNull();
    expect(motifRefusUniteStockee('carton', 'pièce')).toMatch(/fiche de stock/);
  });

  it('le prix proposé · le tarif du client prime, la remise suit, rien n’est deviné', () => {
    expect(prixPropose(1000, null)).toEqual({ prixUnitaireHT: 1000, remisePourcent: 0, source: 'PRIX_DE_BASE' });
    expect(prixPropose(1000, { prixHT: 900, remisePourcent: 5 })).toEqual({ prixUnitaireHT: 900, remisePourcent: 5, source: 'TARIF_CLIENT' });
    expect(prixPropose(1000, { prixHT: null, remisePourcent: 10 })).toEqual({ prixUnitaireHT: 1000, remisePourcent: 10, source: 'PRIX_DE_BASE' });
    expect(prixPropose(null, null)).toEqual({ prixUnitaireHT: null, remisePourcent: 0, source: 'AUCUN' });
  });
});

describe('articles · le service relit chaque lien dans le dossier', () => {
  const base = () => ({
    compte: { findMany: jest.fn().mockResolvedValue([]) },
    tauxTva: { findFirst: jest.fn().mockResolvedValue(null) },
    articleStock: { findFirst: jest.fn().mockResolvedValue(null) },
    articleCommercial: { create: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
  });

  it('un compte d’un autre dossier est introuvable', async () => {
    const p = base();
    const s = new ArticlesCommerciauxService(p as never);
    await expect(s.creer('t', 'u', { reference: 'A1', designation: 'Ciment', unite: 'sac', compteVenteId: 'c-voisin' })).rejects.toThrow(/Compte introuvable/);
    expect(p.compte.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { tenantId: 't', id: { in: ['c-voisin'] } } }));
    expect(p.articleCommercial.create).not.toHaveBeenCalled();
  });

  it('un taux et une exonération ensemble sont refusés · exonéré n’est pas taux zéro', async () => {
    const p = base();
    const s = new ArticlesCommerciauxService(p as never);
    await expect(s.creer('t', 'u', { reference: 'A1', designation: 'Ciment', unite: 'sac', tauxTvaId: 'tv', exonere: true })).rejects.toThrow(/exonérée ne porte pas de taux/);
  });

  it('une fiche de stock déjà donnée à un autre article est refusée', async () => {
    const p = base();
    p.articleStock.findFirst.mockResolvedValue({ actif: true, code: 'CIM', uniteMesure: 'sac', articleCommercial: { id: 'autre', reference: 'A0' } });
    const s = new ArticlesCommerciauxService(p as never);
    await expect(s.creer('t', 'u', { reference: 'A1', designation: 'Ciment', unite: 'sac', articleStockId: 'f1' })).rejects.toThrow(/déjà celle de l’article A0/);
  });

  it('un tarif sans prix ni remise n’a rien à poser', async () => {
    const s = new ArticlesCommerciauxService(base() as never);
    await expect(s.poserTarif('t', 'u', { articleId: 'a', tiersId: 'c' })).rejects.toThrow(/prix propre, une remise/);
  });
});
