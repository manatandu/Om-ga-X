"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = require("fs");
const path_1 = require("path");
const client_1 = require("@prisma/client");
const modules_optionnels_1 = require("./modules-optionnels");
describe('modules activables par dossier', () => {
    it('le catalogue couvre exactement l’énumération du schéma', () => {
        expect([...modules_optionnels_1.MODULES_OPTIONNELS].sort()).toEqual(Object.values(client_1.ModuleOptionnel).sort());
    });
    it('la liste est normalisée dans l’ordre du catalogue, sans doublon', () => {
        expect((0, modules_optionnels_1.normaliserModules)([client_1.ModuleOptionnel.IFRS, client_1.ModuleOptionnel.PAIE, client_1.ModuleOptionnel.IFRS])).toEqual([
            client_1.ModuleOptionnel.PAIE,
            client_1.ModuleOptionnel.IFRS,
        ]);
    });
    it('la migration active tous les modules sur les dossiers existants', () => {
        const sql = (0, fs_1.readFileSync)((0, path_1.join)(__dirname, '../../../prisma/migrations/20261213000000_modules_optionnels/migration.sql'), 'utf8');
        const maj = sql.match(/UPDATE "tenants" SET "modulesActives" = ARRAY\[([^\]]+)\]/);
        expect(maj).not.toBeNull();
        const actives = maj[1].split(',').map((x) => x.trim().replace(/'/g, ''));
        expect(actives.sort()).toEqual(Object.values(client_1.ModuleOptionnel).sort());
    });
    it('la vitrine de démonstration reçoit tous les modules', () => {
        const src = (0, fs_1.readFileSync)((0, path_1.join)(__dirname, '../plateforme/plateforme.service.ts'), 'utf8');
        const debut = src.indexOf('async preparerDossierDemonstration(');
        const corps = src.slice(debut, src.indexOf('private async reprendreGarnissage(', debut));
        expect(corps).toContain('modulesActives: [...MODULES_OPTIONNELS]');
    });
    it('la route est réservée à l’administrateur du dossier', () => {
        const src = (0, fs_1.readFileSync)((0, path_1.join)(__dirname, 'tenant.controller.ts'), 'utf8');
        expect(src).toMatch(/@Patch\('modules'\)\s*@Roles\(RoleUtilisateur\.ADMIN_CABINET\)/);
    });
});
//# sourceMappingURL=modules-optionnels.spec.js.map