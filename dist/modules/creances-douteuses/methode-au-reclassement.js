"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.lireMethodeAuReclassement = lireMethodeAuReclassement;
const creances_douteuses_1 = require("./creances-douteuses");
async function lireMethodeAuReclassement(prisma, p) {
    const figee = p.figee ?? null;
    if (figee !== null)
        return (0, creances_douteuses_1.methodeAuReclassement)({ figee, geste: p.geste, actuelle: p.actuelle, journal: null });
    const fiche = { tenantId: p.tenantId, entite: 'Tenant', entiteId: p.tenantId };
    const choix = { horodatage: true, avant: true, apres: true };
    const [premier, dernierAvant, premierApres] = await Promise.all([
        prisma.evenementAudit.findFirst({ where: { tenantId: p.tenantId }, orderBy: { rang: 'asc' }, select: { horodatage: true } }),
        prisma.evenementAudit.findFirst({ where: { ...fiche, horodatage: { lte: p.geste } }, orderBy: { rang: 'desc' }, select: choix }),
        prisma.evenementAudit.findFirst({ where: { ...fiche, horodatage: { gt: p.geste } }, orderBy: { rang: 'asc' }, select: choix }),
    ]);
    const etat = (e) => e ? { le: e.horodatage, avant: (0, creances_douteuses_1.methodeLueDansLeJournal)(e.avant), apres: (0, creances_douteuses_1.methodeLueDansLeJournal)(e.apres) } : null;
    return (0, creances_douteuses_1.methodeAuReclassement)({
        figee: null,
        geste: p.geste,
        actuelle: p.actuelle,
        journal: { debut: premier?.horodatage ?? null, dernierAvant: etat(dernierAvant), premierApres: etat(premierApres) },
    });
}
//# sourceMappingURL=methode-au-reclassement.js.map