"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MENTION_DELAI_NON_FRANC = exports.ENTREE_EN_VIGUEUR_ARRETE_PORTEFEUILLE_2025 = exports.ENTREE_EN_VIGUEUR_OL_13_003 = void 0;
exports.closAu31Decembre = closAu31Decembre;
exports.jourFr = jourFr;
exports.observationDuFait = observationDuFait;
exports.appliquerPortefeuilleEtat = appliquerPortefeuilleEtat;
exports.jalonsDividendePrioritaire = jalonsDividendePrioritaire;
exports.delaisAvantAssemblee = delaisAvantAssemblee;
exports.inviterADeclarerPortefeuille = inviterADeclarerPortefeuille;
const client_1 = require("@prisma/client");
const echeance_1 = require("../../common/echeance");
exports.ENTREE_EN_VIGUEUR_OL_13_003 = new Date(Date.UTC(2013, 1, 27));
const SOURCE_112 = 'Ordonnance-loi n° 13/003 du 23 février 2013, art. 112 ; loi n° 08/010 du 7 juillet 2008, art. 3';
const SOURCE_113 = 'Ordonnance-loi n° 13/003 du 23 février 2013, art. 113';
exports.ENTREE_EN_VIGUEUR_ARRETE_PORTEFEUILLE_2025 = new Date(Date.UTC(2025, 11, 10));
const ARRETE_2025 = 'Arrêté interministériel n° 005/CAB/MIN/PF/2025 et n° 159bis/CAB/MIN/FINANCES/2025 du 10 décembre 2025';
const SOURCE_DIVIDENDE = `${ARRETE_2025}, art. 1er (point 2), 2 et 3`;
const SOURCE_ART_5 = `${ARRETE_2025}, art. 1er (point 11) et 5`;
const JOUR_MS = 86_400_000;
const plusJours = (d, n) => new Date(d.getTime() + n * JOUR_MS);
function plusUnMois(d) {
    const dernier = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 2, 0)).getUTCDate();
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, Math.min(d.getUTCDate(), dernier)));
}
function closAu31Decembre(dateFin) {
    return dateFin.getUTCMonth() === 11 && dateFin.getUTCDate() === 31;
}
function jourFr(d) {
    const iso = d.toISOString().slice(0, 10);
    return `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
}
function observationDuFait(fait, date, echeance, aujourdHui) {
    if (!date)
        return undefined;
    if (date.getTime() > aujourdHui.getTime())
        return { libelle: `${fait.prevu} le ${jourFr(date)}`, satisfait: false };
    if (echeance && date.getTime() > echeance.getTime()) {
        return {
            libelle: `${fait.passe} le ${jourFr(date)}, après l’échéance du ${jourFr(echeance)}`,
            satisfait: true,
            horsDelai: true,
        };
    }
    return { libelle: `${fait.passe} le ${jourFr(date)}`, satisfait: true };
}
function appliquerPortefeuilleEtat(jalons, faits, aujourdHui) {
    if (faits.dateFin.getTime() < exports.ENTREE_EN_VIGUEUR_OL_13_003.getTime())
        return jalons;
    const enRetard = (echeance, observation) => echeance !== null && (0, echeance_1.echeanceDepassee)(echeance, aujourdHui) && !(observation?.satisfait ?? false);
    const debutBorne = (debut, echeance) => debut && debut.getTime() <= echeance.getTime() ? debut : echeance;
    const clos31 = closAu31Decembre(faits.dateFin);
    const trenteEtUnMars = new Date(Date.UTC(faits.dateFin.getUTCFullYear() + 1, 2, 31));
    const assembleeDeReference = faits.dateAssembleeGenerale ?? trenteEtUnMars;
    const reference = faits.dateAssembleeGenerale
        ? faits.dateAssembleeGenerale.getTime() > aujourdHui.getTime()
            ? 'l’assemblée prévue'
            : 'l’assemblée déclarée'
        : 'la date limite du 31 mars (art. 112)';
    const delais = delaisAvantAssemblee(faits.forme, faits.commissaireDesigne);
    const observationAssemblee = observationDuFait({ passe: 'Assemblée tenue', prevu: 'Assemblée prévue' }, faits.dateAssembleeGenerale, trenteEtUnMars, aujourdHui);
    const aRebours = (j, regle, borne) => {
        if (regle === null) {
            return {
                ...j,
                detail: `${j.detail} ENTREPRISE DU PORTEFEUILLE DE L’ÉTAT · l’assemblée se tient au plus tard le 31 mars ; le ` +
                    'délai de quarante-cinq jours ne vaut que si un commissaire aux comptes est désigné (« le cas échéant », ' +
                    'AUSCGIE art. 140 ; « s’ils existent », AUDCIF art. 71), et aucun mandat n’est enregistré pour cet ' +
                    'exercice · enregistrez-le dans la fenêtre du mandat du contrôleur des comptes pour que l’échéance se calcule.',
                source: `${j.source} ; ${SOURCE_112}`,
                debut: null,
                echeance: null,
                enAttente: 'Sans commissaire enregistré',
                enRetard: false,
            };
        }
        const echeance = plusJours(assembleeDeReference, -regle.joursAvant);
        if (borne && j.echeance && j.echeance.getTime() <= echeance.getTime())
            return j;
        return {
            ...j,
            detail: `${j.detail} ENTREPRISE DU PORTEFEUILLE DE L’ÉTAT · ${borne ? 'borné à' : 'compté à'} ` +
                `${regle.jours === 45 ? 'quarante-cinq' : 'quinze'} jours${regle.franc ? ' francs' : ''} avant ${reference} · ` +
                `${regle.motif}${regle.franc ? ` ${exports.MENTION_DELAI_NON_FRANC}` : ''}`,
            source: `${j.source} ; ${SOURCE_112} ; ${regle.source}`,
            debut: debutBorne(j.debut, echeance),
            echeance,
            enRetard: enRetard(echeance, j.observation),
        };
    };
    const resultat = jalons.map((j) => {
        if (!clos31)
            return j;
        if (j.etape === 21 || j.etape === 23) {
            const echeance = trenteEtUnMars;
            const observation = observationAssemblee ?? j.observation;
            return {
                ...j,
                detail: `${j.detail} ENTREPRISE DU PORTEFEUILLE DE L’ÉTAT · l’assemblée générale ordinaire statuant sur les ` +
                    'résultats de l’exercice clos au 31 décembre se tient « au plus tard le 31 mars de l’année qui suit celle ' +
                    'de réalisation des revenus » (ordonnance-loi n° 13/003, art. 112) · cette échéance remplace les six mois. ' +
                    'Déclarez la date de l’assemblée dans la fenêtre Exercices.',
                source: `${j.source} ; ${SOURCE_112}`,
                debut: debutBorne(j.debut, echeance),
                echeance,
                observation,
                enRetard: enRetard(echeance, observation),
            };
        }
        if (j.etape === 17)
            return aRebours(j, delais.commissaire140, false);
        if (j.etape === 18)
            return aRebours(j, delais.commissaire71, false);
        if (j.etape === 13 || j.etape === 16)
            return aRebours(j, delais.documents, true);
        if (j.etape === 24) {
            const echeance = plusUnMois(assembleeDeReference);
            return {
                ...j,
                detail: `${j.detail} ENTREPRISE DU PORTEFEUILLE DE L’ÉTAT · le mois se compte depuis ${reference}.`,
                source: `${j.source} ; ${SOURCE_112}`,
                debut: debutBorne(j.debut, echeance),
                echeance,
                enRetard: enRetard(echeance, j.observation),
            };
        }
        return j;
    });
    const ajoutes = [];
    if (!clos31) {
        ajoutes.push({
            etape: 23,
            libelle: 'Assemblée générale · entreprise du portefeuille de l’État',
            detail: 'L’article 112 fixe le 31 mars pour « l’exercice clos au 31 décembre » · cet exercice se clôt à une autre ' +
                'date, et le texte ne dit pas comment le délai s’y applique. Aucune échéance n’est calculée ; le délai de ' +
                'six mois de l’Acte uniforme reste servi.',
            nature: 'LEGALE',
            source: SOURCE_112,
            sanction: null,
            debut: null,
            echeance: null,
            sansDelai: true,
            enRetard: false,
        });
    }
    const basePv = faits.dateAssembleeGenerale ?? (clos31 ? trenteEtUnMars : null);
    const pv = basePv ? plusJours(basePv, 10) : null;
    const observationPv = observationDuFait({ passe: 'Procès-verbal communiqué', prevu: 'Communication du procès-verbal prévue' }, faits.dateTransmissionPvPortefeuille, pv, aujourdHui);
    const assembleeSousArrete = basePv !== null && basePv.getTime() >= exports.ENTREE_EN_VIGUEUR_ARRETE_PORTEFEUILLE_2025.getTime();
    ajoutes.push({
        etape: 23,
        libelle: 'Procès-verbal à l’Administration des recettes non fiscales',
        detail: 'Le procès-verbal de l’assemblée générale ordinaire est communiqué à l’Administration des recettes non ' +
            'fiscales « dans les dix (10) jours qui suivent la tenue de ces assemblées », jours calendaires. Il s’ajoute, ' +
            'le cas échéant, à celui que reçoit la Direction générale des impôts (états certifiés par un commissaire aux ' +
            'comptes), il ne le remplace pas. ' +
            (assembleeSousArrete
                ? 'Les procès-verbaux de l’assemblée et du conseil d’administration sont aussi transmis au Secrétariat ' +
                    'Général du Portefeuille dans les mêmes dix jours ; la transmission tardive donne lieu à une astreinte de ' +
                    '100 USD par jour de retard, qu’OmegaX ne calcule pas. '
                : '') +
            (faits.dateAssembleeGenerale
                ? 'Délai compté depuis la date de l’assemblée déclarée.'
                : pv
                    ? 'Au plus tard, faute de date d’assemblée déclarée · dix jours après le 31 mars.'
                    : 'Échéance non calculée · déclarez la date de l’assemblée sur l’exercice.') +
            ' Déclarez la date de communication dans la fenêtre Exercices.',
        nature: 'LEGALE',
        source: assembleeSousArrete ? `${SOURCE_112} ; ${SOURCE_ART_5}` : SOURCE_112,
        sanction: null,
        debut: basePv,
        echeance: pv,
        observation: observationPv,
        enRetard: enRetard(pv, observationPv),
    });
    ajoutes.push(...jalonsDividendePrioritaire(faits, aujourdHui));
    const affectation = faits.dateDepotEtatsPortefeuille ? plusJours(faits.dateDepotEtatsPortefeuille, 60) : null;
    const observationAffectation = observationDuFait({ passe: 'Affectation décidée', prevu: 'Affectation prévue' }, faits.dateDecisionAffectation, affectation, aujourdHui);
    const limiteAssemblee = clos31 ? trenteEtUnMars : plusMoisDateADate(faits.dateFin, 6);
    const depotPossible = faits.exerciceClos || aujourdHui.getTime() > limiteAssemblee.getTime();
    const enAttenteDuDepot = !faits.dateDepotEtatsPortefeuille && !depotPossible && !observationAffectation?.satisfait;
    ajoutes.push({
        etape: 26,
        libelle: 'Affectation des résultats · entreprise du portefeuille de l’État',
        detail: 'L’affectation des résultats intervient « endéans soixante (60) jours, à compter de la date de dépôt des ' +
            'états financiers à l’administration compétente du ministère ayant le portefeuille de l’Etat dans ses ' +
            'attributions », jours calendaires. ' +
            (faits.dateDepotEtatsPortefeuille
                ? 'Délai compté depuis la date de dépôt déclarée.'
                : enAttenteDuDepot
                    ? 'Le dépôt suit l’arrêté et l’approbation des états · l’échéance se calculera sur sa date déclarée.'
                    : 'Échéance non calculée · déclarez la date de dépôt sur l’exercice.') +
            ' Le jalon se lève par la décision d’affectation enregistrée.' +
            (faits.secteurMinier === null
                ? ' SECTEUR MINIER NON DÉCLARÉ · une entreprise du portefeuille du secteur minier déclare au plus tard le ' +
                    '15 mai un dividende prioritaire sur son bénéfice net comptable (arrêté interministériel du 10 décembre ' +
                    '2025, art. 2 et 3) · déclarez-le dans Paramètres du dossier.'
                : ''),
        nature: 'LEGALE',
        source: SOURCE_113,
        sanction: null,
        debut: faits.dateDepotEtatsPortefeuille,
        echeance: affectation,
        ...(enAttenteDuDepot ? { enAttente: 'En attente du dépôt' } : {}),
        observation: observationAffectation,
        enRetard: enRetard(affectation, observationAffectation),
    });
    const tous = [...resultat.map((j, i) => ({ j, i })), ...ajoutes.map((j, k) => ({ j, i: resultat.length + k }))];
    tous.sort((a, b) => a.j.etape - b.j.etape || a.i - b.i);
    return tous.map((x) => x.j);
}
const auCentime = (x) => Math.round(x * 100) / 100;
function jalonsDividendePrioritaire(faits, aujourdHui) {
    if (faits.secteurMinier !== true)
        return [];
    const quinzeMai = new Date(Date.UTC(faits.dateFin.getUTCFullYear() + 1, 4, 15));
    if (quinzeMai.getTime() < exports.ENTREE_EN_VIGUEUR_ARRETE_PORTEFEUILLE_2025.getTime())
        return [];
    const enRetard = (echeance, observation) => echeance !== null && (0, echeance_1.echeanceDepassee)(echeance, aujourdHui) && !(observation?.satisfait ?? false);
    const base = {
        etape: 26,
        nature: 'LEGALE',
        source: SOURCE_DIVIDENDE,
        sanction: null,
    };
    const dissolution = faits.dateDissolution ?? null;
    if (dissolution && faits.dateFin.getTime() > dissolution.getTime()) {
        return [
            {
                ...base,
                source: `${ARRETE_2025}, art. 1er (points 2 et 4) ; loi n° 08/010 du 7 juillet 2008, art. 7`,
                libelle: 'Dividende prioritaire de l’État · société dissoute',
                detail: `Dissolution déclarée le ${jourFr(dissolution)} · l’exercice finit après elle, et aucun dividende ` +
                    'prioritaire ne se calcule. Ce que l’État reçoit d’une entreprise du portefeuille en liquidation est un ' +
                    'boni ou produit de liquidation, « valeur de liquidation déduite de toutes les charges et dettes ' +
                    'inhérentes », logé aux recettes des participations.',
                debut: null,
                echeance: null,
                sansDelai: true,
                enRetard: false,
            },
        ];
    }
    const resultat = faits.resultatNet ?? null;
    const quote = faits.quotePartEtat ?? null;
    const benefice = resultat !== null && resultat > 0;
    const provisoire = !faits.exerciceClos && !faits.dateArreteComptes;
    const autreCloture = closAu31Decembre(faits.dateFin)
        ? ''
        : ' L’arrêté fixe le 15 mai « de chaque année » sans viser la date de clôture · le 15 mai retenu est celui de ' +
            'l’année qui suit la clôture.';
    const cp = faits.capitauxPropres ?? null;
    const avertissements = [
        cp !== null && cp.reportANouveau < 0
            ? `AVERTISSEMENT · report à nouveau débiteur (${montantFr(-cp.reportANouveau)}) · le bénéfice distribuable est ` +
                'diminué des pertes antérieures (AUSCGIE art. 143, al. 1er).'
            : '',
        cp !== null && cp.capital > 0 && cp.capitauxPropres < cp.capital
            ? `AVERTISSEMENT · capitaux propres (${montantFr(cp.capitauxPropres)}) inférieurs au capital ` +
                `(${montantFr(cp.capital)}) · « aucune distribution ne peut être faite aux associés lorsque les capitaux ` +
                'propres sont ou deviendraient, à la suite de cette distribution, inférieurs au montant du capital augmenté ' +
                'des réserves que la loi ou les statuts ne permettent pas de distribuer » (AUSCGIE art. 143, dernier alinéa).'
            : '',
    ]
        .filter((a) => a !== '')
        .map((a) => ` ${a}`)
        .join('');
    const regleDistribution = ' La distribution reste soumise à l’AUSCGIE, qui prime sur l’arrêté · le bénéfice distribuable est diminué des ' +
        'pertes antérieures et de la dotation à la réserve légale (art. 143, al. 1er ; art. 546, 2°, et 346), les ' +
        'capitaux propres ne deviennent jamais inférieurs au capital augmenté des réserves indisponibles (art. 143), et ' +
        'un dividende distribué hors des sommes distribuables constatées est un dividende fictif (art. 144). Le montant ' +
        'ci-dessus ne retranche ni les pertes antérieures ni la réserve légale.';
    const observationDeclaration = observationDuFait({ passe: 'Dividende déclaré', prevu: 'Déclaration du dividende prévue' }, faits.dateDeclarationDividendeEtat ?? null, quinzeMai, aujourdHui);
    if (!benefice) {
        const lu = resultat === null
            ? 'Le résultat net comptable de l’exercice n’a pas pu être lu.'
            : `Résultat net comptable ${provisoire ? 'provisoire, lu à ce jour sur le livre-journal' : 'de l’exercice'} · ` +
                `${resultat === 0 ? 'nul' : 'perte'}.`;
        const constat = resultat !== null && !provisoire
            ? { libelle: 'Aucun bénéfice net comptable · aucun dividende prioritaire', satisfait: true }
            : undefined;
        const observation = observationDeclaration ?? constat;
        const attend = resultat !== null && provisoire;
        return [
            {
                ...base,
                libelle: 'Déclaration du dividende prioritaire de l’État',
                detail: 'Lorsqu’un bénéfice net comptable est réalisé par une entreprise minière du portefeuille de l’État, le ' +
                    'dividende dû à l’État est prioritaire et intangible, déclaré au plus tard le 15 mai, indépendamment de ' +
                    `l’assemblée générale. ${lu}${attend ? ' Le montant attend le résultat de l’exercice.' : ''}` +
                    (attend && aujourdHui.getTime() > quinzeMai.getTime() && !observation
                        ? ' À vérifier · le 15 mai est passé et les comptes ne sont ni arrêtés ni clôturés · si le résultat ' +
                            'définitif est un bénéfice, la déclaration était due ; arrêtez les comptes ou déclarez.'
                        : '') +
                    autreCloture,
                debut: faits.dateFin,
                echeance: quinzeMai,
                ...(attend && !observation ? { enAttente: 'En attente du résultat de l’exercice' } : {}),
                montant: resultat !== null && !provisoire ? 0 : null,
                ...(attend ? { montantEnAttente: true } : {}),
                observation,
                enRetard: provisoire || resultat === null ? enRetard(quinzeMai, observation) : false,
            },
        ];
    }
    const montant = quote === null ? null : auCentime((resultat * quote) / 100);
    const lectureMontant = quote === null
        ? 'Montant non calculé · déclarez la quote-part de l’État dans le capital, avec sa source, dans Paramètres du dossier.'
        : `Montant${provisoire ? ' provisoire' : ''} · bénéfice net comptable multiplié par la quote-part de l’État ` +
            `(${quote} %, ${faits.sourceQuotePartEtat ?? 'source non dite'}) · lecture de l’arrêté (« montant correspondant ` +
            'à la quote-part de l’État ») et de la loi de finances qui a inséré l’article 112 quater (« taux égal à la ' +
            'quote-part de l’État dans le capital »).';
    const declaration = {
        ...base,
        libelle: 'Déclaration du dividende prioritaire de l’État',
        detail: 'Le bénéfice net comptable réalisé par une entreprise minière du portefeuille de l’État fait naître un ' +
            'dividende prioritaire et intangible, versé au Trésor public avant toute autre affectation, déclaré au plus ' +
            `tard le 15 mai, indépendamment de l’assemblée générale. ${lectureMontant}` +
            (provisoire ? ' Exercice non clôturé · le résultat est lu à ce jour sur le livre-journal, et peut encore changer.' : '') +
            regleDistribution +
            avertissements +
            autreCloture +
            ' Déclarez la date de déclaration dans la fenêtre Exercices.',
        debut: faits.dateFin,
        echeance: quinzeMai,
        montant,
        ...(provisoire && montant !== null ? { montantProvisoire: true } : {}),
        observation: observationDeclaration,
        enRetard: enRetard(quinzeMai, observationDeclaration),
    };
    const note = faits.dateNotePerceptionDividende ?? null;
    const echeancePaiement = note ? plusJours(note, 8) : null;
    const observationPaiement = observationDuFait({ passe: 'Dividende payé', prevu: 'Paiement du dividende prévu' }, faits.datePaiementDividendeEtat ?? null, echeancePaiement, aujourdHui);
    const enAttenteDeLaNote = !note && !faits.dateDeclarationDividendeEtat && !observationPaiement?.satisfait;
    const paiement = {
        ...base,
        libelle: 'Paiement du dividende prioritaire de l’État',
        detail: 'Le dividende prioritaire se paie « dans les huit jours de la réception de la note de perception », jours ' +
            'calendaires. ' +
            (note
                ? `Délai compté depuis la réception de la note de perception, le ${jourFr(note)}.`
                : enAttenteDeLaNote
                    ? 'La note de perception suit la déclaration · l’échéance se calculera sur sa date de réception déclarée.'
                    : 'Échéance non calculée · déclarez la date de réception de la note de perception sur l’exercice.') +
            ' Le jalon se lève par la date de paiement déclarée.',
        debut: note,
        echeance: echeancePaiement,
        montant,
        ...(provisoire && montant !== null ? { montantProvisoire: true } : {}),
        ...(enAttenteDeLaNote ? { enAttente: 'En attente de la note de perception' } : {}),
        observation: observationPaiement,
        enRetard: enRetard(echeancePaiement, observationPaiement),
    };
    return [declaration, paiement];
}
const FORMAT_MONTANT = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
function montantFr(n) {
    return FORMAT_MONTANT.format(auCentime(n));
}
exports.MENTION_DELAI_NON_FRANC = 'Délai servi en jours francs, ni le jour de l’envoi ni celui de l’assemblée n’étant comptés · un jour plus tard si le délai n’est pas franc.';
const QUARANTE_CINQ_ART_140 = {
    jours: 45,
    joursAvant: 46,
    franc: true,
    source: 'AUSCGIE, art. 140',
    motif: 'les états financiers et le rapport de gestion sont adressés aux commissaires aux comptes « quarante-cinq (45) ' +
        'jours au moins avant » l’assemblée (AUSCGIE art. 140).',
};
const QUARANTE_CINQ_ART_71 = {
    jours: 45,
    joursAvant: 46,
    franc: true,
    source: 'AUDCIF, art. 71',
    motif: 'les documents sont transmis aux commissaires aux comptes, « s’ils existent, quarante-cinq jours au moins avant » ' +
        'l’assemblée (AUDCIF art. 71).',
};
const QUINZE_ART_288_306 = {
    jours: 15,
    joursAvant: 16,
    franc: true,
    source: 'AUSCGIE, art. 288 et 306',
    motif: 'les documents sont communiqués aux associés « au moins quinze (15) jours avant la tenue de l’assemblée » ' +
        '(AUSCGIE art. 288 pour la SNC, 306 pour la SCS).',
};
const QUINZE_ART_345 = {
    jours: 15,
    joursAvant: 15,
    franc: false,
    source: 'AUSCGIE, art. 345',
    motif: 'le droit de communication des associés « s’exerce durant les quinze (15) jours précédant la tenue » de ' +
        'l’assemblée (AUSCGIE art. 345) · les documents doivent alors exister.',
};
function delaisAvantAssemblee(forme, commissaireDesigne) {
    const commissaire = commissaireDesigne === true;
    switch (forme) {
        case client_1.FormeJuridiqueSyscohada.SOCIETE_ANONYME:
        case client_1.FormeJuridiqueSyscohada.SOCIETE_PAR_ACTIONS_SIMPLIFIEE:
            return { commissaire140: QUARANTE_CINQ_ART_140, commissaire71: QUARANTE_CINQ_ART_71, documents: QUARANTE_CINQ_ART_140 };
        case client_1.FormeJuridiqueSyscohada.SOCIETE_RESPONSABILITE_LIMITEE:
            return commissaire
                ? { commissaire140: QUARANTE_CINQ_ART_140, commissaire71: QUARANTE_CINQ_ART_71, documents: QUARANTE_CINQ_ART_140 }
                : { commissaire140: null, commissaire71: null, documents: QUINZE_ART_345 };
        default:
            return commissaire
                ? { commissaire140: null, commissaire71: QUARANTE_CINQ_ART_71, documents: QUARANTE_CINQ_ART_71 }
                : { commissaire140: null, commissaire71: null, documents: QUINZE_ART_288_306 };
    }
}
function plusMoisDateADate(d, n) {
    const cible = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1));
    const dernier = new Date(Date.UTC(cible.getUTCFullYear(), cible.getUTCMonth() + 1, 0)).getUTCDate();
    return new Date(Date.UTC(cible.getUTCFullYear(), cible.getUTCMonth(), Math.min(d.getUTCDate(), dernier)));
}
function inviterADeclarerPortefeuille(jalons) {
    return jalons.map((j) => j.etape === 21 || j.etape === 23
        ? {
            ...j,
            detail: `${j.detail} PORTEFEUILLE DE L’ÉTAT NON DÉCLARÉ · si l’État ou une personne morale de droit public ` +
                'détient des actions de la société, l’assemblée se tient au plus tard le 31 mars (ordonnance-loi ' +
                'n° 13/003, art. 112) · déclarez-le dans Paramètres du dossier.',
        }
        : j);
}
//# sourceMappingURL=portefeuille-etat.js.map