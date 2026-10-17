"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.POSTES_A_DECLARER = exports.POSTES_RANGES = exports.aDesEcartsDeConversion = void 0;
exports.variationConversionExercice = variationConversionExercice;
exports.motifRefusRegleConsolidation = motifRefusRegleConsolidation;
exports.construireEtatsIfrsConsolides = construireEtatsIfrsConsolides;
const cumul_consolidation_1 = require("../consolidation/cumul-consolidation");
const etats_ifrs_1 = require("./etats-ifrs");
const rubriques_ifrs_1 = require("./rubriques-ifrs");
const aDesEcartsDeConversion = (c) => c.conversions.length > 0 ||
    Math.abs(c.capitauxPropres.ecartsConversion) > EPS ||
    Math.abs(c.capitauxPropres.ecartsConversionMinoritaires ?? 0) > EPS ||
    Math.abs(c.lignes.find((l) => l.cle === 'ECARTS_CONVERSION')?.solde ?? 0) > EPS;
exports.aDesEcartsDeConversion = aDesEcartsDeConversion;
function variationConversionExercice(cumul, comparaison) {
    const precedent = comparaison?.cumulPrecedent ?? null;
    if (!(0, exports.aDesEcartsDeConversion)(cumul) && !(precedent && (0, exports.aDesEcartsDeConversion)(precedent)))
        return { variation: null, motif: null };
    const prefixe = 'Écarts de conversion · IAS 21 § 39 c les veut dans les autres éléments du résultat global de l’exercice, et § 41 en affecte la part aux participations ne donnant pas le contrôle.';
    if (!precedent) {
        return { variation: null, motif: `${prefixe} Sans consolidation de l’exercice précédent, la variation de l’exercice ne se sépare pas du cumul · ils restent en capitaux propres.` };
    }
    const converties = new Set([...cumul.conversions, ...precedent.conversions].map((c) => c.entite.trim().toLowerCase()));
    const genants = (comparaison?.changements ?? []).filter((c) => c.nature !== 'ENTREE' && converties.has(c.nom.trim().toLowerCase()));
    const sorties = genants.filter((c) => c.nature === 'SORTIE').map((c) => c.nom);
    const autres = genants.filter((c) => c.nature !== 'SORTIE').map((c) => c.nom);
    const motifs = [];
    if (sorties.length)
        motifs.push(`${sorties.join(', ')} sort du périmètre · le cumul de ses écarts se reclasse en résultat (IAS 21 § 48), ce que cette version ne sert pas.`);
    if (autres.length)
        motifs.push(`${autres.join(', ')} change de méthode ou de pourcentage d’intérêt · la variation mêle un transfert entre groupe et minoritaires (IFRS 10 § B96), que cette version ne sépare pas.`);
    if (motifs.length)
        return { variation: null, motif: `${prefixe} ${motifs.join(' ')}` };
    const a = cumul.capitauxPropres;
    const b = precedent.capitauxPropres;
    const d = (x, y) => Math.round(((x ?? 0) - (y ?? 0)) * 100) / 100;
    return {
        variation: { groupe: d(a.ecartsConversion, b.ecartsConversion), minoritaires: d(a.ecartsConversionMinoritaires, b.ecartsConversionMinoritaires), me: d(a.ecartsConversionMe, b.ecartsConversionMe) },
        motif: null,
    };
}
exports.POSTES_RANGES = {
    ECART_ACQUISITION: { rubrique: 'SF_GOODWILL', fondement: 'IFRS 18 § 103 d, IFRS 3 § 32' },
    AMORTISSEMENT_ECART_ACQUISITION: { rubrique: 'SF_GOODWILL', fondement: 'IFRS 18 § 103 d · à retraiter, IFRS 3 § B63 a' },
    DEPRECIATION_ECART_ACQUISITION: { rubrique: 'SF_GOODWILL', fondement: 'IFRS 18 § 103 d, IAS 36 § 90' },
    TITRES_MIS_EN_EQUIVALENCE: { rubrique: 'SF_PARTICIPATIONS_MEE', fondement: 'IFRS 18 § 103 g' },
    QUOTE_PART_RESULTAT_ME: { rubrique: 'PL_QUOTE_PART_MEE', fondement: 'IFRS 18 § 75 a iii' },
    IMPOTS_DIFFERES_ACTIF: { rubrique: 'SF_IMPOTS_DIFFERES_ACTIF', fondement: 'IFRS 18 § 103 r' },
    IMPOTS_DIFFERES_PASSIF: { rubrique: 'SF_IMPOTS_DIFFERES_PASSIF', fondement: 'IFRS 18 § 103 r' },
    IMPOTS_DIFFERES_RESULTAT: { rubrique: 'PL_IMPOT_RESULTAT', fondement: 'IFRS 18 § 67, § 75 a iv' },
    CAPITAL: { rubrique: 'SF_CAPITAL', fondement: 'IFRS 18 § 104 b' },
    RESERVES_GROUPE: { rubrique: 'SF_RESERVES', fondement: 'IFRS 18 § 104 b' },
    ECARTS_CONVERSION: { rubrique: 'SF_AUTRES_COMPOSANTES_CP', fondement: 'IAS 21 § 41 · composante distincte des capitaux propres' },
    INTERETS_MINORITAIRES: { rubrique: rubriques_ifrs_1.RUBRIQUE_NCI, fondement: 'IFRS 18 § 104 a, IFRS 10 § 22' },
};
exports.POSTES_A_DECLARER = [
    'PRIMES_CONSOLIDANTE',
    'ECARTS_REEVALUATION_CONSOLIDANTE',
    'DOTATION_ECART_ACQUISITION',
    'ECART_ACQUISITION_NEGATIF',
    'REPRISE_ECART_ACQUISITION_NEGATIF',
    'PROVISION_ME_NEGATIVE',
    'ELIMINATION_RESULTATS_INTERNES',
    'ECARTS_EVALUATION_RESULTAT',
    'ECARTS_CONVERSION_INDIVIDUELS_RESULTAT',
];
function motifRefusRegleConsolidation(poste, rubrique) {
    if (!exports.POSTES_A_DECLARER.includes(poste)) {
        if (poste in exports.POSTES_RANGES)
            return `Le poste « ${cumul_consolidation_1.LIBELLE_POSTE[poste]} » est rangé par IFRS 18 elle-même (${exports.POSTES_RANGES[poste].fondement}).`;
        return `« ${poste} » n’est pas un poste de consolidation qui se déclare.`;
    }
    const r = rubriques_ifrs_1.RUBRIQUE_PAR_CODE.get(rubrique);
    if (!r)
        return `La rubrique « ${rubrique} » n’existe pas au catalogue IFRS 18 d’OmegaX.`;
    if (r.code === rubriques_ifrs_1.RUBRIQUE_NCI)
        return 'Les participations ne donnant pas le contrôle ne reçoivent que le partage de la consolidation (IFRS 10 § 22).';
    if (r.etat === 'RESULTAT_GLOBAL')
        return `« ${r.libelle} » est un autre élément du résultat global · il se déclare en retraitement, jamais par une règle.`;
    const resultat = cumul_consolidation_1.POSTES_DE_RESULTAT.has(poste);
    if (resultat && r.etat !== 'RESULTAT')
        return `Le poste « ${cumul_consolidation_1.LIBELLE_POSTE[poste]} » est du résultat · il va au compte de résultat.`;
    if (!resultat && r.etat !== 'SITUATION')
        return `Le poste « ${cumul_consolidation_1.LIBELLE_POSTE[poste]} » est du bilan · il va à l’état de la situation financière.`;
    return null;
}
const EPS = 0.005;
function construireEtatsIfrsConsolides(exercice, cumul, regles, reglesConsolidation, retraitements, activitePrincipale, comparaison) {
    const declarees = new Map();
    for (const r of reglesConsolidation) {
        const m = motifRefusRegleConsolidation(r.poste, r.rubrique);
        if (m)
            throw new etats_ifrs_1.RefusIfrs(m);
        declarees.set(r.poste, r.rubrique);
    }
    const rubriqueDuPoste = (cle) => exports.POSTES_RANGES[cle]?.rubrique ?? declarees.get(cle) ?? null;
    const conversion = variationConversionExercice(cumul, comparaison);
    const etat = (0, etats_ifrs_1.construireEtatsIfrs)(exercice, cumul.lignes.map((l) => ({ numero: l.cle, intitule: l.intitule, solde: l.solde })), regles, retraitements, activitePrincipale, {
        rubriqueDuPoste,
        estPosteDeResultat: (cle) => cumul_consolidation_1.POSTES_DE_RESULTAT.has(cle),
        resultatMinoritaires: cumul.capitauxPropres.resultatMinoritaires,
        resultatEnsemble: cumul.capitauxPropres.resultatEnsemble,
        ...(conversion.variation ? { conversionExercice: conversion.variation } : {}),
    });
    etat.motifsNonPubliable.push(...(cumul.conversionsIncompletes ?? []).map((m) => `Consolidation · conversion · ${m}`), ...(cumul.impotsDifferesIncomplets ?? []).map((m) => `Consolidation · impôts différés incomplets · ${m}`), ...(cumul.retraitementsNonJoues ?? []).map((m) => `Consolidation · retraitement non joué · ${m}`));
    const solde = (poste) => cumul.lignes.find((l) => l.cle === poste)?.solde ?? 0;
    const touche = (rubrique) => !!rubrique && retraitements.some((r) => r.lignes.some((l) => l.rubrique === rubrique));
    if ((Math.abs(solde('AMORTISSEMENT_ECART_ACQUISITION')) > EPS || Math.abs(solde('DOTATION_ECART_ACQUISITION')) > EPS) && !touche('SF_GOODWILL')) {
        etat.motifsNonPubliable.push('Écart d’acquisition amorti selon l’AUDCIF art. 82 · IFRS 3 § B63 a l’évalue au montant de la date d’acquisition diminué des pertes de valeur, testé chaque année (IAS 36 § 90). Déclarez le retraitement qui annule l’amortissement, et la perte de valeur s’il y en a une.');
    }
    if (Math.abs(solde('ECART_ACQUISITION_NEGATIF')) > EPS && !touche(rubriqueDuPoste('ECART_ACQUISITION_NEGATIF'))) {
        etat.motifsNonPubliable.push('Écart d’acquisition négatif étalé selon le D4C · IFRS 3 § 34 comptabilise le profit en résultat net à la date d’acquisition. Déclarez le retraitement qui solde le poste.');
    }
    if (conversion.motif)
        etat.motifsNonPubliable.push(conversion.motif);
    if (conversion.variation) {
        etat.mentions.push('Écarts de conversion · la variation de l’exercice est présentée dans les autres éléments du résultat global (IAS 21 § 39 c), la part des participations ne donnant pas le contrôle leur est attribuée (§ 41) et le cumul reste une composante distincte des capitaux propres jusqu’à la sortie de l’entité (§ 48).');
    }
    for (const p of exports.POSTES_A_DECLARER) {
        if (Math.abs(solde(p)) > EPS && !declarees.has(p)) {
            etat.motifsNonPubliable.push(`Poste de consolidation « ${cumul_consolidation_1.LIBELLE_POSTE[p]} » sans rubrique IFRS · déclarez la ligne où il se range.`);
        }
    }
    const postes = cumul.lignes
        .filter((l) => l.poste)
        .map((l) => {
        const range = exports.POSTES_RANGES[l.cle];
        return {
            poste: l.cle,
            libelle: l.intitule,
            solde: l.solde,
            rubrique: rubriqueDuPoste(l.cle),
            fondement: range?.fondement ?? null,
            declare: exports.POSTES_A_DECLARER.includes(l.cle),
        };
    });
    return { ...etat, postes };
}
//# sourceMappingURL=etats-ifrs-consolides.js.map