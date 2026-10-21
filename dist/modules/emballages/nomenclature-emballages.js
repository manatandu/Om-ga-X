"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RESERVE_DESCENTE = void 0;
exports.comptesDuReferentiel = comptesDuReferentiel;
exports.compteDuRole = compteDuRole;
const client_1 = require("@prisma/client");
const SYSCOHADA = [
    { role: 'CREANCE_CONSIGNATION', numero: '4094', intitule: 'Fournisseurs, créances pour emballages et matériels à rendre' },
    { role: 'DETTE_CONSIGNATION', numero: '4194', intitule: 'Clients, dettes pour emballages et matériels consignés' },
    { role: 'ACHAT_EMBALLAGE_RECUPERABLE', numero: '6082', intitule: 'Emballages récupérables non identifiables' },
    { role: 'MALI_SUR_EMBALLAGES', numero: '6224', intitule: 'Malis sur emballages' },
    { role: 'BONI_SUR_EMBALLAGES', numero: '7074', intitule: "Bonis sur reprises et cessions d'emballages" },
    { role: 'MATERIEL_EMBALLAGE', numero: '243', intitule: "Matériel d'emballage récupérable et identifiable" },
    { role: 'PRODUIT_CESSION_IMMO', numero: '822', intitule: 'Produits des cessions · immobilisations corporelles' },
    { role: 'VALEUR_COMPTABLE_CESSION', numero: '812', intitule: 'Valeurs comptables des cessions · immobilisations corporelles' },
];
const SYCEBNL = [
    { role: 'CREANCE_CONSIGNATION', numero: '4094', intitule: 'Fournisseurs, créances pour emballages et matériels à rendre' },
    { role: 'DETTE_CONSIGNATION', numero: '4194', intitule: 'Clients-usagers, dettes pour emballages et matériels consignés' },
    { role: 'ACHAT_EMBALLAGE_RECUPERABLE', numero: '6082', intitule: "Achats d'emballages · Emballages récupérables non identifiables" },
    { role: 'MALI_SUR_EMBALLAGES', numero: '6224', intitule: 'Malis sur emballages' },
    { role: 'BONI_SUR_EMBALLAGES', numero: '707', intitule: 'Produits accessoires' },
    { role: 'MATERIEL_EMBALLAGE', numero: '243', intitule: "Matériel d'emballage récupérable et identifiable" },
    { role: 'PRODUIT_CESSION_IMMO', numero: '822', intitule: 'Produits des cessions · immobilisations corporelles' },
    { role: 'VALEUR_COMPTABLE_CESSION', numero: '812', intitule: 'Valeurs comptables des cessions · immobilisations corporelles' },
];
function comptesDuReferentiel(referentiel) {
    return referentiel === client_1.Referentiel.SYCEBNL ? SYCEBNL : SYSCOHADA;
}
function compteDuRole(role, referentiel) {
    const trouve = comptesDuReferentiel(referentiel).find((c) => c.role === role);
    if (!trouve) {
        throw new Error(`Aucun compte ne tient le rôle ${role} dans le plan ${referentiel}.`);
    }
    return trouve;
}
exports.RESERVE_DESCENTE = "Les fiches des comptes 40 et 41 écrivent « le compte 24 » et « le compte 82 », qui sont des " +
    "EN-TÊTES DE DIVISION dans les deux plans et ne reçoivent jamais d'écriture. Le module propose " +
    'le 243 (matériel d\'emballage récupérable et identifiable) et le 822 (immobilisations ' +
    'corporelles), qui sont les subdivisions que l\'objet consigné appelle. Une autre subdivision ' +
    'peut convenir selon la nature du matériel : le choix appartient au cabinet.';
//# sourceMappingURL=nomenclature-emballages.js.map