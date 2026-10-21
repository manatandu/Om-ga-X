"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.estCompteDepreciationEnCours = estCompteDepreciationEnCours;
exports.cumulsParCompte29 = cumulsParCompte29;
exports.motifRefusCompte29DuBien = motifRefusCompte29DuBien;
const EPSILON = 0.005;
const centimes = (x) => Math.round(x * 100) / 100;
function estCompteDepreciationEnCours(numero) {
    return /^29[1-4]9/.test(numero);
}
function cumulsParCompte29(depreciations) {
    const cumuls = new Map();
    for (const d of depreciations) {
        const signe = d.sens === 'DOTATION' ? 1 : -1;
        cumuls.set(d.compteDepreciationId, centimes((cumuls.get(d.compteDepreciationId) ?? 0) + signe * d.montant));
    }
    for (const [id, cumul] of cumuls)
        if (Math.abs(cumul) <= EPSILON)
            cumuls.delete(id);
    return cumuls;
}
function motifRefusCompte29DuBien(o) {
    const porteurs = [...o.cumuls.entries()];
    if (porteurs.length > 0) {
        if (porteurs.some(([id]) => id === o.compteChoisi.id) && porteurs.length === 1)
            return null;
        const liste = porteurs.map(([id, c]) => `${o.numeros.get(id) ?? id} (${c.toFixed(2)})`).join(', ');
        if (porteurs.length > 1) {
            if (porteurs.some(([id]) => id === o.compteChoisi.id))
                return null;
            return (`La dépréciation de ce bien est inscrite sur plusieurs comptes (${liste}) · un mouvement nouveau ne s'inscrit ` +
                "que sur l'un d'eux (fiche du compte 29, dotation au crédit, reprise au débit du même compte).");
        }
        const enCours = estCompteDepreciationEnCours(o.numeros.get(porteurs[0][0]) ?? '');
        return (`La dépréciation de ce bien est inscrite au ${liste} · ses dotations et reprises suivantes s'y inscrivent tant ` +
            "qu'elle n'est pas reprise en entier, sans quoi ce compte resterait créditeur et l'autre deviendrait débiteur " +
            '(fiche du compte 29).' +
            (enCours
                ? " Elle a été constatée quand le bien était en cours et n'a pas été transférée au 29 du bien achevé · transférez-la depuis la fiche du bien (reprise au 29x9, dotation au 29 du bien achevé, même montant), puis passez ce mouvement."
                : ''));
    }
    if (!o.syscohada)
        return null;
    const choisiEnCours = estCompteDepreciationEnCours(o.compteChoisi.numero);
    if (o.inscritEnCours && !choisiEnCours) {
        return (`Ce bien est encore inscrit en cours à la clôture · sa dépréciation s'inscrit au 29x9 de sa division (2919, 2929, ` +
            `2939 ou 2949), pas au ${o.compteChoisi.numero} · « les comptes 28 et 29 ont été développés selon la structure des ` +
            'comptes de la classe 2 » (AUDCIF, Titre VII ch. 2).');
    }
    if (!o.inscritEnCours && choisiEnCours) {
        return (`Le compte ${o.compteChoisi.numero} déprécie une immobilisation EN COURS · ce bien est inscrit à son compte ` +
            'définitif à la clôture, sa dépréciation va au 29 de ce compte (AUDCIF, Titre VII ch. 2 et fiche du compte 29).');
    }
    return null;
}
//# sourceMappingURL=depreciation-en-cours.js.map