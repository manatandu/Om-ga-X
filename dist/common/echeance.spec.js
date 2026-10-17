"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const echeance_1 = require("./echeance");
describe('jourDeKinshasaIso', () => {
    it('passe au lendemain entre minuit et une heure UTC', () => {
        expect((0, echeance_1.jourDeKinshasaIso)(new Date('2026-12-31T23:30:00Z'))).toBe('2027-01-01');
        expect((0, echeance_1.jourDeKinshasaIso)(new Date('2026-12-31T22:30:00Z'))).toBe('2026-12-31');
    });
    it('la licence et les abonnements l’appellent au lieu de refaire le décalage', () => {
        const lire = (f) => (0, node_fs_1.readFileSync)((0, node_path_1.join)(__dirname, '..', 'modules', f), 'utf8');
        expect(lire('plateforme/licences-sur-site.service.ts')).toContain('return jourDeKinshasaIso(d);');
        expect(lire('plateforme/abonnements/abonnements.service.ts')).toContain('const aujourdhuiKinshasa = () => jourDeKinshasaIso(new Date());');
    });
});
//# sourceMappingURL=echeance.spec.js.map