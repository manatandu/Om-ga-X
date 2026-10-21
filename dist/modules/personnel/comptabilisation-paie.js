"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RESERVE_REPRISE_EN_NEGATIF = exports.motifPartIllisible = exports.MOTIF_ORIGINE_INTROUVABLE = exports.TOTAL_DU_BLOC = void 0;
exports.entreeDuBulletin = entreeDuBulletin;
exports.propositionPaieDuMois = propositionPaieDuMois;
exports.dernierJourDuMois = dernierJourDuMois;
const passation_paie_1 = require("./passation-paie");
const ORDRE_DES_BLOCS = [
    'BRUT',
    'RETENUES',
    'PATRONALES',
    'IMPOTS_ET_TAXES_SUR_SALAIRES',
    'AVANTAGES_EN_NATURE',
    'REPRISE_EN_NEGATIF',
];
exports.TOTAL_DU_BLOC = {
    BRUT: { role: 'REMUNERATIONS_DUES', sens: 'CREDIT' },
    RETENUES: { role: 'REMUNERATIONS_DUES', sens: 'DEBIT' },
    PATRONALES: { role: 'CHARGES_SOCIALES_PATRONALES', sens: 'DEBIT' },
    IMPOTS_ET_TAXES_SUR_SALAIRES: { role: 'AUTRES_IMPOTS_ET_TAXES', sens: 'CREDIT' },
    AVANTAGES_EN_NATURE: { role: 'TRANSFERTS_DE_CHARGES', sens: 'CREDIT' },
};
const enCentimes = (fc) => Math.round(fc * 100);
const enFrancs = (centimes) => centimes / 100;
const objet = (x) => (x && typeof x === 'object' ? x : null);
const nombreOuNull = (x) => (typeof x === 'number' && Number.isFinite(x) ? x : null);
function elementsEnFrancs(elements, conversion) {
    if (!Array.isArray(elements))
        return null;
    const convertis = Array.isArray(conversion?.elements) ? conversion.elements : null;
    const rendus = [];
    for (const [i, brut] of elements.entries()) {
        const e = objet(brut);
        if (!e)
            return null;
        const montantFc = nombreOuNull(e.montantFc) ?? (convertis ? nombreOuNull(objet(convertis[i])?.montantFc) : null);
        if (montantFc === null)
            return null;
        rendus.push({ ...e, montantFc });
    }
    return rendus;
}
function entreeDuBulletin(b, referentiel) {
    const entree = objet(b.entree);
    const calcul = objet(b.calcul);
    const cotisations = objet(calcul?.cotisations);
    const retenue = objet(calcul?.retenue);
    const net = objet(calcul?.net);
    const lignes = cotisations?.lignes;
    const elements = elementsEnFrancs(entree?.elements, objet(calcul?.conversion));
    if (!elements || !Array.isArray(lignes))
        return null;
    return {
        referentiel,
        elements,
        cotisations: lignes,
        abstentionsCotisations: Array.isArray(cotisations?.abstentions) ? cotisations.abstentions : [],
        irppFc: nombreOuNull(retenue?.retenueFc),
        netAPayerFc: nombreOuNull(net?.netAPayerFc),
        retenuesAvances: Array.isArray(calcul?.retenuesAvances)
            ? calcul.retenuesAvances
            : [],
    };
}
function propositionPaieDuMois(moisDePaie, referentiel, bulletins) {
    const emis = bulletins.filter((b) => b.statut === 'EMIS');
    const aPasser = emis.filter((b) => !b.ecritureId);
    const dejaPasses = emis
        .filter((b) => b.ecritureId)
        .map((b) => ({ numero: b.numero, nomComplet: b.nomComplet, ecritureId: b.ecritureId }));
    const annules = bulletins.filter((b) => b.statut === 'ANNULE' && b.ecritureId);
    const annulesApresPassation = annules.map((b) => ({
        numero: b.numero,
        nomComplet: b.nomComplet,
        ecritureId: b.ecritureId,
        ecritureNegatifId: b.ecritureNegatifId ?? null,
    }));
    const negatifs = annules.filter((b) => !b.ecritureNegatifId);
    const negatifsAPasser = negatifs.map((b) => ({
        id: b.id,
        numero: b.numero,
        nomComplet: b.nomComplet,
        ecritureId: b.ecritureId,
    }));
    const reserves = [];
    if (negatifs.length > 0) {
        reserves.push((0, exports.RESERVE_REPRISE_EN_NEGATIF)(negatifs.map((b) => b.numero)));
    }
    const refus = [];
    const detail = new Map();
    let sommeDesNets = 0;
    for (const b of aPasser) {
        const entree = entreeDuBulletin(b, referentiel);
        if (!entree) {
            refus.push({ numero: b.numero, nomComplet: b.nomComplet, motifs: ['Bulletin illisible · ses éléments ou ses cotisations manquent.'] });
            continue;
        }
        const v = (0, passation_paie_1.passationPaie)(entree);
        if (v.refus.length > 0) {
            refus.push({ numero: b.numero, nomComplet: b.nomComplet, motifs: v.refus.map((r) => `${r.motif} · ${r.explication}`) });
            continue;
        }
        sommeDesNets += enCentimes(b.netAPayerFc);
        for (const l of v.lignes) {
            const total = exports.TOTAL_DU_BLOC[l.bloc];
            if (l.compte === (0, passation_paie_1.compteDuRole)(total.role, referentiel) && l.sens === total.sens)
                continue;
            const cle = `${l.bloc}|${l.compte}|${l.sens}`;
            const courant = detail.get(cle);
            if (courant)
                courant.centimes += enCentimes(l.montantFc);
            else
                detail.set(cle, { bloc: l.bloc, compte: l.compte, intitule: l.intitule, sens: l.sens, centimes: enCentimes(l.montantFc), negatif: false });
        }
    }
    const rejouesALaRegleDuJour = [];
    const reprisesExactes = [];
    for (const [ecritureId, repris] of groupesParEcriture(negatifs)) {
        const origine = repris.find((b) => b.origine?.ecritureId === ecritureId)?.origine ?? null;
        if (!origine || origine.lignes.length === 0) {
            for (const b of repris) {
                refus.push({ numero: b.numero, nomComplet: b.nomComplet, motifs: [exports.MOTIF_ORIGINE_INTROUVABLE] });
            }
            continue;
        }
        const portes = bulletins.filter((b) => b.ecritureId === ecritureId);
        const reprisesPortees = bulletins.filter((b) => b.ecritureNegatifId === ecritureId);
        const tousRepris = reprisesPortees.length === 0 && portes.every((b) => repris.includes(b));
        if (tousRepris) {
            reprisesExactes.push({ origine, bulletins: repris });
            continue;
        }
        if (seReconstitueALaRegleDuJour(origine, portes, reprisesPortees, referentiel)) {
            rejouesALaRegleDuJour.push(...repris);
            continue;
        }
        const autres = portes.filter((b) => !repris.includes(b)).map((b) => b.numero);
        for (const b of repris) {
            refus.push({ numero: b.numero, nomComplet: b.nomComplet, motifs: [(0, exports.motifPartIllisible)(origine, autres)] });
        }
    }
    for (const { origine, bulletins: repris } of reprisesExactes) {
        for (const b of repris)
            sommeDesNets -= enCentimes(b.netAPayerFc);
        for (const l of origine.lignes) {
            for (const [sens, montant] of [['DEBIT', l.debit], ['CREDIT', l.credit]]) {
                if (enCentimes(montant) === 0)
                    continue;
                const cle = `REPRISE_EN_NEGATIF|${l.compte}|${sens}|NEGATIF`;
                const courant = detail.get(cle);
                if (courant)
                    courant.centimes -= enCentimes(montant);
                else
                    detail.set(cle, {
                        bloc: 'REPRISE_EN_NEGATIF',
                        compte: l.compte,
                        intitule: `${l.intitule} · reprise en négatif (pièce n° ${origine.numeroPiece ?? '·'})`,
                        sens,
                        centimes: -enCentimes(montant),
                        negatif: true,
                    });
            }
        }
    }
    for (const b of rejouesALaRegleDuJour) {
        const entree = entreeDuBulletin(b, referentiel);
        if (!entree) {
            refus.push({
                numero: b.numero,
                nomComplet: b.nomComplet,
                motifs: ["Bulletin annulé illisible · ses éléments ou ses cotisations manquent, et son salaire ne se reprend pas en négatif."],
            });
            continue;
        }
        const v = (0, passation_paie_1.passationPaie)(entree);
        if (v.refus.length > 0) {
            refus.push({
                numero: b.numero,
                nomComplet: b.nomComplet,
                motifs: v.refus.map((r) => `REPRISE EN NÉGATIF · ${r.motif} · ${r.explication}`),
            });
            continue;
        }
        sommeDesNets -= enCentimes(b.netAPayerFc);
        for (const l of v.lignes) {
            const total = exports.TOTAL_DU_BLOC[l.bloc];
            if (l.compte === (0, passation_paie_1.compteDuRole)(total.role, referentiel) && l.sens === total.sens)
                continue;
            const cle = `${l.bloc}|${l.compte}|${l.sens}|NEGATIF`;
            const courant = detail.get(cle);
            if (courant)
                courant.centimes -= enCentimes(l.montantFc);
            else
                detail.set(cle, {
                    bloc: l.bloc,
                    compte: l.compte,
                    intitule: `${l.intitule} · reprise en négatif`,
                    sens: l.sens,
                    centimes: -enCentimes(l.montantFc),
                    negatif: true,
                });
        }
    }
    const reprises = [
        ...reprisesExactes.map((r) => ({ ecritureId: r.origine.ecritureId, mode: 'EXACTE', bulletinIds: r.bulletins.map((b) => b.id) })),
        ...[...groupesParEcriture(rejouesALaRegleDuJour)].map(([ecritureId, bs]) => ({
            ecritureId,
            mode: 'REJEU',
            bulletinIds: bs.map((b) => b.id),
        })),
    ];
    const vide = (motifReserve) => ({
        moisDePaie,
        referentiel,
        aPasser: aPasser.map((b) => ({ id: b.id, numero: b.numero, nomComplet: b.nomComplet })),
        dejaPasses,
        annulesApresPassation,
        negatifsAPasser,
        reprises,
        refus,
        lignes: [],
        totalDebitFc: 0,
        totalCreditFc: 0,
        equilibree: false,
        solde422Fc: 0,
        sommeDesNetsFc: 0,
        reserves: motifReserve ? [...reserves, motifReserve] : reserves,
    });
    if (refus.length > 0) {
        return vide("UN BULLETIN REFUSÉ ARRÊTE LE MOIS · passer les autres ferait entrer au journal une masse salariale amputée " +
            "d'un salaire, sur une écriture équilibrée. Annulez et réémettez le bulletin nommé.");
    }
    if (aPasser.length === 0 && negatifs.length === 0)
        return vide();
    const lignes = [];
    for (const bloc of ORDRE_DES_BLOCS) {
        if (bloc === 'REPRISE_EN_NEGATIF') {
            const reprise = [...detail.values()].filter((d) => d.bloc === bloc && d.centimes !== 0);
            lignes.push(...reprise
                .sort((a, b) => (a.sens === b.sens ? a.compte.localeCompare(b.compte) : a.sens === 'DEBIT' ? -1 : 1))
                .map((d) => ({ bloc, compte: d.compte, intitule: d.intitule, sens: d.sens, montantFc: enFrancs(d.centimes), negatif: true })));
            continue;
        }
        const duBloc = [...detail.values()].filter((d) => d.bloc === bloc && d.centimes !== 0);
        if (duBloc.length === 0)
            continue;
        const total = exports.TOTAL_DU_BLOC[bloc];
        const totalCentimes = duBloc.reduce((n, d) => n + d.centimes, 0);
        const ligneTotal = totalCentimes === 0
            ? null
            : {
                bloc,
                compte: (0, passation_paie_1.compteDuRole)(total.role, referentiel),
                intitule: passation_paie_1.NOMENCLATURE_PAIE[total.role].intitule,
                sens: total.sens,
                montantFc: enFrancs(totalCentimes),
            };
        const details = duBloc
            .sort((a, b) => a.compte.localeCompare(b.compte) || Number(a.negatif) - Number(b.negatif))
            .map((d) => ({
            bloc,
            compte: d.compte,
            intitule: d.intitule,
            sens: d.sens,
            montantFc: enFrancs(d.centimes),
            ...(d.negatif ? { negatif: true } : {}),
        }));
        const tous = !ligneTotal ? details : total.sens === 'DEBIT' ? [ligneTotal, ...details] : [...details, ligneTotal];
        lignes.push(...tous);
    }
    const somme = (sens) => lignes.filter((l) => l.sens === sens).reduce((n, l) => n + enCentimes(l.montantFc), 0);
    const debit = somme('DEBIT');
    const credit = somme('CREDIT');
    const c422 = (0, passation_paie_1.compteDuRole)('REMUNERATIONS_DUES', referentiel);
    const solde422 = lignes
        .filter((l) => l.compte === c422)
        .reduce((n, l) => n + (l.sens === 'CREDIT' ? enCentimes(l.montantFc) : -enCentimes(l.montantFc)), 0);
    const ecart = solde422 - sommeDesNets;
    const tolerance = (aPasser.length + negatifs.length) * 3;
    if (Math.abs(ecart) > tolerance) {
        return vide(`Le 422 solderait à ${enFrancs(solde422).toFixed(2)} FC quand les bulletins portent ${enFrancs(sommeDesNets).toFixed(2)} FC de net. ` +
            "Un écart de cette taille est un défaut du moteur, jamais un arrondi à rattraper. Rien n'est proposé.");
    }
    if (ecart !== 0) {
        reserves.push(`ARRONDI · le solde du 422 (${enFrancs(solde422).toFixed(2)} FC) s'écarte de ${enFrancs(ecart).toFixed(2)} FC de la somme des nets ` +
            "figés sur les bulletins, chaque montant ayant été arrondi au centime. L'écart est montré, pas logé dans un compte.");
    }
    reserves.push("UNE ÉCRITURE POUR LE MOIS · la passation de chaque bulletin est rejouée sur ses chiffres figés, puis additionnée par " +
        "compte. Les trois temps du Guide d'application SYSCOHADA (Partie 1 ch. 3 section 4) sont gardés : brut, retenues, " +
        "charges patronales. L'impôt retenu n'est jamais une charge de l'employeur. L'INPP et l'ONEM forment un temps à part, " +
        "au 64 contre le 4428 · ce sont des impôts et taxes (fiche du compte 64 des deux textes), pas des charges sociales.", "LE PAIEMENT DES SALAIRES EST UNE SECONDE ÉCRITURE · le 422 est débité des paiements par le crédit de la trésorerie, " +
        "dans le journal de banque ou de caisse.");
    return {
        moisDePaie,
        referentiel,
        aPasser: aPasser.map((b) => ({ id: b.id, numero: b.numero, nomComplet: b.nomComplet })),
        dejaPasses,
        annulesApresPassation,
        negatifsAPasser,
        reprises,
        refus,
        lignes,
        totalDebitFc: enFrancs(debit),
        totalCreditFc: enFrancs(credit),
        equilibree: debit === credit,
        solde422Fc: enFrancs(solde422),
        sommeDesNetsFc: enFrancs(sommeDesNets),
        reserves,
    };
}
function groupesParEcriture(negatifs) {
    const groupes = new Map();
    for (const b of negatifs) {
        const cle = b.ecritureId;
        groupes.set(cle, [...(groupes.get(cle) ?? []), b]);
    }
    return groupes;
}
function empreinte(lignes) {
    const m = new Map();
    for (const l of lignes)
        m.set(`${l.compte}|${l.sens}`, (m.get(`${l.compte}|${l.sens}`) ?? 0) + l.centimes);
    for (const [k, v] of m)
        if (v === 0)
            m.delete(k);
    return m;
}
function seReconstitueALaRegleDuJour(origine, portes, reprisesPortees, referentiel) {
    const rejeu = propositionPaieDuMois('0000-00', referentiel, [
        ...portes.map((b) => ({ ...b, statut: 'EMIS', ecritureId: null, ecritureNegatifId: null, origine: null })),
    ]);
    if (rejeu.refus.length > 0)
        return false;
    const positives = rejeu.lignes.map((l) => ({ compte: l.compte, sens: l.sens, centimes: enCentimes(l.montantFc) }));
    const lignesDe = (o, signe) => o.lignes.flatMap((l) => [
        { compte: l.compte, sens: 'DEBIT', centimes: signe * enCentimes(l.debit) },
        { compte: l.compte, sens: 'CREDIT', centimes: signe * enCentimes(l.credit) },
    ]);
    const passe = empreinte(lignesDe(origine, 1));
    const egal = (attendu) => attendu.size === passe.size && [...attendu].every(([k, v]) => passe.get(k) === v);
    const reprisesALaRegleDuJour = (() => {
        const lignes = [];
        for (const b of reprisesPortees) {
            const entree = entreeDuBulletin(b, referentiel);
            const v = entree ? (0, passation_paie_1.passationPaie)(entree) : null;
            if (!v || v.refus.length > 0)
                return null;
            for (const l of v.lignes)
                lignes.push({ compte: l.compte, sens: l.sens, centimes: -enCentimes(l.montantFc) });
        }
        return lignes;
    })();
    if (reprisesALaRegleDuJour && egal(empreinte([...positives, ...reprisesALaRegleDuJour])))
        return true;
    const origines = reprisesPortees.map((b) => b.origine);
    if (reprisesPortees.length > 0 && origines.every((o) => !!o && o.lignes.length > 0)) {
        const recopiees = [...new Map(origines.map((o) => [o.ecritureId, o])).values()].flatMap((o) => lignesDe(o, -1));
        if (egal(empreinte([...positives, ...recopiees])))
            return true;
    }
    return false;
}
exports.MOTIF_ORIGINE_INTROUVABLE = "REPRISE EN NÉGATIF REFUSÉE · l'écriture qui a passé ce bulletin n'est plus lisible au journal, et l'inscription en " +
    "négatif reprend CE QUI A ÉTÉ PASSÉ (AUDCIF art. 20, al. 2), jamais un rejeu à la règle du jour. Issue · retrouvez " +
    "l'écriture d'origine, ou inscrivez le négatif de ses lignes à la main (Corriger, inscription en négatif) ; tant que " +
    'le bulletin n’est pas repris ici, la paie du mois reste arrêtée.';
const motifPartIllisible = (origine, autres) => `REPRISE EN NÉGATIF REFUSÉE · l'écriture d'origine (pièce n° ${origine.numeroPiece ?? '·'}) porte aussi le(s) ` +
    `bulletin(s) n° ${autres.join(', ')}, et elle ne se reconstitue pas à la règle d'imputation du jour (passée sous ` +
    "une autre règle, par exemple l'INPP et l'ONEM au 6641, au 4334 et au 4335 avant la décision T1, ou retouchée) · la " +
    "part de ce bulletin dans ses lignes ne se lit pas, et un rejeu à la règle du jour reprendrait ce qui n'a pas été " +
    "passé (AUDCIF art. 20, al. 2). Issue · annulez aussi ce(s) bulletin(s) et réémettez-les · l'écriture d'origine se " +
    'reprend alors en négatif ligne à ligne, et les bulletins réémis se passent à la règle du jour.';
exports.motifPartIllisible = motifPartIllisible;
const RESERVE_REPRISE_EN_NEGATIF = (numeros) => `REPRISE EN NÉGATIF · n° ${numeros.join(', ')}, annulé(s) après passation. Leur salaire est au livre-journal, dans ` +
    "l'écriture validée qui les a passés · cette écriture le reprend EN NÉGATIF, ligne à ligne, à côté du bulletin " +
    "réémis, et seule la différence pèse sur l'exercice où elle est passée. Dans le même exercice, c'est l'inscription en " +
    "négatif de l'erreur (AUDCIF art. 20, al. 2). Erreur d'un exercice clôturé · elle se corrige dans les comptes de " +
    "l'exercice en cours, la date de valeur du mois de paie mentionnée (art. 22, 4°), et se dit aux Notes annexes " +
    "(art. 20, al. 4) ; significative, elle passe par le report à nouveau (art. 20, al. 3), hors de ce geste. Le négatif " +
    "reprend les lignes de l'écriture d'origine, comptes et montants (relecture M3). Un négatif déjà inscrit à la main se contre-passe d'abord, sans quoi " +
    'la reprise compterait deux fois · la passation demande de le confirmer.';
exports.RESERVE_REPRISE_EN_NEGATIF = RESERVE_REPRISE_EN_NEGATIF;
function dernierJourDuMois(moisDePaie) {
    const [a, m] = moisDePaie.split('-').map(Number);
    return new Date(Date.UTC(a, m, 0)).toISOString().slice(0, 10);
}
//# sourceMappingURL=comptabilisation-paie.js.map