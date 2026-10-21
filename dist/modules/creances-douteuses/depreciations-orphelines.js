"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.depreciationsOrphelines = depreciationsOrphelines;
const lecture_par_lots_1 = require("../../common/lecture-par-lots");
const creances_douteuses_1 = require("./creances-douteuses");
async function depreciationsOrphelines(prisma, p) {
    const ex = await prisma.exercice.findFirst({
        where: { id: p.exerciceId, tenantId: p.tenantId },
        select: { id: true, dateDebut: true, dateFin: true },
    });
    if (!ex)
        return [];
    const orphelines = [];
    await (0, lecture_par_lots_1.lireParLots)((curseur) => prisma.creanceDouteuse.findMany({
        where: { tenantId: p.tenantId, dateReclassement: { lte: ex.dateFin }, annuleeLe: null, ...(0, creances_douteuses_1.nonCorrigeeAu)(ex.dateFin) },
        select: {
            id: true,
            montant: true,
            dateReclassement: true,
            declareeOuverture: true,
            depreciationOuverture: true,
            compteCreance: { select: { numero: true, intitule: true } },
            ajustements: {
                where: { annuleeLe: null },
                select: { exerciceId: true, ecart: true, exercice: { select: { dateFin: true } } },
            },
            mouvements: { where: { annuleeLe: null }, select: { date: true, montant: true } },
        },
        ...(0, lecture_par_lots_1.pageApres)(curseur, lecture_par_lots_1.LOT_ECRITURES),
    }), (c) => {
        const creance = `${c.compteCreance.numero} ${c.compteCreance.intitule}`;
        const resteFinal = (0, creances_douteuses_1.resteFinalDeLaCreance)(Number(c.montant), c.mouvements.map((m) => ({ montant: Number(m.montant) })));
        if (resteFinal < -0.005) {
            orphelines.push({ creance, enPlace: 0, reste: resteFinal, resteFinal });
            return;
        }
        if (c.ajustements.some((a) => a.exerciceId === ex.id))
            return;
        const enPlace = (0, creances_douteuses_1.enPlaceAvant)({ declareeOuverture: c.declareeOuverture, depreciationOuverture: Number(c.depreciationOuverture), dateReclassement: c.dateReclassement }, c.ajustements.map((a) => ({ exerciceDateFin: a.exercice.dateFin, ecart: Number(a.ecart) })), ex.dateDebut);
        const reste = (0, creances_douteuses_1.resteDeLaCreance)(Number(c.montant), c.mouvements.map((m) => ({ date: m.date, montant: Number(m.montant) })), ex.dateFin);
        if (enPlace > reste + 0.005) {
            orphelines.push({ creance, enPlace, reste });
        }
    }, lecture_par_lots_1.LOT_ECRITURES);
    return orphelines;
}
//# sourceMappingURL=depreciations-orphelines.js.map