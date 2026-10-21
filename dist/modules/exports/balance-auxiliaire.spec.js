"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const service = (0, node_fs_1.readFileSync)((0, node_path_1.join)(__dirname, 'export-fpm.service.ts'), 'utf8');
const ecriture = (0, node_fs_1.readFileSync)((0, node_path_1.join)(__dirname, '..', 'comptabilite', 'ecriture.service.ts'), 'utf8');
describe('balance auxiliaire · l’état qui manquait', () => {
    it('existe, et ne se confond pas avec la balance âgée', () => {
        expect(ecriture).toContain('async balanceAuxiliaire(');
        expect(ecriture).toContain('async balanceAgee(');
        expect(service).toContain('async balanceTiersEnFlux(');
    });
    it('n’écarte pas un compte de tiers sans tiers rattaché', () => {
        expect(ecriture).toContain('sansTiers: !tiers');
        expect(ecriture).not.toContain('.filter((l) => parCompte.has(l.compteId))');
        expect(service).toContain('aucun tiers rattaché');
    });
    it('porte les deux colonnes de solde qui s’excluent', () => {
        expect(ecriture).toContain('soldeDebit: solde > 0 ? solde : 0');
        expect(ecriture).toContain('soldeCredit: solde < 0 ? -solde : 0');
    });
});
//# sourceMappingURL=balance-auxiliaire.spec.js.map