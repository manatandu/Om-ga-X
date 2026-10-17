"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LIBELLE_CATEGORIE = exports.LIBELLE_CATEGORIE_OCI = exports.LIBELLE_SECTION = exports.RUBRIQUE_NCI = exports.RUBRIQUE_PAR_CODE = exports.RUBRIQUES_IFRS = void 0;
exports.motifRefusRegle = motifRefusRegle;
const sf = (code, libelle, section, ref) => ({ code, libelle, ref, etat: 'SITUATION', section });
const pl = (code, libelle, categorie, ref) => ({ code, libelle, ref, etat: 'RESULTAT', categorie });
const oci = (code, libelle, categorieOci, ref) => ({ code, libelle, ref, etat: 'RESULTAT_GLOBAL', categorieOci });
exports.RUBRIQUES_IFRS = [
    sf('SF_IMMOBILISATIONS_CORPORELLES', 'Immobilisations corporelles', 'ACTIF_NON_COURANT', '§ 103 a'),
    sf('SF_IMMEUBLES_PLACEMENT', 'Immeubles de placement', 'ACTIF_NON_COURANT', '§ 103 b'),
    sf('SF_IMMOBILISATIONS_INCORPORELLES', 'Immobilisations incorporelles', 'ACTIF_NON_COURANT', '§ 103 c'),
    sf('SF_GOODWILL', 'Goodwill', 'ACTIF_NON_COURANT', '§ 103 d'),
    sf('SF_PARTICIPATIONS_MEE', 'Participations comptabilisées selon la méthode de la mise en équivalence', 'ACTIF_NON_COURANT', '§ 103 g'),
    sf('SF_ACTIFS_FINANCIERS_NC', 'Actifs financiers non courants', 'ACTIF_NON_COURANT', '§ 103 e, § 100'),
    sf('SF_ACTIFS_BIOLOGIQUES_NC', 'Actifs biologiques non courants', 'ACTIF_NON_COURANT', '§ 103 h, § 100'),
    sf('SF_CREANCES_NC', 'Clients et autres débiteurs non courants', 'ACTIF_NON_COURANT', '§ 103 j, § 100'),
    sf('SF_IMPOTS_DIFFERES_ACTIF', 'Actifs d’impôt différé', 'ACTIF_NON_COURANT', '§ 103 r, § 98'),
    sf('SF_STOCKS', 'Stocks', 'ACTIF_COURANT', '§ 103 i'),
    sf('SF_ACTIFS_BIOLOGIQUES_C', 'Actifs biologiques courants', 'ACTIF_COURANT', '§ 103 h, § 99'),
    sf('SF_CREANCES_CLIENTS', 'Clients et autres débiteurs', 'ACTIF_COURANT', '§ 103 j, § 99'),
    sf('SF_ACTIFS_FINANCIERS_C', 'Actifs financiers courants', 'ACTIF_COURANT', '§ 103 e, § 99'),
    sf('SF_IMPOT_EXIGIBLE_ACTIF', 'Actifs d’impôt exigible', 'ACTIF_COURANT', '§ 103 q'),
    sf('SF_TRESORERIE', 'Trésorerie et équivalents de trésorerie', 'ACTIF_COURANT', '§ 103 k, § 99 d'),
    sf('SF_ACTIFS_DETENUS_VENTE', 'Actifs détenus en vue de la vente', 'ACTIF_COURANT', '§ 103 l'),
    sf('SF_CAPITAL', 'Capital émis', 'CAPITAUX_PROPRES', '§ 104 b'),
    sf('SF_RESERVES', 'Réserves', 'CAPITAUX_PROPRES', '§ 104 b'),
    sf('SF_AUTRES_COMPOSANTES_CP', 'Autres composantes des capitaux propres (autres éléments du résultat global cumulés)', 'CAPITAUX_PROPRES', '§ 104 b, § 111'),
    sf('SF_PARTICIPATIONS_NE_DONNANT_PAS_CONTROLE', 'Participations ne donnant pas le contrôle', 'CAPITAUX_PROPRES', '§ 104 a, IFRS 10 § 22'),
    sf('SF_PASSIFS_FINANCIERS_NC', 'Passifs financiers non courants', 'PASSIF_NON_COURANT', '§ 103 o, § 102'),
    sf('SF_PROVISIONS_NC', 'Provisions non courantes', 'PASSIF_NON_COURANT', '§ 103 n, § 102'),
    sf('SF_FOURNISSEURS_NC', 'Fournisseurs et autres créditeurs non courants', 'PASSIF_NON_COURANT', '§ 103 m, § 102'),
    sf('SF_IMPOTS_DIFFERES_PASSIF', 'Passifs d’impôt différé', 'PASSIF_NON_COURANT', '§ 103 r, § 98'),
    sf('SF_FOURNISSEURS', 'Fournisseurs et autres créditeurs', 'PASSIF_COURANT', '§ 103 m, § 101'),
    sf('SF_PROVISIONS_C', 'Provisions courantes', 'PASSIF_COURANT', '§ 103 n, § 101'),
    sf('SF_PASSIFS_FINANCIERS_C', 'Passifs financiers courants', 'PASSIF_COURANT', '§ 103 o, § 101'),
    sf('SF_IMPOT_EXIGIBLE_PASSIF', 'Passifs d’impôt exigible', 'PASSIF_COURANT', '§ 103 q'),
    sf('SF_PASSIFS_DETENUS_VENTE', 'Passifs inclus dans des groupes destinés à être cédés', 'PASSIF_COURANT', '§ 103 s'),
    pl('PL_PRODUITS', 'Produits des activités ordinaires', 'OPERATIONNELLE', '§ 75 a i'),
    pl('PL_AUTRES_PRODUITS_OPERATIONNELS', 'Autres produits opérationnels', 'OPERATIONNELLE', '§ 24, § B78 · poste supplémentaire'),
    pl('PL_ACHATS_CONSOMMES', 'Matières premières et marchandises consommées', 'OPERATIONNELLE', '§ 78 a, § 80'),
    pl('PL_CHARGES_PERSONNEL', 'Charges au titre des avantages du personnel', 'OPERATIONNELLE', '§ 78 a, § 80'),
    pl('PL_AMORTISSEMENTS', 'Dotations aux amortissements', 'OPERATIONNELLE', '§ 78 a, § 80'),
    pl('PL_PERTES_VALEUR_FINANCIERES', 'Pertes de valeur sur actifs financiers (IFRS 9, section 5.5)', 'OPERATIONNELLE', '§ 75 b ii'),
    pl('PL_AUTRES_CHARGES_OPERATIONNELLES', 'Autres charges opérationnelles', 'OPERATIONNELLE', '§ 24, § B78 · poste supplémentaire'),
    pl('PL_QUOTE_PART_MEE', 'Quote-part du résultat des entreprises mises en équivalence', 'INVESTISSEMENT', '§ 75 a iii, § 53 a'),
    pl('PL_PRODUITS_INVESTISSEMENT', 'Produits des investissements', 'INVESTISSEMENT', '§ 53, § 54'),
    pl('PL_CHARGES_INVESTISSEMENT', 'Charges liées aux investissements', 'INVESTISSEMENT', '§ 53, § 54'),
    pl('PL_PRODUITS_FINANCEMENT', 'Produits de financement', 'FINANCEMENT', '§ 59 à 61'),
    pl('PL_CHARGES_FINANCEMENT', 'Charges de financement', 'FINANCEMENT', '§ 59 à 61'),
    pl('PL_IMPOT_RESULTAT', 'Charge (produit) d’impôt sur le résultat', 'IMPOTS', '§ 67, § 75 a iv'),
    pl('PL_ACTIVITES_ABANDONNEES', 'Résultat des activités abandonnées', 'ABANDONNEES', '§ 68, § 75 a v'),
    oci('OCI_NR_QUOTE_PART_MEE', 'Quote-part des autres éléments du résultat global des entreprises mises en équivalence', 'OCI_NON_RECYCLABLE', '§ 88 b, § 89 a'),
    oci('OCI_NR_AUTRES', 'Autres éléments qui ne seront pas reclassés en résultat net', 'OCI_NON_RECYCLABLE', '§ 88 b, § 89 b'),
    oci('OCI_R_QUOTE_PART_MEE', 'Quote-part des autres éléments du résultat global des entreprises mises en équivalence', 'OCI_RECYCLABLE', '§ 88 a, § 89 a'),
    oci('OCI_R_AUTRES', 'Autres éléments qui pourront être reclassés en résultat net', 'OCI_RECYCLABLE', '§ 88 a, § 89 b'),
];
exports.RUBRIQUE_PAR_CODE = new Map(exports.RUBRIQUES_IFRS.map((r) => [r.code, r]));
exports.RUBRIQUE_NCI = 'SF_PARTICIPATIONS_NE_DONNANT_PAS_CONTROLE';
exports.LIBELLE_SECTION = {
    ACTIF_NON_COURANT: 'Actifs non courants',
    ACTIF_COURANT: 'Actifs courants',
    CAPITAUX_PROPRES: 'Capitaux propres',
    PASSIF_NON_COURANT: 'Passifs non courants',
    PASSIF_COURANT: 'Passifs courants',
};
exports.LIBELLE_CATEGORIE_OCI = {
    OCI_NON_RECYCLABLE: 'Éléments qui ne seront pas reclassés en résultat net',
    OCI_RECYCLABLE: 'Éléments qui pourront être reclassés en résultat net lorsque des conditions particulières seront remplies',
};
exports.LIBELLE_CATEGORIE = {
    OPERATIONNELLE: 'Catégorie opérationnelle',
    INVESTISSEMENT: 'Catégorie investissement',
    FINANCEMENT: 'Catégorie financement',
    IMPOTS: 'Catégorie impôts sur le résultat',
    ABANDONNEES: 'Catégorie activités abandonnées',
};
function motifRefusRegle(prefixe, rubrique) {
    const p = prefixe.trim();
    if (!/^[1-8]\d*$/.test(p))
        return `Le préfixe « ${prefixe} » doit être un numéro de compte des classes 1 à 8.`;
    const r = exports.RUBRIQUE_PAR_CODE.get(rubrique);
    if (!r)
        return `La rubrique « ${rubrique} » n’existe pas au catalogue IFRS 18 d’OmegaX.`;
    if (r.etat === 'RESULTAT_GLOBAL') {
        return `La rubrique « ${r.libelle} » est un autre élément du résultat global · un mouvement de l’exercice qu’aucun compte SYSCOHADA ne porte. Il se déclare en retraitement, avec la norme qui le fait sortir du résultat net (IFRS 18 § B86-B87).`;
    }
    if (r.code === exports.RUBRIQUE_NCI) {
        return 'Les participations ne donnant pas le contrôle n’existent que dans les comptes consolidés (IFRS 10 § 22) · elles viennent de la consolidation, jamais d’un compte individuel.';
    }
    const gestion = /^[678]/.test(p);
    if (gestion && r.etat !== 'RESULTAT') {
        return `Le préfixe ${p} est un compte de gestion (classes 6 à 8) · il va au compte de résultat. Un reclassement vers le bilan se déclare en retraitement.`;
    }
    if (!gestion && r.etat !== 'SITUATION') {
        return `Le préfixe ${p} est un compte de bilan (classes 1 à 5) · il va à l’état de la situation financière. Un reclassement vers le résultat se déclare en retraitement.`;
    }
    return null;
}
//# sourceMappingURL=rubriques-ifrs.js.map