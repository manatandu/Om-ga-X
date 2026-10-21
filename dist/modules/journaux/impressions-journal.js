"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PLAFOND_MOIS_NOMMES = exports.MOTIF_RECHERCHE_NON_IMPRIMABLE = void 0;
exports.estUneRecherche = estUneRecherche;
exports.jourCouvert = jourCouvert;
exports.joursNonImprimes = joursNonImprimes;
exports.moisNonImprimes = moisNonImprimes;
exports.motifClotureNonImprimee = motifClotureNonImprimee;
exports.periodeCouverte = periodeCouverte;
exports.enregistrerImpression = enregistrerImpression;
exports.enregistrerImpressionDans = enregistrerImpressionDans;
exports.rattacherLesImpressions = rattacherLesImpressions;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const transaction_journalisee_1 = require("../../common/audit/transaction-journalisee");
const jour = (d) => d.toISOString().slice(0, 10);
const debutDuJour = (d) => new Date(`${jour(d)}T00:00:00.000Z`).getTime();
function estUneRecherche(criteres) {
    return (!!criteres.recherche?.trim() ||
        !!criteres.compte?.trim() ||
        criteres.montantMin !== undefined ||
        criteres.montantMax !== undefined ||
        criteres.numeroPiece !== undefined ||
        !!criteres.reference?.trim());
}
exports.MOTIF_RECHERCHE_NON_IMPRIMABLE = "Une recherche (compte, montant, libellé, pièce ou référence) n'est pas le journal · retirez les critères pour imprimer le journal de la période.";
function jourCouvert(j, impressions) {
    if (!j.derniereValidation)
        return true;
    const t = debutDuJour(j.date);
    return impressions.some((i) => (i.journalId === null || i.journalId === j.journalId) &&
        debutDuJour(i.dateDebut) <= t &&
        t <= debutDuJour(i.dateFin) &&
        i.imprimeAt.getTime() >= j.derniereValidation.getTime());
}
function joursNonImprimes(jours, impressions) {
    return jours.filter((j) => !jourCouvert(j, impressions));
}
exports.PLAFOND_MOIS_NOMMES = 24;
async function moisNonImprimes(prisma, p) {
    const [jours, impressions] = await Promise.all([
        prisma.ecriture.groupBy({
            by: ['journalId', 'date'],
            where: {
                tenantId: p.tenantId,
                exerciceId: p.exerciceId,
                statut: client_1.StatutEcriture.VALIDEE,
                date: { lte: p.jusquau },
                journal: { type: { not: client_1.TypeJournal.SITUATION } },
                ...(p.journalId ? { journalId: p.journalId } : {}),
            },
            _max: { valideeAt: true },
        }),
        prisma.impressionJournal.findMany({
            where: { tenantId: p.tenantId, exerciceId: p.exerciceId },
            select: { journalId: true, dateDebut: true, dateFin: true, imprimeAt: true },
        }),
    ]);
    const manquants = joursNonImprimes(jours.map((g) => ({ journalId: g.journalId, date: g.date, derniereValidation: g._max.valideeAt ?? g.date })), impressions);
    if (manquants.length === 0)
        return { mois: [], total: 0 };
    const journaux = await prisma.journal.findMany({
        where: { tenantId: p.tenantId, id: { in: [...new Set(manquants.map((m) => m.journalId))] } },
        select: { id: true, code: true },
    });
    const code = new Map(journaux.map((j) => [j.id, j.code]));
    const cles = new Map();
    for (const m of manquants) {
        const mois = jour(m.date).slice(0, 7);
        const journal = code.get(m.journalId) ?? '·';
        cles.set(`${journal}|${mois}`, { journal, mois });
    }
    const tous = [...cles.values()].sort((a, b) => a.mois.localeCompare(b.mois) || a.journal.localeCompare(b.journal));
    return { mois: tous.slice(0, exports.PLAFOND_MOIS_NOMMES), total: tous.length };
}
function motifClotureNonImprimee(r) {
    const nommes = r.mois.map((m) => `${m.journal} ${m.mois.split('-').reverse().join('/')}`).join(', ');
    const reste = r.total > r.mois.length ? ` et ${r.total - r.mois.length} autre(s)` : '';
    return (`Le dossier refuse de clôturer un journal non imprimé (Paramètres du dossier) · des écritures validées ne figurent ` +
        `sur aucune impression faite après leur validation : ${nommes}${reste}. Imprimez ou exportez le journal de la ` +
        "période (État > Livres comptables > Journal), puis relancez la clôture. Les données doivent pouvoir être " +
        'restituées sur papier (AUDCIF art. 22, 1°).');
}
function periodeCouverte(exercice, p) {
    const debut = p.dateDebut ? new Date(p.dateDebut) : exercice.dateDebut;
    const fin = p.dateFin ? new Date(p.dateFin) : exercice.dateFin;
    if (Number.isNaN(debut.getTime()) || Number.isNaN(fin.getTime())) {
        throw new common_1.BadRequestException('La période imprimée est illisible.');
    }
    if (debut.getTime() > fin.getTime())
        throw new common_1.BadRequestException('La période imprimée finit avant de commencer.');
    return {
        dateDebut: debut.getTime() < exercice.dateDebut.getTime() ? exercice.dateDebut : debut,
        dateFin: fin.getTime() > exercice.dateFin.getTime() ? exercice.dateFin : fin,
    };
}
async function enregistrerImpression(prisma, p) {
    return (0, transaction_journalisee_1.transactionJournalisee)(prisma, (tx) => enregistrerImpressionDans(tx, p));
}
async function enregistrerImpressionDans(tx, p) {
    await tx.$executeRaw `SELECT pg_advisory_xact_lock(hashtext(${`impressions-journal:${p.tenantId}`}))`;
    const max = await tx.impressionJournal.aggregate({ where: { tenantId: p.tenantId }, _max: { numero: true } });
    return tx.impressionJournal.create({
        data: {
            tenantId: p.tenantId,
            numero: (max._max.numero ?? 0) + 1,
            exerciceId: p.exerciceId,
            journalId: p.journalId,
            dateDebut: p.dateDebut,
            dateFin: p.dateFin,
            forme: p.forme,
            nombreEcritures: p.nombreEcritures,
            imprimePar: p.imprimePar,
            ...(p.imprimeAt ? { imprimeAt: p.imprimeAt } : {}),
        },
    });
}
const LOT_IMPRESSIONS_RATTACHEES = 500;
async function rattacherLesImpressions(tx, tenantId, depuis, vers) {
    let rattachees = 0;
    let curseur;
    for (;;) {
        const lot = await tx.impressionJournal.findMany({
            where: { tenantId, exerciceId: depuis },
            select: { id: true },
            orderBy: { id: 'asc' },
            take: LOT_IMPRESSIONS_RATTACHEES,
            ...(curseur ? { cursor: { id: curseur }, skip: 1 } : {}),
        });
        for (const i of lot) {
            await tx.impressionJournal.update({ where: { id: i.id }, data: { exerciceId: vers } });
            rattachees++;
        }
        if (lot.length < LOT_IMPRESSIONS_RATTACHEES)
            return rattachees;
        curseur = lot[lot.length - 1].id;
    }
}
//# sourceMappingURL=impressions-journal.js.map