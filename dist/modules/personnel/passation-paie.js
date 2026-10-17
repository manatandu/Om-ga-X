"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RESERVE_DETTE_INPP_ONEM = exports.IMPUTATION_PAR_NATURE = exports.NATURES_SANS_IMPUTATION = exports.compteDuRole = exports.RESERVE_INDEMNITES_PERSONNEL_NATIONAL = exports.NOMENCLATURE_PAIE = void 0;
exports.estVerseEnEspeces = estVerseEnEspeces;
exports.passationPaie = passationPaie;
const assiettes_paie_1 = require("./assiettes-paie");
const avances_salaire_1 = require("./avances-salaire");
exports.NOMENCLATURE_PAIE = {
    APPOINTEMENTS_ET_COMMISSIONS: {
        SYSCOHADA: '66110000',
        SYCEBNL: '66110000',
        intitule: 'Appointements, salaires et commissions',
        divergent: false,
    },
    PRIMES_ET_GRATIFICATIONS: {
        SYSCOHADA: '66120000',
        SYCEBNL: '66120000',
        intitule: 'Primes et gratifications',
        divergent: false,
    },
    CONGES_PAYES: {
        SYSCOHADA: '66130000',
        SYCEBNL: '66130000',
        intitule: 'Congés payés',
        divergent: false,
    },
    INDEMNITES_DE_PREAVIS_ET_LICENCIEMENT: {
        SYSCOHADA: '66140000',
        SYCEBNL: '66140000',
        intitule: 'Indemnités de préavis et de licenciement',
        divergent: false,
    },
    INDEMNITES_DE_MALADIE: {
        SYSCOHADA: '66150000',
        SYCEBNL: '66150000',
        intitule: 'Indemnités de maladie versées aux travailleurs',
        divergent: false,
    },
    AVANTAGES_EN_NATURE: {
        SYSCOHADA: '66170000',
        SYCEBNL: '66170000',
        intitule: 'Avantages en nature',
        divergent: false,
    },
    AUTRES_REMUNERATIONS_DIRECTES: {
        SYSCOHADA: '66180000',
        SYCEBNL: '66180000',
        intitule: 'Autres rémunérations directes',
        divergent: false,
    },
    INDEMNITE_DE_LOGEMENT: {
        SYSCOHADA: '66310000',
        SYCEBNL: '66310000',
        intitule: 'Indemnités de logement',
        divergent: false,
    },
    INDEMNITE_DE_TRANSPORT: {
        SYSCOHADA: '66340000',
        SYCEBNL: '66340000',
        intitule: 'Indemnités de transport',
        divergent: false,
    },
    AUTRES_INDEMNITES: {
        SYSCOHADA: '66380000',
        SYCEBNL: '66380000',
        intitule: 'Autres indemnités et avantages divers',
        divergent: false,
    },
    CHARGES_SOCIALES_PATRONALES: {
        SYSCOHADA: '66410000',
        SYCEBNL: '66410000',
        intitule: 'Charges sociales sur rémunération du personnel national',
        divergent: false,
    },
    CNSS_PRESTATIONS_FAMILIALES: {
        SYSCOHADA: '43110000',
        SYCEBNL: '43110000',
        intitule: 'Sécurité sociale · prestations familiales',
        divergent: false,
    },
    CNSS_RISQUES_PROFESSIONNELS: {
        SYSCOHADA: '43120000',
        SYCEBNL: '43120000',
        intitule: 'Sécurité sociale · accidents de travail',
        divergent: false,
    },
    CNSS_PENSIONS: {
        SYSCOHADA: '43130000',
        SYCEBNL: '43210000',
        intitule: 'Caisse de retraite obligatoire',
        divergent: true,
    },
    FORMATION_PROFESSIONNELLE_CONTINUE: {
        SYSCOHADA: '64150000',
        SYCEBNL: '64150000',
        intitule: 'Formation professionnelle continue (INPP)',
        divergent: false,
    },
    TAXES_SUR_SALAIRES: {
        SYSCOHADA: '64130000',
        SYCEBNL: '64130000',
        intitule: 'Taxes sur appointements et salaires (ONEM)',
        divergent: false,
    },
    AUTRES_IMPOTS_ET_TAXES: {
        SYSCOHADA: '44280000',
        SYCEBNL: '44280000',
        intitule: 'Autres impôts et taxes (INPP, ONEM)',
        divergent: false,
    },
    IRPP_RETENU: {
        SYSCOHADA: '44720000',
        SYCEBNL: '44720000',
        intitule: 'État, impôts retenus à la source · impôts sur salaires',
        divergent: false,
    },
    REMUNERATIONS_DUES: {
        SYSCOHADA: '42200000',
        SYCEBNL: '42200000',
        intitule: 'Personnel, rémunérations dues',
        divergent: false,
    },
    TRANSFERTS_DE_CHARGES: {
        SYSCOHADA: '78100000',
        SYCEBNL: '78100000',
        intitule: "Transferts de charges d'exploitation",
        divergent: false,
    },
};
exports.RESERVE_INDEMNITES_PERSONNEL_NATIONAL = "Le 6614 vise le personnel NATIONAL. Une indemnité de fin de contrat due à un non-national va au 66240000, et OmegaX ne connaît pas la nationalité ligne à ligne.";
const compteDuRole = (role, referentiel) => exports.NOMENCLATURE_PAIE[role][referentiel];
exports.compteDuRole = compteDuRole;
exports.NATURES_SANS_IMPUTATION = {
    PARTICIPATION_AUX_BENEFICES: "Le SYSCOHADA ouvre 42610000 « Participation aux bénéfices », le SYCEBNL N'OUVRE PAS de 426 du tout. L'absence est elle-même la réponse : une entité à but non lucratif n'a pas de bénéfices à partager. Et côté SYSCOHADA, la participation suit un régime propre (affectation du résultat), non une charge de paie du mois.",
    ALLOCATIONS_FAMILIALES_LEGALES: "Sur un bulletin, cette nature est l'allocation familiale minima que l'EMPLOYEUR doit (colonne 19 de l'annexe du décret n° 25/22, art. 5 ; Code du travail, art. 87) · c'est une charge. Les fiches des comptes 66 des deux plans ne nomment aucun compte pour elle, et le 4242 « Allocations familiales » est un compte de tiers des œuvres sociales internes, pas une charge · OmegaX ne devine pas le numéro. La prestation de 8 100 FC que la CNSS fait payer par l'employeur en dévolution (arrêté n° 143/2018, art. 3 et 4) est autre chose : ce sont des fonds de la Caisse remis avant le paiement, les non-payés lui revenant sous huit jours · ni charge ni créance de l'employeur, elle ne passe pas par le bulletin.",
    SOINS_DE_SANTE: "Le plan ouvre plusieurs comptes qui pourraient la recevoir (66840000 médecine du travail et pharmacie, 66850000 assurances et organismes de santé, 42410000 œuvres sociales internes · assistance médicale), et aucune source lue ne dit lequel reçoit un remboursement de frais médicaux à un travailleur. La qualification appartient au cabinet.",
    FRAIS_DE_VOYAGE_OU_AVANTAGE_DE_FONCTION: "Un frais de voyage professionnel est un transport (classe 61), un avantage de fonction une charge de personnel (663), et un remboursement de dépense effective n'est ni l'un ni l'autre. Aucune source lue ne tranche à partir de la seule nature, et l'article 68, 1 de la loi n° 23/053 renvoie justement au caractère EFFECTIF de la dépense, qui est une qualification.",
};
exports.IMPUTATION_PAR_NATURE = {
    SALAIRE_OU_TRAITEMENT: 'APPOINTEMENTS_ET_COMMISSIONS',
    COMMISSION: 'APPOINTEMENTS_ET_COMMISSIONS',
    PRIME: 'PRIMES_ET_GRATIFICATIONS',
    GRATIFICATION_OU_MOIS_COMPLEMENTAIRE: 'PRIMES_ET_GRATIFICATIONS',
    PRESTATION_SUPPLEMENTAIRE: 'AUTRES_REMUNERATIONS_DIRECTES',
    INDEMNITE_DE_VIE_CHERE: 'AUTRES_INDEMNITES',
    AVANTAGE_EN_NATURE: 'AVANTAGES_EN_NATURE',
    ALLOCATION_OU_INDEMNITE_COMPENSATOIRE_DE_CONGE: 'CONGES_PAYES',
    INDEMNITE_INCAPACITE_OU_ACCOUCHEMENT: 'INDEMNITES_DE_MALADIE',
    INDEMNITE_DE_FIN_DE_CONTRAT: 'INDEMNITES_DE_PREAVIS_ET_LICENCIEMENT',
    LOGEMENT_OU_SON_INDEMNITE: 'INDEMNITE_DE_LOGEMENT',
    INDEMNITE_DE_TRANSPORT: 'INDEMNITE_DE_TRANSPORT',
};
function estVerseEnEspeces(nature, enNature) {
    if (nature === 'AVANTAGE_EN_NATURE')
        return false;
    return !(enNature === true && assiettes_paie_1.NATURES_FOURNIES_EN_NATURE.includes(nature));
}
const ROLE_PAR_CLE_COTISATION = {
    'cnss-pf': 'CNSS_PRESTATIONS_FAMILIALES',
    'cnss-rp': 'CNSS_RISQUES_PROFESSIONNELS',
    'cnss-pension-employeur': 'CNSS_PENSIONS',
    'cnss-pension-travailleur': 'CNSS_PENSIONS',
};
const CHARGE_PAR_CLE_TAXE = {
    inpp: 'FORMATION_PROFESSIONNELLE_CONTINUE',
    onem: 'TAXES_SUR_SALAIRES',
};
exports.RESERVE_DETTE_INPP_ONEM = "L'INPP ET L'ONEM SONT DES IMPÔTS ET TAXES, pas des charges sociales · la fiche du compte 64 des deux textes les débite « par le crédit du compte 44 », et la fiche du compte 66 exclut « les impôts dont l'assiette repose sur la rémunération ». La dette va au 44280000 « Autres impôts et taxes » ; le cabinet qui veut suivre l'INPP et l'ONEM à part subdivise le 4428 au cinquième chiffre.";
function passationPaie(entree) {
    const refus = [];
    const reserves = [];
    const lignes = [];
    const r = entree.referentiel;
    const parRole = new Map();
    for (const e of entree.elements) {
        if (!estVerseEnEspeces(e.nature, e.enNature) && e.nature !== 'AVANTAGE_EN_NATURE') {
            parRole.set('AVANTAGES_EN_NATURE', (parRole.get('AVANTAGES_EN_NATURE') ?? 0) + Math.max(0, e.montantFc));
            continue;
        }
        const sansImputation = exports.NATURES_SANS_IMPUTATION[e.nature];
        if (sansImputation) {
            refus.push({
                motif: 'NATURE_SANS_IMPUTATION',
                explication: `« ${e.libelle} » (${e.nature}) · ${sansImputation}`,
            });
            continue;
        }
        const role = exports.IMPUTATION_PAR_NATURE[e.nature];
        if (!role) {
            refus.push({
                motif: 'NATURE_SANS_IMPUTATION',
                explication: `« ${e.libelle} » (${e.nature}) · aucune imputation n'est déclarée pour cette nature.`,
            });
            continue;
        }
        parRole.set(role, (parRole.get(role) ?? 0) + Math.max(0, e.montantFc));
    }
    if (entree.abstentionsCotisations.length > 0) {
        refus.push({
            motif: 'COTISATION_EN_ABSTENTION',
            explication: "Une cotisation au moins n'est pas chiffrée : " +
                entree.abstentionsCotisations.join(' ') +
                " L'écriture serait pourtant ÉQUILIBRÉE, avec une charge de personnel minorée du montant manquant, et rien en aval ne le verrait.",
        });
    }
    if (entree.irppFc === null || entree.netAPayerFc === null) {
        refus.push({
            motif: 'IMPOT_INDETERMINE',
            explication: "L'impôt du mois n'est pas chiffré, et le net à payer ne l'est donc pas non plus. Aucune écriture n'est proposée.",
        });
    }
    if (refus.length > 0) {
        return {
            referentiel: r,
            lignes: [],
            totalDebitFc: 0,
            totalCreditFc: 0,
            equilibree: false,
            refus,
            reserves,
        };
    }
    const reserveBrut = (role) => role === 'INDEMNITES_DE_PREAVIS_ET_LICENCIEMENT' ? exports.RESERVE_INDEMNITES_PERSONNEL_NATIONAL : null;
    const reserveRole = (role) => exports.NOMENCLATURE_PAIE[role].divergent
        ? `NUMÉRO PROPRE AU RÉFÉRENTIEL · ce rôle est au ${exports.NOMENCLATURE_PAIE[role].SYSCOHADA} en SYSCOHADA et au ${exports.NOMENCLATURE_PAIE[role].SYCEBNL} en SYCEBNL. L'autre numéro n'est pas ouvert dans ce plan.`
        : null;
    let brutFc = 0;
    for (const [role, montantFc] of parRole) {
        if (montantFc <= 0 || role === 'AVANTAGES_EN_NATURE')
            continue;
        brutFc += montantFc;
        lignes.push({
            bloc: 'BRUT',
            compte: (0, exports.compteDuRole)(role, r),
            intitule: exports.NOMENCLATURE_PAIE[role].intitule,
            sens: 'DEBIT',
            montantFc,
            reserve: reserveBrut(role),
        });
    }
    lignes.push({
        bloc: 'BRUT',
        compte: (0, exports.compteDuRole)('REMUNERATIONS_DUES', r),
        intitule: exports.NOMENCLATURE_PAIE.REMUNERATIONS_DUES.intitule,
        sens: 'CREDIT',
        montantFc: brutFc,
        reserve: "LE 422 EST CRÉDITÉ DU BRUT, puis débité des retenues · son solde est le net à payer. LE RÈGLEMENT EST UNE SECONDE ÉCRITURE · le 422 est débité des paiements par le crédit de la trésorerie, dans un autre journal. Les deux textes l'écrivent à la fiche de leur compte 42.",
    });
    const ouvrieres = new Map();
    const patronalesParRole = new Map();
    const taxesParRole = new Map();
    for (const c of entree.cotisations) {
        if (c.montantFc <= 0)
            continue;
        const chargeTaxe = CHARGE_PAR_CLE_TAXE[c.cle];
        if (chargeTaxe) {
            taxesParRole.set(chargeTaxe, (taxesParRole.get(chargeTaxe) ?? 0) + c.montantFc);
            continue;
        }
        const role = ROLE_PAR_CLE_COTISATION[c.cle];
        if (!role)
            continue;
        const cible = c.charge === 'TRAVAILLEUR' ? ouvrieres : patronalesParRole;
        cible.set(role, (cible.get(role) ?? 0) + c.montantFc);
    }
    const irppFc = Math.max(0, entree.irppFc ?? 0);
    let retenuesFc = irppFc;
    for (const m of ouvrieres.values())
        retenuesFc += m;
    const avancesParCompte = new Map();
    for (const a of entree.retenuesAvances ?? []) {
        if (!(a.montantFc > 0))
            continue;
        const { compte, intitule } = (0, avances_salaire_1.compteDeLAvance)(a.type, a.categoriePret);
        const cumul = avancesParCompte.get(compte) ?? { intitule, montantFc: 0 };
        cumul.montantFc += a.montantFc;
        avancesParCompte.set(compte, cumul);
        retenuesFc += a.montantFc;
    }
    if (retenuesFc > 0) {
        lignes.push({
            bloc: 'RETENUES',
            compte: (0, exports.compteDuRole)('REMUNERATIONS_DUES', r),
            intitule: exports.NOMENCLATURE_PAIE.REMUNERATIONS_DUES.intitule,
            sens: 'DEBIT',
            montantFc: retenuesFc,
            reserve: null,
        });
        for (const [role, montantFc] of ouvrieres) {
            lignes.push({
                bloc: 'RETENUES',
                compte: (0, exports.compteDuRole)(role, r),
                intitule: exports.NOMENCLATURE_PAIE[role].intitule,
                sens: 'CREDIT',
                montantFc,
                reserve: reserveRole(role),
            });
        }
        for (const [compte, { intitule, montantFc }] of avancesParCompte) {
            lignes.push({
                bloc: 'RETENUES',
                compte,
                intitule,
                sens: 'CREDIT',
                montantFc,
                reserve: "RETENUE DE L'ARTICLE 112, c) OU f) · le 422 est viré vers le compte de l'avance (Guide d'application SYSCOHADA, Partie 1 ch. 3, § 4.3 et Application 10). Un prêt reste au 272 · les deux plans l'excluent du 42.",
            });
        }
        if (irppFc > 0) {
            lignes.push({
                bloc: 'RETENUES',
                compte: (0, exports.compteDuRole)('IRPP_RETENU', r),
                intitule: exports.NOMENCLATURE_PAIE.IRPP_RETENU.intitule,
                sens: 'CREDIT',
                montantFc: irppFc,
                reserve: "L'IMPÔT RETENU N'EST PAS UNE CHARGE DE L'EMPLOYEUR · il est prélevé sur le brut du salarié et reversé pour son compte. C'est l'IRPP de l'article 119 de la loi n° 23/053 qui s'y loge.",
            });
        }
    }
    let patronalesFc = 0;
    for (const m of patronalesParRole.values())
        patronalesFc += m;
    if (patronalesFc > 0) {
        lignes.push({
            bloc: 'PATRONALES',
            compte: (0, exports.compteDuRole)('CHARGES_SOCIALES_PATRONALES', r),
            intitule: exports.NOMENCLATURE_PAIE.CHARGES_SOCIALES_PATRONALES.intitule,
            sens: 'DEBIT',
            montantFc: patronalesFc,
            reserve: "Le 6641 vise le personnel NATIONAL. Un dossier qui emploie des non-nationaux ventile entre 66410000 et 66420000, et OmegaX ne connaît pas la nationalité ligne à ligne.",
        });
        for (const [role, montantFc] of patronalesParRole) {
            lignes.push({
                bloc: 'PATRONALES',
                compte: (0, exports.compteDuRole)(role, r),
                intitule: exports.NOMENCLATURE_PAIE[role].intitule,
                sens: 'CREDIT',
                montantFc,
                reserve: reserveRole(role),
            });
        }
    }
    let taxesFc = 0;
    for (const m of taxesParRole.values())
        taxesFc += m;
    if (taxesFc > 0) {
        for (const [role, montantFc] of taxesParRole) {
            lignes.push({
                bloc: 'IMPOTS_ET_TAXES_SUR_SALAIRES',
                compte: (0, exports.compteDuRole)(role, r),
                intitule: exports.NOMENCLATURE_PAIE[role].intitule,
                sens: 'DEBIT',
                montantFc,
                reserve: null,
            });
        }
        lignes.push({
            bloc: 'IMPOTS_ET_TAXES_SUR_SALAIRES',
            compte: (0, exports.compteDuRole)('AUTRES_IMPOTS_ET_TAXES', r),
            intitule: exports.NOMENCLATURE_PAIE.AUTRES_IMPOTS_ET_TAXES.intitule,
            sens: 'CREDIT',
            montantFc: taxesFc,
            reserve: exports.RESERVE_DETTE_INPP_ONEM,
        });
    }
    const avantagesFc = parRole.get('AVANTAGES_EN_NATURE') ?? 0;
    if (avantagesFc > 0) {
        lignes.push({
            bloc: 'AVANTAGES_EN_NATURE',
            compte: (0, exports.compteDuRole)('AVANTAGES_EN_NATURE', r),
            intitule: exports.NOMENCLATURE_PAIE.AVANTAGES_EN_NATURE.intitule,
            sens: 'DEBIT',
            montantFc: avantagesFc,
            reserve: null,
        });
        lignes.push({
            bloc: 'AVANTAGES_EN_NATURE',
            compte: (0, exports.compteDuRole)('TRANSFERTS_DE_CHARGES', r),
            intitule: exports.NOMENCLATURE_PAIE.TRANSFERTS_DE_CHARGES.intitule,
            sens: 'CREDIT',
            montantFc: avantagesFc,
            reserve: "TRANSFERT DE CHARGES · les deux textes font débiter le 66 « par le crédit du compte 781 (Transferts de charges d'exploitation) pour les avantages en nature » (AUDCIF Titre VII et SYCEBNL Partie 2 ch. 3, fiche du compte 66). Il suppose la charge DÉJÀ passée par nature, à la facture du loyer, du véhicule ou du service fourni · sans elle, le 781 transférerait une charge qui n'existe pas.",
        });
    }
    if (Math.abs(brutFc - retenuesFc - entree.netAPayerFc) >= 0.005) {
        refus.push({
            motif: 'ECRITURE_DESEQUILIBREE',
            explication: `Le 422 solderait à ${(brutFc - retenuesFc).toFixed(2)} FC quand le net du bulletin est ${entree.netAPayerFc.toFixed(2)} FC. Un écart est un défaut du moteur, jamais un arrondi à rattraper. Rien n'est proposé.`,
        });
        return { referentiel: r, lignes: [], totalDebitFc: 0, totalCreditFc: 0, equilibree: false, refus, reserves };
    }
    const totalDebitFc = lignes.filter((l) => l.sens === 'DEBIT').reduce((n, l) => n + l.montantFc, 0);
    const totalCreditFc = lignes.filter((l) => l.sens === 'CREDIT').reduce((n, l) => n + l.montantFc, 0);
    const equilibree = Math.abs(totalDebitFc - totalCreditFc) < 0.005;
    if (!equilibree) {
        refus.push({
            motif: 'ECRITURE_DESEQUILIBREE',
            explication: `Débit ${totalDebitFc.toFixed(2)} FC contre crédit ${totalCreditFc.toFixed(2)} FC. ` +
                "L'écriture de paie s'équilibre par construction : un écart est un défaut du moteur, jamais un arrondi à rattraper. Rien n'est proposé.",
        });
        return {
            referentiel: r,
            lignes: [],
            totalDebitFc,
            totalCreditFc,
            equilibree: false,
            refus,
            reserves,
        };
    }
    reserves.push("OMEGAX PROPOSE, LE COMPTABLE PASSE · la simulation n'enregistre rien. Une fois les bulletins émis, la paie du mois se passe au journal en UNE écriture depuis l'onglet Bulletins ; la date, le journal et le libellé appartiennent au cabinet.");
    reserves.push("LE JOURNAL · le dossier est semé avec cinq journaux (achats, ventes, banque, caisse, opérations diverses). La paie se passe aux OPÉRATIONS DIVERSES tant que le cabinet n'a pas ouvert un journal de paie dédié, ce qu'OmegaX ne fait pas à sa place.");
    reserves.push("LES AVANTAGES EN NATURE sont transférés au 66170000 par le crédit du 78100000, comme le Guide d'application SYSCOHADA (Partie 1 ch. 3, § 4.5) : « par nature (614 transports, 622 locations, 624 entretien, 628 télécom…) puis régularisation globale fin d'exercice : débit 6617/6627, crédit 781 ». OmegaX le fait au mois de paie plutôt qu'à la clôture · le solde de l'exercice est le même. Ils ne passent ni par le 422 ni par le net à payer.");
    return { referentiel: r, lignes, totalDebitFc, totalCreditFc, equilibree, refus, reserves };
}
//# sourceMappingURL=passation-paie.js.map