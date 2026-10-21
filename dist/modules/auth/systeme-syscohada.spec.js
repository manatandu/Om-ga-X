"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const auth_service_1 = require("./auth.service");
describe('AuthService.register · système comptable par référentiel', () => {
    function service() {
        const creations = [];
        const s = new auth_service_1.AuthService({
            user: { findUnique: async () => null },
            $transaction: async (fn) => fn({ user: { create: async () => ({ id: 'u1' }) } }),
        }, { sign: () => 'jeton' }, {
            creerTenant: async (params) => {
                creations.push(params);
                return { id: 't1', nom: params.nom, referentiel: params.referentiel };
            },
        }, { seedPlan: async () => undefined }, { creerExerciceCourant: async () => ({ id: 'ex1' }) }, { seedJournauxDefaut: async () => undefined }, { seedTauxDefaut: async () => undefined }, { seedFamillesDefaut: async () => undefined }, { seedPlansDefaut: async () => undefined }, { seedNiveauxDefaut: async () => undefined });
        return { s, creations };
    }
    const base = { nomEntite: 'X', email: 'a@b.cd', motDePasse: 'motdepasse12' };
    it('retient le système demandé pour un dossier SYSCOHADA, et aucun jeu SYCEBNL', async () => {
        const { s, creations } = service();
        await s.register({
            ...base,
            referentiel: client_1.Referentiel.SYSCOHADA,
            systemeComptableSyscohada: client_1.SystemeComptableSyscohada.MINIMAL_TRESORERIE,
            jeuEtatsFinanciersSycebnl: 'PROJETS_DEVELOPPEMENT',
        });
        expect(creations[0].systemeComptableSyscohada).toBe(client_1.SystemeComptableSyscohada.MINIMAL_TRESORERIE);
        expect(creations[0].jeuEtatsFinanciersSycebnl).toBeUndefined();
    });
    it('retient le Système normal par défaut · régime de droit commun de l’art. 11', async () => {
        const { s, creations } = service();
        await s.register({ ...base, referentiel: client_1.Referentiel.SYSCOHADA });
        expect(creations[0].systemeComptableSyscohada).toBe(client_1.SystemeComptableSyscohada.NORMAL);
    });
    it('ne pose aucun système sur un dossier SYCEBNL, même si le client en envoie un', async () => {
        const { s, creations } = service();
        await s.register({
            ...base,
            referentiel: client_1.Referentiel.SYCEBNL,
            jeuEtatsFinanciersSycebnl: 'SYSTEME_MINIMAL_TRESORERIE',
            systemeComptableSyscohada: client_1.SystemeComptableSyscohada.MINIMAL_TRESORERIE,
        });
        expect(creations[0].systemeComptableSyscohada).toBeUndefined();
        expect(creations[0].jeuEtatsFinanciersSycebnl).toBe('SYSTEME_MINIMAL_TRESORERIE');
    });
});
//# sourceMappingURL=systeme-syscohada.spec.js.map