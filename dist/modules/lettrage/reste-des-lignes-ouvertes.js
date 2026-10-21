"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PLAFOND_GROUPES_NOMMES = void 0;
exports.poidsOuMontant = poidsOuMontant;
exports.poidsDesLignesOuvertes = poidsDesLignesOuvertes;
exports.factureOuverteLaPlusAncienne = factureOuverteLaPlusAncienne;
exports.groupesLusLigneALigne = groupesLusLigneALigne;
exports.groupesLusLigneALigneParCompte = groupesLusLigneALigneParCompte;
exports.poidsDesLignesLues = poidsDesLignesLues;
exports.groupesLusAPlusieurs = groupesLusAPlusieurs;
exports.ecartsDesGroupesParEcheance = ecartsDesGroupesParEcheance;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const date_origine_des_reports_1 = require("../relances/date-origine-des-reports");
const paires_a_cheval_1 = require("./paires-a-cheval");
const reconduction_lettrage_1 = require("./reconduction-lettrage");
const journal = new common_1.Logger('RestesDesLignesOuvertes');
const centimes = (x) => Math.round(Number(x ?? 0) * 100);
function poidsOuMontant(p, l) {
    return p.poids.get(l.id) ?? (centimes(l.debit) - centimes(l.credit)) / 100;
}
function groupesAPlusieurs(lignes) {
    const groupes = new Map();
    for (const l of lignes) {
        if (!l.lettrageId)
            continue;
        const membres = groupes.get(l.lettrageId);
        if (membres)
            membres.push(l);
        else
            groupes.set(l.lettrageId, [l]);
    }
    for (const [id, membres] of groupes)
        if (membres.length < 2)
            groupes.delete(id);
    return groupes;
}
function annulerLesNegatifs(membres) {
    const annulees = new Set();
    const memeEcheance = (a, b) => (a?.getTime() ?? null) === (b?.getTime() ?? null);
    for (const n of membres) {
        for (const colonne of ['debit', 'credit']) {
            const montant = centimes(n[colonne]);
            if (montant >= 0)
                continue;
            const candidates = membres.filter((o) => !annulees.has(o.id) && o.id !== n.id && centimes(o[colonne]) === -montant && memeEcheance(o.dateEcheance, n.dateEcheance));
            if (candidates.length !== 1)
                return null;
            const origine = candidates[0];
            annulees.add(n.id);
            annulees.add(origine.id);
        }
    }
    return annulees;
}
function imputerLesDeclarations(lues, sens, declarations) {
    const declares = lues.filter((l) => declarations.has(l.id));
    if (declares.length === 0)
        return lues;
    if (lues.some((l) => l.deviseId !== null))
        return null;
    const colonneFacture = (l) => centimes(sens === 'DEBIT' ? l.debit : l.credit);
    const colonneReglement = (l) => centimes(sens === 'DEBIT' ? l.credit : l.debit);
    const restes = new Map(lues.filter((l) => colonneFacture(l) > 0).map((l) => [l.id, colonneFacture(l)]));
    const residuels = new Map();
    for (const p of declares) {
        let impute = 0;
        for (const part of declarations.get(p.id)) {
            const reste = restes.get(part.ligneFactureId);
            if (reste === undefined)
                continue;
            const pris = centimes(part.montant);
            if (pris > reste)
                return null;
            restes.set(part.ligneFactureId, reste - pris);
            impute += pris;
        }
        const residuel = colonneReglement(p) - impute;
        if (residuel < 0)
            return null;
        residuels.set(p.id, residuel);
    }
    const enUnites = (c) => c / 100;
    return lues.flatMap((l) => {
        if (restes.has(l.id)) {
            const reste = restes.get(l.id);
            return reste > 0 ? [{ ...l, debit: sens === 'DEBIT' ? enUnites(reste) : 0, credit: sens === 'CREDIT' ? enUnites(reste) : 0 }] : [];
        }
        if (residuels.has(l.id)) {
            const residuel = residuels.get(l.id);
            return residuel > 0 ? [{ ...l, debit: sens === 'DEBIT' ? 0 : enUnites(residuel), credit: sens === 'DEBIT' ? enUnites(residuel) : 0 }] : [];
        }
        return [l];
    });
}
function poidsDesLignesOuvertes(lignes, origines = new Map(), exclus = new Set(), declarations = new Map()) {
    const poids = new Map();
    const nonRepartis = [];
    const motifs = new Map();
    const enBloc = new Map();
    const nommerLeGroupe = (lettrageId, motif, net, candidates, restes) => {
        nonRepartis.push(lettrageId);
        motifs.set(lettrageId, motif);
        enBloc.set(lettrageId, { ligneId: factureOuverteLaPlusAncienne(candidates, origines, net, restes), net: net / 100 });
    };
    for (const [lettrageId, membres] of groupesAPlusieurs(lignes)) {
        if (exclus.has(lettrageId))
            continue;
        const net = membres.reduce((t, l) => t + centimes(l.debit) - centimes(l.credit), 0);
        if (net === 0) {
            for (const l of membres)
                poids.set(l.id, 0);
            continue;
        }
        const annulees = annulerLesNegatifs(membres);
        if (annulees === null) {
            nommerLeGroupe(lettrageId, 'NEGATIF_SANS_ORIGINE', net, membres);
            continue;
        }
        for (const id of annulees)
            poids.set(id, 0);
        const restantes = membres.filter((l) => !annulees.has(l.id));
        if (restantes.length < 2) {
            continue;
        }
        const sens = net > 0 ? 'DEBIT' : 'CREDIT';
        const lues = restantes.map((l) => ({
            id: l.id,
            cle: origines.get(l.id)?.id ?? l.id,
            debit: Number(l.debit),
            credit: Number(l.credit),
            deviseId: l.deviseId,
            montantDevise: l.montantDevise === null ? null : Number(l.montantDevise),
            date: origines.get(l.id)?.date ?? l.ecriture.date,
            dateEcheance: l.dateEcheance,
        }));
        const imputees = imputerLesDeclarations(lues, sens, declarations);
        if (imputees === null) {
            for (const id of annulees)
                poids.delete(id);
            nommerLeGroupe(lettrageId, 'IMPUTATION_DECLAREE_NON_LUE', net, restantes);
            continue;
        }
        const restes = (0, reconduction_lettrage_1.restesParLImputationLegale)(imputees, sens);
        const totalRestes = [...restes.values()].reduce((t, r) => t + centimes(r.francs), 0);
        if (totalRestes !== Math.abs(net) || [...restes.values()].some((r) => r.francs < 0)) {
            for (const id of annulees)
                poids.delete(id);
            nommerLeGroupe(lettrageId, motifDuReste(restes), net, restantes, restes);
            continue;
        }
        const signe = sens === 'DEBIT' ? 1 : -1;
        for (const l of restantes) {
            const reste = restes.get(l.id);
            poids.set(l.id, reste ? signe * reste.francs : 0);
        }
    }
    return { poids, nonRepartis, motifs, enBloc };
}
function factureOuverteLaPlusAncienne(membres, origines, net, restes) {
    const colonne = (l) => centimes(net > 0 ? l.debit : l.credit);
    const dateDe = (l) => (origines.get(l.id)?.date ?? l.ecriture.date).getTime();
    const factures = membres.filter((l) => colonne(l) > 0);
    if (factures.length === 0)
        return membres[0].id;
    let ouvertes = restes ? factures.filter((f) => (restes.get(f.id)?.francs ?? 0) > 0 || (restes.get(f.id)?.devise ?? 0) > 0) : [];
    if (ouvertes.length === 0) {
        ouvertes = [];
        let couvert = 0;
        for (const f of [...factures].sort((a, b) => dateDe(b) - dateDe(a) || b.id.localeCompare(a.id))) {
            if (couvert >= Math.abs(net))
                break;
            ouvertes.push(f);
            couvert += colonne(f);
        }
    }
    const echeanceDe = (l) => l.dateEcheance?.getTime() ?? dateDe(l);
    return [...ouvertes].sort((a, b) => echeanceDe(a) - echeanceDe(b) || dateDe(a) - dateDe(b) || a.id.localeCompare(b.id))[0].id;
}
function motifDuReste(restes) {
    const enDevise = [...restes.values()].filter((r) => r.devise !== null);
    if (enDevise.length === 0)
        return 'RESTE_NON_REPARTI';
    return enDevise.some((r) => (r.devise ?? 0) > 0) ? 'DEVISE_REGLEE_EN_PARTIE' : 'DEVISE_SOLDEE_ECART_NON_PASSE';
}
exports.PLAFOND_GROUPES_NOMMES = 20;
async function lireGroupesNommes(db, tenantId, motifs) {
    const lus = [];
    const uniques = [...motifs.keys()];
    for (let i = 0; i < uniques.length; i += reconduction_lettrage_1.LOT_GROUPES) {
        const tranche = (await db.lettrage.findMany({
            where: { tenantId, id: { in: uniques.slice(i, i + reconduction_lettrage_1.LOT_GROUPES) } },
            select: { id: true, code: true, compteId: true, compte: { select: { numero: true } } },
        }));
        for (const g of tranche)
            lus.push({ id: g.id, code: g.code.toLowerCase(), compteId: g.compteId, compte: g.compte.numero, motif: motifs.get(g.id) });
    }
    return lus.sort((a, b) => a.compte.localeCompare(b.compte) || a.code.localeCompare(b.code));
}
function nommer(groupes, total) {
    return {
        total,
        groupes: groupes.slice(0, exports.PLAFOND_GROUPES_NOMMES).map((g) => ({ code: g.code, compte: g.compte, motif: g.motif })),
        tronque: total > exports.PLAFOND_GROUPES_NOMMES,
    };
}
async function groupesLusLigneALigne(db, tenantId, motifs) {
    if (motifs.size === 0)
        return { total: 0, groupes: [], tronque: false };
    return nommer(await lireGroupesNommes(db, tenantId, motifs), motifs.size);
}
async function groupesLusLigneALigneParCompte(db, tenantId, motifs) {
    const parCompte = new Map();
    for (const g of await lireGroupesNommes(db, tenantId, motifs))
        parCompte.set(g.compteId, [...(parCompte.get(g.compteId) ?? []), g]);
    return new Map([...parCompte].map(([compteId, groupes]) => [compteId, nommer(groupes, groupes.length)]));
}
async function poidsDesLignesLues(db, tenantId, lignes, borne, etat) {
    const groupes = groupesAPlusieurs(lignes);
    const ids = [...groupes.keys()];
    const origines = new Map();
    const exclus = new Set();
    const sansOrigine = [];
    for (let i = 0; i < ids.length; i += reconduction_lettrage_1.LOT_GROUPES) {
        const tranche = ids.slice(i, i + reconduction_lettrage_1.LOT_GROUPES);
        const [comptes, reconduits] = await Promise.all([
            db.ligneEcriture.groupBy({
                by: ['lettrageId'],
                where: {
                    lettrageId: { in: tranche },
                    ecriture: {
                        tenantId,
                        ...(borne.dateMax ? { date: { lte: borne.dateMax } } : {}),
                        ...(borne.statut ? { statut: borne.statut } : {}),
                    },
                },
                _count: { _all: true },
            }),
            db.lettrage.findMany({
                where: { tenantId, id: { in: tranche }, lettrageReconduitId: { not: null } },
                select: reconduction_lettrage_1.SELECT_ORIGINE,
            }),
        ]);
        const dansLaBorne = new Map(comptes.map((c) => [c.lettrageId, c._count._all]));
        for (const id of tranche)
            if (dansLaBorne.get(id) !== groupes.get(id).length)
                exclus.add(id);
        if (reconduits.length > 0)
            for (const [id, o] of await (0, reconduction_lettrage_1.originesDesLignes)(db, tenantId, reconduits))
                origines.set(id, o);
        const lus = tranche.filter((id) => !exclus.has(id)).map((id) => [id, groupes.get(id)]);
        for (const id of await originesDesANouveaux(db, tenantId, lus, origines))
            sansOrigine.push(id);
    }
    const declarations = new Map();
    const lignesDesGroupes = [...groupes.values()].flat().map((l) => l.id);
    for (let i = 0; i < lignesDesGroupes.length; i += reconduction_lettrage_1.LOT_GROUPES) {
        const parts = (await db.imputationPaiement.findMany({
            where: { tenantId, retireeLe: null, ligneReglementId: { in: lignesDesGroupes.slice(i, i + reconduction_lettrage_1.LOT_GROUPES) } },
            select: { ligneReglementId: true, ligneFactureId: true, montant: true },
        }));
        for (const d of parts) {
            const liste = declarations.get(d.ligneReglementId) ?? [];
            liste.push({ ligneFactureId: d.ligneFactureId, montant: Number(d.montant) });
            declarations.set(d.ligneReglementId, liste);
        }
    }
    const p = poidsDesLignesOuvertes(lignes, origines, exclus, declarations);
    for (const id of sansOrigine)
        if (!p.motifs.has(id))
            p.motifs.set(id, 'A_NOUVEAU_SANS_ORIGINE');
    if (p.nonRepartis.length > 0) {
        journal.warn(`${etat} · ${p.nonRepartis.length} groupe(s) de lettrage lu(s) ligne à ligne, leur reste ne se répartissant pas ` +
            `sûrement entre leurs factures (négatif sans son origine, reste négatif en devise, part déclarée au-delà de la facture, ` +
            `imputation déclarée dans un groupe en devise) · ${p.nonRepartis.slice(0, 20).join(', ')}` +
            (p.nonRepartis.length > 20 ? ' …' : ''));
    }
    if (sansOrigine.length > 0) {
        journal.warn(`${etat} · ${sansOrigine.length} groupe(s) de lettrage à plusieurs factures dont une ligne d'à-nouveau n'a pas retrouvé ` +
            `sa pièce d'origine (aucune origine sûre à la clé du report dans l'exercice précédent) · ` +
            `leurs lignes d'à-nouveau s'imputent à la date du report (Code civil, Livre III, art. 154, lu sur cette date), et l'état les nomme · ` +
            `${sansOrigine.slice(0, 20).join(', ')}` +
            (sansOrigine.length > 20 ? ' …' : ''));
    }
    return p;
}
async function originesDesANouveaux(db, tenantId, groupes, origines) {
    const membres = new Set(groupes.flatMap(([, ms]) => ms.map((l) => l.id)));
    if (membres.size === 0)
        return [];
    const lues = (await db.ligneEcriture.findMany({
        where: { id: { in: [...membres] }, ecriture: { tenantId, OR: paires_a_cheval_1.ECRITURE_D_A_NOUVEAU } },
        select: {
            id: true,
            compteId: true,
            debit: true,
            credit: true,
            libelle: true,
            dateEcheance: true,
            compte: { select: { numero: true } },
            ecriture: { select: { date: true, estANouveauProvisoire: true, estGenereeParCloture: true, estSoldeDesComptesDeGestion: true } },
        },
    }));
    const estANouveau = (l) => l.ecriture?.estANouveauProvisoire === true || (l.ecriture?.estGenereeParCloture === true && l.ecriture.estSoldeDesComptesDeGestion !== true);
    const aNouveaux = lues.filter((l) => membres.has(l.id) && estANouveau(l) && l.compte && l.ecriture);
    const aChercher = aNouveaux.filter((l) => !origines.has(l.id));
    if (aChercher.length === 0)
        return [];
    const parDate = new Map();
    for (const l of aChercher)
        parDate.set(l.ecriture.date.getTime(), [...(parDate.get(l.ecriture.date.getTime()) ?? []), l]);
    const trouvees = new Map();
    for (const [date, lignes] of parDate) {
        const { origines: o } = await (0, date_origine_des_reports_1.originesDesReports)(db, tenantId, new Date(date), lignes.map((l) => ({
            id: l.id,
            compteId: l.compteId,
            numeroCompte: l.compte.numero,
            debit: Number(l.debit),
            credit: Number(l.credit),
            libelle: l.libelle,
            dateEcheance: l.dateEcheance,
            date: l.ecriture.date,
            provisoire: l.ecriture.estANouveauProvisoire === true,
        })));
        for (const [id, origine] of o)
            trouvees.set(id, origine);
    }
    const groupeDe = new Map(groupes.flatMap(([lettrageId, ms]) => ms.map((l) => [l.id, lettrageId])));
    const aNouveauxParGroupe = new Map();
    for (const l of aNouveaux) {
        const lettrageId = groupeDe.get(l.id);
        aNouveauxParGroupe.set(lettrageId, [...(aNouveauxParGroupe.get(lettrageId) ?? []), l.id]);
    }
    const membresDe = new Map(groupes);
    const sansOrigine = [];
    for (const [lettrageId, ids] of aNouveauxParGroupe) {
        if (ids.every((id) => origines.has(id) || trouvees.has(id))) {
            for (const id of ids)
                if (trouvees.has(id))
                    origines.set(id, trouvees.get(id));
            continue;
        }
        for (const id of ids)
            origines.delete(id);
        const ms = membresDe.get(lettrageId) ?? [];
        const net = ms.reduce((t, l) => t + centimes(l.debit) - centimes(l.credit), 0);
        const factures = ms.filter((l) => (net > 0 ? centimes(l.debit) > 0 : centimes(l.credit) > 0));
        if (net !== 0 && factures.length > 1)
            sansOrigine.push(lettrageId);
    }
    return sansOrigine;
}
async function groupesLusAPlusieurs(db, where) {
    const lus = await db.ligneEcriture.groupBy({
        by: ['lettrageId'],
        where: { AND: [where, { lettrageId: { not: null } }] },
        _count: { _all: true },
    });
    const ids = new Set();
    for (const g of lus)
        if (g.lettrageId && g._count._all > 1)
            ids.add(g.lettrageId);
    return ids;
}
async function ecartsDesGroupesParEcheance(db, tenantId, ouvertes, dateFin, etat) {
    const ecarts = new Map();
    const ids = [...(await groupesLusAPlusieurs(db, ouvertes))];
    if (ids.length === 0)
        return { ecarts, nommes: new Map() };
    const lues = [];
    for (let i = 0; i < ids.length; i += reconduction_lettrage_1.LOT_GROUPES) {
        lues.push(...(await db.ligneEcriture.findMany({
            where: { AND: [ouvertes, { lettrageId: { in: ids.slice(i, i + reconduction_lettrage_1.LOT_GROUPES) } }] },
            select: {
                id: true,
                compteId: true,
                debit: true,
                credit: true,
                lettrageId: true,
                dateEcheance: true,
                deviseId: true,
                montantDevise: true,
                ecriture: { select: { date: true } },
            },
        })));
    }
    const p = await poidsDesLignesLues(db, tenantId, lues, { dateMax: dateFin, statut: client_1.StatutEcriture.VALIDEE }, etat);
    for (const l of lues) {
        if (!l.dateEcheance)
            continue;
        const poids = p.poids.get(l.id);
        if (poids === undefined)
            continue;
        const ecart = (centimes(poids) - (centimes(l.debit) - centimes(l.credit))) / 100;
        if (ecart === 0)
            continue;
        const e = ecarts.get(l.compteId) ?? { nonEchu: 0, echu: 0 };
        if (l.dateEcheance > dateFin)
            e.nonEchu += ecart;
        else
            e.echu += ecart;
        ecarts.set(l.compteId, e);
    }
    return { ecarts, nommes: p.motifs };
}
//# sourceMappingURL=reste-des-lignes-ouvertes.js.map