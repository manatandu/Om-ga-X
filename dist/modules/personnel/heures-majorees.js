"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HEURES_DU_MOIS_AU_PLUS = exports.TAUX_MAJORATION_AU_PLUS = exports.NATURES_MAJORATION = void 0;
exports.motifRefusMajoration = motifRefusMajoration;
exports.montantDesHeures = montantDesHeures;
exports.libelleDesHeures = libelleDesHeures;
exports.NATURES_MAJORATION = {
    HEURES_SUPPLEMENTAIRES: {
        libelle: 'Heures supplémentaires',
        fondement: 'Code du travail, art. 93, 119 et 120, e)',
        heureEntiere: true,
    },
    TRAVAIL_DE_NUIT: {
        libelle: 'Travail de nuit',
        fondement: 'Code du travail, art. 124',
        heureEntiere: false,
    },
    TRAVAIL_REPOS_OU_FERIE: {
        libelle: "Travail du samedi, du dimanche ou d'un jour férié",
        fondement: 'Arrêté n° 12/CAB.MIN/ETPS/042 du 8 août 2008, mention 11',
        heureEntiere: false,
    },
};
exports.TAUX_MAJORATION_AU_PLUS = 1_000;
exports.HEURES_DU_MOIS_AU_PLUS = 744;
function motifRefusMajoration(p) {
    if (!(p.nature in exports.NATURES_MAJORATION))
        return 'Nature de majoration inconnue.';
    if (p.libelle.trim().length < 3)
        return 'La majoration se nomme (trois caractères au moins).';
    if (!Number.isFinite(p.tauxPourCent) || p.tauxPourCent <= 0 || p.tauxPourCent > exports.TAUX_MAJORATION_AU_PLUS) {
        return `Le taux de majoration est un pourcentage strictement positif, ${exports.TAUX_MAJORATION_AU_PLUS} au plus.`;
    }
    if (p.source.trim().length < 3) {
        return "La source du taux se déclare · convention collective, règlement d'entreprise ou arrêté (Code du travail, art. 120, e) et 124).";
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(p.dateEffet.slice(0, 10)))
        return "La date d'effet se lit AAAA-MM-JJ.";
    return null;
}
function montantDesHeures(p) {
    const def = exports.NATURES_MAJORATION[p.nature];
    const facteur = def.heureEntiere ? 1 + p.tauxPourCent / 100 : p.tauxPourCent / 100;
    return Math.round(p.heures * p.tauxHoraire * facteur * 100) / 100;
}
const nombre = (n) => n.toLocaleString('fr-FR', { maximumFractionDigits: 2 });
function libelleDesHeures(p) {
    const def = exports.NATURES_MAJORATION[p.nature];
    const facon = def.heureEntiere ? `majorées de ${nombre(p.tauxPourCent)} %` : `supplément de ${nombre(p.tauxPourCent)} %`;
    return `${p.libelleMajoration} · ${nombre(p.heures)} h au taux horaire de ${nombre(p.tauxHoraire)}, ${facon}`;
}
//# sourceMappingURL=heures-majorees.js.map