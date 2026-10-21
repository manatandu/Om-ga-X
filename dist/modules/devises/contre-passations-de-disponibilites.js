"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PLAFOND_REEVALUATIONS_EXAMINEES = void 0;
exports.contrePassationsDeDisponibilites = contrePassationsDeDisponibilites;
exports.ecrituresDesContrePassationsAnnulees = ecrituresDesContrePassationsAnnulees;
exports.lignesDeDisponibilitesDesContrePassationsDeclarees = lignesDeDisponibilitesDesContrePassationsDeclarees;
const client_1 = require("@prisma/client");
const ecarts_disponibilites_1 = require("./ecarts-disponibilites");
const contre_passation_manuelle_1 = require("./contre-passation-manuelle");
exports.PLAFOND_REEVALUATIONS_EXAMINEES = 50;
async function contrePassationsDeDisponibilites(prisma, p) {
    const lignesLues = { select: { compteId: true, debit: true, credit: true, compte: { select: { numero: true } } } };
    const reevaluations = await prisma.reevaluation.findMany({
        where: {
            tenantId: p.tenantId,
            annuleeLe: null,
            OR: [{ ecritureExtourne: { is: { exerciceId: p.exerciceId } } }, { contrePassationDeclaree: { is: { exerciceId: p.exerciceId } } }],
        },
        orderBy: [{ dateReevaluation: 'asc' }, { id: 'asc' }],
        take: exports.PLAFOND_REEVALUATIONS_EXAMINEES + 1,
        select: {
            dateReevaluation: true,
            contrePassationIntegrale: true,
            exercice: { select: { statut: true } },
            ecritureEcarts: { select: { lignes: lignesLues } },
            ecritureExtourne: {
                select: {
                    exerciceId: true,
                    numeroPiece: true,
                    date: true,
                    exercice: { select: { statut: true } },
                    lignes: lignesLues,
                },
            },
            contrePassationDeclaree: {
                select: {
                    exerciceId: true,
                    numeroPiece: true,
                    date: true,
                    exercice: { select: { statut: true } },
                    lignes: lignesLues,
                },
            },
        },
    });
    const tronque = reevaluations.length > exports.PLAFOND_REEVALUATIONS_EXAMINEES;
    const elements = [];
    const enLignes = (lignes) => lignes.map((l) => ({ compteId: l.compteId, compteNumero: l.compte.numero, debit: Number(l.debit), credit: Number(l.credit) }));
    for (const r of reevaluations.slice(0, exports.PLAFOND_REEVALUATIONS_EXAMINEES)) {
        const ecarts = enLignes(r.ecritureEcarts?.lignes ?? []);
        const aRepasser = (0, ecarts_disponibilites_1.partagerLignesDEcarts)(ecarts).aContrePasser.length > 0;
        const commun = { dateReevaluation: r.dateReevaluation, exerciceReevaluationClos: r.exercice.statut === 'CLOTURE', aRepasser, autresGestes: false };
        const x = r.ecritureExtourne;
        if (x && x.exerciceId === p.exerciceId) {
            for (const l of x.lignes) {
                if (!(0, ecarts_disponibilites_1.estDisponibilite)(l.compte.numero))
                    continue;
                elements.push({
                    ...commun,
                    exerciceContrePassationClos: x.exercice?.statut === 'CLOTURE',
                    piece: x.numeroPiece,
                    date: x.date,
                    compteNumero: l.compte.numero,
                    montant: Math.round((Number(l.debit) - Number(l.credit)) * 100) / 100,
                    exception: r.contrePassationIntegrale
                        ? (ecarts_disponibilites_1.LIBELLE_INTEGRALE[r.contrePassationIntegrale] ?? r.contrePassationIntegrale)
                        : null,
                    manuelle: false,
                });
            }
        }
        const d = r.contrePassationDeclaree;
        if (d && d.exerciceId === p.exerciceId) {
            const lignes = enLignes(d.lignes);
            const inversees = (0, contre_passation_manuelle_1.disponibilitesInversees)(ecarts, lignes, ecarts_disponibilites_1.estDisponibilite);
            for (const compteId of inversees) {
                const surLeCompte = lignes.filter((l) => l.compteId === compteId);
                elements.push({
                    ...commun,
                    exerciceContrePassationClos: d.exercice?.statut === 'CLOTURE',
                    piece: d.numeroPiece,
                    date: d.date,
                    compteNumero: surLeCompte[0]?.compteNumero ?? '',
                    montant: Math.round(surLeCompte.reduce((t, l) => t + l.debit - l.credit, 0) * 100) / 100,
                    exception: null,
                    manuelle: true,
                    autresGestes: lignes.some((l) => !ecarts.some((x) => x.compteId === l.compteId)),
                });
            }
        }
    }
    return { elements, tronque };
}
async function ecrituresDesContrePassationsAnnulees(prisma, tenantId) {
    const traces = await prisma.reevaluation.findMany({
        where: { tenantId, annulationsContrePassation: { not: client_1.Prisma.DbNull } },
        orderBy: [{ dateReevaluation: 'desc' }, { id: 'asc' }],
        take: exports.PLAFOND_REEVALUATIONS_EXAMINEES + 1,
        select: { annulationsContrePassation: true },
    });
    const ids = new Set();
    for (const t of traces.slice(0, exports.PLAFOND_REEVALUATIONS_EXAMINEES)) {
        const liste = Array.isArray(t.annulationsContrePassation) ? t.annulationsContrePassation : [];
        for (const a of liste) {
            if (!a || typeof a !== 'object' || Array.isArray(a))
                continue;
            const { ecritureId, negatifId } = a;
            if (typeof ecritureId === 'string')
                ids.add(ecritureId);
            if (typeof negatifId === 'string')
                ids.add(negatifId);
        }
    }
    return { ids, tronque: traces.length > exports.PLAFOND_REEVALUATIONS_EXAMINEES };
}
async function lignesDeDisponibilitesDesContrePassationsDeclarees(prisma, p) {
    const lignesLues = { select: { id: true, compteId: true, debit: true, credit: true, compte: { select: { numero: true } } } };
    const reevaluations = await prisma.reevaluation.findMany({
        where: { tenantId: p.tenantId, annuleeLe: null, contrePassationDeclaree: { is: { exerciceId: p.exerciceId } } },
        orderBy: [{ dateReevaluation: 'asc' }, { id: 'asc' }],
        take: exports.PLAFOND_REEVALUATIONS_EXAMINEES + 1,
        select: {
            ecritureEcarts: { select: { lignes: lignesLues } },
            contrePassationDeclaree: { select: { id: true, lignes: lignesLues } },
        },
    });
    const centimes = (l) => Math.round(Number(l.debit) * 100) - Math.round(Number(l.credit) * 100);
    const lignes = new Set();
    for (const r of reevaluations.slice(0, exports.PLAFOND_REEVALUATIONS_EXAMINEES)) {
        const d = r.contrePassationDeclaree;
        if (!d)
            continue;
        for (const e of (r.ecritureEcarts?.lignes ?? []).filter((l) => (0, ecarts_disponibilites_1.estDisponibilite)(l.compte.numero))) {
            const inverse = -centimes(e);
            if (inverse === 0)
                continue;
            const trouvee = d.lignes.find((l) => l.compteId === e.compteId && centimes(l) === inverse && !lignes.has(l.id));
            if (trouvee)
                lignes.add(trouvee.id);
        }
    }
    return { lignes, tronque: reevaluations.length > exports.PLAFOND_REEVALUATIONS_EXAMINEES };
}
//# sourceMappingURL=contre-passations-de-disponibilites.js.map