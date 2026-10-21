"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.lignesDeReevaluationSurLesTiers = lignesDeReevaluationSurLesTiers;
const PLAFOND_REEVALUATIONS = 50;
const centimes = (x) => Math.round(Number(x) * 100);
async function lignesDeReevaluationSurLesTiers(prisma, p) {
    const resultat = new Set();
    if (p.compteIds.length === 0)
        return resultat;
    const reevaluations = await prisma.reevaluation.findMany({
        where: { tenantId: p.tenantId, OR: [{ ecritureEcartsId: { not: null } }, { ecritureExtourneId: { not: null } }] },
        select: { ecritureEcartsId: true, ecritureExtourneId: true },
        orderBy: { dateReevaluation: 'desc' },
        take: PLAFOND_REEVALUATIONS,
    });
    const ecritures = reevaluations.flatMap((r) => [r.ecritureEcartsId, r.ecritureExtourneId]).filter((x) => x !== null);
    if (ecritures.length === 0)
        return resultat;
    const liees = await prisma.ligneEcriture.findMany({
        where: { ecritureId: { in: ecritures }, compteId: { in: p.compteIds }, ecriture: { tenantId: p.tenantId } },
        select: { id: true, compteId: true, debit: true, credit: true, lettre: true, ecriture: { select: { exerciceId: true, date: true } } },
    });
    const anterieures = [];
    for (const l of liees) {
        if (l.ecriture.exerciceId === p.exercice.id)
            resultat.add(l.id);
        else if (l.ecriture.date.getTime() < p.exercice.dateDebut.getTime() && l.lettre === null)
            anterieures.push(l);
    }
    if (anterieures.length === 0)
        return resultat;
    const candidates = await prisma.ligneEcriture.findMany({
        where: {
            compteId: { in: [...new Set(anterieures.map((l) => l.compteId))] },
            deviseId: null,
            ecriture: {
                tenantId: p.tenantId,
                exerciceId: p.exercice.id,
                OR: [{ estANouveauProvisoire: true }, { estGenereeParCloture: true, estSoldeDesComptesDeGestion: false }],
            },
        },
        select: { id: true, compteId: true, debit: true, credit: true, lettrageId: true },
        orderBy: { id: 'asc' },
    });
    const groupes = [...new Set(candidates.flatMap((l) => (l.lettrageId ? [l.lettrageId] : [])))];
    const groupesDeReevaluation = new Set(groupes.length === 0
        ? []
        : (await prisma.ligneEcriture.findMany({
            where: { lettrageId: { in: groupes }, ecritureId: { in: ecritures }, ecriture: { tenantId: p.tenantId } },
            select: { lettrageId: true },
        })).flatMap((l) => (l.lettrageId ? [l.lettrageId] : [])));
    const rang = (l) => (l.lettrageId === null ? 2 : groupesDeReevaluation.has(l.lettrageId) ? 0 : 1);
    for (const compteId of new Set(anterieures.map((l) => l.compteId))) {
        const restes = anterieures.filter((l) => l.compteId === compteId).map((l) => ({ d: centimes(l.debit), c: centimes(l.credit) }));
        const libres = candidates.filter((l) => l.compteId === compteId).sort((a, b) => rang(a) - rang(b));
        const sansPaire = [];
        for (const l of libres) {
            const i = restes.findIndex((r) => r.d === centimes(l.debit) && r.c === centimes(l.credit));
            if (i >= 0) {
                restes.splice(i, 1);
                resultat.add(l.id);
            }
            else if (l.lettrageId === null) {
                sansPaire.push(l);
            }
        }
        const net = restes.reduce((t, r) => t + r.d - r.c, 0);
        if (restes.length > 0 && net !== 0 && sansPaire.length === 1 && centimes(sansPaire[0].debit) - centimes(sansPaire[0].credit) === net) {
            resultat.add(sansPaire[0].id);
        }
    }
    return resultat;
}
//# sourceMappingURL=lignes-de-reevaluation.js.map