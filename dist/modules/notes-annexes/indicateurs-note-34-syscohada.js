"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PRECISION_NOTE_34 = exports.INDICATEURS_NOTE_34_LAISSES_EN_SAISIE = void 0;
exports.indicateursNote34Syscohada = indicateursNote34Syscohada;
const etats_financiers_communs_1 = require("../etats-financiers/etats-financiers.communs");
const correspondance_notes_syscohada_3_1 = require("../etats-financiers-syscohada/correspondance-notes-syscohada-3");
const correspondance_compte_resultat_syscohada_1 = require("../etats-financiers-syscohada/correspondance-compte-resultat-syscohada");
const correspondance_tft_syscohada_1 = require("../etats-financiers-syscohada/correspondance-tft-syscohada");
const indicateurs_note_33_1 = require("./indicateurs-note-33");
exports.INDICATEURS_NOTE_34_LAISSES_EN_SAISIE = ['rentabilite-economique'];
exports.PRECISION_NOTE_34 = 'Calculée depuis le bilan, le compte de résultat et le tableau des flux de la liasse. La ligne « autres ' +
    'charges HAO », absente de la maquette, est retenue dans la CAFG, qui égale alors le poste FA du tableau des ' +
    'flux. Le renvoi (b) n’est pas appliqué, le bilan ne rattachant les écarts de conversion (BU, DV) à aucune ' +
    'créance ni dette · leur écart se lit sur la ligne CONTRÔLE. La rentabilité économique reste à saisir : ' +
    'l’impôt théorique du renvoi (a) n’est porté par aucun état.';
const REFS_CHARGES = new Set(correspondance_compte_resultat_syscohada_1.POSTES_CHARGES_SYSCOHADA.map((p) => p.ref));
function fluxVidesEnN(flux) {
    if (flux.postesVides)
        return new Set(flux.postesVides);
    const vides = new Set();
    if (flux.exerciceN1Disponible)
        return vides;
    for (const p of flux.postesNonCalculables)
        vides.add(p.ref);
    for (const total of correspondance_tft_syscohada_1.TOTAUX_FLUX_SYSCOHADA) {
        if (total.deRefs.some((r) => vides.has(r)))
            vides.add(total.ref);
    }
    return vides;
}
function indicateursNote34Syscohada(etats, lignesN, lignesN1, exerciceN1Disponible) {
    const parRef = (postes) => new Map(postes.filter((p) => p.ref).map((p) => [p.ref, p]));
    const bilan = parRef([...etats.bilan.actif, ...etats.bilan.passif]);
    const cr = parRef(etats.compteDeResultat.lignes);
    const flux = parRef(etats.fluxTresorerie.lignes.filter((l) => !('section' in l)));
    const videsN = fluxVidesEnN(etats.fluxTresorerie);
    const pourUnExercice = (colonne) => {
        const lire = (p) => {
            if (!p)
                return null;
            const v = colonne === 'N' ? p.montant : p.montantN1;
            return v === undefined || v === null ? null : v;
        };
        const lignes = colonne === 'N' ? lignesN : lignesN1;
        const valeurs = new Map();
        const terme = (t) => {
            let v;
            switch (t.source) {
                case 'COMPTE_RESULTAT': {
                    const brut = lire(cr.get(t.ref));
                    v = brut === null ? null : REFS_CHARGES.has(t.ref) ? -brut : brut;
                    break;
                }
                case 'BILAN':
                    v = lire(bilan.get(t.ref));
                    break;
                case 'FLUX_TRESORERIE':
                    v = colonne === 'N' && videsN.has(t.ref) ? null : lire(flux.get(t.ref));
                    break;
                case 'COMPTE': {
                    if (colonne === 'N1' && !exerciceN1Disponible) {
                        v = null;
                        break;
                    }
                    v = lignes
                        .filter((l) => (0, etats_financiers_communs_1.correspond)(l.numero, [t.ref]))
                        .reduce((s, l) => s + (t.solde === 'CREDITEUR' ? l.totalCredit - l.totalDebit : l.totalDebit - l.totalCredit), 0);
                    break;
                }
                case 'LIGNE':
                    v = valeurs.get(t.ref) ?? null;
                    break;
            }
            return v === null ? null : t.signe * v;
        };
        const somme = (termes) => {
            let s = 0;
            for (const t of termes) {
                const v = terme(t);
                if (v === null)
                    return null;
                s += v;
            }
            return s;
        };
        for (const l of correspondance_notes_syscohada_3_1.FICHE_SYNTHESE_SYSCOHADA) {
            if (exports.INDICATEURS_NOTE_34_LAISSES_EN_SAISIE.includes(l.cle))
                continue;
            if (l.ratio) {
                const num = somme(l.ratio.numerateur);
                const den = somme(l.ratio.denominateur);
                valeurs.set(l.cle, num === null || den === null || Math.abs(den) < 0.005 ? null : (num / den) * 100);
            }
            else {
                valeurs.set(l.cle, somme(l.termes ?? []));
            }
        }
        return valeurs;
    };
    const n = pourUnExercice('N');
    const n1 = exerciceN1Disponible ? pourUnExercice('N1') : null;
    const unite = (l) => (l.ratio ? 'POURCENT' : 'MONTANT');
    return correspondance_notes_syscohada_3_1.FICHE_SYNTHESE_SYSCOHADA.filter((l) => !exports.INDICATEURS_NOTE_34_LAISSES_EN_SAISIE.includes(l.cle)).map((l) => {
        const u = unite(l);
        const echelle = u === 'POURCENT' ? 1 : indicateurs_note_33_1.MILLIERS_DE_FRANCS;
        const aLEchelle = (v) => (v === null || v === undefined ? null : v / echelle);
        return { cle: l.cle, unite: u, valeurN: aLEchelle(n.get(l.cle)), valeurN1: n1 ? aLEchelle(n1.get(l.cle)) : null };
    });
}
//# sourceMappingURL=indicateurs-note-34-syscohada.js.map