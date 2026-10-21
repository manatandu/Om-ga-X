"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.COMPTE_RESERVE_SYCEBNL = exports.RACINES_RESERVE_NON_DISTRIBUABLE = void 0;
exports.supplementDeLaDotation = supplementDeLaDotation;
exports.sortDesEcarts = sortDesEcarts;
exports.motifRefusCompteReserve = motifRefusCompteReserve;
exports.lignesSortDeLEcart = lignesSortDeLEcart;
exports.posteDuBien = posteDuBien;
exports.vueDeLExercice = vueDeLExercice;
const EPSILON = 0.005;
const centimes = (x) => Math.round(x * 100) / 100;
function supplementDeLaDotation(dotation, coefficientsAnterieurs) {
    const produit = coefficientsAnterieurs.reduce((p, k) => p * k, 1);
    if (!(produit > 1 + 1e-9) || !(Math.abs(dotation) > EPSILON))
        return 0;
    return centimes(dotation * (1 - 1 / produit));
}
function sortDesEcarts(o) {
    const sorts = [];
    for (const l of o.lignes) {
        if (!l.compteEcart)
            continue;
        if (l.compteEcart.startsWith('154')) {
            const reste = centimes(l.ecart - l.provisionReprise);
            if (reste <= EPSILON)
                continue;
            sorts.push({ ligneId: l.id, compteEcart: l.compteEcart, montant: reste, traitement: 'REPRISE_861' });
        }
        else if (l.compteEcart.startsWith('106')) {
            const solde = centimes(l.ecart - l.ecartImpute - l.ecartTransfere);
            if (solde <= EPSILON)
                continue;
            sorts.push({ ligneId: l.id, compteEcart: l.compteEcart, montant: solde, traitement: 'RESERVE' });
        }
    }
    return sorts;
}
exports.RACINES_RESERVE_NON_DISTRIBUABLE = ['111', '112', '1138'];
exports.COMPTE_RESERVE_SYCEBNL = '11800000';
function motifRefusCompteReserve(numero, referentiel = 'SYSCOHADA') {
    if (referentiel === 'SYCEBNL') {
        if (!numero || numero === exports.COMPTE_RESERVE_SYCEBNL)
            return null;
        return (`Le compte ${numero} ne peut pas recevoir l’écart · au SYCEBNL, le solde de l’écart de réévaluation d’un bien ` +
            `sorti va au ${exports.COMPTE_RESERVE_SYCEBNL} Autres réserves, imposé (décision du cabinet éditeur du 2026-10-04, dans ` +
            'le silence du texte SYCEBNL, par analogie avec l’AUDCIF Titre VIII ch. 28 § 6) · ne choisissez aucune réserve.');
    }
    if (!numero) {
        return ('Choisissez la réserve non distribuable qui reçoit le solde de l’écart de réévaluation (AUDCIF Titre VIII ' +
            'ch. 28 § 6) · un compte sous 111, 112 ou 1138, réserves indisponibles de la fiche du compte 11.');
    }
    if (/^113[1-4]/.test(numero)) {
        return (`Le compte ${numero} a son propre objet (fiche du compte 11 · 1131 plus-values nettes à long terme, 1132 ` +
            'attribution gratuite d’actions, 1133 subventions d’investissement, 1134 valeurs mobilières donnant accès au ' +
            'capital) · parmi les réserves réglementées, l’écart de réévaluation va au 1138 « Autres réserves réglementées » ' +
            '(AUDCIF Titre VIII ch. 28 § 6).');
    }
    if (!exports.RACINES_RESERVE_NON_DISTRIBUABLE.some((r) => numero.startsWith(r))) {
        return (`Le compte ${numero} n’est pas une réserve non distribuable · le solde de l’écart de réévaluation va à une ` +
            'réserve indisponible (111 Réserve légale, 112 Réserves statutaires ou contractuelles, 1138 Autres réserves ' +
            'réglementées · fiche du compte 11), jamais au 118, qui porte les réserves libres (AUDCIF Titre VIII ch. 28 § 6).');
    }
    return null;
}
function lignesSortDeLEcart(sorts) {
    const parCompte = new Map();
    let reprise = 0;
    for (const s of sorts) {
        if (s.traitement === 'RESERVE')
            parCompte.set(s.compteEcart, centimes((parCompte.get(s.compteEcart) ?? 0) + s.montant));
        else
            reprise = centimes(reprise + s.montant);
    }
    return {
        reserve: [...parCompte.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([compteEcart, montant]) => ({ compteEcart, montant })),
        reprise,
    };
}
function posteDuBien(numero, rubriques, correspond) {
    for (const r of rubriques) {
        if (r.comptes?.length && correspond(numero, r.comptes, r.exclusions ?? []))
            return r.libelle;
    }
    return `Compte ${numero} (aucune rubrique de la note ne le lit)`;
}
function vueDeLExercice(portees, exercice) {
    let produitAnterieur = 1;
    let produitPosterieur = 1;
    let ajustementCumulExercice = 0;
    let cumulPosterieur = 0;
    let brutPosterieur = 0;
    for (const r of portees) {
        const deltaCumul = r.amortissementsApres - r.amortissementsAvant;
        if (r.dateReevaluation < exercice.dateDebut) {
            produitAnterieur *= r.coefficientRetenu;
        }
        else if (r.dateReevaluation <= exercice.dateFin) {
            ajustementCumulExercice += deltaCumul;
        }
        else {
            cumulPosterieur += deltaCumul;
            brutPosterieur += r.brutApres - r.brutAvant;
            produitPosterieur *= r.coefficientRetenu;
        }
    }
    return {
        produitAnterieur,
        produitPosterieur,
        ajustementCumulExercice: centimes(ajustementCumulExercice),
        cumulPosterieur: centimes(cumulPosterieur),
        brutPosterieur: centimes(brutPosterieur),
    };
}
//# sourceMappingURL=reevaluation-suites.js.map