"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.motifLigneFigee = motifLigneFigee;
exports.lignesFigees = lignesFigees;
exports.refuserSiLignesFigees = refuserSiLignesFigees;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const jour = (d) => d.toISOString().slice(0, 10);
function motifLigneFigee(ligne, clotures) {
    if (ligne.exerciceClos) {
        return "son exercice est clôturé · « on ne peut pas modifier les enregistrements d'exercice clôturé »";
    }
    for (const c of clotures) {
        if (c.granularite === client_1.GranulariteCloture.TOTALE && c.journalId === ligne.journalId && ligne.date <= c.dateLimite) {
            const code = ligne.journalCode ? ` ${ligne.journalCode}` : '';
            return `le journal${code} est clôturé totalement · « les journaux ne seront plus modifiables »`;
        }
        if (c.granularite === client_1.GranulariteCloture.PERIODE && !ligne.journalSituation && ligne.date <= c.dateLimite) {
            return `la période jusqu'au ${jour(c.dateLimite)} est clôturée pour tous les journaux`;
        }
    }
    return null;
}
async function lignesFigees(prisma, tenantId, ligneIds) {
    const client = prisma;
    const figees = new Map();
    if (ligneIds.length === 0)
        return figees;
    const [lignes, clotures] = await Promise.all([
        client.ligneEcriture.findMany({
            where: { id: { in: ligneIds }, ecriture: { tenantId } },
            select: {
                id: true,
                ecriture: {
                    select: { date: true, journalId: true, journal: { select: { code: true, type: true } }, exercice: { select: { statut: true } } },
                },
            },
        }),
        client.cloture.findMany({
            where: { tenantId, annuleeAt: null, granularite: { not: client_1.GranulariteCloture.PARTIELLE } },
            select: { granularite: true, journalId: true, dateLimite: true },
        }),
    ]);
    for (const l of lignes) {
        const motif = motifLigneFigee({
            journalId: l.ecriture.journalId,
            journalCode: l.ecriture.journal.code,
            journalSituation: l.ecriture.journal.type === client_1.TypeJournal.SITUATION,
            date: l.ecriture.date,
            exerciceClos: l.ecriture.exercice.statut === client_1.StatutExercice.CLOTURE,
        }, clotures);
        if (motif)
            figees.set(l.id, { date: l.ecriture.date, motif });
    }
    return figees;
}
async function refuserSiLignesFigees(prisma, tenantId, ligneIds, action) {
    const figees = await lignesFigees(prisma, tenantId, ligneIds);
    const premiere = [...figees.values()][0];
    if (premiere) {
        throw new common_1.BadRequestException(`Impossible ${/^[aeiouyéèê]/i.test(action) ? "d'" : 'de '}${action} : la ligne du ${jour(premiere.date)} est figée, ${premiere.motif}. ` +
            "Une clôture totale, de période ou d'exercice fige aussi le lettrage et la ventilation analytique ; " +
            'seule la clôture partielle les laisse ouverts (Sage i7).');
    }
}
//# sourceMappingURL=gel-cloture.js.map