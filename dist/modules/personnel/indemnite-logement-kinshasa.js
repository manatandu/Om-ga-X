"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RESERVE_INDEMNITE_LOGEMENT_KINSHASA = void 0;
exports.reserveIndemniteLogementKinshasa = reserveIndemniteLogementKinshasa;
exports.RESERVE_INDEMNITE_LOGEMENT_KINSHASA = "INDEMNITÉ DE LOGEMENT, KINSHASA · versée à un salarié qui occupe sa propre habitation (ou celle de son " +
    "conjoint), elle est assimilée à un revenu de location (O.-L. n° 69/009, art. 4, al. 2), et l'impôt est dû " +
    "par le bénéficiaire (arrêté provincial n° 016/CAB/MIN.PROV/FIN.ECO/2023, art. 2). L'EMPLOYEUR qui l'accorde " +
    "communique à la DGRK, dans les dix jours du paiement, le relevé des bénéficiaires et des montants (art. 3), " +
    "sous astreinte de 100 USD par jour de retard pour une personne morale, 25 USD pour une personne physique " +
    "(art. 7). OmegaX ne sait pas si le salarié occupe sa propre habitation, et ne retient rien.";
const EN_VIGUEUR_DU_MOIS = '2024-01';
function reserveIndemniteLogementKinshasa(elements, ville, moisDePaie) {
    if (moisDePaie < EN_VIGUEUR_DU_MOIS)
        return null;
    const aKinshasa = (ville ?? '').trim().toLowerCase().includes('kinshasa');
    if (!aKinshasa)
        return null;
    const indemnite = elements.some((e) => e.nature === 'LOGEMENT_OU_SON_INDEMNITE' && e.montantFc > 0 && e.enNature !== true);
    return indemnite ? exports.RESERVE_INDEMNITE_LOGEMENT_KINSHASA : null;
}
//# sourceMappingURL=indemnite-logement-kinshasa.js.map