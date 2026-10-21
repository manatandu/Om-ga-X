"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.motifRefusFonctions = motifRefusFonctions;
function motifRefusFonctions(lignes) {
    const equilibres = lignes.filter((l) => (l.fonction ?? 'SAISIR') === 'EQUILIBRER').length;
    if (equilibres > 1) {
        return 'Une seule ligne peut équilibrer la pièce · deux lignes « Équilibrer » se partageraient un solde que rien ne dit comment répartir.';
    }
    for (let i = 0; i < lignes.length; i++) {
        const f = lignes[i].fonction ?? 'SAISIR';
        const rang = i + 1;
        if ((f === 'REPETER' || f === 'CALCULER') && i === 0) {
            return `Ligne ${rang} · « ${f === 'REPETER' ? 'Répéter' : 'Calculer'} » s'appuie sur la ligne précédente, la première ligne n'en a pas.`;
        }
        if (f === 'CALCULER' && !lignes[i].tauxTvaId) {
            return `Ligne ${rang} · « Calculer » demande le taux de taxe à appliquer.`;
        }
        if (f !== 'CALCULER' && lignes[i].tauxTvaId) {
            return `Ligne ${rang} · un taux de taxe ne sert qu'à une ligne « Calculer ».`;
        }
        if (f !== 'SAISIR' && lignes[i].montant !== undefined && lignes[i].montant !== null) {
            return `Ligne ${rang} · un montant figé ne vaut que pour une ligne « Saisir » · les autres fonctions le calculent.`;
        }
    }
    return null;
}
//# sourceMappingURL=fonctions-modele.js.map