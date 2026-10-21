"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PREFIXES_CHIFFRE_AFFAIRES_SYSCOHADA = exports.ORDRE_AFFICHAGE_COMPTE_RESULTAT = exports.RENVOIS_NOTES_SUBDIVISES = exports.CODES_NOTES_CH6 = exports.SOLDES_INTERMEDIAIRES = exports.REFS_POSTES_SUPPLEMENTAIRES = exports.POSTES_CHARGES_SYSCOHADA = exports.POSTES_PRODUITS_SYSCOHADA = exports.POSTES_COMPTE_RESULTAT_SYSCOHADA = void 0;
exports.compte13DuSolde = compte13DuSolde;
exports.resoudreRenvoiNote = resoudreRenvoiNote;
exports.trouvePosteCompteResultat = trouvePosteCompteResultat;
exports.trouveSoldeIntermediaire = trouveSoldeIntermediaire;
exports.posteDuCompteSyscohada = posteDuCompteSyscohada;
exports.montantSigne = montantSigne;
exports.signeConformeAuModele = signeConformeAuModele;
exports.calculerSoldesIntermediaires = calculerSoldesIntermediaires;
exports.POSTES_COMPTE_RESULTAT_SYSCOHADA = [
    { ref: 'TA', libelle: 'Ventes de marchandises', sens: 'PRODUIT', signe: '+', lettre: 'A', comptes: ['701'], notes: ['21'] },
    { ref: 'RA', libelle: 'Achats de marchandises', sens: 'CHARGE', signe: '-', comptes: ['601'], notes: ['22'] },
    {
        ref: 'RB',
        libelle: 'Variation de stocks de marchandises',
        sens: 'CHARGE',
        signe: '-/+',
        comptes: ['6031'],
        notes: ['6'],
    },
    { ref: 'TB', libelle: 'Ventes de produits fabriqués', sens: 'PRODUIT', signe: '+', lettre: 'B', comptes: ['702', '703', '704'], notes: ['21'] },
    { ref: 'TC', libelle: 'Travaux, services vendus', sens: 'PRODUIT', signe: '+', lettre: 'C', comptes: ['705', '706'], notes: ['21'] },
    { ref: 'TD', libelle: 'Produits accessoires', sens: 'PRODUIT', signe: '+', lettre: 'D', comptes: ['707'], notes: ['21'] },
    {
        ref: 'TE',
        libelle: 'Production stockée (ou déstockage)',
        sens: 'PRODUIT',
        signe: '-/+',
        comptes: ['73'],
        notes: ['6'],
    },
    { ref: 'TF', libelle: 'Production immobilisée', sens: 'PRODUIT', signe: '+', comptes: ['72'], notes: ['21'] },
    { ref: 'TG', libelle: "Subventions d'exploitation", sens: 'PRODUIT', signe: '+', comptes: ['71'], notes: ['21'] },
    { ref: 'TH', libelle: 'Autres produits', sens: 'PRODUIT', signe: '+', comptes: ['75'], notes: ['21'] },
    {
        ref: 'TI',
        libelle: "Transferts de charges d'exploitation",
        sens: 'PRODUIT',
        signe: '+',
        comptes: ['781'],
        notes: ['12'],
    },
    { ref: 'RC', libelle: 'Achats de matières premières et fournitures liées', sens: 'CHARGE', signe: '-', comptes: ['602'], notes: ['22'] },
    { ref: 'RD', libelle: 'Variation de stocks de matières premières et fournitures liées', sens: 'CHARGE', signe: '-/+', comptes: ['6032'], notes: ['6'] },
    {
        ref: 'RE',
        libelle: 'Autres achats',
        sens: 'CHARGE',
        signe: '-',
        comptes: ['604', '605', '608'],
        notes: ['22'],
    },
    { ref: 'RF', libelle: "Variation de stocks d'autres approvisionnements", sens: 'CHARGE', signe: '-/+', comptes: ['6033'], notes: ['6'] },
    { ref: 'RG', libelle: 'Transports', sens: 'CHARGE', signe: '-', comptes: ['61'], notes: ['23'] },
    { ref: 'RH', libelle: 'Services extérieurs', sens: 'CHARGE', signe: '-', comptes: ['62', '63'], notes: ['24'] },
    { ref: 'RI', libelle: 'Impôts et taxes', sens: 'CHARGE', signe: '-', comptes: ['64'], notes: ['25'] },
    { ref: 'RJ', libelle: 'Autres charges', sens: 'CHARGE', signe: '-', comptes: ['65'], notes: ['26'] },
    {
        ref: 'RK',
        libelle: 'Charges de personnel',
        sens: 'CHARGE',
        signe: '-',
        comptes: ['66'],
        notes: ['27'],
    },
    {
        ref: 'TJ',
        libelle: "Reprises d'amortissements, provisions et dépréciations",
        sens: 'PRODUIT',
        signe: '+',
        comptes: ['791', '798', '799'],
        notes: ['28'],
    },
    {
        ref: 'RL',
        libelle: 'Dotations aux amortissements, aux provisions et dépréciations',
        sens: 'CHARGE',
        signe: '-',
        comptes: ['681', '691'],
        notes: ['3C', '28'],
    },
    {
        ref: 'RQP',
        libelle: 'Quote-part de résultat partagé',
        sens: 'CHARGE',
        signe: '-',
        comptes: ['652'],
        notes: ['26'],
        supplementaire: true,
    },
    {
        ref: 'TQP',
        libelle: 'Quote-part de résultat partagé',
        sens: 'PRODUIT',
        signe: '+',
        comptes: ['752'],
        notes: ['21'],
        supplementaire: true,
    },
    { ref: 'TK', libelle: 'Revenus financiers et assimilés', sens: 'PRODUIT', signe: '+', comptes: ['77'], notes: ['29'] },
    { ref: 'TL', libelle: 'Reprises de provisions et dépréciations financières', sens: 'PRODUIT', signe: '+', comptes: ['797'], notes: ['28'] },
    { ref: 'TM', libelle: 'Transferts de charges financières', sens: 'PRODUIT', signe: '+', comptes: ['787'], notes: ['12'] },
    { ref: 'RM', libelle: 'Frais financiers et charges assimilées', sens: 'CHARGE', signe: '-', comptes: ['67'], notes: ['29'] },
    { ref: 'RN', libelle: 'Dotations aux provisions et aux dépréciations financières', sens: 'CHARGE', signe: '-', comptes: ['697'], notes: ['3C', '28'] },
    { ref: 'TN', libelle: "Produits des cessions d'immobilisations", sens: 'PRODUIT', signe: '+', comptes: ['82'], notes: ['3D'] },
    { ref: 'TO', libelle: 'Autres Produits HAO', sens: 'PRODUIT', signe: '+', comptes: ['84', '86', '88'], notes: ['30'] },
    { ref: 'RO', libelle: "Valeurs comptables des cessions d'immobilisations", sens: 'CHARGE', signe: '-', comptes: ['81'], notes: ['3D'] },
    { ref: 'RP', libelle: 'Autres Charges HAO', sens: 'CHARGE', signe: '-', comptes: ['83', '85'], notes: ['30'] },
    { ref: 'RQ', libelle: 'Participation des travailleurs', sens: 'CHARGE', signe: '-', comptes: ['87'], notes: ['30'] },
    { ref: 'RS', libelle: 'Impôts sur le résultat', sens: 'CHARGE', signe: '-', comptes: ['89'], notes: [] },
];
exports.POSTES_PRODUITS_SYSCOHADA = exports.POSTES_COMPTE_RESULTAT_SYSCOHADA.filter((p) => p.sens === 'PRODUIT');
exports.POSTES_CHARGES_SYSCOHADA = exports.POSTES_COMPTE_RESULTAT_SYSCOHADA.filter((p) => p.sens === 'CHARGE');
exports.REFS_POSTES_SUPPLEMENTAIRES = exports.POSTES_COMPTE_RESULTAT_SYSCOHADA.filter((p) => p.supplementaire).map((p) => p.ref);
exports.SOLDES_INTERMEDIAIRES = [
    {
        ref: 'XA',
        libelle: 'MARGE COMMERCIALE',
        formuleOfficielle: 'Somme TA à RB',
        deRefs: ['TA', 'RA', 'RB'],
        compte13: '132',
        notes: [],
    },
    {
        ref: 'XB',
        libelle: "CHIFFRE D'AFFAIRES",
        formuleOfficielle: 'A + B + C + D',
        deRefs: ['TA', 'TB', 'TC', 'TD'],
        notes: [],
    },
    {
        ref: 'XC',
        libelle: 'VALEUR AJOUTÉE',
        formuleOfficielle: '(XB + RA + RB) + (somme TE à RJ)',
        deRefs: ['XB', 'RA', 'RB', 'TE', 'TF', 'TG', 'TH', 'TI', 'RC', 'RD', 'RE', 'RF', 'RG', 'RH', 'RI', 'RJ'],
        compte13: '133',
        notes: [],
    },
    {
        ref: 'XD',
        libelle: "EXCÉDENT BRUT D'EXPLOITATION",
        formuleOfficielle: 'XC + RK',
        deRefs: ['XC', 'RK'],
        compte13: '134',
        notes: ['28'],
    },
    {
        ref: 'XE',
        libelle: "RÉSULTAT D'EXPLOITATION",
        formuleOfficielle: 'XD + TJ + RL + RQP + TQP',
        deRefs: ['XD', 'TJ', 'RL', 'RQP', 'TQP'],
        compte13: '135',
        notes: [],
    },
    {
        ref: 'XF',
        libelle: 'RÉSULTAT FINANCIER',
        formuleOfficielle: 'Somme TK à RN',
        deRefs: ['TK', 'TL', 'TM', 'RM', 'RN'],
        compte13: '136',
        notes: [],
    },
    {
        ref: 'XG',
        libelle: 'RÉSULTAT DES ACTIVITÉS ORDINAIRES',
        formuleOfficielle: 'XE + XF',
        deRefs: ['XE', 'XF'],
        compte13: '137',
        notes: [],
    },
    {
        ref: 'XH',
        libelle: 'RÉSULTAT HORS ACTIVITÉS ORDINAIRES',
        formuleOfficielle: 'Somme TN à RP',
        deRefs: ['TN', 'TO', 'RO', 'RP'],
        compte13: '138',
        notes: [],
    },
    {
        ref: 'XI',
        libelle: 'RÉSULTAT NET',
        formuleOfficielle: 'XG + XH + RQ + RS',
        deRefs: ['XG', 'XH', 'RQ', 'RS'],
        compte13ParSigne: { benefice: '131', perte: '139' },
        notes: [],
    },
];
function compte13DuSolde(solde, montant) {
    if (solde.compte13ParSigne)
        return montant < 0 ? solde.compte13ParSigne.perte : solde.compte13ParSigne.benefice;
    return solde.compte13;
}
exports.CODES_NOTES_CH6 = [
    '1', '2', '3A', '3B', '3C', '3D', '3E', '3F', '4', '5', '6', '7', '8', '9', '10', '11', '12',
    '13', '14', '15A', '15B', '16A', '16B', '16B bis', '16C', '17', '18', '19', '20', '21', '22',
    '23', '24', '25', '26', '27A', '27B', '28', '29', '30', '31', '32', '33', '34', '35', '36',
];
exports.RENVOIS_NOTES_SUBDIVISES = {
    '27': ['27A', '27B'],
};
function resoudreRenvoiNote(renvoi) {
    return [...(exports.RENVOIS_NOTES_SUBDIVISES[renvoi] ?? [renvoi])];
}
exports.ORDRE_AFFICHAGE_COMPTE_RESULTAT = [
    'TA', 'RA', 'RB', 'XA',
    'TB', 'TC', 'TD', 'XB',
    'TE', 'TF', 'TG', 'TH', 'TI', 'RC', 'RD', 'RE', 'RF', 'RG', 'RH', 'RI', 'RJ', 'XC',
    'RK', 'XD',
    'TJ', 'RL', 'RQP', 'TQP', 'XE',
    'TK', 'TL', 'TM', 'RM', 'RN', 'XF',
    'XG',
    'TN', 'TO', 'RO', 'RP', 'XH',
    'RQ', 'RS', 'XI',
];
exports.PREFIXES_CHIFFRE_AFFAIRES_SYSCOHADA = (() => {
    const xb = exports.SOLDES_INTERMEDIAIRES.find((s) => s.ref === 'XB');
    if (!xb)
        throw new Error("Le solde XB (chiffre d'affaires) a disparu du modèle du ch. 4.");
    return xb.deRefs.flatMap((ref) => {
        const poste = exports.POSTES_COMPTE_RESULTAT_SYSCOHADA.find((p) => p.ref === ref);
        if (!poste)
            throw new Error(`Le poste ${ref}, sommé par XB, n'existe pas au modèle.`);
        return poste.comptes ?? [];
    });
})();
function trouvePosteCompteResultat(ref) {
    return exports.POSTES_COMPTE_RESULTAT_SYSCOHADA.find((p) => p.ref === ref);
}
function trouveSoldeIntermediaire(ref) {
    return exports.SOLDES_INTERMEDIAIRES.find((s) => s.ref === ref);
}
function posteDuCompteSyscohada(numeroCompte) {
    let meilleur = null;
    let longueurMeilleurPrefixe = 0;
    for (const poste of exports.POSTES_COMPTE_RESULTAT_SYSCOHADA) {
        for (const prefixe of poste.comptes) {
            if (numeroCompte.startsWith(prefixe) && prefixe.length > longueurMeilleurPrefixe) {
                meilleur = poste;
                longueurMeilleurPrefixe = prefixe.length;
            }
        }
    }
    return meilleur;
}
function montantSigne(totalDebit, totalCredit) {
    return totalCredit - totalDebit;
}
function signeConformeAuModele(poste, montant) {
    if (poste.signe === '-/+' || Math.abs(montant) < 0.005)
        return true;
    return poste.signe === '+' ? montant > 0 : montant < 0;
}
function calculerSoldesIntermediaires(montantsParRef) {
    const resultat = { ...montantsParRef };
    for (const solde of exports.SOLDES_INTERMEDIAIRES) {
        resultat[solde.ref] = solde.deRefs.reduce((somme, ref) => somme + (resultat[ref] ?? 0), 0);
    }
    return resultat;
}
//# sourceMappingURL=correspondance-compte-resultat-syscohada.js.map