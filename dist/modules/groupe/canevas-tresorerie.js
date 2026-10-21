"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DERNIERE_LIGNE_DONNEES = exports.PREMIERE_LIGNE_DONNEES = exports.TRESORERIES_CANEVAS = exports.RUBRIQUES_CANEVAS = exports.MARQUEUR_CANEVAS = void 0;
exports.MARQUEUR_CANEVAS = 'OMEGAX-CANEVAS-V1';
exports.RUBRIQUES_CANEVAS = [
    { libelle: 'Cotisations des membres', compte: '70100000', sens: 'recette' },
    { libelle: 'Dons et offrandes', compte: '70410000', sens: 'recette' },
    { libelle: 'Deniers du culte', compte: '70430000', sens: 'recette' },
    { libelle: 'Dîmes, quêtes et assimilées', compte: '70440000', sens: 'recette' },
    { libelle: 'Célébrations', compte: '70450000', sens: 'recette' },
    { libelle: 'Revenus des manifestations', compte: '70600000', sens: 'recette' },
    { libelle: 'Subventions reçues', compte: '71300000', sens: 'recette' },
    { libelle: 'Produits accessoires et autres recettes', compte: '70700000', sens: 'recette' },
    { libelle: 'Transfert reçu du siège ou d’une cellule', compte: '58500000', sens: 'recette' },
    { libelle: 'Achats de biens et fournitures', compte: '60110000', sens: 'depense' },
    { libelle: 'Transports et déplacements', compte: '61810000', sens: 'depense' },
    { libelle: 'Locations et charges locatives', compte: '62280000', sens: 'depense' },
    { libelle: 'Entretien et réparations', compte: '62480000', sens: 'depense' },
    { libelle: 'Frais de télécommunications', compte: '62880000', sens: 'depense' },
    { libelle: 'Frais bancaires', compte: '63180000', sens: 'depense' },
    { libelle: 'Frais de formation', compte: '63300000', sens: 'depense' },
    { libelle: 'Impôts et taxes', compte: '64800000', sens: 'depense' },
    { libelle: 'Aides et secours versés', compte: '65200000', sens: 'depense' },
    { libelle: 'Rémunérations du personnel', compte: '66110000', sens: 'depense' },
    { libelle: 'Achat de matériel et mobilier (immobilisation)', compte: '24410000', sens: 'depense' },
    { libelle: 'Charges diverses', compte: '65800000', sens: 'depense' },
    { libelle: 'Transfert envoyé au siège ou à une cellule', compte: '58500000', sens: 'depense' },
];
exports.TRESORERIES_CANEVAS = {
    Caisse: { compte: '57100000', journal: 'CA' },
    Banque: { compte: '52110000', journal: 'BQ' },
};
exports.PREMIERE_LIGNE_DONNEES = 6;
exports.DERNIERE_LIGNE_DONNEES = 505;
//# sourceMappingURL=canevas-tresorerie.js.map