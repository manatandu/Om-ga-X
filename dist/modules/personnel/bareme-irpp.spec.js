"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const bareme_irpp_1 = require("./bareme-irpp");
const arrondi_article_150_1 = require("../fiscalite/arrondi-article-150");
const decimal_exact_1 = require("../../common/decimal-exact");
const assiettes_paie_1 = require("./assiettes-paie");
const cotisations_paie_1 = require("./cotisations-paie");
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const SOURCE = (0, node_fs_1.readFileSync)((0, node_path_1.join)(__dirname, 'bareme-irpp.ts'), 'utf8');
describe("Le barème de l'article 118, recopié et non déduit", () => {
    it('porte les quatre tranches de la loi n° 23/053, dans son ordre', () => {
        expect(bareme_irpp_1.TRANCHES_IRPP.map((t) => [t.jusqua, t.tauxPourCent])).toEqual([
            [1_944_000, 3],
            [21_600_000, 15],
            [43_200_000, 30],
            [null, 40],
        ]);
    });
    it('est CONTINU · chaque tranche reprend exactement au franc suivant la précédente', () => {
        for (let i = 1; i < bareme_irpp_1.TRANCHES_IRPP.length; i += 1) {
            const precedente = bareme_irpp_1.TRANCHES_IRPP[i - 1].jusqua;
            expect(precedente).not.toBeNull();
            const borneBasseAnnoncee = precedente + 1;
            expect(borneBasseAnnoncee).toBeGreaterThan(precedente);
        }
        expect(bareme_irpp_1.TRANCHES_IRPP[bareme_irpp_1.TRANCHES_IRPP.length - 1].jusqua).toBeNull();
    });
    it('est CROISSANT · un barème progressif ne redescend jamais', () => {
        const taux = bareme_irpp_1.TRANCHES_IRPP.map((t) => t.tauxPourCent);
        expect([...taux].sort((a, b) => a - b)).toEqual(taux);
    });
});
describe("L'arrondi de l'article 118 porte sur l'assiette, jamais sur l'impôt", () => {
    it('arrondit le revenu net global au millier de francs INFÉRIEUR', () => {
        expect((0, bareme_irpp_1.arrondirAuMillierInferieur)(1_944_999)).toBe(1_944_000);
        expect((0, bareme_irpp_1.arrondirAuMillierInferieur)(1_944_000)).toBe(1_944_000);
        expect((0, bareme_irpp_1.arrondirAuMillierInferieur)(999)).toBe(0);
    });
    it("n'arrondit pas l'impôt rendu", () => {
        const verdict = (0, bareme_irpp_1.impotAnnuel)(1_100_100);
        expect(verdict.assietteArrondieFc).toBe(1_100_000);
        expect(verdict.impotDuFc).toBeCloseTo(33_000, 6);
        const centimes = (0, bareme_irpp_1.impotAnnuel)(1_000_333).impotDuFc;
        expect(centimes).toBeCloseTo(30_000, 6);
    });
});
describe('Le barème progressif, tranche par tranche', () => {
    it('ne mord que la fraction de revenu qui tombe dans chaque tranche', () => {
        const { impotFc, parTranche } = (0, bareme_irpp_1.impotDuBareme)(bareme_irpp_1.BORNE_TROISIEME_TRANCHE);
        expect(parTranche.map((t) => [t.tauxPourCent, t.baseFc])).toEqual([
            [3, 1_944_000],
            [15, 19_656_000],
            [30, 21_600_000],
        ]);
        expect(impotFc).toBeCloseTo(9_486_720, 6);
    });
    it('ne rend rien sur une assiette nulle ou négative', () => {
        expect((0, bareme_irpp_1.impotDuBareme)(0).impotFc).toBe(0);
        expect((0, bareme_irpp_1.impotDuBareme)(-5_000_000).impotFc).toBe(0);
        expect((0, bareme_irpp_1.impotAnnuel)(-1).impotDuFc).toBe(0);
    });
});
describe("Le plafond de l'article 118, alinéa 2", () => {
    it('se recalcule depuis les tranches, il ne se croit pas', () => {
        const impotA43 = (0, bareme_irpp_1.impotDuBareme)(bareme_irpp_1.BORNE_TROISIEME_TRANCHE).impotFc;
        const tauxMarginal = bareme_irpp_1.TRANCHES_IRPP[bareme_irpp_1.TRANCHES_IRPP.length - 1].tauxPourCent / 100;
        const plafond = bareme_irpp_1.PLAFOND_IMPOT_POUR_CENT / 100;
        const seuil = (impotA43 - tauxMarginal * bareme_irpp_1.BORNE_TROISIEME_TRANCHE) / (plafond - tauxMarginal);
        expect(seuil).toBeCloseTo(bareme_irpp_1.SEUIL_OU_LE_PLAFOND_MORD, 6);
    });
    it('ne mord PAS juste en dessous du seuil', () => {
        const verdict = (0, bareme_irpp_1.impotAnnuel)(bareme_irpp_1.SEUIL_OU_LE_PLAFOND_MORD - 1_000);
        expect(verdict.plafondApplique).toBe(false);
        expect(verdict.impotArticle118Fc).toBeCloseTo(verdict.impotDuBaremeFc, 6);
    });
    it('mord juste au-dessus, et ramène l\'impôt à 30 % du revenu imposable', () => {
        const revenu = bareme_irpp_1.SEUIL_OU_LE_PLAFOND_MORD + 10_000_000;
        const verdict = (0, bareme_irpp_1.impotAnnuel)(revenu);
        expect(verdict.plafondApplique).toBe(true);
        expect(verdict.impotDuBaremeFc).toBeGreaterThan(verdict.impotArticle118Fc);
        expect(verdict.impotArticle118Fc).toBeCloseTo((verdict.assietteArrondieFc * 30) / 100, 6);
        expect(verdict.impotArticle118Fc).not.toBeCloseTo((revenu * 30) / 100, 6);
        expect(verdict.reserves.join(' ')).toMatch(/article 118, alin[ée]a 2/i);
    });
    it("interdit que l'impôt dû dépasse 30 % du revenu imposable, à tout niveau", () => {
        for (const revenu of [
            1_000_000, 21_600_000, 43_200_000, 77_932_800, 120_000_000, 900_000_000,
        ]) {
            const verdict = (0, bareme_irpp_1.impotAnnuel)(revenu);
            expect(verdict.impotDuFc).toBeLessThanOrEqual((verdict.assietteArrondieFc * bareme_irpp_1.PLAFOND_IMPOT_POUR_CENT) / 100 + 1e-6);
        }
    });
});
describe("La quotité de l'article 123", () => {
    it('retranche 2 % par personne à charge', () => {
        const sans = (0, bareme_irpp_1.impotAnnuel)(10_000_000, 0);
        const avecTrois = (0, bareme_irpp_1.impotAnnuel)(10_000_000, 3);
        expect(avecTrois.quotitePourCent).toBe(6);
        expect(avecTrois.impotDuFc).toBeCloseTo(sans.impotDuFc * 0.94, 6);
    });
    it('plafonne à neuf personnes et le DIT', () => {
        const verdict = (0, bareme_irpp_1.impotAnnuel)(10_000_000, 14);
        expect(verdict.personnesAChargeRetenues).toBe(bareme_irpp_1.MAXIMUM_PERSONNES_A_CHARGE);
        expect(verdict.quotitePourCent).toBe(bareme_irpp_1.MAXIMUM_PERSONNES_A_CHARGE * bareme_irpp_1.QUOTITE_PAR_PERSONNE_A_CHARGE_POUR_CENT);
        expect(verdict.reserves.join(' ')).toMatch(/article 123/i);
    });
    it("n'accorde AUCUNE réduction sur l'impôt de la part au-delà de la troisième tranche", () => {
        const revenu = 60_000_000;
        const verdict = (0, bareme_irpp_1.impotAnnuel)(revenu, 5);
        const impotSurLaPartBasse = (0, bareme_irpp_1.impotDuBareme)(bareme_irpp_1.BORNE_TROISIEME_TRANCHE).impotFc;
        expect(verdict.baseDeLaQuotiteFc).toBeCloseTo(impotSurLaPartBasse, 6);
        expect(verdict.baseDeLaQuotiteFc).toBeLessThan(verdict.impotArticle118Fc);
        expect(verdict.reductionFc).toBeCloseTo((impotSurLaPartBasse * 10) / 100, 6);
    });
    it('joue APRÈS le plafond, jamais avant', () => {
        const revenu = 200_000_000;
        const verdict = (0, bareme_irpp_1.impotAnnuel)(revenu, 9);
        expect(verdict.plafondApplique).toBe(true);
        expect(verdict.impotDuFc).toBeLessThan(verdict.impotArticle118Fc);
        expect(verdict.impotDuFc).toBeCloseTo(verdict.impotArticle118Fc - (verdict.baseDeLaQuotiteFc * 18) / 100, 6);
    });
    describe("impôt plafonné · décision par la loi du 2026-10-07 (troisième lot, point 2)", () => {
        it("le fondement · l'impôt des trois premières tranches plafonne à 21,96 %, sous les 30 %", () => {
            expect(bareme_irpp_1.IMPOT_DES_TROIS_PREMIERES_TRANCHES_FC).toBe(58_320 + 2_948_400 + 6_480_000);
            expect(bareme_irpp_1.IMPOT_DES_TROIS_PREMIERES_TRANCHES_FC).toBe(9_486_720);
            expect(bareme_irpp_1.TAUX_EFFECTIF_DES_TROIS_PREMIERES_TRANCHES_POUR_CENT).toBeCloseTo(21.96, 10);
            expect(bareme_irpp_1.TAUX_EFFECTIF_DES_TROIS_PREMIERES_TRANCHES_POUR_CENT).toBeLessThan(bareme_irpp_1.PLAFOND_IMPOT_POUR_CENT);
            for (const revenu of [1_000_000, 1_944_000, 21_600_000, 30_000_000, bareme_irpp_1.BORNE_TROISIEME_TRANCHE]) {
                expect((0, bareme_irpp_1.impotAnnuel)(revenu, 0).plafondApplique).toBe(false);
            }
        });
        it("la réduction du plafond se rapporte à la seule part au-delà de la troisième tranche · la quotité joue sur l'impôt du barème des trois premières, quel que soit le revenu", () => {
            for (const revenu of [bareme_irpp_1.SEUIL_OU_LE_PLAFOND_MORD + 1_000, 91_200_000, 150_000_000, 1_000_000_000]) {
                for (let personnes = 1; personnes <= bareme_irpp_1.MAXIMUM_PERSONNES_A_CHARGE; personnes += 1) {
                    const verdict = (0, bareme_irpp_1.impotAnnuel)(revenu, personnes);
                    expect(verdict.plafondApplique).toBe(true);
                    expect(verdict.baseDeLaQuotiteFc).toBe(bareme_irpp_1.IMPOT_DES_TROIS_PREMIERES_TRANCHES_FC);
                    expect(verdict.reductionFc).toBeCloseTo((9_486_720 * personnes * bareme_irpp_1.QUOTITE_PAR_PERSONNE_A_CHARGE_POUR_CENT) / 100, 6);
                    expect(verdict.impotDuFc).toBeCloseTo(verdict.plafondFc - verdict.reductionFc, 6);
                }
            }
        });
        it('P03 · 7 600 000 nets par mois, quatre personnes · base 9 486 720, retenue 2 216 800, la règle dite avec son fondement', () => {
            const verdict = (0, bareme_irpp_1.impotAnnuel)(91_200_000, 4);
            expect(verdict.plafondApplique).toBe(true);
            expect(verdict.baseDeLaQuotiteFc).toBe(9_486_720);
            expect(verdict.reductionFc).toBeCloseTo(758_937.6, 6);
            expect(verdict.impotDuFc).toBeCloseTo(26_601_062.4, 6);
            expect((0, bareme_irpp_1.retenueMensuelle)('2026-06', 7_600_000, 4).retenueFc).toBe(2_216_800);
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
            const verdict = (0, bareme_irpp_1.impotAnnuel)(91_200_000, 0);
            expect(verdict.reserves.some((r) => r.startsWith('ARTICLE 123 SUR UN IMPÔT PLAFONNÉ'))).toBe(false);
            expect(verdict.reserves.some((r) => r.startsWith("PLAFOND DE L'ARTICLE 118"))).toBe(true);
        });
    });
    it('ne rend jamais une base de quotité supérieure à ce qui est dû', () => {
        for (const revenu of [50_000_000, 100_000_000, 500_000_000]) {
            const verdict = (0, bareme_irpp_1.impotAnnuel)(revenu, 9);
            expect(verdict.baseDeLaQuotiteFc).toBeLessThanOrEqual(verdict.impotArticle118Fc + 1e-6);
            expect(verdict.impotDuFc).toBeGreaterThanOrEqual(0);
        }
    });
});
describe("La retenue mensuelle de l'article 119", () => {
    it("annualise le mois, applique l'article 118, puis ramène au mois", () => {
        const verdict = (0, bareme_irpp_1.retenueMensuelle)('2026-03', 1_000_000);
        expect(verdict.revenuAnnualiseFc).toBe(12_000_000);
        expect(verdict.annuel.assietteArrondieFc).toBe(12_000_000);
        expect(verdict.retenueFc).toBe((0, arrondi_article_150_1.arrondirImpotArt150)(verdict.annuel.impotDuFc / bareme_irpp_1.MOIS_PAR_AN));
    });
    it("ARRONDIT LE REVENU ANNUALISÉ, jamais le mois", () => {
        const verdict = (0, bareme_irpp_1.retenueMensuelle)('2026-03', 1_000_100);
        expect(verdict.annuel.assietteArrondieFc).toBe(12_001_000);
        expect(verdict.annuel.assietteArrondieFc).not.toBe(12_000_000);
    });
    it('ne tombe PAS dans la tranche à 3 % pour un salaire de cadre', () => {
        const verdict = (0, bareme_irpp_1.retenueMensuelle)('2026-06', 1_500_000);
        const naif = (0, bareme_irpp_1.impotDuBareme)(1_500_000).impotFc;
        expect(naif).toBeCloseTo(45_000, 6);
        expect(verdict.retenueFc).toBeGreaterThan(naif * 3);
    });
    it("annonce qu'il s'agit d'un acompte et non de l'impôt définitif", () => {
        const verdict = (0, bareme_irpp_1.retenueMensuelle)('2026-06', 800_000);
        const reserves = verdict.reserves.join(' ');
        expect(reserves).toContain('MENSUALISATION');
        expect(reserves).toContain('ACOMPTE');
        expect(reserves).toContain('article 121');
    });
});
describe('Les bornes que ce module ne franchit pas', () => {
    it("refuse tout mois antérieur à l'entrée en vigueur de la loi n° 23/053", () => {
        expect((0, bareme_irpp_1.baremeApplicableAuMois)('2025-12').applicable).toBe(false);
        expect((0, bareme_irpp_1.baremeApplicableAuMois)('2025-12').motif).toContain('1er janvier 2026');
        expect((0, bareme_irpp_1.baremeApplicableAuMois)(`${bareme_irpp_1.PREMIER_EXERCICE_IRPP}-01`).applicable).toBe(true);
    });
    it('ne calcule que le régime de droit commun, et nomme les deux autres', () => {
        expect((0, bareme_irpp_1.regimeApplicable)('BAREME_ARTICLE_118').calculable).toBe(true);
        expect((0, bareme_irpp_1.regimeApplicable)('FORFAIT_PERSONNEL_DOMESTIQUE').calculable).toBe(false);
        expect((0, bareme_irpp_1.regimeApplicable)('FORFAIT_SALARIE_DE_MICRO_ENTREPRISE').calculable).toBe(false);
        expect((0, bareme_irpp_1.regimeApplicable)('FORFAIT_PERSONNEL_DOMESTIQUE').motif).toContain('019/CAB/MIN/FINANCES/2025');
    });
    it("passe F5 · l'arrêté n° 019/2025 est LU · ses montants sont dits, et seul le cours manque", () => {
        const motif = (0, bareme_irpp_1.regimeApplicable)('FORFAIT_SALARIE_DE_MICRO_ENTREPRISE').motif;
        expect(motif).toContain('24 dollars par salarié domestique et de 36 dollars');
        expect(motif).toContain('Le cours de conversion est renvoyé');
    });
    it("ne porte NI le minimum de perception de l'article 122 NI le plancher de 2 000 FC du livre de cours", () => {
        expect(SOURCE).toMatch(/ARTICLE 122 \(1 % du chiffre d'affaires\)/);
        expect(SOURCE).toMatch(/PLANCHER DE 2 000 FC N'EXISTE PAS ICI/);
        expect((0, bareme_irpp_1.impotAnnuel)(12_000).impotDuFc).toBeCloseTo(360, 6);
        expect((0, bareme_irpp_1.impotAnnuel)(0).impotDuFc).toBe(0);
    });
});
describe('Le barème lu au mois · ce que montrent l’écran et le bulletin', () => {
    it('divise les bornes annuelles par douze, sans rien écrire à la main', () => {
        expect(bareme_irpp_1.TRANCHES_IRPP_MENSUELLES.map((t) => [t.deFc, t.aFc, t.tauxPourCent])).toEqual([
            [0, 162_000, 3],
            [162_000, 1_800_000, 15],
            [1_800_000, 3_600_000, 30],
            [3_600_000, null, 40],
        ]);
    });
    it('rend, pour 1 000 000 FC par mois, les 130 560 FC du barème mensuel, retenus 130 600 FC', () => {
        const v = (0, bareme_irpp_1.retenueMensuelle)('2026-03', 1_000_000);
        expect(v.mensuel.parTranche.map((t) => [t.tauxPourCent, t.baseFc, t.impotFc])).toEqual([
            [3, 162_000, 4_860],
            [15, 838_000, 125_700],
        ]);
        expect(v.mensuel.impotDuBaremeFc).toBeCloseTo(130_560, 6);
        expect(v.mensuel.retenueAvantArrondiFc).toBeCloseTo(130_560, 6);
        expect(v.mensuel.arrondiArticle150Fc).toBeCloseTo(40, 6);
        expect(v.mensuel.retenueFc).toBe(130_600);
        expect(v.retenueFc).toBe(130_600);
    });
    it("arrondit à la centaine INFÉRIEURE sous 50 FC · art. 150, alinéa 3", () => {
        const v = (0, bareme_irpp_1.retenueMensuelle)('2026-03', 163_000);
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
        const v = (0, bareme_irpp_1.retenueMensuelle)('2026-03', revenu, personnes);
        const m = v.mensuel;
        const somme = m.parTranche.reduce((n, t) => n + t.impotFc, 0);
        expect(somme).toBeCloseTo(m.impotDuBaremeFc, 6);
        expect(m.impotArticle118Fc - m.reductionFc).toBeCloseTo(m.retenueAvantArrondiFc, 6);
        expect(m.retenueAvantArrondiFc + m.arrondiArticle150Fc).toBeCloseTo(v.retenueFc, 6);
        expect(Math.abs(m.arrondiArticle150Fc)).toBeLessThan(100);
        expect(m.retenueFc).toBe(v.retenueFc);
    });
    it('montre le plafond au mois quand il mord', () => {
        const m = (0, bareme_irpp_1.retenueMensuelle)('2026-03', 8_000_000).mensuel;
        expect(m.plafondApplique).toBe(true);
        expect(m.plafondFc).toBeCloseTo(2_400_000, 6);
        expect(m.retenueFc).toBeCloseTo(2_400_000, 6);
    });
    it("garde l'arrondi au millier sur l'ANNÉE, comme l'article 118 l'écrit", () => {
        const m = (0, bareme_irpp_1.retenueMensuelle)('2026-03', 1_000_083).mensuel;
        expect(m.revenuRetenuFc).toBeCloseTo(1_000_000, 6);
    });
});
describe("L'arrondi au millier de l'art. 118 se prend sur la valeur EXACTE", () => {
    const cinqLignes = [51_905.39, 53_651.71, 168_138.49, 68_332.09, 537_972.32];
    const elements = cinqLignes.map((montantFc, i) => ({
        nature: i === 0 ? 'SALAIRE_OU_TRAITEMENT' : 'PRIME',
        libelle: `Ligne ${i + 1}`,
        montantFc,
    }));
    it('assiette, quote-part et base nette exactes · 880 000, 44 000, 836 000', () => {
        const premier = (0, assiettes_paie_1.assiettesExactes)(elements);
        expect(premier.verdict.assietteSocialeFc).toBe(880_000);
        const { verdict, totalTravailleurExact } = (0, cotisations_paie_1.cotisationsExactes)(premier.socialeExacte, {
            moisDePaie: '2026-03',
            natureEmployeurInpp: 'PRIVE',
            effectif: 30,
        });
        expect(verdict.totalTravailleurFc).toBe(44_000);
        const second = (0, assiettes_paie_1.assiettesExactes)(elements, { retenuesArticle71: totalTravailleurExact });
        expect(second.verdict.assietteFiscaleNetteFc).toBe(836_000);
        const r = (0, bareme_irpp_1.retenueMensuelle)('2026-03', second.netteExacte, 0);
        expect(r.revenuAnnualiseFc).toBe(10_032_000);
        expect(r.annuel.assietteArrondieFc).toBe(10_032_000);
        expect(r.retenueFc).toBe(106_000);
    });
    it('témoin · le même revenu porté par le flottant tombe au millier inférieur', () => {
        const flottant = (cinqLignes.reduce((a, b) => a + b, 0) * 95) / 100;
        expect(flottant * bareme_irpp_1.MOIS_PAR_AN).toBeLessThan(10_032_000);
        expect(Math.floor((flottant * bareme_irpp_1.MOIS_PAR_AN) / 1_000) * 1_000).toBe(10_031_000);
        expect((0, bareme_irpp_1.arrondirAuMillierInferieur)((0, decimal_exact_1.somme)(cinqLignes.map(decimal_exact_1.depuisNombre)))).toBe(880_000);
    });
    it('ne remonte jamais un revenu à 999,9964 FC du millier · aucun arrondi au centime d’abord', () => {
        expect((0, bareme_irpp_1.arrondirAuMillierInferieur)((0, decimal_exact_1.depuisNombre)(10_031_999.9964))).toBe(10_031_000);
        expect((0, bareme_irpp_1.retenueMensuelle)('2026-03', (0, decimal_exact_1.depuisNombre)(835_999.9997)).annuel.assietteArrondieFc).toBe(10_031_000);
    });
    it('un revenu non chiffré lève, jamais un zéro', () => {
        expect(() => (0, bareme_irpp_1.retenueMensuelle)('2026-03', null)).toThrow('Montant non chiffré');
    });
});
describe("L'arrondi de l'art. 150 sur la retenue rejoue un calcul en entiers", () => {
    const baremeEntier = (a) => {
        let bas = 0n;
        let impot = 0n;
        for (const t of bareme_irpp_1.TRANCHES_IRPP) {
            const haut = t.jusqua === null ? a : BigInt(t.jusqua);
            const borne = a < haut ? a : haut;
            if (borne > bas)
                impot += ((borne - bas) * BigInt(t.tauxPourCent)) / 100n;
            bas = haut;
            if (a <= haut)
                break;
        }
        return impot;
    };
    const retenueEntiere = (a, personnes) => {
        const bareme = baremeEntier(a);
        const plafond = (a * BigInt(bareme_irpp_1.PLAFOND_IMPOT_POUR_CENT)) / 100n;
        const impot118 = bareme > plafond ? plafond : bareme;
        const basse = baremeEntier(a < BigInt(bareme_irpp_1.BORNE_TROISIEME_TRANCHE) ? a : BigInt(bareme_irpp_1.BORNE_TROISIEME_TRANCHE));
        const baseQuotite = basse < impot118 ? basse : impot118;
        const du100 = impot118 * 100n - baseQuotite * personnes * BigInt(bareme_irpp_1.QUOTITE_PAR_PERSONNE_A_CHARGE_POUR_CENT);
        const unite = (2n * du100 + 1200n) / 2400n;
        const tranche = unite % 100n;
        return Number(tranche >= 50n ? unite - tranche + 100n : unite - tranche);
    };
    it('rend la retenue au franc près sur 40 000 assiettes et zéro à neuf personnes à charge', () => {
        let ecarts = 0;
        for (let i = 0; i < 4_000; i++) {
            const a = i * 49_000;
            for (let p = 0; p <= 9; p++) {
                const attendu = retenueEntiere(BigInt(a), BigInt(p));
                if ((0, bareme_irpp_1.detailMensuel)((0, bareme_irpp_1.impotAnnuel)(a, p)).retenueFc !== attendu)
                    ecarts++;
            }
        }
        for (const a of [1_944_000, 21_600_000, 43_200_000, 77_932_000, 77_933_000]) {
            for (let p = 0; p <= 9; p++) {
                if ((0, bareme_irpp_1.detailMensuel)((0, bareme_irpp_1.impotAnnuel)(a, p)).retenueFc !== retenueEntiere(BigInt(a), BigInt(p)))
                    ecarts++;
            }
        }
        expect(ecarts).toBe(0);
    });
});
//# sourceMappingURL=bareme-irpp.spec.js.map