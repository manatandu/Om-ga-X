"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.arrondi = exports.CLASSES_GESTION = exports.CLASSES_BILAN = void 0;
exports.divisionsDeLaClasse9 = divisionsDeLaClasse9;
exports.ecrireLigneDeCompte = ecrireLigneDeCompte;
exports.ecrireTotal = ecrireTotal;
exports.totauxBalance = totauxBalance;
exports.sommeBalance = sommeBalance;
exports.ecartBalance = ecartBalance;
exports.estNulBalance = estNulBalance;
exports.plageBalance = plageBalance;
exports.ecrireCorpsBalance = ecrireCorpsBalance;
const client_1 = require("@prisma/client");
const presentation_fpm_1 = require("./presentation-fpm");
exports.CLASSES_BILAN = new Set([
    client_1.ClasseCompte.CLASSE_1,
    client_1.ClasseCompte.CLASSE_2,
    client_1.ClasseCompte.CLASSE_3,
    client_1.ClasseCompte.CLASSE_4,
    client_1.ClasseCompte.CLASSE_5,
]);
exports.CLASSES_GESTION = new Set([client_1.ClasseCompte.CLASSE_6, client_1.ClasseCompte.CLASSE_7, client_1.ClasseCompte.CLASSE_8]);
const arrondi = (n) => Math.round(n * 100) / 100;
exports.arrondi = arrondi;
function divisionsDeLaClasse9(lignes) {
    return [...new Set(lignes.filter((l) => l.classe === client_1.ClasseCompte.CLASSE_9).map((l) => l.numero.slice(0, 2)))];
}
async function ecrireLigneDeCompte(feuille, l, libelle, feuilleDuCompte) {
    const solde = (0, presentation_fpm_1.soldeEnDeuxColonnes)(l.totalDebit - l.totalCredit);
    return feuille.ajouter({
        numero: l.numero,
        intitule: libelle,
        avantDebit: (0, presentation_fpm_1.montantFpm)(l.avantDebit),
        avantCredit: (0, presentation_fpm_1.montantFpm)(l.avantCredit),
        mouvementDebit: (0, presentation_fpm_1.montantFpm)(l.mouvementDebit),
        mouvementCredit: (0, presentation_fpm_1.montantFpm)(l.mouvementCredit),
        soldeDebit: solde.debit,
        soldeCredit: solde.credit,
    }, feuilleDuCompte ? { lien: { colonne: 1, valeur: (0, presentation_fpm_1.formuleLien)(feuilleDuCompte, 'A1', l.numero) } } : {});
}
async function ecrireTotal(feuille, libelle, t, references) {
    const f = (col, valeur) => {
        const v = (0, presentation_fpm_1.montantFpm)(valeur);
        return v === null ? null : { formula: references(col), result: v };
    };
    const solde = (0, presentation_fpm_1.soldeEnDeuxColonnes)(t.solde);
    const net = (sens) => {
        const v = sens === 'D' ? solde.debit : solde.credit;
        if (v === null)
            return null;
        const [a, b] = sens === 'D' ? ['G', 'H'] : ['H', 'G'];
        return { formula: `MAX(0,${references(a)}-(${references(b)}))`, result: v };
    };
    return feuille.ajouter({
        intitule: libelle,
        avantDebit: f('C', t.avantDebit),
        avantCredit: f('D', t.avantCredit),
        mouvementDebit: f('E', t.mouvementDebit),
        mouvementCredit: f('F', t.mouvementCredit),
        soldeDebit: net('D'),
        soldeCredit: net('C'),
    }, { gras: true, filetHaut: true });
}
function totauxBalance(lignes) {
    const s = (f) => (0, exports.arrondi)(lignes.reduce((t, l) => t + f(l), 0));
    return {
        avantDebit: s((l) => l.avantDebit),
        avantCredit: s((l) => l.avantCredit),
        mouvementDebit: s((l) => l.mouvementDebit),
        mouvementCredit: s((l) => l.mouvementCredit),
        solde: s((l) => l.totalDebit - l.totalCredit),
    };
}
function sommeBalance(a, b) {
    return {
        avantDebit: (0, exports.arrondi)(a.avantDebit + b.avantDebit),
        avantCredit: (0, exports.arrondi)(a.avantCredit + b.avantCredit),
        mouvementDebit: (0, exports.arrondi)(a.mouvementDebit + b.mouvementDebit),
        mouvementCredit: (0, exports.arrondi)(a.mouvementCredit + b.mouvementCredit),
        solde: (0, exports.arrondi)(a.solde + b.solde),
    };
}
function ecartBalance(a, b) {
    return {
        avantDebit: (0, exports.arrondi)(a.avantDebit - b.avantDebit),
        avantCredit: (0, exports.arrondi)(a.avantCredit - b.avantCredit),
        mouvementDebit: (0, exports.arrondi)(a.mouvementDebit - b.mouvementDebit),
        mouvementCredit: (0, exports.arrondi)(a.mouvementCredit - b.mouvementCredit),
        solde: (0, exports.arrondi)(a.solde - b.solde),
    };
}
function estNulBalance(t) {
    return [t.avantDebit, t.avantCredit, t.mouvementDebit, t.mouvementCredit, t.solde].every((v) => (0, exports.arrondi)(v) === 0);
}
function plageBalance(premiere, derniere) {
    return (col) => `SUM(${col}${premiere}:${col}${derniere})`;
}
async function ecrireCorpsBalance(feuille, lignes, intitulesDivisions, feuilleDe) {
    const ligneDuCompte = new Map();
    const rangs = { bilan: [], gestion: [] };
    const rangsDivision = new Map();
    for (const l of lignes) {
        const r = await ecrireLigneDeCompte(feuille, l, l.intitule, feuilleDe?.get(l.compteId));
        ligneDuCompte.set(l.compteId, r);
        if (exports.CLASSES_BILAN.has(l.classe))
            rangs.bilan.push(r);
        else if (exports.CLASSES_GESTION.has(l.classe))
            rangs.gestion.push(r);
        else {
            const d = l.numero.slice(0, 2);
            rangsDivision.set(d, [...(rangsDivision.get(d) ?? []), r]);
        }
    }
    const tous = [...ligneDuCompte.values()];
    const formuleDesRangs = (r) => (col) => r.length === 0 ? '0' : `SUM(${r.map((x) => `${col}${x}`).join(',')})`;
    const plagesOuRangs = (r) => r.length > 0 && r[r.length - 1] - r[0] === r.length - 1 ? plageBalance(r[0], r[r.length - 1]) : formuleDesRangs(r);
    const tBilan = totauxBalance(lignes.filter((l) => exports.CLASSES_BILAN.has(l.classe)));
    const tGestion = totauxBalance(lignes.filter((l) => exports.CLASSES_GESTION.has(l.classe)));
    const rBilan = await ecrireTotal(feuille, 'Totaux comptes de bilan', tBilan, plagesOuRangs(rangs.bilan));
    const rGestion = await ecrireTotal(feuille, 'Totaux comptes de gestion', tGestion, plagesOuRangs(rangs.gestion));
    await ecrireTotal(feuille, 'Totaux de la balance', sommeBalance(tBilan, tGestion), (col) => `${col}${rBilan}+${col}${rGestion}`);
    for (const d of divisionsDeLaClasse9(lignes)) {
        await ecrireTotal(feuille, `Totaux ${intitulesDivisions.get(d) ?? d}`, totauxBalance(lignes.filter((l) => l.classe === client_1.ClasseCompte.CLASSE_9 && l.numero.startsWith(d))), plagesOuRangs(rangsDivision.get(d) ?? []));
    }
    return {
        ligneDuCompte,
        premiere: tous.length ? Math.min(...tous) : null,
        derniere: tous.length ? Math.max(...tous) : null,
    };
}
//# sourceMappingURL=balance-fpm.js.map