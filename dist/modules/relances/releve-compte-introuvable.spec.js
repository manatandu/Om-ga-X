"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const common_1 = require("@nestjs/common");
const relances_service_1 = require("./relances.service");
function doublure(compteDuDossier) {
    const appels = [];
    const wheres = [];
    const prisma = new Proxy({}, {
        get: (_c, modele) => new Proxy({}, {
            get: (_m, operation) => async (args) => {
                appels.push(`${String(modele)}.${String(operation)}`);
                if (modele === 'compte' && operation === 'findFirst') {
                    wheres.push(args.where);
                    return compteDuDossier ? { id: 'c-411' } : null;
                }
                throw new Error(`lecture inattendue ${String(modele)}.${String(operation)}`);
            },
        }),
    });
    return { svc: new relances_service_1.RelancesService(prisma, {}), appels, wheres };
}
describe('relevé · le compte d’un autre dossier est introuvable (C3)', () => {
    it('refuse en 404 nommé, sans lire aucune position', async () => {
        const { svc, appels, wheres } = doublure(false);
        const refus = await svc.releve('dossier-a', 'compte-du-dossier-b', 'exercice-a').catch((e) => e);
        expect(refus).toBeInstanceOf(common_1.NotFoundException);
        expect(refus.message).toBe(relances_service_1.MOTIF_COMPTE_INTROUVABLE_RELEVE);
        expect(wheres).toEqual([{ id: 'compte-du-dossier-b', tenantId: 'dossier-a' }]);
        expect(appels).toEqual(['compte.findFirst']);
    });
    it('le compte du dossier passe le contrôle et va jusqu’aux positions (le témoin n’est pas muet)', async () => {
        const { svc, appels } = doublure(true);
        await svc.releve('dossier-a', 'c-411', 'exercice-a').catch(() => undefined);
        expect(appels[0]).toBe('compte.findFirst');
        expect(appels.length).toBeGreaterThan(1);
    });
});
//# sourceMappingURL=releve-compte-introuvable.spec.js.map