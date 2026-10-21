"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MOTIF_IDENTIFIANTS_INVALIDES = exports.DECOMPTE_REMIS_A_ZERO = exports.DELAI_OUBLI_ECHECS_HEURES = exports.PALIERS_VERROU_MINUTES = exports.SEUIL_VERROUILLAGE = void 0;
exports.dureeVerrouMinutes = dureeVerrouMinutes;
exports.instantDeverrouillage = instantDeverrouillage;
exports.decompteApresEchec = decompteApresEchec;
exports.SEUIL_VERROUILLAGE = 5;
exports.PALIERS_VERROU_MINUTES = [1, 5, 15, 30, 60];
exports.DELAI_OUBLI_ECHECS_HEURES = 12;
function dureeVerrouMinutes(tentativesEchouees) {
    if (tentativesEchouees < exports.SEUIL_VERROUILLAGE)
        return 0;
    const rang = tentativesEchouees - exports.SEUIL_VERROUILLAGE;
    return exports.PALIERS_VERROU_MINUTES[Math.min(rang, exports.PALIERS_VERROU_MINUTES.length - 1)];
}
function instantDeverrouillage(tentativesEchouees, maintenant) {
    const minutes = dureeVerrouMinutes(tentativesEchouees);
    return minutes === 0 ? null : new Date(maintenant.getTime() + minutes * 60_000);
}
function decompteApresEchec(user, maintenant) {
    const oublie = !user.dernierEchecLe ||
        maintenant.getTime() - user.dernierEchecLe.getTime() >= exports.DELAI_OUBLI_ECHECS_HEURES * 3_600_000;
    const echecs = (oublie ? 0 : user.tentativesEchouees) + 1;
    return { tentativesEchouees: echecs, verrouilleJusqua: instantDeverrouillage(echecs, maintenant), dernierEchecLe: maintenant };
}
exports.DECOMPTE_REMIS_A_ZERO = { tentativesEchouees: 0, verrouilleJusqua: null, dernierEchecLe: null };
exports.MOTIF_IDENTIFIANTS_INVALIDES = "Identifiants invalides · après plusieurs essais manqués, un compte reste fermé quelques minutes, ou jusqu'à ce que " +
    "l'administrateur du dossier réinitialise son mot de passe.";
//# sourceMappingURL=verrouillage.js.map