"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ecartsRealisesNonConstates = ecartsRealisesNonConstates;
exports.motifClotureEcartsNonConstates = motifClotureEcartsNonConstates;
const lecture_par_lots_1 = require("../../common/lecture-par-lots");
async function ecartsRealisesNonConstates(prisma, p) {
    const cumuls = new Map();
    await (0, lecture_par_lots_1.lireParLots)((curseur) => prisma.ligneEcriture.findMany({
        where: {
            lettrageId: { not: null },
            lettre: null,
            lettrage: { statut: 'PARTIEL', lignes: { some: { ecriture: { tenantId: p.tenantId, exerciceId: p.exerciceId } } } },
            ecriture: { tenantId: p.tenantId },
        },
        select: {
            id: true,
            lettrageId: true,
            debit: true,
            credit: true,
            deviseId: true,
            montantDevise: true,
            ecriture: { select: { date: true, exerciceId: true } },
            lettrage: { select: { code: true, compte: { select: { numero: true } } } },
        },
        ...(0, lecture_par_lots_1.pageApres)(curseur, lecture_par_lots_1.LOT_LECTURE),
    }), (l) => {
        const id = l.lettrageId;
        const c = cumuls.get(id) ??
            {
                code: l.lettrage?.code ?? '',
                compteNumero: l.lettrage?.compte.numero ?? '?',
                devises: new Set(),
                soldeDevise: 0,
                centimes: 0,
                derniere: null,
                aCheval: false,
            };
        const debit = Number(l.debit);
        const credit = Number(l.credit);
        if (l.deviseId !== null && l.montantDevise !== null) {
            c.devises.add(l.deviseId);
            c.soldeDevise += (debit - credit >= 0 ? 1 : -1) * Number(l.montantDevise);
        }
        c.centimes += Math.round(debit * 100) - Math.round(credit * 100);
        if (l.ecriture.exerciceId !== p.exerciceId)
            c.aCheval = true;
        if (!c.derniere || l.ecriture.date > c.derniere.date)
            c.derniere = { date: l.ecriture.date, exerciceId: l.ecriture.exerciceId };
        cumuls.set(id, c);
    });
    const ecarts = [...cumuls.entries()]
        .filter(([, c]) => c.devises.size === 1 &&
        Math.abs(c.soldeDevise) <= 0.005 &&
        c.centimes !== 0 &&
        c.derniere !== null &&
        c.derniere.exerciceId === p.exerciceId)
        .map(([lettrageId, c]) => ({
        lettrageId,
        code: c.code.toLowerCase(),
        compteNumero: c.compteNumero,
        ecart: c.centimes / 100,
        aCheval: c.aCheval,
        denouement: c.derniere.date,
    }))
        .sort((a, b) => a.compteNumero.localeCompare(b.compteNumero) || a.code.localeCompare(b.code));
    return { ecarts };
}
function motifClotureEcartsNonConstates(r) {
    if (r.ecarts.length === 0)
        return null;
    const montant = (x) => Math.abs(x).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace(/ | /g, ' ');
    const liste = r.ecarts
        .slice(0, 10)
        .map((e) => `${e.compteNumero} lettrage ${e.code} · ${e.ecart > 0 ? 'perte' : 'gain'} de ${montant(e.ecart)}` +
        (e.aCheval ? `, à cheval de deux exercices, dénoué le ${e.denouement ? e.denouement.toISOString().slice(0, 10) : '?'}` : ''))
        .join(' ; ');
    const reste = r.ecarts.length > 10 ? `, et ${r.ecarts.length - 10} autre(s)` : '';
    return (`${r.ecarts.length} lettrage(s) dénoué(s) dans leur devise portent un écart de change réalisé non constaté au lettrage · ${liste}${reste}. ` +
        "AUDCIF art. 55 · « à la date de règlement [...] les pertes et gains de change à cette date sont constatés ». " +
        'Pour chacun, UNE seule issue · passez l’écart proposé depuis Interrogation et lettrage (« Écart de change ») ; ' +
        's’il a DÉJÀ été passé à la main, lettrez sa ligne du tiers dans ce groupe, sans le repasser ; si le geste est refusé ' +
        '(réévaluation qui a lu le groupe, cours corrigé), suivez le motif du refus : annulez la réévaluation, passez l\'écart, ' +
        'puis réévaluez. Ne délettrez pas le groupe, sans quoi l\'écart ne serait plus constaté. Puis clôturez.' +
        (r.ecarts.some((e) => e.aCheval)
            ? ' Un lettrage à cheval de deux exercices reçoit son écart même figé par la clôture de l\'exercice précédent · ' +
                'si le dénouement tombe dans une période close, cochez le report au premier jour non clôturé, sa date de valeur gardée (AUDCIF art. 22, 4°).'
            : ''));
}
//# sourceMappingURL=ecarts-non-constates.js.map