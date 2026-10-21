"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MOTIF_416_PAR_LE_MODULE = void 0;
exports.estEcheanceAReglerSur = estEcheanceAReglerSur;
exports.motifHorsEcheance = motifHorsEcheance;
exports.motifReglementAuDelaDuNet = motifReglementAuDelaDuNet;
exports.avertissementCreanceReclassee = avertissementCreanceReclassee;
exports.montantDu = montantDu;
exports.lignesDuReglement = lignesDuReglement;
exports.motifRefusMontant = motifRefusMontant;
exports.motifRefusImputationReglement = motifRefusImputationReglement;
exports.imputationImprimee = imputationImprimee;
exports.libellesDesParts = libellesDesParts;
exports.lignesDuReglementImpute = lignesDuReglementImpute;
const DIVISIONS_EXCLUES = ['408', '409', '418', '419', '416'];
exports.MOTIF_416_PAR_LE_MODULE = 'se règle par « Recouvrement » dans « Créances douteuses ou litigieuses » · le module compte l’encaissement dans le reste de la créance.';
function estEcheanceAReglerSur(numeroCompte, sens) {
    const racine = sens === 'FOURNISSEUR' ? '40' : '41';
    if (!numeroCompte.startsWith(racine))
        return false;
    return !DIVISIONS_EXCLUES.some((d) => numeroCompte.startsWith(d));
}
function motifHorsEcheance(numeroCompte) {
    return numeroCompte.startsWith('416')
        ? `Le compte ${numeroCompte} (créance litigieuse ou douteuse) ${exports.MOTIF_416_PAR_LE_MODULE}`
        : `Le compte ${numeroCompte} ne porte pas d'échéance à régler dans ce sens.`;
}
function motifReglementAuDelaDuNet(numeroCompte, compte416, dateReclassement, net, montant) {
    const c = (x) => Math.round(x * 100) / 100;
    if (c(montant) <= c(net) + 0.005)
        return null;
    const plafond = Math.max(0, c(net)).toFixed(2);
    return (`Le compte ${numeroCompte} porte une créance reclassée au ${compte416} le ${dateReclassement} · son solde net n'est que de ` +
        `${plafond} (la créance reclassée est au ${compte416}), et un règlement de ${c(montant).toFixed(2)} le rendrait créditeur. ` +
        `Réglez ici au plus ${plafond}. Un encaissement de la créance reclassée se passe par « Recouvrement » dans « Créances ` +
        'douteuses ou litigieuses » ; un autre encaissement (avance, trop-perçu) se passe en pièce au journal.');
}
function avertissementCreanceReclassee(numeroCompte, compte416, dateReclassement) {
    return (`Le compte ${numeroCompte} porte une créance reclassée au ${compte416} le ${dateReclassement} (« Créances douteuses ou ` +
        'litigieuses »). Si ce règlement encaisse cette créance, passez-le par « Recouvrement » dans ce module · réglée ici, la ' +
        `facture reclassée se solde au ${numeroCompte} pendant que le ${compte416} garde la créance, et une autre facture du client ` +
        'paraît impayée. Au brouillard, la pièce se supprime ; validée, elle s’annule par inscription en négatif.');
}
function montantDu(ligne, sens) {
    const brut = sens === 'FOURNISSEUR' ? ligne.credit - ligne.debit : ligne.debit - ligne.credit;
    return Math.round(brut * 100) / 100;
}
function lignesDuReglement(params) {
    const { sens, compteTiersId, compteTresorerieId, montant, libelle } = params;
    return sens === 'FOURNISSEUR'
        ? [
            { compteId: compteTiersId, debit: montant, libelle },
            { compteId: compteTresorerieId, credit: montant, libelle },
        ]
        : [
            { compteId: compteTresorerieId, debit: montant, libelle },
            { compteId: compteTiersId, credit: montant, libelle },
        ];
}
function motifRefusMontant(montant, du) {
    if (!(montant > 0))
        return 'Le montant réglé doit être positif.';
    if (Math.round(montant * 100) > Math.round(du * 100)) {
        return (`Le montant réglé (${montant.toFixed(2)}) dépasse le dû des factures choisies (${du.toFixed(2)}) · ` +
            "l'excédent est une avance ou un trop-perçu, à comptabiliser à part.");
    }
    return null;
}
function motifRefusImputationReglement(e) {
    const c = (x) => Math.round(x * 100) / 100;
    if (e.sens === 'CLIENT') {
        return ('Côté client, l’imputation est celle que le client déclare en payant (Code civil, Livre III, art. 151) ou celle de la ' +
            'quittance qu’il a acceptée (art. 153), jamais celle du cabinet qui encaisse · déclarez-la, sa pièce à l’appui, une fois ' +
            'le règlement validé (imputation déclarée d’un paiement).');
    }
    if (e.enDevise) {
        return 'Un règlement en devise porte une seule ligne au tiers avec son écart réalisé · réglez ces factures une à une pour désigner la part de chacune.';
    }
    if (e.reduite) {
        return 'Une ligne d’à-nouveau réglée en partie par un lettrage à cheval se règle seule · retirez-la de ce règlement pour désigner les parts des autres.';
    }
    const vues = new Set();
    let total = 0;
    for (const p of e.parts) {
        if (vues.has(p.ligneId))
            return 'Une même facture reçoit deux parts.';
        vues.add(p.ligneId);
        const du = e.dus.get(p.ligneId);
        if (du === undefined)
            return 'Une part désigne une facture qui n’est pas choisie dans ce règlement.';
        if (!(p.montant > 0))
            return 'Une part réglée est un montant strictement positif · retirez la facture si elle n’est pas payée.';
        if (c(p.montant) > c(du))
            return `Une part (${c(p.montant).toFixed(2)}) dépasse le dû de sa facture (${c(du).toFixed(2)}).`;
        total = c(total + p.montant);
    }
    for (const id of e.dus.keys()) {
        if (!vues.has(id))
            return 'Une facture choisie ne reçoit aucune part · donnez sa part, ou retirez-la du règlement.';
    }
    if (Math.round(total * 100) !== Math.round(e.montant * 100)) {
        return `La somme des parts (${total.toFixed(2)}) diffère du montant réglé (${c(e.montant).toFixed(2)}).`;
    }
    if (!e.ordreVirement && (e.pieceImputation ?? '').trim().length < 3) {
        return ('L’imputation que le dossier déclare se fait au fournisseur lorsqu’il paye (Code civil, Livre III, art. 151) · ' +
            'préparez l’ordre de virement, qui imprime chaque facture et sa part, ou donnez la référence de la pièce qui la ' +
            'lui a notifiée (lettre, courriel, bordereau).');
    }
    return null;
}
function imputationImprimee(parts) {
    const fmt = (x) => (Math.round(x * 100) / 100).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return `Factures payées · ${parts.map((p) => `${p.reference} : ${fmt(p.montant)}`).join(' ; ')}`;
}
function libellesDesParts(base, factures) {
    const rendus = new Map();
    const pris = new Set();
    for (const f of factures) {
        const tete = `${base.slice(0, 140)} · ${f.reference.slice(0, 36)}`;
        let libelle = tete;
        for (let n = 2; pris.has(libelle); n++)
            libelle = `${tete} (${n})`;
        pris.add(libelle);
        rendus.set(f.id, libelle);
    }
    return rendus;
}
function lignesDuReglementImpute(params) {
    const total = Math.round(params.parts.reduce((t, p) => t + p.montant, 0) * 100) / 100;
    return [
        ...params.parts.map((p) => ({ compteId: params.compteTiersId, debit: Math.round(p.montant * 100) / 100, libelle: p.libelle })),
        { compteId: params.compteTresorerieId, credit: total, libelle: params.libelle },
    ];
}
//# sourceMappingURL=reglement-tiers.js.map