"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LIBELLE_FONDEMENT_ALEATOIRE = exports.FONDEMENTS_ADMIS = exports.COMPTES_PRIX_ALEATOIRE = void 0;
exports.motifRefusAcquisitionAleatoire = motifRefusAcquisitionAleatoire;
exports.lignesCreditAleatoire = lignesCreditAleatoire;
exports.soldeDetteAleatoire = soldeDetteAleatoire;
exports.motifRefusExtinctionAuDelaDuSolde = motifRefusExtinctionAuDelaDuSolde;
const client_1 = require("@prisma/client");
exports.COMPTES_PRIX_ALEATOIRE = {
    RENTE_VIAGERE: { dette: '1681', produitHao: '841', chargeHao: '831', source: 'AUDCIF, Titre VIII ch. 11 § 2' },
    REDEVANCES: { dette: '4811', produitHao: '841', chargeHao: '831', source: 'AUDCIF, Titre VIII ch. 2 § 11' },
};
exports.FONDEMENTS_ADMIS = {
    RENTE_VIAGERE: [client_1.FondementValeurAleatoire.PRIX_STIPULE, client_1.FondementValeurAleatoire.ESTIMATION_VALEUR_ACTUELLE],
    REDEVANCES: [client_1.FondementValeurAleatoire.REDEVANCES_ACTUALISEES, client_1.FondementValeurAleatoire.VALEUR_DROITS_ENREGISTREMENT],
};
exports.LIBELLE_FONDEMENT_ALEATOIRE = {
    PRIX_STIPULE: 'prix stipulé au contrat',
    ESTIMATION_VALEUR_ACTUELLE: 'estimation de la valeur actuelle du bien',
    REDEVANCES_ACTUALISEES: 'valeur actualisée des redevances probables',
    VALEUR_DROITS_ENREGISTREMENT: "valeur retenue pour les droits d'enregistrement",
};
const TRESORERIE = ['52', '53', '55', '57'];
const arrondi = (x) => Math.round(x * 100) / 100;
function motifRefusAcquisitionAleatoire(e) {
    if (e.referentiel === client_1.Referentiel.SYCEBNL) {
        return e.nature === 'RENTE_VIAGERE'
            ? "Le plan SYCEBNL n'ouvre aucun compte 1681 Rentes viagères capitalisées · son 168 est « Autres fonds " +
                "affectés », un fonds et non une dette. La fiche de la classe 2 (Partie 2 ch. 3) n'écrit que l'évaluation du " +
                'bien (« pour le montant stipulé dans le contrat ou à défaut à la valeur actuelle à la date du contrat ») et ' +
                'renvoie au SYSCOHADA, sans nommer de compte de dette · aucun compte n’est choisi à la place du texte.'
            : "Le SYCEBNL n'écrit ni l'acquisition d'un incorporel au moyen de redevances ni le sort de leur écart · la " +
                'règle (AUDCIF Titre VIII ch. 2 § 11) n’est pas transposée à un dossier SYCEBNL.';
    }
    const comptes = exports.COMPTES_PRIX_ALEATOIRE[e.nature];
    if (e.nature === 'REDEVANCES' && !e.numeroCompteBien.startsWith('21')) {
        return ('Les redevances visent un actif immatériel (brevet, marque, fonds de commerce) · le bien se porte à un compte ' +
            `d'immobilisation incorporelle (21), « par le crédit du compte 4811 » (${comptes.source}).`);
    }
    if (!e.numeroCompteDette.startsWith(comptes.dette)) {
        return e.nature === 'RENTE_VIAGERE'
            ? "La dette d'une rente viagère se porte au 1681 Rentes viagères capitalisées (AUDCIF, Titre VIII ch. 11 § 2.3.1)."
            : `La dette des redevances se porte au 4811 Fournisseurs d'immobilisations incorporelles (${comptes.source}).`;
    }
    if (!exports.FONDEMENTS_ADMIS[e.nature].includes(e.fondement)) {
        return e.nature === 'RENTE_VIAGERE'
            ? "La valeur d'un bien acquis en viager est « le montant qui résulte d'une stipulation de prix ou, à défaut, " +
                "d'une estimation » (AUDCIF Titre VIII ch. 11 § 2.2)."
            : 'La valeur actuelle du bien s’estime « soit par la valeur actualisée des redevances probables […] soit par la ' +
                "valeur retenue par les parties pour le paiement des droits d'enregistrement » (AUDCIF Titre VIII ch. 2 § 11).";
    }
    if (!e.source?.trim()) {
        return "Indiquez d'où vient la valeur retenue (contrat, acte, calcul d'actualisation) · elle est estimée, et le " +
            'réviseur la demandera.';
    }
    if (!(e.valeur > 0))
        return 'La valeur du bien doit être positive.';
    if (e.comptant < 0)
        return 'Le montant payé comptant ne peut pas être négatif.';
    if (arrondi(e.valeur - e.comptant) <= 0) {
        return e.nature === 'RENTE_VIAGERE'
            ? 'Le bouquet couvre toute la valeur · il ne reste aucune rente à capitaliser au 1681, et le bien s’acquiert comptant.'
            : 'Le versement immédiat couvre toute la valeur · il ne reste aucune redevance à porter au 4811.';
    }
    if (e.comptant > 0) {
        if (!e.numeroCompteComptant || !TRESORERIE.some((r) => e.numeroCompteComptant.startsWith(r))) {
            return e.nature === 'RENTE_VIAGERE'
                ? 'Le bouquet se paie par un « compte de trésorerie » (AUDCIF Titre VIII ch. 11 § 2.3.1) · 52, 53, 55 ou 57.'
                : 'Le versement immédiat se paie par la trésorerie (Guide d’application, Application 26) · 52, 53, 55 ou 57.';
        }
    }
    return null;
}
function lignesCreditAleatoire(e) {
    const dette = arrondi(e.valeur - e.comptant);
    return [
        ...(e.comptant > 0 && e.compteComptantId ? [{ compteId: e.compteComptantId, montant: arrondi(e.comptant) }] : []),
        { compteId: e.compteDetteId, montant: dette },
    ];
}
function soldeDetteAleatoire(e) {
    if (!(e.versementsCumules >= 0))
        return { motif: 'Les versements cumulés ne peuvent pas être négatifs.' };
    const comptes = exports.COMPTES_PRIX_ALEATOIRE[e.nature];
    const ecart = arrondi(e.versementsCumules - e.detteInitiale);
    if (e.nature === 'RENTE_VIAGERE') {
        if (ecart >= 0) {
            return {
                motif: 'Les rentes versées ont déjà éteint la dette capitalisée · il ne reste rien à solder au décès. Les ' +
                    'versements faits au-delà du terme sont des charges H.A.O. au 831 (AUDCIF Titre VIII ch. 11 § 2.4), ' +
                    'passées avec leur paiement.',
            };
        }
        return { cas: 'EXTINCTION', montant: -ecart, debiteLaDette: true, compteContrepartie: comptes.produitHao };
    }
    if (ecart === 0) {
        return { motif: 'Les redevances effectives égalent le montant estimé · il n’y a aucun écart à constater.' };
    }
    return ecart > 0
        ? { cas: 'EXCEDENT', montant: ecart, debiteLaDette: false, compteContrepartie: comptes.chargeHao }
        : { cas: 'INSUFFISANCE', montant: -ecart, debiteLaDette: true, compteContrepartie: comptes.produitHao };
}
function motifRefusExtinctionAuDelaDuSolde(e) {
    if (Math.round((e.montant - e.soldeCrediteur) * 100) <= 0)
        return null;
    const solde = arrondi(e.soldeCrediteur);
    const lecture = solde > 0
        ? `ne porte plus que ${solde.toFixed(2)} au crédit`
        : solde === 0
            ? 'est soldé'
            : `est déjà débiteur de ${(-solde).toFixed(2)}`;
    return (`L'extinction calculée (${arrondi(e.montant).toFixed(2)}) dépasse ce que le compte ${e.numeroCompteDette} porte ` +
        `encore · à cette date, il ${lecture}. Vérifiez le cumul des versements déclarés (un versement oublié ` +
        'gonfle l’extinction) et que chaque versement est passé au journal, puis recommencez.');
}
//# sourceMappingURL=acquisition-prix-aleatoire.js.map