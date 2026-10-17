"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.horodatageKinshasa = horodatageKinshasa;
exports.nomPieceJointeConditions = nomPieceJointeConditions;
exports.lignesDeLaCommande = lignesDeLaCommande;
exports.accuseReceptionConditions = accuseReceptionConditions;
const conditions_de_licence_1 = require("./conditions-de-licence");
const acceptation_conditions_1 = require("./acceptation-conditions");
const versions_publiees_1 = require("./versions-publiees");
function horodatageKinshasa(instant) {
    return instant.toLocaleString('fr-FR', { timeZone: 'Africa/Kinshasa', dateStyle: 'long', timeStyle: 'short' });
}
function nomPieceJointeConditions(version = conditions_de_licence_1.VERSION_CONDITIONS_LICENCE.numero) {
    return `conditions-de-licence-omegax-version-${version}.txt`;
}
function montantUsd(n) {
    return `${n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace(/[\u00a0\u202f]/g, ' ')} USD`;
}
function dateCourte(iso) {
    const [a, m, j] = iso.split('-');
    return `${j}/${m}/${a}`;
}
function lignesDeLaCommande(c) {
    if (c === null)
        return ['Abonnement · aucun abonnement n’est rattaché à cette acceptation (installation sur site ou acceptation antérieure à sa conservation).'];
    const lignes = [
        `Abonnement${c.duSiege ? ' (celui du siège du groupe)' : ''} · ${c.formule}${c.options.length > 0 ? `, options ${c.options.join(', ')}` : ''}`,
        `Facturation · ${c.periodicite === 'ANNUELLE' ? 'annuelle' : 'mensuelle'}, depuis le ${dateCourte(c.debut)}${c.finEssai ? `, essai jusqu’au ${dateCourte(c.finEssai)}` : ''}`,
    ];
    if (c.lignes === null || c.totalUsd === null) {
        lignes.push(`Prix · non rendu${c.motifPrix ? ` (${c.motifPrix})` : ''}`);
        return lignes;
    }
    for (const l of c.lignes)
        lignes.push(`  ${l.designation} · ${l.quantite} × ${montantUsd(l.prixUnitaireUsd)}`);
    lignes.push(`Total d’une période · ${montantUsd(c.totalUsd)}`);
    return lignes;
}
function accuseReceptionConditions(acceptation, dossier) {
    const publiee = (0, versions_publiees_1.versionPubliee)(acceptation.version);
    if (!publiee)
        throw new Error(`La version ${acceptation.version} des conditions n’est pas dans l’archive des versions publiées.`);
    return {
        sujet: `OmegaX · Accusé de réception · conditions de licence, version ${acceptation.version}`,
        corps: [
            'Bonjour,',
            '',
            `VMG Consulting accuse réception de l’acceptation des conditions de licence d’OmegaX, version ${acceptation.version} du ${publiee.dateLisible}.`,
            '',
            `Dossier · ${dossier}`,
            `Acceptées par · ${acceptation.par ?? acceptation_conditions_1.AUTEUR_NON_ENREGISTRE}`,
            `Le · ${horodatageKinshasa(new Date(acceptation.le))} (heure de Kinshasa)`,
            `Empreinte SHA-256 du texte accepté · ${acceptation.empreinte ?? 'non enregistrée'}`,
            '',
            ...lignesDeLaCommande(acceptation.commande),
            '',
            'Le texte accepté est joint à ce message. Il reste consultable et imprimable dans OmegaX, menu « ? », Contrat de licence.',
            'Si vous n’êtes pas l’auteur de cette acceptation, prévenez l’administrateur de votre dossier.',
        ].join('\n'),
        pieceJointe: { nom: nomPieceJointeConditions(acceptation.version), texte: publiee.texte },
    };
}
//# sourceMappingURL=accuse-reception-conditions.js.map