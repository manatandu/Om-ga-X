"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.filtresDesTroisColonnes = filtresDesTroisColonnes;
exports.filtresDesTroisColonnesDeLaPeriode = filtresDesTroisColonnesDeLaPeriode;
exports.agregatsParCompte = agregatsParCompte;
exports.lignesDeBalance = lignesDeBalance;
exports.totauxDeBalance = totauxDeBalance;
exports.avantSoldeDesComptesDeGestion = avantSoldeDesComptesDeGestion;
const client_1 = require("@prisma/client");
const ecritures_de_situation_1 = require("./ecritures-de-situation");
const periode_extrait_1 = require("./periode-extrait");
function baseHorsSituation(filtreEcriture) {
    return ('statut' in filtreEcriture ? filtreEcriture : { ...filtreEcriture, ...ecritures_de_situation_1.HORS_SITUATION });
}
function filtresDesTroisColonnes(filtreEcriture) {
    const base = baseHorsSituation(filtreEcriture);
    return {
        reports: { ...base, estGenereeParCloture: true, estSoldeDesComptesDeGestion: false },
        mouvements: { ...base, estGenereeParCloture: false },
        clotures: { ...base, estSoldeDesComptesDeGestion: true },
    };
}
function filtresDesTroisColonnesDeLaPeriode(filtreEcriture, periode) {
    const base = baseHorsSituation(filtreEcriture);
    const dejaEt = Array.isArray(base.AND) ? base.AND : base.AND ? [base.AND] : [];
    const et = (...conditions) => ({ ...base, AND: [...dejaEt, ...conditions] });
    const dans = (0, periode_extrait_1.ecrituresDansLaPeriode)(periode);
    return {
        reports: et((0, periode_extrait_1.ecrituresAvantLaPeriode)(periode)),
        mouvements: et(dans, { estSoldeDesComptesDeGestion: false }),
        clotures: et(dans, { estSoldeDesComptesDeGestion: true }),
    };
}
const zero = () => ({
    totalDebit: 0,
    totalCredit: 0,
    reportDebit: 0,
    reportCredit: 0,
    mouvementDebit: 0,
    mouvementCredit: 0,
    clotureDebit: 0,
    clotureCredit: 0,
});
function agregatsParCompte(reports, mouvements, clotures) {
    const parCompte = new Map();
    const accumuler = (groupes, champDebit, champCredit) => {
        for (const g of groupes) {
            const a = parCompte.get(g.compteId) ?? zero();
            const d = Number(g._sum.debit ?? 0);
            const c = Number(g._sum.credit ?? 0);
            a[champDebit] += d;
            a[champCredit] += c;
            a.totalDebit += d;
            a.totalCredit += c;
            parCompte.set(g.compteId, a);
        }
    };
    accumuler(reports, 'reportDebit', 'reportCredit');
    accumuler(mouvements, 'mouvementDebit', 'mouvementCredit');
    accumuler(clotures, 'clotureDebit', 'clotureCredit');
    return parCompte;
}
function lignesDeBalance(comptes, parCompte) {
    return comptes
        .filter((c) => c.typeCompte !== client_1.TypeCompteDetailTotal.TOTAL)
        .map((c) => {
        const agregats = parCompte.get(c.id) ?? zero();
        return {
            compteId: c.id,
            numero: c.numero,
            intitule: c.intitule,
            classe: c.classe,
            typeCompte: c.typeCompte,
            ...agregats,
            solde: agregats.totalDebit - agregats.totalCredit,
        };
    })
        .filter((l) => l.totalDebit !== 0 || l.totalCredit !== 0);
}
function totauxDeBalance(lignes) {
    return {
        debit: lignes.reduce((s, l) => s + l.totalDebit, 0),
        credit: lignes.reduce((s, l) => s + l.totalCredit, 0),
    };
}
function avantSoldeDesComptesDeGestion(lignes) {
    return lignes
        .map((l) => {
        const clotureDebit = l.clotureDebit ?? 0;
        const clotureCredit = l.clotureCredit ?? 0;
        return {
            ...l,
            totalDebit: l.totalDebit - clotureDebit,
            totalCredit: l.totalCredit - clotureCredit,
            clotureDebit: 0,
            clotureCredit: 0,
            solde: l.solde - clotureDebit + clotureCredit,
        };
    })
        .filter((l) => l.totalDebit !== 0 || l.totalCredit !== 0);
}
//# sourceMappingURL=balance-trois-colonnes.js.map