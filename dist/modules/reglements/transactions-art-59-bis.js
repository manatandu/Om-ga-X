"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.estDAnouveau = estDAnouveau;
exports.classerTransactions = classerTransactions;
exports.transactionsDesLignes = transactionsDesLignes;
const ecritures_de_situation_1 = require("../comptabilite/ecritures-de-situation");
const date_origine_des_reports_1 = require("../relances/date-origine-des-reports");
function estDAnouveau(e) {
    return e.estANouveauProvisoire === true || (e.estGenereeParCloture === true && e.estSoldeDesComptesDeGestion !== true);
}
function classerTransactions(transactions, seuil) {
    const parCle = new Map();
    for (const t of transactions) {
        const deja = parCle.get(t.cle);
        parCle.set(t.cle, deja ? { ...deja, ligne: Math.max(deja.ligne, t.ligne), piece: Math.max(deja.piece, t.piece) } : t);
    }
    const auCentime = (x) => Math.round(x * 100);
    const jugees = [];
    const sousCondition = [];
    const nonJugees = [];
    for (const t of parCle.values()) {
        if (!t.origineRetrouvee)
            nonJugees.push({ reference: t.reference, montant: t.ligne });
        else if (auCentime(t.ligne) >= auCentime(seuil))
            jugees.push({ reference: t.reference, montant: t.ligne });
        else if (auCentime(t.piece) > auCentime(t.ligne))
            sousCondition.push({ reference: t.reference, montant: t.piece });
        else
            jugees.push({ reference: t.reference, montant: t.ligne });
    }
    return { jugees, sousCondition, nonJugees };
}
async function transactionsDesLignes(prisma, p) {
    const { tenantId } = p;
    const reportees = p.lignes.filter((l) => estDAnouveau(l.ecriture));
    const origineDe = new Map();
    if (reportees.length) {
        const exercice = await prisma.exercice.findFirst({ where: { id: p.exerciceId, tenantId }, select: { dateDebut: true } });
        if (exercice) {
            const { origines } = await (0, date_origine_des_reports_1.originesDesReports)(prisma, tenantId, exercice.dateDebut, reportees.map((l) => ({
                id: l.id,
                compteId: l.compteId,
                numeroCompte: l.compte.numero,
                debit: Number(l.debit),
                credit: Number(l.credit),
                libelle: l.libelle,
                dateEcheance: l.dateEcheance,
                date: l.ecriture.date,
                provisoire: l.ecriture.estANouveauProvisoire === true,
            })));
            const ids = [...new Set([...origines.values()].map((o) => o.id))];
            const lues = ids.length
                ? await prisma.ligneEcriture.findMany({
                    where: { id: { in: ids }, ecriture: { tenantId, ...ecritures_de_situation_1.HORS_SITUATION } },
                    select: {
                        id: true,
                        ecritureId: true,
                        compteId: true,
                        debit: true,
                        credit: true,
                        ecriture: { select: { numeroPiece: true, libelle: true, estANouveauProvisoire: true, estGenereeParCloture: true, estSoldeDesComptesDeGestion: true } },
                    },
                })
                : [];
            const parId = new Map(lues.map((o) => [o.id, o]));
            for (const [reportId, o] of origines) {
                const origine = parId.get(o.id);
                if (!origine || estDAnouveau(origine.ecriture))
                    continue;
                origineDe.set(reportId, {
                    ecritureId: origine.ecritureId,
                    compteId: origine.compteId,
                    numeroPiece: origine.ecriture.numeroPiece,
                    libelle: origine.ecriture.libelle,
                    debit: Number(origine.debit),
                    credit: Number(origine.credit),
                });
            }
        }
    }
    const pieces = [
        ...new Set([...p.lignes.filter((l) => !estDAnouveau(l.ecriture)).map((l) => l.ecritureId), ...[...origineDe.values()].map((o) => o.ecritureId)]),
    ];
    const sommes = pieces.length
        ? await prisma.ligneEcriture.groupBy({
            by: ['ecritureId', 'compteId'],
            where: { ecritureId: { in: pieces }, ecriture: { tenantId, ...ecritures_de_situation_1.HORS_SITUATION } },
            _sum: { debit: true, credit: true },
        })
        : [];
    const sensDeLaPiece = new Map(sommes.map((x) => [`${x.ecritureId}:${x.compteId}`, { debit: Number(x._sum.debit ?? 0), credit: Number(x._sum.credit ?? 0) }]));
    const resultat = new Map();
    for (const l of p.lignes) {
        const o = origineDe.get(l.id);
        const reference = (x) => x.numeroPiece ? `pièce ${x.numeroPiece}` : x.libelle || 'facture';
        if (!o && estDAnouveau(l.ecriture)) {
            const reste = Math.abs(Number(l.debit) - Number(l.credit));
            resultat.set(l.id, { cle: l.id, reference: reference(l.ecriture), ligne: reste, piece: reste, origineRetrouvee: false });
            continue;
        }
        const facture = o ?? { debit: Number(l.debit), credit: Number(l.credit) };
        const ligne = Math.abs(facture.debit - facture.credit);
        const cle = o ? `${o.ecritureId}:${o.compteId}` : `${l.ecritureId}:${l.compteId}`;
        const sommesDuSens = sensDeLaPiece.get(cle);
        const piece = sommesDuSens ? (facture.credit > facture.debit ? sommesDuSens.credit : sommesDuSens.debit) : ligne;
        resultat.set(l.id, { cle, reference: reference(o ?? l.ecriture), ligne, piece: Math.max(piece, ligne), origineRetrouvee: true });
    }
    return resultat;
}
//# sourceMappingURL=transactions-art-59-bis.js.map