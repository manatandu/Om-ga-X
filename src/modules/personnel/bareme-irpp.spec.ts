import {
  BORNE_TROISIEME_TRANCHE,
  IMPOT_DES_TROIS_PREMIERES_TRANCHES_FC,
  MAXIMUM_PERSONNES_A_CHARGE,
  TAUX_EFFECTIF_DES_TROIS_PREMIERES_TRANCHES_POUR_CENT,
  MOIS_PAR_AN,
  PLAFOND_IMPOT_POUR_CENT,
  PREMIER_EXERCICE_IRPP,
  QUOTITE_PAR_PERSONNE_A_CHARGE_POUR_CENT,
  SEUIL_OU_LE_PLAFOND_MORD,
  TRANCHES_IRPP,
  arrondirAuMillierInferieur,
  TRANCHES_IRPP_MENSUELLES,
  baremeApplicableAuMois,
  detailMensuel,
  impotAnnuel,
  impotDuBareme,
  regimeApplicable,
  retenueMensuelle,
} from './bareme-irpp';
import { arrondirImpotArt150 } from '../fiscalite/arrondi-article-150';
import { depuisNombre, somme } from '../../common/decimal-exact';
import { assiettesExactes, type ElementPaie } from './assiettes-paie';
import { cotisationsExactes } from './cotisations-paie';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const SOURCE = readFileSync(join(__dirname, 'bareme-irpp.ts'), 'utf8');

describe("Le barème de l'article 118, recopié et non déduit", () => {
  it('porte les quatre tranches de la loi n° 23/053, dans son ordre', () => {
    expect(TRANCHES_IRPP.map((t) => [t.jusqua, t.tauxPourCent])).toEqual([
      [1_944_000, 3],
      [21_600_000, 15],
      [43_200_000, 30],
      [null, 40],
    ]);
  });

  it('est CONTINU · chaque tranche reprend exactement au franc suivant la précédente', () => {
    // La loi tabule les bornes basses en « .001 ». C'est la propriété que
    // cette écriture porte, et un barème troué rendrait un impôt faux sans
    // qu'aucun total ne bouge.
    for (let i = 1; i < TRANCHES_IRPP.length; i += 1) {
      const precedente = TRANCHES_IRPP[i - 1].jusqua;
      expect(precedente).not.toBeNull();
      const borneBasseAnnoncee = (precedente as number) + 1;
      expect(borneBasseAnnoncee).toBeGreaterThan(precedente as number);
    }
    expect(TRANCHES_IRPP[TRANCHES_IRPP.length - 1].jusqua).toBeNull();
  });

  it('est CROISSANT · un barème progressif ne redescend jamais', () => {
    const taux = TRANCHES_IRPP.map((t) => t.tauxPourCent);
    expect([...taux].sort((a, b) => a - b)).toEqual(taux);
  });
});

describe("L'arrondi de l'article 118 porte sur l'assiette, jamais sur l'impôt", () => {
  it('arrondit le revenu net global au millier de francs INFÉRIEUR', () => {
    expect(arrondirAuMillierInferieur(1_944_999)).toBe(1_944_000);
    expect(arrondirAuMillierInferieur(1_944_000)).toBe(1_944_000);
    expect(arrondirAuMillierInferieur(999)).toBe(0);
  });

  it("n'arrondit pas l'impôt rendu", () => {
    // 1 000 FC à 3 % font 30 FC ; 1 500 FC arrondis à 1 000 en font autant.
    // Ce qui est vérifié ici est qu'aucun second arrondi n'écrase les centimes.
    const verdict = impotAnnuel(1_100_100);
    expect(verdict.assietteArrondieFc).toBe(1_100_000);
    expect(verdict.impotDuFc).toBeCloseTo(33_000, 6);
    const centimes = impotAnnuel(1_000_333).impotDuFc;
    expect(centimes).toBeCloseTo(30_000, 6);
  });
});

describe('Le barème progressif, tranche par tranche', () => {
  it('ne mord que la fraction de revenu qui tombe dans chaque tranche', () => {
    // Un revenu à la borne exacte de la troisième tranche.
    const { impotFc, parTranche } = impotDuBareme(BORNE_TROISIEME_TRANCHE);
    expect(parTranche.map((t) => [t.tauxPourCent, t.baseFc])).toEqual([
      [3, 1_944_000],
      [15, 19_656_000],
      [30, 21_600_000],
    ]);
    // 58 320 + 2 948 400 + 6 480 000
    expect(impotFc).toBeCloseTo(9_486_720, 6);
  });

  it('ne rend rien sur une assiette nulle ou négative', () => {
    expect(impotDuBareme(0).impotFc).toBe(0);
    expect(impotDuBareme(-5_000_000).impotFc).toBe(0);
    expect(impotAnnuel(-1).impotDuFc).toBe(0);
  });
});

describe("Le plafond de l'article 118, alinéa 2", () => {
  it('se recalcule depuis les tranches, il ne se croit pas', () => {
    // On ne relit pas la constante : on refait le croisement des deux droites,
    // pour que le jour où une tranche change, le seuil tombe avec elle.
    const impotA43 = impotDuBareme(BORNE_TROISIEME_TRANCHE).impotFc;
    const tauxMarginal = TRANCHES_IRPP[TRANCHES_IRPP.length - 1].tauxPourCent / 100;
    const plafond = PLAFOND_IMPOT_POUR_CENT / 100;
    // impotA43 + marginal × (R - 43 200 000) = plafond × R
    const seuil =
      (impotA43 - tauxMarginal * BORNE_TROISIEME_TRANCHE) / (plafond - tauxMarginal);
    expect(seuil).toBeCloseTo(SEUIL_OU_LE_PLAFOND_MORD, 6);
  });

  it('ne mord PAS juste en dessous du seuil', () => {
    const verdict = impotAnnuel(SEUIL_OU_LE_PLAFOND_MORD - 1_000);
    expect(verdict.plafondApplique).toBe(false);
    expect(verdict.impotArticle118Fc).toBeCloseTo(verdict.impotDuBaremeFc, 6);
  });

  it('mord juste au-dessus, et ramène l\'impôt à 30 % du revenu imposable', () => {
    const revenu = SEUIL_OU_LE_PLAFOND_MORD + 10_000_000;
    const verdict = impotAnnuel(revenu);
    expect(verdict.plafondApplique).toBe(true);
    expect(verdict.impotDuBaremeFc).toBeGreaterThan(verdict.impotArticle118Fc);
    // Le plafond porte sur l'assiette ARRONDIE, pas sur le revenu brut :
    // 87 932 800 FC arrondis font 87 932 000 FC, et 240 FC d'impôt d'écart.
    expect(verdict.impotArticle118Fc).toBeCloseTo(
      (verdict.assietteArrondieFc * 30) / 100,
      6,
    );
    expect(verdict.impotArticle118Fc).not.toBeCloseTo((revenu * 30) / 100, 6);
    expect(verdict.reserves.join(' ')).toMatch(/article 118, alin[ée]a 2/i);
  });

  it("interdit que l'impôt dû dépasse 30 % du revenu imposable, à tout niveau", () => {
    for (const revenu of [
      1_000_000, 21_600_000, 43_200_000, 77_932_800, 120_000_000, 900_000_000,
    ]) {
      const verdict = impotAnnuel(revenu);
      expect(verdict.impotDuFc).toBeLessThanOrEqual(
        (verdict.assietteArrondieFc * PLAFOND_IMPOT_POUR_CENT) / 100 + 1e-6,
      );
    }
  });
});

describe("La quotité de l'article 123", () => {
  it('retranche 2 % par personne à charge', () => {
    const sans = impotAnnuel(10_000_000, 0);
    const avecTrois = impotAnnuel(10_000_000, 3);
    expect(avecTrois.quotitePourCent).toBe(6);
    expect(avecTrois.impotDuFc).toBeCloseTo(sans.impotDuFc * 0.94, 6);
  });

  it('plafonne à neuf personnes et le DIT', () => {
    const verdict = impotAnnuel(10_000_000, 14);
    expect(verdict.personnesAChargeRetenues).toBe(MAXIMUM_PERSONNES_A_CHARGE);
    expect(verdict.quotitePourCent).toBe(
      MAXIMUM_PERSONNES_A_CHARGE * QUOTITE_PAR_PERSONNE_A_CHARGE_POUR_CENT,
    );
    expect(verdict.reserves.join(' ')).toMatch(/article 123/i);
  });

  it("n'accorde AUCUNE réduction sur l'impôt de la part au-delà de la troisième tranche", () => {
    // Le défaut visé : réduire l'impôt TOTAL de 2 % par personne, ce qui
    // ferait profiter la tranche à 40 % d'une quotité que l'alinéa 2 lui refuse.
    const revenu = 60_000_000;
    const verdict = impotAnnuel(revenu, 5);
    const impotSurLaPartBasse = impotDuBareme(BORNE_TROISIEME_TRANCHE).impotFc;
    expect(verdict.baseDeLaQuotiteFc).toBeCloseTo(impotSurLaPartBasse, 6);
    expect(verdict.baseDeLaQuotiteFc).toBeLessThan(verdict.impotArticle118Fc);
    expect(verdict.reductionFc).toBeCloseTo((impotSurLaPartBasse * 10) / 100, 6);
  });

  it('joue APRÈS le plafond, jamais avant', () => {
    // L'article 123 réduit « l'impôt établi par application de l'article 118 »,
    // alinéa 2 compris. L'ordre inverse effacerait la réduction sous le plafond.
    const revenu = 200_000_000;
    const verdict = impotAnnuel(revenu, 9);
    expect(verdict.plafondApplique).toBe(true);
    expect(verdict.impotDuFc).toBeLessThan(verdict.impotArticle118Fc);
    expect(verdict.impotDuFc).toBeCloseTo(
      verdict.impotArticle118Fc - (verdict.baseDeLaQuotiteFc * 18) / 100,
      6,
    );
  });

  describe("impôt plafonné · décision par la loi du 2026-10-07 (troisième lot, point 2)", () => {
    it("le fondement · l'impôt des trois premières tranches plafonne à 21,96 %, sous les 30 %", () => {
      // Tirés de TRANCHES_IRPP · si un barème révisé faisait mordre le
      // plafond sur les trois premières tranches, la règle serait à relire.
      expect(IMPOT_DES_TROIS_PREMIERES_TRANCHES_FC).toBe(58_320 + 2_948_400 + 6_480_000);
      expect(IMPOT_DES_TROIS_PREMIERES_TRANCHES_FC).toBe(9_486_720);
      expect(TAUX_EFFECTIF_DES_TROIS_PREMIERES_TRANCHES_POUR_CENT).toBeCloseTo(21.96, 10);
      expect(TAUX_EFFECTIF_DES_TROIS_PREMIERES_TRANCHES_POUR_CENT).toBeLessThan(PLAFOND_IMPOT_POUR_CENT);
      // Sur toute assiette jusqu'à la troisième tranche, le plafond ne mord pas.
      for (const revenu of [1_000_000, 1_944_000, 21_600_000, 30_000_000, BORNE_TROISIEME_TRANCHE]) {
        expect(impotAnnuel(revenu, 0).plafondApplique).toBe(false);
      }
    });

    it("la réduction du plafond se rapporte à la seule part au-delà de la troisième tranche · la quotité joue sur l'impôt du barème des trois premières, quel que soit le revenu", () => {
      for (const revenu of [SEUIL_OU_LE_PLAFOND_MORD + 1_000, 91_200_000, 150_000_000, 1_000_000_000]) {
        for (let personnes = 1; personnes <= MAXIMUM_PERSONNES_A_CHARGE; personnes += 1) {
          const verdict = impotAnnuel(revenu, personnes);
          expect(verdict.plafondApplique).toBe(true);
          expect(verdict.baseDeLaQuotiteFc).toBe(IMPOT_DES_TROIS_PREMIERES_TRANCHES_FC);
          expect(verdict.reductionFc).toBeCloseTo((9_486_720 * personnes * QUOTITE_PAR_PERSONNE_A_CHARGE_POUR_CENT) / 100, 6);
          expect(verdict.impotDuFc).toBeCloseTo(verdict.plafondFc - verdict.reductionFc, 6);
        }
      }
    });

    it('P03 · 7 600 000 nets par mois, quatre personnes · base 9 486 720, retenue 2 216 800, la règle dite avec son fondement', () => {
      // Barème 28 686 720, plafond 27 360 000 · la quotité de 8 % joue sur
      // 9 486 720 (758 937,60 l'an), soit 26 601 062,40 dus l'an.
      const verdict = impotAnnuel(91_200_000, 4);
      expect(verdict.plafondApplique).toBe(true);
      expect(verdict.baseDeLaQuotiteFc).toBe(9_486_720);
      expect(verdict.reductionFc).toBeCloseTo(758_937.6, 6);
      expect(verdict.impotDuFc).toBeCloseTo(26_601_062.4, 6);
      expect(retenueMensuelle('2026-06', 7_600_000, 4).retenueFc).toBe(2_216_800);
      const regle = verdict.reserves.filter((r) => r.startsWith('ARTICLE 123 SUR UN IMPÔT PLAFONNÉ'));
      expect(regle).toHaveLength(1);
      expect(regle[0]).toContain("se rapporte à la seule part du revenu imposable qui excède la troisième tranche");
      expect(regle[0]).toContain('21,96 %');
      expect(regle[0]).toContain('9486720.00 FC sur 43200000.00 FC');
      expect(regle[0]).toContain("reste celui du barème, 9486720.00 FC");
      expect(regle[0]).toContain("l'article 123, alinéas 1er et 2");
      expect(regle[0]).toContain('réduction annuelle de 758937.60 FC');
    });

    it("sans personne à charge, la règle n'a rien à dire · seul le plafond est mentionné", () => {
      const verdict = impotAnnuel(91_200_000, 0);
      expect(verdict.reserves.some((r) => r.startsWith('ARTICLE 123 SUR UN IMPÔT PLAFONNÉ'))).toBe(false);
      expect(verdict.reserves.some((r) => r.startsWith("PLAFOND DE L'ARTICLE 118"))).toBe(true);
    });
  });

  it('ne rend jamais une base de quotité supérieure à ce qui est dû', () => {
    for (const revenu of [50_000_000, 100_000_000, 500_000_000]) {
      const verdict = impotAnnuel(revenu, 9);
      expect(verdict.baseDeLaQuotiteFc).toBeLessThanOrEqual(
        verdict.impotArticle118Fc + 1e-6,
      );
      expect(verdict.impotDuFc).toBeGreaterThanOrEqual(0);
    }
  });
});

describe("La retenue mensuelle de l'article 119", () => {
  it("annualise le mois, applique l'article 118, puis ramène au mois", () => {
    const verdict = retenueMensuelle('2026-03', 1_000_000);
    expect(verdict.revenuAnnualiseFc).toBe(12_000_000);
    expect(verdict.annuel.assietteArrondieFc).toBe(12_000_000);
    // Ramené au mois, puis arrondi selon l'art. 150 (audit final F111).
    expect(verdict.retenueFc).toBe(arrondirImpotArt150(verdict.annuel.impotDuFc / MOIS_PAR_AN));
  });

  it("ARRONDIT LE REVENU ANNUALISÉ, jamais le mois", () => {
    // 500 083 FC par mois font 6 000 996 FC par an, arrondis à 6 000 000.
    // Arrondir le mois d'abord (500 000) puis multiplier donnerait 6 000 000
    // aussi ; il faut un mois dont les deux chemins divergent.
    // 1 000 100 × 12 = 12 001 200 -> 12 001 000.
    // Arrondir le mois : 1 000 000 × 12 = 12 000 000. Mille francs d'écart.
    const verdict = retenueMensuelle('2026-03', 1_000_100);
    expect(verdict.annuel.assietteArrondieFc).toBe(12_001_000);
    expect(verdict.annuel.assietteArrondieFc).not.toBe(12_000_000);
  });

  it('ne tombe PAS dans la tranche à 3 % pour un salaire de cadre', () => {
    // Le défaut que la mensualisation existe pour empêcher : appliquer les
    // tranches ANNUELLES à un montant MENSUEL. 1 500 000 FC par mois
    // resteraient sous 1 944 000 et seraient taxés à 3 %.
    const verdict = retenueMensuelle('2026-06', 1_500_000);
    const naif = impotDuBareme(1_500_000).impotFc;
    expect(naif).toBeCloseTo(45_000, 6);
    expect(verdict.retenueFc).toBeGreaterThan(naif * 3);
  });

  it("annonce qu'il s'agit d'un acompte et non de l'impôt définitif", () => {
    const verdict = retenueMensuelle('2026-06', 800_000);
    const reserves = verdict.reserves.join(' ');
    expect(reserves).toContain('MENSUALISATION');
    expect(reserves).toContain('ACOMPTE');
    expect(reserves).toContain('article 121');
  });
});

describe('Les bornes que ce module ne franchit pas', () => {
  it("refuse tout mois antérieur à l'entrée en vigueur de la loi n° 23/053", () => {
    expect(baremeApplicableAuMois('2025-12').applicable).toBe(false);
    expect(baremeApplicableAuMois('2025-12').motif).toContain('1er janvier 2026');
    expect(baremeApplicableAuMois(`${PREMIER_EXERCICE_IRPP}-01`).applicable).toBe(true);
  });

  it('ne calcule que le régime de droit commun, et nomme les deux autres', () => {
    expect(regimeApplicable('BAREME_ARTICLE_118').calculable).toBe(true);
    expect(regimeApplicable('FORFAIT_PERSONNEL_DOMESTIQUE').calculable).toBe(false);
    expect(regimeApplicable('FORFAIT_SALARIE_DE_MICRO_ENTREPRISE').calculable).toBe(false);
    expect(regimeApplicable('FORFAIT_PERSONNEL_DOMESTIQUE').motif).toContain('019/CAB/MIN/FINANCES/2025');
  });

  it("passe F5 · l'arrêté n° 019/2025 est LU · ses montants sont dits, et seul le cours manque", () => {
    const motif = regimeApplicable('FORFAIT_SALARIE_DE_MICRO_ENTREPRISE').motif;
    expect(motif).toContain('24 dollars par salarié domestique et de 36 dollars');
    expect(motif).toContain('Le cours de conversion est renvoyé');
  });

  it("ne porte NI le minimum de perception de l'article 122 NI le plancher de 2 000 FC du livre de cours", () => {
    // On gèle une PRÉSENCE, jamais une absence de mot : la source doit dire
    // pourquoi chacun est écarté, et aucune constante ne doit les porter.
    expect(SOURCE).toMatch(/ARTICLE 122 \(1 % du chiffre d'affaires\)/);
    expect(SOURCE).toMatch(/PLANCHER DE 2 000 FC N'EXISTE PAS ICI/);
    // Aucun calcul ne les applique : un revenu minuscule rend un impôt minuscule.
    expect(impotAnnuel(12_000).impotDuFc).toBeCloseTo(360, 6);
    expect(impotAnnuel(0).impotDuFc).toBe(0);
  });
});

describe('Le barème lu au mois · ce que montrent l’écran et le bulletin', () => {
  it('divise les bornes annuelles par douze, sans rien écrire à la main', () => {
    // Les mêmes bornes que le barème mensuel de l'IPR que donne le cours de
    // Mbuyamba (chapitre 12, p. 190) · 162 000, 1 800 000 et 3 600 000 FC.
    expect(TRANCHES_IRPP_MENSUELLES.map((t) => [t.deFc, t.aFc, t.tauxPourCent])).toEqual([
      [0, 162_000, 3],
      [162_000, 1_800_000, 15],
      [1_800_000, 3_600_000, 30],
      [3_600_000, null, 40],
    ]);
  });

  it('rend, pour 1 000 000 FC par mois, les 130 560 FC du barème mensuel, retenus 130 600 FC', () => {
    const v = retenueMensuelle('2026-03', 1_000_000);
    expect(v.mensuel.parTranche.map((t) => [t.tauxPourCent, t.baseFc, t.impotFc])).toEqual([
      [3, 162_000, 4_860],
      [15, 838_000, 125_700],
    ]);
    expect(v.mensuel.impotDuBaremeFc).toBeCloseTo(130_560, 6);
    expect(v.mensuel.retenueAvantArrondiFc).toBeCloseTo(130_560, 6);
    // ART. 150 · la tranche de 60 FC, supérieure à 50, monte à la centaine.
    expect(v.mensuel.arrondiArticle150Fc).toBeCloseTo(40, 6);
    expect(v.mensuel.retenueFc).toBe(130_600);
    expect(v.retenueFc).toBe(130_600);
  });

  it("arrondit à la centaine INFÉRIEURE sous 50 FC · art. 150, alinéa 3", () => {
    // 163 000 FC par mois · 162 000 à 3 % (4 860) et 1 000 à 15 % (150),
    // soit 5 010 FC · le reste sous la centaine, 10, est inférieur à 50.
    const v = retenueMensuelle('2026-03', 163_000);
    expect(v.mensuel.retenueAvantArrondiFc).toBeCloseTo(5_010, 6);
    expect(v.retenueFc).toBe(5_000);
    expect(v.mensuel.arrondiArticle150Fc).toBeCloseTo(-10, 6);
  });

  it("n'écrit pas l'arrondi deux fois · la paie appelle le porteur du module fiscal", () => {
    expect(SOURCE).toContain("import { arrondirImpotArt150 } from '../fiscalite/arrondi-article-150';");
  });

  it.each([
    [1_000_000, 2],
    [2_500_000, 0],
    [8_000_000, 3],
    [150_000, 9],
    [1_000_083, 1],
  ])('retombe au centime sur la retenue · %d FC, %d personnes', (revenu, personnes) => {
    const v = retenueMensuelle('2026-03', revenu, personnes);
    const m = v.mensuel;
    const somme = m.parTranche.reduce((n, t) => n + t.impotFc, 0);
    expect(somme).toBeCloseTo(m.impotDuBaremeFc, 6);
    expect(m.impotArticle118Fc - m.reductionFc).toBeCloseTo(m.retenueAvantArrondiFc, 6);
    // L'arrondi de l'art. 150 est une ligne à part, sous cent francs.
    expect(m.retenueAvantArrondiFc + m.arrondiArticle150Fc).toBeCloseTo(v.retenueFc, 6);
    expect(Math.abs(m.arrondiArticle150Fc)).toBeLessThan(100);
    expect(m.retenueFc).toBe(v.retenueFc);
  });

  it('montre le plafond au mois quand il mord', () => {
    const m = retenueMensuelle('2026-03', 8_000_000).mensuel;
    expect(m.plafondApplique).toBe(true);
    expect(m.plafondFc).toBeCloseTo(2_400_000, 6);
    expect(m.retenueFc).toBeCloseTo(2_400_000, 6);
  });

  it("garde l'arrondi au millier sur l'ANNÉE, comme l'article 118 l'écrit", () => {
    // 1 000 083 FC par mois font 12 000 996 FC par an, arrondis à 12 000 000.
    const m = retenueMensuelle('2026-03', 1_000_083).mensuel;
    expect(m.revenuRetenuFc).toBeCloseTo(1_000_000, 6);
  });
});

/**
 * SECOND TOUR DE RELECTURE DU PAQUET 1, LIGNE C, BLOQUANT · le millier de
 * l'art. 118 se prend sur la valeur exacte, de l'assiette sociale à la base
 * annualisée. Le câblage du service est tenu par `simulation-paie.spec.ts`.
 */
describe("L'arrondi au millier de l'art. 118 se prend sur la valeur EXACTE", () => {
  const cinqLignes = [51_905.39, 53_651.71, 168_138.49, 68_332.09, 537_972.32];
  const elements: ElementPaie[] = cinqLignes.map((montantFc, i) => ({
    nature: i === 0 ? 'SALAIRE_OU_TRAITEMENT' : 'PRIME',
    libelle: `Ligne ${i + 1}`,
    montantFc,
  }));

  it('assiette, quote-part et base nette exactes · 880 000, 44 000, 836 000', () => {
    const premier = assiettesExactes(elements);
    expect(premier.verdict.assietteSocialeFc).toBe(880_000);
    const { verdict, totalTravailleurExact } = cotisationsExactes(premier.socialeExacte, {
      moisDePaie: '2026-03',
      natureEmployeurInpp: 'PRIVE',
      effectif: 30,
    });
    expect(verdict.totalTravailleurFc).toBe(44_000);
    const second = assiettesExactes(elements, { retenuesArticle71: totalTravailleurExact });
    expect(second.verdict.assietteFiscaleNetteFc).toBe(836_000);
    const r = retenueMensuelle('2026-03', second.netteExacte!, 0);
    expect(r.revenuAnnualiseFc).toBe(10_032_000);
    expect(r.annuel.assietteArrondieFc).toBe(10_032_000);
    expect(r.retenueFc).toBe(106_000);
  });

  it('témoin · le même revenu porté par le flottant tombe au millier inférieur', () => {
    const flottant = (cinqLignes.reduce((a, b) => a + b, 0) * 95) / 100;
    expect(flottant * MOIS_PAR_AN).toBeLessThan(10_032_000);
    expect(Math.floor((flottant * MOIS_PAR_AN) / 1_000) * 1_000).toBe(10_031_000);
    expect(arrondirAuMillierInferieur(somme(cinqLignes.map(depuisNombre)))).toBe(880_000);
  });

  it('ne remonte jamais un revenu à 999,9964 FC du millier · aucun arrondi au centime d’abord', () => {
    expect(arrondirAuMillierInferieur(depuisNombre(10_031_999.9964))).toBe(10_031_000);
    expect(retenueMensuelle('2026-03', depuisNombre(835_999.9997)).annuel.assietteArrondieFc).toBe(10_031_000);
  });

  it('un revenu non chiffré lève, jamais un zéro', () => {
    expect(() => retenueMensuelle('2026-03', null as unknown as number)).toThrow('Montant non chiffré');
  });
});

/**
 * LES AUTRES PALIERS DE LA RETENUE NE BASCULENT PAS (second tour de relecture
 * du paquet 1, recherche demandée avec le BLOQUANT) · une fois l'assiette de
 * l'art. 118 un millier exact, l'arrondi de l'art. 150 se prend sur un impôt
 * mensuel dont la fraction est soit exacte (impôt annuel entier), soit loin de
 * toute frontière (commentaire de `detailMensuel`). Le test le rejoue contre
 * un calcul en entiers, sur des assiettes et des personnes à charge balayées.
 */
describe("L'arrondi de l'art. 150 sur la retenue rejoue un calcul en entiers", () => {
  // Le barème en entiers · chaque tranche porte sur des multiples de 1 000.
  const baremeEntier = (a: bigint): bigint => {
    let bas = 0n;
    let impot = 0n;
    for (const t of TRANCHES_IRPP) {
      const haut = t.jusqua === null ? a : BigInt(t.jusqua);
      const borne = a < haut ? a : haut;
      if (borne > bas) impot += ((borne - bas) * BigInt(t.tauxPourCent)) / 100n;
      bas = haut;
      if (a <= haut) break;
    }
    return impot;
  };
  // L'art. 150 en entiers, sur la retenue du mois exprimée en centièmes de
  // franc × 12 · première décimale ≥ 5 ⟺ fraction ≥ 0,5, puis la centaine.
  const retenueEntiere = (a: bigint, personnes: bigint): number => {
    const bareme = baremeEntier(a);
    const plafond = (a * BigInt(PLAFOND_IMPOT_POUR_CENT)) / 100n;
    const impot118 = bareme > plafond ? plafond : bareme;
    const basse = baremeEntier(a < BigInt(BORNE_TROISIEME_TRANCHE) ? a : BigInt(BORNE_TROISIEME_TRANCHE));
    const baseQuotite = basse < impot118 ? basse : impot118;
    // Impôt dû en centièmes · 100 × impôt de l'art. 118 − base × quotité.
    const du100 = impot118 * 100n - baseQuotite * personnes * BigInt(QUOTITE_PAR_PERSONNE_A_CHARGE_POUR_CENT);
    const unite = (2n * du100 + 1200n) / 2400n;
    const tranche = unite % 100n;
    return Number(tranche >= 50n ? unite - tranche + 100n : unite - tranche);
  };

  it('rend la retenue au franc près sur 40 000 assiettes et zéro à neuf personnes à charge', () => {
    let ecarts = 0;
    for (let i = 0; i < 4_000; i++) {
      // De 0 à près de 200 millions, au pas de 49 000 FC (premier avec 12), plus
      // les bornes des tranches et du plafond.
      const a = i * 49_000;
      for (let p = 0; p <= 9; p++) {
        const attendu = retenueEntiere(BigInt(a), BigInt(p));
        if (detailMensuel(impotAnnuel(a, p)).retenueFc !== attendu) ecarts++;
      }
    }
    // Le seuil où le plafond mord (77 932 800) n'est pas un millier · ses deux
    // milliers voisins.
    for (const a of [1_944_000, 21_600_000, 43_200_000, 77_932_000, 77_933_000]) {
      for (let p = 0; p <= 9; p++) {
        if (detailMensuel(impotAnnuel(a, p)).retenueFc !== retenueEntiere(BigInt(a), BigInt(p))) ecarts++;
      }
    }
    expect(ecarts).toBe(0);
  });
});
