"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const compte_seed_1 = require("../comptes/compte-seed");
const etats_financiers_communs_1 = require("../etats-financiers/etats-financiers.communs");
const correspondance_compte_resultat_1 = require("../etats-financiers/correspondance-compte-resultat");
const correspondance_notes_associations_1 = require("./correspondance-notes-associations");
const correspondance_notes_projets_1 = require("./correspondance-notes-projets");
const notes_sycebnl_commun_1 = require("./notes-sycebnl.commun");
const COMPTES_DETAIL_SEMES = compte_seed_1.PLAN_COMPTES_SYCEBNL.filter((c) => c.typeCompte !== 'TOTAL').map((c) => c.numero);
function atteintUnCompteSeme(prefixe) {
    return COMPTES_DETAIL_SEMES.some((numero) => (0, etats_financiers_communs_1.correspond)(numero, [prefixe]));
}
function prefixesMorts(table) {
    const morts = new Set();
    for (const n of table) {
        for (const r of n.rubriques) {
            for (const p of r.comptes ?? [])
                if (!atteintUnCompteSeme(p))
                    morts.add(p);
        }
    }
    return [...morts].sort();
}
function rubriquesMortes(table) {
    const morts = [];
    for (const n of table) {
        for (const r of n.rubriques) {
            const cites = r.comptes ?? [];
            if (cites.length > 0 && cites.every((p) => !atteintUnCompteSeme(p))) {
                morts.push(`${(0, notes_sycebnl_commun_1.etiquette)(n)} · ${r.libelle} · [${cites.join(', ')}]`);
            }
        }
    }
    return morts.sort();
}
describe('SYCEBNL · un préfixe de note qui ne joint aucun compte semé', () => {
    const MORTS_ASSOCIATIONS = [];
    const MORTS_PROJETS = [];
    it('jeu associations · la liste des préfixes qui ne joignent rien ne s’allonge pas', () => {
        expect(prefixesMorts(correspondance_notes_associations_1.NOTES_ASSOCIATIONS)).toEqual(MORTS_ASSOCIATIONS);
    });
    it('jeu projets de développement · même relevé, gelé lui aussi', () => {
        expect(prefixesMorts(correspondance_notes_projets_1.NOTES_PROJETS)).toEqual(MORTS_PROJETS);
    });
    it('les rubriques qu’aucun compte semé ne peut chiffrer sont nommées, une à une', () => {
        expect(rubriquesMortes(correspondance_notes_associations_1.NOTES_ASSOCIATIONS)).toEqual([]);
        expect(rubriquesMortes(correspondance_notes_projets_1.NOTES_PROJETS)).toEqual([]);
    });
});
describe('SYCEBNL · les comptes 65 et 66 semés que les notes 28 et 29A perdent', () => {
    it('la note contredit le poste du compte de résultat qu’elle détaille', () => {
        const perdusDe = (table) => {
            const rubriques = table
                .filter((n) => !n.horsBalance)
                .flatMap((n) => n.rubriques)
                .filter((r) => (r.comptes ?? []).length > 0);
            return COMPTES_DETAIL_SEMES.filter((numero) => /^6[56]/.test(numero) && !rubriques.some((r) => (0, etats_financiers_communs_1.correspond)(numero, r.comptes, r.exclusions)));
        };
        const perdus = perdusDe(correspondance_notes_associations_1.NOTES_ASSOCIATIONS);
        expect(perdusDe(correspondance_notes_projets_1.NOTES_PROJETS)).toEqual(['65120000', '65200000', '66500000']);
        expect(perdus).toEqual([]);
        const poste = (ref) => correspondance_compte_resultat_1.POSTES_CHARGES.find((p) => p.ref === ref);
        for (const numero of COMPTES_DETAIL_SEMES.filter((n) => /^6[56]/.test(n))) {
            const pris = ['TI', 'TJ'].some((ref) => (0, etats_financiers_communs_1.correspond)(numero, poste(ref).comptes ?? []));
            expect({ numero, prisAuCompteDeResultat: pris }).toEqual({ numero, prisAuCompteDeResultat: true });
        }
    });
});
describe('SYCEBNL · les rubriques des notes 28, 29A, 19 et 20A restent celles du texte', () => {
    const attendu = (table, code) => table
        .filter((n) => n.code === code)
        .flatMap((n) => n.rubriques)
        .filter((r) => (r.comptes ?? []).length > 0)
        .map((r) => [r.libelle, (r.comptes ?? []).join('+')]);
    it('note 28 · deux lignes, deux sous-comptes du 651, transcrits du texte', () => {
        expect(attendu(correspondance_notes_associations_1.NOTES_ASSOCIATIONS, '28').slice(0, 2)).toEqual([
            ['Pertes sur créances adhérents', '6512'],
            ['Pertes sur Clients et autres débiteurs', '6511+6515'],
        ]);
    });
    it('note 29A · les charges sociales restent ventilées national / non national', () => {
        const lignes = new Map(attendu(correspondance_notes_associations_1.NOTES_ASSOCIATIONS, '29A'));
        expect(lignes.get('Charges sociales (personnel national)')).toBe('6641');
        expect(lignes.get('Charges sociales (personnel non national)')).toBe('6642');
    });
    it('jeu projets · notes 19 et 20A, même exigence', () => {
        const n19 = new Map(attendu(correspondance_notes_projets_1.NOTES_PROJETS, '19'));
        expect(n19.get('Pertes sur créances')).toBe('6511');
        expect(n19.get('Pertes sur autres débiteurs')).toBe('6515');
        const n20a = new Map(attendu(correspondance_notes_projets_1.NOTES_PROJETS, '20A'));
        expect(n20a.get('Charges sociales (personnel national)')).toBe('6641');
        expect(n20a.get('Charges sociales (personnel non national)')).toBe('6642');
    });
});
describe('SYCEBNL · une rubrique que le plan détermine ne se dit pas « en attente »', () => {
    const normaliser = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    const semes = compte_seed_1.PLAN_COMPTES_SYCEBNL.filter((c) => c.typeCompte !== 'TOTAL' && /^[67]/.test(c.numero));
    const intituleDe = (c) => {
        const segments = c.intitule.split(' · ');
        return [normaliser(c.intitule), normaliser(segments[segments.length - 1])];
    };
    it('jeu projets · aucune rubrique en attente ne porte l’intitulé d’un compte Détail semé', () => {
        const fautives = [];
        for (const n of correspondance_notes_projets_1.NOTES_PROJETS) {
            for (const r of n.rubriques) {
                if (!r.subdivisionAttendue)
                    continue;
                const comptes = semes.filter((c) => intituleDe(c).includes(normaliser(r.libelle))).map((c) => c.numero);
                if (comptes.length)
                    fautives.push(`${(0, notes_sycebnl_commun_1.etiquette)(n)} · ${r.libelle} · ${comptes.join(', ')}`);
            }
        }
        expect(fautives).toEqual([]);
    });
});
describe('SYCEBNL · les dettes sociales semées ont chacune leur ligne', () => {
    it('tout compte Détail semé du 43 (hors 4387, débiteur) est lu par exactement une rubrique des notes 12 (projets) et 20 (associations)', () => {
        for (const [table, code] of [[correspondance_notes_projets_1.NOTES_PROJETS, '12'], [correspondance_notes_associations_1.NOTES_ASSOCIATIONS, '20']]) {
            const rubriques = table
                .filter((n) => n.code === code)
                .flatMap((n) => n.rubriques)
                .filter((r) => (r.comptes ?? []).length > 0);
            for (const numero of COMPTES_DETAIL_SEMES.filter((n) => n.startsWith('43') && !n.startsWith('4387'))) {
                const lecteurs = rubriques.filter((r) => (0, etats_financiers_communs_1.correspond)(numero, r.comptes, r.exclusions)).map((r) => r.libelle);
                expect({ code, numero, nombre: lecteurs.length }).toEqual({ code, numero, nombre: 1 });
            }
        }
    });
});
//# sourceMappingURL=rattachement-des-notes-au-semis.spec.js.map