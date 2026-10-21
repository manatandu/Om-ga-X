"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.COLONNE_DU_TIERS = exports.LIBELLES_NATURE_MODELE = exports.PLAFOND_MODELES_IMPRESSION = exports.LONGUEUR_TEXTE_MODELE = exports.LONGUEUR_INTITULE_MODELE = exports.JETONS_MODELE_IMPRESSION = exports.JETON_DOCUMENT = void 0;
exports.natureDuNiveau = natureDuNiveau;
exports.intituleDuModele = intituleDuModele;
exports.motifRefusIntituleModele = motifRefusIntituleModele;
exports.motifRefusTexteModele = motifRefusTexteModele;
exports.adresseDuTiers = adresseDuTiers;
exports.jourImprime = jourImprime;
exports.cadreDuModele = cadreDuModele;
exports.habiller = habiller;
exports.motifRefusAttribution = motifRefusAttribution;
exports.JETON_DOCUMENT = '{document}';
exports.JETONS_MODELE_IMPRESSION = [
    { jeton: 'document', sens: 'le document composé par OmegaX (lettre de relance, relevé, avis de règlement)' },
    { jeton: 'tiers', sens: 'le nom du tiers' },
    { jeton: 'code', sens: 'le code du tiers' },
    { jeton: 'qualite', sens: 'la qualité du tiers' },
    { jeton: 'contact', sens: 'la personne à qui la lettre s’adresse' },
    { jeton: 'adresse', sens: 'l’adresse, la boîte postale, la ville et le pays de la fiche' },
    { jeton: 'entite', sens: 'le nom du dossier' },
    { jeton: 'date', sens: 'le jour du document' },
];
const NOMS_JETONS = new Set(exports.JETONS_MODELE_IMPRESSION.map((j) => j.jeton));
exports.LONGUEUR_INTITULE_MODELE = 35;
exports.LONGUEUR_TEXTE_MODELE = 4000;
exports.PLAFOND_MODELES_IMPRESSION = 100;
exports.LIBELLES_NATURE_MODELE = {
    EXTRAIT: 'Extrait de compte',
    REGLEMENT: 'Avis de règlement',
    RAPPEL: 'Rappel',
};
const DOCUMENT_DE_LA_NATURE = {
    EXTRAIT: 'l’extrait de compte',
    REGLEMENT: 'l’avis de règlement',
    RAPPEL: 'le rappel',
};
function natureDuNiveau(type) {
    return type === 'RELEVE' ? 'EXTRAIT' : 'RAPPEL';
}
exports.COLONNE_DU_TIERS = {
    EXTRAIT: 'modeleImpressionExtraitId',
    REGLEMENT: 'modeleImpressionReglementId',
    RAPPEL: 'modeleImpressionRappelId',
};
function intituleDuModele(brut) {
    return brut.trim().replace(/\s+/g, ' ');
}
function motifRefusIntituleModele(intitule, autres, idModifie) {
    if (!intitule)
        return "L'intitulé du modèle est obligatoire.";
    if (intitule.length > exports.LONGUEUR_INTITULE_MODELE) {
        return `L'intitulé du modèle tient en ${exports.LONGUEUR_INTITULE_MODELE} caractères au plus.`;
    }
    const pris = autres.find((a) => a.id !== idModifie && a.intitule.toLocaleLowerCase('fr') === intitule.toLocaleLowerCase('fr'));
    return pris ? `Le dossier a déjà un modèle « ${pris.intitule} » pour ce document.` : null;
}
const MOTIF_JETON = /\{([^{}]*)\}/g;
function jetonsDuTexte(texte) {
    return [...texte.matchAll(MOTIF_JETON)].map((m) => m[1]);
}
function motifRefusTexteModele(texte) {
    if (!texte.trim())
        return 'Le texte du modèle est obligatoire.';
    if (texte.length > exports.LONGUEUR_TEXTE_MODELE)
        return `Le texte du modèle tient en ${exports.LONGUEUR_TEXTE_MODELE} caractères au plus.`;
    const jetons = jetonsDuTexte(texte);
    const inconnus = [...new Set(jetons.filter((j) => !NOMS_JETONS.has(j)))];
    if (inconnus.length) {
        return (`Jeton inconnu : ${inconnus.map((j) => `{${j}}`).join(', ')} · il s'imprimerait tel quel sur la lettre du tiers. ` +
            `Jetons admis : ${[...NOMS_JETONS].map((j) => `{${j}}`).join(', ')}.`);
    }
    const documents = jetons.filter((j) => j === 'document').length;
    if (documents !== 1) {
        return documents === 0
            ? `Le modèle porte le jeton ${exports.JETON_DOCUMENT}, là où s'imprime le document · sans lui, la lettre partirait sans ce qu'elle réclame ou acquitte.`
            : `Le modèle porte le jeton ${exports.JETON_DOCUMENT} une fois et une seule · le document s'imprimerait ${documents} fois.`;
    }
    return null;
}
function adresseDuTiers(t) {
    return [t.adresse, t.boitePostale, t.ville, t.pays].map((x) => (x ?? '').trim()).filter(Boolean).join('\n');
}
function jourImprime(jour) {
    return jour.toLocaleDateString('fr-FR', { timeZone: 'UTC' });
}
function cadreDuModele(modele, tiers, contexte) {
    const valeurs = {
        tiers: tiers.nom,
        code: tiers.code,
        qualite: tiers.qualite ?? '',
        contact: tiers.contact ?? '',
        adresse: adresseDuTiers(tiers),
        entite: contexte.entite,
        date: jourImprime(contexte.jour),
    };
    const remplacer = (morceau) => morceau.replace(MOTIF_JETON, (brut, nom) => valeurs[nom] ?? brut);
    const position = modele.texte.indexOf(exports.JETON_DOCUMENT);
    if (position < 0)
        return { modele: modele.intitule, avant: remplacer(modele.texte), apres: '' };
    return {
        modele: modele.intitule,
        avant: remplacer(modele.texte.slice(0, position)),
        apres: remplacer(modele.texte.slice(position + exports.JETON_DOCUMENT.length)),
    };
}
function habiller(cadre, document) {
    return cadre ? `${cadre.avant}${document}${cadre.apres}` : document;
}
function motifRefusAttribution(attendue, modele) {
    return modele.nature === attendue
        ? null
        : `Le modèle « ${modele.intitule} » habille ${DOCUMENT_DE_LA_NATURE[modele.nature]}, pas ${DOCUMENT_DE_LA_NATURE[attendue]} · choisissez un modèle de cette nature.`;
}
//# sourceMappingURL=modeles-impression.js.map