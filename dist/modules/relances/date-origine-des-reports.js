"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PROFONDEUR_MAX = void 0;
exports.apparierAuxOrigines = apparierAuxOrigines;
exports.datesOrigineDesReports = datesOrigineDesReports;
exports.originesDesReports = originesDesReports;
const client_1 = require("@prisma/client");
const lecture_par_lots_1 = require("../../common/lecture-par-lots");
const declaration_devise_a_nouveau_1 = require("../devises/declaration-devise-a-nouveau");
const lignes_reportees_au_detail_1 = require("../exercice/lignes-reportees-au-detail");
exports.PROFONDEUR_MAX = 10;
function apparierAuxOrigines(reports, candidates) {
    const cleReport = (r) => (0, declaration_devise_a_nouveau_1.cleDeLigne)({ id: r.id, compteId: r.compteId, debit: r.debit, credit: r.credit, libelle: r.libelle, dateEcheance: r.dateEcheance ?? null });
    const cleOrigine = (o) => (0, declaration_devise_a_nouveau_1.cleDuReport)({ id: o.id, compteId: o.compteId, debit: o.debit, credit: o.credit, libelle: o.libelle, dateEcheance: o.dateEcheance ?? null }, o.numeroCompte);
    const reportsParCle = new Map();
    for (const r of reports)
        reportsParCle.set(cleReport(r), [...(reportsParCle.get(cleReport(r)) ?? []), r]);
    const originesParCle = new Map();
    for (const o of candidates)
        originesParCle.set(cleOrigine(o), [...(originesParCle.get(cleOrigine(o)) ?? []), o]);
    const resultat = new Map();
    for (const [cle, rs] of reportsParCle) {
        const os = originesParCle.get(cle) ?? [];
        if (os.length === 0 || os.length !== rs.length)
            continue;
        const reportsTries = [...rs].sort((a, b) => a.id.localeCompare(b.id));
        const originesTriees = [...os].sort((a, b) => a.date.getTime() - b.date.getTime() || a.id.localeCompare(b.id));
        reportsTries.forEach((r, i) => resultat.set(r.id, originesTriees[i]));
    }
    return resultat;
}
async function datesOrigineDesReports(client, tenantId, debutExercice, reports) {
    const { origines } = await originesDesReports(client, tenantId, debutExercice, reports);
    return new Map([...origines].map(([id, o]) => [id, o.date]));
}
async function originesDesReports(client, tenantId, debutExercice, reports) {
    const origines = new Map();
    const introuvables = [];
    let enCours = reports.map((r) => ({ depart: r.id, ligne: r }));
    let borne = debutExercice;
    for (let niveau = 0; niveau < exports.PROFONDEUR_MAX && enCours.length; niveau++) {
        const precedent = await client.exercice.findFirst({
            where: { tenantId, dateFin: { lt: borne } },
            orderBy: { dateFin: 'desc' },
            select: { id: true, dateDebut: true },
        });
        if (!precedent) {
            for (const e of enCours)
                origines.set(e.depart, { date: e.ligne.date, id: e.ligne.id });
            break;
        }
        const comptes = [...new Set(enCours.map((e) => e.ligne.compteId))];
        const numeros = new Map(enCours.map((e) => [e.ligne.compteId, e.ligne.numeroCompte]));
        const candidates = [];
        await (0, lecture_par_lots_1.lireParLots)((curseur) => client.ligneEcriture.findMany({
            ...(0, lecture_par_lots_1.pageApres)(curseur, 500),
            where: {
                ...(0, lignes_reportees_au_detail_1.lignesReporteesAuDetail)({ tenantId, exerciceId: precedent.id }),
                compteId: { in: comptes },
            },
            select: {
                id: true,
                compteId: true,
                debit: true,
                credit: true,
                libelle: true,
                dateEcheance: true,
                ecriture: { select: { date: true, libelle: true, statut: true, estGenereeParCloture: true, estANouveauProvisoire: true } },
            },
        }), (l) => candidates.push({
            id: l.id,
            compteId: l.compteId,
            numeroCompte: numeros.get(l.compteId) ?? '',
            debit: Number(l.debit),
            credit: Number(l.credit),
            libelle: l.libelle ?? l.ecriture.libelle ?? null,
            dateEcheance: l.dateEcheance ?? null,
            date: l.ecriture.date,
            estReport: l.ecriture.estGenereeParCloture === true || l.ecriture.estANouveauProvisoire === true,
            provisoire: l.ecriture.estANouveauProvisoire === true,
            validee: l.ecriture.statut === client_1.StatutEcriture.VALIDEE,
        }));
        const trouvees = new Map([
            ...apparierAuxOrigines(enCours.filter((e) => e.ligne.provisoire === true).map((e) => e.ligne), candidates.filter((c) => c.validee)),
            ...apparierAuxOrigines(enCours.filter((e) => e.ligne.provisoire !== true).map((e) => e.ligne), candidates),
        ]);
        const suivants = [];
        for (const e of enCours) {
            const o = trouvees.get(e.ligne.id);
            if (!o) {
                introuvables.push(e.depart);
                continue;
            }
            if (o.estReport)
                suivants.push({ depart: e.depart, ligne: o });
            else
                origines.set(e.depart, { date: o.date, id: o.id });
        }
        enCours = suivants;
        borne = precedent.dateDebut;
    }
    return { origines, introuvables };
}
//# sourceMappingURL=date-origine-des-reports.js.map