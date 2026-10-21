"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PLAFOND_LETTRAGES_A_CHEVAL = void 0;
exports.motifLettrageADeuxExercices = motifLettrageADeuxExercices;
exports.lettragesACheval = lettragesACheval;
exports.nommerLettrageACheval = nommerLettrageACheval;
exports.issueLettrageACheval = issueLettrageACheval;
exports.issueEcartACheval = issueEcartACheval;
const lecture_par_lots_1 = require("../../common/lecture-par-lots");
const gel_cloture_1 = require("../exercice/gel-cloture");
const ecart_change_realise_1 = require("../reglements/ecart-change-realise");
const jour = (d) => d.toISOString().slice(0, 10);
function motifLettrageADeuxExercices(lignes, compte) {
    if (compte.modeReportANouveau !== 'DETAIL')
        return null;
    const premiereParExercice = new Map();
    for (const l of lignes) {
        const vue = premiereParExercice.get(l.ecriture.exerciceId);
        if (!vue || l.ecriture.date < vue)
            premiereParExercice.set(l.ecriture.exerciceId, l.ecriture.date);
    }
    if (premiereParExercice.size <= 1)
        return null;
    const dates = [...premiereParExercice.values()].sort((a, b) => a.getTime() - b.getTime()).map(jour);
    return (`Le compte ${compte.numero} est reporté en mode Détail, et ces lignes appartiennent à ${premiereParExercice.size} exercices ` +
        `(lignes du ${dates.join(', du ')}) · la facture d'un exercice antérieur passe dans l'exercice suivant par la ligne d'à-nouveau ` +
        "qui la reporte, et c'est cette ligne qui se lettre avec le règlement. Lettrez le règlement contre la ligne d'à-nouveau DÉFINITIF " +
        "une fois l'exercice antérieur clôturé ; tant qu'il ne l'est pas, attendez sa clôture (un lettrage posé sur l'à-nouveau provisoire " +
        "empêcherait de le remplacer à la clôture).");
}
exports.PLAFOND_LETTRAGES_A_CHEVAL = 200;
async function lettragesACheval(prisma, p) {
    const [lus, clotures] = await Promise.all([
        prisma.lettrage.findMany({
            where: {
                tenantId: p.tenantId,
                AND: [
                    { lignes: { some: { ecriture: { tenantId: p.tenantId, exerciceId: p.exerciceId } } } },
                    { lignes: { some: { ecriture: { tenantId: p.tenantId, exerciceId: { not: p.exerciceId } } } } },
                ],
            },
            select: { id: true, code: true, statut: true, compte: { select: { numero: true, modeReportANouveau: true } } },
            orderBy: { id: 'asc' },
            take: exports.PLAFOND_LETTRAGES_A_CHEVAL + 1,
        }),
        prisma.cloture.findMany({
            where: { tenantId: p.tenantId, annuleeAt: null, granularite: { not: 'PARTIELLE' } },
            select: { granularite: true, journalId: true, dateLimite: true },
        }),
    ]);
    const retenus = lus.slice(0, exports.PLAFOND_LETTRAGES_A_CHEVAL);
    const resultat = { groupes: [], tronque: lus.length > exports.PLAFOND_LETTRAGES_A_CHEVAL };
    if (retenus.length === 0)
        return resultat;
    const cumuls = new Map();
    for (const g of retenus) {
        cumuls.set(g.id, { autres: new Map(), fige: false, centimes: 0, devises: new Set(), soldeDevise: 0, enDevise: 0, derniere: null });
    }
    await (0, lecture_par_lots_1.lireParLots)((curseur) => prisma.ligneEcriture.findMany({
        where: { lettrageId: { in: retenus.map((g) => g.id) }, ecriture: { tenantId: p.tenantId } },
        select: {
            id: true,
            lettrageId: true,
            debit: true,
            credit: true,
            deviseId: true,
            montantDevise: true,
            ecriture: {
                select: {
                    date: true,
                    journalId: true,
                    journal: { select: { code: true } },
                    exerciceId: true,
                    exercice: { select: { statut: true, dateDebut: true, dateFin: true } },
                },
            },
        },
        ...(0, lecture_par_lots_1.pageApres)(curseur, lecture_par_lots_1.LOT_LECTURE),
    }), (l) => {
        const c = l.lettrageId ? cumuls.get(l.lettrageId) : undefined;
        if (!c)
            return;
        const debit = Number(l.debit);
        const credit = Number(l.credit);
        const clos = l.ecriture.exercice.statut === 'CLOTURE';
        if (l.ecriture.exerciceId !== p.exerciceId) {
            c.autres.set(l.ecriture.exerciceId, { dateDebut: l.ecriture.exercice.dateDebut, dateFin: l.ecriture.exercice.dateFin, clos });
        }
        if (!c.fige &&
            (0, gel_cloture_1.motifLigneFigee)({ journalId: l.ecriture.journalId, journalCode: l.ecriture.journal.code, date: l.ecriture.date, exerciceClos: clos }, clotures)) {
            c.fige = true;
        }
        c.centimes += Math.round(debit * 100) - Math.round(credit * 100);
        if (l.deviseId !== null && l.montantDevise !== null) {
            c.devises.add(l.deviseId);
            c.enDevise += 1;
            c.soldeDevise += (debit - credit >= 0 ? 1 : -1) * Number(l.montantDevise);
        }
        if (!c.derniere || l.ecriture.date > c.derniere.date)
            c.derniere = { date: l.ecriture.date, exerciceId: l.ecriture.exerciceId };
    });
    resultat.groupes = retenus
        .map((g) => {
        const c = cumuls.get(g.id);
        const statut = g.statut === 'SOLDE' ? 'SOLDE' : 'PARTIEL';
        const soldeEnDevise = c.enDevise > 0 && c.devises.size === 1 && Math.abs(c.soldeDevise) <= 0.005;
        const denoueIci = c.derniere !== null && c.derniere.exerciceId === p.exerciceId;
        return {
            lettrageId: g.id,
            code: statut === 'SOLDE' ? g.code : g.code.toLowerCase(),
            statut,
            compteNumero: g.compte.numero,
            auDetail: g.compte.modeReportANouveau === 'DETAIL',
            autresExercices: [...c.autres.values()].sort((a, b) => a.dateDebut.getTime() - b.dateDebut.getTime()),
            fige: c.fige,
            ecartNonPasse: statut === 'PARTIEL' && soldeEnDevise && denoueIci && c.centimes !== 0 ? c.centimes / 100 : null,
            denouement: c.derniere?.date ?? new Date(0),
        };
    })
        .sort((a, b) => a.compteNumero.localeCompare(b.compteNumero) || a.code.localeCompare(b.code));
    return resultat;
}
const periode = (e) => `${jour(e.dateDebut)} au ${jour(e.dateFin)}`;
function nommerLettrageACheval(g) {
    return `${g.compteNumero} lettrage ${g.code} (${g.statut === 'SOLDE' ? 'soldé' : 'partiel'}, avec l'exercice du ${g.autresExercices.map(periode).join(' et du ')})`;
}
function issueLettrageACheval(g) {
    const lecturesOuvertes = g.statut === 'SOLDE'
        ? " La balance âgée et les notes par échéance de l'exercice suivant la lisent encore ouverte · justifiez-la par ce groupe au dossier de travail."
        : '';
    return (`${nommerLettrageACheval(g)} · rien à défaire, et il ne se délettre pas (un groupe soldé dans sa devise rouvrirait ses lignes, ` +
        "et la réévaluation porterait le réalisé au 478 ou au 479). Dans l'exercice suivant, la ligne d'à-nouveau qui reporte sa facture " +
        "se lit réglée par ce groupe au règlement des tiers, aux relances et à la réévaluation · ne la lettrez avec aucun autre règlement." +
        lecturesOuvertes);
}
function issueEcartACheval(g, referentiel) {
    const ecart = g.ecartNonPasse ?? 0;
    const sens = ecart > 0 ? 'perte' : 'gain';
    const prescrits = (0, ecart_change_realise_1.comptesPrescrits)(referentiel, (0, ecart_change_realise_1.natureDuCompte)(g.compteNumero, referentiel));
    const compte = prescrits.perte === null
        ? 'au compte de change que le cabinet choisit (la nature du compte, commerciale ou financière, ne se lit pas sur son numéro)'
        : `au ${sens === 'perte' ? prescrits.perte : prescrits.gain}`;
    const montant = `${sens} de change réalisée de ${Math.abs(ecart).toFixed(2)}`;
    const fige = g.fige
        ? ` Figé, le groupe la reçoit quand même · si le dénouement du ${jour(g.denouement)} tombe dans une période close, cochez le report ` +
            'au premier jour non clôturé, sa date de valeur gardée (AUDCIF art. 22, 4°).'
        : '';
    return (`${nommerLettrageACheval(g)} · ${montant} non passée · passez l'écart proposé sur le groupe ${compte} ` +
        `(Interrogation et lettrage, « Écart de change »), jamais par une écriture hors du groupe, que la réévaluation recompterait.${fige}`);
}
//# sourceMappingURL=lettrages-a-cheval.js.map