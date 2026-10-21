"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const ecriture_service_1 = require("../comptabilite/ecriture.service");
const virements_mise_en_service_1 = require("./virements-mise-en-service");
describe('EcritureService.virementsDeMiseEnService', () => {
    function serviceAvec(groupes) {
        const groupBy = jest.fn().mockResolvedValue(groupes);
        const prisma = { ligneEcriture: { groupBy } };
        const service = new ecriture_service_1.EcritureService(prisma, {}, {}, {});
        return { service, groupBy };
    }
    it('ne retient que les écritures qu’une fiche désigne, au livre-journal, hors report à-nouveau', async () => {
        const { service, groupBy } = serviceAvec([
            { compteId: 'c231', _sum: { debit: '50000000', credit: '0' } },
            { compteId: 'c239', _sum: { debit: null, credit: '50000000' } },
        ]);
        const virements = await service.virementsDeMiseEnService('t1', 'e1');
        const { where, by } = groupBy.mock.calls[0][0];
        expect(by).toEqual(['compteId']);
        expect(where.ecriture.immobilisationMiseEnService).toEqual({ isNot: null });
        expect(where.ecriture.tenantId).toBe('t1');
        expect(where.ecriture.exerciceId).toBe('e1');
        expect(where.ecriture.statut).toBe(client_1.StatutEcriture.VALIDEE);
        expect(where.ecriture.estGenereeParCloture).toBe(false);
        expect(where.ecriture.libelle).toBeUndefined();
        expect(virements.get('c231')).toEqual({ debit: 50_000_000, credit: 0 });
        expect(virements.get('c239')).toEqual({ debit: 0, credit: 50_000_000 });
    });
    it('sans exercice (pas de N-1), aucun virement et aucune lecture', async () => {
        const { service, groupBy } = serviceAvec([]);
        expect(await service.virementsDeMiseEnService('t1', null)).toBe(virements_mise_en_service_1.AUCUN_VIREMENT);
        expect(groupBy).not.toHaveBeenCalled();
    });
});
describe('EcritureService.mouvementsDeReevaluation (lot 14)', () => {
    it('ne retient que l’écriture que l’opération de réévaluation désigne, au livre-journal, bornée à la date d’arrêté', async () => {
        const groupBy = jest.fn().mockResolvedValue([{ compteId: 'c241', _sum: { debit: '400', credit: null } }]);
        const service = new ecriture_service_1.EcritureService({ ligneEcriture: { groupBy } }, {}, {}, {});
        const lus = await service.mouvementsDeReevaluation('t1', 'e1', new Date('2026-06-30T00:00:00Z'));
        const { where } = groupBy.mock.calls[0][0];
        expect(where.ecriture.reevaluationBilan).toEqual({ isNot: null });
        expect(where.ecriture.immobilisationMiseEnService).toBeUndefined();
        expect(where.ecriture.statut).toBe(client_1.StatutEcriture.VALIDEE);
        expect(where.ecriture.estGenereeParCloture).toBe(false);
        expect(where.ecriture.date).toEqual({ lte: new Date('2026-06-30T00:00:00Z') });
        expect(lus.get('c241')).toEqual({ debit: 400, credit: 0 });
        await service.mouvementsDeReevaluation('t1', 'e1');
        expect(groupBy.mock.calls[1][0].where.ecriture.date).toBeUndefined();
    });
});
describe('EcritureService.mouvementsDeCoutsEmpruntIncorpores (ligne A22)', () => {
    it('ne retient que les écritures qu’une incorporation désigne, au livre-journal, hors report à-nouveau', async () => {
        const groupBy = jest.fn().mockResolvedValue([{ compteId: 'c239', _sum: { debit: '1000000', credit: null } }]);
        const service = new ecriture_service_1.EcritureService({ ligneEcriture: { groupBy } }, {}, {}, {});
        const lus = await service.mouvementsDeCoutsEmpruntIncorpores('t1', 'e1');
        const { where } = groupBy.mock.calls[0][0];
        expect(where.ecriture.coutEmpruntIncorpore).toEqual({ isNot: null });
        expect(where.ecriture.reevaluationBilan).toBeUndefined();
        expect(where.ecriture.tenantId).toBe('t1');
        expect(where.ecriture.exerciceId).toBe('e1');
        expect(where.ecriture.statut).toBe(client_1.StatutEcriture.VALIDEE);
        expect(where.ecriture.estGenereeParCloture).toBe(false);
        expect(lus.get('c239')).toEqual({ debit: 1_000_000, credit: 0 });
        expect(await service.mouvementsDeCoutsEmpruntIncorpores('t1', null)).toBe(virements_mise_en_service_1.AUCUN_VIREMENT);
    });
});
describe('virementsDesLignes', () => {
    it('cumule les virements des seuls comptes d’une rubrique, débit et crédit à part', () => {
        const virements = new Map([
            ['c231', { debit: 50, credit: 0 }],
            ['c2391', { debit: 0, credit: 50 }],
            ['c241', { debit: 7, credit: 0 }],
        ]);
        expect((0, virements_mise_en_service_1.virementsDesLignes)([{ compteId: 'c231' }, { compteId: 'c2391' }], virements)).toEqual({ debit: 50, credit: 50 });
        expect((0, virements_mise_en_service_1.virementsDesLignes)([{ compteId: 'c241' }], virements)).toEqual({ debit: 7, credit: 0 });
        expect((0, virements_mise_en_service_1.virementsDesLignes)([{ compteId: 'c22' }], virements)).toEqual({ debit: 0, credit: 0 });
    });
});
//# sourceMappingURL=virements-mise-en-service.spec.js.map