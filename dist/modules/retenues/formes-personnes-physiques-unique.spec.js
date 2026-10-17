"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = require("fs");
const path_1 = require("path");
const client_1 = require("@prisma/client");
const correspondance_retenues_1 = require("./correspondance-retenues");
const lire = (f) => (0, fs_1.readFileSync)((0, path_1.join)(__dirname, '..', f), 'utf8');
describe('formes personnes physiques', () => {
    it('la liste est celle des deux formes du schéma', () => {
        expect([...correspondance_retenues_1.FORMES_PERSONNES_PHYSIQUES].sort()).toEqual([client_1.FormeJuridiqueSyscohada.ENTREPRENANT, client_1.FormeJuridiqueSyscohada.ENTREPRISE_INDIVIDUELLE].sort());
    });
    it.each(['exercice/planning-cloture.ts', 'fiscalite/fiscalite.service.ts'])('%s importe la liste commune', (f) => {
        expect(lire(f)).toContain("import { FORMES_PERSONNES_PHYSIQUES } from '../retenues/correspondance-retenues';");
        expect(lire(f)).not.toMatch(/const FORMES_PERSONNES_PHYSIQUES\b/);
    });
});
//# sourceMappingURL=formes-personnes-physiques-unique.spec.js.map