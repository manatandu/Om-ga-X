"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DERNIERE_DATE_LIVREE = exports.MOTIF_BAREME_NON_SAISISSABLE = exports.BAREMES_SERVIS = void 0;
exports.lireValeurs = lireValeurs;
exports.motifRefusVersion = motifRefusVersion;
exports.versionsDuDossier = versionsDuDossier;
exports.annexesSmigDuDossier = annexesSmigDuDossier;
exports.moisCouverts = moisCouverts;
exports.versionsLivrees = versionsLivrees;
const cotisations_paie_1 = require("./cotisations-paie");
const bareme_smig_1 = require("./bareme-smig");
exports.BAREMES_SERVIS = ['CNSS', 'INPP', 'ONEM', 'SMIG'];
exports.MOTIF_BAREME_NON_SAISISSABLE = "Se saisissent les taux CNSS, INPP et ONEM et le SMIG journalier du manœuvre ordinaire · le barème de l'IRPP " +
    '(loi n° 23/053, art. 118) et la tension salariale restent ceux des textes lus par OmegaX.';
exports.DERNIERE_DATE_LIVREE = {
    CNSS: cotisations_paie_1.BAREMES_CNSS[cotisations_paie_1.BAREMES_CNSS.length - 1].aPartirDu,
    SMIG: `${bareme_smig_1.ANNEXES[bareme_smig_1.ANNEXES.length - 1].duMoisDePaie}-01`,
    INPP: cotisations_paie_1.BAREMES_INPP[cotisations_paie_1.BAREMES_INPP.length - 1].aPartirDu,
    ONEM: cotisations_paie_1.BAREMES_ONEM[cotisations_paie_1.BAREMES_ONEM.length - 1].aPartirDu,
};
const dateValide = (s) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s))
        return false;
    const d = new Date(`${s}T00:00:00Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
};
const tauxValide = (x) => typeof x === 'number' && Number.isFinite(x) && x > 0 && x <= 100;
function lireValeurs(bareme, valeurs) {
    const v = (valeurs ?? {});
    const refusTaux = "Chaque taux est un pourcentage strictement positif et au plus égal à 100 · un texte qui supprime une cotisation n'est pas un changement de taux.";
    if (bareme === 'CNSS') {
        const cles = ['prestationsAuxFamilles', 'pensionsEmployeur', 'pensionsTravailleur', 'risquesProfessionnels'];
        if (!cles.every((c) => tauxValide(v[c])))
            return { ok: false, motif: `CNSS · les quatre taux sont obligatoires. ${refusTaux}` };
        if (v.pensionsTravailleur > v.pensionsEmployeur) {
            return {
                ok: false,
                motif: "CNSS · la part des pensions à la charge du travailleur dépasse celle de l'employeur, donc la moitié de la cotisation, ce que la loi n° 16/009, art. 18 interdit « en aucun cas ».",
            };
        }
        return { ok: true, valeurs: Object.fromEntries(cles.map((c) => [c, v[c]])) };
    }
    if (bareme === 'SMIG') {
        const x = v.smigJournalierFc;
        const plafond = bareme_smig_1.ANNEXES[bareme_smig_1.ANNEXES.length - 1].smigJournalierFc * 10;
        if (typeof x !== 'number' || !Number.isFinite(x) || x <= 0 || x > plafond) {
            return { ok: false, motif: `SMIG · le taux JOURNALIER du manœuvre ordinaire, en francs, strictement positif et au plus ${plafond} FC · un montant mensuel se divise par 26 (décret n° 25/22, art. 7).` };
        }
        return { ok: true, valeurs: { smigJournalierFc: x } };
    }
    if (bareme === 'ONEM') {
        if (!tauxValide(v.tauxPourCent))
            return { ok: false, motif: `ONEM · ${refusTaux}` };
        return { ok: true, valeurs: { tauxPourCent: v.tauxPourCent } };
    }
    if (!tauxValide(v.publicPourCent))
        return { ok: false, motif: `INPP · le taux des employeurs publics est obligatoire. ${refusTaux}` };
    const tranches = Array.isArray(v.priveParTranche) ? v.priveParTranche : [];
    if (tranches.length === 0)
        return { ok: false, motif: "INPP · au moins une tranche d'effectif pour le privé." };
    let borne = 0;
    for (let i = 0; i < tranches.length; i++) {
        const t = tranches[i];
        const derniere = i === tranches.length - 1;
        if (!tauxValide(t.tauxPourCent))
            return { ok: false, motif: `INPP · tranche ${i + 1}. ${refusTaux}` };
        if (derniere) {
            if (t.jusqua !== null)
                return { ok: false, motif: "INPP · la dernière tranche est ouverte (« au-delà »), sans borne d'effectif." };
        }
        else {
            if (typeof t.jusqua !== 'number' || !Number.isInteger(t.jusqua) || t.jusqua <= borne) {
                return { ok: false, motif: `INPP · la borne de la tranche ${i + 1} est un effectif entier, supérieur à celle de la tranche précédente.` };
            }
            borne = t.jusqua;
        }
    }
    return {
        ok: true,
        valeurs: {
            publicPourCent: v.publicPourCent,
            priveParTranche: tranches.map((t) => ({ jusqua: t.jusqua ?? null, tauxPourCent: t.tauxPourCent })),
        },
    };
}
function motifRefusVersion(saisie, datesDuDossier) {
    if (!exports.BAREMES_SERVIS.includes(saisie.bareme)) {
        return exports.MOTIF_BAREME_NON_SAISISSABLE;
    }
    const bareme = saisie.bareme;
    if (!dateValide(saisie.aPartirDu))
        return "La date d'effet est une date (AAAA-MM-JJ).";
    if (!saisie.reference || saisie.reference.trim().length < 8) {
        return "Le texte qui fonde la version est obligatoire · numéro, date et article. Il est porté sur chaque bulletin calculé avec ce taux.";
    }
    const dates = [exports.DERNIERE_DATE_LIVREE[bareme], ...datesDuDossier].sort();
    const derniere = dates[dates.length - 1];
    if (saisie.aPartirDu.slice(0, 7) <= derniere.slice(0, 7)) {
        return (`Une version ${bareme} prend effet un mois après la dernière connue, du ${derniere} · ` +
            "insérer une version entre deux autres réécrirait en silence le taux d'une période déjà payée.");
    }
    const lecture = lireValeurs(bareme, saisie.valeurs);
    return lecture.ok ? null : lecture.motif;
}
function versionsDuDossier(lignes) {
    const de = (b) => lignes.filter((l) => l.bareme === b);
    return {
        cnss: de('CNSS').map((l) => ({ ...l.valeurs, aPartirDu: l.aPartirDu, reference: l.reference })),
        inpp: de('INPP').map((l) => ({ ...l.valeurs, aPartirDu: l.aPartirDu, reference: l.reference })),
        onem: de('ONEM').map((l) => ({ tauxPourCent: l.valeurs.tauxPourCent, aPartirDu: l.aPartirDu, reference: l.reference })),
    };
}
function annexesSmigDuDossier(lignes) {
    return lignes
        .filter((l) => l.bareme === 'SMIG')
        .map((l) => (0, bareme_smig_1.annexeDuCabinet)({ aPartirDu: l.aPartirDu, reference: l.reference, smigJournalierFc: l.valeurs.smigJournalierFc }));
}
function moisCouverts(aPartirDu, suivante) {
    return { depuis: aPartirDu.slice(0, 7), avant: suivante ? suivante.slice(0, 7) : null };
}
function versionsLivrees() {
    return {
        CNSS: cotisations_paie_1.BAREMES_CNSS.map((b) => ({
            aPartirDu: b.aPartirDu,
            reference: b.reference,
            valeurs: {
                prestationsAuxFamilles: b.prestationsAuxFamilles,
                pensionsEmployeur: b.pensionsEmployeur,
                pensionsTravailleur: b.pensionsTravailleur,
                risquesProfessionnels: b.risquesProfessionnels,
            },
        })),
        SMIG: bareme_smig_1.ANNEXES.map((a) => ({
            aPartirDu: `${a.duMoisDePaie}-01`,
            reference: `Décret n° 25/22 du 30 mai 2025, annexe ${a.numero}`,
            valeurs: { smigJournalierFc: a.smigJournalierFc },
        })),
        INPP: cotisations_paie_1.BAREMES_INPP.map((b) => ({
            aPartirDu: b.aPartirDu,
            reference: b.reference,
            valeurs: { publicPourCent: b.publicPourCent, priveParTranche: b.priveParTranche },
        })),
        ONEM: cotisations_paie_1.BAREMES_ONEM.map((b) => ({
            aPartirDu: b.aPartirDu,
            reference: b.reference,
            valeurs: { tauxPourCent: b.tauxPourCent },
        })),
    };
}
//# sourceMappingURL=baremes-dossier.js.map