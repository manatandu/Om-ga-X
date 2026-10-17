"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PLAFOND_SELECTIONS = exports.LONGUEUR_MAX_NOM = exports.LONGUEUR_MAX_CRITERE = exports.CRITERES_PAR_EDITION = void 0;
exports.nomOuMotif = nomOuMotif;
exports.criteresSelectionOuMotif = criteresSelectionOuMotif;
exports.CRITERES_PAR_EDITION = {
    JOURNAL: {
        journalId: 'identifiant',
        dateDebut: 'date',
        dateFin: 'date',
        recherche: 'chaine',
        compte: 'chaine',
        montant: 'chaine',
        montantMax: 'chaine',
        numeroPiece: 'chaine',
        reference: 'chaine',
        inclureBrouillard: 'booleen',
    },
    IMPRESSION_DIFFEREE: {
        nature: ['JOURNAL', 'GRAND_LIVRE', 'BALANCE'],
        journalId: 'identifiant',
        dateDebut: 'date',
        dateFin: 'date',
        inclureBrouillard: 'booleen',
        format: ['fpm', 'plat'],
        grandsLivres: 'booleen',
    },
};
exports.LONGUEUR_MAX_CRITERE = 100;
exports.LONGUEUR_MAX_NOM = 60;
exports.PLAFOND_SELECTIONS = 200;
const JOUR = /^\d{4}-\d{2}-\d{2}$/;
function nomOuMotif(brut) {
    const nom = typeof brut === 'string' ? brut.trim() : '';
    if (!nom)
        return { motif: 'Le nom de la sélection est exigé.' };
    if (nom.length > exports.LONGUEUR_MAX_NOM)
        return { motif: `Le nom de la sélection tient en ${exports.LONGUEUR_MAX_NOM} caractères au plus.` };
    return { nom };
}
function criteresSelectionOuMotif(edition, brut) {
    if (!brut || typeof brut !== 'object' || Array.isArray(brut))
        return { motif: 'Les critères de la sélection sont illisibles.' };
    const regles = exports.CRITERES_PAR_EDITION[edition];
    const criteres = {};
    for (const [cle, valeur] of Object.entries(brut)) {
        if (cle === 'exerciceId') {
            return { motif: "Une sélection ne garde pas l'exercice · elle se rappelle sur l'exercice choisi." };
        }
        const regle = regles[cle];
        if (!regle)
            return { motif: `Critère inconnu pour cette édition · « ${cle} ».` };
        if (valeur === null || valeur === undefined || valeur === '')
            continue;
        if (regle === 'booleen') {
            if (typeof valeur !== 'boolean')
                return { motif: `Critère « ${cle} » · oui ou non.` };
            criteres[cle] = valeur;
            continue;
        }
        if (typeof valeur !== 'string')
            return { motif: `Critère « ${cle} » illisible.` };
        if (valeur.length > exports.LONGUEUR_MAX_CRITERE)
            return { motif: `Critère « ${cle} » trop long (${exports.LONGUEUR_MAX_CRITERE} caractères au plus).` };
        if (regle === 'date' && (!JOUR.test(valeur) || Number.isNaN(Date.parse(`${valeur}T00:00:00Z`)))) {
            return { motif: `Critère « ${cle} » · une date AAAA-MM-JJ est attendue.` };
        }
        if (Array.isArray(regle) && !regle.includes(valeur)) {
            return { motif: `Critère « ${cle} » · ${regle.map((v) => `« ${v} »`).join(', ')}.` };
        }
        criteres[cle] = valeur;
    }
    return { criteres };
}
//# sourceMappingURL=selections-edition.js.map