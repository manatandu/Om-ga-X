"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.INDICATEURS_LAISSES_EN_SAISIE = exports.MILLIERS_DE_FRANCS = void 0;
exports.cessionsDeLExercice = cessionsDeLExercice;
exports.indicateursNote33 = indicateursNote33;
const etats_financiers_communs_1 = require("../etats-financiers/etats-financiers.communs");
exports.MILLIERS_DE_FRANCS = 1000;
function cessionsDeLExercice(lignes) {
    let valeurComptable = 0;
    let produits = 0;
    let dotationsHao = 0;
    let reprisesHao = 0;
    for (const l of lignes) {
        if ((0, etats_financiers_communs_1.correspond)(l.numero, ['81']))
            valeurComptable += l.totalDebit - l.totalCredit;
        if ((0, etats_financiers_communs_1.correspond)(l.numero, ['82']))
            produits += l.totalCredit - l.totalDebit;
        if ((0, etats_financiers_communs_1.correspond)(l.numero, ['85']))
            dotationsHao += l.totalDebit - l.totalCredit;
        if ((0, etats_financiers_communs_1.correspond)(l.numero, ['86']))
            reprisesHao += l.totalCredit - l.totalDebit;
    }
    return { valeurComptable, produits, dotationsHao, reprisesHao };
}
exports.INDICATEURS_LAISSES_EN_SAISIE = ['ratio-d-utilisation-des-dons-sommes-versees-dire'];
function sommeOuNull(a, b) {
    return a === null || b === null ? null : a + b;
}
function indicateursNote33(etats, cessionsN, cessionsN1, exerciceN1Disponible) {
    const postesBilan = new Map([...etats.bilan.actif, ...etats.bilan.passif].map((p) => [p.ref, p]));
    const postesCr = new Map([...etats.compteDeResultat.produits, ...etats.compteDeResultat.charges].map((p) => [p.ref, p]));
    const postesFlux = new Map(etats.fluxTresorerie.lignes
        .filter((l) => 'ref' in l && l.ref !== undefined && 'montant' in l && l.montant !== undefined)
        .map((l) => [l.ref, l]));
    const bilanN = (ref) => postesBilan.get(ref)?.montant ?? 0;
    const bilanN1 = (ref) => postesBilan.get(ref)?.montantN1 ?? 0;
    const crN = (ref) => postesCr.get(ref)?.montant ?? 0;
    const crN1 = (ref) => postesCr.get(ref)?.montantN1 ?? 0;
    const fluxVidesN = new Set(etats.fluxTresorerie.postesVides ?? []);
    const fluxN = (ref) => (fluxVidesN.has(ref) ? null : (postesFlux.get(ref)?.montant ?? 0));
    const fluxN1 = (ref) => {
        const l = postesFlux.get(ref);
        return l && exerciceN1Disponible && l.montantN1 === undefined ? null : (l?.montantN1 ?? 0);
    };
    const pourUnExercice = (bl, cr, fl, resultatAo, resultatHao, resultatNet, totalCharges, cessions) => {
        const fondsPropres = bl('CZ');
        const dettesFinancieres = bl('DD');
        const ressourcesStables = fondsPropres + dettesFinancieres;
        const actifImmobilise = bl('AZ');
        const fondsDeRoulement = ressourcesStables - actifImmobilise;
        const actifCirculantExploitation = bl('BT') - bl('BA');
        const passifCirculantExploitation = bl('DV') - bl('DF');
        const bfExploitation = actifCirculantExploitation - passifCirculantExploitation;
        const actifCirculantHao = bl('BA');
        const passifCirculantHao = bl('DF');
        const bfHao = actifCirculantHao - passifCirculantHao;
        const bfGlobal = bfExploitation + bfHao;
        const tresorerieNette = fondsDeRoulement - bfGlobal;
        const controleTresorerie = bl('BX') - bl('DX');
        const creances = bl('BC') + bl('BD') + bl('BE');
        const passifCirculant = bl('DV');
        return {
            'resultat-des-activites-ordinaires': resultatAo,
            'resultat-hors-activites-ordinaires': resultatHao,
            'resultat-net': resultatNet,
            'capacite-d-autofinancement-globale-cafg': resultatNet +
                cr('TL') +
                cessions.dotationsHao -
                cr('RH') -
                cessions.reprisesHao +
                cessions.valeurComptable -
                cessions.produits,
            'ratio-de-cotisations-acquises-cotisations-charge': Math.abs(totalCharges) < 0.005 ? null : (cr('RA') / totalCharges) * 100,
            'fonds-propres-et-assimiles': fondsPropres,
            'dettes-financieres-et-ressources-assimilees': dettesFinancieres,
            'ressources-stables': ressourcesStables,
            'actif-immobilise': actifImmobilise,
            'fonds-de-roulement-1': fondsDeRoulement,
            'actif-circulant-d-exploitation': actifCirculantExploitation,
            'passif-circulant-d-exploitation': passifCirculantExploitation,
            'besoin-de-financement-d-exploitation-2': bfExploitation,
            'actif-circulant-hao': actifCirculantHao,
            'passif-circulant-hao': passifCirculantHao,
            'besoin-de-financement-hao-3': bfHao,
            'besoin-de-financement-global-4-2-3': bfGlobal,
            'tresorerie-nette-5-1-4': tresorerieNette,
            'controle-tresorerie-nette-tresorerie-actif-treso': controleTresorerie,
            'ratio-de-liquidite-generale-creances-tresorerie': Math.abs(passifCirculant) < 0.005 ? null : ((creances + bl('BX')) / passifCirculant) * 100,
            'flux-de-tresorerie-des-activites-operationnelles': fl('ZB'),
            'flux-de-tresorerie-des-activites-d-investissemen': fl('ZC'),
            'flux-de-tresorerie-des-activites-de-financement': sommeOuNull(fl('ZD'), fl('ZE')),
            'variation-de-la-tresorerie-nette-de-la-periode': fl('ZF'),
        };
    };
    const n = pourUnExercice(bilanN, crN, fluxN, etats.compteDeResultat.resultatActivitesOrdinaires, etats.compteDeResultat.resultatHao, etats.compteDeResultat.resultatNet, etats.compteDeResultat.totalCharges, cessionsN);
    const n1 = exerciceN1Disponible
        ? pourUnExercice(bilanN1, crN1, fluxN1, etats.compteDeResultat.resultatActivitesOrdinairesN1 ?? 0, etats.compteDeResultat.resultatHaoN1 ?? 0, etats.compteDeResultat.resultatNetN1 ?? 0, etats.compteDeResultat.totalChargesN1 ?? 0, cessionsN1)
        : null;
    const RATIOS = new Set([
        'ratio-de-cotisations-acquises-cotisations-charge',
        'ratio-de-liquidite-generale-creances-tresorerie',
    ]);
    return Object.keys(n).map((cle) => {
        const unite = RATIOS.has(cle) ? 'POURCENT' : 'MONTANT';
        const echelle = unite === 'POURCENT' ? 1 : exports.MILLIERS_DE_FRANCS;
        const aLEchelle = (v) => (v === null || v === undefined ? null : v / echelle);
        return { cle, unite, valeurN: aLEchelle(n[cle]), valeurN1: n1 ? aLEchelle(n1[cle]) : null };
    });
}
//# sourceMappingURL=indicateurs-note-33.js.map