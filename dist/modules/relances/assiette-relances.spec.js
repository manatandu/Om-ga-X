"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const relances_service_1 = require("./relances.service");
const sansCourrier = () => ({ mettreEnFile: jest.fn() });
function service(referentiel) {
    const findMany = jest.fn().mockResolvedValue([]);
    const prisma = {
        tenant: { findUniqueOrThrow: jest.fn().mockResolvedValue({ referentiel }) },
        ligneEcriture: { findMany },
        niveauRelance: { findMany: jest.fn().mockResolvedValue([]) },
        relance: { findMany: jest.fn().mockResolvedValue([]) },
    };
    return { svc: new relances_service_1.RelancesService(prisma, sansCourrier()), findMany };
}
async function racinesInterrogees(referentiel, racine) {
    const { svc, findMany } = service(referentiel);
    await svc.positions('t1', { exerciceId: 'ex', racine });
    const ou = findMany.mock.calls[0][0].where.OR;
    return ou.map((c) => c.compte.numero.startsWith).sort();
}
describe('Assiette des rappels', () => {
    it('ne relance pas un effet accepté, un effet escompté ni un produit à recevoir (SYSCOHADA)', async () => {
        const racines = await racinesInterrogees(client_1.Referentiel.SYSCOHADA);
        expect(racines).toEqual(['411', '413', '416']);
        for (const exclu of ['412', '415', '418', '419']) {
            expect(racines).not.toContain(exclu);
        }
    });
    it('relance les adhérents ET les clients-usagers en SYCEBNL', async () => {
        const racines = await racinesInterrogees(client_1.Referentiel.SYCEBNL);
        expect(racines).toEqual(['411', '412', '413', '416']);
        for (const exclu of ['418', '419']) {
            expect(racines).not.toContain(exclu);
        }
    });
    it('n’interroge JAMAIS la racine 41 entière, dans aucun référentiel', async () => {
        for (const r of [client_1.Referentiel.SYCEBNL, client_1.Referentiel.SYSCOHADA]) {
            expect(await racinesInterrogees(r)).not.toContain('41');
        }
    });
    it('obéit à la racine demandée explicitement · le relevé fournisseur', async () => {
        expect(await racinesInterrogees(client_1.Referentiel.SYSCOHADA, '40')).toEqual(['40']);
    });
    it('ne relance jamais une simulation · une facture d’un journal de situation n’est pas due (relecture B1)', async () => {
        for (const r of [client_1.Referentiel.SYCEBNL, client_1.Referentiel.SYSCOHADA]) {
            const { svc, findMany } = service(r);
            await svc.positions('t1', { exerciceId: 'ex' });
            expect(findMany.mock.calls[0][0].where.ecriture).toEqual({ tenantId: 't1', exerciceId: 'ex', statut: { not: 'SITUATION' } });
        }
    });
    it('la table couvre les deux référentiels, sans trou', () => {
        expect(Object.keys(relances_service_1.RACINES_RELANCABLES).sort()).toEqual(['SYCEBNL', 'SYSCOHADA']);
        for (const liste of Object.values(relances_service_1.RACINES_RELANCABLES)) {
            expect(liste.length).toBeGreaterThan(0);
            expect(liste.every((r) => /^41\d$/.test(r))).toBe(true);
        }
    });
});
//# sourceMappingURL=assiette-relances.spec.js.map