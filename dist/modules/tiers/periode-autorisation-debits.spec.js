"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const tiers_service_1 = require("./tiers.service");
function avecTransaction(p) {
    const avec = p;
    avec.$transaction = (f) => f(avec);
    return avec;
}
function service(capture, enregistre = {}) {
    return new tiers_service_1.TiersService(avecTransaction({
        tenant: { findUnique: async () => ({ id: 'd1', referentiel: 'SYSCOHADA', dossierMereId: null }) },
        tiers: {
            findUnique: async () => null,
            findFirst: async () => ({
                id: 'ti1',
                tenantId: 'd1',
                dateEffetAutorisationDebits: null,
                dateRevocationAutorisationDebits: null,
                ...enregistre,
            }),
            create: async ({ data }) => {
                capture.cree = data;
                return data;
            },
            update: async (args) => {
                capture.modifie = args;
                return args;
            },
        },
    }));
}
const base = { code: 'F-1', nom: 'Gardiennage Kivu', type: client_1.TypeTiers.FOURNISSEUR, creerCompteIndividuel: false };
describe('fiche du tiers · période de l’autorisation aux débits', () => {
    it('à la création, les deux dates arrivent en base comme des dates', async () => {
        const capture = {};
        await service(capture).creer('d1', {
            ...base,
            autoriseTvaDebits: true,
            dateEffetAutorisationDebits: '2026-01-15',
            dateRevocationAutorisationDebits: '2026-09-01',
        });
        expect(capture.cree.dateEffetAutorisationDebits).toEqual(new Date('2026-01-15'));
        expect(capture.cree.dateRevocationAutorisationDebits).toEqual(new Date('2026-09-01'));
    });
    it('à la création, une révocation qui précède la date d’effet est refusée, sans rien écrire', async () => {
        const capture = {};
        await expect(service(capture).creer('d1', {
            ...base,
            autoriseTvaDebits: true,
            dateEffetAutorisationDebits: '2026-06-01',
            dateRevocationAutorisationDebits: '2026-05-01',
        })).rejects.toBeInstanceOf(common_1.BadRequestException);
        expect(capture.cree).toBeUndefined();
    });
    it('une révocation saisie SEULE se confronte à la date d’effet enregistrée', async () => {
        const capture = {};
        await expect(service(capture, { dateEffetAutorisationDebits: new Date('2026-06-01') }).modifier('d1', 'ti1', {
            dateRevocationAutorisationDebits: '2026-05-01',
        })).rejects.toThrow('art. 63');
        expect(capture.modifie).toBeUndefined();
    });
    it('une date vide ou null s’efface, une date absente reste inchangée', async () => {
        const capture = {};
        await service(capture).modifier('d1', 'ti1', { dateEffetAutorisationDebits: '', dateRevocationAutorisationDebits: null });
        expect(capture.modifie.data).toMatchObject({ dateEffetAutorisationDebits: null, dateRevocationAutorisationDebits: null });
        const autre = {};
        await service(autre).modifier('d1', 'ti1', { nom: 'Autre' });
        expect('dateEffetAutorisationDebits' in autre.modifie.data).toBe(false);
    });
    it('un jour absent du calendrier est refusé, jamais reporté', async () => {
        await expect(service({}).modifier('d1', 'ti1', { dateEffetAutorisationDebits: '2026-02-30' })).rejects.toBeInstanceOf(common_1.BadRequestException);
    });
});
//# sourceMappingURL=periode-autorisation-debits.spec.js.map