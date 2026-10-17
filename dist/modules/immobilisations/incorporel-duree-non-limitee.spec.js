"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const common_1 = require("@nestjs/common");
const incorporel_duree_non_limitee_1 = require("./incorporel-duree-non-limitee");
const immobilisation_service_1 = require("./immobilisation.service");
const compte_seed_syscohada_1 = require("../comptes/compte-seed-syscohada");
const base = { referentiel: 'SYSCOHADA', justification: 'Marque protégée, aucune fin prévisible' };
describe('qui peut être non limité · D-22, D-23', () => {
    it('marque, droit d’exclusivité public, fichier clients, divers · avec justification', () => {
        for (const n of ['21400000', '21280000', '21830000', '21880000']) {
            expect((0, incorporel_duree_non_limitee_1.motifRefusDureeNonLimitee)({ ...base, numeroCompte: n })).toBeNull();
        }
        expect((0, incorporel_duree_non_limitee_1.motifRefusDureeNonLimitee)({ ...base, numeroCompte: '21400000', justification: ' ' })).toMatch(/démontrer|Démontrez/);
    });
    it('le fonds commercial est présumé non limité · sans justification', () => {
        expect((0, incorporel_duree_non_limitee_1.motifRefusDureeNonLimitee)({ referentiel: 'SYSCOHADA', numeroCompte: '21500000' })).toBeNull();
        expect(incorporel_duree_non_limitee_1.JUSTIFICATION_PRESUMEE_FONDS_COMMERCIAL).toMatch(/§ 7.2.2.1/);
    });
    it('ce que le texte fait amortir est refusé, chacun avec son passage', () => {
        for (const [n, re] of [
            ['21100000', /§ 2.2.2/],
            ['21210000', /§ 1.1.3/],
            ['21220000', /§ 1.2.3/],
            ['21310000', /§ 2.4/],
            ['21600000', /§ 5.1/],
            ['21820000', /§ 8/],
            ['21910000', /en cours/],
        ]) {
            expect((0, incorporel_duree_non_limitee_1.motifRefusDureeNonLimitee)({ ...base, numeroCompte: n })).toMatch(re);
        }
    });
    it('le site internet s’amortit, sauf le nom de domaine', () => {
        expect((0, incorporel_duree_non_limitee_1.motifRefusDureeNonLimitee)({ ...base, numeroCompte: '21320000' })).toMatch(/nom de domaine/);
        expect((0, incorporel_duree_non_limitee_1.motifRefusDureeNonLimitee)({ ...base, numeroCompte: '21320000', nomDeDomaine: true })).toBeNull();
    });
    it('SYSCOHADA seul, incorporel seul', () => {
        expect((0, incorporel_duree_non_limitee_1.motifRefusDureeNonLimitee)({ ...base, referentiel: 'SYCEBNL', numeroCompte: '21400000' })).toMatch(/SYCEBNL/);
        expect((0, incorporel_duree_non_limitee_1.motifRefusDureeNonLimitee)({ ...base, numeroCompte: '23130000' })).toMatch(/incorporelle \(21\)/);
    });
    it('les comptes nommés existent au semis SYSCOHADA', () => {
        const semis = new Set(compte_seed_syscohada_1.PLAN_COMPTES_SYSCOHADA.map((c) => c.numero));
        const racines = incorporel_duree_non_limitee_1.INCORPORELS_TOUJOURS_AMORTIS.map((e) => e.racine);
        expect(racines.filter((r) => ![...semis].some((n) => n.startsWith(r)))).toEqual([]);
        expect(['21400000', '21500000', '21320000', '21280000'].filter((n) => !semis.has(n))).toEqual([]);
    });
});
describe('dix ans, deux cas du fonds commercial (§ 7.2.2.1)', () => {
    it('fonds commercial, dix ans exactement, SMT pour la simplification', () => {
        expect((0, incorporel_duree_non_limitee_1.motifRefusDureeDixAns)({ numeroCompte: '21500000', fondement: 'NON_ESTIMABLE', dureeAns: 10, systemeMinimal: false })).toBeNull();
        expect((0, incorporel_duree_non_limitee_1.motifRefusDureeDixAns)({ numeroCompte: '21500000', fondement: 'NON_ESTIMABLE', dureeAns: 8, systemeMinimal: false })).toMatch(/dixième/);
        expect((0, incorporel_duree_non_limitee_1.motifRefusDureeDixAns)({ numeroCompte: '21400000', fondement: 'NON_ESTIMABLE', dureeAns: 10, systemeMinimal: false })).toMatch(/215/);
        expect((0, incorporel_duree_non_limitee_1.motifRefusDureeDixAns)({ numeroCompte: '21500000', fondement: 'SIMPLIFICATION_SMT', dureeAns: 10, systemeMinimal: false })).toMatch(/Système minimal/);
        expect((0, incorporel_duree_non_limitee_1.motifRefusDureeDixAns)({ numeroCompte: '21500000', fondement: 'SIMPLIFICATION_SMT', dureeAns: 10, systemeMinimal: true })).toBeNull();
    });
});
describe('bascule prospective (§ 4.2.2)', () => {
    const b = {
        dureeNonLimitee: true,
        enService: true,
        dateDecision: new Date('2026-09-01'),
        debutPossible: new Date('2020-01-01'),
        dureeResiduelleAns: 4,
        testDepreciation: 'Valeur actuelle supérieure à la valeur comptable',
        motif: "Décision d'arrêter la marque au 30 août 2030",
    };
    it('admise avec motif et test de dépréciation', () => {
        expect((0, incorporel_duree_non_limitee_1.motifRefusBascule)(b)).toBeNull();
    });
    it('refus nommés', () => {
        expect((0, incorporel_duree_non_limitee_1.motifRefusBascule)({ ...b, dureeNonLimitee: false })).toMatch(/déjà limitée/);
        expect((0, incorporel_duree_non_limitee_1.motifRefusBascule)({ ...b, testDepreciation: '' })).toMatch(/test de dépréciation/);
        expect((0, incorporel_duree_non_limitee_1.motifRefusBascule)({ ...b, motif: '' })).toMatch(/rend la durée limitée/);
        expect((0, incorporel_duree_non_limitee_1.motifRefusBascule)({ ...b, dateDecision: new Date('2019-12-31') })).toMatch(/précède/);
        expect((0, incorporel_duree_non_limitee_1.motifRefusBascule)({ ...b, debutPossible: null })).toMatch(/mise en service/);
        expect((0, incorporel_duree_non_limitee_1.motifRefusBascule)({ ...b, enService: false })).toMatch(/sorti/);
        expect((0, incorporel_duree_non_limitee_1.motifRefusBascule)({ ...b, dureeResiduelleAns: 0 })).toMatch(/une au moins/);
    });
    it('le plan part de la bascule, sinon de la mise en service', () => {
        expect((0, incorporel_duree_non_limitee_1.debutAmortissement)({ dateDebutAmortissement: new Date('2026-09-01'), dateMiseEnService: new Date('2020-01-01') })).toEqual(new Date('2026-09-01'));
        expect((0, incorporel_duree_non_limitee_1.debutAmortissement)({ dateDebutAmortissement: null, dateMiseEnService: new Date('2020-01-01') })).toEqual(new Date('2020-01-01'));
    });
    it('exemple du texte · quatre ans à compter du 1er septembre, quatre mois la première année', () => {
        const svc = new immobilisation_service_1.ImmobilisationService({}, {});
        const calculer = svc.calculerDotation.bind(svc);
        const exercice = { dateDebut: new Date('2026-01-01'), dateFin: new Date('2026-12-31') };
        expect(calculer(12_000_000, 0, 4, new Date('2026-09-01'), [], exercice, 0, 0)).toBeCloseTo(1_000_000, 2);
        expect(calculer(12_000_000, 0, 4, new Date('2026-09-01'), [], exercice, 0, 2_400_000)).toBeCloseTo(800_000, 2);
    });
});
describe('le service · durée de l’incorporel à la création', () => {
    function monter(numero, referentiel = 'SYSCOHADA', systeme = 'NORMAL') {
        const prisma = {
            tenant: { findUniqueOrThrow: jest.fn().mockResolvedValue({ referentiel, systemeComptableSyscohada: systeme, jeuEtatsFinanciersSycebnl: null }) },
            compte: { findFirst: jest.fn().mockResolvedValue({ numero }) },
        };
        const svc = new immobilisation_service_1.ImmobilisationService(prisma, {});
        const duree = (dto) => svc.dureeIncorporel('t', { compteImmobilisationId: 'c', ...dto });
        return { duree };
    }
    it('fonds commercial sans durée · présumé non limité', async () => {
        await expect(monter('21500000').duree({})).resolves.toEqual({
            dureeNonLimitee: true,
            justification: incorporel_duree_non_limitee_1.JUSTIFICATION_PRESUMEE_FONDS_COMMERCIAL,
            fondementDureeDixAns: null,
        });
        await expect(monter('21500000').duree({ dureeAmortissementAns: 7 })).resolves.toMatchObject({ dureeNonLimitee: false });
    });
    it('marque déclarée non limitée, refusée au SYCEBNL et sans justification', async () => {
        await expect(monter('21400000').duree({ dureeNonLimitee: true, justificationDureeNonLimitee: 'Protégée' })).resolves.toMatchObject({ dureeNonLimitee: true, justification: 'Protégée' });
        await expect(monter('21400000').duree({ dureeNonLimitee: true })).rejects.toThrow(common_1.BadRequestException);
        await expect(monter('21400000', 'SYCEBNL').duree({ dureeNonLimitee: true, justificationDureeNonLimitee: 'x' })).rejects.toThrow(/SYCEBNL/);
        await expect(monter('21310000').duree({ dureeNonLimitee: true, justificationDureeNonLimitee: 'x' })).rejects.toThrow(/logiciel/);
    });
    it('dix ans · fonds commercial seulement, simplification au SMT', async () => {
        await expect(monter('21500000').duree({ fondementDureeDixAns: 'NON_ESTIMABLE', dureeAmortissementAns: 10 })).resolves.toMatchObject({ fondementDureeDixAns: 'NON_ESTIMABLE' });
        await expect(monter('21500000').duree({ fondementDureeDixAns: 'SIMPLIFICATION_SMT', dureeAmortissementAns: 10 })).rejects.toThrow(/Système minimal/);
        await expect(monter('21500000', 'SYSCOHADA', 'MINIMAL_TRESORERIE').duree({ fondementDureeDixAns: 'SIMPLIFICATION_SMT', dureeAmortissementAns: 10 })).resolves.toMatchObject({ fondementDureeDixAns: 'SIMPLIFICATION_SMT' });
    });
    it('un bien corporel n’est pas touché', async () => {
        await expect(monter('24410000').duree({ dureeAmortissementAns: 5 })).resolves.toMatchObject({ dureeNonLimitee: false });
    });
});
//# sourceMappingURL=incorporel-duree-non-limitee.spec.js.map