"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const compte_seed_1 = require("../comptes/compte-seed");
const compte_seed_syscohada_1 = require("../comptes/compte-seed-syscohada");
const virement_resultat_non_affecte_1 = require("./virement-resultat-non-affecte");
const c = (id, numero, debit, credit, mode = 'SOLDE') => ({
    id,
    numero,
    intitule: numero,
    modeReportANouveau: mode,
    sommes: { debit, credit, enDevise: [] },
});
describe('Virement du résultat non affecté · les comptes de destination', () => {
    it('chaque destination est un compte de détail SEMÉ, sous le 12 (ou le 103 de l’entité individuelle SYSCOHADA)', () => {
        const syscohada = (0, virement_resultat_non_affecte_1.destinationsDuVirement)('SYSCOHADA', false);
        const sycebnl = (0, virement_resultat_non_affecte_1.destinationsDuVirement)('SYCEBNL', false);
        const individuelle = (0, virement_resultat_non_affecte_1.destinationsDuVirement)('SYSCOHADA', true);
        const semeSyscohada = (n) => compte_seed_syscohada_1.PLAN_COMPTES_SYSCOHADA.find((x) => x.numero === n);
        const semeSycebnl = (n) => compte_seed_1.PLAN_COMPTES_SYCEBNL.find((x) => x.numero === n);
        expect(semeSyscohada(syscohada.credit)?.intitule).toBe('Report à nouveau créditeur');
        expect(semeSyscohada(syscohada.debit)?.intitule).toBe('Perte nette à reporter');
        expect(semeSycebnl(sycebnl.credit)?.intitule).toBe('Report à nouveau des excédents');
        expect(semeSycebnl(sycebnl.debit)?.intitule).toBe('Report à nouveau des déficits');
        expect(semeSyscohada(individuelle.credit)?.intitule).toBe('Capital personnel');
        expect((0, virement_resultat_non_affecte_1.destinationsDuVirement)('SYCEBNL', true)).toEqual(sycebnl);
    });
});
describe('Virement du résultat non affecté · le calcul', () => {
    const ids = { '12100000': 'r121', '12910000': 'r1291', '10300000': 'r103' };
    const id = (n) => ids[n];
    it('une perte de 46 072 000 au 139 · C 139, D 12910000', () => {
        const v = (0, virement_resultat_non_affecte_1.virementResultatNonAffecte)([c('139', '13900000', 46_072_000, 0), c('601', '60110000', 9, 0, 'AUCUN')], (0, virement_resultat_non_affecte_1.destinationsDuVirement)('SYSCOHADA', false), id);
        expect(v.montant).toBe(-46_072_000);
        expect(v.compteDestination).toBe('12910000');
        expect(v.lignes).toEqual([
            expect.objectContaining({ compteId: '139', debit: 0, credit: 46_072_000 }),
            expect.objectContaining({ compteId: 'r1291', debit: 46_072_000, credit: 0 }),
        ]);
    });
    it('un 13 soldé par l’affectation · rien à virer', () => {
        const v = (0, virement_resultat_non_affecte_1.virementResultatNonAffecte)([c('139', '13900000', 46_072_000, 46_072_000)], (0, virement_resultat_non_affecte_1.destinationsDuVirement)('SYSCOHADA', false), id);
        expect(v).toEqual({ montant: 0, lignes: [], compteDestination: null });
    });
    it('entité individuelle · au 103', () => {
        const v = (0, virement_resultat_non_affecte_1.virementResultatNonAffecte)([c('131', '13100000', 0, 5_000)], (0, virement_resultat_non_affecte_1.destinationsDuVirement)('SYSCOHADA', true), id);
        expect(v.compteDestination).toBe('10300000');
        expect(v.lignes[1]).toEqual(expect.objectContaining({ compteId: 'r103', credit: 5_000 }));
    });
    it('compte de destination absent du plan · refus nommé, jamais un virement sans contrepartie', () => {
        expect(() => (0, virement_resultat_non_affecte_1.virementResultatNonAffecte)([c('139', '13900000', 10, 0)], (0, virement_resultat_non_affecte_1.destinationsDuVirement)('SYSCOHADA', false), () => undefined)).toThrow(/12910000/);
    });
    it('fondu dans un report déjà calculé · 139 de 57 672 000 devient 11 600 000, le 12910000 reçoit 46 072 000', () => {
        const report = [{ compteId: '139', debit: 57_672_000, credit: 0, libelle: 'R' }];
        const v = (0, virement_resultat_non_affecte_1.virementResultatNonAffecte)([c('139', '13900000', 46_072_000, 0)], (0, virement_resultat_non_affecte_1.destinationsDuVirement)('SYSCOHADA', false), id);
        expect((0, virement_resultat_non_affecte_1.appliquerVirementAuReport)(report, v.lignes)).toEqual([
            expect.objectContaining({ compteId: '139', debit: 11_600_000, credit: 0 }),
            expect.objectContaining({ compteId: 'r1291', debit: 46_072_000, credit: 0 }),
        ]);
    });
});
describe('Bilan à la clôture · l’écart que le virement n’explique pas', () => {
    it('le bilan 2027 de la simulation · la perte 2026 non affectée est LUE au bilan, aucun écart admis (passe V1, B1)', () => {
        expect((0, virement_resultat_non_affecte_1.ecartInexpliqueDuBilan)({ totalActif: 165_828_000, totalPassif: 165_828_000, controle: { resultatClasses678: -11_600_000, resultatCompte13: -46_072_000 } }, -46_072_000)).toBe(0);
        expect((0, virement_resultat_non_affecte_1.ecartInexpliqueDuBilan)({ totalActif: 165_828_000, totalPassif: 211_900_000, controle: { resultatClasses678: -11_600_000, resultatCompte13: -46_072_000 } }, -46_072_000)).toBe(-46_072_000);
    });
    it('avant clôture, seule la part du 13 que l\'état ne lit pas (le 130 du SYSCOHADA) est attendue', () => {
        expect((0, virement_resultat_non_affecte_1.ecartInexpliqueDuBilan)({ totalActif: 1_300, totalPassif: 1_000, controle: { resultatClasses678: 50, resultatCompte13: 200 } }, 500)).toBe(0);
    });
    it('un compte non rattaché à un poste · l’écart reste, la clôture le refusera', () => {
        expect((0, virement_resultat_non_affecte_1.ecartInexpliqueDuBilan)({ totalActif: 1_000, totalPassif: 900, controle: { resultatClasses678: 5, resultatCompte13: 0 } }, 0)).toBe(100);
    });
    it('après clôture (classes 6 à 8 soldées), l’état lit le 13 · seule la part non lue est attendue', () => {
        expect((0, virement_resultat_non_affecte_1.ecartInexpliqueDuBilan)({ totalActif: 1_300, totalPassif: 1_000, controle: { resultatClasses678: 0, resultatCompte13: 200 } }, 500)).toBe(0);
    });
    it('un état qui ne dit pas comment il lit son résultat · rien n’est affirmé tant qu’un 13 est ouvert', () => {
        expect((0, virement_resultat_non_affecte_1.ecartInexpliqueDuBilan)({ totalActif: 10, totalPassif: 5 }, 0)).toBe(5);
        expect((0, virement_resultat_non_affecte_1.ecartInexpliqueDuBilan)({ totalActif: 10, totalPassif: 5 }, 3)).toBeNull();
    });
});
//# sourceMappingURL=virement-resultat-non-affecte.spec.js.map