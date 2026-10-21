"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.estCompteSeme = estCompteSeme;
exports.racineDuCompteSeme = racineDuCompteSeme;
exports.compteSemeSubdivise = compteSemeSubdivise;
exports.racinesSousLeCompteSeme = racinesSousLeCompteSeme;
exports.comptesDImputationSemes = comptesDImputationSemes;
exports.sousComptePropose = sousComptePropose;
exports.numerosSemes = numerosSemes;
exports.estCompteDePassage = estCompteDePassage;
exports.comptesDuPlanSubdivises = comptesDuPlanSubdivises;
const client_1 = require("@prisma/client");
const compte_seed_1 = require("./compte-seed");
const compte_seed_syscohada_1 = require("./compte-seed-syscohada");
const CACHE = new Map();
function planDu(referentiel) {
    return referentiel === client_1.Referentiel.SYSCOHADA ? compte_seed_syscohada_1.PLAN_COMPTES_SYSCOHADA : compte_seed_1.PLAN_COMPTES_SYCEBNL;
}
function racinesDu(referentiel) {
    const deja = CACHE.get(referentiel);
    if (deja)
        return deja;
    const plan = planDu(referentiel);
    const totaux = new Set(plan.filter((c) => c.typeCompte === client_1.TypeCompteDetailTotal.TOTAL).map((c) => c.numero));
    const racineDuDetail = new Map();
    const racines = [];
    for (const c of plan) {
        if (c.typeCompte === client_1.TypeCompteDetailTotal.TOTAL) {
            racines.push({ racine: c.numero, numero: c.numero, detail: false });
            continue;
        }
        const depouille = c.numero.replace(/0+$/, '');
        let longueur = Math.max(depouille.length, 2);
        while (longueur < c.numero.length && totaux.has(c.numero.slice(0, longueur)))
            longueur += 1;
        const racine = c.numero.slice(0, longueur);
        racineDuDetail.set(c.numero, racine);
        racines.push({ racine, numero: c.numero, detail: true });
    }
    racines.sort((a, b) => b.racine.length - a.racine.length || a.racine.localeCompare(b.racine));
    const resultat = { racineDuDetail, racines, semes: new Set(plan.map((c) => c.numero)) };
    CACHE.set(referentiel, resultat);
    return resultat;
}
function estCompteSeme(referentiel, numero) {
    return racinesDu(referentiel).semes.has(numero);
}
function racineDuCompteSeme(referentiel, numero) {
    return racinesDu(referentiel).racineDuDetail.get(numero) ?? null;
}
function compteSemeSubdivise(referentiel, numero) {
    const { racines, semes } = racinesDu(referentiel);
    if (semes.has(numero))
        return null;
    const parent = racines.find((r) => numero.startsWith(r.racine));
    return parent && parent.detail ? parent.numero : null;
}
function racinesSousLeCompteSeme(referentiel, numero) {
    const racine = racineDuCompteSeme(referentiel, numero);
    if (racine === null)
        return [];
    return racinesDu(referentiel)
        .racines.filter((r) => r.numero !== numero && r.racine.length > racine.length && r.racine.startsWith(racine))
        .map((r) => r.racine);
}
function comptesDImputationSemes(referentiel, prefixe) {
    return [...racinesDu(referentiel).racineDuDetail.keys()].filter((n) => n.startsWith(prefixe)).sort();
}
function sousComptePropose(referentiel, numeroSeme, longueur, existants) {
    const racine = racineDuCompteSeme(referentiel, numeroSeme);
    if (racine === null)
        return null;
    const largeur = longueur - racine.length;
    if (largeur < 1)
        return null;
    const { semes } = racinesDu(referentiel);
    const plusProfondes = racinesSousLeCompteSeme(referentiel, numeroSeme);
    const pris = new Set(existants);
    const max = 10 ** largeur - 1;
    for (let i = 1; i <= max; i++) {
        const numero = racine + String(i).padStart(largeur, '0');
        if (pris.has(numero) || semes.has(numero))
            continue;
        if (plusProfondes.some((r) => numero.startsWith(r)))
            continue;
        return numero;
    }
    return null;
}
function numerosSemes(referentiel) {
    return [...racinesDu(referentiel).semes];
}
function estCompteDePassage(numero) {
    return numero.startsWith('585') || numero.startsWith('588');
}
function comptesDuPlanSubdivises(referentiel, comptes) {
    const subdivises = new Set();
    for (const c of comptes) {
        if (c.typeCompte !== client_1.TypeCompteDetailTotal.DETAIL || !c.estActif)
            continue;
        const parent = compteSemeSubdivise(referentiel, c.numero);
        if (parent && !estCompteDePassage(parent))
            subdivises.add(parent);
    }
    return subdivises;
}
//# sourceMappingURL=subdivisions-du-plan.js.map