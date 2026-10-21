"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.horsDuReport = horsDuReport;
exports.ligneAEcrire = ligneAEcrire;
exports.sommesDesLignes = sommesDesLignes;
exports.soldeDuCompte = soldeDuCompte;
exports.resultatDesComptesDeGestion = resultatDesComptesDeGestion;
exports.lignesReportANouveau = lignesReportANouveau;
exports.confrontationDeLOuverture = confrontationDeLOuverture;
exports.ouvertureNulle = ouvertureNulle;
exports.rectificationDeLOuverture = rectificationDeLOuverture;
exports.apparierTenues = apparierTenues;
exports.budgetsAReporter = budgetsAReporter;
function horsDuReport(numero, referentiel) {
    return referentiel === 'SYCEBNL' && (numero.startsWith('90') || numero.startsWith('91'));
}
function ligneAEcrire(l, id) {
    const colonnes = { ...l, ...(id ? { id } : {}) };
    delete colonnes.origineId;
    return colonnes;
}
const EPSILON = 0.005;
const arrondi2 = (x) => Math.round(x * 100) / 100;
function sommesDesLignes(lignes) {
    let debit = 0;
    let credit = 0;
    const enDevise = new Map();
    for (const l of lignes) {
        debit += l.debit;
        credit += l.credit;
        if (!l.deviseId || !l.montantDevise)
            continue;
        const sens = l.debit - l.credit >= 0 ? 1 : -1;
        const cle = `${l.deviseId}|${sens}`;
        const g = enDevise.get(cle) ?? { deviseId: l.deviseId, sens, debit: 0, credit: 0, montantDevise: 0 };
        g.debit += l.debit;
        g.credit += l.credit;
        g.montantDevise += l.montantDevise;
        enDevise.set(cle, g);
    }
    return { debit, credit, enDevise: [...enDevise.values()] };
}
function sommesDuCompte(c) {
    return c.sommes ?? sommesDesLignes(c.lignes ?? []);
}
function soldeDuCompte(c) {
    const s = sommesDuCompte(c);
    return s.debit - s.credit;
}
function soldesParDevise(s) {
    const parDevise = new Map();
    for (const g of s.enDevise) {
        const d = parDevise.get(g.deviseId) ?? { deviseId: g.deviseId, francs: 0, devise: 0 };
        d.francs += g.debit - g.credit;
        d.devise += g.sens * g.montantDevise;
        parDevise.set(g.deviseId, d);
    }
    return [...parDevise.values()]
        .sort((a, b) => (a.deviseId < b.deviseId ? -1 : a.deviseId > b.deviseId ? 1 : 0))
        .map((g) => ({ ...g, francs: arrondi2(g.francs), devise: arrondi2(g.devise) }))
        .filter((g) => Math.abs(g.francs) > EPSILON && Math.abs(g.devise) > EPSILON && Math.sign(g.francs) === Math.sign(g.devise));
}
function resultatDesComptesDeGestion(comptes) {
    return arrondi2(comptes.filter((c) => c.modeReportANouveau === 'AUCUN').reduce((s, c) => s + soldeDuCompte(c), 0));
}
function lignesReportANouveau(comptes, resultat) {
    const lignes = [];
    for (const c of comptes.filter((x) => x.modeReportANouveau === 'SOLDE')) {
        const sommes = sommesDuCompte(c);
        const s = sommes.debit - sommes.credit + (resultat && c.id === resultat.compteId ? resultat.montant : 0);
        if (Math.abs(s) <= EPSILON)
            continue;
        let reste = s;
        for (const g of soldesParDevise(sommes)) {
            lignes.push({
                compteId: c.id,
                debit: g.francs > 0 ? g.francs : 0,
                credit: g.francs < 0 ? -g.francs : 0,
                libelle: `Report à-nouveau ${c.numero} · ${c.intitule} · en devise`,
                deviseId: g.deviseId,
                montantDevise: Math.abs(g.devise),
                coursApplique: Math.round((Math.abs(g.francs) / Math.abs(g.devise)) * 1e6) / 1e6,
            });
            reste -= g.francs;
        }
        reste = arrondi2(reste);
        if (Math.abs(reste) <= EPSILON)
            continue;
        lignes.push({
            compteId: c.id,
            debit: reste > 0 ? reste : 0,
            credit: reste < 0 ? -reste : 0,
            libelle: `Report à-nouveau ${c.numero} · ${c.intitule}`,
        });
    }
    for (const c of comptes.filter((x) => x.modeReportANouveau === 'DETAIL')) {
        for (const l of c.lignes ?? []) {
            if (l.lettre)
                continue;
            lignes.push({
                compteId: c.id,
                debit: l.debit,
                credit: l.credit,
                libelle: `RAN détail ${c.numero} · ${l.libelle}`,
                ...(l.id ? { origineId: l.id } : {}),
                dateEcheance: l.dateEcheance,
                ...(l.deviseId && l.montantDevise
                    ? {
                        deviseId: l.deviseId,
                        montantDevise: l.montantDevise,
                        ...(l.coursApplique ? { coursApplique: l.coursApplique } : {}),
                    }
                    : {}),
            });
        }
    }
    return lignes;
}
function deviseDe(l) {
    return l.deviseId && l.montantDevise ? l.deviseId : null;
}
function confrontationDeLOuverture(report, passees) {
    const ordre = [];
    const parCle = new Map();
    const de = (compteId, deviseId) => {
        const cle = `${compteId}|${deviseId ?? ''}`;
        if (!parCle.has(cle)) {
            ordre.push(cle);
            parCle.set(cle, { compteId, deviseId, cloture: 0, ouverture: 0, clotureDevise: deviseId ? 0 : null, ouvertureDevise: deviseId ? 0 : null });
        }
        return parCle.get(cle);
    };
    const sens = (l) => (l.debit - l.credit >= 0 ? 1 : -1);
    for (const l of report) {
        const p = de(l.compteId, deviseDe(l));
        p.cloture += l.debit - l.credit;
        if (p.clotureDevise !== null)
            p.clotureDevise += sens(l) * (l.montantDevise ?? 0);
    }
    for (const l of passees) {
        const p = de(l.compteId, deviseDe(l));
        p.ouverture += l.debit - l.credit;
        if (p.ouvertureDevise !== null)
            p.ouvertureDevise += sens(l) * (l.montantDevise ?? 0);
    }
    const arr = (x) => (x === null ? null : arrondi2(x));
    return ordre
        .map((cle) => {
        const p = parCle.get(cle);
        return { ...p, cloture: arrondi2(p.cloture), ouverture: arrondi2(p.ouverture), clotureDevise: arr(p.clotureDevise), ouvertureDevise: arr(p.ouvertureDevise) };
    })
        .filter((p) => Math.abs(arrondi2(p.cloture - p.ouverture)) > EPSILON ||
        (p.deviseId !== null && Math.abs(arrondi2((p.clotureDevise ?? 0) - (p.ouvertureDevise ?? 0))) > EPSILON));
}
function ouvertureNulle(passees) {
    return confrontationDeLOuverture([], passees).length === 0;
}
function rectificationDeLOuverture(report, passees) {
    const comptesRectifies = [...new Set(confrontationDeLOuverture(report, passees).map((c) => c.compteId))];
    const lignes = [];
    const negatifs = [];
    for (const compteId of comptesRectifies) {
        for (const l of passees.filter((x) => x.compteId === compteId)) {
            negatifs.push({ rang: lignes.length, origine: l });
            lignes.push({
                compteId,
                debit: arrondi2(-l.debit),
                credit: arrondi2(-l.credit),
                libelle: `Inscription en négatif · ${l.libelle ?? 'bilan d’ouverture'}`.slice(0, 250),
                dateEcheance: l.dateEcheance,
                ...(deviseDe(l) ? { deviseId: l.deviseId, montantDevise: l.montantDevise, ...(l.coursApplique ? { coursApplique: l.coursApplique } : {}) } : {}),
            });
        }
        lignes.push(...report.filter((x) => x.compteId === compteId));
    }
    return { lignes, comptesRectifies, negatifs };
}
function apparierTenues(tenues, candidates) {
    const prises = new Set();
    const memeDevise = (t, c) => c.compteId === t.compteId &&
        Math.abs(c.debit - t.debit) <= EPSILON &&
        Math.abs(c.credit - t.credit) <= EPSILON &&
        (deviseDe(c) ?? null) === (deviseDe(t) ?? null) &&
        Math.abs((c.montantDevise ?? 0) - (t.montantDevise ?? 0)) <= EPSILON;
    const exacte = (t, c) => memeDevise(t, c) && (c.dateEcheance?.getTime() ?? null) === (t.dateEcheance?.getTime() ?? null);
    const resultat = tenues.map(() => null);
    tenues.forEach((t, i) => {
        const c = candidates.find((x) => !prises.has(x.id) && exacte(t, x));
        if (c) {
            prises.add(c.id);
            resultat[i] = c.id;
        }
    });
    tenues.forEach((t, i) => {
        if (resultat[i] !== null)
            return;
        const possibles = candidates.filter((x) => !prises.has(x.id) && memeDevise(t, x));
        const rivales = tenues.filter((u, j) => j !== i && resultat[j] === null && possibles.some((x) => memeDevise(u, x)));
        if (possibles.length === 1 && rivales.length === 0) {
            prises.add(possibles[0].id);
            resultat[i] = possibles[0].id;
        }
    });
    return resultat;
}
function budgetsAReporter(budgets, dejaDotes, sectionsCloses) {
    const pris = new Set(dejaDotes.map((b) => `${b.sectionId}|${b.mois ?? ''}`));
    return budgets.filter((b) => !sectionsCloses.has(b.sectionId) && !pris.has(`${b.sectionId}|${b.mois ?? ''}`));
}
//# sourceMappingURL=report-a-nouveau.js.map