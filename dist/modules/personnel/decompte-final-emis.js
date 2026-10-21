"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NATURES_PROPRES_AU_DECOMPTE = exports.MOTIF_GRATIFICATION = exports.auCentime = exports.AVERTISSEMENT_SANS_COMPTE = exports.RESERVE_REMUNERATION_ARTICLE_66 = exports.FONDEMENT_ASSIETTE_SOCIALE_INDEMNITE = exports.RESERVE_EN_FRANCS = exports.RESERVE_DU_PAR_LE_TRAVAILLEUR = exports.RESERVE_VERSEMENT_UNIQUE = exports.CLE_ARRIERES = exports.NATURE_DES_RUBRIQUES = void 0;
exports.elementsDuDecompte = elementsDuDecompte;
exports.motifsDoubleCompte = motifsDoubleCompte;
exports.motifsElementsNegatifs = motifsElementsNegatifs;
exports.avertissementsPassation = avertissementsPassation;
exports.arrieresDesElements = arrieresDesElements;
exports.motifRefusMoisDeCessation = motifRefusMoisDeCessation;
exports.motifRefusTypeContrat = motifRefusTypeContrat;
const passation_paie_1 = require("./passation-paie");
const au_centime_1 = require("./au-centime");
Object.defineProperty(exports, "auCentime", { enumerable: true, get: function () { return au_centime_1.auCentime; } });
const decompte_final_1 = require("./decompte-final");
exports.NATURE_DES_RUBRIQUES = {
    preavis: 'INDEMNITE_DE_FIN_DE_CONTRAT',
    'remuneration-preavis-restant': 'INDEMNITE_DE_FIN_DE_CONTRAT',
    'dommages-interets-art-70': 'INDEMNITE_DE_FIN_DE_CONTRAT',
    conge: 'ALLOCATION_OU_INDEMNITE_COMPENSATOIRE_DE_CONGE',
    gratification: 'GRATIFICATION_OU_MOIS_COMPLEMENTAIRE',
    'indemnite-stipulee': 'INDEMNITE_DE_FIN_DE_CONTRAT',
    'allocations-familiales': 'ALLOCATIONS_FAMILIALES_LEGALES',
};
exports.CLE_ARRIERES = 'arrieres';
exports.RESERVE_VERSEMENT_UNIQUE = "IMPÔT AU BARÈME DU MOIS (loi n° 23/053, art. 118 et 119) · le revenu du mois de cessation, indemnités comprises, est " +
    "imposable en entier au mois de sa mise à disposition (art. 68, 6° et art. 115) et annualisé comme celui d'un bulletin " +
    "(décision du cabinet du 2026-10-02, convention de mensualisation). AUCUN TAUX SPÉCIAL · aucun texte en vigueur n'en " +
    "porte pour ces sommes, ni étalement. Un versement unique qui couvre plusieurs périodes (préavis, congé) monte dans les " +
    "tranches du barème, et la retenue peut dépasser l'impôt que ces sommes auraient porté, mois après mois · elle reste un " +
    "ACOMPTE sur l'impôt annuel (art. 116 et 121), et « toute retenue à la source qui s'avère supérieure au montant de " +
    "l'impôt exigible calculé conformément à l'article 118 » est prise en compte par l'Administration des Impôts pour le " +
    "règlement d'obligations fiscales antérieures ou futures (art. 121, al. 3).";
exports.RESERVE_DU_PAR_LE_TRAVAILLEUR = "SOMMES DUES PAR LE TRAVAILLEUR (art. 63, al. 3 ; art. 70) · ni retenues sur le net, ni comptées au total. L'article " +
    "112 ferme la liste des retenues sur la rémunération, et OmegaX n'opère aucune compensation qu'il ne nomme pas.";
exports.RESERVE_EN_FRANCS = "Le décompte se chiffre en francs congolais · ses rubriques (taux journalier, moyennes des douze mois) le sont, " +
    "et une stipulation en dollars ne s'y mêle pas.";
exports.FONDEMENT_ASSIETTE_SOCIALE_INDEMNITE = "ASSIETTE SOCIALE · par le texte. La rémunération du Code du travail (art. 7, point 8) comprend tous les gains " +
    "« fixés par un accord ou par les dispositions légales » dus en vertu du contrat, et sa liste d'exclusion est fermée ; " +
    "l'indemnité de préavis est la rémunération du délai (art. 63, al. 3), et les cotisations sont dues pour toute période " +
    "dont l'employeur doit la rémunération (arrêté n° 146/2018, art. 20 ; loi n° 16/009, art. 13). Ses avantages en " +
    "logement ou en transport, eux, sont ventilés sous leur nature, que l'art. 7 exclut.";
exports.RESERVE_REMUNERATION_ARTICLE_66 = "RÉMUNÉRATION DU TEMPS RESTANT (Code du travail, art. 66, al. 2, « l'employeur doit la rémunération ») · élément de la " +
    "rémunération au sens de l'art. 7, point 8, dans l'assiette sociale par le texte ; imposable (loi n° 23/053, art. 68, " +
    "al. 1er et 1°). Passée au 6614 avec les indemnités de préavis (fiche du compte 66), part du préavis payée sans travail.";
const RESERVE_EMISSION_PAR_RUBRIQUE = {
    'remuneration-preavis-restant': exports.RESERVE_REMUNERATION_ARTICLE_66,
};
exports.AVERTISSEMENT_SANS_COMPTE = "CE DOCUMENT NE PASSERA PAS AU JOURNAL tant que le compte de cette nature n'est pas tranché · aucune fiche du compte " +
    "66 des deux textes ne le nomme, et OmegaX n'en devine aucun (pas même le 6616). La paie du mois qui le porte sera " +
    "refusée à la passation.";
exports.MOTIF_GRATIFICATION = 'Déclarez la gratification, zéro compris.';
function elementsDuDecompte(verdict, ventilation = []) {
    const refus = [];
    const elements = [];
    const toutes = [...verdict.rubriques, ...verdict.horsBrut];
    const ventilees = new Set();
    for (const r of toutes) {
        if (r.montantFc === null) {
            refus.push(r.cle === 'gratification'
                ? r.reserve?.startsWith(decompte_final_1.PREFIXE_GRATIFICATION_STIPULEE)
                    ? r.reserve
                    : exports.MOTIF_GRATIFICATION
                : `${r.libelle} non chiffrée · ${r.reserve ?? r.fondement}`);
            continue;
        }
        if (r.cle === exports.CLE_ARRIERES)
            continue;
        const nature = exports.NATURE_DES_RUBRIQUES[r.cle];
        if (!nature) {
            refus.push(`${r.libelle} · aucune nature de paie n'est déclarée pour cette rubrique, elle n'est pas rangée par défaut.`);
            continue;
        }
        if (r.montantFc < 0) {
            refus.push(`${r.libelle} négative (${r.montantFc.toFixed(2)} FC) · un décompte ne porte pas de montant négatif.`);
            continue;
        }
        const montant = (0, au_centime_1.auCentime)(r.montantFc);
        if (montant === 0)
            continue;
        const reserve = nature === 'INDEMNITE_DE_FIN_DE_CONTRAT'
            ? (RESERVE_EMISSION_PAR_RUBRIQUE[r.cle] ?? exports.FONDEMENT_ASSIETTE_SOCIALE_INDEMNITE)
            : null;
        const avantages = (0, au_centime_1.auCentime)(r.avantagesInclusFc ?? 0);
        if (avantages <= 0) {
            elements.push({ nature, libelle: r.libelle, montantFc: montant, cleRubrique: r.cle, reserve });
            continue;
        }
        const lignes = ventilation.filter((v) => v.rubrique === r.cle);
        ventilees.add(r.cle);
        const ventile = (0, au_centime_1.auCentime)(lignes.reduce((n, v) => n + (0, au_centime_1.auCentime)(v.montantFc), 0));
        if (lignes.length === 0 || ventile !== avantages || lignes.some((v) => !(v.montantFc > 0))) {
            refus.push(`${r.libelle} · ${avantages.toFixed(2)} FC d'avantages de toute nature sont compris dans ce montant · ventilez-les ` +
                'par nature (logement, transport, soins, ou avantage gardé dans la rémunération), au centime' +
                (lignes.length ? ` (${ventile.toFixed(2)} FC ventilés).` : '.'));
            continue;
        }
        elements.push({ nature, libelle: r.libelle, montantFc: (0, au_centime_1.auCentime)(montant - avantages), cleRubrique: r.cle, reserve });
        for (const v of lignes) {
            const natureV = v.nature === 'REMUNERATION' ? 'INDEMNITE_DE_FIN_DE_CONTRAT' : v.nature;
            elements.push({
                nature: natureV,
                libelle: v.libelle,
                montantFc: (0, au_centime_1.auCentime)(v.montantFc),
                cleRubrique: r.cle,
                ...(typeof v.conditionArticle69Attestee === 'boolean' ? { conditionArticle69Attestee: v.conditionArticle69Attestee } : {}),
                reserve: natureV === 'INDEMNITE_DE_FIN_DE_CONTRAT' ? exports.FONDEMENT_ASSIETTE_SOCIALE_INDEMNITE : null,
            });
        }
    }
    for (const v of ventilation) {
        if (!ventilees.has(v.rubrique)) {
            refus.push(`« ${v.libelle} » · la rubrique ${v.rubrique} ne comprend aucun avantage à ventiler · ` +
                (v.rubrique === 'preavis'
                    ? "les « Avantages pendant le préavis » ne s'ajoutent qu'à un préavis non observé à la charge de l'employeur ou dispensé par lui (art. 63, al. 3) ; videz ce champ ou la ventilation."
                    : "les « Avantages jusqu'au terme » ne s'ajoutent qu'aux dommages-intérêts d'une rupture de contrat à durée déterminée par l'employeur (art. 70, al. 2) ; videz ce champ ou la ventilation."));
        }
    }
    if (refus.length === 0 && (verdict.totalBrutFc === null || verdict.totalDuAuTravailleurFc === null)) {
        refus.push('Le total du décompte est indéterminé.');
    }
    return { elements: elements.filter((e) => e.montantFc > 0), refus };
}
exports.NATURES_PROPRES_AU_DECOMPTE = [
    'ALLOCATION_OU_INDEMNITE_COMPENSATOIRE_DE_CONGE',
    'GRATIFICATION_OU_MOIS_COMPLEMENTAIRE',
    'ALLOCATIONS_FAMILIALES_LEGALES',
];
function motifsDoubleCompte(elementsDuMois, indemnites) {
    return exports.NATURES_PROPRES_AU_DECOMPTE.filter((n) => elementsDuMois.some((e) => e.nature === n && e.montantFc > 0) && indemnites.some((e) => e.nature === n)).map((n) => `${n} figure à la fois parmi les éléments du mois et dans une rubrique du décompte · elle serait versée deux fois. ` +
        'Retirez-la des éléments du mois, le décompte la porte.');
}
function motifsElementsNegatifs(elements) {
    return elements
        .filter((e) => !(typeof e.montantFc === 'number' && Number.isFinite(e.montantFc) && e.montantFc >= 0))
        .map((e) => `« ${e.libelle} » · montant négatif ou illisible · un élément de paie ne se saisit pas en négatif.`);
}
function avertissementsPassation(elements, sansImputation) {
    const natures = [...new Set(elements.map((e) => e.nature).filter((n) => sansImputation[n]))];
    return natures.map((n) => `${n} · ${exports.AVERTISSEMENT_SANS_COMPTE}`);
}
function arrieresDesElements(elements) {
    const centimes = elements
        .filter((e) => (0, passation_paie_1.estVerseEnEspeces)(e.nature, e.enNature))
        .reduce((n, e) => n + Math.round(e.montantFc * 100), 0);
    return centimes / 100;
}
function motifRefusMoisDeCessation(dateFin, moisDeCessation) {
    if (!dateFin) {
        return "Le contrat n'est pas terminé au registre · déclarez d'abord sa fin (date et motif), le décompte final se remet à la résiliation.";
    }
    const mois = dateFin.toISOString().slice(0, 7);
    if (mois !== moisDeCessation) {
        return `Le contrat prend fin en ${mois} · le décompte final porte sur le mois de cessation, pas sur ${moisDeCessation}.`;
    }
    return null;
}
function motifRefusTypeContrat(typeRegistre, typeDeclare) {
    if (typeRegistre !== 'DUREE_INDETERMINEE' && typeRegistre !== 'DUREE_DETERMINEE') {
        return "Le décompte final ne chiffre que le contrat à durée indéterminée ou déterminée (art. 64, 69 et 70) · ce contrat est d'un autre type au registre.";
    }
    if (typeRegistre !== typeDeclare) {
        return `Le registre porte un contrat ${typeRegistre === 'DUREE_INDETERMINEE' ? 'à durée indéterminée' : 'à durée déterminée'} · le type déclaré au décompte le contredit.`;
    }
    return null;
}
//# sourceMappingURL=decompte-final-emis.js.map