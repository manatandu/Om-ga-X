"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PLAFOND_MODELES = exports.NOM_STANDARD = exports.LONGUEUR_MAX_NOM_MODELE = exports.COLONNES_PAR_EDITION = void 0;
exports.modeleOuMotif = modeleOuMotif;
const client_1 = require("@prisma/client");
exports.COLONNES_PAR_EDITION = {
    PLAN_COMPTABLE: [
        { cle: 'numero', identifiante: true },
        { cle: 'intitule', identifiante: true },
        { cle: 'type', identifiante: false },
        { cle: 'nature', identifiante: false },
        { cle: 'report', identifiante: false },
        { cle: 'lettrable', identifiante: false },
        { cle: 'etat', identifiante: false },
    ],
    PLAN_TIERS: [
        { cle: 'code', identifiante: true },
        { cle: 'nom', identifiante: true },
        { cle: 'qualite', identifiante: false },
        { cle: 'type', identifiante: false },
        { cle: 'comptePrincipal', identifiante: false },
        { cle: 'ville', identifiante: false },
        { cle: 'telephone', identifiante: false },
        { cle: 'numeroImpot', identifiante: false },
        { cle: 'etat', identifiante: false },
    ],
    PLAN_ANALYTIQUE: [
        { cle: 'code', identifiante: true },
        { cle: 'intitule', identifiante: true },
        { cle: 'type', identifiante: false },
        { cle: 'bailleur', identifiante: false },
        { cle: 'debut', identifiante: false },
        { cle: 'fin', identifiante: false },
        { cle: 'etat', identifiante: false },
    ],
};
exports.LONGUEUR_MAX_NOM_MODELE = 60;
exports.NOM_STANDARD = 'Standard';
exports.PLAFOND_MODELES = 100;
function modeleOuMotif(edition, brut, avecNom = true) {
    let nom = '';
    if (avecNom) {
        nom = typeof brut.nom === 'string' ? brut.nom.trim() : '';
        if (!nom)
            return { motif: 'Le nom du modèle est exigé.' };
        if (nom.length > exports.LONGUEUR_MAX_NOM_MODELE)
            return { motif: `Le nom du modèle tient en ${exports.LONGUEUR_MAX_NOM_MODELE} caractères au plus.` };
        if (nom.toLocaleLowerCase('fr') === exports.NOM_STANDARD.toLocaleLowerCase('fr')) {
            return { motif: `« ${exports.NOM_STANDARD} » est le modèle intégré · choisissez un autre nom.` };
        }
    }
    if (!Array.isArray(brut.colonnes) || brut.colonnes.some((c) => typeof c !== 'string')) {
        return { motif: 'Les colonnes du modèle sont illisibles.' };
    }
    const catalogue = exports.COLONNES_PAR_EDITION[edition];
    const connues = new Map(catalogue.map((c) => [c.cle, c]));
    const demandees = new Set();
    for (const cle of brut.colonnes) {
        const c = connues.get(cle);
        if (!c)
            return { motif: `Colonne inconnue pour cette édition · « ${cle} ».` };
        if (demandees.has(cle))
            return { motif: `Colonne en double · « ${cle} ».` };
        demandees.add(cle);
    }
    if (brut.saut === null)
        return { motif: 'Saut inconnu · AUCUN, LIGNE ou PAGE.' };
    const saut = brut.saut ?? client_1.SautEdition.AUCUN;
    if (!Object.values(client_1.SautEdition).includes(saut))
        return { motif: 'Saut inconnu · AUCUN, LIGNE ou PAGE.' };
    return {
        nom,
        colonnes: catalogue.filter((c) => !c.identifiante && demandees.has(c.cle)).map((c) => c.cle),
        saut: saut,
    };
}
//# sourceMappingURL=modeles-edition.js.map