"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RESERVE_QUOTITE_AVANCES = exports.LITTERA_ARTICLE_112 = void 0;
exports.compteDeLAvance = compteDeLAvance;
exports.motifRefusAvance = motifRefusAvance;
exports.soldeAvance = soldeAvance;
exports.motifRefusRetenue = motifRefusRetenue;
exports.motifRefusSaisieArret = motifRefusSaisieArret;
exports.motifRefusMoisSaisie = motifRefusMoisSaisie;
exports.motifRefusFinSaisie = motifRefusFinSaisie;
exports.reserveQuotiteSaisies = reserveQuotiteSaisies;
exports.LITTERA_ARTICLE_112 = {
    AVANCE: 'c',
    ACOMPTE: 'c',
    PRET: 'f',
    SAISIE_ARRET: 'g',
};
function compteDeLAvance(type, categorie) {
    if (type === 'SAISIE_ARRET')
        return { compte: '42320000', intitule: 'Personnel, saisies-arrêts' };
    if (type === 'AVANCE')
        return { compte: '42110000', intitule: 'Personnel, avances' };
    if (type === 'ACOMPTE')
        return { compte: '42120000', intitule: 'Personnel, acomptes' };
    if (categorie === 'IMMOBILIER')
        return { compte: '27210000', intitule: 'Prêts au personnel · immobiliers' };
    if (categorie === 'MOBILIER_ET_INSTALLATION')
        return { compte: '27220000', intitule: "Prêts au personnel · mobiliers et d'installation" };
    return { compte: '27280000', intitule: 'Autres prêts au personnel' };
}
const c = (n) => Math.round(n * 100);
function motifRefusAvance(a) {
    if (!(a.montantFc > 0))
        return 'Le montant consenti doit être positif.';
    const refusSaisie = motifRefusSaisieArret(a);
    if (refusSaisie)
        return refusSaisie;
    if (a.type !== 'PRET' && a.categoriePret)
        return "Une catégorie de prêt ne s'applique qu'à un prêt (compte 272).";
    if (a.type === 'PRET' && !a.categoriePret) {
        return 'La catégorie du prêt (immobilier, mobilier et d’installation, autre) choisit la subdivision du 272 · elle est obligatoire.';
    }
    if (a.retenueMensuelleFc != null && (a.retenueMensuelleFc <= 0 || c(a.retenueMensuelleFc) > c(a.montantFc))) {
        return 'La retenue mensuelle doit être positive et ne peut dépasser le montant consenti.';
    }
    if (!a.objet?.trim())
        return "L'objet de l'avance ou du prêt est obligatoire.";
    if (!a.pieceJustificative?.trim()) {
        return "La pièce justificative (reconnaissance de dette, contrat de prêt) est obligatoire · les deux plans la nomment parmi les éléments de contrôle du compte 42.";
    }
    return null;
}
function soldeAvance(montantFc, retenues) {
    const retenu = retenues.filter((r) => !r.bulletinAnnule).reduce((s, r) => s + c(r.montantFc), 0);
    return (c(montantFc) - retenu) / 100;
}
function motifRefusRetenue(montantFc, soldeFc, libelle) {
    if (!(montantFc > 0))
        return `${libelle} · la retenue doit être positive.`;
    if (c(montantFc) > c(soldeFc)) {
        return `${libelle} · la retenue (${montantFc.toFixed(2)} FC) dépasse le solde restant dû (${soldeFc.toFixed(2)} FC). Un trop-retenu serait une réduction de rémunération que l'article 112 n'autorise pas.`;
    }
    return null;
}
exports.RESERVE_QUOTITE_AVANCES = "AUCUN PLAFOND N'EST OPPOSÉ AUX RETENUES D'AVANCE ET DE PRÊT · l'article 112 du Code du travail ne renvoie à l'article 114 " +
    "(quotité cessible) que pour son litera d). La quotité est montrée pour comparaison ; le jugement appartient au cabinet.";
function motifRefusSaisieArret(a) {
    if (a.type !== 'SAISIE_ARRET') {
        if (a.referenceActe?.trim() || a.greffe?.trim() || a.destinataire?.trim()) {
            return "La référence de l'acte, le greffe et le destinataire ne s'appliquent qu'à une saisie-arrêt notifiée.";
        }
        return null;
    }
    if (a.categoriePret)
        return "Une catégorie de prêt ne s'applique qu'à un prêt (compte 272).";
    if (!a.referenceActe?.trim()) {
        return "La référence de l'acte de saisie notifié est obligatoire · la note jointe à chaque versement la porte (AUPSRVE, art. 188).";
    }
    if (!a.greffe?.trim())
        return "Le greffe qui a notifié l'acte de saisie est obligatoire (AUPSRVE, art. 183).";
    if (!a.destinataire?.trim()) {
        return "Le destinataire des versements est obligatoire · « le greffe ou l'organisme spécialement désigné à cet effet » (AUPSRVE, art. 188).";
    }
    return null;
}
const jourIso = (d) => d.toISOString().slice(0, 10);
function motifRefusMoisSaisie(moisDePaie, dateNotification, dateFin) {
    const [a, m] = moisDePaie.split('-').map(Number);
    const premier = new Date(Date.UTC(a, m - 1, 1));
    const dernier = new Date(Date.UTC(a, m, 0));
    if (dernier < dateNotification) {
        return (`La saisie a été notifiée le ${jourIso(dateNotification)} · la quotité n'est indisponible qu'à compter de la ` +
            `notification (AUPSRVE, art. 187), et la paie de ${moisDePaie} ne peut pas la porter.`);
    }
    if (dateFin && premier > dateFin) {
        return (`La saisie a pris fin le ${jourIso(dateFin)} (mainlevée, AUPSRVE, art. 201) · la paie de ${moisDePaie} ne ` +
            "peut plus la porter.");
    }
    return null;
}
function motifRefusFinSaisie(a, dateFin) {
    if (a.type !== 'SAISIE_ARRET')
        return "Seule une saisie-arrêt prend fin par mainlevée · une avance se solde par ses retenues.";
    if (a.dateFin)
        return `Cette saisie a déjà pris fin le ${jourIso(a.dateFin)}.`;
    if (dateFin < a.dateOctroi)
        return "La mainlevée ne peut pas précéder la notification de l'acte de saisie.";
    return null;
}
function reserveQuotiteSaisies(saisiesFc, quotiteFc) {
    if (!(saisiesFc > 0))
        return null;
    if (quotiteFc === null) {
        return (`Retenue de saisie-arrêt de ${saisiesFc.toFixed(2)} FC · la quotité saisissable n'est pas chiffrée pour ce ` +
            "bulletin, et la retenue n'y est pas confrontée (AUPSRVE, art. 188, « sans excéder la portion saisissable »).");
    }
    if (c(saisiesFc) > c(quotiteFc)) {
        return (`La retenue de saisie-arrêt (${saisiesFc.toFixed(2)} FC) dépasse la quotité saisissable calculée ` +
            `(${quotiteFc.toFixed(2)} FC) · l'employeur ne verse au greffe que « sans excéder la portion saisissable » ` +
            "(AUPSRVE, art. 188). Confrontez-la à l'acte notifié.");
    }
    return null;
}
//# sourceMappingURL=avances-salaire.js.map