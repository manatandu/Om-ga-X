"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const service = (0, node_fs_1.readFileSync)((0, node_path_1.join)(__dirname, 'taux-tva.service.ts'), 'utf8');
const seedSycebnl = (0, node_fs_1.readFileSync)((0, node_path_1.join)(__dirname, '..', 'comptes', 'compte-seed.ts'), 'utf8');
const seedSyscohada = (0, node_fs_1.readFileSync)((0, node_path_1.join)(__dirname, '..', 'comptes', 'compte-seed-syscohada.ts'), 'utf8');
const RECONNUS = [
    ['63830000', 'Réceptions', 'art. 41, 1° · « dépenses de […] réception »'],
    ['63840000', 'Missions', 'art. 41, 1° · logement, hébergement, restauration en déplacement'],
    ['61810000', 'Voyages et déplacements', 'art. 41, 1° · transport de personnes et hébergement'],
    ['61400000', 'Transports du personnel', 'art. 42, 2° · sauf contrat permanent'],
    ['60420000', 'Matières combustibles', 'art. 41, 3°, 3° bis et 3° ter · produits pétroliers'],
];
describe('les comptes que l’article 41 fait reconnaître sont bien semés, aux DEUX plans', () => {
    for (const [numero, intitule, article] of RECONNUS) {
        it(`${numero} « ${intitule} » est semé au SYSCOHADA et au SYCEBNL · ${article}`, () => {
            expect(seedSyscohada).toContain(`'${numero}', '${intitule}'`);
            expect(seedSycebnl).toContain(`'${numero}', '${intitule}'`);
        });
    }
    it('le 62760000 « Cadeaux à la clientèle » est semé aux DEUX plans, et la règle s’y applique d’elle-même', () => {
        expect(seedSyscohada).toContain("'62760000', 'Cadeaux à la clientèle'");
        expect(seedSycebnl).toContain("'62760000', 'Cadeaux à la clientèle'");
    });
    it('le service ne referme plus l’article 41 sur le seul SYSCOHADA', () => {
        expect(service).toContain('LES DEUX RÉFÉRENTIELS');
        expect(service).toContain("portait\n * « SYSCOHADA SEUL");
        expect(service).toMatch(/private partExclueArt41\(\s*lignesCharge:/);
    });
    it('l’affirmation qui était fausse est écrite comme telle, avec les lignes du semis', () => {
        expect(service).toContain("C'ÉTAIT FAUX");
        expect(service).toContain('61810000');
        expect(service).toContain('63830000');
        expect(service).toContain('63840000');
    });
});
//# sourceMappingURL=exclusions-art41-semees.spec.js.map