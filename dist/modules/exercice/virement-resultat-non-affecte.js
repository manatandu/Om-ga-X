"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.destinationsDuVirement = destinationsDuVirement;
exports.montantFr = montantFr;
exports.estCompteDuResultat = estCompteDuResultat;
exports.virementResultatNonAffecte = virementResultatNonAffecte;
exports.appliquerVirementAuReport = appliquerVirementAuReport;
exports.ecartInexpliqueDuBilan = ecartInexpliqueDuBilan;
const report_a_nouveau_1 = require("./report-a-nouveau");
function destinationsDuVirement(referentiel, entiteIndividuelle) {
    if (referentiel === 'SYSCOHADA' && entiteIndividuelle)
        return { credit: '10300000', debit: '10300000' };
    if (referentiel === 'SYSCOHADA')
        return { credit: '12100000', debit: '12910000' };
    return { credit: '12100000', debit: '12900000' };
}
const EPSILON = 0.005;
const FORMAT_MONTANT = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
function montantFr(n) {
    return FORMAT_MONTANT.format(Math.round(n * 100) / 100);
}
const arrondi2 = (x) => Math.round(x * 100) / 100;
function estCompteDuResultat(c) {
    return c.numero.startsWith('13') && c.modeReportANouveau !== 'AUCUN';
}
function virementResultatNonAffecte(comptes, destination, idDuNumero) {
    const lignes = [];
    let net = 0;
    for (const c of comptes.filter(estCompteDuResultat)) {
        const s = arrondi2((0, report_a_nouveau_1.soldeDuCompte)(c));
        if (Math.abs(s) <= EPSILON)
            continue;
        net += s;
        lignes.push({
            compteId: c.id,
            debit: s < 0 ? -s : 0,
            credit: s > 0 ? s : 0,
            libelle: `Résultat non affecté viré au report à nouveau · ${c.numero}`,
        });
    }
    net = arrondi2(net);
    if (lignes.length === 0)
        return { montant: 0, lignes: [], compteDestination: null };
    if (Math.abs(net) <= EPSILON)
        return { montant: 0, lignes, compteDestination: null };
    const numero = net > 0 ? destination.debit : destination.credit;
    const id = idDuNumero(numero);
    if (!id) {
        throw new Error(`Compte ${numero} introuvable dans ce dossier · le résultat de l'exercice précédent non affecté doit y être viré en fin d'exercice ` +
            "(AUDCIF Titre VII, compte 13 ; SYCEBNL Partie 2 ch. 3, compte 13). Ouvrez-le au plan comptable ou passez l'affectation avant de clôturer.");
    }
    lignes.push({
        compteId: id,
        debit: net > 0 ? net : 0,
        credit: net < 0 ? -net : 0,
        libelle: 'Résultat de l’exercice précédent non affecté, viré au report à nouveau',
    });
    return { montant: -net, lignes, compteDestination: numero };
}
function appliquerVirementAuReport(report, virement) {
    const resultat = report.map((l) => ({ ...l }));
    for (const v of virement) {
        const cible = resultat.find((l) => l.compteId === v.compteId && !l.deviseId);
        const delta = v.debit - v.credit;
        if (cible) {
            const s = arrondi2(cible.debit - cible.credit + delta);
            cible.debit = s > 0 ? s : 0;
            cible.credit = s < 0 ? -s : 0;
        }
        else {
            resultat.push({ compteId: v.compteId, debit: delta > 0 ? delta : 0, credit: delta < 0 ? -delta : 0, libelle: v.libelle });
        }
    }
    return resultat.filter((l) => l.debit > EPSILON || l.credit > EPSILON || l.deviseId);
}
function ecartInexpliqueDuBilan(bilan, resultat13) {
    const ecart = Number(bilan.totalActif) - Number(bilan.totalPassif);
    let partNonLue;
    if (bilan.controle) {
        partNonLue = resultat13 - bilan.controle.resultatCompte13 - (bilan.controle.compte13LuHorsDuResultat ?? 0);
    }
    else if (Math.abs(resultat13) <= EPSILON) {
        partNonLue = 0;
    }
    else {
        return null;
    }
    return arrondi2(ecart - partNonLue);
}
//# sourceMappingURL=virement-resultat-non-affecte.js.map