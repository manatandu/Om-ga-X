"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.motifRefusAjustementTransition = motifRefusAjustementTransition;
exports.lignesOuverture = lignesOuverture;
exports.effetsRetraitement = effetsRetraitement;
exports.construirePremiereApplication = construirePremiereApplication;
const etats_ifrs_1 = require("./etats-ifrs");
const rubriques_ifrs_1 = require("./rubriques-ifrs");
const r2 = (x) => Math.round(x * 100) / 100 || 0;
const EPS = 0.005;
function motifRefusAjustementTransition(r) {
    for (const l of r.lignes) {
        const rb = rubriques_ifrs_1.RUBRIQUE_PAR_CODE.get(l.rubrique);
        if (rb && rb.etat !== 'SITUATION') {
            return `Ajustement de transition « ${r.libelle} » · la rubrique « ${rb.libelle} » n’est pas un poste de la situation financière. À la date de transition, l’ajustement va directement aux capitaux propres (IFRS 1 § 11), jamais au résultat ni aux autres éléments du résultat global.`;
        }
    }
    return null;
}
function lignesOuverture(lignes) {
    return lignes
        .filter((l) => /^[1-5]/.test(l.numero))
        .map((l) => ({ numero: l.numero, intitule: l.intitule, solde: r2(l.reportDebit - l.reportCredit) }))
        .filter((l) => Math.abs(l.solde) > EPS);
}
function effetsRetraitement(r) {
    let capitauxPropres = 0;
    let resultat = 0;
    let oci = 0;
    for (const l of r.lignes) {
        const rb = rubriques_ifrs_1.RUBRIQUE_PAR_CODE.get(l.rubrique);
        if (!rb)
            continue;
        if (rb.etat === 'SITUATION' && rb.section !== 'CAPITAUX_PROPRES')
            capitauxPropres += l.montant;
        if (rb.etat === 'RESULTAT')
            resultat -= l.montant;
        if (rb.etat === 'RESULTAT_GLOBAL')
            oci -= l.montant;
    }
    return { capitauxPropres: r2(capitauxPropres), resultat: r2(resultat), oci: r2(oci) };
}
const cpIfrs = (e, colonne) => e.situation.find((l) => l.cle === 'TOTAL_CAPITAUX_PROPRES')?.[colonne] ?? 0;
function rapprochement(titre, ref, depart, reclassement, ajustements, arrivee) {
    const lignes = [{ cle: 'DEPART', libelle: depart.libelle, montant: r2(depart.montant) }];
    if (reclassement != null && Math.abs(reclassement) > EPS) {
        lignes.push({ cle: 'RECLASSEMENTS', libelle: 'Reclassements de présentation (règles de correspondance)', fondement: 'IFRS 1 § 10 c', montant: r2(reclassement) });
    }
    for (const nature of ['METHODE', 'ERREUR']) {
        for (const a of ajustements.filter((x) => (x.r.correctionErreur ? 'ERREUR' : 'METHODE') === nature && Math.abs(x.montant) > EPS)) {
            lignes.push({ cle: `R_${a.r.id}`, libelle: a.r.libelle, fondement: a.r.fondement, nature, montant: a.montant });
        }
    }
    const explique = r2(lignes.reduce((s, l) => s + l.montant, 0));
    const ecart = r2(arrivee.montant - explique);
    if (Math.abs(ecart) > EPS)
        lignes.push({ cle: 'ECART', libelle: 'Écart non expliqué', montant: ecart });
    lignes.push({ cle: 'ARRIVEE', libelle: arrivee.libelle, montant: r2(arrivee.montant) });
    return { titre, ref, lignes, depart: r2(depart.montant), arrivee: r2(arrivee.montant), ecart };
}
function construirePremiereApplication(p) {
    for (const r of p.ajustementsTransition) {
        const m = motifRefusAjustementTransition(r);
        if (m)
            throw new etats_ifrs_1.RefusIfrs(m);
    }
    const transition = rapprochement('Capitaux propres à la date de transition', 'IFRS 1 § 24 a i', { libelle: 'Capitaux propres selon le SYSCOHADA (bilan, total CP)', montant: p.capitauxPropresSyscohadaTransition }, cpIfrs(p.ouverture, 'legal') - p.capitauxPropresSyscohadaTransition, p.ajustementsTransition.map((r) => ({ r, montant: effetsRetraitement(r).capitauxPropres })), { libelle: 'Capitaux propres selon les IFRS', montant: cpIfrs(p.ouverture, 'ifrs') });
    const cloture = rapprochement('Capitaux propres à la clôture du dernier exercice selon le référentiel antérieur', 'IFRS 1 § 24 a ii', { libelle: 'Capitaux propres selon le SYSCOHADA (bilan, total CP)', montant: p.capitauxPropresSyscohadaComparatif }, cpIfrs(p.comparatif, 'legal') - p.capitauxPropresSyscohadaComparatif, p.retraitementsComparatif.map((r) => ({ r, montant: effetsRetraitement(r).capitauxPropres })), { libelle: 'Capitaux propres selon les IFRS', montant: cpIfrs(p.comparatif, 'ifrs') });
    const global = rapprochement('Résultat global du dernier exercice selon le référentiel antérieur', 'IFRS 1 § 24 b', { libelle: 'Résultat net selon le SYSCOHADA', montant: p.comparatif.rapprochements.resultatSyscohada }, null, p.retraitementsComparatif.map((r) => {
        const e = effetsRetraitement(r);
        return { r, montant: r2(e.resultat + e.oci) };
    }), { libelle: 'Résultat global total selon les IFRS', montant: p.comparatif.resultatGlobal.find((l) => l.cle === 'RESULTAT_GLOBAL')?.ifrs ?? 0 });
    const rapprochements = [transition, cloture, global];
    const mentions = [
        'IFRS 1 § 23 · l’incidence de la transition sur la situation financière, la performance et les flux de trésorerie s’explique dans les notes ; les rapprochements ci-dessous en sont la partie chiffrée (§ 24).',
        'IFRS 1 § 21 · les premiers états financiers IFRS comprennent au moins trois états de la situation financière · celui de clôture, le comparatif, et celui d’ouverture à la date de transition.',
        'Un ajustement de transition vaut à la date de transition · ce qu’il laisse au bilan à la clôture de l’exercice comparatif s’y redéclare en retraitement de cet exercice, le module ne reportant aucun retraitement d’un exercice à l’autre.',
        'Les exemptions des annexes C à E se traduisent dans les ajustements de transition déclarés · leur choix n’est pas enregistré à part, et une exemption ne s’applique pas par analogie à d’autres éléments (§ D1).',
    ];
    mentions.push('IFRS 1 § 25 · les ajustements significatifs du tableau des flux de trésorerie se lisent au rapprochement du tableau SYSCOHADA au tableau IFRS, activité par activité.');
    if (p.ajustementsTransition.some((r) => /IAS 36/.test(r.fondement))) {
        mentions.push('IFRS 1 § 24 c · une perte de valeur comptabilisée ou reprise à l’ouverture appelle les informations qu’aurait imposées IAS 36 sur la période commençant à la date de transition.');
    }
    const motifsNonPubliable = [];
    for (const r of rapprochements.filter((x) => Math.abs(x.ecart) > EPS)) {
        motifsNonPubliable.push(`Première application · ${r.titre.toLowerCase()} (${r.ref}) · écart non expliqué de ${r.ecart}.`);
    }
    for (const c of p.ouverture.controles.filter((x) => !x.ok)) {
        motifsNonPubliable.push(`Première application · état d’ouverture · ${c.libelle} (écart ${c.ecart}).`);
    }
    if (p.ouverture.nonClasses.length > 0) {
        motifsNonPubliable.push(`Première application · ${p.ouverture.nonClasses.length} compte(s) d’ouverture sans rubrique IFRS · ${p.ouverture.nonClasses.map((c) => c.numero).join(', ')}.`);
    }
    return { dateTransition: p.dateTransition.toISOString().slice(0, 10), ouverture: p.ouverture, rapprochements, mentions, motifsNonPubliable };
}
//# sourceMappingURL=premiere-application-ifrs.js.map