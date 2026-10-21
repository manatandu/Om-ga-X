"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.seReevalueALaCloture = seReevalueALaCloture;
exports.motifHorsReevaluation = motifHorsReevaluation;
exports.motifPositionDenouee = motifPositionDenouee;
exports.groupesDenoues = groupesDenoues;
exports.lectureDesGroupes = lectureDesGroupes;
exports.positionDesLignes = positionDesLignes;
exports.motifDateReevaluation = motifDateReevaluation;
const client_1 = require("@prisma/client");
const ecart_change_realise_1 = require("../reglements/ecart-change-realise");
const DETTES_CLASSE_1 = {
    [client_1.Referentiel.SYSCOHADA]: /^(16|17|18)/,
    [client_1.Referentiel.SYCEBNL]: /^18/,
};
const CREANCES_DETTES_TRESORERIE = /^(27|4|5)/;
const TITRES_HORS_CLASSE_26 = /^(274|50(?!6))/;
const INSTRUMENTS_DE_TRESORERIE = /^54/;
function seReevalueALaCloture(numero, referentiel) {
    if (TITRES_HORS_CLASSE_26.test(numero))
        return false;
    if (INSTRUMENTS_DE_TRESORERIE.test(numero))
        return false;
    return CREANCES_DETTES_TRESORERIE.test(numero) || DETTES_CLASSE_1[referentiel].test(numero);
}
function motifHorsReevaluation(numero, referentiel) {
    if (seReevalueALaCloture(numero, referentiel))
        return null;
    if (/^25/.test(numero))
        return "avance sur immobilisation · aucun écart de conversion (AUDCIF Titre VIII ch. 22 § 1.2)";
    if (/^508/.test(numero))
        return ("autres titres de placement et créances assimilées · lu en TITRE, part « créances assimilées » comprise, maintenu au " +
            "cours du jour de l'acquisition (AUDCIF Titre VIII ch. 22 § 1.3) · lecture d'OmegaX ; une créance de revenu se porte au 506");
    if (INSTRUMENTS_DE_TRESORERIE.test(numero))
        return ('instrument de trésorerie · évalué au prix du marché ou au coût historique, nominal hors bilan, jamais converti au ' +
            'cours de clôture (AUDCIF art. 54 ; Titre VII, compte 54 ; Titre VIII ch. 22 § 3.1 et § 3.2.2) · sa variation de ' +
            'valeur et une couverture se passent à la main (art. 58-1 à 58-4)');
    if (/^26/.test(numero) || TITRES_HORS_CLASSE_26.test(numero))
        return "titres · maintenus au cours du jour de l'acquisition (AUDCIF Titre VIII ch. 22 § 1.3)";
    if (/^2/.test(numero))
        return "immobilisation · maintenue au cours du jour de l'acquisition, écart dégagé à la sortie seulement (AUDCIF Titre VIII ch. 22 § 1.1)";
    if (/^3/.test(numero))
        return 'stock · évalué selon le § 1.4 (AUDCIF Titre VIII ch. 22), pas par écart de conversion';
    if (/^1/.test(numero))
        return 'fonds propres · ni créance ni dette (AUDCIF Titre VIII ch. 22 § 2.2)';
    return "compte de gestion · flux converti au cours du jour de l'opération";
}
function motifPositionDenouee(montantDevise, valeurComptable) {
    if (Math.abs(montantDevise) >= 0.005 || Math.abs(valeurComptable) < 0.005)
        return null;
    const reste = Math.round(Math.abs(valeurComptable) * 100) / 100;
    return (`position dénouée · soldée dans sa devise, il reste ${reste.toFixed(2)} en francs, écart de change RÉALISÉ au ` +
        'règlement (AUDCIF art. 55), jamais un écart de conversion · passez-le depuis le lettrage (« Écart de change »)');
}
function groupesDenoues(lignes) {
    const parGroupe = new Map();
    for (const l of lignes)
        parGroupe.set(l.lettrageId, [...(parGroupe.get(l.lettrageId) ?? []), l]);
    const denoues = new Map();
    for (const [id, ls] of parGroupe) {
        const change = (0, ecart_change_realise_1.ecartDuGroupe)(ls);
        if (change !== null)
            denoues.set(id, { code: ls[0].code, ecart: change.ecart });
    }
    return denoues;
}
function lectureDesGroupes(lignes, p) {
    const dans = (l) => l.ecriture.exerciceId === p.exerciceId && l.ecriture.date.getTime() <= p.date.getTime();
    const aCheval = new Set(lignes.filter((l) => !dans(l)).map((l) => l.lettrageId));
    const posterieurs = new Set(lignes.filter((l) => l.ecriture.date.getTime() > p.date.getTime()).map((l) => l.lettrageId));
    const denouesACheval = new Map();
    for (const [id, d] of groupesDenoues(lignes.filter((l) => aCheval.has(l.lettrageId) && !posterieurs.has(l.lettrageId)))) {
        if (Math.abs(d.ecart) >= 0.005)
            denouesACheval.set(id, d);
    }
    const devises = new Map();
    for (const l of lignes) {
        if (!aCheval.has(l.lettrageId) || !l.deviseId || !l.devise)
            continue;
        const parId = devises.get(l.lettrageId) ?? new Map();
        parId.set(l.devise.id, l.devise);
        devises.set(l.lettrageId, parId);
    }
    const deviseDuGroupe = new Map();
    for (const [id, parId] of devises)
        if (parId.size === 1)
            deviseDuGroupe.set(id, [...parId.values()][0]);
    const lignesEnFrancs = lignes.filter((l) => aCheval.has(l.lettrageId) && l.deviseId === null && dans(l));
    return { aCheval, lignesEnFrancs, deviseDuGroupe, denouesACheval };
}
function positionDesLignes(lignes) {
    let montantDevise = 0;
    let valeurComptable = 0;
    for (const l of lignes) {
        const sens = l.debit - l.credit >= 0 ? 1 : -1;
        montantDevise += sens * (l.montantDevise ?? 0);
        valeurComptable += l.debit - l.credit;
    }
    return { montantDevise, valeurComptable };
}
function motifDateReevaluation(date, dateFin) {
    const jour = date.slice(0, 10);
    const fin = dateFin.toISOString().slice(0, 10);
    if (jour === fin)
        return null;
    return (`La réévaluation des devises se fait à la date de CLÔTURE, le ${fin} · le ${jour} n'en est pas une. ` +
        "AUDCIF art. 54 · les créances et dettes « qui subsistent au bilan à la date de clôture » sont corrigées « sur la base du " +
        "dernier cours de change à cette date » (Titre VIII ch. 22 § 2.2).");
}
//# sourceMappingURL=perimetre-reevaluation.js.map