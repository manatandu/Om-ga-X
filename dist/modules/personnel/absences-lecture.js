"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.lireAbsencesPourConges = exports.PLAFOND_ABSENCES_SALARIE = exports.AUCUNE_ABSENCE = void 0;
exports.absencesDuSalarie = absencesDuSalarie;
exports.congesPayesDuMois = congesPayesDuMois;
const absences_1 = require("./absences");
const service_du_salarie_1 = require("./service-du-salarie");
const AUCUNE_ABSENCE = async () => ({ joursHorsService: [], joursMaladie: new Set() });
exports.AUCUNE_ABSENCE = AUCUNE_ABSENCE;
exports.PLAFOND_ABSENCES_SALARIE = 2_000;
const iso = (d) => d.toISOString().slice(0, 10);
async function absencesDuSalarie(db, tenantId, salarieId) {
    const lignes = await db.absenceSalarie.findMany({
        where: { tenantId, salarieId, annuleLe: null },
        orderBy: { du: 'asc' },
        take: exports.PLAFOND_ABSENCES_SALARIE,
        select: { id: true, nature: true, du: true, au: true, demiJourneeDebut: true, demiJourneeFin: true },
    });
    return lignes.map((a) => ({
        id: a.id,
        nature: a.nature,
        du: iso(a.du),
        au: iso(a.au),
        demiJourneeDebut: a.demiJourneeDebut,
        demiJourneeFin: a.demiJourneeFin,
    }));
}
const lireAbsencesPourConges = async (db, tenantId, salarieId) => {
    const [absences, contrats] = await Promise.all([
        absencesDuSalarie(db, tenantId, salarieId),
        db.contratTravail.findMany({
            where: { tenantId, salarieId },
            select: { id: true, dateEntreeEnVigueur: true, dateFin: true, renouvelleDeId: true },
            take: 500,
        }),
    ]);
    const service = (0, service_du_salarie_1.serviceEnCours)(contrats);
    return (0, absences_1.absencesPourLeCompteur)(absences, service ? iso(service.origine) : null);
};
exports.lireAbsencesPourConges = lireAbsencesPourConges;
const PLAFOND_CONGES_DU_MOIS = 62;
async function congesPayesDuMois(db, tenantId, salarieId, mois, absences) {
    const [a, m] = mois.split('-').map(Number);
    const debut = new Date(Date.UTC(a, m - 1, 1));
    const fin = new Date(Date.UTC(a, m, 0));
    const lignes = await db.congeSalarie.findMany({
        where: { tenantId, salarieId, annuleLe: null, du: { lte: fin }, au: { gte: debut } },
        orderBy: { du: 'asc' },
        take: PLAFOND_CONGES_DU_MOIS,
        select: {
            id: true,
            du: true,
            au: true,
            joursVoyage: true,
            moisDePaie: true,
            remunerationJournaliere: true,
            deviseAllocation: true,
            bulletin: { select: { numero: true, statut: true } },
        },
    });
    if (lignes.length === 0)
        return [];
    const lues = absences ?? (await absencesDuSalarie(db, tenantId, salarieId));
    const { joursMaladie } = (0, absences_1.absencesPourLeCompteur)(lues, null);
    const calcules = (0, absences_1.congesDuMois)(lignes.map((c) => ({ id: c.id, du: iso(c.du), au: iso(c.au), joursVoyage: c.joursVoyage })), mois, joursMaladie);
    return calcules.map((c) => {
        const l = lignes.find((x) => x.id === c.id);
        return {
            ...c,
            moisDePaie: l.moisDePaie,
            portePar: l.bulletin?.statut === 'EMIS' ? l.bulletin.numero : null,
            remunerationJournaliere: l.remunerationJournaliere === null ? null : Number(l.remunerationJournaliere),
            deviseAllocation: l.deviseAllocation,
        };
    });
}
//# sourceMappingURL=absences-lecture.js.map