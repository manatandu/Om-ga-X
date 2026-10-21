"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const common_1 = require("@nestjs/common");
const decompte_final_1 = require("./decompte-final");
const decompte_final_emis_1 = require("./decompte-final-emis");
const personnel_service_1 = require("./personnel.service");
const remuneration_du_delai_1 = require("./remuneration-du-delai");
const CDI = 'DUREE_INDETERMINEE';
const LICENCIEMENT = {
    anneesAnciennete: 3,
    moisNonCouvertsParUnConge: 12,
    moinsDeDixHuitAns: false,
    initiative: 'EMPLOYEUR',
    motif: 'LICENCIEMENT',
    typeContrat: CDI,
    dateNotification: '2026-05-18',
    remunerationJournaliereFc: 20_000,
    moyenneMensuelleArticle66Fc: 26_000,
    moyenneMensuelleArticle142Fc: 0,
    avantagesPendantPreavisFc: 70_000,
    arrieresFc: 150_000,
    gratificationFc: 0,
    enfantsBeneficiairesAllocations: 2,
    joursAllocationsFamiliales: 30,
    allocationFamilialeParEnfantFc: 796.3,
};
const MI_PREAVIS = {
    ...LICENCIEMENT,
    executionPreavis: 'DEPART_A_MI_PREAVIS',
    joursPreavisNonObserves: 17.5,
    avantagesEnNatureRestantsFc: 5_000,
};
const NOUVEL_EMPLOI = {
    ...LICENCIEMENT,
    executionPreavis: 'DEPART_POUR_NOUVEL_EMPLOI',
    joursPreavisNonObserves: 25,
    nouvelEmploiJustifie: true,
    delaiDepartNouvelEmploiJours: 5,
};
const preavisDe = (p) => (0, decompte_final_1.decompteFinal)(p).rubriques.find((r) => r.cle === 'preavis');
const remunerationDe = (p) => (0, decompte_final_1.decompteFinal)(p).rubriques.find((r) => r.cle === decompte_final_1.CLE_REMUNERATION_PREAVIS_RESTANT);
describe("A9 · article 66 · le départ à mi-préavis, et l'employeur doit le temps restant", () => {
    it('crédite le travailleur de la rémunération du temps restant, moyenne et avantages en nature compris', () => {
        const v = (0, decompte_final_1.decompteFinal)(MI_PREAVIS);
        const p = v.rubriques.find((r) => r.cle === decompte_final_1.CLE_REMUNERATION_PREAVIS_RESTANT);
        expect(p.libelle).toBe('Rémunération du préavis restant à courir');
        expect(p.montantFc).toBeCloseTo(17.5 * (20_000 + 1_000) + 5_000, 6);
        expect(p.fondement).toContain("L'employeur doit la rémunération et les allocations familiales pendant le temps restant à courir");
        expect(v.duParLeTravailleur).toEqual([]);
        expect(v.totalBrutFc).not.toBeNull();
    });
    it("n'y fait entrer ni le logement ni le transport · l'art. 66 dit « la rémunération » (art. 7, point 8)", () => {
        const p = remunerationDe(MI_PREAVIS);
        expect(p.montantFc).not.toBeCloseTo(17.5 * 21_000 + 70_000, 0);
        expect(p.avantagesInclusFc).toBeUndefined();
        expect(p.fondement).toContain('ni le logement ou son indemnité, ni les allocations familiales, ni le transport, ni les frais de voyage');
    });
    it('accepte un départ après la moitié (moins de jours restants)', () => {
        expect(remunerationDe({ ...MI_PREAVIS, joursPreavisNonObserves: 10 }).montantFc).toBeCloseTo(10 * 21_000 + 5_000, 6);
    });
    it('refuse un départ AVANT la moitié · ce n’est plus l’article 66, et rien n’est chiffré', () => {
        const v = (0, decompte_final_1.decompteFinal)({ ...MI_PREAVIS, joursPreavisNonObserves: 20 });
        const p = v.rubriques.find((r) => r.cle === decompte_final_1.CLE_REMUNERATION_PREAVIS_RESTANT);
        expect(p.montantFc).toBeNull();
        expect(p.reserve).toContain('AVANT la moitié');
        expect(p.reserve).toContain('déclarez la durée retenue');
        expect(v.totalBrutFc).toBeNull();
        const retenue = remunerationDe({ ...MI_PREAVIS, joursPreavisNonObserves: 20, preavisRetenuJours: 40 });
        expect(retenue.montantFc).toBeCloseTo(21 * 21_000 + 5_000, 6);
    });
    it('relecture M2 · le temps restant à courir est la rémunération de la fin du délai (même règle que T9) · au mois, le mois entamé à 1/26 ; sans date de notification, rien n’est chiffré', () => {
        const auMois = remunerationDe({ ...MI_PREAVIS, remunerationJournaliereFc: null, remunerationMensuelleFc: 520_000 });
        expect(auMois.montantFc).toBeCloseTo((17.5 * 546_000) / 26 + 5_000, 6);
        expect(auMois.fondement).toContain(remuneration_du_delai_1.REGLE_MOIS_ENTAME);
        expect(auMois.fondement).toContain('fériés compris (art. 93)');
        const sansDate = remunerationDe({ ...MI_PREAVIS, dateNotification: null });
        expect(sansDate.montantFc).toBeNull();
        expect(sansDate.reserve).toContain("La date de notification n'est pas déclarée");
    });
    it('ne lit jamais zéro un fait non déclaré · jours restants, moyenne ou avantages en nature absents', () => {
        expect(remunerationDe({ ...MI_PREAVIS, joursPreavisNonObserves: null }).montantFc).toBeNull();
        expect(remunerationDe({ ...MI_PREAVIS, avantagesEnNatureRestantsFc: null }).montantFc).toBeNull();
        expect(remunerationDe({ ...MI_PREAVIS, avantagesEnNatureRestantsFc: null }).reserve).toContain('zéro est une réponse');
        expect(remunerationDe({ ...MI_PREAVIS, moyenneMensuelleArticle66Fc: null }).montantFc).toBeNull();
        expect(remunerationDe({ ...MI_PREAVIS, remunerationJournaliereFc: null }).montantFc).toBeNull();
        expect(remunerationDe({ ...MI_PREAVIS, avantagesEnNatureRestantsFc: 0 }).montantFc).toBeCloseTo(17.5 * 21_000, 6);
    });
    it('garde les allocations familiales du temps restant, et le dit', () => {
        const af = (0, decompte_final_1.decompteFinal)(MI_PREAVIS).horsBrut.find((r) => r.cle === 'allocations-familiales');
        expect(af.montantFc).toBeCloseTo(2 * 30 * 796.3, 6);
        expect(af.reserve).toContain('DUES (art. 66, al. 2');
    });
    it("s'émet sous l'indemnité de fin de contrat (6614), sans ventilation d'avantages", () => {
        const { elements, refus } = (0, decompte_final_emis_1.elementsDuDecompte)((0, decompte_final_1.decompteFinal)(MI_PREAVIS));
        expect(refus).toEqual([]);
        expect(elements.find((e) => e.cleRubrique === decompte_final_1.CLE_REMUNERATION_PREAVIS_RESTANT)).toEqual(expect.objectContaining({
            nature: 'INDEMNITE_DE_FIN_DE_CONTRAT',
            montantFc: 17.5 * 21_000 + 5_000,
            reserve: decompte_final_emis_1.RESERVE_REMUNERATION_ARTICLE_66,
        }));
    });
});
describe('A9 · relevé CPCC C5 · un départ à mi-préavis saisi « non observé » ne fait plus payer le travailleur', () => {
    const MAL_SAISI = {
        ...LICENCIEMENT,
        executionPreavis: 'NON_OBSERVE',
        partieResponsable: 'TRAVAILLEUR',
        joursPreavisNonObserves: 17.5,
    };
    it("n'impute rien au travailleur parti à la moitié, et renvoie à l'article 66", () => {
        const v = (0, decompte_final_1.decompteFinal)(MAL_SAISI);
        expect(v.duParLeTravailleur).toEqual([]);
        const p = v.rubriques.find((r) => r.cle === 'preavis');
        expect(p.montantFc).toBeNull();
        expect(p.reserve).toContain('Article 66');
        expect(p.reserve).toContain('mi-préavis');
        expect(v.totalBrutFc).toBeNull();
        expect((0, decompte_final_emis_1.elementsDuDecompte)(v).refus.length).toBeGreaterThan(0);
    });
    it("n'impute au travailleur parti avant la moitié que les jours d'avant elle", () => {
        const v = (0, decompte_final_1.decompteFinal)({ ...MAL_SAISI, joursPreavisNonObserves: 25 });
        const du = v.duParLeTravailleur.find((r) => r.cle === 'preavis');
        expect(du.montantFc).toBeCloseTo(7.5 * 21_000 + 70_000, 6);
        expect(du.reserve).toBe(decompte_final_1.RESERVE_DEPART_AVANT_LA_MOITIE);
        expect(du.fondement).toContain('seuls les 7.5 jours');
    });
    it("laisse entier le préavis du démissionnaire · l'art. 66 vise celui qui REÇOIT le préavis", () => {
        const v = (0, decompte_final_1.decompteFinal)({
            ...LICENCIEMENT,
            motif: 'DEMISSION',
            initiative: 'TRAVAILLEUR',
            executionPreavis: 'NON_OBSERVE',
            joursPreavisNonObserves: 17.5,
        });
        const du = v.duParLeTravailleur.find((r) => r.cle === 'preavis');
        expect(du.montantFc).toBeCloseTo(17.5 * 21_000 + 70_000, 6);
        expect(du.reserve).toBeNull();
    });
    it("ne touche pas au préavis non observé par l'employeur", () => {
        const p = preavisDe({ ...MAL_SAISI, partieResponsable: 'EMPLOYEUR', joursPreavisNonObserves: 10 });
        expect(p.montantFc).toBeCloseTo(10 * 21_000 + 70_000, 6);
    });
});
describe('A9 · article 67 · le départ pour un nouvel emploi, et le travailleur perd le reste', () => {
    it('ne doit rien au travailleur pour le temps restant, ni rien de lui', () => {
        const v = (0, decompte_final_1.decompteFinal)(NOUVEL_EMPLOI);
        const p = v.rubriques.find((r) => r.cle === 'preavis');
        expect(p.montantFc).toBe(0);
        expect(p.fondement).toContain('il perd le droit à la rémunération et aux allocations familiales');
        expect(v.duParLeTravailleur).toEqual([]);
        expect(v.totalBrutFc).not.toBeNull();
    });
    it('dit que les allocations du temps restant sont perdues', () => {
        expect((0, decompte_final_1.decompteFinal)(NOUVEL_EMPLOI).horsBrut[0].reserve).toContain('PERDUES (art. 67)');
    });
    it('borne le délai convenu à sept jours, compris', () => {
        expect(decompte_final_1.DELAI_NOUVEL_EMPLOI_MAXIMUM_JOURS).toBe(7);
        expect(preavisDe({ ...NOUVEL_EMPLOI, delaiDepartNouvelEmploiJours: 7 }).montantFc).toBe(0);
        const p = preavisDe({ ...NOUVEL_EMPLOI, delaiDepartNouvelEmploiJours: 8 });
        expect(p.montantFc).toBeNull();
        expect(p.reserve).toContain('supérieur à sept jours');
    });
    it("n'écrit pas le zéro sans la justification ni le délai déclarés", () => {
        const sans = preavisDe({ ...NOUVEL_EMPLOI, nouvelEmploiJustifie: null });
        expect(sans.montantFc).toBeNull();
        const non = preavisDe({ ...NOUVEL_EMPLOI, nouvelEmploiJustifie: false });
        expect(non.montantFc).toBeNull();
        expect(non.reserve).toContain('63, al. 3');
        expect(preavisDe({ ...NOUVEL_EMPLOI, delaiDepartNouvelEmploiJours: null }).montantFc).toBeNull();
    });
    it("s'émet sans élément de préavis et sans refus", () => {
        const { elements, refus } = (0, decompte_final_emis_1.elementsDuDecompte)((0, decompte_final_1.decompteFinal)(NOUVEL_EMPLOI));
        expect(refus).toEqual([]);
        expect(elements.some((e) => e.cleRubrique === 'preavis')).toBe(false);
    });
});
describe('A9 · les articles 66 et 67 ne valent que pour le préavis REÇU de l’employeur', () => {
    it('refuse les deux départs sur une démission', () => {
        expect((0, decompte_final_1.motifRefusDecompte)({ initiative: 'TRAVAILLEUR', motif: 'DEMISSION', executionPreavis: 'DEPART_A_MI_PREAVIS' })).toContain('Article 66');
        expect((0, decompte_final_1.motifRefusDecompte)({ initiative: 'TRAVAILLEUR', motif: 'DEMISSION', executionPreavis: 'DEPART_POUR_NOUVEL_EMPLOI' })).toContain('Article 67');
        expect((0, decompte_final_1.motifRefusDecompte)({ initiative: 'EMPLOYEUR', motif: 'LICENCIEMENT', executionPreavis: 'DEPART_A_MI_PREAVIS' })).toBeNull();
    });
    it('le service refuse en 400 et transmet les faits nouveaux au moteur', async () => {
        const svc = new personnel_service_1.PersonnelService({});
        const dto = {
            anneesAnciennete: 3,
            moisNonCouvertsParUnConge: 12,
            initiative: 'EMPLOYEUR',
            motif: 'LICENCIEMENT',
            typeContrat: CDI,
            executionPreavis: 'DEPART_A_MI_PREAVIS',
            joursPreavisNonObserves: 17.5,
            dateNotification: '2026-05-18',
            remunerationJournaliereFc: 20_000,
            moyenneMensuelleArticle66Fc: 0,
            avantagesEnNatureRestantsFc: 1_000,
        };
        const v = await svc.decompteFinal('t1', dto);
        expect(v.rubriques.find((r) => r.cle === decompte_final_1.CLE_REMUNERATION_PREAVIS_RESTANT).montantFc).toBeCloseTo(17.5 * 20_000 + 1_000, 6);
        const v67 = await svc.decompteFinal('t1', {
            ...dto,
            executionPreavis: 'DEPART_POUR_NOUVEL_EMPLOI',
            joursPreavisNonObserves: 25,
            nouvelEmploiJustifie: true,
            delaiDepartNouvelEmploiJours: 3,
        });
        expect(v67.rubriques.find((r) => r.cle === 'preavis').montantFc).toBe(0);
        await expect(svc.decompteFinal('t1', { ...dto, initiative: 'TRAVAILLEUR', motif: 'DEMISSION' })).rejects.toBeInstanceOf(common_1.BadRequestException);
    });
});
describe('A9 · B1 · le « délai moindre » de l\'art. 67 se lit contre la moitié de l\'art. 66', () => {
    const VINGT_HUIT = {
        ...NOUVEL_EMPLOI,
        anneesAnciennete: 2,
        remunerationJournaliereFc: 10_000,
        moyenneMensuelleArticle66Fc: 0,
        joursPreavisNonObserves: 8,
    };
    it("n'écrit pas zéro pour un départ après la moitié · l'art. 66 lui gardait 80 000 FC", () => {
        const v = (0, decompte_final_1.decompteFinal)(VINGT_HUIT);
        const p = v.rubriques.find((r) => r.cle === 'preavis');
        expect(p.montantFc).toBeNull();
        expect(p.reserve).toContain('Déclarez le départ à mi-préavis');
        expect(v.totalBrutFc).toBeNull();
        const m = remunerationDe({ ...VINGT_HUIT, executionPreavis: 'DEPART_A_MI_PREAVIS', avantagesEnNatureRestantsFc: 0 });
        expect(m.montantFc).toBe(80_000);
    });
    it('exige les jours restant à courir, jamais présumés', () => {
        const p = preavisDe({ ...VINGT_HUIT, joursPreavisNonObserves: null });
        expect(p.montantFc).toBeNull();
        expect(p.reserve).toContain('restant à courir');
    });
    it('garde le zéro de l\'art. 67 pour un départ avant la moitié', () => {
        expect(preavisDe({ ...VINGT_HUIT, joursPreavisNonObserves: 20 }).montantFc).toBe(0);
    });
});
describe('A9 · M3 · le sort des allocations familiales suit la rubrique EFFECTIVE', () => {
    it('ne dit rien des art. 66 ou 67 quand leur rubrique est refusée', () => {
        const af = (0, decompte_final_1.decompteFinal)({ ...MI_PREAVIS, joursPreavisNonObserves: 20 }).horsBrut[0];
        expect(af.reserve).toBeNull();
        const af67 = (0, decompte_final_1.decompteFinal)({ ...NOUVEL_EMPLOI, nouvelEmploiJustifie: null }).horsBrut[0];
        expect(af67.reserve).toBeNull();
    });
    it('dit « non dues » pour le travailleur parti avant la moitié', () => {
        const af = (0, decompte_final_1.decompteFinal)({
            ...LICENCIEMENT,
            executionPreavis: 'NON_OBSERVE',
            partieResponsable: 'TRAVAILLEUR',
            joursPreavisNonObserves: 25,
        }).horsBrut[0];
        expect(af.reserve).toContain('ne sont pas dues');
    });
    it('refuse les deux départs hors préavis de licenciement', () => {
        for (const motif of ['FAUTE_LOURDE', 'COMMUN_ACCORD', 'FORCE_MAJEURE']) {
            expect((0, decompte_final_1.motifRefusDecompte)({ initiative: 'EMPLOYEUR', motif, executionPreavis: 'DEPART_A_MI_PREAVIS' })).toContain('préavis de licenciement');
        }
        expect((0, decompte_final_1.motifRefusDecompte)({ initiative: 'EMPLOYEUR', motif: 'TERME_DU_CDD', typeContrat: 'DUREE_DETERMINEE', executionPreavis: 'DEPART_POUR_NOUVEL_EMPLOI' })).toContain('préavis de licenciement');
        expect((0, decompte_final_1.motifRefusDecompte)({ initiative: 'EMPLOYEUR', motif: 'LICENCIEMENT', typeContrat: 'DUREE_DETERMINEE', executionPreavis: 'DEPART_A_MI_PREAVIS' })).toContain('préavis de licenciement');
    });
});
describe('A9 · M2, M8 · refus nommés', () => {
    it('nomme le champ quand une ventilation vise un préavis qui ne porte aucun avantage', () => {
        const { refus } = (0, decompte_final_emis_1.elementsDuDecompte)((0, decompte_final_1.decompteFinal)(MI_PREAVIS), [
            { rubrique: 'preavis', nature: 'LOGEMENT_OU_SON_INDEMNITE', libelle: 'Logement', montantFc: 70_000 },
        ]);
        expect(refus.some((m) => m.includes('« Avantages pendant le préavis »'))).toBe(true);
    });
    it("rappelle l'art. 65, al. 3 au travailleur parti avant la moitié", () => {
        expect(decompte_final_1.RESERVE_DEPART_AVANT_LA_MOITIE).toContain('ne pourra se voir imposer aucun délai de préavis');
    });
});
//# sourceMappingURL=decompte-articles-66-67.spec.js.map