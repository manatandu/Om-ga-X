"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resteDuALaDate = resteDuALaDate;
exports.suiteEnNDesDettes = suiteEnNDesDettes;
const client_1 = require("@prisma/client");
const lecture_par_lots_1 = require("../../common/lecture-par-lots");
const centimes = (x) => Math.round(Number(x ?? 0) * 100);
const cle = (compteId, debit, credit, echeance, libelle) => `${compteId}|${centimes(debit)}|${centimes(credit)}|${echeance ? echeance.getTime() : ''}|${libelle ?? ''}`;
const UN_JOUR = 86_400_000;
async function resteDuALaDate(db, tenantId, ligne, date) {
    const propre = centimes(ligne.credit) - centimes(ligne.debit);
    if (!ligne.lettrageId)
        return Math.max(0, propre);
    const groupe = (await db.ligneEcriture.findMany({
        where: { lettrageId: ligne.lettrageId, ecriture: { tenantId, date: { lt: new Date(date.getTime() + UN_JOUR) } } },
        select: { id: true, debit: true, credit: true },
    }));
    let solde = 0;
    for (const l of groupe) {
        const net = centimes(l.credit) - centimes(l.debit);
        if (net > 0 && l.id !== ligne.id)
            return null;
        solde += net;
    }
    return Math.max(0, Math.min(propre, solde));
}
async function groupePoursuiviApres(db, tenantId, lettrageId, date) {
    const apres = (await db.ligneEcriture.findMany({
        where: { lettrageId, ecriture: { tenantId, date: { gt: date } } },
        select: { id: true },
        take: 1,
    }));
    return apres.length > 0;
}
async function suiteEnNDesDettes(db, tenantId, precedent, exercice, dettes) {
    const suite = new Map();
    if (dettes.length === 0)
        return suite;
    const enUnites = (r1, r2) => {
        const fin = Math.min(r1, r2);
        return { decaisseEnN: (r1 - fin) / 100, engageEnN: fin / 100 };
    };
    const reste1 = new Map();
    const aSuivre = [];
    for (const d of dettes) {
        const r1 = await resteDuALaDate(db, tenantId, d, precedent.dateFin);
        if (r1 === null) {
            suite.set(d.id, 'INCONNUE');
            continue;
        }
        if (r1 === 0) {
            suite.set(d.id, { decaisseEnN: 0, engageEnN: 0 });
            continue;
        }
        if (d.lettrageId && (await groupePoursuiviApres(db, tenantId, d.lettrageId, precedent.dateFin))) {
            const r2 = await resteDuALaDate(db, tenantId, d, exercice.dateFin);
            suite.set(d.id, r2 === null ? 'INCONNUE' : enUnites(r1, r2));
            continue;
        }
        reste1.set(d.id, r1);
        aSuivre.push(d);
    }
    if (aSuivre.length === 0)
        return suite;
    const comptes = [...new Set(aSuivre.map((d) => d.compteId))];
    const index = new Map();
    await (0, lecture_par_lots_1.lireParLots)((curseur) => db.ligneEcriture.findMany({
        where: {
            compteId: { in: comptes },
            ecriture: {
                tenantId,
                exerciceId: exercice.id,
                statut: client_1.StatutEcriture.VALIDEE,
                estGenereeParCloture: true,
                estSoldeDesComptesDeGestion: false,
            },
        },
        select: { id: true, compteId: true, debit: true, credit: true, dateEcheance: true, libelle: true, lettrageId: true },
        ...(0, lecture_par_lots_1.pageApres)(curseur, lecture_par_lots_1.LOT_LECTURE),
    }), (l) => {
        const k = cle(l.compteId, l.debit, l.credit, l.dateEcheance, l.libelle);
        index.set(k, [...(index.get(k) ?? []), l]);
    });
    for (const d of aSuivre) {
        const candidates = index.get(cle(d.compteId, d.debit, d.credit, d.dateEcheance, `RAN détail ${d.numero} · ${d.libelle}`)) ?? [];
        if (candidates.length !== 1) {
            suite.set(d.id, 'INCONNUE');
            continue;
        }
        const r2 = await resteDuALaDate(db, tenantId, candidates[0], exercice.dateFin);
        suite.set(d.id, r2 === null ? 'INCONNUE' : enUnites(reste1.get(d.id), r2));
    }
    return suite;
}
//# sourceMappingURL=engagements-anterieurs.js.map