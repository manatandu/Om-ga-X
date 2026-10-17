"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.lignesAvecMouvements = lignesAvecMouvements;
exports.construireTableauFluxConsolide = construireTableauFluxConsolide;
exports.construireVariationCapitauxPropres = construireVariationCapitauxPropres;
exports.variationsDuPerimetre = variationsDuPerimetre;
exports.changementsDuPerimetre = changementsDuPerimetre;
const client_1 = require("@prisma/client");
const r2 = (x) => Math.round(x * 100) / 100;
const somme = (xs) => r2(xs.reduce((s, x) => s + (x ?? 0), 0));
const EPS = 0.005;
const classeDe = (numero) => {
    const c = `CLASSE_${numero[0]}`;
    return Object.values(client_1.ClasseCompte).includes(c) ? c : null;
};
function lignesAvecMouvements(cumul) {
    const parCle = new Map();
    const ligne = (cle, intitule) => {
        const classe = classeDe(cle);
        if (!classe)
            return null;
        let l = parCle.get(cle);
        if (!l) {
            l = {
                compteId: cle,
                numero: cle,
                intitule,
                classe,
                typeCompte: client_1.TypeCompteDetailTotal.DETAIL,
                totalDebit: 0,
                totalCredit: 0,
                reportDebit: 0,
                reportCredit: 0,
                mouvementDebit: 0,
                mouvementCredit: 0,
                solde: 0,
            };
            parCle.set(cle, l);
        }
        return l;
    };
    for (const c of cumul.lignes) {
        if (!/^\d/.test(c.cle))
            continue;
        const l = ligne(c.cle, c.intitule);
        if (!l)
            continue;
        l.solde = c.solde;
        l.totalDebit = c.solde > 0 ? c.solde : 0;
        l.totalCredit = c.solde < 0 ? -c.solde : 0;
    }
    for (const m of cumul.mouvements) {
        const l = ligne(m.cle, m.intitule);
        if (!l)
            continue;
        l.mouvementDebit = m.debit;
        l.mouvementCredit = m.credit;
    }
    return [...parCle.values()];
}
const solde = (lignes, prefixe) => somme(lignes.filter((l) => l.numero.startsWith(prefixe)).map((l) => l.solde));
const soldeCumul = (cumul, cle) => cumul.lignes.find((l) => l.cle === cle)?.solde ?? 0;
const minoritairesTotal = (cumul) => r2(cumul.capitauxPropres.interetsMinoritairesHorsResultat + cumul.capitauxPropres.resultatMinoritaires);
function construireTableauFluxConsolide(e, flux) {
    const obstacles = [...e.cumulN.obstaclesFlux, ...e.variationsPerimetre];
    if (obstacles.length > 0)
        return { lignes: null, obstacles, controle: null };
    const conso = flux(lignesAvecMouvements(e.cumulN), lignesAvecMouvements(e.cumulN1));
    const mere = flux(e.consolidanteN, e.consolidanteN1);
    const f = (ref) => r2(conso.get(ref) ?? 0);
    const fm = (ref) => r2(mere.get(ref) ?? 0);
    const L = (cle, libelle, nature, net, extra = {}) => ({
        cle,
        libelle,
        nature,
        net: net == null ? null : r2(net),
        ...extra,
    });
    const a = L('TRESORERIE_OUVERTURE', 'Trésorerie nette au 1er janvier (A)', 'TOTAL', f('ZA'), {
        lecture: 'Trésorerie-actif moins trésorerie-passif du bilan consolidé N-1.',
    });
    const elimination = -soldeCumul(e.cumulN, 'ELIMINATION_RESULTATS_INTERNES') - e.cumulN.ecartsEvaluationStocksResultat;
    const cafg = L('CAFG', 'Capacité d’autofinancement globale (CAFG)', 'POSTE', f('FA') + elimination, {
        lecture: 'Formule du ch. 5 § 1.2.1.1 (FA) sur les comptes consolidés' +
            (Math.abs(elimination) > EPS ? ', diminuée des résultats internes éliminés (art. 86, 4°) et des écarts d’évaluation des stocks sortis, que la variation des stocks et des acquisitions lirait sinon comme un encaissement.' : '.'),
    });
    const bf = L('VARIATION_BF', 'Variation du besoin de financement lié aux activités opérationnelles', 'POSTE', somme(['FB', 'FC', 'FD', 'FE'].map(f)), {
        lecture: 'Actif circulant HAO, stocks, créances et passif circulant (FB à FE).',
    });
    const divMe = L('DIVIDENDES_RECUS_ME', 'Dividendes reçus des entités mises en équivalence', 'POSTE', e.cumulN.dividendesRecusMe, {
        lecture: 'Encaissés par la détentrice et éliminés de son résultat · leur contrepartie est la baisse des titres mis en équivalence.',
    });
    const b = L('FLUX_OPERATIONNELS', 'Flux de trésorerie provenant des activités opérationnelles (B)', 'TOTAL', somme([cafg.net, bf.net, divMe.net]));
    const c1 = L('DECAISSEMENTS_INCORPORELLES', 'Décaissements liés aux acquisitions d’immobilisations incorporelles', 'POSTE', f('FF'));
    const c2 = L('DECAISSEMENTS_CORPORELLES', 'Décaissements liés aux acquisitions d’immobilisations corporelles', 'POSTE', f('FG'));
    const c3 = L('DECAISSEMENTS_FINANCIERES', 'Décaissements liés aux acquisitions d’immobilisations financières', 'POSTE', f('FH'));
    const c4 = L('ENCAISSEMENTS_CESSIONS', 'Encaissements liés aux cessions d’immobilisations incorporelles et corporelles', 'POSTE', f('FI'));
    const c5 = L('ENCAISSEMENTS_FINANCIERES', 'Encaissements liés aux cessions et remboursements d’immobilisations financières', 'POSTE', f('FJ'));
    const perimetre = L('INCIDENCE_PERIMETRE', 'Incidence des variations de périmètre', 'POSTE', 0, {
        lecture: 'Nulle · même périmètre et mêmes pourcentages qu’en N-1, condition de production du tableau.',
    });
    const c = L('FLUX_INVESTISSEMENT', 'Flux de trésorerie provenant des activités d’investissement (C)', 'TOTAL', somme([c1, c2, c3, c4, c5, perimetre].map((l) => l.net)));
    const capital = L('AUGMENTATIONS_CAPITAL', 'Augmentations de capital (consolidante)', 'POSTE', fm('FK'), {
        lecture: 'Apports nouveaux lus sur les comptes de la consolidante (FK) · un capital de filiale qui bouge arrête le tableau.',
    });
    const subventions = L('SUBVENTIONS_INVESTISSEMENT', 'Subventions d’investissement reçues', 'POSTE', f('FL'), {
        lecture: 'Poste du modèle individuel (FL) que le modèle consolidé ne nomme pas · montré plutôt que fondu.',
    });
    const prelevements = L('PRELEVEMENTS_CAPITAL', 'Prélèvements et remboursements de capital (consolidante)', 'POSTE', fm('FM'));
    const dividendesMere = L('DIVIDENDES_CONSOLIDANTE', 'Dividendes versés par la consolidante', 'POSTE', fm('FN'), {
        lecture: 'Débit du 465 de la consolidante (FN).',
    });
    const attribueMinoritaires = r2(minoritairesTotal(e.cumulN1) + e.cumulN.capitauxPropres.resultatMinoritaires - minoritairesTotal(e.cumulN));
    const dus465Filiales = (cumul, mere) => r2(-somme(cumul.lignes.filter((l) => l.cle.startsWith('465')).map((l) => l.solde)) + solde(mere, '465'));
    const hausseDus = r2(dus465Filiales(e.cumulN, e.consolidanteN) - dus465Filiales(e.cumulN1, e.consolidanteN1));
    const dividendesMinoritaires = L('DIVIDENDES_MINORITAIRES', 'Dividendes versés aux minoritaires', 'POSTE', -(attribueMinoritaires - hausseDus), {
        lecture: 'Attribués aux minoritaires (leurs intérêts N-1, plus leur part du résultat N, moins leurs intérêts N), moins ce qui reste dû au 465 des filiales.',
    });
    const emprunts = L('EMPRUNTS', 'Emprunts', 'POSTE', f('FO'));
    const autresDettes = L('AUTRES_DETTES_FINANCIERES', 'Autres dettes financières', 'POSTE', f('FP'));
    const remboursements = L('REMBOURSEMENTS', 'Remboursements des emprunts et autres dettes financières', 'POSTE', f('FQ'));
    const lignesD = [capital, subventions, prelevements, dividendesMere, dividendesMinoritaires, emprunts, autresDettes, remboursements];
    const d = L('FLUX_FINANCEMENT', 'Flux de trésorerie provenant des activités de financement (D)', 'TOTAL', somme(lignesD.map((l) => l.net)));
    const eVar = L('VARIATION_PERIODE', 'Variation de la trésorerie nette de la période (E = B + C + D)', 'TOTAL', somme([b.net, c.net, d.net]));
    const fClot = L('TRESORERIE_CLOTURE', 'Trésorerie nette au 31 décembre (F = A + E)', 'TOTAL', somme([a.net, eVar.net]));
    const g = L('INCIDENCE_DEVISES', 'Incidence des variations de cours des devises (G)', 'POSTE', 0, {
        lecture: 'Aucune entité du périmètre n’est convertie · une entité convertie refuse le tableau, son incidence n’étant pas séparée par cette version.',
    });
    const h = L('VARIATION_HORS_DEVISES', 'Variation de la trésorerie nette (H = E − G)', 'TOTAL', r2((eVar.net ?? 0) - (g.net ?? 0)));
    const tresorerieParLeBilan = tresoreriePublieeN(e.cumulN, flux);
    const ecart = r2((fClot.net ?? 0) - tresorerieParLeBilan);
    const controle = { tresorerieParLesFlux: fClot.net ?? 0, tresorerieParLeBilan, ecart, ok: Math.abs(ecart) <= EPS };
    const lignes = [
        a,
        cafg,
        bf,
        ...(Math.abs(divMe.net ?? 0) > EPS ? [divMe] : []),
        b,
        c1,
        c2,
        c3,
        c4,
        c5,
        perimetre,
        c,
        ...lignesD.filter((l) => l === capital || l === dividendesMere || l === emprunts || l === remboursements || Math.abs(l.net ?? 0) > EPS),
        d,
        eVar,
        fClot,
        g,
        h,
    ];
    return { lignes, obstacles: [], controle };
}
function tresoreriePublieeN(cumulN, flux) {
    return r2(flux([], lignesAvecMouvements(cumulN)).get('ZA') ?? 0);
}
function construireVariationCapitauxPropres(cumulN, cumulN1, consolidanteN) {
    const ligne = (cle, libelle, m, lecture) => {
        const v = (k) => r2(m[k] ?? 0);
        const groupe = somme([v('capital'), v('primes'), v('reserves'), v('resultat'), v('conversion'), v('reevaluation')]);
        return {
            cle,
            libelle,
            montants: {
                capital: v('capital'),
                primes: v('primes'),
                reserves: v('reserves'),
                resultat: v('resultat'),
                conversion: v('conversion'),
                reevaluation: v('reevaluation'),
                groupe,
                minoritaires: v('minoritaires'),
                total: r2(groupe + v('minoritaires')),
            },
            ...(lecture ? { lecture } : {}),
        };
    };
    const n1 = cumulN1.capitauxPropres;
    const n = cumulN.capitauxPropres;
    const distribues = somme(consolidanteN.filter((l) => l.numero.startsWith('465')).map((l) => l.mouvementCredit));
    const autresReserves = r2(n.reservesGroupe - n1.reservesGroupe - n1.resultatGroupe + distribues);
    const lignes = [
        ligne('CLOTURE_N1', 'Capitaux propres à la clôture N-1', {
            capital: n1.capital,
            primes: n1.primes,
            reserves: n1.reservesGroupe,
            resultat: n1.resultatGroupe,
            conversion: n1.ecartsConversion,
            reevaluation: n1.ecartsReevaluation,
            minoritaires: minoritairesTotal(cumulN1),
        }),
        ligne('AFFECTATION_N1', 'Affectation du résultat N-1', { reserves: n1.resultatGroupe, resultat: -n1.resultatGroupe }),
        ligne('DISTRIBUTIONS_CONSOLIDANTE', 'Distributions de la consolidante', { reserves: -distribues }, 'Crédit du 465 de la consolidante, dividendes mis en paiement.'),
        ligne('VARIATION_CAPITAL', 'Variation du capital et des primes', { capital: r2(n.capital - n1.capital), primes: r2(n.primes - n1.primes) }),
        ligne('VARIATION_CONVERSION', 'Variation des écarts de conversion', { conversion: r2(n.ecartsConversion - n1.ecartsConversion) }),
        ligne('VARIATION_REEVALUATION', 'Variation des écarts de réévaluation', { reevaluation: r2(n.ecartsReevaluation - n1.ecartsReevaluation) }),
        ligne('RESULTAT_N', 'Résultat de l’exercice', { resultat: n.resultatGroupe, minoritaires: n.resultatMinoritaires }),
        ligne('AUTRES_RESERVES', 'Autres variations des réserves consolidées', { reserves: autresReserves }, 'Ce que ni l’affectation ni les distributions n’expliquent · une incorporation de réserves au capital, par exemple. Une ligne non nulle est à justifier en Notes annexes.'),
        ligne('MINORITAIRES_DISTRIBUTIONS', 'Distributions et autres variations des intérêts minoritaires', { minoritaires: r2(minoritairesTotal(cumulN) - minoritairesTotal(cumulN1) - n.resultatMinoritaires) }),
        ligne('CLOTURE_N', 'Capitaux propres à la clôture N', {
            capital: n.capital,
            primes: n.primes,
            reserves: n.reservesGroupe,
            resultat: n.resultatGroupe,
            conversion: n.ecartsConversion,
            reevaluation: n.ecartsReevaluation,
            minoritaires: minoritairesTotal(cumulN),
        }),
    ];
    return {
        lignes,
        reserves: [
            'Bloc de l’exercice N-1 du modèle (clôture N-2 corrigée, mouvements N-1) · il suppose de consolider N-2, ce que cette version ne fait pas.',
        ],
    };
}
const RETENUES = new Set(['IG', 'IP', 'ME']);
function variationsDuPerimetre(n, n1) {
    return changementsDuPerimetre(n, n1).map(({ motif: m }) => `${m} L’incidence des variations de périmètre (D4C ch. XII-8 § 4) n’est pas calculée par cette version · le tableau n’est pas établi.`);
}
function changementsDuPerimetre(n, n1) {
    const retenues = (xs) => new Map(xs.filter((e) => e.estConsolidante || RETENUES.has(e.methode)).map((e) => [e.nom.trim().toLowerCase(), e]));
    const a = retenues(n);
    const b = retenues(n1);
    const out = [];
    for (const [cle, e] of a) {
        const p = b.get(cle);
        if (!p)
            out.push({ nom: e.nom, nature: 'ENTREE', motif: `${e.nom} entre dans le périmètre en N (${e.methode}).` });
        else if (p.methode !== e.methode)
            out.push({ nom: e.nom, nature: 'METHODE', motif: `${e.nom} change de méthode (${p.methode} en N-1, ${e.methode} en N).` });
        else if (Math.abs(p.pctInteret - e.pctInteret) > EPS)
            out.push({ nom: e.nom, nature: 'POURCENTAGE', motif: `${e.nom} change de pourcentage d’intérêt (${p.pctInteret} % en N-1, ${e.pctInteret} % en N).` });
    }
    for (const [cle, p] of b)
        if (!a.has(cle))
            out.push({ nom: p.nom, nature: 'SORTIE', motif: `${p.nom} sort du périmètre en N.` });
    return out;
}
//# sourceMappingURL=flux-capitaux-consolides.js.map