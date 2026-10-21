"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const client_1 = require("@prisma/client");
const consignation_1 = require("./consignation");
const nomenclature_emballages_1 = require("./nomenclature-emballages");
function consignation(over = {}) {
    return {
        sens: 'EMISE',
        nature: 'EMBALLAGE',
        compteTiers: '41100000',
        intituleTiers: 'Client BRASSERIE KIN',
        montant: 50000,
        designation: '100 casiers à 500',
        ...over,
    };
}
const total = (lignes, s) => lignes.filter((l) => l.sens === s).reduce((t, l) => t + l.montant, 0);
describe("consignation d'emballages", () => {
    describe('la consignation elle-même · un compte d’attente, pas une vente', () => {
        it("ÉMISE · le client est débité, la dette de consignation créditée", () => {
            const p = (0, consignation_1.lignesDeLaConsignation)(consignation(), client_1.Referentiel.SYSCOHADA);
            expect(p.lignes.map((l) => [l.compte, l.sens, l.montant])).toEqual([
                ['41100000', 'DEBIT', 50000],
                ['4194', 'CREDIT', 50000],
            ]);
        });
        it('REÇUE · la créance est débitée, le fournisseur crédité', () => {
            const p = (0, consignation_1.lignesDeLaConsignation)(consignation({ sens: 'RECUE', compteTiers: '40110000', intituleTiers: 'Fournisseur SONGA' }), client_1.Referentiel.SYSCOHADA);
            expect(p.lignes.map((l) => [l.compte, l.sens, l.montant])).toEqual([
                ['4094', 'DEBIT', 50000],
                ['40110000', 'CREDIT', 50000],
            ]);
        });
        it("AUCUN compte de produit ni de charge · la consignation n'est pas une vente", () => {
            for (const sens of ['EMISE', 'RECUE']) {
                const p = (0, consignation_1.lignesDeLaConsignation)(consignation({ sens }), client_1.Referentiel.SYSCOHADA);
                expect(p.lignes.map((l) => l.compte[0])).not.toContain('6');
                expect(p.lignes.map((l) => l.compte[0])).not.toContain('7');
            }
        });
        it('un montant non positif est refusé', () => {
            const p = (0, consignation_1.lignesDeLaConsignation)(consignation({ montant: 0 }), client_1.Referentiel.SYSCOHADA);
            expect(p.lignes).toEqual([]);
            expect(p.refus?.motif).toBe('MONTANT_NON_POSITIF');
        });
    });
    describe('la restitution · rien n’entre au résultat', () => {
        it.each(['EMISE', 'RECUE'])('%s · les deux lignes s’extournent', (sens) => {
            const c = consignation({ sens });
            const ouverture = (0, consignation_1.lignesDeLaConsignation)(c, client_1.Referentiel.SYSCOHADA).lignes;
            const retour = (0, consignation_1.lignesDuDenouement)(c, 'RESTITUTION', client_1.Referentiel.SYSCOHADA).lignes;
            for (const l of ouverture) {
                const jumelle = retour.find((r) => r.compte === l.compte);
                expect([l.compte, jumelle?.sens, jumelle?.montant]).toEqual([
                    l.compte,
                    l.sens === 'DEBIT' ? 'CREDIT' : 'DEBIT',
                    l.montant,
                ]);
            }
            expect(retour.map((l) => l.compte[0])).not.toContain('7');
        });
    });
    describe('la conservation', () => {
        it("EMISE · un EMBALLAGE conservé devient un produit accessoire", () => {
            const p = (0, consignation_1.lignesDuDenouement)(consignation(), 'CONSERVATION', client_1.Referentiel.SYSCOHADA);
            expect(p.lignes.map((l) => [l.compte, l.sens])).toEqual([
                ['4194', 'DEBIT'],
                ['7074', 'CREDIT'],
            ]);
        });
        it('REÇUE · un EMBALLAGE conservé devient un achat d’emballages récupérables', () => {
            const p = (0, consignation_1.lignesDuDenouement)(consignation({ sens: 'RECUE', compteTiers: '40110000' }), 'CONSERVATION', client_1.Referentiel.SYSCOHADA);
            expect(p.lignes.map((l) => [l.compte, l.sens])).toEqual([
                ['6082', 'DEBIT'],
                ['4094', 'CREDIT'],
            ]);
        });
        it('REÇUE · un MATÉRIEL conservé entre en immobilisation, et la descente est DITE', () => {
            const p = (0, consignation_1.lignesDuDenouement)(consignation({ sens: 'RECUE', nature: 'MATERIEL', compteTiers: '40110000' }), 'CONSERVATION', client_1.Referentiel.SYSCOHADA);
            expect(p.lignes[0].compte).toBe('243');
            expect(p.lignes[0].reserve).toContain('EN-TÊTES DE DIVISION');
        });
        it('EMISE · un MATÉRIEL conservé est une CESSION, et le module REFUSE de la poster', () => {
            const p = (0, consignation_1.lignesDuDenouement)(consignation({ nature: 'MATERIEL' }), 'CONSERVATION', client_1.Referentiel.SYSCOHADA);
            expect(p.lignes).toEqual([]);
            expect(p.refus?.motif).toBe('CESSION_IMMOBILISATION_HORS_MODULE');
            expect(p.refus?.explication).toContain('VALEUR');
            expect(p.refus?.explication).toContain('812');
            expect(p.refus?.explication).toContain('immobilisations');
        });
    });
    describe('la reprise sous le prix de consignation', () => {
        it("EMISE · l'écart est un BONI, et l'écriture s'équilibre", () => {
            const p = (0, consignation_1.lignesDuDenouement)(consignation(), 'REPRISE_PRIX_INFERIEUR', client_1.Referentiel.SYSCOHADA, 42000);
            expect(p.lignes.map((l) => [l.compte, l.sens, l.montant])).toEqual([
                ['4194', 'DEBIT', 50000],
                ['41100000', 'CREDIT', 42000],
                ['7074', 'CREDIT', 8000],
            ]);
            expect(total(p.lignes, 'DEBIT')).toBe(total(p.lignes, 'CREDIT'));
        });
        it("REÇUE · l'écart est un MALI, et l'écriture s'équilibre", () => {
            const p = (0, consignation_1.lignesDuDenouement)(consignation({ sens: 'RECUE', compteTiers: '40110000' }), 'REPRISE_PRIX_INFERIEUR', client_1.Referentiel.SYSCOHADA, 42000);
            expect(p.lignes.map((l) => [l.compte, l.sens, l.montant])).toEqual([
                ['40110000', 'DEBIT', 42000],
                ['6224', 'DEBIT', 8000],
                ['4094', 'CREDIT', 50000],
            ]);
            expect(total(p.lignes, 'DEBIT')).toBe(total(p.lignes, 'CREDIT'));
        });
        it('le prix repris est exigé · il ne se déduit de rien', () => {
            const p = (0, consignation_1.lignesDuDenouement)(consignation(), 'REPRISE_PRIX_INFERIEUR', client_1.Referentiel.SYSCOHADA);
            expect(p.lignes).toEqual([]);
            expect(p.refus?.motif).toBe('PRIX_DE_REPRISE_MANQUANT');
        });
        it("un prix ÉGAL n'est pas une reprise sous le prix · c'est une restitution", () => {
            const p = (0, consignation_1.lignesDuDenouement)(consignation(), 'REPRISE_PRIX_INFERIEUR', client_1.Referentiel.SYSCOHADA, 50000);
            expect(p.refus?.motif).toBe('PRIX_DE_REPRISE_NON_INFERIEUR');
            expect(p.refus?.explication).toContain('RESTITUTION');
        });
        it('un prix SUPÉRIEUR est refusé · aucune source lue ne le traite', () => {
            const p = (0, consignation_1.lignesDuDenouement)(consignation(), 'REPRISE_PRIX_INFERIEUR', client_1.Referentiel.SYSCOHADA, 60000);
            expect(p.refus?.motif).toBe('PRIX_DE_REPRISE_NON_INFERIEUR');
        });
    });
    describe('le bout PRODUIT diverge entre les deux plans, et lui seul', () => {
        it('le boni sur emballages est 7074 au SYSCOHADA et 707 au SYCEBNL', () => {
            expect((0, nomenclature_emballages_1.compteDuRole)('BONI_SUR_EMBALLAGES', client_1.Referentiel.SYSCOHADA).numero).toBe('7074');
            expect((0, nomenclature_emballages_1.compteDuRole)('BONI_SUR_EMBALLAGES', client_1.Referentiel.SYCEBNL).numero).toBe('707');
        });
        it("la conservation d'un emballage ne rend PAS le même compte dans les deux plans", () => {
            const sys = (0, consignation_1.lignesDuDenouement)(consignation(), 'CONSERVATION', client_1.Referentiel.SYSCOHADA);
            const syc = (0, consignation_1.lignesDuDenouement)(consignation(), 'CONSERVATION', client_1.Referentiel.SYCEBNL);
            expect(sys.lignes[1].compte).toBe('7074');
            expect(syc.lignes[1].compte).toBe('707');
            expect(sys.lignes[1].compte).not.toBe(syc.lignes[1].compte);
        });
        it('TOUS LES AUTRES RÔLES coïncident · premier cycle du dépôt où c’est le cas', () => {
            const parRole = (r) => Object.fromEntries((0, nomenclature_emballages_1.comptesDuReferentiel)(r).map((c) => [c.role, c.numero]));
            const sys = parRole(client_1.Referentiel.SYSCOHADA);
            const syc = parRole(client_1.Referentiel.SYCEBNL);
            const divergents = Object.keys(sys).filter((role) => sys[role] !== syc[role]);
            expect(divergents).toEqual(['BONI_SUR_EMBALLAGES']);
        });
    });
    describe('ce que la SOURCE doit porter, et qu’aucun jeu d’essai ne montre', () => {
        const source = (0, node_fs_1.readFileSync)((0, node_path_1.join)(__dirname, 'consignation.ts'), 'utf8');
        const nomenclature = (0, node_fs_1.readFileSync)((0, node_path_1.join)(__dirname, 'nomenclature-emballages.ts'), 'utf8');
        it('aucun numéro de compte du cycle n’est écrit en dur hors de la nomenclature', () => {
            const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
            expect(code).not.toMatch(/['"`](4094|4194|6082|6224|7074|707|243|822|812)['"`]/);
        });
        it('les DEUX textes sont cités, et jamais l’un pour l’autre', () => {
            expect(source).toContain('AUDCIF, Titre VII, fiche du COMPTE 40');
            expect(source).toContain('fiche du COMPTE 41');
            expect(nomenclature).toContain('SYCEBNL, fiche du compte 41');
            expect(nomenclature).toContain('AUDCIF, fiche du compte 41');
        });
        it('le 6588 du livre de cours n’est repris NULLE PART', () => {
            expect(source).not.toMatch(/['"`]6588['"`]/);
            expect(nomenclature).not.toMatch(/['"`]6588['"`]/);
            expect(nomenclature).toContain('6588');
            expect(nomenclature).toContain('Autres charges diverses');
        });
        it('l’abstention sur la TVA est motivée, pas silencieuse', () => {
            const paragraphe = source.slice(source.indexOf('AUCUNE LIGNE DE TVA'), source.indexOf('export function lignesDeLaConsignation'));
            expect(paragraphe).not.toBe('');
            expect(paragraphe).toContain('ne mentionnent aucune taxe');
        });
    });
});
//# sourceMappingURL=consignation.spec.js.map