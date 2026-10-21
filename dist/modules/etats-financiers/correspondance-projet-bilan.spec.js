"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const correspondance_projet_bilan_1 = require("./correspondance-projet-bilan");
const etats_financiers_communs_1 = require("./etats-financiers.communs");
describe('correspondance bilan projet (SYCEBNL, Partie 4 ch. 3)', () => {
    it('ne comporte aucune ref en double, tous postes et totaux confondus', () => {
        const toutesLesRefs = [
            ...correspondance_projet_bilan_1.POSTES_ACTIF.map((p) => p.ref),
            ...correspondance_projet_bilan_1.POSTES_PASSIF.map((p) => p.ref),
            ...correspondance_projet_bilan_1.TOTAUX_ACTIF.map((t) => t.ref),
            ...correspondance_projet_bilan_1.TOTAUX_PASSIF.map((t) => t.ref),
            'CC',
        ];
        expect(new Set(toutesLesRefs).size).toBe(toutesLesRefs.length);
    });
    it("l'ordre d'affichage couvre exactement les postes de détail + totaux, rien de plus, rien de moins", () => {
        const refsActif = new Set([...correspondance_projet_bilan_1.POSTES_ACTIF.map((p) => p.ref), ...correspondance_projet_bilan_1.TOTAUX_ACTIF.map((t) => t.ref)]);
        expect(new Set(correspondance_projet_bilan_1.ORDRE_AFFICHAGE_ACTIF)).toEqual(refsActif);
        const refsPassif = new Set([...correspondance_projet_bilan_1.POSTES_PASSIF.map((p) => p.ref), ...correspondance_projet_bilan_1.TOTAUX_PASSIF.map((t) => t.ref), 'CC']);
        expect(new Set(correspondance_projet_bilan_1.ORDRE_AFFICHAGE_PASSIF)).toEqual(refsPassif);
    });
    it('chaque total ne référence que des refs qui existent réellement (détail ou total imbriqué)', () => {
        const refsConnues = new Set([
            ...correspondance_projet_bilan_1.POSTES_ACTIF.map((p) => p.ref),
            ...correspondance_projet_bilan_1.POSTES_PASSIF.map((p) => p.ref),
            ...correspondance_projet_bilan_1.TOTAUX_ACTIF.map((t) => t.ref),
            ...correspondance_projet_bilan_1.TOTAUX_PASSIF.map((t) => t.ref),
            'CC',
        ]);
        for (const total of [...correspondance_projet_bilan_1.TOTAUX_ACTIF, ...correspondance_projet_bilan_1.TOTAUX_PASSIF]) {
            for (const ref of total.deRefs) {
                expect(refsConnues.has(ref)).toBe(true);
            }
        }
    });
    it('un total ne référence jamais une ref qui vient APRÈS lui dans sa propre liste · sinon le calcul en une passe casserait', () => {
        const dejaResolues = new Set([...correspondance_projet_bilan_1.POSTES_ACTIF.map((p) => p.ref), ...correspondance_projet_bilan_1.POSTES_PASSIF.map((p) => p.ref), 'CC']);
        for (const total of [...correspondance_projet_bilan_1.TOTAUX_ACTIF, ...correspondance_projet_bilan_1.TOTAUX_PASSIF]) {
            for (const ref of total.deRefs) {
                expect(dejaResolues.has(ref)).toBe(true);
            }
            dejaResolues.add(total.ref);
        }
    });
    it('BE (créances) et DH (dettes) portent un qualificatif de sens opposé sur les mêmes préfixes de tiers polyvalents · anomalie n° 2', () => {
        const be = correspondance_projet_bilan_1.POSTES_ACTIF.find((p) => p.ref === 'BE');
        const dh = correspondance_projet_bilan_1.POSTES_PASSIF.find((p) => p.ref === 'DH');
        expect(be.sens_qualificatif).toBe('DEBITEUR');
        expect(dh.sens_qualificatif).toBe('CREDITEUR');
    });
    it('aucun compte n’est réclamé par DEUX postes d’actif à la fois (déduction/comptage en double)', () => {
        const vus = new Map();
        for (const p of correspondance_projet_bilan_1.POSTES_ACTIF) {
            for (const c of p.comptes) {
                const precedent = vus.get(c);
                expect(precedent === undefined || precedent === p.ref).toBe(true);
                vus.set(c, p.ref);
            }
        }
    });
    it('aucun poste d’actif ne porte de comptes d’amortissement : ce jeu n’a pas de colonne Amort. (audit 2026-08-28)', () => {
        for (const p of correspondance_projet_bilan_1.POSTES_ACTIF) {
            expect(Object.keys(p)).not.toContain('comptesAmortissement');
            expect(p.comptes.some((c) => c.startsWith('28') || c.startsWith('29'))).toBe(false);
        }
    });
    it('BD exclut 411 ET 419, comme l’écrit le texte officiel', () => {
        const bd = correspondance_projet_bilan_1.POSTES_ACTIF.find((p) => p.ref === 'BD');
        expect(bd.exclusions).toEqual(['411', '419']);
    });
    it('DI transcrit le compte 20 tel quel · anomalie du texte officiel, signalée et non corrigée en silence', () => {
        const di = correspondance_projet_bilan_1.POSTES_PASSIF.find((p) => p.ref === 'DI');
        expect(di.comptes).toEqual(['20']);
    });
    it('DW capte 56 en direct ; les découverts 52/53 sont ajoutés à part dans le service (même mécanisme que le jeu associations)', () => {
        const dw = correspondance_projet_bilan_1.POSTES_PASSIF.find((p) => p.ref === 'DW');
        expect(dw.comptes).toEqual(['56']);
        expect(correspondance_projet_bilan_1.COMPTES_TRESORERIE_PASSIF_SI_CREDITEUR).toEqual(['52', '53']);
    });
    it('aucun compte n’est réclamé par DEUX postes de PASSIF · comparaison par préfixes, pas à l’identique', () => {
        const collisions = [];
        for (const p of correspondance_projet_bilan_1.POSTES_PASSIF) {
            for (const prefixe of p.comptes) {
                for (const autre of correspondance_projet_bilan_1.POSTES_PASSIF) {
                    if (autre.ref === p.ref)
                        continue;
                    if ((0, etats_financiers_communs_1.correspond)(prefixe, autre.comptes, autre.exclusions)) {
                        collisions.push(`${prefixe} (${p.ref}) capté aussi par ${autre.ref}`);
                    }
                }
            }
        }
        expect(collisions).toEqual([]);
    });
    it('DH exclut 478 ET 479 : DY porte seul l’écart de conversion-passif (anomalie n° 4)', () => {
        const dh = correspondance_projet_bilan_1.POSTES_PASSIF.find((p) => p.ref === 'DH');
        const dy = correspondance_projet_bilan_1.POSTES_PASSIF.find((p) => p.ref === 'DY');
        expect(dh.exclusions).toEqual(['478', '479']);
        expect(dy.comptes).toEqual(['479']);
        expect((0, etats_financiers_communs_1.correspond)('47910000', dh.comptes, dh.exclusions)).toBe(false);
        expect((0, etats_financiers_communs_1.correspond)('47910000', dy.comptes, dy.exclusions)).toBe(true);
        expect((0, etats_financiers_communs_1.correspond)('47120000', dh.comptes, dh.exclusions)).toBe(true);
    });
    it('4998 n’est PAS exclu de DH · il n’est capté que par DE, l’exclusion du jeu associations serait morte ici', () => {
        const dh = correspondance_projet_bilan_1.POSTES_PASSIF.find((p) => p.ref === 'DH');
        const de = correspondance_projet_bilan_1.POSTES_PASSIF.find((p) => p.ref === 'DE');
        expect(dh.exclusions).not.toContain('4998');
        expect((0, etats_financiers_communs_1.correspond)('49980000', dh.comptes, dh.exclusions)).toBe(false);
        expect((0, etats_financiers_communs_1.correspond)('49980000', de.comptes, de.exclusions)).toBe(true);
    });
});
//# sourceMappingURL=correspondance-projet-bilan.spec.js.map