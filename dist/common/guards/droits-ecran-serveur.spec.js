"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("reflect-metadata");
const fs_1 = require("fs");
const path_1 = require("path");
const constants_1 = require("@nestjs/common/constants");
const common_1 = require("@nestjs/common");
const acces_roles_cantonnes_decorator_1 = require("../decorators/acces-roles-cantonnes.decorator");
const etats_personnalises_controller_1 = require("../../modules/etats-personnalises/etats-personnalises.controller");
const simulations_controller_1 = require("../../modules/simulations/simulations.controller");
const RACINE_CLIENT = (0, path_1.join)(__dirname, '../../../client/src/pages');
const PAIRES = [
    ['EtatsPersonnalisesPage.tsx', etats_personnalises_controller_1.EtatsPersonnalisesController],
    ['SimulationsBudgetairesPage.tsx', simulations_controller_1.SimulationsController],
];
const ECRITURES = new Set([common_1.RequestMethod.POST, common_1.RequestMethod.PUT, common_1.RequestMethod.PATCH, common_1.RequestMethod.DELETE]);
describe('droits de l’écran et de la route', () => {
    it.each(PAIRES)('%s lit peutValider', (page) => {
        const source = (0, fs_1.readFileSync)((0, path_1.join)(RACINE_CLIENT, page), 'utf8');
        expect(source).toMatch(/const \{[^}]*\bpeutValider\b[^}]*\} = useAuth\(\);/);
    });
    it.each(PAIRES)('les routes d’écriture derrière %s refusent les rôles cantonnés', (_page, controleur) => {
        const proto = controleur.prototype;
        const routes = Object.getOwnPropertyNames(proto)
            .filter((n) => n !== 'constructor')
            .map((n) => ({ n, f: proto[n] }))
            .filter(({ f }) => ECRITURES.has(Reflect.getMetadata(constants_1.METHOD_METADATA, f)));
        expect(routes.length).toBe(3);
        for (const { n, f } of routes) {
            expect([n, Reflect.getMetadata(acces_roles_cantonnes_decorator_1.CLE_ACCES_ROLES_CANTONNES, f)]).toEqual([
                n,
                { aideComptable: false, gestionnairePaie: false },
            ]);
        }
    });
});
//# sourceMappingURL=droits-ecran-serveur.spec.js.map