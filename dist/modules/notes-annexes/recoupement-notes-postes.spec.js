"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const correspondance_notes_associations_1 = require("./correspondance-notes-associations");
const correspondance_bilan_1 = require("../etats-financiers/correspondance-bilan");
const correspondance_compte_resultat_1 = require("../etats-financiers/correspondance-compte-resultat");
const compte_seed_1 = require("../comptes/compte-seed");
const RENVOIS_OFFICIELS = {
    '5A': ['AA', 'AD', 'AH'],
    '5F': ['AE', 'CE'],
    '6': ['AO'],
    '8': ['BB', 'TB', 'TE'],
    '10': ['BE'],
    '11': ['BU'],
    '12': ['BV'],
    '13': ['BW'],
    '14': ['BY', 'DY'],
    '19': ['BC', 'DH'],
    '15': ['CA', 'CB', 'CC', 'CD'],
    '16': ['CF', 'CG'],
    '17A': ['CI', 'CJ'],
    '17B': ['CW', 'CX'],
    '18A': ['DA', 'DB', 'DC'],
    '20': ['DI'],
    '21': ['DI'],
    '22': ['DW'],
    '23': ['RA', 'RB', 'RC', 'RD', 'RE', 'RF', 'RG'],
    '24': ['TA', 'TC', 'TD'],
    '25': ['TF'],
    '26': ['TG'],
    '27': ['TH'],
    '28': ['TI'],
    '29A': ['TJ'],
    '31': ['TK'],
    '32': ['TM', 'TN'],
    '5D': ['RH', 'TL'],
    '30': ['RH', 'TL'],
};
const REFS_DU_MODELE = new Set([
    ...correspondance_bilan_1.POSTES_ACTIF.map((p) => p.ref),
    ...correspondance_bilan_1.POSTES_PASSIF.map((p) => p.ref),
    ...correspondance_bilan_1.TOTAUX_ACTIF.map((t) => t.ref),
    ...correspondance_bilan_1.TOTAUX_PASSIF.map((t) => t.ref),
    ...correspondance_compte_resultat_1.TOUS_LES_POSTES.map((p) => p.ref),
    'CH',
    'XA',
    'XB',
    'XC',
    'XD',
    'XE',
]);
const COMPTES_SEMIS = compte_seed_1.PLAN_COMPTES_SYCEBNL.filter((c) => c.typeCompte !== 'TOTAL').map((c) => c.numero);
function capte(o, n) {
    return (o.comptes ?? []).some((p) => n.startsWith(p)) && !(o.exclusions ?? []).some((e) => n.startsWith(e));
}
function etiquette(n) {
    return n.sousTableau ? `${n.code}/${n.sousTableau}` : n.code;
}
describe('SYCEBNL · référence croisée note ↔ poste (art. 15)', () => {
    it('aucun renvoi ne désigne un code absent du modèle SYCEBNL', () => {
        const inconnus = [];
        for (const n of correspondance_notes_associations_1.NOTES_ASSOCIATIONS) {
            for (const ref of n.renvoyeeDepuis ?? []) {
                if (!REFS_DU_MODELE.has(ref))
                    inconnus.push(`${etiquette(n)} -> ${ref}`);
            }
        }
        expect(inconnus).toEqual([]);
    });
    it('chaque note renvoyée l’est depuis les postes que la maquette lui donne', () => {
        for (const [code, attendus] of Object.entries(RENVOIS_OFFICIELS)) {
            const notes = correspondance_notes_associations_1.NOTES_ASSOCIATIONS.filter((n) => n.code === code);
            expect([code, notes.length > 0]).toEqual([code, true]);
            const declares = new Set(notes.flatMap((n) => n.renvoyeeDepuis ?? []));
            for (const ref of attendus) {
                expect([code, ref, declares.has(ref)]).toEqual([code, ref, true]);
            }
            for (const ref of declares) {
                expect([code, ref, attendus.includes(ref)]).toEqual([code, ref, true]);
            }
        }
    });
    it('les sous-tableaux 5B et 5E ne portent AUCUN renvoi · le texte ne leur en donne pas', () => {
        for (const code of ['5B', '5E']) {
            const notes = correspondance_notes_associations_1.NOTES_ASSOCIATIONS.filter((n) => n.code === code);
            expect([code, notes.length > 0]).toEqual([code, true]);
            for (const n of notes)
                expect([code, n.renvoyeeDepuis ?? []]).toEqual([code, []]);
        }
    });
    it('un poste ne renvoie jamais vers deux notes qui se contrediraient', () => {
        const parPoste = new Map();
        for (const [code, refs] of Object.entries(RENVOIS_OFFICIELS)) {
            for (const ref of refs)
                parPoste.set(ref, [...(parPoste.get(ref) ?? []), code]);
        }
        const partages = [...parPoste]
            .filter(([, codes]) => codes.length > 1)
            .map(([ref, codes]) => `${ref}:${[...codes].sort().join(',')}`);
        expect(partages.sort()).toEqual(['DI:20,21', 'RH:30,5D', 'TL:30,5D']);
    });
});
describe('SYCEBNL · les comptes d’une note et ceux de son poste', () => {
    it('le volume des écarts poste ↔ note reste sous contrôle', () => {
        const postes = new Map();
        for (const p of [...correspondance_bilan_1.POSTES_ACTIF, ...correspondance_bilan_1.POSTES_PASSIF])
            postes.set(p.ref, p);
        for (const p of correspondance_compte_resultat_1.TOUS_LES_POSTES)
            postes.set(p.ref, p);
        const dw = postes.get('DW');
        postes.set('DW', { ...dw, comptes: [...(dw.comptes ?? []), ...correspondance_bilan_1.COMPTES_TRESORERIE_PASSIF_SI_CREDITEUR] });
        const parent = new Map();
        const racine = (x) => {
            const p = parent.get(x);
            if (!p || p === x) {
                parent.set(x, x);
                return x;
            }
            const r = racine(p);
            parent.set(x, r);
            return r;
        };
        const relier = (a, b) => parent.set(racine(a), racine(b));
        const notes = correspondance_notes_associations_1.NOTES_ASSOCIATIONS.filter((n) => !n.horsBalance && (n.renvoyeeDepuis ?? []).some((r) => postes.has(r)));
        for (const n of notes) {
            const cle = `N:${etiquette(n)}`;
            racine(cle);
            for (const ref of n.renvoyeeDepuis ?? [])
                if (postes.has(ref))
                    relier(cle, `P:${ref}`);
        }
        const composantes = new Map();
        for (const n of notes) {
            const g = racine(`N:${etiquette(n)}`);
            const e = composantes.get(g) ?? { notes: [], refs: [] };
            e.notes.push(n);
            composantes.set(g, e);
        }
        for (const ref of postes.keys()) {
            if (!parent.has(`P:${ref}`))
                continue;
            composantes.get(racine(`P:${ref}`))?.refs.push(ref);
        }
        let horsPoste = 0;
        let sansLigne = 0;
        for (const { notes: groupe, refs } of composantes.values()) {
            const auxPostes = new Set(COMPTES_SEMIS.filter((num) => refs.some((r) => {
                const p = postes.get(r);
                return capte(p, num) || capte({ comptes: p.comptesAmortissement }, num);
            })));
            const rubriques = groupe.flatMap((n) => n.rubriques).filter((r) => (r.comptes ?? []).length > 0);
            const dansNotes = new Set(COMPTES_SEMIS.filter((num) => rubriques.some((r) => capte(r, num))));
            horsPoste += [...dansNotes].filter((x) => !auxPostes.has(x)).length;
            sansLigne += [...auxPostes].filter((x) => !dansNotes.has(x)).length;
        }
        expect({ horsPoste, sansLigne }).toEqual({ horsPoste: 146, sansLigne: 125 });
    });
    it('le nombre de comptes qu’aucune note ne chiffre reste sous contrôle', () => {
        const rubriques = correspondance_notes_associations_1.NOTES_ASSOCIATIONS.filter((n) => !n.horsBalance)
            .flatMap((n) => n.rubriques)
            .filter((r) => (r.comptes ?? []).length > 0);
        const orphelins = COMPTES_SEMIS.filter((num) => !rubriques.some((r) => capte(r, num)));
        expect(orphelins.length).toBe(55);
    });
});
//# sourceMappingURL=recoupement-notes-postes.spec.js.map