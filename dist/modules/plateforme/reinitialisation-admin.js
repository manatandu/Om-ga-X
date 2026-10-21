"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ORIGINE_REINITIALISATION_ADMIN = void 0;
exports.motDePasseTireAuSort = motDePasseTireAuSort;
exports.avisReinitialisationAdmin = avisReinitialisationAdmin;
const crypto_1 = require("crypto");
exports.ORIGINE_REINITIALISATION_ADMIN = 'REINITIALISATION_ADMIN';
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
function motDePasseTireAuSort(longueur = 16) {
    const tirer = (jeu) => jeu[(0, crypto_1.randomInt)(jeu.length)];
    const caracteres = [
        tirer('ABCDEFGHJKLMNPQRSTUVWXYZ'),
        tirer('abcdefghijkmnpqrstuvwxyz'),
        tirer('23456789'),
        ...Array.from({ length: Math.max(longueur, 10) - 3 }, () => tirer(ALPHABET)),
    ];
    for (let i = caracteres.length - 1; i > 0; i--) {
        const j = (0, crypto_1.randomInt)(i + 1);
        [caracteres[i], caracteres[j]] = [caracteres[j], caracteres[i]];
    }
    return caracteres.join('');
}
function avisReinitialisationAdmin(motDePasseProvisoire) {
    const texte = (mot) => 'Bonjour,\n\n' +
        "À votre demande, l'accès administrateur de votre dossier OmegaX a été réinitialisé.\n\n" +
        `Mot de passe provisoire · ${mot}\n\n` +
        'Il vous sera demandé de le changer à votre première connexion. Vos sessions ouvertes ont été fermées, et la ' +
        "double authentification devra être réactivée.\n\nVMG Consulting n'a pas connaissance de ce mot de passe.\n";
    return {
        sujet: 'OmegaX · votre mot de passe provisoire',
        corps: texte(motDePasseProvisoire),
        corpsGarde: texte('[remis au seul destinataire, non conservé]'),
    };
}
//# sourceMappingURL=reinitialisation-admin.js.map