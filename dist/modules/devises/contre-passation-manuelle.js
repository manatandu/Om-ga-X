"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PLAFOND_SOUS_ENSEMBLES = void 0;
exports.montantsAContrePasser = montantsAContrePasser;
exports.libelleMontantsAContrePasser = libelleMontantsAContrePasser;
exports.libelleMontantsDeLEcart = libelleMontantsDeLEcart;
exports.motifRefusInversion = motifRefusInversion;
exports.disponibilitesInversees = disponibilitesInversees;
exports.verdictDeLEtat = verdictDeLEtat;
exports.jugerLEtat = jugerLEtat;
const centimes = (x) => Math.round(x * 100);
function montantsAContrePasser(lignes) {
    const parCompte = new Map();
    for (const l of lignes) {
        const m = parCompte.get(l.compteId) ?? { compteId: l.compteId, compteNumero: l.compteNumero, netCentimes: 0 };
        m.netCentimes += centimes(Number(l.debit)) - centimes(Number(l.credit));
        parCompte.set(l.compteId, m);
    }
    return [...parCompte.values()].filter((m) => m.netCentimes !== 0).sort((a, b) => a.compteNumero.localeCompare(b.compteNumero));
}
const enFrancs = (c) => (Math.abs(c) / 100).toFixed(2);
function libelleMontantsAContrePasser(montants) {
    return montants.map((m) => `${m.compteNumero} au ${m.netCentimes > 0 ? 'crédit' : 'débit'} de ${enFrancs(m.netCentimes)}`).join(', ');
}
function libelleMontantsDeLEcart(montants) {
    return montants.map((m) => `${m.compteNumero} au ${m.netCentimes > 0 ? 'débit' : 'crédit'} de ${enFrancs(m.netCentimes)}`).join(', ');
}
function motifRefusInversion(attendus, lignesDeLEcriture) {
    if (attendus.length === 0) {
        return "Cette réévaluation n'a aucun écart de conversion à contre-passer · il n'y a rien à déclarer.";
    }
    const ecarts = [];
    for (const a of attendus) {
        const surLeCompte = lignesDeLEcriture.filter((l) => l.compteId === a.compteId);
        if (surLeCompte.some((l) => Number(l.debit) < 0 || Number(l.credit) < 0)) {
            ecarts.push(`${a.compteNumero} · montants négatifs (inscription en négatif) · une correction annule une écriture, elle ne contre-passe pas un écart`);
            continue;
        }
        const debits = surLeCompte.reduce((t, l) => t + centimes(Number(l.debit)), 0);
        const credits = surLeCompte.reduce((t, l) => t + centimes(Number(l.credit)), 0);
        const oppose = a.netCentimes > 0 ? credits : debits;
        const memeCote = a.netCentimes > 0 ? debits : credits;
        const sensOppose = a.netCentimes > 0 ? 'crédit' : 'débit';
        const sensEcart = a.netCentimes > 0 ? 'débit' : 'crédit';
        if (oppose === Math.abs(a.netCentimes) && memeCote === 0)
            continue;
        const lu = oppose === 0 ? 'rien' : `${sensOppose} de ${enFrancs(oppose)}`;
        ecarts.push(`${a.compteNumero} · attendu ${sensOppose} de ${enFrancs(a.netCentimes)}, l'écriture porte ${lu}` +
            (memeCote !== 0 ? `, et un ${sensEcart} de ${enFrancs(memeCote)}` : ''));
    }
    if (ecarts.length === 0)
        return null;
    return ("L'écriture désignée n'inverse pas exactement l'écart de conversion de cette réévaluation · " +
        `${ecarts.join(' ; ')}. Une contre-passation partielle laisserait une part de l'écart en place, que la réévaluation ` +
        "suivante repasserait ; une contre-passation qui déborde déplacerait autre chose sur le même compte. Désignez l'écriture " +
        'qui contre-passe chacun de ces comptes au centime, du côté opposé et en montants positifs. Une écriture qui contre-passe ' +
        "plusieurs réévaluations à la fois, ou une part seulement de l'écart, ne se déclare pas · corrigez-la par inscription en " +
        "négatif (AUDCIF art. 20, al. 2), puis contre-passez chaque réévaluation séparément.");
}
function disponibilitesInversees(realisees, lignesDeLEcriture, estDisponibilite) {
    const inversees = new Set();
    for (const a of montantsAContrePasser(realisees.filter((l) => estDisponibilite(l.compteNumero)))) {
        const net = lignesDeLEcriture
            .filter((l) => l.compteId === a.compteId)
            .reduce((t, l) => t + centimes(Number(l.debit)) - centimes(Number(l.credit)), 0);
        if (net === -a.netCentimes)
            inversees.add(a.compteId);
    }
    return inversees;
}
exports.PLAFOND_SOUS_ENSEMBLES = 12;
function verdictDeLEtat(p) {
    const attendu = new Map();
    for (const c of p.comptes)
        attendu.set(c, p.enPlace.reduce((t, r) => t + (r.ecart.get(c) ?? 0), 0));
    const manque = p.comptes.map((c) => (attendu.get(c) ?? 0) - (p.lu.get(c) ?? 0));
    const utiles = p.enPlace.filter((r) => p.comptes.some((c) => (r.ecart.get(c) ?? 0) !== 0));
    if (utiles.length > exports.PLAFOND_SOUS_ENSEMBLES)
        return { verdict: 'ANOMALIE', attendu, trop: true };
    let avec = 0;
    let sans = 0;
    for (let masque = 0; masque < 1 << utiles.length; masque++) {
        const somme = p.comptes.map((c) => utiles.reduce((t, r, i) => (masque & (1 << i) ? t + (r.ecart.get(c) ?? 0) : t), 0));
        if (!somme.every((s, i) => s === manque[i]))
            continue;
        if (utiles.some((r, i) => masque & (1 << i) && r.id === p.reevaluationId))
            avec++;
        else
            sans++;
    }
    const verdict = avec === 0 && sans === 0 ? 'ANOMALIE' : avec > 0 && sans > 0 ? 'AMBIGU' : avec > 0 ? 'CONTRE_PASSEE' : 'EN_PLACE';
    return { verdict, attendu, trop: false };
}
function jugerLEtat(p) {
    const comptes = [...p.comptes47, ...p.comptesTiers];
    const attendu = new Map();
    for (const c of comptes)
        attendu.set(c, p.enPlace.reduce((t, r) => t + (r.ecart.get(c) ?? 0), 0));
    const lu = new Map();
    for (const c of p.comptes47)
        lu.set(c, p.lu47.get(c) ?? 0);
    for (const c of p.comptesTiers)
        lu.set(c, (attendu.get(c) ?? 0) + (p.ecartTiers.get(c) ?? 0));
    const juger = (gestes) => {
        const apres = new Map(lu);
        for (const g of gestes) {
            if (g.type === 'RETABLIR') {
                for (const c of comptes)
                    apres.set(c, (apres.get(c) ?? 0) + (p.ecartX.get(c) ?? 0));
            }
            else {
                for (const e of g.ecritures)
                    for (const c of comptes)
                        apres.set(c, (apres.get(c) ?? 0) - (e.effet.get(c) ?? 0));
            }
        }
        return verdictDeLEtat({ comptes, lu: apres, enPlace: p.enPlace, reevaluationId: p.reevaluationId });
    };
    const premier = juger([]);
    const essais = [[]];
    const avecRetablissement = (gestes) => {
        essais.push(gestes);
        if (p.retablissable)
            essais.push([...gestes, { type: 'RETABLIR' }]);
    };
    if (p.retablissable)
        essais.push([{ type: 'RETABLIR' }]);
    if (p.ecritures && p.ecritures.length > 0) {
        const vus = new Set();
        const lot = (liste) => {
            if (liste.length === 0)
                return;
            const cle = liste.map((e) => e.id).sort().join(',');
            if (vus.has(cle))
                return;
            vus.add(cle);
            avecRetablissement([{ type: 'NEUTRALISER', ecritures: liste }]);
        };
        const toutes = p.ecritures;
        lot(toutes.filter((e) => e.horsDeLEcart && !e.exacte));
        lot(toutes.filter((e) => !e.exacte));
        for (const gardee of toutes.filter((e) => e.exacte).slice(0, 3))
            lot(toutes.filter((e) => e.id !== gardee.id));
        lot(toutes);
    }
    for (const gestes of essais) {
        const j = gestes.length === 0 ? premier : juger(gestes);
        if (j.verdict === 'EN_PLACE') {
            return { verdict: premier.verdict, attendu, lu, trop: premier.trop, issue: { gestes, fin: 'CONTRE_PASSER' } };
        }
        if (j.verdict === 'CONTRE_PASSEE' || j.verdict === 'AMBIGU') {
            const neutralisees = new Set(gestes.flatMap((g) => (g.type === 'NEUTRALISER' ? g.ecritures.map((e) => e.id) : [])));
            const exacte = (p.ecritures ?? []).find((e) => e.exacte && !neutralisees.has(e.id));
            if (exacte)
                return { verdict: premier.verdict, attendu, lu, trop: premier.trop, issue: { gestes, fin: 'DECLARER', ecriture: exacte } };
        }
    }
    return { verdict: premier.verdict, attendu, lu, trop: premier.trop, issue: null };
}
//# sourceMappingURL=contre-passation-manuelle.js.map