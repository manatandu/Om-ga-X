"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ecartReconstitue = ecartReconstitue;
exports.ecartsParDevise = ecartsParDevise;
exports.motifDejaReevalue = motifDejaReevalue;
exports.issueReevaluationDejaPassee = issueReevaluationDejaPassee;
exports.motifReglementDejaReevalue = motifReglementDejaReevalue;
exports.avertissementExtourneManquante = avertissementExtourneManquante;
const perimetre_reevaluation_1 = require("../devises/perimetre-reevaluation");
const jour = (d) => d.toISOString().slice(0, 10);
const centimes = (x) => Math.round(x * 100) / 100;
function ecartReconstitue(lignes, denoues, cours, inclus) {
    let total = 0;
    for (const e of ecartsParDevise(lignes, denoues, cours, inclus).values())
        total += e.ecart;
    return centimes(total);
}
function ecartsParDevise(lignes, denoues, cours, inclus) {
    const retenues = lignes.filter((l) => !l.lettrageId || l.lettrageId === inclus || !denoues.has(l.lettrageId));
    const parDevise = new Map();
    for (const deviseId of new Set(retenues.map((l) => l.deviseId))) {
        const p = (0, perimetre_reevaluation_1.positionDesLignes)(retenues.filter((l) => l.deviseId === deviseId));
        const c = cours.get(deviseId) ?? null;
        const ecart = Math.abs(p.montantDevise) < 0.005 || c === null ? 0 : centimes(centimes(p.montantDevise * c) - p.valeurComptable);
        parDevise.set(deviseId, { montantDevise: p.montantDevise, ecart });
    }
    return parDevise;
}
async function lireLaReevaluation(prisma, p) {
    const reeval = await prisma.reevaluation.findFirst({
        where: { tenantId: p.tenantId, exerciceId: p.exerciceId, annuleeLe: null },
        select: {
            dateReevaluation: true,
            createdAt: true,
            coursUtilises: true,
            ecritureEcarts: { select: { lignes: { where: { compteId: p.compteId }, select: { debit: true, credit: true } } } },
        },
    });
    if (!reeval || !reeval.ecritureEcarts || reeval.ecritureEcarts.lignes.length === 0)
        return null;
    const retenus = (reeval.coursUtilises ?? null);
    const passe = centimes(reeval.ecritureEcarts.lignes.reduce((s, l) => s + Number(l.debit) - Number(l.credit), 0));
    const exercice = await prisma.exercice.findFirst({ where: { id: p.exerciceId, tenantId: p.tenantId }, select: { dateDebut: true } });
    const telQuIlEtait = {
        tenantId: p.tenantId,
        exerciceId: p.exerciceId,
        date: { lte: reeval.dateReevaluation },
        OR: [
            { createdAt: { lte: reeval.createdAt } },
            ...(exercice
                ? [
                    {
                        date: exercice.dateDebut,
                        OR: [{ estANouveauProvisoire: true }, { estGenereeParCloture: true, estSoldeDesComptesDeGestion: false }],
                    },
                ]
                : []),
        ],
    };
    const groupeDAlors = (l) => l.lettrageId && (l.lettrageId === p.cible || (l.lettrage && l.lettrage.createdAt <= reeval.createdAt)) ? l.lettrageId : null;
    const lignes = (await prisma.ligneEcriture.findMany({
        where: {
            compteId: p.compteId,
            deviseId: { not: null },
            ecriture: telQuIlEtait,
            OR: [
                { lettre: null },
                { lettrage: { soldeAt: { gt: reeval.createdAt } } },
                {
                    lettrage: {
                        lignes: {
                            some: {
                                ecriture: { tenantId: p.tenantId, OR: [{ exerciceId: { not: p.exerciceId } }, { date: { gt: reeval.dateReevaluation } }] },
                            },
                        },
                    },
                },
            ],
        },
        select: {
            id: true,
            deviseId: true,
            debit: true,
            credit: true,
            montantDevise: true,
            lettrageId: true,
            lettrage: { select: { createdAt: true } },
        },
    })).map((l) => ({
        id: l.id,
        deviseId: l.deviseId,
        debit: Number(l.debit),
        credit: Number(l.credit),
        montantDevise: l.montantDevise === null ? null : Number(l.montantDevise),
        lettrageId: groupeDAlors(l),
    }));
    const ids = [...new Set(lignes.flatMap((l) => (l.lettrageId ? [l.lettrageId] : [])))];
    const lignesDesGroupes = ids.length
        ? (await prisma.ligneEcriture.findMany({
            where: {
                lettrageId: { in: ids },
                ecriture: {
                    tenantId: p.tenantId,
                    OR: [
                        { createdAt: { lte: reeval.createdAt } },
                        ...(exercice
                            ? [
                                {
                                    exerciceId: p.exerciceId,
                                    date: exercice.dateDebut,
                                    OR: [{ estANouveauProvisoire: true }, { estGenereeParCloture: true, estSoldeDesComptesDeGestion: false }],
                                },
                            ]
                            : []),
                    ],
                },
            },
            select: {
                id: true,
                lettrageId: true,
                compteId: true,
                debit: true,
                credit: true,
                deviseId: true,
                montantDevise: true,
                ecriture: { select: { exerciceId: true, date: true } },
            },
        })).map((l) => ({
            id: l.id,
            lettrageId: l.lettrageId,
            code: '',
            compteId: l.compteId,
            compte: null,
            debit: Number(l.debit),
            credit: Number(l.credit),
            deviseId: l.deviseId,
            devise: l.deviseId === null ? null : { id: l.deviseId, code: '' },
            montantDevise: l.montantDevise === null ? null : Number(l.montantDevise),
            ecriture: l.ecriture,
        }))
        : [];
    const lecture = (0, perimetre_reevaluation_1.lectureDesGroupes)(lignesDesGroupes, { exerciceId: p.exerciceId, date: reeval.dateReevaluation });
    const denoues = new Set((0, perimetre_reevaluation_1.groupesDenoues)(lignesDesGroupes.filter((l) => !lecture.aCheval.has(l.lettrageId))).keys());
    for (const l of lecture.lignesEnFrancs) {
        const devise = lecture.deviseDuGroupe.get(l.lettrageId);
        if (!devise || l.compteId !== p.compteId)
            continue;
        lignes.push({ id: l.id, deviseId: devise.id, debit: l.debit, credit: l.credit, montantDevise: null, lettrageId: l.lettrageId });
    }
    for (const [id, d] of lecture.denouesACheval) {
        const devise = lecture.deviseDuGroupe.get(id);
        if (!devise || !lignesDesGroupes.some((x) => x.lettrageId === id && x.compteId === p.compteId))
            continue;
        lignes.push({ deviseId: devise.id, debit: Math.max(0, -d.ecart), credit: Math.max(0, d.ecart), montantDevise: null, lettrageId: null });
    }
    const cours = new Map();
    const coursCorriges = [];
    for (const deviseId of new Set(lignes.map((l) => l.deviseId))) {
        const cote = await prisma.coursDevise.findFirst({
            where: { deviseId, date: { lte: reeval.dateReevaluation } },
            orderBy: { date: 'desc' },
            select: { cours: true },
        });
        const aujourdhui = cote ? Number(cote.cours) : null;
        const retenu = retenus && typeof retenus[deviseId] === 'number' ? retenus[deviseId] : null;
        cours.set(deviseId, retenu ?? aujourdhui);
        if (retenu !== null && (aujourdhui === null || Math.abs(aujourdhui - retenu) > 1e-9))
            coursCorriges.push({ deviseId, retenu, aujourdhui });
    }
    return {
        date: reeval.dateReevaluation,
        creeeLe: reeval.createdAt,
        passe,
        lignes,
        denoues,
        denouesACheval: new Set(lecture.denouesACheval.keys()),
        cours,
        coursCorriges,
    };
}
function motifCoursCorrige(lu, compteNumero) {
    const cours = lu.coursCorriges
        .map((c) => `${c.retenu} retenu, ${c.aujourdhui === null ? 'aucun' : c.aujourdhui} coté aujourd’hui`)
        .join(' ; ');
    return (`Le cours applicable au ${jour(lu.date)} a été posé ou corrigé depuis la réévaluation des devises du ${jour(lu.date)} (${cours}) · elle est une erreur ` +
        `de l'exercice en cours, et le ${compteNumero} en porte l'écart. Issue · annulez cette réévaluation (Devises, « Annuler la ` +
        'réévaluation », AUDCIF art. 20, al. 2), réévaluez au cours exact (art. 54), puis passez l’écart réalisé.');
}
function motifDejaReevalue(p) {
    return (`La réévaluation des devises du ${jour(p.date)}, passée le ${jour(p.creeeLe)}, a lu ${p.objet} du ${p.compteNumero} et ` +
        'porté son écart au 478 ou au 479, avec sa provision pour pertes de change · passer maintenant le réalisé au 656 ou au 676 ' +
        'compterait la perte deux fois (AUDCIF art. 54 et 55). Rien n’est passé. Issue · annulez cette réévaluation (Devises, ' +
        '« Annuler la réévaluation », motif exigé · AUDCIF art. 20, al. 2), passez l’écart réalisé, puis réévaluez l’exercice.');
}
async function issueReevaluationDejaPassee(prisma, p) {
    const lu = await lireLaReevaluation(prisma, { ...p, cible: p.lettrageId });
    if (!lu)
        return null;
    const devisesDuGroupe = new Set(lu.lignes.filter((l) => l.lettrageId === p.lettrageId).map((l) => l.deviseId));
    const corriges = lu.coursCorriges.filter((c) => devisesDuGroupe.has(c.deviseId));
    if (corriges.length > 0)
        return { refus: motifCoursCorrige({ date: lu.date, coursCorriges: corriges }, p.compteNumero) };
    if (lu.denouesACheval.has(p.lettrageId))
        return null;
    const tolerance = 0.01 * Math.max(1, lu.cours.size);
    const avecCible = new Set([...lu.denoues, p.lettrageId]);
    const sansLeGroupe = ecartReconstitue(lu.lignes, avecCible, lu.cours, null);
    if (Math.abs(sansLeGroupe - lu.passe) <= tolerance)
        return null;
    const avecLeGroupe = ecartReconstitue(lu.lignes, lu.denoues, lu.cours, p.lettrageId);
    if (Math.abs(avecLeGroupe - lu.passe) <= tolerance) {
        const devisesDuGroupe = new Set(lu.lignes.filter((l) => l.lettrageId === p.lettrageId).map((l) => l.deviseId));
        const parDevise = ecartsParDevise(lu.lignes, lu.denoues, lu.cours, p.lettrageId);
        const porte = [...devisesDuGroupe].some((d) => {
            const e = parDevise.get(d);
            return e !== undefined && Math.abs(e.montantDevise) >= 0.005 && Math.abs(e.ecart) >= 0.005;
        });
        if (!porte)
            return null;
        return { refus: motifDejaReevalue({ date: lu.date, creeeLe: lu.creeeLe, compteNumero: p.compteNumero, objet: 'ce dénouement' }) };
    }
    return {
        avertissement: `Des lettrages ou des écritures ont changé depuis la réévaluation des devises du ${jour(lu.date)} sur le ${p.compteNumero} · ` +
            `elle y a passé ${lu.passe.toFixed(2)}, que le compte d'aujourd'hui ne reconstitue ni avec ni sans ce lettrage. ` +
            "L'écart est passé ; vérifiez les lignes de cette réévaluation sur le compte.",
    };
}
async function motifReglementDejaReevalue(prisma, p) {
    const lu = await lireLaReevaluation(prisma, { tenantId: p.tenantId, exerciceId: p.exerciceId, compteId: p.compteId, cible: null });
    if (!lu)
        return null;
    const reevaluees = ecartsParDevise(lu.lignes, lu.denoues, lu.cours, null);
    const lues = lu.lignes.filter((l) => {
        const e = reevaluees.get(l.deviseId);
        return l.id && p.ligneIds.includes(l.id) && e !== undefined && Math.abs(e.montantDevise) >= 0.005 && Math.abs(e.ecart) >= 0.005;
    });
    if (lues.length === 0)
        return null;
    return motifDejaReevalue({
        date: lu.date,
        creeeLe: lu.creeeLe,
        compteNumero: p.compteNumero,
        objet: lues.length > 1 ? `${lues.length} des factures choisies` : 'une facture choisie',
    });
}
async function avertissementExtourneManquante(prisma, p) {
    const exercice = await prisma.exercice.findFirst({ where: { id: p.exerciceId, tenantId: p.tenantId }, select: { dateDebut: true } });
    if (!exercice)
        return null;
    const enPlace = await prisma.reevaluation.findMany({
        where: {
            tenantId: p.tenantId,
            annuleeLe: null,
            ecritureExtourneId: null,
            contrePassationDeclareeId: null,
            exercice: { dateFin: { lt: exercice.dateDebut } },
        },
        select: { exerciceId: true },
        orderBy: { dateReevaluation: 'asc' },
        take: 50,
    });
    if (enPlace.length === 0)
        return null;
    const ouverture = await prisma.ligneEcriture.findMany({
        where: {
            id: { in: p.ligneIds },
            deviseId: { not: null },
            ecriture: {
                tenantId: p.tenantId,
                exerciceId: p.exerciceId,
                date: exercice.dateDebut,
                OR: [{ estANouveauProvisoire: true }, { estGenereeParCloture: true, estSoldeDesComptesDeGestion: false }],
            },
        },
        select: { deviseId: true },
    });
    if (ouverture.length === 0)
        return null;
    const dates = [];
    for (const r of enPlace) {
        const lu = await lireLaReevaluation(prisma, { tenantId: p.tenantId, exerciceId: r.exerciceId, compteId: p.compteId, cible: null });
        if (!lu)
            continue;
        const parDevise = ecartsParDevise(lu.lignes, lu.denoues, lu.cours, null);
        const portee = ouverture.some((l) => {
            const e = l.deviseId ? parDevise.get(l.deviseId) : undefined;
            return e !== undefined && Math.abs(e.montantDevise) >= 0.005 && Math.abs(e.ecart) >= 0.005;
        });
        if (portee)
            dates.push(lu.date);
    }
    if (dates.length === 0)
        return null;
    const quelles = dates.length === 1
        ? `la réévaluation des devises du ${jour(dates[0])} n'a pas été contre-passée`
        : `les réévaluations des devises du ${dates.map(jour).join(', du ')} n'ont pas été contre-passées`;
    return (`${p.compteNumero} · ${quelles} · l'écart de conversion (478 ou 479) de cette devise reste en place pendant que le réalisé est passé. ` +
        "Passez la contre-passation (Devises) · elle ne touche que le 478 et le 479 ; la provision pour pertes de change, elle, s'ajuste à la " +
        "réévaluation de l'exercice en cours (AUDCIF, Titre VIII ch. 22 § 2.3).");
}
//# sourceMappingURL=reevaluation-et-ecart-realise.js.map