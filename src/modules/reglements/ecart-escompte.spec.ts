import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  RACINES_ECART_ESCOMPTE,
  avertissementEscompteApresEcheance,
  compteDuRole,
  comptesOfferts,
  lignesAvecEscompteEtEcart,
  planDuReglement,
  roleEscompte,
} from './ecart-escompte';

/**
 * ESCOMPTE ET ÉCART DE RÈGLEMENT (ligne sage-l2, fonction 36) · ce que ces
 * tests empêchent, en silence · un escompte passé sans solder le tiers (une
 * facture « due » de 20 francs à jamais), un écart en produit sur le trop-perçu
 * d'un client qu'il faut lui rendre (Code civil, Livre III, art. 252), un
 * fournisseur « soldé » d'une dette qu'il n'a pas remise (art. 142), un
 * escompte au compte de l'autre plan, une pièce qui ne boucle pas.
 */

const semis = (fichier: string) => readFileSync(join(__dirname, '../comptes', fichier), 'utf8');

describe('les comptes, lus dans les deux semis', () => {
  const sycebnl = semis('compte-seed.ts');
  const syscohada = semis('compte-seed-syscohada.ts');

  it('773 et 673 aux deux plans, sous les intitulés des fiches', () => {
    expect(sycebnl).toContain("['77300000', 'Escomptes obtenus']");
    expect(sycebnl).toContain("['67300000', 'Escomptes accordés']");
    expect(syscohada).toContain("d('77300000', 'Escomptes obtenus'");
    expect(syscohada).toContain("d('67300000', 'Escomptes accordés'");
    expect(RACINES_ECART_ESCOMPTE.SYCEBNL.ESCOMPTE_OBTENU).toBe('773');
    expect(RACINES_ECART_ESCOMPTE.SYSCOHADA.ESCOMPTE_ACCORDE).toBe('673');
  });

  it('l’écart au résidu des charges diverses · 6588 au SYSCOHADA (658 y est un total), 658 au SYCEBNL (non subdivisé)', () => {
    expect(syscohada).toContain("t('658', 'Charges diverses'");
    expect(syscohada).toContain("d('65880000', 'Autres charges diverses'");
    expect(sycebnl).toContain("['65800000', 'Charges diverses']");
    expect(sycebnl).not.toMatch(/'6588\d{4}'/);
    expect(RACINES_ECART_ESCOMPTE.SYSCOHADA.ECART_REGLEMENT).toBe('6588');
    expect(RACINES_ECART_ESCOMPTE.SYCEBNL.ECART_REGLEMENT).toBe('658');
  });

  it('le sens choisit l’escompte · obtenu du fournisseur, accordé au client', () => {
    expect(roleEscompte('FOURNISSEUR')).toBe('ESCOMPTE_OBTENU');
    expect(roleEscompte('CLIENT')).toBe('ESCOMPTE_ACCORDE');
  });
});

describe('le compte du rôle · jamais deviné', () => {
  const seme = { id: 's', numero: '77300000', intitule: 'Escomptes obtenus' };
  const sous1 = { id: 'a', numero: '77300001', intitule: 'Escomptes obtenus · banque' };
  const sous2 = { id: 'b', numero: '77300002', intitule: 'Escomptes obtenus · caisse' };

  it('le seul compte du plan, tant qu’il n’est pas subdivisé', () => {
    expect(compteDuRole('SYSCOHADA', 'ESCOMPTE_OBTENU', [seme], undefined)).toEqual({ compte: seme });
  });

  it('subdivisé, il s’efface devant son sous-compte, comme à la saisie', () => {
    expect(comptesOfferts('SYSCOHADA', 'ESCOMPTE_OBTENU', [seme, sous1])).toEqual([sous1]);
    expect(compteDuRole('SYSCOHADA', 'ESCOMPTE_OBTENU', [seme, sous1], undefined)).toEqual({ compte: sous1 });
    expect(compteDuRole('SYSCOHADA', 'ESCOMPTE_OBTENU', [seme, sous1], 's')).toEqual({ motif: expect.stringMatching(/subdivisé/) });
  });

  it('deux sous-comptes · le choix est demandé, les numéros nommés', () => {
    expect(compteDuRole('SYSCOHADA', 'ESCOMPTE_OBTENU', [seme, sous1, sous2], undefined)).toEqual({
      motif: expect.stringMatching(/Plusieurs comptes sous le 773 pour l'escompte obtenu \(77300001, 77300002\)/),
    });
    expect(compteDuRole('SYSCOHADA', 'ESCOMPTE_OBTENU', [seme, sous1, sous2], 'b')).toEqual({ compte: sous2 });
  });

  it('aucun · le geste qui le lève est dit', () => {
    expect(compteDuRole('SYCEBNL', 'ECART_REGLEMENT', [], undefined)).toEqual({ motif: expect.stringMatching(/Aucun compte de détail actif sous le 658/) });
  });

  it('un compte hors de la racine n’est jamais admis, même choisi', () => {
    const autre = { id: 'x', numero: '65810000', intitule: 'Indemnités' };
    expect(compteDuRole('SYSCOHADA', 'ECART_REGLEMENT', [autre], 'x')).toEqual({ motif: expect.stringMatching(/sous le 6588/) });
  });
});

describe('le règlement, son escompte et son écart', () => {
  const fournisseur = { sens: 'FOURNISSEUR' as const, referentiel: 'SYSCOHADA' as const, numeroTiers: '40110001', du: 1000, solderEcart: false, seuil: 1 };
  const client = { sens: 'CLIENT' as const, referentiel: 'SYSCOHADA' as const, numeroTiers: '41110001', du: 1000, solderEcart: false, seuil: 1 };

  it('escompte obtenu · le fournisseur soldé du payé ET de l’escompte', () => {
    expect(planDuReglement({ ...fournisseur, montant: 980, escompte: 20 })).toEqual({ tiers: 1000, ecart: 0, partiel: false });
    expect(planDuReglement({ ...fournisseur, montant: 500, escompte: 20 })).toEqual({ tiers: 520, ecart: 0, partiel: true });
    expect(planDuReglement({ ...fournisseur, montant: 990, escompte: 20 })).toEqual({ motif: expect.stringMatching(/dépassent le dû/) });
  });

  it('un escompte qui atteint le dû ne remplace pas le paiement', () => {
    expect(planDuReglement({ ...fournisseur, montant: 1, escompte: 1000 })).toEqual({ motif: expect.stringMatching(/il ne le remplace pas/) });
  });

  it('trop-payé au fournisseur soldé en charge sous le seuil · au-delà, ou sans seuil, refusé', () => {
    expect(planDuReglement({ ...fournisseur, montant: 1000.4, escompte: 0, solderEcart: true })).toEqual({ tiers: 1000, ecart: 0.4, partiel: false });
    expect(planDuReglement({ ...fournisseur, montant: 1001.5, escompte: 0, solderEcart: true })).toEqual({ motif: expect.stringMatching(/dépasse le seuil du dossier \(1\.00\)/) });
    expect(planDuReglement({ ...fournisseur, montant: 1000.4, escompte: 0, solderEcart: true, seuil: null })).toEqual({
      motif: expect.stringMatching(/Aucun seuil d'écart de règlement n'est fixé/),
    });
  });

  it('le fournisseur payé moins que le dû n’est pas soldé par le dossier (Code civil, Livre III, art. 132 et 142)', () => {
    expect(planDuReglement({ ...fournisseur, montant: 999.6, escompte: 0, solderEcart: true })).toEqual({ motif: expect.stringMatching(/art\. 132 et 142/) });
    expect(planDuReglement({ ...fournisseur, montant: 1000, escompte: 0, solderEcart: true })).toEqual({ motif: expect.stringMatching(/pas d'écart à solder/) });
  });

  it('le reste qu’un client ne paie pas se remet en charge sous le seuil, escompte compris', () => {
    expect(planDuReglement({ ...client, montant: 999.7, escompte: 0, solderEcart: true })).toEqual({ tiers: 1000, ecart: 0.3, partiel: false });
    expect(planDuReglement({ ...client, montant: 979.5, escompte: 20, solderEcart: true })).toEqual({ tiers: 1000, ecart: 0.5, partiel: false });
    expect(planDuReglement({ ...client, montant: 979.5, escompte: 20 })).toEqual({ tiers: 999.5, ecart: 0, partiel: true });
  });

  it('le trop-perçu d’un client se restitue · jamais un produit, même sous le seuil (Code civil, Livre III, art. 252)', () => {
    expect(planDuReglement({ ...client, montant: 1000.2, escompte: 0, solderEcart: true })).toEqual({ motif: expect.stringMatching(/art\. 252/) });
    expect(planDuReglement({ ...client, montant: 1000.2, escompte: 0 })).toEqual({ motif: expect.stringMatching(/jamais en produit/) });
  });

  it('au SYCEBNL, l’escompte accordé ne vise que le client-usager (412), jamais l’adhérent', () => {
    expect(planDuReglement({ ...client, referentiel: 'SYCEBNL', numeroTiers: '41200001', montant: 980, escompte: 20 })).toEqual({ tiers: 1000, ecart: 0, partiel: false });
    expect(planDuReglement({ ...client, referentiel: 'SYCEBNL', numeroTiers: '41100001', montant: 980, escompte: 20 })).toEqual({
      motif: expect.stringMatching(/ne s'accorde qu'au client-usager/),
    });
  });

  it('la pièce boucle au centime dans les deux sens, chaque montant sur sa ligne', () => {
    const somme = (l: Array<{ debit?: number; credit?: number }>, k: 'debit' | 'credit') => Math.round(l.reduce((t, x) => t + (x[k] ?? 0), 0) * 100);
    const f = lignesAvecEscompteEtEcart({
      sens: 'FOURNISSEUR',
      compteTiersId: '401',
      compteTresorerieId: '521',
      montant: 980,
      plan: { tiers: 1000, ecart: 0, partiel: false },
      escompte: { montant: 20, compteId: '773' },
      ecart: null,
      libelle: 'Règlement',
    });
    expect(f).toEqual([
      { compteId: '401', debit: 1000, libelle: 'Règlement' },
      { compteId: '521', credit: 980, libelle: 'Règlement' },
      { compteId: '773', credit: 20, libelle: 'Escompte obtenu · Règlement' },
    ]);
    expect(somme(f, 'debit')).toBe(somme(f, 'credit'));
    const k = lignesAvecEscompteEtEcart({
      sens: 'CLIENT',
      compteTiersId: '411',
      compteTresorerieId: '521',
      montant: 979.5,
      plan: { tiers: 1000, ecart: 0.5, partiel: false },
      escompte: { montant: 20, compteId: '673' },
      ecart: { montant: 0.5, compteId: '6588' },
      libelle: 'Règlement',
    });
    expect(k.map((l) => [l.compteId, l.debit ?? 0, l.credit ?? 0])).toEqual([
      ['521', 979.5, 0],
      ['673', 20, 0],
      ['6588', 0.5, 0],
      ['411', 0, 1000],
    ]);
    expect(somme(k, 'debit')).toBe(somme(k, 'credit'));
  });

  it('l’escompte consenti après le terme se dit, sans refus · le jour même n’est pas échu', () => {
    const jour = new Date('2026-09-25');
    expect(avertissementEscompteApresEcheance('40110001', jour, [{ reference: 'pièce 7', echeance: new Date('2026-09-25') }])).toBeNull();
    expect(avertissementEscompteApresEcheance('40110001', jour, [{ reference: 'pièce 7', echeance: new Date('2026-09-24') }])).toMatch(
      /pièce 7 \(échue le 2026-09-24\).*AVANT le terme/,
    );
  });
});
