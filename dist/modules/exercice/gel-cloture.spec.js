"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const gel_cloture_1 = require("./gel-cloture");
const od_analytique_service_1 = require("../analytique/od-analytique.service");
const ligne = (date, journalId = 'jACH', exerciceClos = false) => ({
    journalId,
    journalCode: 'ACH',
    date: new Date(date),
    exerciceClos,
});
const cl = (granularite, journalId, dateLimite) => ({
    granularite,
    journalId,
    dateLimite: new Date(dateLimite),
});
describe('motifLigneFigee', () => {
    it('la PARTIELLE ne fige rien · « le lettrage et la ventilation analytique pourront tout de même être effectués »', () => {
        expect((0, gel_cloture_1.motifLigneFigee)(ligne('2026-03-01'), [cl(client_1.GranulariteCloture.PARTIELLE, 'jACH', '2026-12-31')])).toBeNull();
    });
    it('la TOTALE fige les lignes de SON journal jusqu’à sa date limite, pas celles d’un autre journal', () => {
        const totale = [cl(client_1.GranulariteCloture.TOTALE, 'jACH', '2026-12-31')];
        expect((0, gel_cloture_1.motifLigneFigee)(ligne('2026-03-01'), totale)).toMatch(/journal ACH est clôturé totalement/);
        expect((0, gel_cloture_1.motifLigneFigee)(ligne('2026-12-31'), totale)).not.toBeNull();
        expect((0, gel_cloture_1.motifLigneFigee)(ligne('2026-03-01', 'jVTE'), totale)).toBeNull();
    });
    it('une TOTALE de 2026 ne fige pas les lignes de 2027 du même journal', () => {
        expect((0, gel_cloture_1.motifLigneFigee)(ligne('2027-01-01'), [cl(client_1.GranulariteCloture.TOTALE, 'jACH', '2026-12-31')])).toBeNull();
    });
    it('la PÉRIODE fige tous les journaux jusqu’à sa date, et rien après', () => {
        const periode = [cl(client_1.GranulariteCloture.PERIODE, null, '2026-03-31')];
        expect((0, gel_cloture_1.motifLigneFigee)(ligne('2026-03-31', 'jVTE'), periode)).toMatch(/période jusqu'au 2026-03-31/);
        expect((0, gel_cloture_1.motifLigneFigee)(ligne('2026-04-01', 'jVTE'), periode)).toBeNull();
    });
    it('l’exercice clôturé fige tout, clôture de journal ou non', () => {
        expect((0, gel_cloture_1.motifLigneFigee)(ligne('2026-03-01', 'jACH', true), [])).toMatch(/exercice est clôturé/);
    });
});
describe('OD analytique · seule la clôture de période l’atteint', () => {
    function monter(clotures) {
        const prisma = {
            exercice: {
                findFirst: jest.fn(async () => ({ id: 'ex', statut: 'OUVERT', dateDebut: new Date('2026-01-01'), dateFin: new Date('2026-12-31') })),
            },
            odAnalytique: {
                findFirst: jest.fn(async () => ({ id: 'od', date: new Date('2026-02-10'), exercice: { statut: 'OUVERT' } })),
                delete: jest.fn(),
                create: jest.fn(),
            },
            planAnalytique: { findFirst: jest.fn(async () => null) },
            cloture: {
                findMany: jest.fn(async ({ where }) => clotures.filter((c) => c.granularite === where.granularite)),
            },
        };
        return { service: new od_analytique_service_1.OdAnalytiqueService(prisma), prisma };
    }
    const dto = { exerciceId: 'ex', planId: 'p', compteId: 'c', date: '2026-02-10', libelle: 'x', lignes: [] };
    it('refuse de passer ou de retirer une OD datée d’une période close', async () => {
        const { service, prisma } = monter([cl(client_1.GranulariteCloture.PERIODE, null, '2026-03-31')]);
        await expect(service.creer('t', 'u', dto)).rejects.toThrow(/période jusqu'au 2026-03-31/);
        await expect(service.supprimer('t', 'od')).rejects.toThrow(/période jusqu'au 2026-03-31/);
        expect(prisma.odAnalytique.delete).not.toHaveBeenCalled();
    });
    it('une clôture TOTALE de journal ne l’atteint pas · l’OD n’a pas de journal', async () => {
        const { service, prisma } = monter([cl(client_1.GranulariteCloture.TOTALE, 'jACH', '2026-12-31')]);
        await service.supprimer('t', 'od');
        expect(prisma.odAnalytique.delete).toHaveBeenCalled();
    });
});
describe('l’en-tête du lettrage dit ce que le service fait (audit final F63)', () => {
    const source = require('fs').readFileSync(require('path').join(__dirname, '../lettrage/lettrage.service.ts'), 'utf8');
    const entete = source.slice(0, source.indexOf('@Injectable()'));
    it('renvoie à la règle unique, et les quatre gestes l’appellent', () => {
        expect(entete).toContain('`exercice/gel-cloture.ts`');
        for (const geste of ["'lettrer'", "'compléter ce lettrage'", "'délettrer'"]) {
            expect([geste, source.includes(`refuserSiLignesFigees(`) && source.includes(geste)]).toEqual([geste, true]);
        }
    });
});
//# sourceMappingURL=gel-cloture.spec.js.map