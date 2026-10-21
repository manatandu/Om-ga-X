"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LIBELLES_MODE_ACQUISITION = void 0;
exports.comptesSuivantLeBien = comptesSuivantLeBien;
exports.estCompteDeBien = estCompteDeBien;
exports.sectionsBaremeDuCompte = sectionsBaremeDuCompte;
exports.modeDeLaRacine = modeDeLaRacine;
exports.modeDuCompteDeContrepartie = modeDuCompteDeContrepartie;
const client_1 = require("@prisma/client");
function premierDetail(racine, numerosDetail) {
    const candidats = numerosDetail.filter((n) => n.startsWith(racine)).sort((a, b) => a.localeCompare(b));
    return candidats[0] ?? null;
}
function comptesSuivantLeBien(referentiel, numeroBien, numerosDetail, nonAmortissable = false) {
    const division = numeroBien.slice(0, 2);
    const usufruit = referentiel === client_1.Referentiel.SYCEBNL && division === '20';
    const racine28 = usufruit ? '280' : `28${numeroBien.charAt(1)}${numeroBien.charAt(2)}`;
    let amortissement = premierDetail(racine28, numerosDetail);
    if (!amortissement && nonAmortissable) {
        amortissement = premierDetail(`28${numeroBien.charAt(1)}`, numerosDetail) ?? premierDetail('28', numerosDetail);
    }
    const racine68 = usufruit ? '680' : division === '21' ? '6812' : '6813';
    const dotation = premierDetail(racine68, numerosDetail);
    const manques = [];
    if (!amortissement)
        manques.push(`aucun compte ${racine28} au plan du dossier`);
    if (!dotation)
        manques.push(`aucun compte ${racine68} au plan du dossier`);
    return {
        amortissement,
        dotation,
        motif: manques.length
            ? `Compte ${numeroBien} · ${manques.join(' ; ')}. Ouvrez-le dans le plan de comptes avant de porter ce bien.`
            : null,
    };
}
function estCompteDeBien(referentiel, numero) {
    const division = numero.slice(0, 2);
    if (['21', '22', '23', '24'].includes(division))
        return true;
    return referentiel === client_1.Referentiel.SYCEBNL && division === '20';
}
function sectionsBaremeDuCompte(numeroBien) {
    if (numeroBien.startsWith('21'))
        return ['I'];
    if (numeroBien.startsWith('22'))
        return [];
    if (numeroBien.startsWith('23'))
        return ['II', 'VI'];
    const parSousCompte = {
        '241': ['III', 'IV', 'VIII'],
        '242': ['IX'],
        '243': ['III'],
        '244': ['VI', 'VII'],
        '245': ['V'],
        '246': ['IX'],
        '247': ['VI'],
        '248': ['III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX'],
    };
    return parSousCompte[numeroBien.slice(0, 3)] ?? null;
}
exports.LIBELLES_MODE_ACQUISITION = {
    ACHAT_A_CREDIT: 'Achat à crédit (fournisseur d’investissement)',
    ACHAT_COMPTANT: 'Achat au comptant (trésorerie)',
    APPORT: 'Apport (capital, dotation, apporteurs, fondateurs)',
    FONDS_AFFECTES: 'Fonds affectés aux investissements',
    SUBVENTION_EN_NATURE: 'Subvention d’investissement en nature',
    DON_LEGS: 'Don ou legs',
    PRODUCTION_PROPRE: 'Production par l’entité elle-même',
    EN_COURS_ACHEVE: 'Travaux en cours achevés',
    AVANCE_SOLDEE: 'Avance soldée à la facture définitive',
    TITRES_NON_LIBERES: 'Titres · part non libérée',
    DEMANTELEMENT: 'Composant démantèlement (provision)',
    CONSTRUCTION_FIN_DE_BAIL: 'Construction reçue gratuitement en fin de bail',
};
function modeDeLaRacine(referentiel, racine) {
    if (racine === '4813')
        return 'TITRES_NON_LIBERES';
    if (racine.startsWith('48') || racine.startsWith('404'))
        return 'ACHAT_A_CREDIT';
    if (['52', '53', '55', '57'].some((r) => racine.startsWith(r)))
        return 'ACHAT_COMPTANT';
    if (racine === '72')
        return 'PRODUCTION_PROPRE';
    if (/^2[1-4]9/.test(racine))
        return 'EN_COURS_ACHEVE';
    if (racine === '251' || racine === '252')
        return 'AVANCE_SOLDEE';
    if (racine === '1984')
        return 'DEMANTELEMENT';
    if (racine === '14')
        return 'SUBVENTION_EN_NATURE';
    if (referentiel === client_1.Referentiel.SYSCOHADA && racine === '841')
        return 'CONSTRUCTION_FIN_DE_BAIL';
    if (referentiel === client_1.Referentiel.SYCEBNL && racine === '8410')
        return 'CONSTRUCTION_FIN_DE_BAIL';
    if (referentiel === client_1.Referentiel.SYCEBNL) {
        if (['162', '163', '164', '165'].includes(racine))
            return 'FONDS_AFFECTES';
        if (racine === '167' || racine === '171' || racine === '172')
            return 'DON_LEGS';
    }
    return 'APPORT';
}
function modeDuCompteDeContrepartie(referentiel, numero, racines) {
    const racine = racines.filter((r) => numero.startsWith(r)).sort((a, b) => b.length - a.length)[0];
    return racine ? modeDeLaRacine(referentiel, racine) : null;
}
//# sourceMappingURL=compte-du-bien.js.map