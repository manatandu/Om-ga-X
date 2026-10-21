"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CLE_SESSION_REQUETE = exports.MOTIF_CONSOLE_AUTHENTIFICATION_ANCIENNE = exports.DELAI_CONSOLE_DEPUIS_AUTHENTIFICATION_S = exports.INTERVALLE_PROLONGATION_S = exports.DUREE_INACTIVITE_SESSION_LONGUE_S = exports.DUREE_MAXIMALE_SESSION_LONGUE_S = exports.SECONDES_PAR_JOUR = void 0;
exports.authentificationTropAnciennePourLaConsole = authentificationTropAnciennePourLaConsole;
exports.sessionDuJeton = sessionDuJeton;
exports.echeanceSessionLongue = echeanceSessionLongue;
exports.prolongationDue = prolongationDue;
exports.emettreSession = emettreSession;
exports.sessionDeLaRequete = sessionDeLaRequete;
exports.demandeDeReemission = demandeDeReemission;
const crypto_1 = require("crypto");
exports.SECONDES_PAR_JOUR = 86_400;
exports.DUREE_MAXIMALE_SESSION_LONGUE_S = 30 * exports.SECONDES_PAR_JOUR;
exports.DUREE_INACTIVITE_SESSION_LONGUE_S = 7 * exports.SECONDES_PAR_JOUR;
exports.INTERVALLE_PROLONGATION_S = exports.SECONDES_PAR_JOUR;
exports.DELAI_CONSOLE_DEPUIS_AUTHENTIFICATION_S = 8 * 3600;
exports.MOTIF_CONSOLE_AUTHENTIFICATION_ANCIENNE = "La console de l'éditeur demande une connexion de moins de huit heures · reconnectez-vous avec votre mot de passe et votre code.";
function authentificationTropAnciennePourLaConsole(session, maintenantS) {
    const c = session?.connexionComplete;
    return !(typeof c === 'number' && Number.isFinite(c) && maintenantS - c <= exports.DELAI_CONSOLE_DEPUIS_AUTHENTIFICATION_S);
}
function sessionDuJeton(charge, instantS) {
    return {
        longue: charge.longue === true,
        origine: charge.origine ?? charge.iat ?? instantS,
        iat: charge.iat ?? null,
        exp: charge.exp ?? null,
        csrf: charge.csrf ?? null,
        authentification: charge.authentification ?? charge.iat ?? null,
        connexionComplete: charge.connexionComplete ?? null,
    };
}
function echeanceSessionLongue(origine, instantS) {
    return Math.min(instantS + exports.DUREE_INACTIVITE_SESSION_LONGUE_S, origine + exports.DUREE_MAXIMALE_SESSION_LONGUE_S);
}
function prolongationDue(session, instantS) {
    if (!session.longue || session.iat === null)
        return false;
    if (instantS - session.iat < exports.INTERVALLE_PROLONGATION_S)
        return false;
    return echeanceSessionLongue(session.origine, instantS) > (session.exp ?? 0);
}
function emettreSession(jwt, userId, demande, instantMs = Date.now()) {
    const instantS = Math.floor(instantMs / 1000);
    const origine = demande.origine ?? instantS;
    const csrfToken = demande.csrf ?? (0, crypto_1.randomBytes)(16).toString('hex');
    const authentification = demande.authentification ?? instantS;
    const connexionComplete = demande.connexionComplete === 'maintenant' ? instantS : (demande.connexionComplete ?? undefined);
    const charge = {
        sub: userId,
        csrf: csrfToken,
        origine,
        authentification,
        ...(connexionComplete !== undefined ? { connexionComplete } : {}),
        iat: instantS,
    };
    if (demande.longue) {
        const duree = Math.max(1, echeanceSessionLongue(origine, instantS) - instantS);
        return {
            accessToken: jwt.sign({ ...charge, longue: true }, { expiresIn: duree }),
            csrfToken,
            sessionLongue: true,
            maxAgeMs: duree * 1000,
        };
    }
    const garder = demande.expCourte ? { expiresIn: Math.max(1, demande.expCourte - instantS) } : undefined;
    return { accessToken: jwt.sign(charge, garder), csrfToken, sessionLongue: false, maxAgeMs: null };
}
exports.CLE_SESSION_REQUETE = 'sessionOmegax';
function sessionDeLaRequete(requete) {
    const s = requete?.[exports.CLE_SESSION_REQUETE];
    return s ?? null;
}
function demandeDeReemission(session) {
    if (!session)
        return { longue: false };
    const connexionComplete = session.connexionComplete ?? null;
    return session.longue
        ? { longue: true, origine: session.origine, connexionComplete }
        : { longue: false, origine: session.origine, expCourte: session.exp, connexionComplete };
}
//# sourceMappingURL=session-longue.js.map