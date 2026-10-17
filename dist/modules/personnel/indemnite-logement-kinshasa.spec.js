"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const indemnite_logement_kinshasa_1 = require("./indemnite-logement-kinshasa");
describe('Passe F11 · indemnité de logement et relevé à la DGRK', () => {
    const indemnite = [{ nature: 'LOGEMENT_OU_SON_INDEMNITE', montantFc: 300_000 }];
    it('servie à un siège de Kinshasa qui verse une indemnité, depuis janvier 2024', () => {
        expect((0, indemnite_logement_kinshasa_1.reserveIndemniteLogementKinshasa)(indemnite, 'Kinshasa / Gombe', '2026-03')).toBe(indemnite_logement_kinshasa_1.RESERVE_INDEMNITE_LOGEMENT_KINSHASA);
        expect(indemnite_logement_kinshasa_1.RESERVE_INDEMNITE_LOGEMENT_KINSHASA).toMatch(/dix jours du paiement/);
        expect(indemnite_logement_kinshasa_1.RESERVE_INDEMNITE_LOGEMENT_KINSHASA).toContain('art. 4, al. 2');
        expect(indemnite_logement_kinshasa_1.RESERVE_INDEMNITE_LOGEMENT_KINSHASA).toMatch(/100 USD par jour/);
        expect(indemnite_logement_kinshasa_1.RESERVE_INDEMNITE_LOGEMENT_KINSHASA).toMatch(/dû par le bénéficiaire/);
    });
    it('rien ailleurs, rien avant 2024, rien pour un logement en nature ou sans indemnité', () => {
        expect((0, indemnite_logement_kinshasa_1.reserveIndemniteLogementKinshasa)(indemnite, 'Lubumbashi', '2026-03')).toBeNull();
        expect((0, indemnite_logement_kinshasa_1.reserveIndemniteLogementKinshasa)(indemnite, null, '2026-03')).toBeNull();
        expect((0, indemnite_logement_kinshasa_1.reserveIndemniteLogementKinshasa)(indemnite, 'Kinshasa', '2023-12')).toBeNull();
        expect((0, indemnite_logement_kinshasa_1.reserveIndemniteLogementKinshasa)([{ ...indemnite[0], enNature: true }], 'Kinshasa', '2026-03')).toBeNull();
        expect((0, indemnite_logement_kinshasa_1.reserveIndemniteLogementKinshasa)([{ nature: 'SALAIRE_OU_TRAITEMENT', montantFc: 1 }], 'Kinshasa', '2026-03')).toBeNull();
    });
});
//# sourceMappingURL=indemnite-logement-kinshasa.spec.js.map