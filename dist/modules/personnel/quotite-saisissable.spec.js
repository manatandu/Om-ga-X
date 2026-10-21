"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const quotite_saisissable_1 = require("./quotite-saisissable");
const bareme_smig_1 = require("./bareme-smig");
const MOIS = '2026-03';
const CLASSE_1_JOURNALIER = 21_500;
describe("Les fractions de l'article 114, recopiées et non calculées", () => {
    it('porte un cinquième, un tiers et deux cinquièmes', () => {
        expect(quotite_saisissable_1.FRACTION_SOUS_LE_SEUIL).toEqual({ numerateur: 1, denominateur: 5 });
        expect(quotite_saisissable_1.FRACTION_AU_DESSUS_DU_SEUIL).toEqual({ numerateur: 1, denominateur: 3 });
        expect(quotite_saisissable_1.FRACTION_OBLIGATION_ALIMENTAIRE).toEqual({ numerateur: 2, denominateur: 5 });
        expect(quotite_saisissable_1.MULTIPLE_DU_MINIMUM_CATEGORIEL).toBe(5);
    });
    it("mensualise par le multiplicateur de l'article 7, pas par trente", () => {
        expect(quotite_saisissable_1.JOURS_DU_MOIS).toBe(26);
    });
});
describe('Le seuil de la classe', () => {
    it("prend le taux de la classe dans l'annexe du mois, fois vingt-six", () => {
        const m = (0, quotite_saisissable_1.mensuelMinimumDeLaClasse)(MOIS, 1);
        expect(m).not.toBeNull();
        expect(m.montantFc).toBe(CLASSE_1_JOURNALIER * 26);
        expect(m.annexe.numero).toBe(2);
        expect(m.colonne).toBe(2);
    });
    it('couvre les dix-sept classes, et refuse la dix-huitième', () => {
        for (let c = 1; c <= 17; c += 1) {
            expect((0, quotite_saisissable_1.mensuelMinimumDeLaClasse)(MOIS, c)).not.toBeNull();
        }
        expect((0, quotite_saisissable_1.mensuelMinimumDeLaClasse)(MOIS, 18)).toBeNull();
        expect((0, quotite_saisissable_1.mensuelMinimumDeLaClasse)(MOIS, 0)).toBeNull();
        expect((0, quotite_saisissable_1.mensuelMinimumDeLaClasse)(MOIS, 1.5)).toBeNull();
    });
    it('change avec le palier · la classe 1 de 2025 est celle du montant PAYÉ', () => {
        expect((0, quotite_saisissable_1.mensuelMinimumDeLaClasse)('2025-07', 1).montantFc).toBe(14_500 * 26);
        expect(bareme_smig_1.ANNEXES[0].tauxParClasse[0]).toBe(14_500);
    });
    it("refuse le mois qu'aucune annexe ne couvre", () => {
        expect((0, quotite_saisissable_1.mensuelMinimumDeLaClasse)('2018-06', 1)).toBeNull();
        expect((0, quotite_saisissable_1.mensuelMinimumDeLaClasse)('2025-01', 1).montantFc).toBe(7_075 * 26);
    });
});
describe("Les abstentions de l'article 114", () => {
    it("s'abstient sans classe professionnelle, et le dit", () => {
        const v = (0, quotite_saisissable_1.quotiteSaisissable)({ moisDePaie: MOIS, remunerationFc: 5_000_000 });
        expect(v.quotiteOrdinaireFc).toBeNull();
        expect(v.baseFc).toBeNull();
        expect(v.abstentions.map((a) => a.motif)).toContain('CLASSE_PROFESSIONNELLE_ABSENTE');
    });
    it("NE s'abstient PLUS pour un logement fourni en nature · l'arrêté de 2005 est au corpus", () => {
        const v = (0, quotite_saisissable_1.quotiteSaisissable)({
            moisDePaie: MOIS,
            remunerationFc: 5_000_000,
            classeProfessionnelle: 5,
            logementFourniEnNature: true,
        });
        expect(v.abstentions).toHaveLength(0);
        expect(v.quotiteOrdinaireFc).not.toBeNull();
        expect(v.evaluationForfaitaireLogementFc).toBeCloseTo((796.3 / 5) * 26, 6);
        expect(v.reserves).toContain(quotite_saisissable_1.RESERVE_FACULTE_DE_DEFALCATION);
    });
    it('ne déduit RIEN quand aucun logement en nature n\'est déclaré', () => {
        const v = (0, quotite_saisissable_1.quotiteSaisissable)({
            moisDePaie: MOIS,
            remunerationFc: 5_000_000,
            classeProfessionnelle: 5,
        });
        expect(v.evaluationForfaitaireLogementFc).toBe(0);
        expect(v.reserves).not.toContain(quotite_saisissable_1.RESERVE_FACULTE_DE_DEFALCATION);
    });
    it("ne déduit PAS deux fois quand l'employeur a déjà défalqué", () => {
        const v = (0, quotite_saisissable_1.quotiteSaisissable)({
            moisDePaie: MOIS,
            remunerationFc: 5_000_000,
            classeProfessionnelle: 5,
            logementFourniEnNature: true,
            logementEnNatureDejaDefalque: true,
        });
        expect(v.evaluationForfaitaireLogementFc).toBe(0);
        expect(v.baseFc).toBe(5_000_000);
    });
    it("abaisse la base, donc la quotité, quand le logement est en nature", () => {
        const sans = (0, quotite_saisissable_1.quotiteSaisissable)({
            moisDePaie: MOIS,
            remunerationFc: 5_000_000,
            classeProfessionnelle: 5,
        });
        const avec = (0, quotite_saisissable_1.quotiteSaisissable)({
            moisDePaie: MOIS,
            remunerationFc: 5_000_000,
            classeProfessionnelle: 5,
            logementFourniEnNature: true,
        });
        expect(avec.baseFc).toBeLessThan(sans.baseFc);
        expect(avec.quotiteOrdinaireFc).toBeLessThan(sans.quotiteOrdinaireFc);
    });
    it("ne s'abstient PAS pour une simple indemnité de logement", () => {
        const v = (0, quotite_saisissable_1.quotiteSaisissable)({
            moisDePaie: MOIS,
            remunerationFc: 5_000_000,
            classeProfessionnelle: 5,
            logementFourniEnNature: false,
        });
        expect(v.abstentions).toHaveLength(0);
        expect(v.quotiteOrdinaireFc).not.toBeNull();
    });
    it("s'abstient hors période d'annexe", () => {
        const v = (0, quotite_saisissable_1.quotiteSaisissable)({
            moisDePaie: '2018-06',
            remunerationFc: 5_000_000,
            classeProfessionnelle: 3,
        });
        expect(v.abstentions.map((a) => a.motif)).toContain('MOIS_HORS_ANNEXE');
    });
});
describe("Le mot « logement », et la conclusion que le dépôt a dû retourner", () => {
    it("nomme l'arrêté de 2005, sa formule, et dit que le décret EN EST LE RÉSULTAT", () => {
        expect(quotite_saisissable_1.RESERVE_LOGEMENT).toContain('12/CAB.MIN/TPS/110/2005');
        expect(quotite_saisissable_1.RESERVE_LOGEMENT).toContain('26 OCTOBRE 2005');
        expect(quotite_saisissable_1.RESERVE_LOGEMENT).toMatch(/1\/5 DU TAUX JOURNALIER DES ALLOCATIONS/i);
        expect(quotite_saisissable_1.RESERVE_LOGEMENT).toMatch(/quelle que soit la catégorie/i);
        expect(quotite_saisissable_1.RESERVE_LOGEMENT).toMatch(/EN EST LE RÉSULTAT/i);
        expect(quotite_saisissable_1.RESERVE_LOGEMENT).toMatch(/les deux textes disent la même chose/i);
        expect(quotite_saisissable_1.RESERVE_LOGEMENT).toContain('138');
        expect(quotite_saisissable_1.RESERVE_LOGEMENT).toMatch(/litera h/i);
        expect(quotite_saisissable_1.RESERVE_LOGEMENT).toContain('25/21');
        expect(quotite_saisissable_1.RESERVE_LOGEMENT).toMatch(/MUTATION/);
    });
    it("l'arithmétique boucle sur les deux annexes, et c'est la preuve", () => {
        expect(bareme_smig_1.ANNEXES[0].allocationFamilialeJournaliereFc / 5).toBeCloseTo(bareme_smig_1.ANNEXES[0].contreValeurLogementJournaliereFc, 2);
        expect(bareme_smig_1.ANNEXES[1].allocationFamilialeJournaliereFc / 5).toBeCloseTo(bareme_smig_1.ANNEXES[1].contreValeurLogementJournaliereFc, 2);
        expect(quotite_saisissable_1.DIVISEUR_EVALUATION_FORFAITAIRE_LOGEMENT).toBe(5);
    });
});
describe("Le calcul de l'alinéa 1er", () => {
    const seuil = CLASSE_1_JOURNALIER * 26 * 5;
    it('applique un cinquième quand toute la base est sous le seuil', () => {
        const v = (0, quotite_saisissable_1.quotiteSaisissable)({
            moisDePaie: MOIS,
            remunerationFc: 1_000_000,
            classeProfessionnelle: 1,
        });
        expect(v.seuilFc).toBe(seuil);
        expect(v.baseFc).toBe(1_000_000);
        expect(v.quotiteOrdinaireFc).toBeCloseTo(200_000, 6);
        expect(v.partInsaisissableFc).toBeCloseTo(800_000, 6);
    });
    it('coupe au seuil et passe au tiers sur le surplus', () => {
        const remuneration = seuil + 600_000;
        const v = (0, quotite_saisissable_1.quotiteSaisissable)({
            moisDePaie: MOIS,
            remunerationFc: remuneration,
            classeProfessionnelle: 1,
        });
        expect(v.quotiteOrdinaireFc).toBeCloseTo(seuil / 5 + 600_000 / 3, 6);
        expect(v.quotiteOrdinaireFc).not.toBeCloseTo(remuneration / 3, 2);
    });
    it("déduit les retenues fiscales et sociales AVANT de placer le seuil", () => {
        const v = (0, quotite_saisissable_1.quotiteSaisissable)({
            moisDePaie: MOIS,
            remunerationFc: 1_000_000,
            classeProfessionnelle: 1,
            retenuesFiscalesFc: 120_000,
            retenuesSocialesFc: 50_000,
        });
        expect(v.baseFc).toBe(830_000);
        expect(v.quotiteOrdinaireFc).toBeCloseTo(166_000, 6);
    });
    it('ne rend jamais une base négative', () => {
        const v = (0, quotite_saisissable_1.quotiteSaisissable)({
            moisDePaie: MOIS,
            remunerationFc: 100_000,
            classeProfessionnelle: 1,
            retenuesFiscalesFc: 900_000,
        });
        expect(v.baseFc).toBe(0);
        expect(v.quotiteOrdinaireFc).toBe(0);
    });
});
describe("L'alinéa 2 et le cumul de l'alinéa 3", () => {
    it("n'applique les deux cinquièmes QUE si la créance est alimentaire", () => {
        const sans = (0, quotite_saisissable_1.quotiteSaisissable)({
            moisDePaie: MOIS,
            remunerationFc: 1_000_000,
            classeProfessionnelle: 1,
        });
        expect(sans.quotiteAlimentaireFc).toBe(0);
        expect(sans.quotiteCumuleeFc).toBe(sans.quotiteOrdinaireFc);
    });
    it("applique deux cinquièmes sur TOUTE la base, sans découpage au seuil", () => {
        const seuil = CLASSE_1_JOURNALIER * 26 * 5;
        const v = (0, quotite_saisissable_1.quotiteSaisissable)({
            moisDePaie: MOIS,
            remunerationFc: seuil + 600_000,
            classeProfessionnelle: 1,
            obligationAlimentaireLegale: true,
        });
        expect(v.quotiteAlimentaireFc).toBeCloseTo((v.baseFc * 2) / 5, 6);
    });
    it('cumule les deux quotités sans les plafonner, et porte la réserve', () => {
        const v = (0, quotite_saisissable_1.quotiteSaisissable)({
            moisDePaie: MOIS,
            remunerationFc: 1_000_000,
            classeProfessionnelle: 1,
            obligationAlimentaireLegale: true,
        });
        expect(v.quotiteCumuleeFc).toBeCloseTo(200_000 + 400_000, 6);
        expect(v.partInsaisissableFc).toBeCloseTo(400_000, 6);
        expect(v.reserves).toContain(quotite_saisissable_1.RESERVE_CUMUL);
        expect(quotite_saisissable_1.RESERVE_CUMUL).toMatch(/AUCUN PLAFOND/i);
        expect(quotite_saisissable_1.RESERVE_CUMUL).toContain('177, al. 3');
        expect(quotite_saisissable_1.RESERVE_CUMUL).toMatch(/EN AUCUN CAS, fût-ce pour dettes alimentaires/);
    });
    it("ne porte pas la réserve du cumul quand il n'y a pas de cumul", () => {
        const v = (0, quotite_saisissable_1.quotiteSaisissable)({
            moisDePaie: MOIS,
            remunerationFc: 1_000_000,
            classeProfessionnelle: 1,
        });
        expect(v.reserves).not.toContain(quotite_saisissable_1.RESERVE_CUMUL);
    });
});
describe('La classe plutôt que la catégorie · une règle de protection', () => {
    it("prend un seuil AU MOINS égal à celui du premier échelon de la catégorie", () => {
        const base = 4_000_000;
        const haute = (0, quotite_saisissable_1.quotiteSaisissable)({
            moisDePaie: MOIS,
            remunerationFc: base,
            classeProfessionnelle: 4,
        });
        const basse = (0, quotite_saisissable_1.quotiteSaisissable)({
            moisDePaie: MOIS,
            remunerationFc: base,
            classeProfessionnelle: 1,
        });
        expect(haute.seuilFc).toBeGreaterThan(basse.seuilFc);
        expect(haute.quotiteOrdinaireFc).toBeLessThan(basse.quotiteOrdinaireFc);
    });
});
describe("P7 · ce que la doctrine apporte, et ce qu'elle n'apporte pas", () => {
    it("signale le cumul des deux branches de l'article 138, sans le refuser", () => {
        const v = (0, quotite_saisissable_1.quotiteSaisissable)({
            moisDePaie: MOIS,
            remunerationFc: 5_000_000,
            classeProfessionnelle: 5,
            logementFourniEnNature: true,
            indemniteDeLogementVersee: true,
        });
        expect(v.abstentions).toHaveLength(0);
        expect(v.quotiteOrdinaireFc).not.toBeNull();
        expect(v.reserves).toContain(quotite_saisissable_1.RESERVE_EQUIVALENCE_DES_DEUX_BRANCHES);
        expect(quotite_saisissable_1.RESERVE_EQUIVALENCE_DES_DEUX_BRANCHES).toMatch(/ALTERNATIVES/);
        expect(quotite_saisissable_1.RESERVE_EQUIVALENCE_DES_DEUX_BRANCHES).toMatch(/Lukoo Musubao/);
        expect(quotite_saisissable_1.RESERVE_EQUIVALENCE_DES_DEUX_BRANCHES).toMatch(/PAS UNE SOURCE/);
        expect(quotite_saisissable_1.RESERVE_EQUIVALENCE_DES_DEUX_BRANCHES).toMatch(/il ne le tranche pas/);
    });
    it('ne signale rien quand une seule branche joue', () => {
        const v = (0, quotite_saisissable_1.quotiteSaisissable)({
            moisDePaie: MOIS,
            remunerationFc: 5_000_000,
            classeProfessionnelle: 5,
            logementFourniEnNature: true,
        });
        expect(v.reserves).not.toContain(quotite_saisissable_1.RESERVE_EQUIVALENCE_DES_DEUX_BRANCHES);
    });
    it("porte la chaîne des trois textes de fixation, et dit lequel manque", () => {
        expect(quotite_saisissable_1.RESERVE_CONTINUITE_DES_TEXTES).toContain('08/040');
        expect(quotite_saisissable_1.RESERVE_CONTINUITE_DES_TEXTES).toContain('18/017');
        expect(quotite_saisissable_1.RESERVE_CONTINUITE_DES_TEXTES).toContain('25/22');
        expect(quotite_saisissable_1.RESERVE_CONTINUITE_DES_TEXTES).toContain('110/2005');
        expect(quotite_saisissable_1.RESERVE_CONTINUITE_DES_TEXTES).toMatch(/N'EST PAS au corpus/i);
        expect(quotite_saisissable_1.RESERVE_CONTINUITE_DES_TEXTES).toMatch(/antérieur à mai 2018/);
    });
    it("NE CODE AUCUN CHIFFRE de l'article de doctrine", () => {
        const source = require('node:fs').readFileSync(require('node:path').join(__dirname, 'quotite-saisissable.ts'), 'utf8');
        for (const chiffre of ['13,50', '16,50', '22,50', '1.500 francs', '900 francs']) {
            expect(source).not.toContain(chiffre);
        }
    });
});
describe('F104 · une retenue non chiffrée n’est pas zéro', () => {
    const base = { moisDePaie: '2026-03', remunerationFc: 800_000, classeProfessionnelle: 5 };
    it('un IRPP non chiffré abstient la quotité', () => {
        const v = (0, quotite_saisissable_1.quotiteSaisissable)({ ...base, retenuesFiscalesFc: null, retenuesSocialesFc: 40_000 });
        expect(v.quotiteOrdinaireFc).toBeNull();
        expect(v.abstentions.map((a) => a.motif)).toEqual(['IMPOT_NON_CHIFFRE']);
    });
    it('une quote-part CNSS non chiffrée abstient la quotité', () => {
        const v = (0, quotite_saisissable_1.quotiteSaisissable)({ ...base, retenuesFiscalesFc: 10_000, retenuesSocialesFc: null });
        expect(v.baseFc).toBeNull();
        expect(v.abstentions.map((a) => a.motif)).toEqual(['COTISATION_NON_CHIFFREE']);
    });
    it('zéro chiffré reste une réponse · la quotité se calcule', () => {
        const v = (0, quotite_saisissable_1.quotiteSaisissable)({ ...base, retenuesFiscalesFc: 0, retenuesSocialesFc: 0 });
        expect(v.abstentions).toEqual([]);
        expect(v.baseFc).toBe(800_000);
    });
});
describe("Passe O4 · l'assiette de l'AUPSRVE, art. 177, al. 2, toujours dite", () => {
    it('la réserve est servie sur toute quotité, chiffrée ou non', () => {
        const v = (0, quotite_saisissable_1.quotiteSaisissable)({
            moisDePaie: '2026-03',
            remunerationFc: 1_000_000,
            classeProfessionnelle: null,
            retenuesFiscalesFc: 0,
            retenuesSocialesFc: 0,
        });
        expect(v.reserves).toContain(quotite_saisissable_1.RESERVE_ASSIETTE_AUPSRVE);
    });
    it("nomme les deux divergences et dit que l'acte notifié prime", () => {
        expect(quotite_saisissable_1.RESERVE_ASSIETTE_AUPSRVE).toContain('art. 177, al. 2');
        expect(quotite_saisissable_1.RESERVE_ASSIETTE_AUPSRVE).toMatch(/retire d'office l'indemnité de logement/);
        expect(quotite_saisissable_1.RESERVE_ASSIETTE_AUPSRVE).toMatch(/forfait logement.*que la liste de l'Acte ne nomme pas/);
        expect(quotite_saisissable_1.RESERVE_ASSIETTE_AUPSRVE).toMatch(/art\. 184, 3°.*PRIME ce chiffre/);
        expect(quotite_saisissable_1.RESERVE_ASSIETTE_AUPSRVE).toContain('art. 337');
    });
});
//# sourceMappingURL=quotite-saisissable.spec.js.map