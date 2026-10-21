"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.salaireDeLaSaisie = salaireDeLaSaisie;
exports.moisTouches = moisTouches;
exports.confronterSalaireAuxConges = confronterSalaireAuxConges;
exports.confronterLesBulletinsEmis = confronterLesBulletinsEmis;
exports.bulletinsQuiRetranchentLeConge = bulletinsQuiRetranchentLeConge;
const client_1 = require("@prisma/client");
const absences_1 = require("./absences");
const absences_lecture_1 = require("./absences-lecture");
function salaireDeLaSaisie(entree) {
    if (!entree || typeof entree !== 'object')
        return null;
    const e = entree;
    const devise = e.deviseStipulation === 'USD' ? 'USD' : e.deviseStipulation === undefined || e.deviseStipulation === null || e.deviseStipulation === 'CDF' ? 'CDF' : null;
    if (!devise || !Array.isArray(e.elements))
        return null;
    let salaire = 0;
    for (const x of e.elements) {
        if (!x || typeof x !== 'object')
            return null;
        const el = x;
        if (el.nature !== 'SALAIRE_OU_TRAITEMENT')
            continue;
        const brut = devise === 'USD' ? el.montantUsd : el.montantFc;
        const n = brut === undefined || brut === null ? 0 : Number(brut);
        if (!Number.isFinite(n))
            return null;
        salaire += n;
    }
    return { salaire, devise };
}
function moisTouches(du, au) {
    const [a1, m1] = du.slice(0, 7).split('-').map(Number);
    const [a2, m2] = au.slice(0, 7).split('-').map(Number);
    const sortie = [];
    for (let a = a1, m = m1, n = 0; (a < a2 || (a === a2 && m <= m2)) && n < 36; n += 1) {
        sortie.push(`${a}-${String(m).padStart(2, '0')}`);
        m += 1;
        if (m > 12) {
            m = 1;
            a += 1;
        }
    }
    return sortie;
}
const joursAbsenceDuMois = (absences, mois) => (0, absences_1.joursOuvrablesDuMois)(absences, mois).reduce((n, j) => n + j.poids, 0);
async function confronterSalaireAuxConges(db, tenantId, salarieId, p) {
    const candidat = p.candidat;
    const lus = await (0, absences_lecture_1.congesPayesDuMois)(db, tenantId, salarieId, p.mois, p.absences);
    if (lus.length === 0 && !candidat)
        return { refus: null, avertissement: null };
    const absences = p.absences ?? (await (0, absences_lecture_1.absencesDuSalarie)(db, tenantId, salarieId));
    const conges = [...lus];
    if (candidat && !lus.some((c) => c.id === candidat.id)) {
        const { joursMaladie } = (0, absences_1.absencesPourLeCompteur)(absences, null);
        const [c] = (0, absences_1.congesDuMois)([{ id: candidat.id ?? 'conge-a-poser', du: candidat.du, au: candidat.au, joursVoyage: candidat.joursVoyage }], p.mois, joursMaladie);
        if (c)
            conges.push({ ...c, remunerationJournaliere: candidat.remunerationJournaliere, deviseAllocation: candidat.deviseAllocation });
    }
    const payes = conges.filter((c) => c.auMoins > 0);
    if (payes.length === 0)
        return { refus: null, avertissement: null };
    const raison = (0, absences_1.raisonDeLaGardeMuette)(p.contrat, p.devise);
    if (raison) {
        return { refus: null, avertissement: (0, absences_1.avertissementGardeMuette)({ mois: p.mois, conges: payes, raison, numero: p.bulletinEmis?.numero }) };
    }
    return {
        refus: (0, absences_1.motifRefusSalairePleinPendantLeConge)({
            mois: p.mois,
            conges,
            salaireDuBulletin: p.salaire,
            salaireMensuel: Number(p.contrat.remunerationBase),
            devise: p.devise,
            joursAbsenceDuMois: joursAbsenceDuMois(absences, p.mois),
            bulletinEmis: p.bulletinEmis,
        }),
        avertissement: null,
    };
}
async function bulletinsEmisDesMois(db, tenantId, salarieId, mois) {
    return db.bulletinPaie.findMany({
        where: { tenantId, salarieId, statut: client_1.StatutBulletinPaie.EMIS, moisDePaie: { in: [...mois] } },
        orderBy: { moisDePaie: 'asc' },
        take: mois.length,
        select: {
            numero: true,
            moisDePaie: true,
            entree: true,
            contrat: { select: { remunerationBase: true, periodiciteRemuneration: true, deviseRemuneration: true } },
        },
    });
}
const illisible = (numero, mois) => `Le bulletin n° ${numero} de ${mois} ne se relit pas (saisie figée illisible) · il n'est pas confronté à ce congé. Vérifiez que son salaire ne paie pas les jours du congé (Code du travail, art. 142).`;
async function confronterLesBulletinsEmis(db, tenantId, salarieId, conge, p) {
    const refus = [];
    const avertissements = [];
    const mois = moisTouches(conge.du, conge.au).filter((m) => m !== p.saufMois);
    if (mois.length === 0)
        return { refus, avertissements };
    const bulletins = await bulletinsEmisDesMois(db, tenantId, salarieId, mois);
    if (bulletins.length === 0)
        return { refus, avertissements };
    const absences = await (0, absences_lecture_1.absencesDuSalarie)(db, tenantId, salarieId);
    for (const b of bulletins) {
        const s = salaireDeLaSaisie(b.entree);
        if (!s) {
            avertissements.push(illisible(b.numero, b.moisDePaie));
            continue;
        }
        const r = await confronterSalaireAuxConges(db, tenantId, salarieId, {
            mois: b.moisDePaie,
            salaire: s.salaire,
            devise: s.devise,
            contrat: b.contrat,
            candidat: conge,
            bulletinEmis: { numero: b.numero, issue: p.issue(b.numero, b.moisDePaie) },
            absences,
        });
        if (r.refus)
            refus.push(r.refus);
        if (r.avertissement)
            avertissements.push(r.avertissement);
    }
    return { refus, avertissements };
}
async function bulletinsQuiRetranchentLeConge(db, tenantId, salarieId, conge) {
    const refus = [];
    const avertissements = [];
    const mois = moisTouches(conge.du, conge.au);
    const bulletins = await bulletinsEmisDesMois(db, tenantId, salarieId, mois);
    if (bulletins.length === 0)
        return { refus, avertissements };
    const absences = await (0, absences_lecture_1.absencesDuSalarie)(db, tenantId, salarieId);
    const { joursMaladie } = (0, absences_1.absencesPourLeCompteur)(absences, null);
    for (const b of bulletins) {
        const [c] = (0, absences_1.congesDuMois)([{ id: conge.id, du: conge.du, au: conge.au, joursVoyage: conge.joursVoyage }], b.moisDePaie, joursMaladie);
        if (!c || c.auMoins <= 0)
            continue;
        const s = salaireDeLaSaisie(b.entree);
        if (!s) {
            avertissements.push(illisible(b.numero, b.moisDePaie));
            continue;
        }
        const raison = (0, absences_1.raisonDeLaGardeMuette)(b.contrat, s.devise);
        if (raison) {
            avertissements.push(`Le bulletin n° ${b.numero} de ${b.moisDePaie} n'est pas confronté à ce congé · ${raison}. S'il ne paie pas les jours du congé, annulez-le et réémettez-le avec le salaire de ces jours.`);
            continue;
        }
        const motif = (0, absences_1.motifRefusAnnulationDuCongeRetranche)({
            mois: b.moisDePaie,
            numero: b.numero,
            conge: c,
            salaireDuBulletin: s.salaire,
            salaireMensuel: Number(b.contrat.remunerationBase),
            devise: s.devise,
            joursAbsenceDuMois: joursAbsenceDuMois(absences, b.moisDePaie),
        });
        if (motif)
            refus.push(motif);
    }
    return { refus, avertissements };
}
//# sourceMappingURL=salaire-pendant-le-conge.js.map