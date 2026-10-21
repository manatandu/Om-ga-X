"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const report_tentatives_1 = require("./report-tentatives");
const MINUTE = 60_000;
const REFERENCE = new Date('2026-09-14T08:00:00.000Z');
describe('reprise sur échec · plafond et report', () => {
    it('le report CROÎT à chaque échec, il ne se répète pas', () => {
        const reports = [1, 2, 3, 4].map((n) => (0, report_tentatives_1.attenteApresEchec)(n));
        expect(reports).toEqual([5 * MINUTE, 15 * MINUTE, 60 * MINUTE, 240 * MINUTE]);
        for (let i = 1; i < reports.length; i += 1) {
            expect(reports[i]).toBeGreaterThan(reports[i - 1]);
        }
    });
    it('les quatre reports cumulés couvrent bien les 5 h 20 annoncées', () => {
        const cumul = report_tentatives_1.ATTENTES_MINUTES.reduce((t, m) => t + m, 0);
        expect(cumul).toBe(5 * 60 + 20);
        expect(report_tentatives_1.ATTENTES_MINUTES).toHaveLength(report_tentatives_1.PLAFOND_TENTATIVES - 1);
    });
    it('la quatrième tentative laisse un ECHEC daté, la cinquième ABANDONNE', () => {
        expect((0, report_tentatives_1.statutApresEchec)(4)).toBe(client_1.StatutMessage.ECHEC);
        expect((0, report_tentatives_1.prochainEssaiApresEchec)(4, REFERENCE)).toEqual(new Date('2026-09-14T12:00:00.000Z'));
        expect((0, report_tentatives_1.statutApresEchec)(report_tentatives_1.PLAFOND_TENTATIVES)).toBe(client_1.StatutMessage.ABANDONNE);
        expect((0, report_tentatives_1.prochainEssaiApresEchec)(report_tentatives_1.PLAFOND_TENTATIVES, REFERENCE)).toBeNull();
        expect((0, report_tentatives_1.attenteApresEchec)(report_tentatives_1.PLAFOND_TENTATIVES)).toBeNull();
    });
    it('le premier échec reporte de cinq minutes, pas plus', () => {
        expect((0, report_tentatives_1.prochainEssaiApresEchec)(1, REFERENCE)).toEqual(new Date('2026-09-14T08:05:00.000Z'));
    });
    it('un compte de tentatives incohérent ne date rien plutôt que de dater n’importe quoi', () => {
        expect((0, report_tentatives_1.attenteApresEchec)(0)).toBeNull();
        expect((0, report_tentatives_1.attenteApresEchec)(-3)).toBeNull();
        expect((0, report_tentatives_1.statutApresEchec)(report_tentatives_1.PLAFOND_TENTATIVES + 7)).toBe(client_1.StatutMessage.ABANDONNE);
    });
});
//# sourceMappingURL=report-tentatives.spec.js.map