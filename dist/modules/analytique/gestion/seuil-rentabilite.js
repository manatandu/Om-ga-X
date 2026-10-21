"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.seuilDeRentabilite = seuilDeRentabilite;
const comportement_gestion_1 = require("./comportement-gestion");
const c = (n) => Math.round(n * 100);
function seuilDeRentabilite(mouvements, moisExercice) {
    let produits = 0;
    let variables = 0;
    let fixes = 0;
    const horsCalcul = [];
    const nonDeclares = [];
    for (const m of mouvements) {
        if (m.classe !== '6' && m.classe !== '7')
            continue;
        const net = m.classe === '6' ? m.mouvementDebit - m.mouvementCredit : m.mouvementCredit - m.mouvementDebit;
        if (c(net) === 0)
            continue;
        const ligne = { numero: m.numero, intitule: m.intitule, montant: c(net) / 100 };
        if (m.comportement === null) {
            nonDeclares.push(ligne);
            continue;
        }
        if (m.comportement === 'HORS_CALCUL') {
            horsCalcul.push(ligne);
            continue;
        }
        if (m.classe === '7') {
            if (m.comportement === 'PRODUIT_ACTIVITE')
                produits += c(net);
            else
                horsCalcul.push(ligne);
            continue;
        }
        if (m.comportement === 'PRODUIT_ACTIVITE') {
            horsCalcul.push(ligne);
            continue;
        }
        const p = (0, comportement_gestion_1.partageFixeVariable)(net, m.comportement, m.partVariablePct);
        variables += c(p.variable);
        fixes += c(p.fixe);
    }
    const marge = produits - variables;
    const base = {
        produits: produits / 100,
        chargesVariables: variables / 100,
        chargesFixes: fixes / 100,
        marge: marge / 100,
        tauxMarge: produits > 0 ? Math.round((marge / produits) * 10000) / 100 : null,
        horsCalcul,
        nonDeclares,
    };
    const vide = { seuil: null, margeSecurite: null, indiceSecurite: null, pointMortMois: null };
    if (nonDeclares.length > 0) {
        return {
            ...base,
            ...vide,
            motif: `${nonDeclares.length} compte(s) mouvementé(s) sans comportement déclaré · le seuil n'est pas calculé sur une partie des charges.`,
        };
    }
    if (produits <= 0) {
        return { ...base, ...vide, motif: "Aucun produit d'activité déclaré n'est mouvementé · le seuil se mesure en produits." };
    }
    if (marge <= 0) {
        return {
            ...base,
            ...vide,
            motif: 'La marge sur coûts variables est nulle ou négative · aucun niveau de produits ne couvre les charges fixes.',
        };
    }
    const seuil = Math.round((fixes * produits) / marge);
    return {
        ...base,
        seuil: seuil / 100,
        margeSecurite: (produits - seuil) / 100,
        indiceSecurite: Math.round(((produits - seuil) / produits) * 10000) / 100,
        pointMortMois: Math.round((seuil / produits) * moisExercice * 100) / 100,
        motif: null,
    };
}
//# sourceMappingURL=seuil-rentabilite.js.map