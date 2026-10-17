"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ACTES_DE_LA_PERIODE = exports.ACTES_DATES_QUI_SUIVENT_LEUR_DATE = exports.ACTES_QUI_SUIVENT_LEUR_ECRITURE = void 0;
exports.issueActeDeLaPeriode = issueActeDeLaPeriode;
exports.motifActesDeLaPeriode = motifActesDeLaPeriode;
exports.motifRefusArret = motifRefusArret;
exports.motifActeQuiNePeutSuivre = motifActeQuiNePeutSuivre;
exports.finDOrigineDeLExerciceArrete = finDOrigineDeLExerciceArrete;
const portefeuille_etat_1 = require("./portefeuille-etat");
exports.ACTES_QUI_SUIVENT_LEUR_ECRITURE = [
    { modele: 'depreciationImmobilisation', libelle: 'dépréciation d’immobilisation', colonne: 'ecritureId', unicite: ['immobilisationId', 'nature'], parLeBien: true },
    { modele: 'reclassementImmobilisation', libelle: 'reclassement d’immobilisation', colonne: 'ecritureId', unicite: null, parLeBien: true },
    { modele: 'regularisation', libelle: 'charge à payer ou produit à recevoir', colonne: 'ecritureConstatationId', unicite: null },
    { modele: 'clotureLocationAcquisition', libelle: 'clôture d’un contrat de location-acquisition', colonne: 'ecritureId', unicite: ['contratId'] },
    { modele: 'reductionSubventionImmobilisation', libelle: 'réduction de subvention d’investissement', colonne: 'ecritureId', unicite: null },
    { modele: 'revisionPlanAmortissement', libelle: 'révision du plan d’amortissement', colonne: 'ecritureId', unicite: null },
    { modele: 'coutEmpruntIncorpore', libelle: 'incorporation de coûts d’emprunt', colonne: 'ecritureId', unicite: null },
    { modele: 'creanceDouteuse', libelle: 'reclassement d’une créance douteuse', colonne: 'ecritureReclassementId', unicite: null },
    { modele: 'ajustementCreanceDouteuse', libelle: 'revue d’une créance douteuse', colonne: 'ecritureId', unicite: ['creanceId', 'annuleeLe'] },
    { modele: 'mouvementCreanceDouteuse', libelle: 'mouvement d’une créance douteuse', colonne: 'ecritureId', unicite: null },
    { modele: 'mouvementCreanceDouteuse', libelle: 'perte d’une créance douteuse (seconde pièce)', colonne: 'ecriturePerteId', unicite: null },
    { modele: 'annulationTraitementImmobilisation', libelle: 'annulation d’un traitement d’immobilisation', colonne: 'ecritureOrigineId', unicite: null },
];
exports.ACTES_DATES_QUI_SUIVENT_LEUR_DATE = [
    { modele: 'odAnalytique', libelle: 'OD analytique', colonne: 'date', unicite: null },
    { modele: 'engagementDepense', libelle: 'engagement de dépense', colonne: 'date', unicite: ['tenantId', 'nature', 'reference'] },
];
exports.ACTES_DE_LA_PERIODE = [
    { modele: 'dotationAmortissement', libelle: 'dotation aux amortissements', colonne: 'ecritureId', parLeBien: true, retirable: true },
    { modele: 'amortissementDerogatoire', libelle: 'amortissement dérogatoire', colonne: 'ecritureId', retirable: true },
    { modele: 'repriseSubventionImmobilisation', libelle: 'reprise de subvention d’investissement', colonne: 'ecritureId', retirable: true },
    { modele: 'mouvementDemantelement', libelle: 'mouvement de la provision pour démantèlement', colonne: 'ecritureId' },
    {
        modele: 'reevaluation',
        libelle: 'réévaluation des devises',
        colonne: 'ecritureEcartsId',
        actif: { annuleeLe: null },
        issue: 'annulez-la (Devises, réévaluations, « Annuler »)',
    },
    {
        modele: 'reevaluationBilan',
        libelle: 'réévaluation des immobilisations',
        colonne: 'ecritureId',
        issue: 'annulez-la (fiche d’un de ses biens, onglet Traitements, « Annuler »)',
    },
    {
        modele: 'repriseProvisionReevaluation',
        libelle: 'reprise de la provision spéciale de réévaluation',
        colonne: 'ecritureId',
        issue: 'annulez-la (fiche d’un de ses biens, onglet Traitements, « Annuler »)',
    },
    {
        modele: 'constatImpotResultat',
        libelle: 'constat de l’impôt sur le résultat',
        colonne: 'ecritureId',
        actif: { annuleeLe: null },
        issue: 'annulez le constat (Résultat fiscal, « Annuler l’écriture de l’impôt »)',
    },
];
function issueActeDeLaPeriode(acte, etat) {
    if (acte.issue)
        return `${acte.issue}, puis refaites-la sur chaque exercice`;
    if (acte.retirable && !etat.bienSorti) {
        return ('relancez le geste en acceptant de retirer les actes de la période (' +
            (etat.auBrouillard ? 'son écriture au brouillard part avec lui' : 'son écriture validée s’inscrit en négatif, AUDCIF art. 20, al. 2') +
            '), puis refaites-le sur chaque exercice');
    }
    return ('aucun geste d’OmegaX ne l’annule encore' +
        (etat.bienSorti ? ' (le bien est sorti, et l’acte tient sa sortie)' : '') +
        ' · la porte de régularisation reste au suivi, l’éditeur vous accompagne');
}
function motifActesDeLaPeriode(actes) {
    if (actes.length === 0)
        return null;
    const nommes = actes.slice(0, 5).map((a) => `${a.libelle} (${a.piece}, exercice ${a.periode}) · ${a.issue}`);
    return (`${actes.length} acte(s) dont le montant se calcule sur la période de l'exercice ne peuvent ni suivre leur ` +
        'écriture ni rester où ils sont, la période changeant (AUDCIF art. 59, chaque exercice ne reçoit que ce qui lui ' +
        `est propre) · ${nommes.join(' ; ')}${actes.length > 5 ? ' ; …' : ''}.`);
}
function motifRefusArret(e) {
    const d = e.dissolution;
    if (!d) {
        return 'Aucune dissolution n’est déclarée · déclarez sa date dans Paramètres du dossier avant d’arrêter l’exercice.';
    }
    if (e.exercice.clos)
        return 'Cet exercice est clôturé · ses dates ne changent plus.';
    if (d.getTime() < e.exercice.dateDebut.getTime() || d.getTime() > e.exercice.dateFin.getTime()) {
        return (`La dissolution du ${(0, portefeuille_etat_1.jourFr)(d)} ne tombe pas dans cet exercice (du ${(0, portefeuille_etat_1.jourFr)(e.exercice.dateDebut)} au ` +
            `${(0, portefeuille_etat_1.jourFr)(e.exercice.dateFin)}) · arrêtez celui qui la contient.`);
    }
    if (d.getTime() === e.exercice.dateFin.getTime()) {
        return `L'exercice se termine déjà à la date de dissolution, le ${(0, portefeuille_etat_1.jourFr)(d)}.`;
    }
    if (e.sansLiquidation) {
        if (e.ecrituresApres > 0) {
            return (`${e.ecrituresApres} écriture(s) de cet exercice sont datées après la dissolution · sans liquidation, le ` +
                'patrimoine passe à l’associé unique personne morale (AUSCGIE art. 201 al. 4), et ces opérations se passent ' +
                'dans sa comptabilité, pas dans celle de la société dissoute. Au brouillard, supprimez-les ; validées, ' +
                'inscrivez-les en négatif à une date qui précède la dissolution (AUDCIF art. 20, al. 2), puis arrêtez ' +
                'l’exercice.');
        }
        const occupe = e.posterieurs.find((p) => p.clos || p.usages);
        if (occupe) {
            return (`L'exercice du ${(0, portefeuille_etat_1.jourFr)(occupe.dateDebut)} au ${(0, portefeuille_etat_1.jourFr)(occupe.dateFin)} suit celui-ci · sans liquidation, la ` +
                'société dissoute n’a plus d’exercice après la dissolution, son patrimoine passant à l’associé unique personne ' +
                `morale (AUSCGIE art. 201 al. 4). ${occupe.clos ? 'Il est clôturé' : `Il porte ${occupe.usages}`} · ` +
                'ce qu’il porte relève de la comptabilité de l’associé. Au brouillard, supprimez-le ; validé, inscrivez-le en ' +
                'négatif (AUDCIF art. 20, al. 2) ; l’arrêt retire ensuite l’exercice vide.');
        }
        return motifActesDeLaPeriode(e.actesDeLaPeriode);
    }
    if (e.posterieurs.length > 1) {
        const [a, b] = e.posterieurs;
        return (`Les exercices du ${(0, portefeuille_etat_1.jourFr)(a.dateDebut)} au ${(0, portefeuille_etat_1.jourFr)(a.dateFin)} et du ${(0, portefeuille_etat_1.jourFr)(b.dateDebut)} au ` +
            `${(0, portefeuille_etat_1.jourFr)(b.dateFin)} suivent déjà celui-ci · la liquidation forme un seul exercice, du lendemain de la ` +
            'dissolution à sa clôture (AUDCIF art. 7 al. 4), et un seul d’entre eux peut le devenir. OmegaX ne retire pas ' +
            'un exercice · faites porter les écritures du dernier au précédent, ou contactez l’éditeur.');
    }
    if (e.posterieurs.length === 1 && e.posterieurs[0].clos) {
        return 'L’exercice qui suit est déjà clôturé · ses dates ne changent plus, et il ne peut devenir l’exercice de liquidation.';
    }
    return motifActesDeLaPeriode(e.actesDeLaPeriode);
}
function motifActeQuiNePeutSuivre(acte, piece) {
    return (`La ${acte.libelle} de la pièce ${piece} est datée après la dissolution et doit suivre son écriture dans ` +
        'l’exercice de liquidation, qui en porte déjà une de même nature · annulez l’une des deux (puis refaites-la si ' +
        'elle reste due), et relancez l’arrêt.');
}
function finDOrigineDeLExerciceArrete(dissolution) {
    return new Date(Date.UTC(dissolution.getUTCFullYear(), 11, 31));
}
//# sourceMappingURL=arret-dissolution.js.map