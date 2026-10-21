"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOUS_LES_POSTES = exports.POSTES_HAO = exports.POSTES_CHARGES = exports.POSTES_PRODUITS = void 0;
exports.posteDuCompte = posteDuCompte;
exports.POSTES_PRODUITS = [
    { ref: 'RA', libelle: 'Cotisations', sens: 'PRODUIT', comptes: ['701'] },
    {
        ref: 'RB',
        libelle: 'Dotations consomptibles transférées au compte de résultat',
        sens: 'PRODUIT',
        comptes: ['703'],
    },
    { ref: 'RC', libelle: 'Revenus liés à la générosité', sens: 'PRODUIT', comptes: ['704'] },
    { ref: 'RD', libelle: 'Ventes de marchandises', sens: 'PRODUIT', comptes: ['7051'] },
    {
        ref: 'RE',
        libelle: 'Ventes de services et produits finis',
        sens: 'PRODUIT',
        comptes: ['7052', '7053'],
    },
    { ref: 'RF', libelle: "Subventions d'exploitation", sens: 'PRODUIT', comptes: ['71'] },
    {
        ref: 'RG',
        libelle: 'Autres produits et transferts de charges',
        sens: 'PRODUIT',
        comptes: ['706', '707', '708', '72', '73', '75', '77', '78'],
    },
    {
        ref: 'RH',
        libelle: 'Reprises de provisions, dépréciations, subventions et autres reprises',
        sens: 'PRODUIT',
        comptes: ['79'],
    },
];
exports.POSTES_CHARGES = [
    { ref: 'TA', libelle: "Achats de biens et services liés à l'activité", sens: 'CHARGE', comptes: ['601'] },
    {
        ref: 'TB',
        libelle: "Variation de stocks des achats de biens et services liés à l'activité",
        sens: 'CHARGE',
        comptes: ['6031'],
    },
    { ref: 'TC', libelle: 'Achats de marchandises et matières premières', sens: 'CHARGE', comptes: ['602'] },
    { ref: 'TD', libelle: 'Autres achats', sens: 'CHARGE', comptes: ['604', '605', '606', '608'] },
    {
        ref: 'TE',
        libelle: 'Variation de stocks de marchandises, de matières premières et autres',
        sens: 'CHARGE',
        comptes: ['6032', '6033', '6034', '6035'],
    },
    { ref: 'TF', libelle: 'Transports', sens: 'CHARGE', comptes: ['61'] },
    { ref: 'TG', libelle: 'Services extérieurs', sens: 'CHARGE', comptes: ['62', '63'] },
    { ref: 'TH', libelle: 'Impôts et taxes', sens: 'CHARGE', comptes: ['64'] },
    { ref: 'TI', libelle: 'Autres charges', sens: 'CHARGE', comptes: ['65'] },
    { ref: 'TJ', libelle: 'Charges de personnel', sens: 'CHARGE', comptes: ['66'] },
    { ref: 'TK', libelle: 'Frais financiers et charges assimilées', sens: 'CHARGE', comptes: ['67'] },
    {
        ref: 'TL',
        libelle: 'Dotations aux amortissements, aux provisions, aux dépréciations et autres',
        sens: 'CHARGE',
        comptes: ['68', '69'],
    },
];
exports.POSTES_HAO = [
    { ref: 'TM', libelle: 'Produits H.A.O.', sens: 'PRODUIT', comptes: ['82', '84', '86', '88'] },
    {
        ref: 'TN',
        libelle: 'Charges H.A.O.',
        sens: 'CHARGE',
        comptes: ['81', '83', '85', '87'],
    },
];
exports.TOUS_LES_POSTES = [...exports.POSTES_PRODUITS, ...exports.POSTES_CHARGES, ...exports.POSTES_HAO];
function posteDuCompte(numeroCompte) {
    let meilleur = null;
    let longueurMeilleurPrefixe = 0;
    for (const poste of exports.TOUS_LES_POSTES) {
        for (const prefixe of poste.comptes) {
            if (numeroCompte.startsWith(prefixe) && prefixe.length > longueurMeilleurPrefixe) {
                meilleur = poste;
                longueurMeilleurPrefixe = prefixe.length;
            }
        }
    }
    return meilleur;
}
//# sourceMappingURL=correspondance-compte-resultat.js.map