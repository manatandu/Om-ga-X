"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.lignesManquantes = lignesManquantes;
exports.decrireLigne = decrireLigne;
const centimes = (n) => Math.round(n * 100);
function lignesManquantes(attendues, lignes) {
    const libres = [...lignes];
    const manquantes = [];
    for (const a of attendues) {
        const i = libres.findIndex((l) => l.numero.startsWith(a.compte) &&
            centimes(a.sens === 'DEBIT' ? l.debit : l.credit) === centimes(a.montant) &&
            centimes(a.sens === 'DEBIT' ? l.credit : l.debit) === 0);
        if (i === -1)
            manquantes.push(a);
        else
            libres.splice(i, 1);
    }
    return manquantes;
}
function decrireLigne(l) {
    const montant = l.montant.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return `${l.compte} au ${l.sens === 'DEBIT' ? 'débit' : 'crédit'} pour ${montant}`;
}
//# sourceMappingURL=rattachement-ecriture.js.map