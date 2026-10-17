"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const common_1 = require("@nestjs/common");
const tiers_service_1 = require("./tiers.service");
const relances_service_1 = require("../relances/relances.service");
const client_1 = require("@prisma/client");
function avecTransaction(p) {
    const avec = p;
    avec.$transaction = (f) => f(avec);
    return avec;
}
function service(referentiel, capture = {}) {
    return new tiers_service_1.TiersService(avecTransaction({
        tenant: { findUniqueOrThrow: async () => ({ referentiel }) },
        tiers: {
            findUnique: async () => null,
            create: async ({ data }) => {
                capture.cree = data;
                return data;
            },
        },
    }));
}
const dto = { code: 'ADH-1', nom: 'Membre', type: client_1.TypeTiers.ADHERENT, creerCompteIndividuel: false };
describe('type de tiers · adhérent réservé au SYCEBNL', () => {
    it('refuse un adhérent sur un dossier SYSCOHADA, sans rien écrire', async () => {
        const capture = {};
        await expect(service(client_1.Referentiel.SYSCOHADA, capture).creer('t1', dto)).rejects.toBeInstanceOf(common_1.BadRequestException);
        await expect(service(client_1.Referentiel.SYSCOHADA).creer('t1', dto)).rejects.toThrow(/SYCEBNL/);
        expect(capture.cree).toBeUndefined();
    });
    it('accepte un adhérent sur un dossier SYCEBNL', async () => {
        const capture = {};
        await service(client_1.Referentiel.SYCEBNL, capture).creer('t1', dto);
        expect(capture.cree).toMatchObject({ type: client_1.TypeTiers.ADHERENT, tenantId: 't1' });
    });
    it('laisse passer les autres types dans les deux référentiels, sans lire le dossier', async () => {
        const capture = {};
        const sansTenant = new tiers_service_1.TiersService(avecTransaction({
            tiers: {
                findUnique: async () => null,
                create: async ({ data }) => {
                    capture.cree = data;
                    return data;
                },
            },
        }));
        await sansTenant.creer('t1', { code: 'CLI-1', nom: 'Client', type: client_1.TypeTiers.CLIENT, creerCompteIndividuel: false });
        expect(capture.cree).toMatchObject({ type: client_1.TypeTiers.CLIENT });
    });
});
describe('qualité du compte 41 dans la liste des relances', () => {
    it('nomme un 411 selon le plan du dossier', () => {
        expect((0, relances_service_1.qualiteDuCompte)('41110000', client_1.Referentiel.SYCEBNL)).toBe('Adhérent');
        expect((0, relances_service_1.qualiteDuCompte)('41110000', client_1.Referentiel.SYSCOHADA)).toBe('Client');
    });
    it('ne présente pas un effet à recevoir comme un client-usager en retard', () => {
        expect((0, relances_service_1.qualiteDuCompte)('41210000', client_1.Referentiel.SYCEBNL)).toBe('Client-usager');
        expect((0, relances_service_1.qualiteDuCompte)('41210000', client_1.Referentiel.SYSCOHADA)).toBe('Effet à recevoir');
    });
    it('nomme le client créditeur du plan SYSCOHADA, qui n’est pas un retard non plus', () => {
        expect((0, relances_service_1.qualiteDuCompte)('41910000', client_1.Referentiel.SYSCOHADA)).toBe('Client créditeur');
    });
    it('retombe sur « Tiers » pour tout autre compte', () => {
        expect((0, relances_service_1.qualiteDuCompte)('40110000', client_1.Referentiel.SYCEBNL)).toBe('Tiers');
        expect((0, relances_service_1.qualiteDuCompte)('47810000', client_1.Referentiel.SYSCOHADA)).toBe('Tiers');
    });
});
//# sourceMappingURL=adherent-referentiel.spec.js.map