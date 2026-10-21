"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.groupesDesLignes = groupesDesLignes;
exports.lignesDuGroupe = lignesDuGroupe;
exports.restesDuGroupe = restesDuGroupe;
exports.factureEncoreDue = factureEncoreDue;
exports.fileDuGroupeEnDevise = fileDuGroupeEnDevise;
exports.motifLigneDuGroupe = motifLigneDuGroupe;
exports.motifDeuxGroupes = motifDeuxGroupes;
exports.motifRefusMontantDuGroupe = motifRefusMontantDuGroupe;
exports.echeancesDesGroupesPartiels = echeancesDesGroupesPartiels;
exports.motifDeviseIndeterminee = motifDeviseIndeterminee;
exports.avertissementImputationDuGroupe = avertissementImputationDuGroupe;
const client_1 = require("@prisma/client");
const lecture_par_lots_1 = require("../../common/lecture-par-lots");
const reconduction_lettrage_1 = require("../lettrage/reconduction-lettrage");
const SELECT_GROUPE = {
    id: true,
    code: true,
    statut: true,
    verrouille: true,
    compteId: true,
    lettrageReconduitId: true,
    solde: true,
    compte: { select: { numero: true } },
    lignes: {
        select: {
            id: true,
            compteId: true,
            debit: true,
            credit: true,
            dateEcheance: true,
            deviseId: true,
            montantDevise: true,
            libelle: true,
            ecriture: { select: { exerciceId: true, date: true, libelle: true } },
        },
    },
};
async function groupesDesLignes(db, tenantId, lettrageIds) {
    if (lettrageIds.length === 0)
        return { groupes: new Map(), origines: new Map() };
    const lus = (await db.lettrage.findMany({
        where: { tenantId, id: { in: [...new Set(lettrageIds)] } },
        select: SELECT_GROUPE,
    }));
    return { groupes: new Map(lus.map((g) => [g.id, g])), origines: await (0, reconduction_lettrage_1.originesDesLignes)(db, tenantId, lus) };
}
const sensDesFactures = (sens) => (sens === 'CLIENT' ? 'DEBIT' : 'CREDIT');
function lignesDuGroupe(g, origines) {
    return g.lignes.map((l) => ({
        id: l.id,
        debit: Number(l.debit),
        credit: Number(l.credit),
        deviseId: l.deviseId,
        montantDevise: l.montantDevise === null ? null : Number(l.montantDevise),
        date: origines.get(l.id)?.date ?? l.ecriture.date,
        cle: origines.get(l.id)?.id ?? l.id,
        dateEcheance: l.dateEcheance,
    }));
}
function restesDuGroupe(g, sens, origines = new Map()) {
    return (0, reconduction_lettrage_1.restesDesFactures)(lignesDuGroupe(g, origines), sensDesFactures(sens));
}
function factureEncoreDue(r) {
    return r.devise === null || r.deviseIndeterminee ? r.francs > 0 : r.devise > 0;
}
function fileDuGroupeEnDevise(g, sens, origines, deviseId) {
    const restes = restesDuGroupe(g, sens, origines);
    const file = [];
    for (const l of g.lignes) {
        const r = restes.get(l.id);
        if (!r || l.deviseId !== deviseId)
            continue;
        if (r.deviseIndeterminee)
            return null;
        if (!factureEncoreDue(r))
            continue;
        file.push({ id: origines.get(l.id)?.id ?? l.id, francs: r.francs, montantDevise: r.devise, date: origines.get(l.id)?.date ?? l.ecriture.date });
    }
    return file;
}
function motifLigneDuGroupe(numero, g, exerciceId) {
    if (!g || g.statut === client_1.StatutLettrage.SOLDE)
        return `Une facture du compte ${numero} est déjà lettrée · elle n'est plus due.`;
    const code = g.code.toLowerCase();
    if (g.lignes.some((l) => l.ecriture.exerciceId !== exerciceId)) {
        return (`Une facture du compte ${numero} appartient au lettrage partiel ${code}, qui touche un autre exercice · son reste se lit par ` +
            "la ligne d'à-nouveau qui la reporte. Complétez ce lettrage depuis Interrogation et lettrage, ou réglez la ligne d'à-nouveau.");
    }
    if (g.verrouille)
        return `Une facture du compte ${numero} appartient au lettrage partiel ${code}, verrouillé · déverrouillez-le avant de régler son reste.`;
    return null;
}
function motifDeuxGroupes(numero, codes) {
    if (codes.length <= 1)
        return null;
    return (`${numero} · les factures choisies appartiennent à ${codes.length} lettrages partiels (${codes.map((c) => c.toLowerCase()).join(', ')}) · ` +
        'un règlement complète un seul lettrage. Réglez-les une pièce chacun.');
}
function motifRefusMontantDuGroupe(numero, montant, du, code, regle, enDevise = false) {
    if (Math.round(montant * 100) <= Math.round(du * 100))
        return null;
    const f = (x) => x.toFixed(2);
    return (`${numero} · le montant réglé (${f(montant)}) dépasse le reste dû (${f(du)})${enDevise ? ' dans la devise des factures' : ''} · la facture choisie appartient ` +
        `au lettrage partiel ${code.toLowerCase()}, qui en a déjà réglé ${f(regle)} (acomptes, règlements ou avoirs réunis avec elle ; à l'ouverture de ` +
        "l'exercice, reconduit par la clôture, AUDCIF art. 34). L'excédent est une avance ou un trop-perçu, à comptabiliser à part.");
}
const LOT_GROUPES_ECHEANCIER = 500;
async function echeancesDesGroupesPartiels(db, p) {
    const lecteur = db;
    const rendues = [];
    let curseur;
    for (;;) {
        const lot = (await lecteur.lettrage.findMany({
            where: {
                tenantId: p.tenantId,
                statut: client_1.StatutLettrage.PARTIEL,
                verrouille: false,
                compte: { numero: { startsWith: p.sens === 'FOURNISSEUR' ? '40' : '41' } },
                lignes: { some: { ecriture: { tenantId: p.tenantId, exerciceId: p.exerciceId } } },
                NOT: { lignes: { some: { ecriture: { tenantId: p.tenantId, exerciceId: { not: p.exerciceId } } } } },
            },
            select: SELECT_GROUPE,
            ...(0, lecture_par_lots_1.pageApres)(curseur, LOT_GROUPES_ECHEANCIER),
        }));
        const origines = await (0, reconduction_lettrage_1.originesDesLignes)(db, p.tenantId, lot);
        for (const g of lot) {
            if (g.lignes.some((l) => l.ecriture.exerciceId !== p.exerciceId))
                continue;
            for (const [ligneId, reste] of restesDuGroupe(g, p.sens, origines)) {
                if (factureEncoreDue(reste))
                    rendues.push({ ligneId, groupe: { id: g.id, code: g.code }, reste });
            }
        }
        if (lot.length < LOT_GROUPES_ECHEANCIER)
            return rendues;
        curseur = lot[lot.length - 1].id;
    }
}
function motifDeviseIndeterminee(numero, code) {
    return (`${numero} · la facture en devise choisie appartient au lettrage partiel ${code.toLowerCase()}, qui porte un acompte, un règlement ou ` +
        'un avoir en francs seuls (ou dans une autre devise) · ce qu’il en a réglé dans sa devise ne se déduit pas (AUDCIF art. 54 et 55), et son ' +
        'reste en devise est inconnu. Deux issues · passez le règlement au journal de trésorerie et lettrez-le à la main depuis Interrogation et ' +
        'lettrage ; ou annulez l’acompte en francs (inscription en négatif) et repassez-le avec son montant en devise, puis réglez la facture ici.');
}
function nomDeLaFacture(l, origines) {
    return `« ${l.libelle ?? l.ecriture.libelle} » du ${(origines.get(l.id)?.date ?? l.ecriture.date).toISOString().slice(0, 10)}`;
}
function avertissementImputationDuGroupe(e) {
    const lignes = lignesDuGroupe(e.groupe, e.origines);
    const paiement = {
        id: '__reglement',
        debit: e.sens === 'FOURNISSEUR' ? e.montant : 0,
        credit: e.sens === 'CLIENT' ? e.montant : 0,
        deviseId: e.deviseId,
        montantDevise: e.deviseId ? e.montant : null,
        date: e.date,
    };
    const sens = sensDesFactures(e.sens);
    const portees = (avant, apres) => {
        const dites = [];
        for (const l of e.groupe.lignes) {
            if (e.choisies.includes(l.id))
                continue;
            const a = avant.get(l.id);
            const b = apres.get(l.id);
            if (!a || !b)
                continue;
            const pris = e.deviseId ? (a.devise ?? 0) - (b.devise ?? 0) : a.francs - b.francs;
            if (pris > 0.005)
                dites.push(`${pris.toFixed(2)}${e.deviseId ? ' en devise' : ''} sur ${nomDeLaFacture(l, e.origines)}`);
        }
        return dites;
    };
    const inscription = portees((0, reconduction_lettrage_1.restesDesFactures)(lignes, sens), (0, reconduction_lettrage_1.restesDesFactures)([...lignes, paiement], sens));
    const legale = portees((0, reconduction_lettrage_1.restesParLImputationLegale)(lignes, sens), (0, reconduction_lettrage_1.restesParLImputationLegale)([...lignes, paiement], sens));
    const phrases = [];
    if (inscription.length > 0) {
        phrases.push(`le règlement s’inscrit d’abord sur les factures les plus anciennes du groupe · ${inscription.join(' et ')}, avant la facture choisie, ` +
            'qui reste due d’autant');
    }
    if (legale.length > 0) {
        phrases.push('à défaut d’imputation déclarée, la déclaration de TVA suit l’imputation légale (Code civil, Livre III, art. 154 · les factures ' +
            `échues d’abord, puis la plus ancienne, au prorata à date égale), qui porte ${legale.join(' et ')} de ce règlement · la date ` +
            'd’exigibilité ou de déduction de leur TVA suit cette imputation');
    }
    if (phrases.length === 0)
        return null;
    return `${e.numero} · lettrage partiel ${e.groupe.code.toLowerCase()} · ${phrases.join(' ; ')}.`;
}
//# sourceMappingURL=lettrage-partiel.js.map