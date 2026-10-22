import { PLAN_COMPTES_SYSCOHADA } from '../comptes/compte-seed-syscohada';
import { PLAN_COMPTES_SYCEBNL } from '../comptes/compte-seed';
import {
  COMPTE_DEPRECIATION,
  COMPTE_DOTATION,
  COMPTE_GAIN,
  COMPTE_PERTE,
  COMPTE_REPRISE,
  RACINES_FRAIS,
  coutDeLaCession,
  coutDetenu,
  depreciationNecessaire,
  lotsDetenus,
  motifRefusCompteFrais,
  motifRefusCompteTitre,
  motifRefusEvaluation,
  motifRefusMouvement,
  motifRefusTitre,
  natureAttendue,
  pieceAcquisition,
  pieceCession,
  pieceEcartDepreciation,
  quantiteDetenue,
  type MouvementLu,
} from './titres-placement';

const somme = (lignes: { debit: number; credit: number }[]) => Math.round(lignes.reduce((s, l) => s + (l.debit - l.credit) * 100, 0));
const achat = (quantite: number, prix: number, frais = 0): MouvementLu => ({ nature: 'ACQUISITION', quantite, prix, frais });
const vente = (quantite: number): MouvementLu => ({ nature: 'CESSION', quantite, prix: 1, frais: 0 });

describe('titres de placement · les comptes imposés, lus dans les deux semis', () => {
  for (const [nom, plan] of [
    ['SYSCOHADA', PLAN_COMPTES_SYSCOHADA],
    ['SYCEBNL', PLAN_COMPTES_SYCEBNL],
  ] as const) {
    const numeros = new Set(plan.map((c) => c.numero));
    it(`${nom} · 590, 6795, 7795, 777 et 6771 sont semés à huit chiffres (AUDCIF Titre VIII ch. 13 § 4.2)`, () => {
      for (const n of [COMPTE_DEPRECIATION, COMPTE_DOTATION, COMPTE_REPRISE, COMPTE_GAIN, COMPTE_PERTE]) expect([n, numeros.has(n)]).toEqual([n, true]);
    });
    it(`${nom} · chaque compte de frais d'acquisition est semé (§ 2.3.2)`, () => {
      for (const r of RACINES_FRAIS) expect([r, numeros.has(`${r}0000`)]).toEqual([r, true]);
    });
  }

  it('un numéro, deux plans · le 5021 est refusé au SYSCOHADA (actions propres), jamais au SYCEBNL, qui ne l’ouvre pas', () => {
    expect(PLAN_COMPTES_SYSCOHADA.some((c) => c.numero === '50210000')).toBe(true);
    expect(PLAN_COMPTES_SYCEBNL.some((c) => c.numero.startsWith('5021'))).toBe(false);
    expect(motifRefusCompteTitre('50210000', 'SYSCOHADA')).toMatch(/actions ou parts propres/);
    expect(motifRefusCompteTitre('50210001', 'SYCEBNL')).toBeNull();
  });

  it('le compte du titre · sous le 50, jamais les intérêts courus ni un compte de frais', () => {
    expect(motifRefusCompteTitre('50220000', 'SYSCOHADA')).toBeNull();
    expect(motifRefusCompteTitre('52110000', 'SYSCOHADA')).toMatch(/compte 50/);
    expect(motifRefusCompteTitre('50610000', 'SYCEBNL')).toMatch(/intérêts courus/);
    expect(motifRefusCompteTitre('50260000', 'SYSCOHADA')).toMatch(/frais d'acquisition/);
    expect(motifRefusCompteFrais('50260000')).toBeNull();
    expect(motifRefusCompteFrais('50220000')).toMatch(/5016, 5026, 5036/);
  });
});

describe('titres de placement · les saisies', () => {
  it('le titre · code et intitulé', () => {
    expect(motifRefusTitre({ code: 'FCP-RDC', intitule: 'Fonds commun de placement' })).toBeNull();
    expect(motifRefusTitre({ code: '', intitule: 'x' })).toMatch(/code/);
    expect(motifRefusTitre({ code: 'A', intitule: ' ' })).toMatch(/intitulé/);
  });

  it("le mouvement · jour, quantité à six décimales, prix au centime, référence de l'avis d'opéré", () => {
    const bon = { date: '2026-03-02', quantite: 10.5, prix: 1_050_000, frais: 10_000, reference: 'AO-12' };
    expect(motifRefusMouvement(bon, 'acquisition')).toBeNull();
    expect(motifRefusMouvement({ ...bon, date: '2026-02-30' }, 'acquisition')).toMatch(/jour/);
    expect(motifRefusMouvement({ ...bon, quantite: 0 }, 'acquisition')).toMatch(/quantité/);
    expect(motifRefusMouvement({ ...bon, quantite: 1.0000001 }, 'acquisition')).toMatch(/six décimales/);
    expect(motifRefusMouvement({ ...bon, prix: 10.001 }, 'acquisition')).toMatch(/centime/);
    expect(motifRefusMouvement({ ...bon, reference: ' ' }, 'acquisition')).toMatch(/art\. 17/);
    expect(motifRefusMouvement({ ...bon, frais: 1_050_000 }, 'cession')).toMatch(/frais de cession/);
  });

  it('la revue · valeur, nature, source exigée', () => {
    expect(motifRefusEvaluation({ valeurUnitaire: 98_000, nature: 'COURS_MOYEN_DERNIER_MOIS', source: 'Bulletin de la cote' })).toBeNull();
    expect(motifRefusEvaluation({ valeurUnitaire: -1, nature: 'COURS_MOYEN_DERNIER_MOIS', source: 'x' })).toMatch(/positive/);
    expect(motifRefusEvaluation({ valeurUnitaire: 1, nature: 'AUTRE', source: 'x' })).toMatch(/nature/);
    expect(motifRefusEvaluation({ valeurUnitaire: 1, nature: 'VALEUR_PROBABLE_NEGOCIATION', source: '' })).toMatch(/source/);
    expect(natureAttendue(true)).toBe('COURS_MOYEN_DERNIER_MOIS');
    expect(natureAttendue(false)).toBe('VALEUR_PROBABLE_NEGOCIATION');
  });
});

describe('titres de placement · le P.E.P.S. (fiche du compte 50 des deux plans)', () => {
  it('la cession sort les lots les plus anciens, frais compris, et un lot entamé garde son reste', () => {
    const m = [achat(10, 1_000_000, 10_000), achat(10, 1_200_000, 12_000)];
    // 15 parts · le premier lot entier, la moitié du second.
    expect(coutDeLaCession(m, 15)).toEqual({ prix: 1_600_000, frais: 16_000 });
    const apres = [...m, vente(15)];
    expect(quantiteDetenue(apres)).toBe(5);
    expect(coutDetenu(apres)).toBe(606_000);
  });

  it('la dernière part sortie prend tout ce qui reste · jamais un centime perdu', () => {
    const m = [achat(3, 100, 0)];
    const c1 = coutDeLaCession(m, 1);
    const c2 = coutDeLaCession([...m, vente(1)], 1);
    const c3 = coutDeLaCession([...m, vente(1), vente(1)], 1);
    expect(Math.round((c1.prix + c2.prix + c3.prix) * 100)).toBe(10_000);
    expect(lotsDetenus([...m, vente(3)])).toEqual([]);
  });

  it('une cession au-delà des parts détenues est une erreur du module', () => {
    expect(() => coutDeLaCession([achat(2, 100)], 3)).toThrow(/au-delà/);
  });
});

describe('titres de placement · les pièces', () => {
  it("l'acquisition · D 50 prix, D 50x6 frais / C 52, équilibrée", () => {
    const l = pieceAcquisition(1_000_000, 10_000);
    expect(l).toEqual([
      { role: 'TITRE', debit: 1_000_000, credit: 0 },
      { role: 'FRAIS', debit: 10_000, credit: 0 },
      { role: 'BANQUE', debit: 0, credit: 1_010_000 },
    ]);
    expect(somme(l)).toBe(0);
  });

  it('la cession · prix diminué des frais de cession, gain au 777 (§ 4)', () => {
    const p = pieceCession(1_300_000, 5_000, { prix: 1_000_000, frais: 10_000 });
    expect(p.resultat).toBe(285_000);
    expect(p.lignes).toEqual([
      { role: 'BANQUE', debit: 1_295_000, credit: 0 },
      { role: 'TITRE', debit: 0, credit: 1_000_000 },
      { role: 'FRAIS', debit: 0, credit: 10_000 },
      { role: 'GAIN', debit: 0, credit: 285_000 },
    ]);
    expect(somme(p.lignes)).toBe(0);
  });

  it('la cession à perte · au 6771, jamais diminuée par la dépréciation en place', () => {
    const p = pieceCession(900_000, 0, { prix: 1_000_000, frais: 10_000 });
    expect(p.resultat).toBe(-110_000);
    expect(p.lignes.find((l) => l.role === 'PERTE')).toEqual({ role: 'PERTE', debit: 110_000, credit: 0 });
    expect(somme(p.lignes)).toBe(0);
  });

  it('la dépréciation nécessaire · la moins-value seule, jamais compensée (§ 3.2)', () => {
    expect(depreciationNecessaire(1_010_000, 10, 95_000)).toBe(60_000);
    expect(depreciationNecessaire(1_010_000, 10, 120_000)).toBe(0);
  });

  it("seul l'ÉCART avec la dépréciation en place se passe · dotation, reprise, ou rien", () => {
    expect(pieceEcartDepreciation(60_000, 0)).toEqual([
      { role: 'DOTATION', debit: 60_000, credit: 0 },
      { role: 'DEPRECIATION', debit: 0, credit: 60_000 },
    ]);
    expect(pieceEcartDepreciation(20_000, 60_000)).toEqual([
      { role: 'DEPRECIATION', debit: 40_000, credit: 0 },
      { role: 'REPRISE', debit: 0, credit: 40_000 },
    ]);
    expect(pieceEcartDepreciation(60_000, 60_000)).toEqual([]);
  });
});
