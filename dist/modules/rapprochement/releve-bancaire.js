"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FENETRE_JOURS_MAX = exports.FENETRE_JOURS_DEFAUT = void 0;
exports.reconnaitreColonnes = reconnaitreColonnes;
exports.lireReleve = lireReleve;
exports.arrondi = arrondi;
exports.montantVuDuCompte = montantVuDuCompte;
exports.memeReference = memeReference;
exports.proposerCorrespondances = proposerCorrespondances;
const lecture_fichier_1 = require("../import/lecture-fichier");
function normaliser(entete) {
    return entete
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
}
function reconnaitreColonnes(colonnes, imposees = {}) {
    const index = {};
    const normes = colonnes.map(normaliser);
    const chercher = (test) => {
        const i = normes.findIndex((n, k) => test(n) && !Object.values(index).includes(k));
        return i >= 0 ? i : undefined;
    };
    for (const [champ, nom] of Object.entries(imposees)) {
        const i = colonnes.indexOf(nom);
        if (i >= 0)
            index[champ] = i;
    }
    index.date ??= chercher((n) => /^date( (d )?operation| op| comptable)?$/.test(n));
    index.debit ??= chercher((n) => /^(debit|debits|retrait|retraits|sortie|sorties|montant debit)$/.test(n));
    index.credit ??= chercher((n) => /^(credit|credits|depot|depots|versement|versements|entree|entrees|montant credit)$/.test(n));
    if (index.debit === undefined && index.credit === undefined) {
        index.montant ??= chercher((n) => /^montant/.test(n));
    }
    index.libelle ??= chercher((n) => /^(libelle|libelles|description|designation|intitule|motif|operation|nature)/.test(n));
    index.reference ??= chercher((n) => /^(reference|ref|n piece|piece|numero|n cheque|cheque)/.test(n));
    return index;
}
function lireReleve(tableau, index) {
    const anomalies = [];
    if (index.date === undefined)
        anomalies.push('Colonne de date introuvable (attendu « Date » ou « Date opération »).');
    if (index.debit === undefined && index.credit === undefined && index.montant === undefined) {
        anomalies.push('Colonnes de montant introuvables (attendu « Débit » et « Crédit », ou « Montant »).');
    }
    if (anomalies.length > 0)
        return { lignes: [], anomalies };
    const lignes = [];
    const cell = (ligne, i) => (i === undefined ? '' : (ligne[i] ?? '').trim());
    tableau.lignes.forEach((ligne, k) => {
        const numero = k + 2;
        if (ligne.every((c) => (c ?? '').trim() === ''))
            return;
        const date = (0, lecture_fichier_1.lireDate)(cell(ligne, index.date));
        if (!date) {
            anomalies.push(`Ligne ${numero} : date illisible (« ${cell(ligne, index.date)} »).`);
            return;
        }
        let debit = 0;
        let credit = 0;
        if (index.montant !== undefined) {
            const m = (0, lecture_fichier_1.lireMontant)(cell(ligne, index.montant));
            if (m === null) {
                anomalies.push(`Ligne ${numero} : montant illisible (« ${cell(ligne, index.montant)} »).`);
                return;
            }
            if (m < 0)
                debit = -m;
            else
                credit = m;
        }
        else {
            const d = (0, lecture_fichier_1.lireMontant)(cell(ligne, index.debit));
            const c = (0, lecture_fichier_1.lireMontant)(cell(ligne, index.credit));
            if (d === null || c === null) {
                anomalies.push(`Ligne ${numero} : montant illisible.`);
                return;
            }
            if (d < 0 || c < 0) {
                anomalies.push(`Ligne ${numero} : montant négatif dans une colonne Débit ou Crédit.`);
                return;
            }
            debit = d;
            credit = c;
        }
        if (debit > 0 && credit > 0) {
            anomalies.push(`Ligne ${numero} : une opération porte à la fois un débit et un crédit.`);
            return;
        }
        if (debit === 0 && credit === 0) {
            return;
        }
        lignes.push({
            rang: lignes.length + 1,
            date,
            libelle: cell(ligne, index.libelle) || 'Opération bancaire',
            reference: cell(ligne, index.reference) || null,
            debit: arrondi(debit),
            credit: arrondi(credit),
        });
    });
    return { lignes, anomalies };
}
function arrondi(n) {
    return Math.round(n * 100) / 100;
}
function montantVuDuCompte(l) {
    return arrondi(l.credit - l.debit);
}
function memeReference(a, b) {
    const norme = (r) => (r ?? '').replace(/\s+/g, '').toUpperCase();
    const na = norme(a);
    const nb = norme(b);
    if (!na || !nb)
        return false;
    if (na === nb)
        return true;
    const chiffres = (r) => r.replace(/\D/g, '');
    const ca = chiffres(na);
    return ca.length >= 3 && ca === chiffres(nb);
}
exports.FENETRE_JOURS_DEFAUT = 15;
exports.FENETRE_JOURS_MAX = 120;
const JOUR_MS = 86_400_000;
function proposerCorrespondances(releve, compte, fenetreJours = exports.FENETRE_JOURS_DEFAUT) {
    const propositions = [];
    const prisesCompte = new Set();
    const prisesReleve = new Set();
    const vuDuCompte = (l) => arrondi(l.debit - l.credit);
    const dansLaFenetre = (c, r) => Math.abs(c.date.getTime() - r.date.getTime()) <= fenetreJours * JOUR_MS;
    const passe = (critere, motif) => {
        const candidatsDe = new Map();
        for (const r of releve) {
            if (prisesReleve.has(r.id))
                continue;
            const m = montantVuDuCompte(r);
            const ids = compte
                .filter((c) => !prisesCompte.has(c.id) && vuDuCompte(c) === m && dansLaFenetre(c, r) && critere(r, c))
                .map((c) => c.id);
            if (ids.length > 0)
                candidatsDe.set(r.id, ids);
        }
        const demandes = new Map();
        for (const ids of candidatsDe.values())
            for (const id of ids)
                demandes.set(id, (demandes.get(id) ?? 0) + 1);
        for (const r of releve) {
            const ids = candidatsDe.get(r.id);
            if (!ids || ids.length !== 1)
                continue;
            if (demandes.get(ids[0]) !== 1)
                continue;
            propositions.push({ ligneReleveId: r.id, ligneEcritureIds: ids, motif });
            prisesCompte.add(ids[0]);
            prisesReleve.add(r.id);
        }
    };
    passe((r, c) => !!r.reference && memeReference(r.reference, c.reference), 'REFERENCE');
    passe(() => true, 'MONTANT_DATE');
    return propositions;
}
//# sourceMappingURL=releve-bancaire.js.map