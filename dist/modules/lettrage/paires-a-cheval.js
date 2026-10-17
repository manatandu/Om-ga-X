"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ECRITURE_D_A_NOUVEAU = void 0;
exports.pairesACheval = pairesACheval;
const lecture_par_lots_1 = require("../../common/lecture-par-lots");
exports.ECRITURE_D_A_NOUVEAU = [
    { estANouveauProvisoire: true },
    { estGenereeParCloture: true, estSoldeDesComptesDeGestion: false },
];
const centimes = (x) => Math.round(Number(x ?? 0) * 100);
const signe = (l) => centimes(l.debit) - centimes(l.credit);
const enDevise = (l) => (l.deviseId !== null && l.montantDevise !== null && l.montantDevise !== undefined ? centimes(l.montantDevise) : null);
const memeJour = (a, b) => (a === null || b === null ? a === b : a.getTime() === b.getTime());
const TRANCHE_GROUPES = 500;
function imputer(reste, paye, payeDevise) {
    if (reste.devise !== null && payeDevise !== null) {
        const prisDevise = Math.min(reste.devise, payeDevise);
        const historique = reste.devise > 0 ? Math.min(reste.francs, Math.round((reste.francs * prisDevise) / reste.devise)) : 0;
        reste.francs -= historique;
        reste.devise -= prisDevise;
        return { paye: Math.max(0, paye - historique), payeDevise: payeDevise - prisDevise };
    }
    const pris = Math.min(reste.francs, paye);
    reste.francs -= pris;
    return { paye: paye - pris, payeDevise };
}
async function pairesACheval(prisma, p) {
    const lecteur = prisma;
    const resultat = { absorbees: new Set(), groupeDe: new Map(), reste: new Map() };
    const parGroupe = new Map();
    await (0, lecture_par_lots_1.lireParLots)((curseur) => lecteur.ligneEcriture.findMany({
        where: {
            ecriture: { tenantId: p.tenantId, exerciceId: p.exercice.id },
            lettrageId: { not: null },
            compte: p.compte,
            lettrage: { lignes: { some: { ecriture: { tenantId: p.tenantId, date: { lt: p.exercice.dateDebut } } } } },
        },
        select: {
            id: true,
            compteId: true,
            debit: true,
            credit: true,
            deviseId: true,
            montantDevise: true,
            lettrageId: true,
            compte: { select: { modeReportANouveau: true } },
            lettrage: { select: { code: true } },
        },
        ...(0, lecture_par_lots_1.pageApres)(curseur, lecture_par_lots_1.LOT_LECTURE),
    }), (l) => {
        const g = parGroupe.get(l.lettrageId) ?? { compteId: l.compteId, mode: l.compte.modeReportANouveau, code: l.lettrage.code, lignes: [] };
        g.lignes.push(l);
        parGroupe.set(l.lettrageId, g);
    });
    if (parGroupe.size === 0)
        return resultat;
    const anterieures = new Map();
    const ids = [...parGroupe.keys()];
    for (let i = 0; i < ids.length; i += TRANCHE_GROUPES) {
        const tranche = ids.slice(i, i + TRANCHE_GROUPES);
        await (0, lecture_par_lots_1.lireParLots)((curseur) => lecteur.ligneEcriture.findMany({
            where: { lettrageId: { in: tranche }, ecriture: { tenantId: p.tenantId, date: { lt: p.exercice.dateDebut } } },
            select: {
                id: true,
                compteId: true,
                debit: true,
                credit: true,
                deviseId: true,
                montantDevise: true,
                lettrageId: true,
                dateEcheance: true,
                libelle: true,
                ecriture: { select: { date: true, libelle: true } },
            },
            ...(0, lecture_par_lots_1.pageApres)(curseur, lecture_par_lots_1.LOT_LECTURE),
        }), (l) => anterieures.set(l.lettrageId, [...(anterieures.get(l.lettrageId) ?? []), l]));
    }
    const comptes = [...new Set([...parGroupe.values()].map((g) => g.compteId))];
    const aNouveau = new Map();
    await (0, lecture_par_lots_1.lireParLots)((curseur) => lecteur.ligneEcriture.findMany({
        where: {
            compteId: { in: comptes },
            lettrageId: null,
            ecriture: { tenantId: p.tenantId, exerciceId: p.exercice.id, OR: exports.ECRITURE_D_A_NOUVEAU },
        },
        select: { id: true, compteId: true, debit: true, credit: true, deviseId: true, montantDevise: true, dateEcheance: true, libelle: true },
        ...(0, lecture_par_lots_1.pageApres)(curseur, lecture_par_lots_1.LOT_LECTURE),
    }), (l) => aNouveau.set(l.compteId, [...(aNouveau.get(l.compteId) ?? []), l]));
    const restant = new Map();
    const prendre = (r, groupe) => {
        const vu = restant.get(r.id);
        if (vu)
            return vu;
        const neuf = { francs: Math.abs(signe(r)), devise: enDevise(r), ligne: r, groupe };
        restant.set(r.id, neuf);
        return neuf;
    };
    const utilisees = new Set();
    for (const [groupeId, g] of parGroupe) {
        const avant = anterieures.get(groupeId) ?? [];
        if (avant.length === 0)
            continue;
        const devises = new Set([...avant, ...g.lignes].filter((l) => l.deviseId !== null).map((l) => l.deviseId));
        const devise = devises.size === 1 ? [...devises][0] : null;
        const duCompte = aNouveau.get(g.compteId) ?? [];
        if (g.mode === 'DETAIL') {
            const copies = [];
            const ordonnees = [...avant].sort((a, b) => a.ecriture.date.getTime() - b.ecriture.date.getTime() || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
            for (const e of ordonnees) {
                const libelle = e.libelle ?? e.ecriture.libelle;
                const r = duCompte.find((x) => !utilisees.has(x.id) &&
                    !copies.includes(x) &&
                    centimes(x.debit) === centimes(e.debit) &&
                    centimes(x.credit) === centimes(e.credit) &&
                    (x.deviseId ?? null) === (e.deviseId ?? null) &&
                    enDevise(x) === enDevise(e) &&
                    memeJour(x.dateEcheance, e.dateEcheance) &&
                    (x.libelle ?? '').endsWith(libelle));
                if (!r)
                    break;
                copies.push(r);
            }
            if (copies.length !== avant.length)
                continue;
            for (const r of copies)
                utilisees.add(r.id);
            const net = [...copies, ...g.lignes].reduce((t, l) => t + signe(l), 0);
            for (const l of g.lignes)
                resultat.absorbees.add(l.id);
            const sens = Math.sign(net);
            const memes = sens === 0 ? [] : copies.filter((r) => Math.sign(signe(r)) === sens);
            for (const r of copies) {
                if (!memes.includes(r)) {
                    resultat.absorbees.add(r.id);
                    resultat.groupeDe.set(r.id, g.code);
                }
            }
            if (memes.length === 0)
                continue;
            const netDevise = devise === null ? null : [...copies, ...g.lignes].reduce((t, l) => t + (l.deviseId === devise ? Math.sign(signe(l)) * (enDevise(l) ?? 0) : 0), 0);
            let paye = Math.max(0, memes.reduce((t, r) => t + Math.abs(signe(r)), 0) - Math.abs(net));
            let payeDevise = netDevise === null ? null : Math.max(0, memes.reduce((t, r) => t + (enDevise(r) ?? 0), 0) - Math.abs(netDevise));
            for (const r of memes) {
                const imputee = imputer(prendre(r, g.code), paye, payeDevise);
                paye = imputee.paye;
                payeDevise = imputee.payeDevise;
            }
            continue;
        }
        if (g.mode === 'SOLDE') {
            const regle = g.lignes.reduce((t, l) => t + signe(l), 0);
            if (regle === 0)
                continue;
            const parDevise = duCompte.filter((r) => (r.deviseId ?? null) === devise);
            const cibles = (parDevise.length > 0 ? parDevise : duCompte.filter((r) => r.deviseId === null)).filter((r) => Math.sign(signe(r)) === -Math.sign(regle));
            if (cibles.length === 0)
                continue;
            for (const l of g.lignes)
                resultat.absorbees.add(l.id);
            let paye = Math.abs(regle);
            let payeDevise = devise === null ? null : Math.abs(g.lignes.reduce((t, l) => t + (l.deviseId === devise ? Math.sign(signe(l)) * (enDevise(l) ?? 0) : 0), 0));
            for (const r of cibles) {
                const imputee = imputer(prendre(r, g.code), paye, payeDevise);
                paye = imputee.paye;
                payeDevise = imputee.payeDevise;
            }
        }
    }
    for (const [id, r] of restant) {
        const initial = Math.abs(signe(r.ligne));
        if (r.francs === initial && r.devise === enDevise(r.ligne))
            continue;
        if (r.francs <= 0 || (r.devise !== null && r.devise <= 0)) {
            resultat.absorbees.add(id);
            resultat.groupeDe.set(id, r.groupe);
            continue;
        }
        const sens = Math.sign(signe(r.ligne));
        resultat.reste.set(id, { francs: (sens * r.francs) / 100, devise: r.devise === null ? null : r.devise / 100, groupe: r.groupe });
    }
    return resultat;
}
//# sourceMappingURL=paires-a-cheval.js.map