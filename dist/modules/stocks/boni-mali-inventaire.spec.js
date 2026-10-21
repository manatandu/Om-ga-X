"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const client_1 = require("@prisma/client");
const boni_mali_inventaire_1 = require("./boni-mali-inventaire");
const MOUVEMENTS = [
    { ordre: 1, date: '2026-01-05', sens: 'ENTREE', quantite: 100, cout: 1200 },
    { ordre: 2, date: '2026-02-10', sens: 'ENTREE', quantite: 200, cout: 3000 },
    { ordre: 3, date: '2026-03-15', sens: 'SORTIE', quantite: 50, cout: null },
];
function article(over = {}) {
    return {
        articleId: 'a1',
        code: 'ART-001',
        designation: 'Ciment 50 kg',
        uniteMesure: 'sac',
        compteNumero: '33100000',
        compteIntitule: 'Autres approvisionnements',
        methode: 'CMPACE',
        mouvements: MOUVEMENTS,
        quantitePhysique: 250,
        ...over,
    };
}
describe("boni et mali d'inventaire", () => {
    describe("le mode de tenue décide, et lui seul", () => {
        it("REFUSE tout boni et tout mali en inventaire INTERMITTENT", () => {
            const r = (0, boni_mali_inventaire_1.confronterInventaire)([article({ quantitePhysique: 240 })], client_1.Referentiel.SYSCOHADA, 'INTERMITTENT');
            expect(r.differences).toEqual([]);
            expect(r.refus).toHaveLength(1);
            expect(r.refus[0].motif).toBe('INVENTAIRE_INTERMITTENT');
            expect(r.refus[0].explication).toContain('PERMANENT');
        });
        it("le MÊME écart produit une différence en inventaire PERMANENT", () => {
            const r = (0, boni_mali_inventaire_1.confronterInventaire)([article({ quantitePhysique: 240 })], client_1.Referentiel.SYSCOHADA, 'PERMANENT');
            expect(r.refus).toEqual([]);
            expect(r.differences).toHaveLength(1);
            expect(r.differences[0].sens).toBe('MALI');
        });
    });
    describe('le mali est une sortie, et la méthode le valorise', () => {
        it('C.M.P.A.C.E. · dix sacs manquants valent dix fois le coût moyen en vigueur', () => {
            const r = (0, boni_mali_inventaire_1.confronterInventaire)([article({ quantitePhysique: 240 })], client_1.Referentiel.SYSCOHADA, 'PERMANENT');
            const d = r.differences[0];
            expect(d.quantiteComptable).toBe(250);
            expect(d.ecartQuantite).toBe(-10);
            expect(d.coutUnitaireRetenu).toBe(14);
            expect(d.montant).toBe(140);
            expect(r.totalMali).toBe(140);
            expect(r.totalBoni).toBe(0);
        });
        it('P.E.P.S. · le même écart vaut 150, et non 140', () => {
            const r = (0, boni_mali_inventaire_1.confronterInventaire)([article({ methode: 'PEPS', quantitePhysique: 240 })], client_1.Referentiel.SYSCOHADA, 'PERMANENT');
            const d = r.differences[0];
            expect(d.coutUnitaireRetenu).toBe(12);
            expect(d.montant).toBe(120);
            expect(d.fondementDuCout).toContain('P.E.P.S.');
        });
        it("le mali qui vide le magasin prend la valeur restante EXACTEMENT", () => {
            const r = (0, boni_mali_inventaire_1.confronterInventaire)([
                article({
                    methode: 'CMPACE',
                    mouvements: [{ ordre: 1, date: '2026-01-05', sens: 'ENTREE', quantite: 7, cout: 29 }],
                    quantitePhysique: 0,
                }),
            ], client_1.Referentiel.SYSCOHADA, 'PERMANENT');
            expect(r.differences[0].montant).toBe(29);
        });
    });
    describe("le boni est une entrée, et les deux méthodes ne répondent pas pareil", () => {
        it("C.M.P.A.C.E. · le boni prend le coût moyen en vigueur, sans rien demander", () => {
            const r = (0, boni_mali_inventaire_1.confronterInventaire)([article({ quantitePhysique: 260 })], client_1.Referentiel.SYSCOHADA, 'PERMANENT');
            const d = r.differences[0];
            expect(d.sens).toBe('BONI');
            expect(d.ecartQuantite).toBe(10);
            expect(d.coutUnitaireRetenu).toBe(14);
            expect(d.montant).toBe(140);
            expect(r.totalBoni).toBe(140);
        });
        it("P.E.P.S. · le boni est REFUSÉ tant que le coût et sa source ne sont pas donnés", () => {
            const r = (0, boni_mali_inventaire_1.confronterInventaire)([article({ methode: 'PEPS', quantitePhysique: 260 })], client_1.Referentiel.SYSCOHADA, 'PERMANENT');
            expect(r.differences).toEqual([]);
            expect(r.refus[0].motif).toBe('COUT_DU_BONI_NON_FOURNI');
        });
        it('P.E.P.S. · un coût SANS SA SOURCE ne suffit pas', () => {
            const r = (0, boni_mali_inventaire_1.confronterInventaire)([article({ methode: 'PEPS', quantitePhysique: 260, coutUnitaireBoni: 15 })], client_1.Referentiel.SYSCOHADA, 'PERMANENT');
            expect(r.refus[0].motif).toBe('COUT_DU_BONI_NON_FOURNI');
        });
        it('P.E.P.S. · le coût et sa source ouvrent la proposition, et la source est conservée', () => {
            const r = (0, boni_mali_inventaire_1.confronterInventaire)([
                article({
                    methode: 'PEPS',
                    quantitePhysique: 260,
                    coutUnitaireBoni: 15,
                    sourceCoutBoni: 'facture F-2026-037 du 10/02/2026',
                }),
            ], client_1.Referentiel.SYSCOHADA, 'PERMANENT');
            expect(r.differences[0].montant).toBe(150);
            expect(r.differences[0].coutUnitaireRetenu).toBe(15);
            expect(r.differences[0].fondementDuCout).toContain('facture F-2026-037');
        });
    });
    describe("le sens de l'écriture, que les deux textes écrivent", () => {
        it('un BONI débite le stock et crédite la variation', () => {
            const r = (0, boni_mali_inventaire_1.confronterInventaire)([article({ quantitePhysique: 260 })], client_1.Referentiel.SYSCOHADA, 'PERMANENT');
            const lignes = (0, boni_mali_inventaire_1.lignesDeLaRegularisation)(r.differences);
            expect(lignes.map((l) => [l.compte, l.sens, l.montant])).toEqual([
                ['33100000', 'DEBIT', 140],
                ['6033', 'CREDIT', 140],
            ]);
        });
        it('un MALI débite la variation et crédite le stock', () => {
            const r = (0, boni_mali_inventaire_1.confronterInventaire)([article({ quantitePhysique: 240 })], client_1.Referentiel.SYSCOHADA, 'PERMANENT');
            const lignes = (0, boni_mali_inventaire_1.lignesDeLaRegularisation)(r.differences);
            expect(lignes.map((l) => [l.compte, l.sens, l.montant])).toEqual([
                ['33100000', 'CREDIT', 140],
                ['6033', 'DEBIT', 140],
            ]);
        });
        it("l'écriture est équilibrée quel que soit le mélange de bonis et de malis", () => {
            const r = (0, boni_mali_inventaire_1.confronterInventaire)([
                article({ articleId: 'a1', code: 'A1', quantitePhysique: 260 }),
                article({ articleId: 'a2', code: 'A2', quantitePhysique: 240 }),
            ], client_1.Referentiel.SYSCOHADA, 'PERMANENT');
            const lignes = (0, boni_mali_inventaire_1.lignesDeLaRegularisation)(r.differences);
            const debit = lignes.filter((l) => l.sens === 'DEBIT').reduce((s, l) => s + l.montant, 0);
            const credit = lignes.filter((l) => l.sens === 'CREDIT').reduce((s, l) => s + l.montant, 0);
            expect(debit).toBe(credit);
        });
    });
    describe('la contrepartie vient du référentiel, jamais du numéro seul', () => {
        it("le compte 33 ne rend PAS la même variation dans les deux plans", () => {
            const sys = (0, boni_mali_inventaire_1.confronterInventaire)([article({ quantitePhysique: 240 })], client_1.Referentiel.SYSCOHADA, 'PERMANENT');
            const syc = (0, boni_mali_inventaire_1.confronterInventaire)([article({ quantitePhysique: 240 })], client_1.Referentiel.SYCEBNL, 'PERMANENT');
            expect(sys.differences[0].compteVariation).toBe('6033');
            expect(syc.differences[0].compteVariation).toBe('6034');
            expect(sys.differences[0].compteVariation).not.toBe(syc.differences[0].compteVariation);
        });
        it("un compte hors variation automatique est REFUSÉ avec son motif, jamais rattaché d'office", () => {
            const r = (0, boni_mali_inventaire_1.confronterInventaire)([article({ compteNumero: '34100000', quantitePhysique: 240 })], client_1.Referentiel.SYCEBNL, 'PERMANENT');
            expect(r.differences).toEqual([]);
            expect(r.refus[0].motif).toBe('HORS_VARIATION_AUTOMATIQUE');
            expect(r.refus[0].explication).not.toContain('[object Object]');
            expect(r.refus[0].explication).toContain('extourn');
        });
    });
    describe('les refus, et ce qu\'ils n\'emportent pas', () => {
        it("« pas encore compté » n'est pas zéro", () => {
            const r = (0, boni_mali_inventaire_1.confronterInventaire)([article({ quantitePhysique: null })], client_1.Referentiel.SYSCOHADA, 'PERMANENT');
            expect(r.differences).toEqual([]);
            expect(r.refus[0].motif).toBe('QUANTITE_PHYSIQUE_ABSENTE');
        });
        it("un article refusé n'emporte pas les autres", () => {
            const r = (0, boni_mali_inventaire_1.confronterInventaire)([
                article({ articleId: 'a1', code: 'A1', quantitePhysique: null }),
                article({ articleId: 'a2', code: 'A2', quantitePhysique: 240 }),
                article({ articleId: 'a3', code: 'A3', quantitePhysique: 250 }),
            ], client_1.Referentiel.SYSCOHADA, 'PERMANENT');
            expect(r.refus.map((x) => x.code)).toEqual(['A1']);
            expect(r.differences.map((d) => d.code)).toEqual(['A2']);
            expect(r.sansDifference.map((d) => d.code)).toEqual(['A3']);
        });
        it("une fiche qui ne se valorise pas ne se chiffre pas", () => {
            const r = (0, boni_mali_inventaire_1.confronterInventaire)([
                article({
                    mouvements: [{ ordre: 1, date: '2026-01-05', sens: 'ENTREE', quantite: 100, cout: null }],
                    quantitePhysique: 90,
                }),
            ], client_1.Referentiel.SYSCOHADA, 'PERMANENT');
            expect(r.differences).toEqual([]);
            expect(r.refus[0].motif).toBe('MAGASIN_NON_VALORISABLE');
        });
        it("un écart NUL n'est pas une différence", () => {
            const r = (0, boni_mali_inventaire_1.confronterInventaire)([article()], client_1.Referentiel.SYSCOHADA, 'PERMANENT');
            expect(r.differences).toEqual([]);
            expect(r.refus).toEqual([]);
            expect(r.sansDifference).toEqual([{ articleId: 'a1', code: 'ART-001', quantite: 250 }]);
        });
    });
    describe('ce que la SOURCE doit porter, et qu\'aucun jeu d\'essai ne montre', () => {
        const source = (0, node_fs_1.readFileSync)((0, node_path_1.join)(__dirname, 'boni-mali-inventaire.ts'), 'utf8');
        it("les deux textes sont cités, et jamais l'un pour l'autre", () => {
            expect(source).toContain('AUDCIF, Titre VII, COMPTE 603');
            expect(source).toContain('SYCEBNL, Partie 2 ch. 3');
        });
        it("l'art. 43 est nommé POUR DIRE qu'il ne s'oppose pas au boni", () => {
            expect(source).toContain("L'ART. 43 NE S'OPPOSE PAS AU BONI");
            const paragraphe = source.slice(source.indexOf("2 · L'ART. 43"), source.indexOf('3 · LA CONTREPARTIE'));
            expect(paragraphe).not.toBe('');
            expect(paragraphe).toContain('VALEURS');
            expect(paragraphe).toContain('UNITÉS');
            expect(paragraphe).toContain('caisse');
        });
        it("aucun numéro de compte de variation n'est écrit en dur dans ce fichier", () => {
            const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
            expect(code).not.toMatch(/['"`]60(3[1-4]|35)['"`]/);
            expect(code).not.toMatch(/['"`]7(3[4-7]|36)['"`]/);
        });
    });
});
//# sourceMappingURL=boni-mali-inventaire.spec.js.map