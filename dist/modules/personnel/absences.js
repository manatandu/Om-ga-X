"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NATURES_INDEMNISEES_PAR_LA_CAISSE = exports.finDesSixMois = exports.joursOuvrables = exports.iso = exports.PREMIER_JOUR_LISIBLE = exports.MATERNITE_JOURS_AU_PLUS = exports.MISES_A_PIED_PAR_AN = exports.MISE_A_PIED_JOURS_AU_PLUS = exports.PLAFOND_CIRCONSTANCE_PAR_AN = exports.EVENEMENTS_CIRCONSTANCE = exports.NATURES_ABSENCE_LISTE = exports.NATURES_ABSENCE = void 0;
exports.jourUtc = jourUtc;
exports.joursDeLAbsence = joursDeLAbsence;
exports.motifRefusAbsence = motifRefusAbsence;
exports.debutsDesSuspensions = debutsDesSuspensions;
exports.joursOuvrablesDuMois = joursOuvrablesDuMois;
exports.congesDuMois = congesDuMois;
exports.motifRefusSalairePleinPendantLeConge = motifRefusSalairePleinPendantLeConge;
exports.motifRefusAnnulationDuCongeRetranche = motifRefusAnnulationDuCongeRetranche;
exports.raisonDeLaGardeMuette = raisonDeLaGardeMuette;
exports.avertissementGardeMuette = avertissementGardeMuette;
exports.propositionDuMois = propositionDuMois;
exports.absencesPourLeCompteur = absencesPourLeCompteur;
exports.motifRefusIndemniteCaisse = motifRefusIndemniteCaisse;
const jours_du_code_du_travail_1 = require("./jours-du-code-du-travail");
const remuneration_du_delai_1 = require("./remuneration-du-delai");
exports.NATURES_ABSENCE = {
    MALADIE_OU_ACCIDENT: {
        libelle: 'Maladie ou accident',
        fondement: 'Code du travail, art. 57, 1° ; art. 105',
        regime: 'DEUX_TIERS',
        conge: 'INCAPACITE_PLAFONNEE',
        maladie: true,
        piece: 'certificat médical',
        demiJournees: true,
    },
    ACCIDENT_DU_TRAVAIL_OU_MALADIE_PROFESSIONNELLE: {
        libelle: 'Accident du travail ou maladie professionnelle',
        fondement: 'Code du travail, art. 57, 1° ; art. 106',
        regime: 'DEUX_TIERS',
        conge: 'INCAPACITE_SANS_PLAFOND',
        maladie: true,
        piece: 'certificat médical',
        demiJournees: true,
    },
    MATERNITE: {
        libelle: 'Maternité',
        fondement: 'Code du travail, art. 57, 1° ; art. 130',
        regime: 'DEUX_TIERS',
        conge: 'INCAPACITE_PLAFONNEE',
        maladie: false,
        piece: 'certificat médical',
        demiJournees: false,
    },
    CONGE_DE_CIRCONSTANCE: {
        libelle: 'Congé de circonstance',
        fondement: 'Code du travail, art. 146',
        regime: 'DUE',
        conge: 'SERVICE',
        maladie: false,
        piece: null,
        demiJournees: false,
    },
    EMPECHEMENT_DU_FAIT_DE_L_EMPLOYEUR: {
        libelle: "Empêchement du fait de l'employeur",
        fondement: 'Code du travail, art. 93',
        regime: 'DUE',
        conge: 'SERVICE',
        maladie: false,
        piece: null,
        demiJournees: true,
    },
    ABSENCE_NON_AUTORISEE: {
        libelle: 'Absence non autorisée',
        fondement: 'Code du travail, art. 93',
        regime: 'NON_DUE',
        conge: 'HORS_SERVICE',
        maladie: false,
        piece: null,
        demiJournees: true,
    },
    MISE_A_PIED: {
        libelle: 'Mise à pied disciplinaire',
        fondement: 'Code du travail, art. 57, 5° ; art. 58',
        regime: 'ARRETE_ABSENT',
        conge: 'HORS_SERVICE',
        maladie: false,
        piece: 'décision de mise à pied',
        demiJournees: false,
    },
    OBLIGATIONS_MILITAIRES: {
        libelle: 'Obligations militaires',
        fondement: 'Code du travail, art. 57, 2° ; art. 58',
        regime: 'ARRETE_ABSENT',
        conge: 'HORS_SERVICE',
        maladie: false,
        piece: null,
        demiJournees: false,
    },
    REQUISITION: {
        libelle: 'Réquisition',
        fondement: 'Code du travail, art. 57, 3° ; art. 58',
        regime: 'ARRETE_ABSENT',
        conge: 'HORS_SERVICE',
        maladie: false,
        piece: null,
        demiJournees: false,
    },
    MANDAT_PUBLIC: {
        libelle: 'Mandat public ou obligation civique',
        fondement: 'Code du travail, art. 57, 4° ; art. 58',
        regime: 'ARRETE_ABSENT',
        conge: 'HORS_SERVICE',
        maladie: false,
        piece: null,
        demiJournees: true,
    },
    GREVE_OU_LOCK_OUT: {
        libelle: 'Grève ou lock-out',
        fondement: 'Code du travail, art. 57, 6° ; art. 58',
        regime: 'ARRETE_ABSENT',
        conge: 'HORS_SERVICE',
        maladie: false,
        piece: null,
        demiJournees: true,
    },
    INCARCERATION: {
        libelle: 'Incarcération',
        fondement: 'Code du travail, art. 57, 7° ; art. 58',
        regime: 'ARRETE_ABSENT',
        conge: 'HORS_SERVICE',
        maladie: false,
        piece: null,
        demiJournees: false,
    },
    FORCE_MAJEURE: {
        libelle: 'Force majeure',
        fondement: 'Code du travail, art. 57, 8° ; art. 59',
        regime: 'NON_DUE',
        conge: 'HORS_SERVICE',
        maladie: false,
        piece: "constat de l'Inspecteur du Travail",
        demiJournees: false,
    },
};
exports.NATURES_ABSENCE_LISTE = Object.keys(exports.NATURES_ABSENCE);
exports.EVENEMENTS_CIRCONSTANCE = {
    MARIAGE_DU_TRAVAILLEUR: { libelle: 'Mariage du travailleur', jours: 2 },
    ACCOUCHEMENT_DE_L_EPOUSE: { libelle: "Accouchement de l'épouse", jours: 2 },
    DECES_CONJOINT_OU_PARENT_PREMIER_DEGRE: { libelle: "Décès du conjoint, ou d'un parent allié au 1er degré", jours: 4 },
    MARIAGE_D_UN_ENFANT: { libelle: "Mariage d'un enfant", jours: 1 },
    DECES_PARENT_SECOND_DEGRE: { libelle: "Décès d'un parent ou allié au second degré", jours: 2 },
};
exports.PLAFOND_CIRCONSTANCE_PAR_AN = 15;
exports.MISE_A_PIED_JOURS_AU_PLUS = 15;
exports.MISES_A_PIED_PAR_AN = 2;
exports.MATERNITE_JOURS_AU_PLUS = 14 * 7;
exports.PREMIER_JOUR_LISIBLE = '2023-03-30';
const JOURS_AU_PLUS = 3_660;
const JOUR = /^(\d{4})-(\d{2})-(\d{2})$/;
const iso = (d) => d.toISOString().slice(0, 10);
exports.iso = iso;
function jourUtc(s) {
    const m = JOUR.exec(s);
    if (!m)
        return null;
    const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
    return Number.isNaN(d.getTime()) || (0, exports.iso)(d) !== s ? null : d;
}
const plusJours = (d, n) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + n));
function joursDeLAbsence(a) {
    const du = jourUtc(a.du);
    const au = jourUtc(a.au);
    if (!du || !au)
        return { refus: "Les dates de l'absence se lisent AAAA-MM-JJ." };
    if (au.getTime() < du.getTime())
        return { refus: "L'absence finit avant de commencer." };
    if (a.du < exports.PREMIER_JOUR_LISIBLE) {
        return { refus: "L'absence commence avant le 30 mars 2023 · la liste des jours fériés antérieure à l'ordonnance n° 23-042 n'est pas au corpus." };
    }
    const jours = [];
    for (let i = 0, d = du; d.getTime() <= au.getTime(); i += 1, d = plusJours(du, i)) {
        if (i > JOURS_AU_PLUS)
            return { refus: "L'absence dépasse dix ans de calendrier · elle ne se compte pas." };
        const ouvrable = (0, jours_du_code_du_travail_1.natureDuJour)(d) === 'OUVRABLE';
        const demi = a.du === a.au
            ? a.demiJourneeDebut || a.demiJourneeFin
            : ((0, exports.iso)(d) === a.du && a.demiJourneeDebut) || ((0, exports.iso)(d) === a.au && a.demiJourneeFin);
        jours.push({ jour: (0, exports.iso)(d), ouvrable, poids: demi ? 0.5 : 1 });
    }
    return jours;
}
const joursOuvrables = (jours) => jours.filter((j) => j.ouvrable).reduce((n, j) => n + j.poids, 0);
exports.joursOuvrables = joursOuvrables;
function motifRefusAbsence(a, autres) {
    const def = exports.NATURES_ABSENCE[a.nature];
    if (!def)
        return "Nature d'absence inconnue.";
    const jours = joursDeLAbsence(a);
    if ('refus' in jours)
        return jours.refus;
    if ((a.demiJourneeDebut || a.demiJourneeFin) && !def.demiJournees) {
        return `${def.libelle} · ne se compte pas en demi-journées (${def.fondement}).`;
    }
    if (def.piece && (a.piece ?? '').trim().length < 3)
        return `${def.libelle} · la pièce se déclare (${def.piece}).`;
    const chevauche = autres.find((x) => x.id !== a.id && x.du <= a.au && x.au >= a.du);
    if (chevauche) {
        return `L'absence chevauche celle du ${chevauche.du} au ${chevauche.au} (${exports.NATURES_ABSENCE[chevauche.nature].libelle}) · une journée n'a qu'une cause.`;
    }
    if (a.nature === 'CONGE_DE_CIRCONSTANCE') {
        const ev = a.evenement ? exports.EVENEMENTS_CIRCONSTANCE[a.evenement] : undefined;
        if (!ev)
            return "Congé de circonstance · l'événement se déclare (Code du travail, art. 146).";
        const n = (0, exports.joursOuvrables)(jours);
        if (n > ev.jours) {
            return `Congé de circonstance · ${ev.libelle.toLowerCase()} ouvre ${ev.jours} jour(s) ouvrable(s), l'absence en compte ${n} (Code du travail, art. 146). Le surplus se déclare sous sa propre nature.`;
        }
    }
    if (a.nature === 'MISE_A_PIED') {
        if (jours.length > exports.MISE_A_PIED_JOURS_AU_PLUS) {
            return `Mise à pied · ${jours.length} jours de calendrier ; le Code n'en fait une cause de suspension que « jusqu'à concurrence de deux fois quinze jours par an » (art. 57, 5°).`;
        }
        const memeAnnee = autres.filter((x) => x.id !== a.id && x.nature === 'MISE_A_PIED' && x.du.slice(0, 4) === a.du.slice(0, 4));
        if (memeAnnee.length >= exports.MISES_A_PIED_PAR_AN) {
            return `Mise à pied · ${memeAnnee.length} mesure(s) déjà enregistrée(s) en ${a.du.slice(0, 4)} ; le Code n'en admet que deux de quinze jours par an (art. 57, 5°).`;
        }
    }
    if (a.nature === 'MATERNITE' && jours.length > exports.MATERNITE_JOURS_AU_PLUS) {
        return `Maternité · ${jours.length} jours de calendrier ; la suspension est de « quatorze semaines consécutives » (Code du travail, art. 130).`;
    }
    return null;
}
function joursDeCirconstanceNonDus(absences) {
    const parAn = new Map();
    const nonDus = new Set();
    const tries = absences.filter((a) => a.nature === 'CONGE_DE_CIRCONSTANCE').sort((x, y) => x.du.localeCompare(y.du));
    for (const a of tries) {
        const jours = joursDeLAbsence(a);
        if ('refus' in jours)
            continue;
        for (const j of jours) {
            if (!j.ouvrable)
                continue;
            const an = j.jour.slice(0, 4);
            const deja = parAn.get(an) ?? 0;
            if (deja + j.poids > exports.PLAFOND_CIRCONSTANCE_PAR_AN)
                nonDus.add(j.jour);
            parAn.set(an, deja + j.poids);
        }
    }
    return nonDus;
}
const finDesSixMois = (du) => (0, exports.iso)((0, remuneration_du_delai_1.plusMois)(jourUtc(du), 6));
exports.finDesSixMois = finDesSixMois;
function debutsDesSuspensions(absences) {
    const debuts = new Map();
    const parNature = new Map();
    for (const a of absences)
        parNature.set(a.nature, [...(parNature.get(a.nature) ?? []), a]);
    for (const liste of parNature.values()) {
        const tries = [...liste].sort((x, y) => x.du.localeCompare(y.du) || x.au.localeCompare(y.au));
        let precedente = null;
        let debut = null;
        for (const a of tries) {
            if (precedente && debut && seSuivent(precedente, a)) {
                debuts.set(a.id, debut);
                if (a.au > precedente.au)
                    precedente = a;
            }
            else {
                debut = a.du;
                debuts.set(a.id, a.du);
                precedente = a;
            }
        }
    }
    return debuts;
}
function seSuivent(avant, apres) {
    if (avant.demiJourneeFin || apres.demiJourneeDebut)
        return false;
    if (apres.du <= avant.au)
        return true;
    const fin = jourUtc(avant.au);
    const debut = jourUtc(apres.du);
    if (!fin || !debut)
        return false;
    for (let i = 1, d = plusJours(fin, 1); d.getTime() < debut.getTime(); i += 1, d = plusJours(fin, i)) {
        if (i > 31 || (0, jours_du_code_du_travail_1.estJourOuvrableDuCode)(d))
            return false;
    }
    return true;
}
function regimeDuJour(a, jour, circonstanceNonDue, debutSuspension) {
    const def = exports.NATURES_ABSENCE[a.nature];
    if (a.nature === 'CONGE_DE_CIRCONSTANCE' && circonstanceNonDue.has(jour))
        return 'NON_DUE';
    if (a.nature === 'ACCIDENT_DU_TRAVAIL_OU_MALADIE_PROFESSIONNELLE' && jour >= (0, exports.finDesSixMois)(debutSuspension))
        return 'NON_DUE';
    return def.regime;
}
function joursOuvrablesDuMois(absences, mois, subrogees = new Set()) {
    const nonDus = joursDeCirconstanceNonDus(absences);
    const debuts = debutsDesSuspensions(absences);
    const sortie = [];
    for (const a of absences) {
        if (a.au.slice(0, 7) < mois || a.du.slice(0, 7) > mois)
            continue;
        const jours = joursDeLAbsence(a);
        if ('refus' in jours)
            continue;
        for (const j of jours) {
            if (!j.ouvrable || j.jour.slice(0, 7) !== mois)
                continue;
            const regime = regimeDuJour(a, j.jour, nonDus, debuts.get(a.id) ?? a.du);
            sortie.push({ jour: j.jour, absenceId: a.id, nature: a.nature, poids: j.poids, regime: regime === 'DEUX_TIERS' && subrogees.has(a.id) ? 'DUE' : regime });
        }
    }
    return sortie;
}
function congesDuMois(conges, mois, joursMaladie) {
    const sortie = [];
    for (const c of conges) {
        if (c.au.slice(0, 7) < mois || c.du.slice(0, 7) > mois)
            continue;
        const du = jourUtc(c.du);
        const au = jourUtc(c.au);
        if (!du || !au || au.getTime() < du.getTime())
            continue;
        let ouvrablesDuMois = 0;
        for (let i = 0, d = du; d.getTime() <= au.getTime() && i <= JOURS_AU_PLUS; i += 1, d = plusJours(du, i)) {
            if ((0, exports.iso)(d).slice(0, 7) !== mois || !(0, jours_du_code_du_travail_1.estJourOuvrableDuCode)(d) || joursMaladie.has((0, exports.iso)(d)))
                continue;
            ouvrablesDuMois += 1;
        }
        const voyage = Math.max(0, c.joursVoyage);
        const aCheval = c.du.slice(0, 7) !== c.au.slice(0, 7);
        const auMoins = Math.max(0, ouvrablesDuMois - voyage);
        sortie.push({
            id: c.id,
            du: c.du,
            au: c.au,
            ouvrablesDuMois,
            joursDeConge: aCheval && voyage > 0 ? null : aCheval ? ouvrablesDuMois : auMoins,
            auMoins,
        });
    }
    return sortie;
}
function plafondHorsConge(p) {
    const base = baseDuMois(p.mois, p.joursAbsenceDuMois + p.auMoins);
    const retenus = Math.min(base, p.auMoins);
    const declares = p.conges
        .filter((c) => c.auMoins > 0 && c.remunerationJournaliere != null && c.deviseAllocation === p.devise)
        .map((c) => arrondi(c.remunerationJournaliere * remuneration_du_delai_1.JOURS_DU_MOIS_REMUNERES));
    const duConge = declares.length ? Math.max(...declares) : 0;
    const reference = Math.max(p.salaireMensuel, duConge);
    return {
        base,
        retenus,
        reference,
        referenceDuConge: duConge > p.salaireMensuel,
        plafond: arrondi((reference * (base - retenus)) / base),
    };
}
const ISSUE_CONTRAT_EN_VIGUEUR = " Si la rémunération a changé depuis le contrat enregistré, saisissez d'abord le contrat en vigueur au registre du personnel, ou déclarez au congé la rémunération journalière du départ.";
function motifRefusSalairePleinPendantLeConge(p) {
    const auMoins = p.conges.reduce((n, c) => n + c.auMoins, 0);
    if (auMoins <= 0 || p.salaireMensuel === null)
        return null;
    const h = plafondHorsConge({
        mois: p.mois,
        auMoins,
        joursAbsenceDuMois: p.joursAbsenceDuMois ?? 0,
        salaireMensuel: p.salaireMensuel,
        conges: p.conges,
        devise: p.devise,
    });
    if (Math.round(p.salaireDuBulletin * 100) <= Math.round(h.plafond * 100))
        return null;
    const quels = p.conges
        .filter((c) => c.auMoins > 0)
        .map((c) => `du ${c.du} au ${c.au}`)
        .join(', ');
    const f = (n) => n.toFixed(2);
    const sujet = p.bulletinEmis ? `Le bulletin n° ${p.bulletinEmis.numero} de ${p.mois}, déjà émis,` : `Le bulletin de ${p.mois}`;
    const issue = p.bulletinEmis ? p.bulletinEmis.issue : "reprenez la proposition « Absences et congés du mois », ou annulez le congé s'il n'a pas été pris.";
    const reference = h.referenceDuConge ? 'rémunération journalière déclarée au congé × 26' : 'salaire mensuel du contrat';
    const base = h.base !== remuneration_du_delai_1.JOURS_DU_MOIS_REMUNERES ? ` ; absences et congés couvrent le mois, la base est celle de ses ${h.base} jours payables` : '';
    return (`${sujet} paie ${f(p.salaireDuBulletin)} ${p.devise} de salaire alors que ${h.retenus} jour(s) de ce mois sont payés par l'allocation de congé (congé ${quels}) · ` +
        `pendant le congé, l'allocation remplace la rémunération, elle ne s'y ajoute pas (Code du travail, art. 142 et 93 ; livre de paie, arrêté du 8 août 2008, mentions 6, 14 et 28). ` +
        `Le salaire des jours hors congé est au plus ${f(h.plafond)} ${p.devise} (${f(h.reference)} × ${h.base - h.retenus} ÷ ${h.base}, ${reference}${base}) · ${issue}` +
        (h.referenceDuConge ? '' : ISSUE_CONTRAT_EN_VIGUEUR));
}
function motifRefusAnnulationDuCongeRetranche(p) {
    if (p.conge.auMoins <= 0)
        return null;
    const h = plafondHorsConge({
        mois: p.mois,
        auMoins: p.conge.auMoins,
        joursAbsenceDuMois: p.joursAbsenceDuMois ?? 0,
        salaireMensuel: p.salaireMensuel,
        conges: [],
        devise: p.devise,
    });
    if (Math.round(p.salaireDuBulletin * 100) > Math.round(h.plafond * 100))
        return null;
    const f = (n) => n.toFixed(2);
    return (`Le bulletin n° ${p.numero} de ${p.mois}, émis, paie ${f(p.salaireDuBulletin)} ${p.devise} de salaire, au plus le salaire des jours hors de ce congé (${f(h.plafond)} ${p.devise}) · ` +
        `il retranche les ${h.retenus} jour(s) de ce congé en ${p.mois}, que l'allocation paie (Code du travail, art. 142). Annulé seul, le congé laisserait ces jours sans salaire ni allocation · ` +
        `annulez d'abord le bulletin n° ${p.numero}, puis le congé, et réémettez le bulletin de ${p.mois} avec le salaire de ces jours.`);
}
function raisonDeLaGardeMuette(contrat, devise) {
    if (!contrat)
        return 'aucun contrat ne couvre le mois';
    if (!contrat.periodiciteRemuneration)
        return "la périodicité de la rémunération n'est pas renseignée au contrat";
    if (contrat.periodiciteRemuneration !== 'MOIS') {
        const quelle = contrat.periodiciteRemuneration === 'JOUR' ? 'à la journée' : contrat.periodiciteRemuneration === 'SEMAINE' ? 'à la semaine' : "à l'année";
        return `le contrat est payé ${quelle}, pas au mois`;
    }
    if (contrat.remunerationBase === null || contrat.remunerationBase === undefined)
        return "la rémunération n'est pas renseignée au contrat";
    if (!contrat.deviseRemuneration)
        return "la monnaie de la rémunération n'est pas renseignée au contrat";
    if (contrat.deviseRemuneration !== devise)
        return `le contrat est stipulé en ${contrat.deviseRemuneration}, le bulletin en ${devise}`;
    return null;
}
function avertissementGardeMuette(p) {
    const jours = p.conges.reduce((n, c) => n + c.auMoins, 0);
    if (jours <= 0)
        return null;
    const quels = p.conges
        .filter((c) => c.auMoins > 0)
        .map((c) => `du ${c.du} au ${c.au}`)
        .join(', ');
    const sujet = p.numero !== undefined ? `Le bulletin n° ${p.numero} de ${p.mois}` : `Le bulletin de ${p.mois}`;
    return (`${sujet} n'est pas confronté aux ${jours} jour(s) de congé de ce mois (congé ${quels}) · ${p.raison}. ` +
        `Vérifiez que son salaire ne paie pas ces jours · l'allocation de congé les paie (Code du travail, art. 142).`);
}
function propositionDuMois(p) {
    const somme = (r) => p.jours.filter((j) => j.regime === r).reduce((n, j) => n + j.poids, 0);
    const joursDeuxTiers = somme('DEUX_TIERS');
    const joursNonDus = somme('NON_DUE');
    const joursNonTranches = somme('ARRETE_ABSENT');
    const motifs = [];
    if (joursNonTranches > 0) {
        motifs.push(`${joursNonTranches} jour(s) d'une cause de suspension dont les droits sont fixés par l'arrêté de l'art. 58 du Code du travail, qui n'est pas au corpus · rien n'est proposé, le salaire du mois se saisit.`);
    }
    if (p.salaireMensuel === null)
        motifs.push("Le contrat n'est pas payé au mois, ou sa rémunération n'est pas renseignée · rien n'est proposé.");
    const conges = p.conges ?? [];
    const nonPlaces = conges.filter((c) => c.joursDeConge === null);
    for (const c of nonPlaces) {
        motifs.push(`Le congé du ${c.du} au ${c.au} est à cheval sur deux mois et porte des jours de voyage, dont aucune date ne dit le mois (art. 141, al. 3) · rien n'est proposé, le salaire du mois se saisit, au plus ${c.ouvrablesDuMois} jour(s) de congé retranchés.`);
    }
    const joursDeConge = conges.reduce((n, c) => n + (c.joursDeConge ?? 0), 0);
    if (joursDeuxTiers > 0 && p.moyenneMensuelleArticle66 === null) {
        motifs.push("La moyenne mensuelle des douze mois (art. 66, auquel renvoie l'art. 105) n'est pas déclarée · l'indemnité d'incapacité ne se chiffre pas.");
    }
    const base = p.mois ? baseDuMois(p.mois, p.jours.reduce((n, j) => n + j.poids, 0) + joursDeConge) : remuneration_du_delai_1.JOURS_DU_MOIS_REMUNERES;
    const retenus = Math.min(base, joursDeuxTiers + joursNonDus + joursDeConge);
    const bloque = joursNonTranches > 0 || p.salaireMensuel === null || nonPlaces.length > 0;
    const salaireDesJoursDus = bloque ? null : arrondi((p.salaireMensuel * (base - retenus)) / base);
    const indemniteBrute = bloque || (joursDeuxTiers > 0 && p.moyenneMensuelleArticle66 === null)
        ? null
        : arrondi(((p.salaireMensuel + (p.moyenneMensuelleArticle66 ?? 0)) * Math.min(base, joursDeuxTiers) * 2) / (3 * base));
    let deductionsCaisse = 0;
    if (indemniteBrute !== null && joursDeuxTiers > 0 && p.deductionsParAbsence) {
        for (const [absenceId, montant] of p.deductionsParAbsence) {
            const siens = p.jours.filter((j) => j.absenceId === absenceId && j.regime === 'DEUX_TIERS').reduce((n, j) => n + j.poids, 0);
            const part = arrondi((indemniteBrute * siens) / joursDeuxTiers);
            deductionsCaisse += Math.min(Math.max(0, montant), part);
        }
        deductionsCaisse = arrondi(deductionsCaisse);
    }
    const indemniteDeuxTiers = indemniteBrute === null ? null : arrondi(indemniteBrute - deductionsCaisse);
    let aRecevoirDeLaCaisse = arrondi(p.aRecevoirDeLaCaisse ?? 0);
    for (const [absenceId, montant] of p.subrogationsPartielles ?? new Map()) {
        if (indemniteBrute === null || aRecevoirDeLaCaisse === null) {
            aRecevoirDeLaCaisse = null;
            motifs.push("La somme à recevoir de la Caisse par subrogation partielle se borne à la partie versée par l'employeur (arrêté n° 146/2018, art. 139, al. 3) · elle ne se chiffre pas tant que les deux tiers du mois ne se chiffrent pas.");
            break;
        }
        const siens = p.jours.filter((j) => j.absenceId === absenceId && j.regime === 'DEUX_TIERS').reduce((n, j) => n + j.poids, 0);
        const partieVersee = joursDeuxTiers > 0 ? arrondi((indemniteBrute * siens) / joursDeuxTiers) : 0;
        const retenu = Math.min(Math.max(0, montant), partieVersee);
        if (montant > partieVersee + 0.005) {
            motifs.push(`L'indemnité de la Caisse déclarée (${montant.toFixed(2)}) dépasse la partie versée par l'employeur pour cet arrêt (${partieVersee.toFixed(2)}) · l'employeur n'est subrogé qu'à la limite de la partie versée (arrêté n° 146/2018, art. 139, al. 3), le surplus revient au travailleur.`);
        }
        aRecevoirDeLaCaisse = arrondi(aRecevoirDeLaCaisse + retenu);
    }
    return {
        joursDeuxTiers,
        joursNonDus,
        joursNonTranches,
        joursDeConge,
        joursPayesAPlein: bloque ? null : base - retenus,
        salaireDesJoursDus,
        indemniteDeuxTiers,
        deductionsCaisse,
        aRecevoirDeLaCaisse,
        baseDuMois: base,
        motifs,
        explication: bloque
            ? null
            : `Salaire mensuel × (${base} − ${retenus}) ÷ ${base}` +
                (base !== remuneration_du_delai_1.JOURS_DU_MOIS_REMUNERES ? ` · l'absence couvre le mois entier, la base est celle de ses ${base} jours payables` : '') +
                (joursDeConge > 0 ? ` ; ${joursDeConge} jour(s) de congé payés par l'allocation, qui remplace le salaire de ces jours (art. 142)` : '') +
                (joursDeuxTiers > 0 ? ` ; indemnité d'incapacité = (salaire mensuel + moyenne de l'art. 66) × ${joursDeuxTiers} × 2/3 ÷ ${base}` : '') +
                (deductionsCaisse > 0 ? `, moins ${deductionsCaisse} versés par la Caisse (art. 106, al. 2)` : '') +
                ' · vingt-six jours payés par mois (décret n° 25/22, art. 7, par analogie), jours fériés de l’absence payés à plein (art. 93).',
    };
}
const arrondi = (n) => Math.round(n * 100) / 100;
function baseDuMois(mois, couverts) {
    const [a, m] = mois.split('-').map(Number);
    let ouvrables = 0;
    let payables = 0;
    for (let d = new Date(Date.UTC(a, m - 1, 1)); d.getUTCMonth() === m - 1; d = plusJours(d, 1)) {
        if ((0, jours_du_code_du_travail_1.estJourOuvrableDuCode)(d))
            ouvrables += 1;
        if ((0, jours_du_code_du_travail_1.estJourRemunere)(d))
            payables += 1;
    }
    return ouvrables > 0 && couverts >= ouvrables ? payables : remuneration_du_delai_1.JOURS_DU_MOIS_REMUNERES;
}
function absencesPourLeCompteur(absences, origine) {
    const joursHorsService = [];
    const joursMaladie = new Set();
    const cumul = new Map();
    const anneeDeService = (jour) => {
        if (!origine)
            return 0;
        const o = jourUtc(origine);
        let k = 0;
        while ((0, exports.iso)((0, remuneration_du_delai_1.plusMois)(o, 12 * (k + 1))) <= jour)
            k += 1;
        return k;
    };
    const tries = [...absences].sort((x, y) => x.du.localeCompare(y.du));
    for (const a of tries) {
        const def = exports.NATURES_ABSENCE[a.nature];
        const jours = joursDeLAbsence(a);
        if ('refus' in jours)
            continue;
        if (def.maladie)
            for (const j of jours)
                joursMaladie.add(j.jour);
        if (def.conge === 'HORS_SERVICE') {
            joursHorsService.push({ du: a.du, au: a.au, motif: `${def.libelle} (${def.fondement})` });
            continue;
        }
        if (def.conge !== 'INCAPACITE_PLAFONNEE')
            continue;
        let debutHors = null;
        let finHors = null;
        for (const j of jours) {
            const k = anneeDeService(j.jour);
            const c = cumul.get(k) ?? { premier: j.jour, jours: 0 };
            const plafond = Math.round(((0, remuneration_du_delai_1.plusMois)(jourUtc(c.premier), 6).getTime() - jourUtc(c.premier).getTime()) / 86_400_000);
            c.jours += 1;
            cumul.set(k, c);
            if (c.jours > plafond) {
                debutHors = debutHors ?? j.jour;
                finHors = j.jour;
            }
        }
        if (debutHors && finHors) {
            joursHorsService.push({
                du: debutHors,
                au: finHors,
                motif: `${def.libelle} au-delà de six mois d'incapacité dans l'année de service (Code du travail, art. 141, al. 2)`,
            });
        }
    }
    return { joursHorsService, joursMaladie };
}
exports.NATURES_INDEMNISEES_PAR_LA_CAISSE = new Set(['ACCIDENT_DU_TRAVAIL_OU_MALADIE_PROFESSIONNELLE', 'MATERNITE']);
function motifRefusIndemniteCaisse(p) {
    if (!exports.NATURES_INDEMNISEES_PAR_LA_CAISSE.has(p.nature)) {
        return `${exports.NATURES_ABSENCE[p.nature].libelle} · aucune indemnité journalière de la Caisse ; seuls l'accident du travail, la maladie professionnelle et la maternité en ouvrent une (arrêté n° 146/2018, art. 63 et 87).`;
    }
    if (p.traitement === 'DEDUITE' && p.nature !== 'ACCIDENT_DU_TRAVAIL_OU_MALADIE_PROFESSIONNELLE') {
        return "La déduction des sommes versées par la Caisse ne vise que l'accident du travail ou la maladie professionnelle (Code du travail, art. 106, al. 2).";
    }
    if (p.traitement === 'SUBROGATION_PARTIELLE' && p.nature !== 'MATERNITE') {
        return "La subrogation dans la limite de la partie versée ne vise que l'indemnité de maternité (arrêté n° 146/2018, art. 139, al. 3).";
    }
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(p.mois))
        return 'Le mois se lit AAAA-MM.';
    if (p.mois < p.du.slice(0, 7) || p.mois > p.au.slice(0, 7))
        return `Le mois ${p.mois} est hors de l'arrêt du ${p.du} au ${p.au}.`;
    if (!Number.isFinite(p.montant) || p.montant <= 0)
        return "Le montant de l'indemnité est strictement positif.";
    if (p.piece.trim().length < 3)
        return "La pièce de la Caisse se déclare (décision, bordereau de paiement).";
    if (p.dejaDeclareCeMois)
        return "Une indemnité de la Caisse est déjà déclarée sur cet arrêt pour ce mois · annulez-la d'abord.";
    return null;
}
//# sourceMappingURL=absences.js.map