"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FONDEMENT_INDEMNITE_STIPULEE = exports.RESERVE_PRORATA_GRATIFICATION = exports.MOIS_DE_LA_PERIODE_DE_GRATIFICATION = exports.FONDEMENT_RETENUES_DECOMPTE = exports.RESERVE_SAISIE_NON_PROPOSEE = exports.RESERVE_NET_NON_CHIFFRE = exports.RESERVE_PRET_EXIGIBILITE = void 0;
exports.propositionRetenuesDecompte = propositionRetenuesDecompte;
exports.avertissementsSoldesRestants = avertissementsSoldesRestants;
exports.moisEntiersDeService = moisEntiersDeService;
exports.motifRefusGratificationStipulee = motifRefusGratificationStipulee;
exports.propositionGratification = propositionGratification;
exports.motifRefusIndemniteStipulee = motifRefusIndemniteStipulee;
const c = (n) => Math.round(n * 100);
const deCentimes = (n) => n / 100;
exports.RESERVE_PRET_EXIGIBILITE = "PRÊT · l'article 112, f) autorise la retenue « à titre de prêt » sans en fixer le plafond ; que le SOLDE ENTIER devienne " +
    "exigible à la rupture relève du contrat de prêt, qu'aucun article lu ne règle. Confirmez la retenue au vu de ce contrat.";
exports.RESERVE_NET_NON_CHIFFRE = "Le net du décompte n'est pas chiffré (impôt ou cotisation en abstention) · la proposition est le solde, et l'émission " +
    "refusera toute retenue qui rendrait le net négatif.";
exports.RESERVE_SAISIE_NON_PROPOSEE = "SAISIE-ARRÊT · non proposée. Ce qu'elle retient est fixé par l'acte notifié (AUPSRVE, art. 184, 3°), « sans excéder la " +
    "portion saisissable » (art. 188), jamais par un solde · saisissez la retenue de l'acte, comme sur un bulletin.";
exports.FONDEMENT_RETENUES_DECOMPTE = "Code du travail, art. 112 · « les retenues ci-après sont autorisées : [...] c) retenues à titre d'avances ; [...] " +
    "f) retenues à titre de prêt ». Aucun plafond n'est écrit pour elles (l'article 114 ne vaut que pour le litera d) · la " +
    "retenue ne dépasse ni le solde dû, ni ce qui reste dû au travailleur.";
function propositionRetenuesDecompte(avances, netDisponibleFc) {
    const reserves = [];
    const ordre = (a) => (a.type === 'PRET' ? 1 : 0);
    const candidates = avances
        .filter((a) => a.type !== 'SAISIE_ARRET' && c(a.soldeFc) > 0)
        .slice()
        .sort((x, y) => ordre(x) - ordre(y) || x.dateOctroi.localeCompare(y.dateOctroi) || x.avanceId.localeCompare(y.avanceId));
    const saisies = avances
        .filter((a) => a.type === 'SAISIE_ARRET' && c(a.soldeFc) > 0)
        .map((a) => ({ avanceId: a.avanceId, libelle: a.libelle, soldeFc: a.soldeFc }));
    if (saisies.length > 0)
        reserves.push(exports.RESERVE_SAISIE_NON_PROPOSEE);
    if (netDisponibleFc === null && candidates.length > 0)
        reserves.push(exports.RESERVE_NET_NON_CHIFFRE);
    let disponible = netDisponibleFc === null ? Number.POSITIVE_INFINITY : Math.max(0, c(netDisponibleFc));
    let reste = 0;
    const retenues = candidates.map((a) => {
        const solde = c(a.soldeFc);
        const propose = Math.min(solde, disponible);
        disponible -= propose;
        reste += solde - propose;
        const borneParLeNet = propose < solde;
        const reserve = [
            a.type === 'PRET' ? exports.RESERVE_PRET_EXIGIBILITE : null,
            borneParLeNet
                ? `Ramenée de ${a.soldeFc.toFixed(2)} FC à ${deCentimes(propose).toFixed(2)} FC · le net du décompte ne porte pas davantage, et un net négatif ne se paie pas. Le reste demeure dû au registre.`
                : null,
        ]
            .filter((x) => x !== null)
            .join(' ') || null;
        return {
            avanceId: a.avanceId,
            littera: a.type === 'PRET' ? 'f' : 'c',
            libelle: a.libelle,
            soldeFc: a.soldeFc,
            montantProposeFc: deCentimes(propose),
            reserve,
        };
    });
    return {
        retenues,
        saisiesNonProposees: saisies,
        netDisponibleFc,
        resteNonRetenuFc: deCentimes(reste),
        reserves,
    };
}
function avertissementsSoldesRestants(avances, retenuesFc) {
    return avances
        .filter((a) => a.type !== 'SAISIE_ARRET')
        .map((a) => ({ a, reste: c(a.soldeFc) - c(retenuesFc[a.avanceId] ?? 0) }))
        .filter(({ reste }) => reste > 0)
        .map(({ a, reste }) => `${a.libelle} · ${deCentimes(reste).toFixed(2)} FC restent dus au registre après ce décompte (art. 112, ${a.type === 'PRET' ? 'f' : 'c'}). ` +
        "Le décompte ne les retient pas · ils se recouvrent hors de la paie, ou se retiennent en annulant puis en réémettant le décompte.");
}
const DATE_ISO = /^\d{4}-\d{2}-\d{2}$/;
const lireDate = (s) => {
    if (!DATE_ISO.test(s))
        return null;
    const d = new Date(`${s}T00:00:00Z`);
    return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== s ? null : d;
};
function moisEntiersDeService(debut, finIncluse) {
    if (finIncluse < debut)
        return 0;
    const lendemain = new Date(finIncluse.getTime() + 86_400_000);
    let mois = (lendemain.getUTCFullYear() - debut.getUTCFullYear()) * 12 + (lendemain.getUTCMonth() - debut.getUTCMonth());
    const jourAnniversaire = Math.min(debut.getUTCDate(), new Date(Date.UTC(lendemain.getUTCFullYear(), lendemain.getUTCMonth() + 1, 0)).getUTCDate());
    if (lendemain.getUTCDate() < jourAnniversaire)
        mois -= 1;
    return Math.max(0, mois);
}
exports.MOIS_DE_LA_PERIODE_DE_GRATIFICATION = 12;
function motifRefusGratificationStipulee(g) {
    if (!(g.montantAnnuelFc > 0))
        return 'Le montant annuel stipulé de la gratification doit être positif.';
    if (!g.source?.trim()) {
        return "La source de la gratification (contrat, avenant, convention collective, décision de l'employeur) est obligatoire · aucun article du Code n'en impose le versement.";
    }
    const debut = lireDate(g.debutPeriode);
    const fin = lireDate(g.finPeriode);
    if (!debut || !fin)
        return 'Les dates de la période de référence de la gratification sont illisibles (AAAA-MM-JJ).';
    if (fin < debut)
        return 'La fin de la période de référence de la gratification précède son début.';
    if (moisEntiersDeService(debut, fin) > exports.MOIS_DE_LA_PERIODE_DE_GRATIFICATION) {
        return "La période de référence de la gratification dépasse douze mois · une gratification due pour une période échue se déclare à part, elle n'est pas un prorata.";
    }
    return null;
}
exports.RESERVE_PRORATA_GRATIFICATION = "PRORATA · lecture d'OmegaX, le Code se tait. Il compte les mois ENTIERS de service de la période de référence, date à " +
    "date (l'unité de l'article 141), sur douze ; la stipulation peut en fixer une autre (jours, mois entamés, condition de " +
    "présence) · le cabinet confirme le montant qu'il retient.";
function propositionGratification(g) {
    if (motifRefusGratificationStipulee(g) !== null)
        return null;
    const mois = moisEntiersDeService(lireDate(g.debutPeriode), lireDate(g.finPeriode));
    const montant = deCentimes(Math.round((c(g.montantAnnuelFc) * mois) / exports.MOIS_DE_LA_PERIODE_DE_GRATIFICATION));
    return {
        montantFc: montant,
        moisEntiers: mois,
        base: `${g.montantAnnuelFc.toFixed(2)} FC stipulés (${g.source.trim()}) × ${mois} mois entiers de service du ${g.debutPeriode} ` +
            `au ${g.finPeriode} / ${exports.MOIS_DE_LA_PERIODE_DE_GRATIFICATION} = ${montant.toFixed(2)} FC.`,
    };
}
function motifRefusIndemniteStipulee(i) {
    if (!(i.montantFc > 0))
        return "Le montant de l'indemnité de fin de contrat stipulée doit être positif · sans stipulation, ne la déclarez pas.";
    if (!i.source?.trim()) {
        return "La source de l'indemnité stipulée (clause du contrat, convention collective) est obligatoire · OmegaX ne la calcule jamais, il la recopie.";
    }
    return null;
}
exports.FONDEMENT_INDEMNITE_STIPULEE = "Indemnité STIPULÉE, recopiée et jamais calculée par OmegaX. Le Code laisse les parties fixer davantage que la loi " +
    "(art. 64, al. 1er, « sauf durée plus longue fixée par les parties ou par la convention collective ») et frappe de " +
    "nullité la clause moins favorable (art. 37, al. 2) · elle s'ajoute aux sommes légales du décompte, qu'elle ne réduit pas. " +
    "Passée au 6614 (fiche du compte 66, « Indemnités de préavis, de licenciement et de recherche d'embauche »).";
//# sourceMappingURL=decompte-retenues-stipulations.js.map