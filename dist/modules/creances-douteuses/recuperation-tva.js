"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MESSAGE_TVA_PAR_LA_REGLE_3 = exports.RACINE_PROFITS_SUR_CREANCES = exports.MOTIF_ANNULATION_RECUPERATION_MAX = exports.MOTIF_ANNULATION_RECUPERATION_MIN = exports.MOTIF_FACTURE_PAYEE = exports.MOTIF_FACTURE_NON_LUE = exports.MOTIF_FACTURE_SANS_TVA = exports.MOTIF_TAXE_A_L_ENCAISSEMENT = void 0;
exports.mentionDuplicata = mentionDuplicata;
exports.chiffrerFactures = chiffrerFactures;
exports.finDuDroit = finDuDroit;
exports.derniereDateEcriture = derniereDateEcriture;
exports.derniereDateEcritureTrimestrielle = derniereDateEcritureTrimestrielle;
exports.motifRefusRecuperation = motifRefusRecuperation;
exports.motifRefusDuplicatas = motifRefusDuplicatas;
exports.motifRefusDateRecuperation = motifRefusDateRecuperation;
exports.motifRefusAnnulationRecuperation = motifRefusAnnulationRecuperation;
exports.motifRecuperationEnPlace = motifRecuperationEnPlace;
exports.ventilerPerte = ventilerPerte;
exports.motifRefusPerteAvecTva = motifRefusPerteAvecTva;
exports.motifRefusAnnulationPerteAvecTva = motifRefusAnnulationPerteAvecTva;
exports.informationDecalagePerte = informationDecalagePerte;
const imputation_paiements_1 = require("../tva/imputation-paiements");
const creances_douteuses_1 = require("./creances-douteuses");
function mentionDuplicata(ht, tva) {
    const f = (x) => (0, creances_douteuses_1.centimes)(x).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return (`FACTURE DEMEUREE IMPAYEE POUR LA SOMME DE ${f(ht)}, PRIX HORS TVA ET POUR LA SOMME DE ${f(tva)}, ` +
        'TVA CORRESPONDANTE QUI NE PEUT FAIRE L’OBJET D’UNE DEDUCTION');
}
exports.MOTIF_TAXE_A_L_ENCAISSEMENT = 'taxe exigible à l’encaissement (O.-L. n° 10/001, art. 25, 2°) · l’impayé n’a jamais été encaissé, sa taxe jamais acquittée, rien à récupérer';
exports.MOTIF_FACTURE_SANS_TVA = 'la pièce de la facture ne porte aucune ligne de TVA collectée lisible (compte 443 à un taux)';
exports.MOTIF_FACTURE_NON_LUE = 'la pièce de la facture n’est pas lue (non validée) · sa taxe ne se chiffre pas';
exports.MOTIF_FACTURE_PAYEE = 'les recouvrements ont payé la facture en entier · aucun impayé';
function chiffrerFactures(p) {
    if (p.factures.length === 0)
        return [];
    const designe = Math.min(p.reclasse, p.factures.reduce((t, f) => t + f.montant, 0));
    const imputation = p.reclasse > 0.005
        ? (0, imputation_paiements_1.imputerPaiements)(p.factures.map((f) => ({ id: f.designationId, dateFacture: f.dateFacture, dateEcheance: f.dateEcheance, montant: f.montant })), p.recouvrements.map((m, i) => ({ id: `recouvrement-${i}`, date: m.date, montant: (0, creances_douteuses_1.centimes)((m.montant * designe) / p.reclasse) })))
        : null;
    return p.factures.map((f) => {
        const recouvre = (0, creances_douteuses_1.centimes)((imputation?.parDette.get(f.designationId) ?? []).reduce((t, x) => t + x.montant, 0));
        const impayeTtc = Math.max(0, (0, creances_douteuses_1.centimes)(f.montant - recouvre));
        const motifs = [];
        let tvaCorrespondante = 0;
        const recuperable = [];
        const annulable = [];
        if (!f.taxe)
            motifs.push(exports.MOTIF_FACTURE_NON_LUE);
        else if (f.taxe.lignesTva.length === 0 || f.taxe.ttc <= 0.005)
            motifs.push(exports.MOTIF_FACTURE_SANS_TVA);
        else {
            let aLEncaissement = false;
            for (const l of f.taxe.lignesTva) {
                const part = (0, creances_douteuses_1.centimes)((impayeTtc * l.tva) / f.taxe.ttc);
                tvaCorrespondante = (0, creances_douteuses_1.centimes)(tvaCorrespondante + part);
                if (l.base === 'ENCAISSEMENT') {
                    aLEncaissement = true;
                    if (part > 0.005)
                        annulable.push({ compteId: l.compteId, numero: l.numero, tauxTvaId: l.tauxTvaId, tva: part });
                    continue;
                }
                if (part > 0.005)
                    recuperable.push({ compteId: l.compteId, numero: l.numero, tauxTvaId: l.tauxTvaId, tva: part });
            }
            if (aLEncaissement && impayeTtc > 0.005)
                motifs.push(exports.MOTIF_TAXE_A_L_ENCAISSEMENT);
        }
        if (impayeTtc <= 0.005)
            motifs.push(exports.MOTIF_FACTURE_PAYEE);
        const impayeHt = (0, creances_douteuses_1.centimes)(impayeTtc - tvaCorrespondante);
        const tvaRecuperable = (0, creances_douteuses_1.centimes)(recuperable.reduce((t, r) => t + r.tva, 0));
        const tvaAnnulable = (0, creances_douteuses_1.centimes)(annulable.reduce((t, r) => t + r.tva, 0));
        return {
            designationId: f.designationId,
            ligneEcritureId: f.ligneEcritureId,
            libelle: f.libelle,
            numeroPiece: f.numeroPiece,
            dateFacture: f.dateFacture.toISOString().slice(0, 10),
            designe: (0, creances_douteuses_1.centimes)(f.montant),
            recouvre,
            impayeTtc,
            impayeHt,
            tvaCorrespondante,
            recuperable,
            tvaRecuperable,
            annulable,
            tvaAnnulable,
            motifs,
            mention: mentionDuplicata(impayeHt, tvaCorrespondante),
        };
    });
}
function finDuDroit(derniereConstatation) {
    return new Date(Date.UTC(derniereConstatation.getUTCFullYear() + 1, 11, 31));
}
function derniereDateEcriture(derniereConstatation) {
    return new Date(Date.UTC(derniereConstatation.getUTCFullYear() + 1, 10, 30));
}
function derniereDateEcritureTrimestrielle(derniereConstatation) {
    return new Date(Date.UTC(derniereConstatation.getUTCFullYear() + 1, 8, 30));
}
const jour = (d) => d.toISOString().slice(0, 10);
function motifRefusRecuperation(e) {
    if (e.creanceAnnulee)
        return 'Ce reclassement est annulé · aucune récupération ne s’y rattache.';
    if (e.creanceCorrigee)
        return 'Cette créance a été corrigée par le résultat et sortie du module · la récupération ne s’y rattache plus.';
    if (e.pertes.length === 0) {
        return ('Aucune perte n’est constatée sur cette créance · la taxe ne se récupère que sur une créance qui « reste impayée » et dont le ' +
            'non-paiement est constaté (O.-L. n° 10/001, art. 52 ; décret n° 011/42, art. 126). Passez d’abord la perte.');
    }
    if (Math.abs(e.resteFinal) > 0.005) {
        return (`La créance n’est pas éteinte · il reste ${(0, creances_douteuses_1.centimes)(e.resteFinal).toFixed(2)} au 416 après ses mouvements. La récupération ` +
            'n’est ouverte qu’à une créance « réellement et définitivement irrécouvrable » (art. 52, al. 3) · passez la perte du reste, ' +
            'ou le recouvrement, avant de récupérer la taxe.');
    }
    const auBrouillard = e.pertes.find((p) => !p.validee);
    if (auBrouillard) {
        return (`La perte du ${jour(auBrouillard.date)} (pièce n° ${auBrouillard.numeroPiece ?? '·'}) est au brouillard · la constatation du ` +
            'non-paiement est celle du livre-journal (décret n° 011/42, art. 126). Validez-la d’abord.');
    }
    if (e.designationsActives === 0) {
        return ('Aucune facture n’est désignée pour cette créance · la taxe se récupère facture par facture (duplicata de la facture ' +
            'initiale, art. 52, al. 3) et OmegaX ne la devine jamais. Désignez d’abord les factures (« Désigner les factures »).');
    }
    if (e.duplicatas.length === 0) {
        return 'Choisissez au moins une facture dont le duplicata surchargé a été envoyé au client (art. 52, al. 3 ; décret n° 011/42, art. 127, al. 2).';
    }
    const refusDuplicatas = motifRefusDuplicatas(e);
    if (refusDuplicatas)
        return refusDuplicatas;
    const vus = new Set(e.duplicatas.map((d) => d.designationId));
    const total = (0, creances_douteuses_1.centimes)(e.chiffrees.filter((f) => vus.has(f.designationId)).reduce((t, f) => t + f.tvaRecuperable, 0));
    if (total <= 0.005) {
        const motifs = [...new Set(e.chiffrees.filter((f) => vus.has(f.designationId)).flatMap((f) => f.motifs))];
        return `Aucune taxe acquittée sur l’impayé des factures choisies (art. 52, al. 1) · ${motifs.join(' ; ') || 'rien à récupérer'}.`;
    }
    const m = (e.motif ?? '').trim();
    if (!m)
        return 'Le motif est exigé · il dit pourquoi la créance est réellement et définitivement irrécouvrable (art. 52, al. 3).';
    if (e.pieces.length === 0) {
        return ('Au moins une pièce prouvant l’irrécouvrabilité est exigée (nature et référence) · « la preuve de la créance irrécouvrable ' +
            'incombe à l’assujetti » (décret n° 011/42, art. 127, al. 3).');
    }
    if (!e.exerciceOuvert)
        return 'L’exercice choisi est clôturé · la récupération s’écrit dans un exercice ouvert.';
    if (!e.dateDansExercice)
        return 'La date de la récupération sort de l’exercice choisi.';
    if (!e.journalGeneral)
        return 'Le journal doit être un journal d’opérations diverses (type Général), comme celui de la perte.';
    const derniere = e.pertes.reduce((d, p) => (p.date.getTime() > d.getTime() ? p.date : d), e.pertes[0].date);
    return motifRefusDateRecuperation(e.date, derniere, e.finDerniereLiquidation);
}
function motifRefusDuplicatas(e) {
    const vus = new Set();
    for (const d of e.duplicatas) {
        const f = e.chiffrees.find((x) => x.designationId === d.designationId);
        if (!f)
            return 'Une facture choisie n’est pas une désignation active de cette créance · relisez la créance.';
        const qui = `Facture « ${f.libelle} » du ${f.dateFacture}`;
        if (vus.has(d.designationId))
            return `${qui} · choisie deux fois.`;
        vus.add(d.designationId);
        if (e.dejaRecuperees.has(d.designationId)) {
            return `${qui} · sa taxe est déjà récupérée par une récupération non annulée · annulez-la d’abord pour la refaire.`;
        }
        if (!(d.reference ?? '').trim()) {
            return (`${qui} · la référence du duplicata envoyé au client est exigée · « la rectification de la facture consiste en l’envoi ` +
                'd’un duplicata de la facture initiale » (art. 52, al. 3).');
        }
        if (!d.dateEnvoi)
            return `${qui} · la date d’envoi du duplicata est exigée (art. 52, al. 3).`;
        const envoi = new Date(d.dateEnvoi.slice(0, 10));
        if (Number.isNaN(envoi.getTime()))
            return `${qui} · la date d’envoi du duplicata est illisible.`;
        if (envoi.getTime() > e.date.getTime()) {
            return `${qui} · le duplicata est daté du ${jour(envoi)}, après la récupération du ${jour(e.date)} · la récupération suit l’envoi (art. 52, al. 3).`;
        }
        if (envoi.getTime() < new Date(f.dateFacture).getTime())
            return `${qui} · le duplicata ne peut pas précéder la facture.`;
        if (f.impayeTtc <= 0.005)
            return `${qui} · ${exports.MOTIF_FACTURE_PAYEE}.`;
    }
    return null;
}
function motifRefusDateRecuperation(date, derniere, finDerniereLiquidation) {
    const e = { date, finDerniereLiquidation };
    if (e.date.getTime() < derniere.getTime()) {
        return `La récupération ne précède pas la constatation du non-paiement · la dernière perte est du ${jour(derniere)} (décret n° 011/42, art. 126).`;
    }
    const fin = finDuDroit(derniere);
    const limite = derniereDateEcriture(derniere);
    if (e.date.getTime() > limite.getTime()) {
        return (`Le droit à récupération s’exerce jusqu’au ${jour(fin)} · « dans les conditions prévues pour exercer le droit à déduction » ` +
            '(décret n° 011/42, art. 126), soit « jusqu’au 31 décembre de l’année qui suit » (O.-L. n° 10/001, art. 37, al. 2), ' +
            `compté de la constatation du non-paiement, la perte du ${jour(derniere)}. La récupération s’inscrit dans la déclaration ` +
            `du mois qui suit son écriture (art. 126) · datée après le ${jour(limite)}, elle tomberait dans une déclaration ` +
            `de ${fin.getUTCFullYear() + 1}, hors du délai. Datez-la au plus tard le ${jour(limite)} si cette période n’est pas liquidée ` +
            `(au plus tard le ${jour(derniereDateEcritureTrimestrielle(derniere))} si la TVA se liquide par trimestre) ; ` +
            'sinon la taxe est acquise au Trésor.');
    }
    if (e.finDerniereLiquidation && e.date.getTime() <= e.finDerniereLiquidation.getTime()) {
        return (`La TVA est liquidée jusqu’au ${jour(e.finDerniereLiquidation)} · une récupération datée dans ou avant une période liquidée ` +
            'ne serait reprise par aucune déclaration, et la liquidation figée ne change pas. Datez-la après cette date.');
    }
    return null;
}
exports.MOTIF_ANNULATION_RECUPERATION_MIN = 3;
exports.MOTIF_ANNULATION_RECUPERATION_MAX = 500;
function motifRefusAnnulationRecuperation(p) {
    if (p.dejaAnnulee)
        return `Cette récupération est déjà annulée, le ${p.dejaAnnulee}.`;
    if (p.exerciceClos) {
        return "L'exercice de cette récupération est clôturé · son erreur se corrige par le report à nouveau (AUDCIF art. 20, al. 3), hors de ce geste.";
    }
    if (p.liquidationCouvrante) {
        return (`La TVA est liquidée jusqu’au ${p.liquidationCouvrante}, au-delà de la date de la récupération · elle a été inscrite en ` +
            'déduction d’une déclaration figée. Une reprise se déclare à la main, avec la déclaration en cours.');
    }
    if (p.periodeClose) {
        return (`Une clôture de période couvre la date de la récupération · son négatif serait inscrit au ${p.periodeClose}, premier ` +
            'jour non clôturé (AUDCIF art. 22, 4°), et la reprise de la taxe glisserait d’une période de déclaration (décret ' +
            'n° 011/42, art. 126). Une clôture PARTIELLE du journal s’annule (fenêtre Exercices), puis l’annulation passe ; une ' +
            'clôture de période ou totale est définitive · la reprise se déclare alors à la main avec la déclaration en cours, et ' +
            'la récupération reste en place.');
    }
    const m = (p.motif ?? '').trim();
    if (m.length < exports.MOTIF_ANNULATION_RECUPERATION_MIN || m.length > exports.MOTIF_ANNULATION_RECUPERATION_MAX) {
        return `Le motif de l'annulation est exigé, de ${exports.MOTIF_ANNULATION_RECUPERATION_MIN} à ${exports.MOTIF_ANNULATION_RECUPERATION_MAX} caractères (AUDCIF art. 20, al. 2).`;
    }
    return null;
}
function motifRecuperationEnPlace(geste, nombre) {
    if (nombre === 0)
        return null;
    return (`Une récupération de TVA (art. 52) non annulée porte sur cette créance · ${geste} changerait l’impayé que ses duplicatas ` +
        'déclarent. Annulez d’abord la récupération.');
}
exports.RACINE_PROFITS_SUR_CREANCES = '751';
exports.MESSAGE_TVA_PAR_LA_REGLE_3 = 'Perte au TTC entier · la taxe acquittée sur l’impayé se récupérera par « Récupérer la TVA » (D 443 / C 751), une fois le ' +
    'duplicata surchargé envoyé (O.-L. n° 10/001, art. 52, al. 3 ; décret n° 011/42, art. 127, al. 2).';
function ventilerPerte(choisies) {
    const rec = new Map();
    const ann = new Map();
    for (const f of choisies) {
        for (const r of f.recuperable) {
            const cle = `${r.compteId}|${r.tauxTvaId}`;
            const v = rec.get(cle) ?? { ...r, tva: 0 };
            v.tva = (0, creances_douteuses_1.centimes)(v.tva + r.tva);
            rec.set(cle, v);
        }
        for (const a of f.annulable) {
            const v = ann.get(a.compteId) ?? { compteId: a.compteId, numero: a.numero, tva: 0 };
            v.tva = (0, creances_douteuses_1.centimes)(v.tva + a.tva);
            ann.set(a.compteId, v);
        }
    }
    const recuperee = [...rec.values()];
    const annulee = [...ann.values()];
    return {
        recuperee,
        annulee,
        tva: (0, creances_douteuses_1.centimes)(recuperee.reduce((t, r) => t + r.tva, 0)),
        tvaAnnulee: (0, creances_douteuses_1.centimes)(annulee.reduce((t, r) => t + r.tva, 0)),
    };
}
function motifRefusPerteAvecTva(e) {
    if (e.pertesAnterieures > 0) {
        return ('Une perte est déjà passée au TTC sur cette créance · la taxe se récupère alors par « Récupérer la TVA » (D 443 / C 751), une ' +
            'fois la créance éteinte. Passez cette perte sans duplicata.');
    }
    if (Math.abs((0, creances_douteuses_1.centimes)(e.resteFinal) - (0, creances_douteuses_1.centimes)(e.montant)) >= 0.005) {
        return (`La taxe ne se récupère qu’avec la perte qui ÉTEINT la créance · « réellement et définitivement irrécouvrable » (O.-L. ` +
            `n° 10/001, art. 52, al. 3). Il reste ${(0, creances_douteuses_1.centimes)(e.resteFinal).toFixed(2)} au 416 · passez la perte de ce reste, ou passez ` +
            'celle-ci sans duplicata (au TTC entier), la taxe se récupérant ensuite par « Récupérer la TVA ».');
    }
    const refus = motifRefusDuplicatas(e);
    if (refus)
        return refus;
    const vus = new Set(e.duplicatas.map((d) => d.designationId));
    const choisies = e.chiffrees.filter((f) => vus.has(f.designationId));
    const v = ventilerPerte(choisies);
    if (v.tva + v.tvaAnnulee <= 0.005) {
        const motifs = [...new Set(choisies.flatMap((f) => f.motifs))];
        return `Aucune taxe sur l’impayé des factures choisies · ${motifs.join(' ; ') || 'rien à récupérer ni à annuler'}. Passez la perte sans duplicata.`;
    }
    if ((0, creances_douteuses_1.centimes)(v.tva + v.tvaAnnulee) - (0, creances_douteuses_1.centimes)(e.montant) > 0.005) {
        return (`La taxe des factures choisies (${(0, creances_douteuses_1.centimes)(v.tva + v.tvaAnnulee).toFixed(2)}) dépasse la perte (${(0, creances_douteuses_1.centimes)(e.montant).toFixed(2)}) · ` +
            'vérifiez les désignations, ou passez la perte sans duplicata.');
    }
    if (v.tva > 0.005)
        return motifRefusDateRecuperation(e.date, e.date, e.finDerniereLiquidation);
    return null;
}
function motifRefusAnnulationPerteAvecTva(liquidationCouvrante) {
    if (!liquidationCouvrante)
        return null;
    return (`La TVA est liquidée jusqu’au ${liquidationCouvrante}, au-delà de la date de cette perte · la taxe qu’elle récupère est ` +
        'inscrite en déduction d’une déclaration figée (décret n° 011/42, art. 126), et la perte ne s’annule plus par ce geste. ' +
        'Si le client paie, la reprise de la taxe se déclare à la main avec la déclaration en cours, et l’encaissement se passe au journal.');
}
function informationDecalagePerte(premierJourOuvert) {
    return (`Une clôture de période couvre la date de la perte · ses négatifs sont inscrits au ${premierJourOuvert}, premier jour non ` +
        'clôturé (AUDCIF art. 22, 4°), et la reprise de la taxe récupérée se lit dans la déclaration de cette période.');
}
//# sourceMappingURL=recuperation-tva.js.map