"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MOIS_PAR_PERIODE = void 0;
exports.motifLocationSimple = motifLocationSimple;
exports.tauxPeriodiqueEquivalent = tauxPeriodiqueEquivalent;
exports.valeurActualisee = valeurActualisee;
exports.tauxImplicitePeriodique = tauxImplicitePeriodique;
exports.motifRefusContrat = motifRefusContrat;
exports.construireEcheancier = construireEcheancier;
exports.motifRefusComplements = motifRefusComplements;
const client_1 = require("@prisma/client");
const ajouter_mois_1 = require("../../../common/ajouter-mois");
exports.MOIS_PAR_PERIODE = {
    MENSUELLE: 1,
    TRIMESTRIELLE: 3,
    SEMESTRIELLE: 6,
    ANNUELLE: 12,
};
function motifLocationSimple(c) {
    const simple = ' · location simple, les loyers vont en charges et le bien n\'entre pas au bilan (AUDCIF Titre VIII ch. 8 § 1.5.2 et § 2.2).';
    if (c.dureeMois <= 12)
        return `Contrat de ${c.dureeMois} mois, douze mois ou moins${simple}`;
    if (c.bienDeFaibleValeur)
        return `Bien de faible valeur à neuf${simple}`;
    if (c.nature !== client_1.NatureLocationAcquisition.LOCATION_VENTE && !c.optionRaisonnablementCertaine) {
        return `Levée de l'option non raisonnablement certaine (hypothétique)${simple}`;
    }
    return null;
}
function tauxPeriodiqueEquivalent(tauxAnnuel, moisParPeriode) {
    return Math.pow(1 + tauxAnnuel, moisParPeriode / 12) - 1;
}
function instants(c) {
    const n = c.dureeMois / exports.MOIS_PAR_PERIODE[c.periodicite];
    const evts = [];
    for (let k = 1; k <= n; k++)
        evts.push({ t: c.termeAEchoir ? k - 1 : k, montant: c.loyer, option: false, garantie: false });
    if (c.prixOption > 0)
        evts.push({ t: n, montant: c.prixOption, option: true, garantie: false });
    const garantie = c.garantieValeurResiduelle ?? 0;
    if (garantie > 0)
        evts.push({ t: n, montant: garantie, option: false, garantie: true });
    return evts;
}
function valeurActualisee(c, i) {
    return instants(c).reduce((s, e) => s + e.montant / Math.pow(1 + i, e.t), 0);
}
function tauxImplicitePeriodique(c, valeur) {
    if (!(valeur > 0) || valeurActualisee(c, 0) < valeur - 0.005)
        return null;
    let bas = 0;
    let haut = 1;
    while (valeurActualisee(c, haut) > valeur)
        haut *= 2;
    for (let k = 0; k < 200; k++) {
        const milieu = (bas + haut) / 2;
        if (valeurActualisee(c, milieu) > valeur)
            bas = milieu;
        else
            haut = milieu;
    }
    return (bas + haut) / 2;
}
const centimes = (x) => Math.round(x * 100) / 100;
function motifRefusContrat(c) {
    const p = exports.MOIS_PAR_PERIODE[c.periodicite];
    if (!Number.isInteger(c.dureeMois) || c.dureeMois <= 0)
        return 'Durée du contrat illisible.';
    if (c.dureeMois % p !== 0)
        return `La durée (${c.dureeMois} mois) n'est pas un nombre entier de périodes de ${p} mois.`;
    if (!(c.loyer > 0))
        return 'Le loyer doit être positif.';
    if (c.prixOption < 0)
        return "Le prix de levée de l'option ne peut pas être négatif.";
    const parTaux = c.tauxAnnuel != null;
    const parValeur = c.valeurContrat != null;
    if (parTaux === parValeur)
        return 'Indiquez soit le taux implicite annuel, soit la valeur du bien figurant au contrat, l’un des deux.';
    if (parTaux && !(c.tauxAnnuel >= 0))
        return 'Le taux implicite ne peut pas être négatif.';
    const refusComplements = motifRefusComplements(c);
    if (refusComplements)
        return refusComplements;
    return motifLocationSimple(c);
}
function construireEcheancier(c) {
    const motif = motifRefusContrat(c);
    if (motif)
        throw new Error(motif);
    const p = exports.MOIS_PAR_PERIODE[c.periodicite];
    let i;
    let dette;
    if (c.valeurContrat != null) {
        const t = tauxImplicitePeriodique(c, c.valeurContrat);
        if (t == null) {
            throw new Error('La valeur du contrat dépasse la somme des loyers et du prix d’option · aucun taux implicite positif ne les égalise (§ 2.1.3).');
        }
        i = t;
        dette = centimes(c.valeurContrat);
    }
    else {
        i = tauxPeriodiqueEquivalent(c.tauxAnnuel, p);
        dette = centimes(valeurActualisee(c, i));
    }
    const evts = instants(c);
    const lignes = [];
    let restant = dette;
    let tPrecedent = 0;
    evts.forEach((e, k) => {
        const dernier = k === evts.length - 1;
        let interets = centimes(restant * (Math.pow(1 + i, e.t - tPrecedent) - 1));
        let capital = centimes(e.montant - interets);
        if (dernier) {
            capital = restant;
            interets = centimes(e.montant - capital);
        }
        restant = centimes(restant - capital);
        lignes.push({
            rang: k + 1,
            date: (0, ajouter_mois_1.ajouterMois)(c.datePriseEffet, e.t * p),
            paiement: e.montant,
            interets,
            capital,
            restant,
            option: e.option,
            garantie: e.garantie,
        });
        tPrecedent = e.t;
    });
    return { dette, tauxPeriodique: i, lignes };
}
function motifRefusComplements(c) {
    if ((c.garantieValeurResiduelle ?? 0) < 0)
        return 'Le montant attendu au titre de la garantie de valeur résiduelle ne peut pas être négatif.';
    if (c.loyerIndexe) {
        if (!c.indiceLoyer?.trim()) {
            return "Nommez l'indice ou le taux dont dépend le loyer · il est retenu « en vigueur au commencement du contrat » (AUDCIF Titre VIII ch. 8 § 2.1.2).";
        }
        if (!(c.valeurIndiceCommencement != null && c.valeurIndiceCommencement > 0)) {
            return "Indiquez la valeur de l'indice à la prise d'effet · le loyer saisi est celui qu'elle donne (AUDCIF Titre VIII ch. 8 § 2.1.2).";
        }
    }
    else if (c.indiceLoyer?.trim() || c.valeurIndiceCommencement != null) {
        return "Un indice ne se déclare que pour un loyer indexé.";
    }
    return null;
}
//# sourceMappingURL=echeancier-location-acquisition.js.map