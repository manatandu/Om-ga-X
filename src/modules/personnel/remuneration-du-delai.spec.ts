import { congeDuFerieDuDimanche, estJourOuvrableDuCode, estJourRemunere, natureDuJour } from './jours-du-code-du-travail';
import { REGLE_MOIS_ENTAME, debutDuDelai, remunerationDuDelai } from './remuneration-du-delai';
import { decompteFinal, joursOuvrablesDeTroisMois, preavisLegal, type ParametresDecompte } from './decompte-final';
import { jourFerie } from '../retenues/jour-ouvrable';

/**
 * DÉCISION T9 DU 2026-10-07 (constat C4 reformulé, constat nouveau du
 * préavis). Deux règles, gelées sur les chiffres de P13 que la décision écrit.
 *  (1) Le samedi qui porte le congé d'un férié tombé un dimanche (ordonnance
 *      n° 23-042, art. 2) n'est pas un jour ouvrable du Code (art. 7,
 *      point 9) · le 16 mai 2026, veille du 17.
 *  (2) L'indemnité de préavis est la rémunération du délai (art. 63, al. 3),
 *      jours fériés compris (art. 93), non « jours ouvrables × taux ».
 */
const jour = (s: string) => new Date(`${s}T00:00:00Z`);

describe('T9 (1) · le samedi qui porte le congé d’un férié du dimanche', () => {
  it('le 16 mai 2026 porte le congé du 17, dimanche · non ouvrable, rémunéré', () => {
    expect(congeDuFerieDuDimanche(jour('2026-05-16'))).not.toBeNull();
    expect(natureDuJour(jour('2026-05-16'))).toBe('CONGE_DU_FERIE_DU_DIMANCHE');
    expect(estJourOuvrableDuCode(jour('2026-05-16'))).toBe(false);
    expect(estJourRemunere(jour('2026-05-16'))).toBe(true);
    // Un samedi ordinaire reste ouvrable · le Code compte six jours.
    expect(estJourOuvrableDuCode(jour('2026-05-09'))).toBe(true);
    // Le dimanche n'est ni ouvrable ni payé à la journée.
    expect(natureDuJour(jour('2026-05-17'))).toBe('DIMANCHE');
    expect(estJourRemunere(jour('2026-05-17'))).toBe(false);
  });

  it('un samedi déjà férié le reste · le 16 janvier 2027, veille du 17, dimanche', () => {
    expect(natureDuJour(jour('2027-01-16'))).toBe('FERIE');
  });

  it('C4 · trois mois du 5 mai au 4 août 2026 comptent 76 jours ouvrables, et non 77', () => {
    expect(joursOuvrablesDeTroisMois('2026-05-04')).toEqual({ jours: 76, du: '2026-05-05', auExclu: '2026-08-05' });
  });

  it("ne touche pas le jour ouvrable FISCAL · la liste des fériés reste celle de l'art. 1er", () => {
    expect(jourFerie(jour('2026-05-16'))).toBeNull();
    expect(jourFerie(jour('2026-05-17'))).not.toBeNull();
  });
});

describe('T9 (2) · la rémunération du délai, fériés compris', () => {
  it('le délai commence le lendemain de la notification, et se refuse sans elle', () => {
    expect(debutDuDelai('2026-05-04')).toEqual({ du: '2026-05-05' });
    expect('refus' in debutDuDelai(null)).toBe(true);
    expect('refus' in debutDuDelai('2023-01-10')).toBe(true);
  });

  it('63 jours ouvrables du 5 mai 2026 · fin le 18 juillet, 65 jours rémunérés (16 mai et 30 juin)', () => {
    const r = remunerationDuDelai({
      delai: { du: '2026-05-05', auExclu: null },
      joursOuvrables: 63,
      de: 0,
      a: 63,
      journaliereFc: 40_000,
      mensuelleFc: null,
      moyenneMensuelleFc: 52_000,
    });
    if ('refus' in r) throw new Error(r.refus);
    expect(r.au).toBe('2026-07-18');
    expect(r.joursRemuneres).toBe(65);
    expect(r.joursFeriesRemuneres).toBe(2);
    expect(r.montantFc).toBeCloseTo(2_730_000, 6);
  });

  it('les derniers jours d’un préavis interrompu portent leurs fériés · 30 juin dans les dix derniers', () => {
    // 63 jours ouvrables, les 20 derniers non observés · du 25 juin au 18
    // juillet, le 30 juin compris · 21 jours rémunérés.
    const r = remunerationDuDelai({
      delai: { du: '2026-05-05', auExclu: null },
      joursOuvrables: 63,
      de: 43,
      a: 63,
      journaliereFc: 10_000,
      mensuelleFc: null,
      moyenneMensuelleFc: 0,
    });
    if ('refus' in r) throw new Error(r.refus);
    expect(r.joursRemuneres).toBe(21);
  });

  it('au mois · les mois entiers à la rémunération du mois, le mois entamé à 1/26 par jour payable, la règle citée', () => {
    const r = remunerationDuDelai({
      delai: { du: '2026-05-05', auExclu: null },
      joursOuvrables: 63,
      de: 0,
      a: 63,
      journaliereFc: null,
      mensuelleFc: 1_040_000,
      moyenneMensuelleFc: 52_000,
    });
    if ('refus' in r) throw new Error(r.refus);
    expect(r.moisEntiers).toBe(2);
    expect(r.joursDuMoisEntame).toBe(12);
    expect(r.montantFc).toBeCloseTo(2 * 1_092_000 + (12 * 1_092_000) / 26, 6);
    expect(r.explication).toContain(REGLE_MOIS_ENTAME);
  });
});

/**
 * DÉCISION PAR LA LOI DU 2026-10-07, TROISIÈME LOT, POINT 3 · mois entiers au
 * salaire du mois, mois entamé à 1/26 du salaire mensuel par jour payable, du
 * lundi au samedi, jours fériés compris (Code du travail, art. 63, al. 3,
 * art. 93, art. 7, point 9, art. 121, al. 2 ; arrêté du 8 août 2008,
 * mentions 5 et 6), la conversion de vingt-six jours tirée du décret n° 25/22,
 * art. 7, par analogie. 1 040 000 par mois et 52 000 de moyenne · 1 092 000.
 */
describe('mois entamé d’un salaire mensuel · la règle de la décision par la loi', () => {
  const auMois = (du: string, joursOuvrables: number) => {
    const r = remunerationDuDelai({
      delai: { du, auExclu: null },
      joursOuvrables,
      de: 0,
      a: joursOuvrables,
      journaliereFc: null,
      mensuelleFc: 1_040_000,
      moyenneMensuelleFc: 52_000,
    });
    if ('refus' in r) throw new Error(r.refus);
    return r;
  };

  it('vingt-six jours payables d’un mois entamé rendent exactement un mois plein', () => {
    // Du 1er au 30 juillet 2026 · trente jours, quatre dimanches (5, 12, 19,
    // 26), aucun férié · vingt-six jours payables, un jour de moins qu'un mois.
    const entame = auMois('2026-07-01', 26);
    expect(entame.au).toBe('2026-07-30');
    expect(entame.moisEntiers).toBe(0);
    expect(entame.joursDuMoisEntame).toBe(26);
    expect(entame.montantFc).toBe(1_092_000);
    // Le mois entier du 1er au 31 juillet (vingt-sept jours du lundi au
    // samedi) se paie au salaire du mois · la même somme, rien de créé ni de
    // retiré sur un mois plein.
    const plein = auMois('2026-07-01', 27);
    expect(plein.au).toBe('2026-07-31');
    expect(plein.moisEntiers).toBe(1);
    expect(plein.joursDuMoisEntame).toBe(0);
    expect(plein.montantFc).toBe(entame.montantFc);
    expect(plein.explication).not.toContain(REGLE_MOIS_ENTAME);
  });

  it('un férié de semaine se paie, le dimanche non · du 22 juin au 3 juillet 2026, le 30 juin compris', () => {
    // Dix jours ouvrables · 22 au 27 juin, 29 juin, 1er au 3 juillet ; le
    // 30 juin, férié, est payable ; le 28 juin, dimanche, ne l'est pas.
    const r = auMois('2026-06-22', 10);
    expect(r.au).toBe('2026-07-03');
    expect(r.joursRemuneres).toBe(11);
    expect(r.joursFeriesRemuneres).toBe(1);
    expect(r.joursDuMoisEntame).toBe(11);
    expect(r.montantFc).toBeCloseTo((11 * 1_092_000) / 26, 6);
    expect(r.montantFc).toBeCloseTo(462_000, 6);
  });

  it('le férié tombé un dimanche se paie une fois, par le samedi qui porte son congé · du 5 au 28 mai 2026', () => {
    // Vingt jours ouvrables · le 16 mai (samedi portant le congé du 17,
    // dimanche) est payable, les dimanches 10, 17 et 24 ne le sont pas.
    const r = auMois('2026-05-05', 20);
    expect(r.au).toBe('2026-05-28');
    expect(r.joursRemuneres).toBe(21);
    expect(r.joursFeriesRemuneres).toBe(1);
    expect(r.joursDuMoisEntame).toBe(21);
    expect(r.montantFc).toBeCloseTo(882_000, 6);
  });

  it('la règle cite ses textes, et la conversion par analogie du décret n° 25/22', () => {
    expect(REGLE_MOIS_ENTAME).toContain('1/26 du salaire mensuel par jour payable');
    expect(REGLE_MOIS_ENTAME).toContain('du lundi au samedi, jours fériés compris, le dimanche exclu');
    for (const texte of ['art. 63, al. 3', 'art. 93', 'art. 7, point 9', 'art. 121, al. 2', 'mentions 5 et 6', 'décret n° 25/22, art. 7']) {
      expect(REGLE_MOIS_ENTAME).toContain(texte);
    }
    expect(REGLE_MOIS_ENTAME).toContain('par analogie de la loi la plus proche');
  });
});

/** P13 · sept ans, 40 000 par jour, 52 000 de moyenne mensuelle, notifié le 4 mai 2026, dispensé. */
const P13: ParametresDecompte = {
  anneesAnciennete: 7,
  moisNonCouvertsParUnConge: 10,
  moinsDeDixHuitAns: false,
  initiative: 'EMPLOYEUR',
  motif: 'LICENCIEMENT',
  typeContrat: 'DUREE_INDETERMINEE',
  executionPreavis: 'DISPENSE_PAR_EMPLOYEUR',
  dateNotification: '2026-05-04',
  remunerationJournaliereFc: 40_000,
  moyenneMensuelleArticle66Fc: 52_000,
  moyenneMensuelleArticle142Fc: 52_000,
  avantagesPendantPreavisFc: 0,
  arrieresFc: 120_000,
  gratificationFc: 0,
  enfantsBeneficiairesAllocations: 0,
};
const preavisDe = (p: ParametresDecompte) => decompteFinal(p).rubriques.find((r) => r.cle === 'preavis')!;

describe('T9 · P13 rejoué sur la règle de la décision', () => {
  it('préavis ordinaire · 63 jours ouvrables, 65 rémunérés, 2 730 000', () => {
    const r = preavisDe(P13);
    expect(r.montantFc).toBeCloseTo(2_730_000, 6);
    expect(r.fondement).toContain('Article 93');
    expect(decompteFinal(P13).totalBrutFc).toBeCloseTo(120_000 + 2_730_000 + 462_000, 6);
  });

  it('délégué de trois ans · 76 jours ouvrables, 79 rémunérés, 3 318 000', () => {
    const p = { ...P13, anneesAnciennete: 3, delegueSyndical: true };
    expect(preavisLegal(p).joursOuvrables).toBe(76);
    expect(preavisDe(p).montantFc).toBeCloseTo(79 * 42_000, 6);
  });

  it('délégué au mois · trois mois entiers, 3 × (1 040 000 + 52 000), sans mois entamé', () => {
    const r = preavisDe({ ...P13, anneesAnciennete: 3, delegueSyndical: true, remunerationMensuelleFc: 1_040_000 });
    expect(r.montantFc).toBeCloseTo(3_276_000, 6);
    expect(r.reserve).toBeNull();
    expect(r.fondement).not.toContain(REGLE_MOIS_ENTAME);
  });

  it('préavis ordinaire au mois · deux mois entiers et douze jours à 1/26, la règle au fondement, aucune réserve', () => {
    // 63 jours ouvrables du 5 mai au 18 juillet 2026 · 2 × 1 092 000 +
    // 12 × 1 092 000 / 26 = 2 688 000.
    const r = preavisDe({ ...P13, remunerationMensuelleFc: 1_040_000 });
    expect(r.montantFc).toBeCloseTo(2_688_000, 6);
    expect(r.fondement).toContain(REGLE_MOIS_ENTAME);
    expect(r.reserve).toBeNull();
  });

  it('sans date de notification, l’indemnité ne se chiffre pas · jamais « jours ouvrables × taux »', () => {
    const r = preavisDe({ ...P13, dateNotification: null });
    expect(r.montantFc).toBeNull();
    expect(r.reserve).toContain("La date de notification n'est pas déclarée");
    expect(decompteFinal({ ...P13, dateNotification: null }).totalBrutFc).toBeNull();
  });

  it('le démissionnaire qui n’observe pas son préavis doit la rémunération du délai, fériés compris', () => {
    // 31,5 jours ouvrables du 5 mai · le 16 mai dedans · 32,5 jours rémunérés.
    const v = decompteFinal({ ...P13, motif: 'DEMISSION', initiative: 'TRAVAILLEUR', executionPreavis: 'NON_OBSERVE', joursPreavisNonObserves: 31.5 });
    const du = v.duParLeTravailleur.find((r) => r.cle === 'preavis')!;
    expect(du.montantFc).toBeCloseTo(32.5 * 42_000, 6);
  });
});
