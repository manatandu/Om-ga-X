"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PARTS_MAXIMUM = void 0;
exports.estLigneDANouveauDeclarable = estLigneDANouveauDeclarable;
exports.motifRefusLigne = motifRefusLigne;
exports.motifRefusParts = motifRefusParts;
exports.lignesExactes = lignesExactes;
exports.cleDeLigne = cleDeLigne;
exports.cleDuReport = cleDuReport;
exports.apparierReports = apparierReports;
const client_1 = require("@prisma/client");
const monnaie_de_tenue_1 = require("../../common/monnaie-de-tenue");
const libelle_exercice_1 = require("../../common/libelle-exercice");
const ligne_en_devise_1 = require("../comptabilite/ligne-en-devise");
const lignes_tenues_1 = require("../comptabilite/lignes-tenues");
const perimetre_reevaluation_1 = require("./perimetre-reevaluation");
function estLigneDANouveauDeclarable(e) {
    return e.estGenereeParCloture && !e.estANouveauProvisoire && !e.estSoldeDesComptesDeGestion;
}
exports.PARTS_MAXIMUM = 20;
const EPSILON = 0.005;
function motifRefusLigne(l, referentiel, contexte) {
    if (!estLigneDANouveauDeclarable(l.ecriture)) {
        return l.ecriture.estANouveauProvisoire
            ? "Cette ligne est l'à-nouveau PROVISOIRE d'OmegaX, recalculé à chaque relance · déclarez la devise sur la ligne de " +
                "l'exercice précédent qu'il reporte (bilan d'ouverture importé), elle suivra au report."
            : "Seule une ligne d'à-nouveau (bilan d'ouverture importé, ou report de clôture) se déclare ici · une ligne ordinaire " +
                'porte sa devise à la saisie, et se corrige par inscription en négatif (AUDCIF art. 20, al. 2).';
    }
    if (l.ecriture.exercice.statut === client_1.StatutExercice.CLOTURE) {
        return (`L'exercice ${(0, libelle_exercice_1.libelleExercice)(l.ecriture.exercice)} est clôturé · ses écritures ne se corrigent plus (AUDCIF art. 20, al. 3). ` +
            "Déclarez la devise sur l'à-nouveau de l'exercice suivant, qui reporte ce compte.");
    }
    if (contexte.dejaDeclaree)
        return 'La devise de cette ligne a déjà été déclarée · la déclaration ne se refait pas.';
    if (contexte.prolongeUneLigneDeclaree) {
        return ("Cette ligne reporte une ligne de l'exercice précédent dont la devise a déjà été déclarée (ou la part en francs d'une " +
            'déclaration) · la déclarer de nouveau jugerait deux fois la même position.');
    }
    if (l.deviseId)
        return 'Cette ligne porte déjà sa devise.';
    if (!(0, perimetre_reevaluation_1.seReevalueALaCloture)(l.numero, referentiel)) {
        return (`Le compte ${l.numero} n'est ni une créance, ni une dette, ni une disponibilité · ` +
            `${(0, perimetre_reevaluation_1.motifHorsReevaluation)(l.numero, referentiel)}. Sa devise ne changerait rien.`);
    }
    const tenue = (0, lignes_tenues_1.motifLignesTenues)([l], 'cette ligne', 'déclarer sa devise');
    if (tenue)
        return tenue;
    if (l.aDesVentilations) {
        return "Cette ligne est ventilée en analytique · retirez sa ventilation d'abord, la déclaration découperait la ligne sans elle.";
    }
    if (contexte.reevaluationLue) {
        const r = contexte.reevaluationLue;
        return (`La réévaluation du ${r.date.toISOString().slice(0, 10)} (exercice ${r.exercice}) a déjà lu ce compte, ` +
            (r.memeExercice ? 'cette ligne en francs' : 'le report de cette ligne en francs') +
            ' (AUDCIF art. 54) · déclarer sa devise maintenant ferait juger deux fois la même position. Annulez les réévaluations ' +
            "à partir de la plus récente (« Annuler », AUDCIF art. 20, al. 2), déclarez la devise, puis réévaluez dans l'ordre des exercices.");
    }
    if (contexte.reglementsEnFrancs.total > 0) {
        const { lignes, total } = contexte.reglementsEnFrancs;
        const liste = lignes
            .map((m) => `pièce ${m.piece ?? '·'} du ${m.date.toISOString().slice(0, 10)}, ${arrondi(m.montant)}`)
            .join(' ; ');
        return (`${total} mouvement(s) en francs de sens contraire, postérieurs à cette ligne et non lettrés, réduisent déjà ce compte ` +
            `(${liste}${total > lignes.length ? ' ; …' : ''}). Sans devise, la réévaluation ne les déduirait pas de la position · ` +
            'elle jugerait la ligne entière et doterait ou reprendrait sur un montant en devise déjà réglé (AUDCIF art. 54). ' +
            'Deux issues · si ce sont des règlements de cette position, porter d’abord leur devise (les annuler, par une ' +
            'contre-passation lettrée avec eux, puis les repasser en devise, AUDCIF art. 20, al. 2) ; si ce sont des règlements ' +
            'd’autres pièces en francs, les lettrer avec ces pièces, et la déclaration ne portera que sur ce qui reste ouvert.');
    }
    if (contexte.exercicePrecedentOuvert) {
        return (`L'exercice ${contexte.exercicePrecedentOuvert.libelle} est encore ouvert · sa clôture confrontera cette ouverture à son ` +
            'bilan de clôture, compte par compte et devise par devise (AUDCIF art. 34 · SYCEBNL art. 16, 4)), et la devise déclarée ' +
            "ici y serait un écart. Déclarez-la sur l'à-nouveau de cet exercice (bilan d'ouverture importé) · elle suivra au report · " +
            "ou clôturez-le d'abord.");
    }
    return null;
}
function motifRefusParts(parts, montantLigne, devisesDuDossier) {
    if (parts.length > exports.PARTS_MAXIMUM)
        return `Au plus ${exports.PARTS_MAXIMUM} parts par ligne.`;
    let somme = 0;
    for (const [i, p] of parts.entries()) {
        if (!Number.isFinite(p.montant) || p.montant <= 0)
            return `Part ${i + 1} · son montant en ${monnaie_de_tenue_1.MONNAIE_DE_TENUE} est positif.`;
        const motif = (0, ligne_en_devise_1.motifRefusLigneEnDevise)({ debit: p.montant, credit: 0, deviseId: p.deviseId, montantDevise: p.montantDevise, coursApplique: p.coursApplique ?? null }, devisesDuDossier.get(p.deviseId));
        if (motif)
            return `Part ${i + 1} · ${motif}`;
        somme += p.montant;
    }
    if (somme > montantLigne + EPSILON) {
        return (`Les parts déclarées font ${arrondi(somme)} ${monnaie_de_tenue_1.MONNAIE_DE_TENUE}, la ligne en porte ${arrondi(montantLigne)} · ` +
            'une déclaration découpe la ligne, elle ne change pas son montant.');
    }
    return null;
}
function arrondi(x) {
    return Math.round(x * 100) / 100;
}
function lignesExactes(l, parts) {
    const sensDebit = l.debit - l.credit >= 0;
    const total = arrondi(Math.abs(l.debit - l.credit));
    const sortie = parts.map((p) => ({
        montant: arrondi(p.montant),
        deviseId: p.deviseId,
        montantDevise: p.montantDevise,
        coursApplique: p.coursApplique !== null && p.coursApplique !== undefined
            ? p.coursApplique
            : Math.round((p.montant / p.montantDevise) * 1e6) / 1e6,
        sensDebit,
    }));
    const reste = arrondi(total - sortie.reduce((s, p) => s + p.montant, 0));
    if (reste > EPSILON)
        sortie.push({ montant: reste, deviseId: null, montantDevise: null, coursApplique: null, sensDebit });
    return sortie;
}
function centimes(x) {
    return Math.round(x * 100);
}
function cleDeLigne(l) {
    return [l.compteId, centimes(l.debit), centimes(l.credit), l.dateEcheance?.getTime() ?? '', l.libelle ?? ''].join('|');
}
function cleDuReport(l, numeroCompte) {
    return cleDeLigne({ ...l, libelle: `RAN détail ${numeroCompte} · ${l.libelle ?? ''}` });
}
function apparierReports(origines, reports) {
    const parCle = new Map();
    for (const r of reports)
        parCle.set(r.cle, [...(parCle.get(r.cle) ?? []), r.ligne]);
    const originesParCle = new Map();
    for (const o of origines)
        originesParCle.set(o.cle, [...(originesParCle.get(o.cle) ?? []), o.ligne]);
    const herites = [];
    const nonRetrouvees = [];
    const ambigues = [];
    for (const [cle, os] of originesParCle) {
        const rs = parCle.get(cle) ?? [];
        if (rs.length === 0)
            nonRetrouvees.push(...os);
        else if (rs.length === os.length)
            herites.push(...rs);
        else
            ambigues.push(...os);
    }
    return { herites, nonRetrouvees, ambigues };
}
//# sourceMappingURL=declaration-devise-a-nouveau.js.map