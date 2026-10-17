"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PLAFOND_EXERCICES = exports.PLAFOND_LIGNES = void 0;
exports.motifRefusDefinition = motifRefusDefinition;
exports.calculerColonne = calculerColonne;
const lireTermes = (texte, motif) => {
    const termes = [];
    for (const brut of texte.replace(/([+-])/g, ' $1').split(/\s+/).filter(Boolean)) {
        const signe = brut.startsWith('-') ? -1 : 1;
        const valeur = brut.replace(/^[+-]/, '');
        if (!motif.test(valeur))
            return null;
        termes.push({ signe, valeur });
    }
    return termes.length ? termes : null;
};
exports.PLAFOND_LIGNES = 100;
exports.PLAFOND_EXERCICES = 5;
function motifRefusDefinition(lignes) {
    if (lignes.length === 0)
        return "L'état doit porter au moins une ligne.";
    if (lignes.length > exports.PLAFOND_LIGNES)
        return `Un état porte au plus ${exports.PLAFOND_LIGNES} lignes.`;
    const vues = new Set();
    for (const l of lignes) {
        if (!/^[A-Z][A-Z0-9_]{0,19}$/.test(l.cle))
            return `Clé « ${l.cle} » · une lettre majuscule, puis lettres, chiffres ou _.`;
        if (vues.has(l.cle))
            return `La clé ${l.cle} est employée deux fois.`;
        if (!l.libelle?.trim())
            return `La ligne ${l.cle} n'a pas de libellé.`;
        const estTotal = !!l.total?.trim();
        const estRubrique = !!l.racines?.trim();
        if (estTotal === estRubrique)
            return `La ligne ${l.cle} est soit une rubrique de comptes, soit un total · pas les deux, ni aucun.`;
        if (estRubrique) {
            const termes = lireTermes(l.racines, /^\d{1,13}$/);
            if (!termes)
                return `Ligne ${l.cle} · racines illisibles (« 70 71 -709 » attendu).`;
            const dejaVues = new Set();
            for (const t of termes) {
                if (dejaVues.has(t.valeur))
                    return `Ligne ${l.cle} · la racine ${t.valeur} est citée deux fois.`;
                dejaVues.add(t.valeur);
            }
            if (!termes.some((t) => t.signe === 1))
                return `Ligne ${l.cle} · au moins une racine incluse, un moins n'exclut que ce qu'une racine inclut.`;
            if (!l.mesure || !['SOLDE', 'MOUVEMENT'].includes(l.mesure))
                return `Ligne ${l.cle} · mesure SOLDE ou MOUVEMENT attendue.`;
            if (!l.sens || !['DEBIT', 'CREDIT'].includes(l.sens))
                return `Ligne ${l.cle} · sens DEBIT ou CREDIT attendu.`;
        }
        else {
            const termes = lireTermes(l.total, /^[A-Z][A-Z0-9_]{0,19}$/);
            if (!termes)
                return `Ligne ${l.cle} · total illisible (« A+B-C » attendu).`;
            for (const t of termes) {
                if (!vues.has(t.valeur))
                    return `Ligne ${l.cle} · le total cite ${t.valeur}, qui n'est pas une ligne PRÉCÉDENTE.`;
            }
        }
        vues.add(l.cle);
    }
    return null;
}
function calculerColonne(lignes, balance) {
    const valeurs = {};
    const arrondi = (n) => Math.round(n * 100) / 100 || 0;
    for (const l of lignes) {
        if (l.total?.trim()) {
            valeurs[l.cle] = arrondi(lireTermes(l.total, /.*/).reduce((s, t) => s + t.signe * (valeurs[t.valeur] ?? 0), 0));
            continue;
        }
        const termes = lireTermes(l.racines, /.*/);
        let somme = 0;
        for (const b of balance) {
            const t = termes.filter((x) => b.numero.startsWith(x.valeur)).sort((a, z) => z.valeur.length - a.valeur.length)[0];
            if (!t || t.signe === -1)
                continue;
            somme += l.mesure === 'MOUVEMENT' ? b.mouvementDebit - b.mouvementCredit : b.totalDebit - b.totalCredit;
        }
        valeurs[l.cle] = arrondi(l.sens === 'CREDIT' ? -somme : somme);
    }
    return valeurs;
}
//# sourceMappingURL=moteur-etat-personnalise.js.map