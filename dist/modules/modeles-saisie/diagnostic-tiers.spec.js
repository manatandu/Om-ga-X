"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const diagnostic_tiers_1 = require("./diagnostic-tiers");
const l = (numero, sens) => ({ numero, sens });
describe('Diagnostic du tiers · un modèle qui solde une charge sur la trésorerie', () => {
    it('signale un achat soldé directement sur la banque', () => {
        const a = (0, diagnostic_tiers_1.diagnostiquerTiers)([l('60110000', 'DEBIT'), l('52100000', 'CREDIT')], client_1.Referentiel.SYSCOHADA);
        expect(a).toHaveLength(1);
        expect(a[0]).toContain('60110000');
        expect(a[0]).toContain('DIRECTEMENT');
        expect(a[0]).toContain('contrepartie systématique = 401');
        expect(a[0]).not.toContain('SYCEBNL');
    });
    it('cite le SYCEBNL à un dossier SYCEBNL, et jamais le Guide du SYSCOHADA', () => {
        const a = (0, diagnostic_tiers_1.diagnostiquerTiers)([l('60110000', 'DEBIT'), l('57100000', 'CREDIT')], client_1.Referentiel.SYCEBNL);
        expect(a).toHaveLength(1);
        expect(a[0]).toContain('fonctionnement du compte 40');
        expect(a[0]).not.toContain('Recommandation SYSCOHADA');
    });
    it('signale aussi une VENTE encaissée sans créance client', () => {
        const a = (0, diagnostic_tiers_1.diagnostiquerTiers)([l('52100000', 'DEBIT'), l('70110000', 'CREDIT')], client_1.Referentiel.SYSCOHADA);
        expect(a).toHaveLength(1);
        expect(a[0]).toContain('Le PRODUIT');
        expect(a[0]).toContain('70110000');
    });
    it('DIT qu’il n’empêche rien · c’est un avertissement, pas un refus', () => {
        const a = (0, diagnostic_tiers_1.diagnostiquerTiers)([l('60110000', 'DEBIT'), l('52100000', 'CREDIT')], client_1.Referentiel.SYSCOHADA);
        expect(a[0]).toContain("N'EMPÊCHE PAS");
        expect(a[0]).toContain('frais bancaires');
        expect(a[0]).toContain('don manuel');
    });
});
describe('Diagnostic du tiers · ce qui NE déclenche rien', () => {
    it('la TVA n’est pas le tiers · 445 sur un achat, 443 sur une vente (R1-B3)', () => {
        expect((0, diagnostic_tiers_1.diagnostiquerTiers)([l('60110000', 'DEBIT'), l('44520000', 'DEBIT'), l('52100000', 'CREDIT')], client_1.Referentiel.SYSCOHADA)).toHaveLength(1);
        expect((0, diagnostic_tiers_1.diagnostiquerTiers)([l('52100000', 'DEBIT'), l('70110000', 'CREDIT'), l('44310000', 'CREDIT')], client_1.Referentiel.SYSCOHADA)).toHaveLength(1);
        expect((0, diagnostic_tiers_1.diagnostiquerTiers)([l('62210000', 'DEBIT'), l('44710000', 'CREDIT'), l('52100000', 'CREDIT')], client_1.Referentiel.SYSCOHADA)).toEqual([]);
    });
    it('un modèle qui porte déjà un compte de tiers', () => {
        expect((0, diagnostic_tiers_1.diagnostiquerTiers)([l('60110000', 'DEBIT'), l('40110000', 'CREDIT')], client_1.Referentiel.SYSCOHADA)).toEqual([]);
    });
    it('une facture réglée partiellement le jour même · le tiers y est nommé', () => {
        expect((0, diagnostic_tiers_1.diagnostiquerTiers)([l('60110000', 'DEBIT'), l('40110000', 'CREDIT'), l('52100000', 'CREDIT')], client_1.Referentiel.SYSCOHADA)).toEqual([]);
    });
    it('un virement interne · deux comptes de trésorerie, aucun compte de nature', () => {
        expect((0, diagnostic_tiers_1.diagnostiquerTiers)([l('52100000', 'DEBIT'), l('57100000', 'CREDIT')], client_1.Referentiel.SYSCOHADA)).toEqual([]);
    });
    it('un règlement de fournisseur · le tiers au débit, la trésorerie au crédit', () => {
        expect((0, diagnostic_tiers_1.diagnostiquerTiers)([l('40110000', 'DEBIT'), l('52100000', 'CREDIT')], client_1.Referentiel.SYSCOHADA)).toEqual([]);
    });
    it('une charge CRÉDITÉE n’est pas une charge débitée · un avoir ne se diagnostique pas ici', () => {
        expect((0, diagnostic_tiers_1.diagnostiquerTiers)([l('52100000', 'DEBIT'), l('60110000', 'CREDIT')], client_1.Referentiel.SYSCOHADA)).toEqual([]);
    });
});
describe('Diagnostic du tiers · le don manuel, et le piège du 704', () => {
    it('un don reçu en numéraire ne déclenche RIEN au SYCEBNL', () => {
        expect((0, diagnostic_tiers_1.diagnostiquerTiers)([l('57100000', 'DEBIT'), l('70410000', 'CREDIT')], client_1.Referentiel.SYCEBNL)).toEqual([]);
    });
    it('LE MÊME 70410000 EST SIGNALÉ AU SYSCOHADA · un numéro, deux sens', () => {
        const a = (0, diagnostic_tiers_1.diagnostiquerTiers)([l('52100000', 'DEBIT'), l('70410000', 'CREDIT')], client_1.Referentiel.SYSCOHADA);
        expect(a).toHaveLength(1);
        expect(a[0]).toContain('70410000');
    });
    it('les deux intitulés sont bien ceux des deux semis · la prémisse se vérifie', () => {
        const racine = (0, node_path_1.join)(__dirname, '..', '..', '..');
        const sycebnl = (0, node_fs_1.readFileSync)((0, node_path_1.join)(racine, 'src/modules/comptes/compte-seed.ts'), 'utf8');
        const syscohada = (0, node_fs_1.readFileSync)((0, node_path_1.join)(racine, 'src/modules/comptes/compte-seed-syscohada.ts'), 'utf8');
        expect(sycebnl).toContain("'70410000', 'Revenus liés à la générosité · dons'");
        expect(syscohada).toContain('Ventes de produits résiduels');
    });
});
//# sourceMappingURL=diagnostic-tiers.spec.js.map