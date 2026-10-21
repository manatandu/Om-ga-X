"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.natureDeLaRacine = void 0;
exports.racineDeGestion = racineDeGestion;
exports.montantsParRacine = montantsParRacine;
exports.motifRefusSimulation = motifRefusSimulation;
exports.prorataTemporis = prorataTemporis;
exports.ecartDefavorablePct = ecartDefavorablePct;
exports.jaugeDe = jaugeDe;
exports.simuler = simuler;
const RACINE = /^[67]\d$/;
function racineDeGestion(numero) {
    const r = numero.slice(0, 2);
    return RACINE.test(r) ? r : null;
}
const natureDeLaRacine = (racine) => (racine.startsWith('7') ? 'PRODUIT' : 'CHARGE');
exports.natureDeLaRacine = natureDeLaRacine;
function montantsParRacine(lignes) {
    const m = new Map();
    for (const l of lignes) {
        const r = racineDeGestion(l.numero);
        if (!r)
            continue;
        const net = (0, exports.natureDeLaRacine)(r) === 'PRODUIT' ? l.mouvementCredit - l.mouvementDebit : l.mouvementDebit - l.mouvementCredit;
        m.set(r, (m.get(r) ?? 0) + net);
    }
    return m;
}
function motifRefusSimulation(h, s) {
    const taux = (x) => typeof x === 'number' && Number.isFinite(x) && x >= -100 && x <= 1000;
    if (!taux(h.croissanceProduitsPct))
        return 'La croissance du chiffre d’affaires est un pourcentage entre -100 et 1000.';
    for (const [r, v] of Object.entries(h.variations ?? {})) {
        if (!RACINE.test(r))
            return `« ${r} » n'est pas un compte à deux chiffres des classes 6 ou 7.`;
        if (!taux(v))
            return `Le taux de la ligne ${r} est un pourcentage entre -100 et 1000.`;
    }
    const seuil = (x) => typeof x === 'number' && Number.isFinite(x) && x >= 0 && x <= 1000;
    if (!seuil(s.orangePct) || !seuil(s.rougePct) || s.orangePct >= s.rougePct) {
        return 'Les seuils de la jauge sont deux pourcentages positifs, l’orange strictement sous le rouge.';
    }
    return null;
}
function prorataTemporis(dateDebut, dateFin, arreteAu) {
    const jourDe = (d) => Math.floor(d.getTime() / 86_400_000);
    const total = jourDe(dateFin) - jourDe(dateDebut) + 1;
    const ecoules = jourDe(arreteAu) - jourDe(dateDebut) + 1;
    if (total <= 0)
        return 1;
    return Math.min(1, Math.max(0, ecoules / total));
}
function ecartDefavorablePct(nature, prevu, realise) {
    if (prevu === 0)
        return null;
    const ecart = nature === 'PRODUIT' ? prevu - realise : realise - prevu;
    return (ecart / Math.abs(prevu)) * 100;
}
function jaugeDe(ecartPct, s) {
    if (ecartPct === null)
        return null;
    if (ecartPct <= s.orangePct)
        return 'VERT';
    if (ecartPct <= s.rougePct)
        return 'ORANGE';
    return 'ROUGE';
}
const arrondi = (n) => Math.round(n * 100) / 100;
function simuler(p) {
    const racines = [...new Set([...p.reference.keys(), ...(p.realise?.keys() ?? []), ...Object.keys(p.hypotheses.variations ?? {})])].sort();
    const lignes = racines.map((racine) => {
        const nature = (0, exports.natureDeLaRacine)(racine);
        const reference = arrondi(p.reference.get(racine) ?? 0);
        const tauxPct = p.hypotheses.variations?.[racine] ?? (nature === 'PRODUIT' ? p.hypotheses.croissanceProduitsPct : 0);
        const prevuAnnuel = arrondi(reference * (1 + tauxPct / 100));
        const prevuADate = arrondi(prevuAnnuel * p.prorata);
        const realise = p.realise ? arrondi(p.realise.get(racine) ?? 0) : null;
        const ecart = realise === null ? null : ecartDefavorablePct(nature, prevuADate, realise);
        return {
            racine,
            intitule: p.intitules.get(racine) ?? '',
            nature,
            reference,
            tauxPct,
            prevuAnnuel,
            prevuADate,
            realise,
            ecartDefavorablePct: ecart === null ? null : arrondi(ecart),
            jauge: jaugeDe(ecart, p.seuils),
        };
    });
    const total = (nature, champ) => arrondi(lignes.filter((l) => l.nature === nature).reduce((s, l) => s + (l[champ] ?? 0), 0));
    const totaux = (champ) => {
        const produits = total('PRODUIT', champ);
        const charges = total('CHARGE', champ);
        return { produits, charges, resultatActivitesOrdinaires: arrondi(produits - charges) };
    };
    const prevuADate = totaux('prevuADate');
    const realise = p.realise ? totaux('realise') : null;
    const ecartResultat = realise ? ecartDefavorablePct('PRODUIT', prevuADate.resultatActivitesOrdinaires, realise.resultatActivitesOrdinaires) : null;
    return {
        lignes,
        totaux: {
            reference: totaux('reference'),
            prevuAnnuel: totaux('prevuAnnuel'),
            prevuADate,
            realise,
            jaugeResultat: jaugeDe(ecartResultat, p.seuils),
            ecartResultatPct: ecartResultat === null ? null : arrondi(ecartResultat),
        },
    };
}
//# sourceMappingURL=simulateur-budgetaire.js.map