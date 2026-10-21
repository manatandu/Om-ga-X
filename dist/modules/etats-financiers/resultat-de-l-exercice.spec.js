"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = require("fs");
const path_1 = require("path");
const compte_seed_syscohada_1 = require("../comptes/compte-seed-syscohada");
const resultat_de_l_exercice_1 = require("./resultat-de-l-exercice");
describe('résultat de l’exercice · 131 à 139, jamais le 130', () => {
    it('retient les neuf subdivisions 131 à 139 et écarte le 130', () => {
        expect([...resultat_de_l_exercice_1.COMPTES_RESULTAT_DE_L_EXERCICE]).toEqual(['131', '132', '133', '134', '135', '136', '137', '138', '139']);
        for (const n of ['13100000', '13200000', '13700000', '13810000', '13900000'])
            expect((0, resultat_de_l_exercice_1.estCompteDuResultatDeLExercice)(n)).toBe(true);
        for (const n of ['13010000', '13090000', '12100000', '14100000'])
            expect((0, resultat_de_l_exercice_1.estCompteDuResultatDeLExercice)(n)).toBe(false);
        expect((0, resultat_de_l_exercice_1.estResultatEnInstanceDAffectation)('13010000')).toBe(true);
        expect((0, resultat_de_l_exercice_1.estResultatEnInstanceDAffectation)('13100000')).toBe(false);
    });
    it('prémisse relue au semis SYSCOHADA · sous le 13, seul le 130 est écarté', () => {
        const sous13 = compte_seed_syscohada_1.PLAN_COMPTES_SYSCOHADA.filter((c) => c.numero.startsWith('13') && c.numero.length === 8).map((c) => c.numero);
        expect(sous13.filter((n) => !(0, resultat_de_l_exercice_1.estCompteDuResultatDeLExercice)(n)).sort()).toEqual(['13010000', '13090000']);
    });
    it('une cascade de soldes intermédiaires arrêtée en chemin rend le résultat (Titre VIII ch. 19 § 2.4)', () => {
        const balance = [
            { numero: '13700000', solde: -1_700 },
            { numero: '13800000', solde: 900 },
            { numero: '13010000', solde: -5_000 },
        ];
        const resultat = -balance.filter((l) => (0, resultat_de_l_exercice_1.estCompteDuResultatDeLExercice)(l.numero)).reduce((s, l) => s + l.solde, 0);
        expect(resultat).toBe(800);
    });
    it('chaque lecteur du résultat appelle la règle commune', () => {
        const lecteurs = [
            'etats-financiers/etats-financiers.service.ts',
            'etats-financiers/etats-financiers-smt.service.ts',
            'etats-financiers/etats-financiers-projet.service.ts',
            'etats-financiers-syscohada/correspondance-bilan-syscohada.ts',
            'etats-financiers-syscohada/correspondance-smt-syscohada.ts',
            'fiscalite/fiscalite.service.ts',
            'consolidation/cumul-consolidation.ts',
        ];
        const sansLaRegle = lecteurs.filter((f) => !(0, fs_1.readFileSync)((0, path_1.join)(__dirname, '..', f), 'utf8').includes("from '../etats-financiers/resultat-de-l-exercice'") &&
            !(0, fs_1.readFileSync)((0, path_1.join)(__dirname, '..', f), 'utf8').includes("from './resultat-de-l-exercice'"));
        expect(sansLaRegle).toEqual([]);
    });
});
describe('parts du résultat au bilan · la règle de la fiscalité', () => {
    const gestion = (solde) => ({ solde });
    const treize = (mouvementDebit, mouvementCredit) => ({ mouvementDebit, mouvementCredit });
    it('MAJEUR · ventes 1 000 000, achats 1 000 000, 13 à -300 000 non affecté · exercice 0, antérieur -300 000', () => {
        const parts = (0, resultat_de_l_exercice_1.partsDuResultatAuBilan)(0, -300_000, [gestion(-1_000_000), gestion(1_000_000)], [treize(0, 0)]);
        expect(parts).toEqual({ resultatDeLExercice: 0, resultatAnterieurNonAffecte: -300_000 });
        expect(parts.resultatDeLExercice + parts.resultatAnterieurNonAffecte).toBe((0, resultat_de_l_exercice_1.resultatAuBilan)(0, -300_000));
    });
    it('un 13 qui ne porte que l’à-nouveau, sans gestion, est antérieur · l’exercice vaut zéro', () => {
        expect((0, resultat_de_l_exercice_1.partsDuResultatAuBilan)(0, -46_072_000, [], [treize(0, 0)])).toEqual({
            resultatDeLExercice: 0,
            resultatAnterieurNonAffecte: -46_072_000,
        });
    });
    it('gestion soldée et 13 mouvementé dans l’exercice · le 13 est le résultat de l’exercice', () => {
        expect((0, resultat_de_l_exercice_1.partsDuResultatAuBilan)(0, 25_000, [gestion(0)], [treize(0, 25_000)])).toEqual({
            resultatDeLExercice: 25_000,
            resultatAnterieurNonAffecte: 0,
        });
    });
    it('avant l’affectation · les classes 6 à 8 portent N, le 13 porte N-1', () => {
        expect((0, resultat_de_l_exercice_1.partsDuResultatAuBilan)(500, 1_164_000, [gestion(-500)], [treize(0, 0)])).toEqual({
            resultatDeLExercice: 500,
            resultatAnterieurNonAffecte: 1_164_000,
        });
    });
});
describe('résultat antérieur non viré · seulement sur un exercice clôturé', () => {
    it('exercice clôturé, perte 2026 de 46 072 000 restée au 13 · nommée, poste, montant et fiche', () => {
        const avis = (0, resultat_de_l_exercice_1.resultatAnterieurNonVire)(true, -46_072_000, 'CJ', 'SYSCOHADA');
        expect(avis).not.toBeNull();
        expect(avis.montant).toBe(-46_072_000);
        expect(avis.poste).toBe('CJ');
        expect(avis.motif).toContain('une perte de 46');
        expect(avis.motif).toContain('AUDCIF, Titre VII, compte 13');
        expect(avis.motif).toContain('poste CJ');
    });
    it('le mot de chaque plan · déficit au SYCEBNL, et sa fiche', () => {
        const avis = (0, resultat_de_l_exercice_1.resultatAnterieurNonVire)(true, -1_000, 'CH', 'SYCEBNL');
        expect(avis.motif).toContain('un déficit de');
        expect(avis.motif).toContain('SYCEBNL, Partie 2 ch. 3, compte 13');
    });
    it('exercice ouvert, ou rien d’antérieur · rien n’est dit', () => {
        expect((0, resultat_de_l_exercice_1.resultatAnterieurNonVire)(false, -46_072_000, 'CJ', 'SYSCOHADA')).toBeNull();
        expect((0, resultat_de_l_exercice_1.resultatAnterieurNonVire)(true, 0, 'CJ', 'SYSCOHADA')).toBeNull();
        expect((0, resultat_de_l_exercice_1.resultatAnterieurNonVire)(true, 0.004, 'CJ', 'SYSCOHADA')).toBeNull();
    });
});
describe('résultat antérieur non viré · la colonne N-1', () => {
    it('exercice précédent clôturé, bénéfice de 2025 resté au 13 · nommé pour la colonne N-1, poste, montant, fiche et comparatif', () => {
        const avis = (0, resultat_de_l_exercice_1.resultatAnterieurNonVireDuComparatif)('EXERCICE_N1', true, 1_000_000, 'CJ', 'SYSCOHADA');
        expect(avis).toEqual(expect.objectContaining({ montant: 1_000_000, poste: 'CJ' }));
        expect(avis.motif).toMatch(/^Colonne N-1 · /);
        expect(avis.motif).toContain('un bénéfice de 1');
        expect(avis.motif).toContain('AUDCIF, Titre VII, compte 13');
        expect(avis.motif).toContain('AUDCIF art. 34');
        expect(avis.motif).toContain("Rien n'est recalculé");
    });
    it('le texte de chaque plan · excédent, fiche SYCEBNL et art. 16, 7)', () => {
        const avis = (0, resultat_de_l_exercice_1.resultatAnterieurNonVireDuComparatif)('EXERCICE_N1', true, 1_000_000, 'CH', 'SYCEBNL');
        expect(avis.motif).toContain('un excédent de');
        expect(avis.motif).toContain('SYCEBNL, Partie 2 ch. 3, compte 13');
        expect(avis.motif).toContain('SYCEBNL art. 16, 7)');
    });
    it('colonne lue sur le bilan d’ouverture, absente, exercice précédent ouvert, ou rien d’antérieur · rien n’est dit', () => {
        expect((0, resultat_de_l_exercice_1.resultatAnterieurNonVireDuComparatif)('BILAN_D_OUVERTURE', true, 1_000_000, 'CJ', 'SYSCOHADA')).toBeNull();
        expect((0, resultat_de_l_exercice_1.resultatAnterieurNonVireDuComparatif)(null, true, 1_000_000, 'CJ', 'SYSCOHADA')).toBeNull();
        expect((0, resultat_de_l_exercice_1.resultatAnterieurNonVireDuComparatif)('EXERCICE_N1', false, 1_000_000, 'CJ', 'SYSCOHADA')).toBeNull();
        expect((0, resultat_de_l_exercice_1.resultatAnterieurNonVireDuComparatif)('EXERCICE_N1', true, 0, 'CJ', 'SYSCOHADA')).toBeNull();
    });
});
//# sourceMappingURL=resultat-de-l-exercice.spec.js.map