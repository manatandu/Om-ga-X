"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AUTEUR_NON_ENREGISTRE = exports.STATUTS_MESSAGE = exports.TYPES_LICENCE = void 0;
exports.motifAcceptationFermee = motifAcceptationFermee;
exports.estAJour = estAJour;
exports.empreinteCommande = empreinteCommande;
exports.motifRefusAcceptation = motifRefusAcceptation;
exports.detailCommande = detailCommande;
exports.motifRefusRenvoiAccuse = motifRefusRenvoiAccuse;
exports.etatConditions = etatConditions;
const facturation_abonnements_1 = require("../plateforme/abonnements/facturation-abonnements");
const conditions_de_licence_1 = require("./conditions-de-licence");
const empreinte_1 = require("./empreinte");
const versions_publiees_1 = require("./versions-publiees");
exports.TYPES_LICENCE = ['ABONNEMENT', 'PERPETUEL_SAAS', 'PERPETUEL_ONPREMISE', 'PROPRIETAIRE'];
exports.STATUTS_MESSAGE = ['EN_ATTENTE', 'SANS_TRANSPORT', 'ENVOYE', 'ECHEC', 'ABANDONNE'];
exports.AUTEUR_NON_ENREGISTRE = 'auteur non enregistré';
function motifAcceptationFermee(c) {
    if (c.mentions.length > 0) {
        return ('L’acceptation en ligne s’ouvrira quand l’offre dira ce que la loi exige qu’elle dise avant toute commande ' +
            `(Code du numérique, art. 54, al. 2) · ${c.mentions.join(' ; ')}.`);
    }
    if (!c.surSite && c.typeLicence === 'PROPRIETAIRE')
        return 'Le dossier de l’éditeur ne contracte pas avec lui-même.';
    if (c.estDemonstration)
        return 'Un dossier de démonstration ne porte aucun contrat.';
    if (!c.surSite && c.typeLicence === 'PERPETUEL_SAAS') {
        return ('Ce dossier tient une licence perpétuelle hébergée, que les présentes conditions ne décrivent pas · ' +
            'ses conditions et son prix sont à arrêter par VMG Consulting avant toute acceptation en ligne ' +
            '(Code du numérique, art. 53, 5°, et art. 55, al. 1er).');
    }
    if (!c.surSite && c.commande === null) {
        return ('Aucun abonnement n’est rattaché à ce dossier, ni à son siège · l’offre doit dire le prix avant son acceptation ' +
            '(Code du numérique, art. 53, 5°, et art. 55, al. 1er). VMG Consulting rattache l’abonnement depuis sa console.');
    }
    if (c.commande && c.commande.motifPrix) {
        return `L’offre doit dire le prix de l’abonnement de ce dossier avant son acceptation (Code du numérique, art. 53, 5°) · ${c.commande.motifPrix}`;
    }
    return null;
}
function estAJour(a, versionEnVigueur = conditions_de_licence_1.VERSION_CONDITIONS_LICENCE.numero, empreinte = (0, versions_publiees_1.empreinteEnVigueur)()) {
    return a !== null && a.version === versionEnVigueur && a.empreinte === empreinte;
}
function empreinteCommande(c) {
    if (c === null)
        return (0, empreinte_1.sha256Hex)('aucune commande');
    return (0, empreinte_1.sha256Hex)(JSON.stringify([
        c.formule,
        c.options,
        c.periodicite,
        c.debut,
        c.finEssai,
        c.lignes === null ? null : c.lignes.map((l) => [l.designation, l.quantite, l.prixUnitaireUsd]),
        c.totalUsd,
        c.duSiege,
    ]));
}
function motifRefusAcceptation(versionLue, empreinteLue, empreinteCommandeLue, c, versionEnVigueur = conditions_de_licence_1.VERSION_CONDITIONS_LICENCE.numero, empreinte = (0, versions_publiees_1.empreinteEnVigueur)()) {
    if (!Number.isInteger(versionLue) || versionLue < versionEnVigueur) {
        return (`La page affiche la version ${String(versionLue)} des conditions, et le service tient en vigueur la version ${versionEnVigueur} · ` +
            'rechargez la page et relisez la version en vigueur avant de l’accepter.');
    }
    if (versionLue > versionEnVigueur) {
        return (`La page affiche la version ${versionLue} des conditions, que le service ne tient pas encore (il est à la version ${versionEnVigueur}) · ` +
            'le service n’est pas encore à jour, réessayez dans quelques minutes.');
    }
    if (empreinteLue !== empreinte) {
        return (`Le texte affiché diffère de celui que le service tient pour la même version ${versionEnVigueur} · ` +
            'rechargez la page et relisez-le avant de l’accepter.');
    }
    const fermee = motifAcceptationFermee(c);
    if (fermee)
        return fermee;
    if (empreinteCommandeLue !== empreinteCommande(c.commande)) {
        return 'L’abonnement affiché n’est plus celui du dossier · relisez-le avant d’accepter (Code du numérique, art. 55, al. 1er).';
    }
    return null;
}
function detailCommande(a, duSiege = false) {
    const periode = (0, facturation_abonnements_1.premierePeriodeFacturable)(a.debut, a.finEssai);
    const v = (0, facturation_abonnements_1.verdictPeriode)({ ...a, actif: true }, periode);
    return {
        formule: a.formule.libelle,
        options: a.options.map((o) => o.libelle),
        periodicite: a.periodicite,
        debut: a.debut,
        finEssai: a.finEssai,
        lignes: v.du ? v.lignes : null,
        totalUsd: v.du ? v.totalUsd : null,
        motifPrix: v.du ? null : v.motif,
        actif: a.actif,
        duSiege,
    };
}
function motifRefusRenvoiAccuse(a, aJour, dernier) {
    if (!a || !aJour)
        return 'Aucune acceptation du texte en vigueur n’est enregistrée pour ce dossier · il n’y a pas d’accusé à renvoyer.';
    if (dernier === null || dernier.statut === 'ABANDONNE')
        return null;
    if (dernier.statut === 'ECHEC') {
        return 'L’accusé de réception n’est pas parti au dernier essai · la file le retente d’elle-même, le renvoyer ferait un doublon.';
    }
    return 'Un accusé de réception de cette acceptation est déjà en file ou parti · le renvoyer ferait un doublon.';
}
function etatConditions(a, c, accuse = null) {
    const contexte = { ...c, mentions: c.mentions ?? (0, conditions_de_licence_1.mentionsAArreter)() };
    const motif = motifAcceptationFermee(contexte);
    const aJour = estAJour(a);
    return {
        version: { ...conditions_de_licence_1.VERSION_CONDITIONS_LICENCE, empreinte: (0, versions_publiees_1.empreinteEnVigueur)() },
        acceptation: a,
        aJour,
        aAccepter: motif === null && !aJour,
        motifFermeture: motif,
        commande: c.commande,
        accuse,
        renvoiAccusePossible: motifRefusRenvoiAccuse(a, aJour, accuse) === null,
    };
}
//# sourceMappingURL=acceptation-conditions.js.map