"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ATTENTE_ENTRE_DEUX_ENVOIS_MINUTES = exports.FENETRE_RENVOI_HEURES = exports.motDePasseTireAuSort = exports.JOURS_ESSAI = exports.ORIGINE_INSCRIPTION_ESSAI = void 0;
exports.finDeLEssai = finDeLEssai;
exports.renvoiPossible = renvoiPossible;
exports.estUnDossierDEssai = estUnDossierDEssai;
exports.avisInscriptionEssai = avisInscriptionEssai;
const facturation_abonnements_1 = require("../plateforme/abonnements/facturation-abonnements");
Object.defineProperty(exports, "JOURS_ESSAI", { enumerable: true, get: function () { return facturation_abonnements_1.JOURS_ESSAI; } });
const reinitialisation_admin_1 = require("../plateforme/reinitialisation-admin");
Object.defineProperty(exports, "motDePasseTireAuSort", { enumerable: true, get: function () { return reinitialisation_admin_1.motDePasseTireAuSort; } });
exports.ORIGINE_INSCRIPTION_ESSAI = 'INSCRIPTION_ESSAI';
function finDeLEssai(debut) {
    const fin = new Date(debut.getTime());
    fin.setUTCDate(fin.getUTCDate() + facturation_abonnements_1.JOURS_ESSAI);
    return fin;
}
exports.FENETRE_RENVOI_HEURES = 72;
exports.ATTENTE_ENTRE_DEUX_ENVOIS_MINUTES = 10;
function renvoiPossible(compte, maintenant) {
    if (!compte.doitChangerMotDePasse)
        return false;
    if (maintenant.getTime() - compte.createdAt.getTime() > exports.FENETRE_RENVOI_HEURES * 3_600_000)
        return false;
    const dernierEnvoi = compte.sessionsInvalidesAvant ?? compte.createdAt;
    return maintenant.getTime() - dernierEnvoi.getTime() >= exports.ATTENTE_ENTRE_DEUX_ENVOIS_MINUTES * 60_000;
}
function estUnDossierDEssai(licence) {
    if (!licence || licence.type !== 'ABONNEMENT' || !licence.dateExpiration)
        return false;
    const ecart = licence.dateExpiration.getTime() - licence.dateDebut.getTime();
    return Math.abs(ecart - facturation_abonnements_1.JOURS_ESSAI * 86_400_000) <= 60_000;
}
const jour = (d) => new Intl.DateTimeFormat('fr-FR', { timeZone: 'Africa/Kinshasa', day: 'numeric', month: 'long', year: 'numeric' }).format(d);
function avisInscriptionEssai(motDePasseProvisoire, finEssai, nouveau) {
    const texte = (mot) => 'Bonjour,\n\n' +
        (nouveau
            ? `Votre dossier d'essai OmegaX est ouvert. L'essai est gratuit, jusqu'au ${jour(finEssai)}.\n\n`
            : "Voici un nouveau mot de passe provisoire pour votre dossier d'essai OmegaX, que vous n'avez pas encore ouvert.\n\n") +
        `Mot de passe provisoire · ${mot}\n\n` +
        "Il vous sera demandé de le changer à votre première connexion. Si vous n'êtes pas à l'origine de cette demande, " +
        'ignorez ce message : sans ce mot de passe, personne ne peut ouvrir le dossier.\n\n' +
        "À la fin de l'essai le dossier reste consultable, mais plus modifiable, jusqu'à l'abonnement.\n\n" +
        "VMG Consulting n'a pas connaissance de ce mot de passe.\n";
    return {
        sujet: nouveau ? "OmegaX · votre dossier d'essai" : 'OmegaX · votre mot de passe provisoire',
        corps: texte(motDePasseProvisoire),
        corpsGarde: texte('[remis au seul destinataire, non conservé]'),
    };
}
//# sourceMappingURL=inscription-essai.js.map