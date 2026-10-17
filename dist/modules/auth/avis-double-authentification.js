"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.avisDoubleAuth = avisDoubleAuth;
const CE_QUI_A_CHANGE = {
    ACTIVEE: {
        sujet: 'Double authentification activée',
        phrase: 'La double authentification vient d’être activée sur votre compte · une application d’authentification y est désormais liée.',
    },
    RETIREE: {
        sujet: 'Double authentification retirée',
        phrase: 'La double authentification vient d’être retirée de votre compte · le mot de passe suffit de nouveau pour vous connecter.',
    },
    CODES_SECOURS_REGENERES: {
        sujet: 'Nouveaux codes de secours',
        phrase: 'De nouveaux codes de secours viennent d’être engendrés pour votre compte · les précédents ne valent plus.',
    },
};
function horodatage(instant) {
    return instant.toLocaleString('fr-FR', { timeZone: 'Africa/Kinshasa', dateStyle: 'long', timeStyle: 'short' });
}
function avisDoubleAuth(evenement, compte) {
    const { sujet, phrase } = CE_QUI_A_CHANGE[evenement];
    return {
        sujet: `OmegaX · ${sujet}`,
        corps: [
            'Bonjour,',
            '',
            phrase,
            '',
            `Compte · ${compte.email}`,
            `Le · ${horodatage(compte.instant)} (heure de Kinshasa)`,
            '',
            'Si vous êtes l’auteur de ce changement, ce message ne demande rien.',
            'Sinon, changez sans attendre votre mot de passe et prévenez l’administrateur de votre dossier · il peut réinitialiser votre accès.',
        ].join('\n'),
    };
}
//# sourceMappingURL=avis-double-authentification.js.map