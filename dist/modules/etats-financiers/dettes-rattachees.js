"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.POSTES_NATURE_DETTE_FOURNISSEUR = void 0;
exports.filtreComptes = filtreComptes;
exports.dettesALOuverture = dettesALOuverture;
exports.dettesALaCloture = dettesALaCloture;
exports.dettesParPoste = dettesParPoste;
exports.dettesFournisseursNeesDImmobilisations = dettesFournisseursNeesDImmobilisations;
const client_1 = require("@prisma/client");
const lecture_par_lots_1 = require("../../common/lecture-par-lots");
const ouverte_a_la_cloture_1 = require("../lettrage/ouverte-a-la-cloture");
const paires_a_cheval_1 = require("../lettrage/paires-a-cheval");
const etats_financiers_communs_1 = require("./etats-financiers.communs");
const reglements_de_tresorerie_1 = require("./reglements-de-tresorerie");
const centimes = (x) => Math.round(Number(x ?? 0) * 100);
const TRANCHE = 500;
const EN_PARALLELE = 10;
function filtreComptes(c) {
    return {
        OR: c.comptes.map((p) => ({ numero: { startsWith: p } })),
        ...(c.exclusions && c.exclusions.length > 0 ? { NOT: c.exclusions.map((x) => ({ numero: { startsWith: x } })) } : {}),
    };
}
async function factureDuGroupe(db, tenantId, ligne) {
    if (!ligne.lettrageId || centimes(ligne.credit) - centimes(ligne.debit) >= 0)
        return null;
    const groupe = (await db.ligneEcriture.findMany({
        where: { lettrageId: ligne.lettrageId, ecriture: { tenantId } },
        select: reglements_de_tresorerie_1.SELECT_LIGNE,
    }));
    const factures = groupe.filter((l) => l.id !== ligne.id && centimes(l.credit) - centimes(l.debit) > 0);
    if (factures.length !== 1)
        return null;
    return (0, reglements_de_tresorerie_1.estANouveau)(factures[0].ecriture) ? (0, reglements_de_tresorerie_1.factureDOrigine)(db, tenantId, factures[0]) : factures[0];
}
async function rattacherALaPiece(db, tenantId, lignes) {
    const rendu = [];
    for (let i = 0; i < lignes.length; i += EN_PARALLELE) {
        const lot = lignes.slice(i, i + EN_PARALLELE);
        const origines = await Promise.all(lot.map(async ({ ligne }) => {
            const facture = await factureDuGroupe(db, tenantId, ligne);
            if (facture)
                return facture;
            return (0, reglements_de_tresorerie_1.estANouveau)(ligne.ecriture) ? (0, reglements_de_tresorerie_1.factureDOrigine)(db, tenantId, ligne) : ligne;
        }));
        lot.forEach(({ ligne, montant }, k) => rendu.push({ ligneId: ligne.id, compteId: ligne.compteId, montant, ecritureOrigineId: origines[k]?.ecriture.id ?? null }));
    }
    return rendu;
}
async function dettesALOuverture(db, tenantId, exerciceId, comptes) {
    const lues = [];
    await (0, lecture_par_lots_1.lireParLots)((curseur) => db.ligneEcriture.findMany({
        where: {
            compte: filtreComptes(comptes),
            ecriture: {
                tenantId,
                exerciceId,
                statut: client_1.StatutEcriture.VALIDEE,
                estGenereeParCloture: true,
                estSoldeDesComptesDeGestion: false,
            },
        },
        select: reglements_de_tresorerie_1.SELECT_LIGNE,
        ...(0, lecture_par_lots_1.pageApres)(curseur, lecture_par_lots_1.LOT_LECTURE),
    }), (l) => lues.push({ ligne: l, montant: (centimes(l.credit) - centimes(l.debit)) / 100 }));
    return rattacherALaPiece(db, tenantId, lues);
}
async function dettesALaCloture(db, tenantId, exercice, comptes) {
    const paires = await (0, paires_a_cheval_1.pairesACheval)(db, { tenantId, exercice, compte: filtreComptes(comptes) });
    const lues = [];
    await (0, lecture_par_lots_1.lireParLots)((curseur) => db.ligneEcriture.findMany({
        where: {
            compte: filtreComptes(comptes),
            ecriture: { tenantId, exerciceId: exercice.id, statut: client_1.StatutEcriture.VALIDEE },
            ...(0, ouverte_a_la_cloture_1.ouverteALaCloture)(exercice.dateFin),
        },
        select: reglements_de_tresorerie_1.SELECT_LIGNE,
        ...(0, lecture_par_lots_1.pageApres)(curseur, lecture_par_lots_1.LOT_LECTURE),
    }), (l) => {
        if (paires.absorbees.has(l.id))
            return;
        const reste = paires.reste.get(l.id);
        const montant = reste ? -reste.francs : (centimes(l.credit) - centimes(l.debit)) / 100;
        lues.push({ ligne: l, montant });
    });
    return rattacherALaPiece(db, tenantId, lues);
}
async function dettesParPoste(db, tenantId, dettes, postes) {
    const rendu = { parRef: new Map(), nonRattache: 0 };
    const posteDe = (numero) => postes.find((p) => (0, etats_financiers_communs_1.correspond)(numero, p.comptes, p.exclusions))?.ref ?? null;
    const pieces = [...new Set(dettes.map((d) => d.ecritureOrigineId).filter((x) => x !== null))];
    const composition = new Map();
    for (let i = 0; i < pieces.length; i += TRANCHE) {
        const lues = (await db.ligneEcriture.findMany({
            where: { ecritureId: { in: pieces.slice(i, i + TRANCHE) }, ecriture: { tenantId } },
            select: { ecritureId: true, debit: true, credit: true, compte: { select: { numero: true } } },
        }));
        for (const l of lues) {
            const ref = posteDe(l.compte.numero);
            if (!ref)
                continue;
            const parts = composition.get(l.ecritureId) ?? new Map();
            parts.set(ref, (parts.get(ref) ?? 0) + centimes(l.debit) - centimes(l.credit));
            composition.set(l.ecritureId, parts);
        }
    }
    const partsDe = (d) => {
        const enCentimes = Math.round(d.montant * 100);
        const parts = d.ecritureOrigineId ? [...(composition.get(d.ecritureOrigineId) ?? new Map()).entries()] : [];
        const total = parts.reduce((s, [, c]) => s + c, 0);
        if (parts.length === 0 || total === 0)
            return null;
        let reste = enCentimes;
        return parts.map(([ref, c], k) => {
            const part = k === parts.length - 1 ? reste : Math.round((enCentimes * c) / total);
            reste -= part;
            return [ref, part];
        });
    };
    let nonRattache = 0;
    const parRef = new Map();
    const parCompte = new Map();
    for (const d of dettes)
        parCompte.set(d.compteId, [...(parCompte.get(d.compteId) ?? []), d]);
    for (const lignesDuCompte of parCompte.values()) {
        const parts = lignesDuCompte.map(partsDe);
        if (parts.some((p) => p === null)) {
            nonRattache += lignesDuCompte.reduce((s, d) => s + Math.round(d.montant * 100), 0);
            continue;
        }
        for (const p of parts)
            for (const [ref, c] of p)
                parRef.set(ref, (parRef.get(ref) ?? 0) + c);
    }
    for (const [ref, c] of parRef)
        rendu.parRef.set(ref, c / 100);
    rendu.nonRattache = nonRattache / 100;
    return rendu;
}
exports.POSTES_NATURE_DETTE_FOURNISSEUR = [
    { ref: 'IMMOBILISATION', comptes: ['2'] },
    { ref: 'RESULTAT', comptes: ['6', '7', '8'] },
    { ref: 'AUTRE', comptes: ['1', '3', '4', '9'], exclusions: ['40'] },
];
async function dettesFournisseursNeesDImmobilisations(db, tenantId, exercice, comptes) {
    const [ouverture, cloture] = await Promise.all([
        dettesALOuverture(db, tenantId, exercice.id, comptes).then((d) => dettesParPoste(db, tenantId, d, exports.POSTES_NATURE_DETTE_FOURNISSEUR)),
        dettesALaCloture(db, tenantId, exercice, comptes).then((d) => dettesParPoste(db, tenantId, d, exports.POSTES_NATURE_DETTE_FOURNISSEUR)),
    ]);
    return { ouverture: ouverture.parRef.get('IMMOBILISATION') ?? 0, cloture: cloture.parRef.get('IMMOBILISATION') ?? 0 };
}
//# sourceMappingURL=dettes-rattachees.js.map