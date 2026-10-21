"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MOTIF_SANS_LIGNE_DE_TVA = exports.MOTIF_SANS_FACTURE_DESIGNEE = exports.MOTIF_LETTRAGE_PARTAGE = exports.MOTIF_ANNULATION_MAX = exports.MOTIF_ANNULATION_MIN = exports.INFORMATION_BORNE_RECONSTITUEE = exports.MOTIF_CREANCE_EN_DEVISE = exports.centimes = exports.CONTROLE_CREANCE_ADHERENT_SOUS_ENCAISSEMENT = exports.ISSUES_IMPAYE_ADHERENT = exports.ISSUES_IMPAYE_RECLASSE = exports.COMPTES_CREANCES_DOUTEUSES = exports.RACINES_CREANCE_SOURCE = void 0;
exports.nonCorrigeeAu = nonCorrigeeAu;
exports.compte491 = compte491;
exports.debiteurSycebnl = debiteurSycebnl;
exports.compte416Propose = compte416Propose;
exports.comptePertePropose = comptePertePropose;
exports.motifRefus651Croise = motifRefus651Croise;
exports.estImpayeAdherent = estImpayeAdherent;
exports.methodeLueDansLeJournal = methodeLueDansLeJournal;
exports.avertissementMethodeInconnue = avertissementMethodeInconnue;
exports.methodeAuReclassement = methodeAuReclassement;
exports.motifRefusDotationImpayeAdherent = motifRefusDotationImpayeAdherent;
exports.motifImpayeAdherentSousEncaissement = motifImpayeAdherentSousEncaissement;
exports.motifRefusCotisationsEncaissement = motifRefusCotisationsEncaissement;
exports.motifRefusPerteImpayeAdherent = motifRefusPerteImpayeAdherent;
exports.avertissementMethodeCotisations = avertissementMethodeCotisations;
exports.piecesLisibles = piecesLisibles;
exports.motifRefus416Croise = motifRefus416Croise;
exports.motifRefusReclassement = motifRefusReclassement;
exports.depreciationEnPlace = depreciationEnPlace;
exports.resteDeLaCreance = resteDeLaCreance;
exports.resteFinalDeLaCreance = resteFinalDeLaCreance;
exports.motifResteNegatif = motifResteNegatif;
exports.ecartDeDepreciation = ecartDeDepreciation;
exports.motifRefusRevue = motifRefusRevue;
exports.motifRefusMouvement = motifRefusMouvement;
exports.enPlaceAvant = enPlaceAvant;
exports.revueAFaire = revueAFaire;
exports.motifClotureDepreciationsOrphelines = motifClotureDepreciationsOrphelines;
exports.motifNonRetirable = motifNonRetirable;
exports.motifLettrageFigeAuBrouillard = motifLettrageFigeAuBrouillard;
exports.motifLignesANouveauADesigner = motifLignesANouveauADesigner;
exports.informationLettrageMaintenu = informationLettrageMaintenu;
exports.motifRefusAnnulationRevue = motifRefusAnnulationRevue;
exports.motifRefusAnnulationReclassement = motifRefusAnnulationReclassement;
exports.motifRefus491 = motifRefus491;
exports.motifRefusDeclaration = motifRefusDeclaration;
exports.motifRefusAnnulationMouvement = motifRefusAnnulationMouvement;
exports.mouvementsSansRevue = mouvementsSansRevue;
exports.partageSonLettrage = partageSonLettrage;
exports.motifRefusDesignation = motifRefusDesignation;
exports.motifRefusCorrectionParResultat = motifRefusCorrectionParResultat;
const client_1 = require("@prisma/client");
function nonCorrigeeAu(au) {
    return { NOT: { ecritureCorrectionResultat: { is: { date: { lte: au } } } } };
}
exports.RACINES_CREANCE_SOURCE = {
    [client_1.Referentiel.SYSCOHADA]: ['411', '413'],
    [client_1.Referentiel.SYCEBNL]: ['411', '412', '413'],
};
exports.COMPTES_CREANCES_DOUTEUSES = {
    dotation: '6594',
    reprise: '7594',
    creances416: '416',
    pertes651: '651',
};
function compte491(nature) {
    return nature === client_1.NatureCreanceDouteuse.LITIGIEUSE ? '4911' : '4912';
}
function debiteurSycebnl(numeroSource) {
    if (numeroSource.startsWith('411') || numeroSource.startsWith('4131') || numeroSource.startsWith('4133'))
        return 'ADHERENT';
    if (numeroSource.startsWith('412') || numeroSource.startsWith('4132') || numeroSource.startsWith('4138'))
        return 'CLIENT_USAGER';
    return null;
}
function compte416Propose(referentiel, nature, numeroSource) {
    if (referentiel === client_1.Referentiel.SYSCOHADA)
        return nature === client_1.NatureCreanceDouteuse.LITIGIEUSE ? '4161' : '4162';
    const debiteur = debiteurSycebnl(numeroSource);
    return debiteur === 'ADHERENT' ? '4161' : debiteur === 'CLIENT_USAGER' ? '4162' : null;
}
function comptePertePropose(referentiel, numeroSource) {
    if (referentiel === client_1.Referentiel.SYSCOHADA)
        return '6511';
    const debiteur = debiteurSycebnl(numeroSource);
    return debiteur === 'ADHERENT' ? '6512' : debiteur === 'CLIENT_USAGER' ? '6511' : null;
}
function motifRefus651Croise(referentiel, numeroSource, numeroPerte) {
    if (referentiel !== client_1.Referentiel.SYCEBNL)
        return null;
    const attendu = comptePertePropose(referentiel, numeroSource);
    if (!attendu || numeroPerte.startsWith(attendu))
        return null;
    return (`Au SYCEBNL, le compte ${numeroSource} désigne ${attendu === '6512' ? 'un adhérent' : 'un client-usager'}, et sa perte va au ` +
        `${attendu} · fiche du compte 65, « 6511 Clients - usagers, 6512 Adhérents, 6515 Autres débiteurs ». Règle lue par analogie ` +
        'avec le 416 (fiche du compte 41, « 4161 Adhérents cotisations litigieuses ou douteuses »).');
}
const PARAGRAPHE_5421 = 'cadre conceptuel du SYCEBNL, § 5.4.2.1, « Toutefois, si l’entité ne peut justifier d’un droit d’agir en recouvrement, les ' +
    'cotisations et le droit d’entrée sont comptabilisés lors de leur encaissement effectif »';
const FICHE_41_IMPAYES = 'fiche SYCEBNL du compte 41, « Les chèques, effets à payer et autres valeurs revenus impayés doivent être enregistrés dans le ' +
    'compte 413 Adhérents, clients-usagers chèques, et autres valeurs impayés pour un meilleur suivi des incidents de paiements »';
const FICHE_51_ENCAISSEMENT = 'fiche SYCEBNL du compte 51, « Les valeurs à encaisser sont les effets, chèques et autres valeurs transmis à la banque et dont ' +
    'l’entité attend l’encaissement à l’échéance », le compte se soldant « lors de la réception de l’avis de crédit »';
function estImpayeAdherent(numeroSource) {
    return numeroSource.startsWith('4131') || numeroSource.startsWith('4133');
}
const METHODE_DU_JOUR = 'méthode déclarée aujourd’hui dans Paramètres du dossier, qui ne garde pas l’historique de ses changements';
const METHODE_AU_RECLASSEMENT = 'méthode en vigueur au jour du reclassement de la créance';
function methodeLueDansLeJournal(etat) {
    if (!etat || typeof etat !== 'object' || !('methodeCotisations' in etat))
        return undefined;
    const v = etat.methodeCotisations;
    return v === 'APPEL' || v === 'ENCAISSEMENT' || v === null ? v : undefined;
}
function avertissementMethodeInconnue(motif) {
    return (`Méthode des cotisations au jour du reclassement inconnue (${motif}) · la perte et la dépréciation de cet impayé ` +
        'd’adhérent ne sont pas refusées ; vérifiez que l’entité justifiait alors d’un droit d’agir en recouvrement (cadre ' +
        'conceptuel du SYCEBNL, § 5.4.2.1).');
}
function methodeAuReclassement(e) {
    if (e.figee !== null)
        return { connue: true, methode: e.figee === 'NON_DECLAREE' ? null : e.figee };
    if (!e.journal)
        return { connue: false, motif: 'journal d’audit non lu' };
    if (!e.journal.debut || e.geste.getTime() < e.journal.debut.getTime()) {
        return { connue: false, motif: 'reclassement antérieur au journal d’audit du dossier' };
    }
    if (e.journal.dernierAvant) {
        const m = e.journal.dernierAvant.apres;
        return m === undefined ? { connue: false, motif: 'le journal d’audit ne porte pas la méthode à cette date' } : { connue: true, methode: m };
    }
    if (e.journal.premierApres) {
        const m = e.journal.premierApres.avant;
        return m === undefined ? { connue: false, motif: 'le journal d’audit ne porte pas la méthode à cette date' } : { connue: true, methode: m };
    }
    return { connue: true, methode: e.actuelle };
}
exports.ISSUES_IMPAYE_RECLASSE = 'Annulez, du plus récent au plus ancien, les pertes ou recouvrements puis la revue de la dépréciation qui portent sur la ' +
    'créance, puis le reclassement (« Annuler le reclassement »), et soldez l’impayé contre le produit ou le droit d’entrée ' +
    'constaté à la remise de la valeur. Reclassement d’un exercice clôturé · passez la correction par le résultat de ' +
    'l’exercice en cours, sur le compte que le cabinet choisit, et désignez-la (« Corriger par le résultat », cadre ' +
    'conceptuel § 3.3.1.2.4).';
function motifRefusDotationImpayeAdherent(referentiel, numeroSource, methodeAuReclassementConnue) {
    if (referentiel !== client_1.Referentiel.SYCEBNL || methodeAuReclassementConnue !== 'ENCAISSEMENT' || !numeroSource)
        return null;
    if (!estImpayeAdherent(numeroSource))
        return null;
    return (`La cotisation était comptabilisée à son ENCAISSEMENT (${METHODE_AU_RECLASSEMENT}) · ${PARAGRAPHE_5421}. Le compte ` +
        `${numeroSource} est un impayé d'adhérent · ${FICHE_51_ENCAISSEMENT} ; il ne porte aucune créance, et rien ne se déprécie ` +
        "au 491 (fiche SYCEBNL du compte 49, « La dépréciation doit être certaine quant à sa nature et l'élément d'actif en cause " +
        `doit être individualisé »). Seules la reprise et le maintien restent ouverts. ${exports.ISSUES_IMPAYE_RECLASSE}`);
}
exports.ISSUES_IMPAYE_ADHERENT = 'Deux issues · soldez l’impayé contre le produit ou le droit d’entrée constaté à la remise de la valeur (dans le même ' +
    'exercice, la contre-passation de cette écriture ; d’un exercice à l’autre, par le résultat de l’exercice de l’impayé, cadre ' +
    'conceptuel § 3.3.1.2.4) ; ou, si l’entité justifie en réalité d’un droit d’agir en recouvrement, déclarez la méthode de ' +
    'l’APPEL dans Paramètres du dossier.';
function motifImpayeAdherentSousEncaissement(numeroSource) {
    return (`Le dossier comptabilise les cotisations à leur ENCAISSEMENT (${METHODE_DU_JOUR}) · ${PARAGRAPHE_5421}. Le compte ` +
        `${numeroSource} est un impayé d'adhérent · ${FICHE_41_IMPAYES} ; ${FICHE_51_ENCAISSEMENT}. Une valeur revenue impayée n'a ` +
        'jamais été encaissée · la cotisation n’a pas de fait générateur, le compte ne porte aucune créance, et rien ne se reclasse ' +
        `au 4161, ne se déprécie au 491 ni ne passe en perte au 6512. ${exports.ISSUES_IMPAYE_ADHERENT}`);
}
function motifRefusCotisationsEncaissement(referentiel, numeroSource, methode) {
    if (referentiel !== client_1.Referentiel.SYCEBNL || methode !== 'ENCAISSEMENT')
        return null;
    if (debiteurSycebnl(numeroSource) !== 'ADHERENT')
        return null;
    if (estImpayeAdherent(numeroSource))
        return motifImpayeAdherentSousEncaissement(numeroSource);
    return (`Le dossier comptabilise les cotisations à leur ENCAISSEMENT (${METHODE_DU_JOUR}) · ${PARAGRAPHE_5421}. Une cotisation ` +
        `non encaissée n'y est pas une créance, et ne se reclasse pas au 4161 · si le compte ${numeroSource} porte une créance, c'est ` +
        "la méthode déclarée ou l'écriture d'appel qui est à revoir.");
}
function motifRefusPerteImpayeAdherent(referentiel, numeroSource, methode) {
    if (referentiel !== client_1.Referentiel.SYCEBNL || methode !== 'ENCAISSEMENT' || !numeroSource)
        return null;
    if (!estImpayeAdherent(numeroSource))
        return null;
    return (`La cotisation était comptabilisée à son ENCAISSEMENT (${METHODE_AU_RECLASSEMENT}) · ${PARAGRAPHE_5421}. Le compte ` +
        `${numeroSource} est un impayé d'adhérent · ${FICHE_41_IMPAYES} ; ${FICHE_51_ENCAISSEMENT}. Une valeur revenue impayée n'a ` +
        'jamais été encaissée · elle ne porte aucune créance, et rien ne passe en perte au 6512 (fiche du compte 65, « Les créances ' +
        `des adhérents, clients et autres débiteurs irrécouvrables sont enregistrées au débit du compte 651 »). ${exports.ISSUES_IMPAYE_RECLASSE}`);
}
exports.CONTROLE_CREANCE_ADHERENT_SOUS_ENCAISSEMENT = {
    libelle: "Impayé d'adhérent reclassé au 4161 sous la méthode de l'encaissement",
    consequence: `Le dossier comptabilise les cotisations à leur ENCAISSEMENT (${METHODE_DU_JOUR}) · ${PARAGRAPHE_5421}. ` +
        `Un impayé d'adhérent (4131, 4133) n'y porte aucune créance · ${FICHE_51_ENCAISSEMENT} ; une valeur revenue impayée ` +
        "n'a donc jamais été encaissée. Le 4161 et, s'il y a lieu, le 491 portent une créance qui n'existe pas, et le produit " +
        'constaté à la remise de la valeur est surévalué.',
    action: 'Dans « Créances douteuses ou litigieuses », annulez, du plus récent au plus ancien, les pertes ou recouvrements puis la ' +
        'revue de la dépréciation qui portent sur la créance, puis le reclassement ; soldez ensuite l’impayé contre le produit ou ' +
        'le droit d’entrée constaté à la remise (dans le même exercice, la contre-passation ; d’un exercice à l’autre, par le ' +
        'résultat de l’exercice de l’impayé, cadre conceptuel § 3.3.1.2.4). Le module n’annule pas un reclassement d’un exercice ' +
        'clôturé · sa correction passe alors par le résultat de l’exercice en cours (même paragraphe), par une écriture du ' +
        'cabinet sur le compte qu’il choisit, aucune fiche lue ne le nommant, puis « Corriger par le résultat » la désigne et ' +
        'sort la créance du module. La méthode qui juge est celle du jour du reclassement · déclarer l’APPEL aujourd’hui ne ' +
        'change rien à une créance reclassée sous l’encaissement.',
};
function avertissementMethodeCotisations(referentiel, numeroSource, methode) {
    if (referentiel !== client_1.Referentiel.SYCEBNL)
        return null;
    if (debiteurSycebnl(numeroSource) !== 'ADHERENT')
        return null;
    if (methode !== null)
        return null;
    return ('La méthode de comptabilisation des cotisations n’est pas déclarée (Paramètres du dossier) · le reclassement au 4161 suppose ' +
        `une cotisation APPELÉE, dont l'entité peut poursuivre le recouvrement ; sinon, ${PARAGRAPHE_5421}.`);
}
const centimes = (x) => Math.round(x * 100) / 100;
exports.centimes = centimes;
function piecesLisibles(pieces) {
    return (pieces ?? [])
        .map((p) => ({ nature: (p.nature ?? '').trim(), reference: (p.reference ?? '').trim(), date: p.date ? p.date.slice(0, 10) : null }))
        .filter((p) => p.nature.length > 0 && p.reference.length > 0);
}
const MOTIF_SANS_MOTIF = 'Le motif est exigé · la fiche du compte 49 veut que l’entité puisse « justifier les motifs qui rendent les créances ' +
    'douteuses et litigieuses ».';
const MOTIF_SANS_PIECE = 'Au moins une pièce justificative est exigée (nature et référence) · la fiche du compte 49 nomme les « courriers et ' +
    'autres protêts, justificatifs du caractère douteux ou litigieux de la créance ».';
function motifEtPieces(motif, pieces) {
    if (!motif || motif.trim().length === 0)
        return MOTIF_SANS_MOTIF;
    if (pieces.length === 0)
        return MOTIF_SANS_PIECE;
    return null;
}
function motifRefus416Croise(referentiel, nature, numeroSource, numero416) {
    const attendu = compte416Propose(referentiel, nature, numeroSource);
    if (!attendu || numero416.startsWith(attendu))
        return null;
    if (referentiel === client_1.Referentiel.SYSCOHADA) {
        return (`Au SYSCOHADA, le ${attendu} reçoit les créances ${nature === client_1.NatureCreanceDouteuse.LITIGIEUSE ? 'litigieuses' : 'douteuses'} ` +
            '(4161 « Créances litigieuses », 4162 « Créances douteuses », fiche du compte 41) · le compte choisi ne correspond pas à la nature.');
    }
    return (`Au SYCEBNL, le compte ${numeroSource} désigne ${attendu === '4161' ? 'un adhérent' : 'un client-usager'}, et sa créance va au ` +
        `${attendu} · fiche du compte 41, « 4161 Adhérents cotisations litigieuses ou douteuses, 4162 Créances litigieuses ou douteuses ».`);
}
exports.MOTIF_CREANCE_EN_DEVISE = "Le compte du client porte une créance en devise non réglée (position en devise non soldée) · une créance en devise se réévalue à la clôture (AUDCIF art. 54) " +
    'et se règle dans sa devise (art. 55), et son reclassement au 416 en perdrait la devise. Ce cas n’est pas servi par le module · ' +
    'lettrez ce qui est réglé, ou passez le reclassement à la main.';
function motifRefusReclassement(e) {
    if (!e.exerciceOuvert)
        return "L'exercice est clôturé · le reclassement se passe dans un exercice ouvert.";
    if (!e.dateDansExercice)
        return "La date du reclassement doit tomber dans l'exercice choisi.";
    if (!e.journalGeneral)
        return "Le reclassement est une opération diverse · choisissez un journal d'opérations diverses.";
    const racines = exports.RACINES_CREANCE_SOURCE[e.referentiel];
    if (!racines.some((r) => e.numeroSource.startsWith(r))) {
        return (`Le compte ${e.numeroSource} n'est pas une créance client qui se reclasse au 416 · ce plan n'admet que ` +
            `${racines.join(', ')} (fiche du compte 41, « crédité des créances litigieuses ou douteuses, par le débit du compte 416 »).`);
    }
    if (!e.sourceEstDetail)
        return `Le compte ${e.numeroSource} est un compte de regroupement · choisissez le compte du client.`;
    if (!e.numero416.startsWith(exports.COMPTES_CREANCES_DOUTEUSES.creances416) || !e.numero416EstDetail) {
        return `Le compte ${e.numero416} n'est pas un compte de détail du 416 (créances litigieuses ou douteuses).`;
    }
    const croise = motifRefus416Croise(e.referentiel, e.nature, e.numeroSource, e.numero416);
    if (croise)
        return croise;
    const cotisations = e.methodeCotisations === undefined ? null : motifRefusCotisationsEncaissement(e.referentiel, e.numeroSource, e.methodeCotisations);
    if (cotisations)
        return cotisations;
    if (e.positionEnDevise)
        return exports.MOTIF_CREANCE_EN_DEVISE;
    if (!(e.montant > 0))
        return 'Le montant reclassé doit être positif.';
    if ((0, exports.centimes)(e.montant) > (0, exports.centimes)(e.soldeDebiteur) + 0.005) {
        return (`Le montant (${(0, exports.centimes)(e.montant).toFixed(2)}) dépasse ce que le client doit à cette date ` +
            `(${(0, exports.centimes)(Math.max(0, e.soldeDebiteur)).toFixed(2)}) · on ne reclasse qu'une créance inscrite.`);
    }
    if (e.soldeDernier != null && (0, exports.centimes)(e.montant) > (0, exports.centimes)(e.soldeDernier) + 0.005) {
        return (`Le montant (${(0, exports.centimes)(e.montant).toFixed(2)}) dépasse ce que le client doit au plus tard enregistré ` +
            `(${(0, exports.centimes)(Math.max(0, e.soldeDernier)).toFixed(2)}, brouillard compris) · des règlements datés après le reclassement en ont ` +
            'déjà soldé une part ; reclassée, elle laisserait le compte du client créditeur et le 416 porterait une créance réglée.');
    }
    return motifEtPieces(e.motif, e.pieces);
}
function depreciationEnPlace(revues, avant) {
    return (0, exports.centimes)(revues.filter((r) => r.exerciceDateFin.getTime() < avant.getTime()).reduce((s, r) => s + r.ecart, 0));
}
function resteDeLaCreance(montant, mouvements, au) {
    return (0, exports.centimes)(montant - mouvements.filter((m) => m.date.getTime() <= au.getTime()).reduce((s, m) => s + m.montant, 0));
}
function resteFinalDeLaCreance(montant, mouvements) {
    return (0, exports.centimes)(montant - mouvements.reduce((s, m) => s + m.montant, 0));
}
function motifResteNegatif(creance, resteFinal) {
    if (!(resteFinal < -0.005))
        return null;
    return (`La créance ${creance} a un reste négatif au 416 après tous ses mouvements (${(0, exports.centimes)(resteFinal).toFixed(2)}) · une perte ou un ` +
        'recouvrement dépasse la créance. Annulez le mouvement en trop s’il est dans un exercice ouvert (« Annuler une perte ou un ' +
        'recouvrement », AUDCIF art. 20, al. 2), repassez le bon montant, puis la revue. Si les mouvements en cause sont tous dans un ' +
        "exercice clôturé, aucun geste d'OmegaX ne lève encore ce refus · signalez-le à l'éditeur, qui le tient au suivi (ligne A7).");
}
function ecartDeDepreciation(enPlace, necessaire) {
    return (0, exports.centimes)(necessaire - enPlace);
}
function motifRefusRevue(e) {
    if (!e.exerciceOuvert)
        return "L'exercice est clôturé · la dépréciation se revoit à la clôture d'un exercice ouvert.";
    if (e.avantReclassement)
        return 'Cet exercice précède le reclassement de la créance · rien à y revoir.';
    if (e.revuePosterieure) {
        return (`La dépréciation de cette créance est déjà revue à la clôture du ${e.revuePosterieure} · revoir un exercice antérieur ` +
            'changerait la dépréciation en place que cette revue a lue. Retirez d’abord la revue postérieure.');
    }
    if (e.anterieursSansRevue.length > 0) {
        return (`Revoyez d'abord la dépréciation de ${e.anterieursSansRevue.join(', ')}, encore ouvert · la dépréciation se constate ` +
            '« à la clôture de l’exercice » (fiche du compte 49), et revoir N+1 avant N doterait deux fois la même perte.');
    }
    if (e.resteNegatif)
        return e.resteNegatif;
    if (!e.journalGeneral)
        return "La revue passe une opération diverse · choisissez un journal d'opérations diverses.";
    if (!Number.isFinite(e.necessaire) || e.necessaire < 0)
        return 'La dépréciation nécessaire est un montant positif ou nul.';
    if ((0, exports.centimes)(e.necessaire) > (0, exports.centimes)(e.reste) + 0.005) {
        return (`La dépréciation nécessaire (${(0, exports.centimes)(e.necessaire).toFixed(2)}) dépasse ce qui reste de la créance au 416 à la clôture ` +
            `(${(0, exports.centimes)(e.reste).toFixed(2)}) · elle exprime une moins-value sur la créance (fiche du compte 49, « valeur économique ` +
            'réelle [...] inférieure à leur valeur comptable »), jamais plus que la créance.');
    }
    const manque = motifEtPieces(e.motif, e.pieces);
    if (manque)
        return manque;
    if (ecartDeDepreciation(e.enPlace, e.necessaire) > 0 && e.refusSmt)
        return e.refusSmt;
    if (ecartDeDepreciation(e.enPlace, e.necessaire) > 0 && e.refusImpaye)
        return e.refusImpaye;
    return null;
}
function motifRefusMouvement(e) {
    if (!e.exerciceOuvert)
        return "L'exercice est clôturé.";
    if (!e.dateDansExercice)
        return "La date doit tomber dans l'exercice choisi.";
    if (e.avantReclassement)
        return 'La date précède le reclassement de la créance au 416.';
    if (e.revueApres) {
        return (`La dépréciation est déjà revue à la clôture du ${e.revueApres}, sur un reste qui ne comptait pas ce mouvement · ` +
            'annulez cette revue (au brouillard, son écriture est supprimée ; validée, elle est inscrite en négatif), passez le ' +
            'mouvement, puis refaites la revue (AUDCIF art. 20, al. 2).');
    }
    if (!e.journalAttendu) {
        return e.type === client_1.TypeMouvementCreanceDouteuse.RECOUVREMENT
            ? 'Un recouvrement se passe dans un journal de trésorerie qui porte son compte de trésorerie.'
            : "La perte se passe dans un journal d'opérations diverses.";
    }
    if (!(e.montant > 0))
        return 'Le montant doit être positif.';
    if ((0, exports.centimes)(e.montant) > (0, exports.centimes)(e.reste) + 0.005) {
        return `Le montant (${(0, exports.centimes)(e.montant).toFixed(2)}) dépasse ce qui reste de la créance au 416 (${(0, exports.centimes)(e.reste).toFixed(2)}).`;
    }
    if (e.resteFinal != null && (0, exports.centimes)(e.montant) > (0, exports.centimes)(e.resteFinal) + 0.005) {
        return (`Le montant (${(0, exports.centimes)(e.montant).toFixed(2)}) dépasse ce qui reste de la créance après tous ses mouvements ` +
            `(${(0, exports.centimes)(Math.max(0, e.resteFinal)).toFixed(2)}) · une perte ou un recouvrement datés après celui-ci en ont déjà sorti ` +
            'une part du 416 ; passé, il laisserait le 416 créditeur. Annulez d’abord le mouvement postérieur s’il est faux.');
    }
    if (e.type === client_1.TypeMouvementCreanceDouteuse.PERTE) {
        const impaye = motifRefusPerteImpayeAdherent(e.referentiel, e.numeroSource, e.methodeCotisations);
        if (impaye)
            return impaye;
        if (!e.numeroPerte) {
            return 'Choisissez le compte de perte sous le 651 · le compte du client ne dit pas si le débiteur est un adhérent ou un client-usager.';
        }
        if (!e.numeroPerte.startsWith(exports.COMPTES_CREANCES_DOUTEUSES.pertes651) || !e.numeroPerteEstDetail) {
            return (`Le compte ${e.numeroPerte} n'est pas un compte de détail du 651 · les créances irrécouvrables « sont enregistrées au débit ` +
                'du compte 651 » (fiche du compte 65).');
        }
        if (e.referentiel && e.numeroSource) {
            const croise = motifRefus651Croise(e.referentiel, e.numeroSource, e.numeroPerte);
            if (croise)
                return croise;
        }
    }
    return motifEtPieces(e.motif, e.pieces);
}
function enPlaceAvant(c, revues, avant) {
    const declaree = c.declareeOuverture && c.dateReclassement.getTime() <= avant.getTime() ? c.depreciationOuverture : 0;
    return (0, exports.centimes)(declaree + depreciationEnPlace(revues, avant));
}
function revueAFaire(p) {
    if (p.revueDeLExercice)
        return false;
    if (p.enPlace > p.reste + 0.005)
        return true;
    return p.aucuneRevue && p.reste > 0.005;
}
function motifClotureDepreciationsOrphelines(liste) {
    if (liste.length === 0)
        return null;
    const negatifs = liste.filter((o) => o.resteFinal != null && o.resteFinal < -0.005);
    if (negatifs.length > 0) {
        return negatifs
            .slice(0, 20)
            .map((o) => motifResteNegatif(o.creance, o.resteFinal))
            .join(' ') + (negatifs.length > 20 ? ` (${negatifs.length} créances en tout.)` : '');
    }
    const detail = liste
        .slice(0, 20)
        .map((o) => `${o.creance} (dépréciation en place ${o.enPlace.toFixed(2)}, reste au 416 ${o.reste.toFixed(2)})`)
        .join(' ; ');
    return (`${liste.length} créance(s) douteuse(s) portent une dépréciation supérieure à ce qui reste de la créance, sans revue de cet ` +
        `exercice · ${detail}${liste.length > 20 ? ' ; …' : ''}. Passez la revue de chacune dans « Créances douteuses ou litigieuses » ` +
        '(la reprise au 759 se proposera) avant de clôturer · fiche du compte 49, « débité à la clôture de l’exercice de la reprise des ' +
        'dépréciations [...] dont les raisons qui les ont motivées ont cessé d’exister ».');
}
function motifNonRetirable(p) {
    if (p.revuesTotal > 0 || p.mouvementsTotal > 0) {
        return ('Cette créance porte déjà une revue ou un mouvement (même annulés, ils se gardent) · la créance ne se retire plus, ' +
            'sa sortie se fait par la perte ou le recouvrement.');
    }
    if (p.exerciceClos)
        return "L'exercice de cette créance est clôturé.";
    if (p.ecriture && p.ecriture.statut !== 'BROUILLARD') {
        return "L'écriture du reclassement est validée · elle ne se retire plus, le reclassement s'annule (inscription en négatif).";
    }
    if (p.ecriture && p.ecriture.tenue)
        return "Une ligne de l'écriture du reclassement est lettrée ou pointée · défaites-la d'abord.";
    return null;
}
function motifLettrageFigeAuBrouillard(code, figee, objet) {
    return (`Le lettrage ${code} des lignes de la créance au 416 ne se défait plus · ${figee}. ` +
        `Supprimer cette écriture au brouillard le laisserait soldé sur une ligne disparue · validez l'écriture puis annulez ${objet} ` +
        "(l'inscription en négatif laisse le lettrage en place, et sa ligne ouverte porte le reste rétabli).");
}
exports.INFORMATION_BORNE_RECONSTITUEE = "Déclarée sur le report RECONSTITUÉ de l'exercice précédent · l'à-nouveau de cet exercice n'est pas passé, et la borne " +
    "du 416 et du 491 n'est pas sûre (une écriture passée ensuite dans l'exercice précédent la change). Clôturez l'exercice " +
    "précédent ou passez un bilan d'ouverture, puis vérifiez la déclaration.";
function motifLignesANouveauADesigner(numero416) {
    return (`Créance éteinte · ses lignes de l'exercice ne soldent pas seules au ${numero416} · le reste est porté par l'à-nouveau ` +
        '(reclassement d’un exercice précédent, ou créance déclarée à l’ouverture), qu’aucune liaison ne relie à la créance. ' +
        'Désignez ces lignes d’à-nouveau dans « Lettrer au 416 » · le module pose le lettrage lui-même.');
}
function informationLettrageMaintenu(code, figee) {
    return (`Le lettrage ${code} des lignes de la créance reste en place (${figee}) · l'annulation est inscrite en négatif à côté, ` +
        'et sa ligne ouverte porte le reste rétabli de la créance.');
}
exports.MOTIF_ANNULATION_MIN = 3;
exports.MOTIF_ANNULATION_MAX = 500;
function motifRefusAnnulationRevue(p) {
    if (p.dejaAnnulee)
        return `Cette revue est déjà annulée, le ${p.dejaAnnulee}.`;
    if (p.exerciceClos) {
        return "L'exercice de cette revue est clôturé · son erreur se corrige par le report à nouveau (AUDCIF art. 20, al. 3), hors de ce geste.";
    }
    if (p.posterieureNonAnnulee) {
        return (`La revue de la clôture du ${p.posterieureNonAnnulee}, postérieure, n'est pas annulée · elle part de la dépréciation que celle-ci ` +
            'a passée. On annule de la plus récente à la plus ancienne.');
    }
    const m = (p.motif ?? '').trim();
    if (m.length < exports.MOTIF_ANNULATION_MIN || m.length > exports.MOTIF_ANNULATION_MAX) {
        return `Le motif de l'annulation est exigé, de ${exports.MOTIF_ANNULATION_MIN} à ${exports.MOTIF_ANNULATION_MAX} caractères (AUDCIF art. 20, al. 2).`;
    }
    return null;
}
function motifRefusAnnulationReclassement(p) {
    if (p.dejaAnnulee)
        return `Ce reclassement est déjà annulé, le ${p.dejaAnnulee}.`;
    if (p.exerciceClos) {
        return "L'exercice du reclassement est clôturé · son erreur se corrige par le report à nouveau (AUDCIF art. 20, al. 3), hors de ce geste.";
    }
    if (p.revuesNonAnnulees > 0 || p.mouvementsNonAnnules > 0) {
        return (`La créance porte ${p.revuesNonAnnulees} revue(s) et ${p.mouvementsNonAnnules} perte(s) ou recouvrement(s) non annulés · ` +
            'ils ont lu le montant reclassé. Annulez-les d’abord, du plus récent au plus ancien, puis le reclassement.');
    }
    const m = (p.motif ?? '').trim();
    if (m.length < exports.MOTIF_ANNULATION_MIN || m.length > exports.MOTIF_ANNULATION_MAX) {
        return `Le motif de l'annulation est exigé, de ${exports.MOTIF_ANNULATION_MIN} à ${exports.MOTIF_ANNULATION_MAX} caractères (AUDCIF art. 20, al. 2).`;
    }
    return null;
}
function motifRefus491(nature, numero491, estDetail) {
    const racine = compte491(nature);
    if (numero491.startsWith(racine) && estDetail)
        return null;
    return (`Le compte ${numero491} n'est pas un compte de détail du ${racine} · une créance ` +
        `${nature === client_1.NatureCreanceDouteuse.LITIGIEUSE ? 'litigieuse' : 'douteuse'} se déprécie au ${racine} (fiche du compte 49).`);
}
function motifRefusDeclaration(e) {
    if (!e.exerciceOuvert)
        return "L'exercice est clôturé.";
    if (!e.dateDebutExercice) {
        return "La déclaration se date au premier jour d'un exercice du dossier, celui de l'à-nouveau qui porte la créance.";
    }
    const racines = exports.RACINES_CREANCE_SOURCE[e.referentiel];
    if (!racines.some((r) => e.numeroSource.startsWith(r))) {
        return `Le compte ${e.numeroSource} n'est pas un compte client de ce plan (${racines.join(', ')}) · il désigne le débiteur.`;
    }
    if (!e.numero416.startsWith(exports.COMPTES_CREANCES_DOUTEUSES.creances416) || !e.numero416EstDetail) {
        return `Le compte ${e.numero416} n'est pas un compte de détail du 416.`;
    }
    const croise = motifRefus416Croise(e.referentiel, e.nature, e.numeroSource, e.numero416);
    if (croise)
        return croise;
    if (e.sourceEstDetail === false)
        return `Le compte ${e.numeroSource} est un compte de regroupement · choisissez le compte du client.`;
    if (e.comptesEnSommeil && e.comptesEnSommeil.length > 0) {
        return `Le compte ${e.comptesEnSommeil.join(', ')} est en sommeil · réveillez-le dans Plan comptable, ou choisissez-en un autre.`;
    }
    const cotisations = e.methodeCotisations === undefined ? null : motifRefusCotisationsEncaissement(e.referentiel, e.numeroSource, e.methodeCotisations);
    if (cotisations)
        return cotisations;
    if (e.positionEnDevise) {
        return ('Le compte du client porte une créance en devise non réglée (position en devise non soldée) · une créance en devise se réévalue à la clôture ' +
            '(AUDCIF art. 54) et se règle dans sa devise (art. 55), et sa déclaration au module en perdrait la devise. Ce cas n’est ' +
            'pas servi par le module · lettrez ce qui est réglé en devise ; une créance en devise encore due se suit hors du module.');
    }
    if (!e.source || e.source.trim().length === 0) {
        return ('La source est exigée (balance de reprise, dossier de l’ancien cabinet, état des créances douteuses) · une déclaration ' +
            'sans source ne se vérifie pas.');
    }
    if (!(e.montant > 0))
        return 'Le montant de la créance doit être positif.';
    if (!(e.depreciation >= 0) || e.depreciation > e.montant + 0.005) {
        return 'La dépréciation existante est un montant positif ou nul, jamais au-delà de la créance.';
    }
    if (!e.aNouveau) {
        return "Cet exercice n'a pas encore d'à-nouveau (bilan d'ouverture ou report) · la déclaration se borne par lui, passez-le d'abord.";
    }
    const enDevise416 = (0, exports.centimes)(Math.max(0, e.enDevise416 ?? 0));
    const borne416 = (0, exports.centimes)(e.aNouveau416 - enDevise416);
    if ((0, exports.centimes)(e.dejaDeclare416 + e.montant) > borne416 + 0.005) {
        return (`Ce que le module porte déjà sur le ${e.numero416} à l'ouverture (${(0, exports.centimes)(e.dejaDeclare416).toFixed(2)}, créances reclassées ` +
            `avant et non sorties, ou déjà déclarées) plus cette créance (${(0, exports.centimes)(e.montant).toFixed(2)}) dépasse son à-nouveau ` +
            `(${(0, exports.centimes)(e.aNouveau416).toFixed(2)}` +
            (Math.abs(enDevise416) >= 0.005
                ? `, dont ${enDevise416.toFixed(2)} portés par une créance en devise non réglée, hors du module et retranchés`
                : '') +
            `) · on ne déclare que ce que le bilan d'ouverture porte, et une seule fois.`);
    }
    if ((0, exports.centimes)(e.dejaDeclare491 + e.depreciation) > (0, exports.centimes)(e.aNouveau491) + 0.005) {
        return (`Les dépréciations que le module porte déjà sur le 491 à l'ouverture (${(0, exports.centimes)(e.dejaDeclare491).toFixed(2)}) plus celle-ci ` +
            `(${(0, exports.centimes)(e.depreciation).toFixed(2)}) dépassent son à-nouveau (${(0, exports.centimes)(e.aNouveau491).toFixed(2)}).`);
    }
    return null;
}
function motifRefusAnnulationMouvement(p) {
    if (p.dejaAnnule)
        return `Ce mouvement est déjà annulé, le ${p.dejaAnnule}.`;
    if (p.exerciceClos) {
        return "L'exercice de ce mouvement est clôturé · son erreur se corrige par le report à nouveau (AUDCIF art. 20, al. 3), hors de ce geste.";
    }
    if (p.revueNonAnnulee) {
        return (`La revue de la clôture du ${p.revueNonAnnulee} a compté ce mouvement dans le reste de la créance · annulez-la d'abord, ` +
            'puis annulez le mouvement, puis refaites la revue.');
    }
    const m = (p.motif ?? '').trim();
    if (m.length < exports.MOTIF_ANNULATION_MIN || m.length > exports.MOTIF_ANNULATION_MAX) {
        return `Le motif de l'annulation est exigé, de ${exports.MOTIF_ANNULATION_MIN} à ${exports.MOTIF_ANNULATION_MAX} caractères (AUDCIF art. 20, al. 2).`;
    }
    return null;
}
function mouvementsSansRevue(p) {
    return p.revueDeLExercice ? 0 : p.mouvementsDeLExercice;
}
exports.MOTIF_LETTRAGE_PARTAGE = 'cette facture partage son lettrage avec d’autres ; le recouvrement sera listé parmi les recouvrements sans facture désignée, TVA à déclarer par le cabinet';
function partageSonLettrage(x) {
    if (!x.lettrage)
        return false;
    const sens = Number(x.debit) - Number(x.credit);
    const memeSens = (x.lettrage.lignes ?? []).reduce((t, g) => {
        const v = Number(g.debit) - Number(g.credit);
        return Math.abs(v) > 0.005 && v > 0 === sens > 0 ? t + Math.abs(v) : t;
    }, 0);
    return memeSens > Math.abs(sens) + 0.005;
}
exports.MOTIF_SANS_FACTURE_DESIGNEE = 'aucune facture désignée';
exports.MOTIF_SANS_LIGNE_DE_TVA = 'la facture désignée ne porte aucune ligne de TVA lue';
function motifRefusDesignation(p) {
    const fc = (x) => x.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    if (p.creanceAnnulee)
        return 'Le reclassement de cette créance est annulé · aucune facture ne se désigne.';
    if (!p.memeCompte)
        return `Cette ligne n'est pas au compte ${p.numeroCompte} du client de la créance.`;
    if (!p.validee)
        return 'Cette facture est encore au brouillard · validez-la avant de la désigner.';
    if (p.aNouveau) {
        return 'Cette ligne est un report à-nouveau · désignez la facture d’origine, qui porte la TVA.';
    }
    if (p.sensFacture <= 0.005)
        return 'Cette ligne ne débite pas le client · ce n’est pas une facture.';
    if (p.lettragePartage)
        return `Désignation refusée · ${exports.MOTIF_LETTRAGE_PARTAGE}.`;
    if (!(p.montant > 0))
        return 'La part désignée doit être positive.';
    if (p.dejaDesignee)
        return 'Cette facture est déjà désignée par cette créance.';
    if (p.designeeAilleurs) {
        return 'Cette facture est déjà désignée par une autre créance non annulée · une facture n’est reprise que par une créance.';
    }
    if (p.montant > p.ouvert + 0.005) {
        return `La part désignée (${fc(p.montant)}) dépasse ce que la facture doit encore (${fc(p.ouvert)}).`;
    }
    if (p.totalDesigne > p.montantCreance + 0.005) {
        return `Les factures désignées (${fc(p.totalDesigne)}) dépassent le montant reclassé (${fc(p.montantCreance)}).`;
    }
    return null;
}
function motifRefusCorrectionParResultat(e) {
    const fc = (x) => (0, exports.centimes)(x).toFixed(2);
    if (e.referentiel !== client_1.Referentiel.SYCEBNL || !estImpayeAdherent(e.numeroSource)) {
        return (`La correction par le résultat ne vise qu'un impayé d'adhérent (4131, 4133) reclassé sous l'encaissement · le compte ` +
            `${e.numeroSource} porte une créance, qui se recouvre, se perd ou s'annule dans ce module.`);
    }
    if (e.methode.connue && e.methode.methode === 'APPEL') {
        return ('La créance a été reclassée sous la méthode de l’APPEL · c’est une créance (cadre conceptuel du SYCEBNL, § 5.4.2.1), ' +
            'qui se recouvre ou se perd ; elle ne se corrige pas par le résultat.');
    }
    if (e.actuelle !== 'ENCAISSEMENT' && !(e.methode.connue && e.methode.methode === 'ENCAISSEMENT')) {
        return ('Rien ne dit que cette cotisation était comptabilisée à son encaissement · ' +
            (e.methode.connue ? 'aucune méthode n’était déclarée au jour du reclassement' : `méthode au jour du reclassement inconnue (${e.methode.motif})`) +
            ', et le dossier ne déclare pas l’encaissement aujourd’hui. Déclarez la méthode dans Paramètres du dossier.');
    }
    if (!e.declareeOuverture && !e.exerciceCreanceClos) {
        return ("L'exercice du reclassement est ouvert · le module l'annule lui-même (« Annuler le reclassement », AUDCIF art. 20, " +
            'al. 2), puis l’impayé se solde contre le produit constaté à la remise de la valeur.');
    }
    if (!e.ecritureValidee) {
        return 'L’écriture de correction est encore au brouillard · validez-la avant de la désigner (AUDCIF art. 22, 2°).';
    }
    if (!e.exerciceEcritureOuvert)
        return 'L’écriture de correction tombe dans un exercice clôturé.';
    if (!e.exerciceEcritureApres) {
        return ('L’écriture de correction doit tomber dans un exercice postérieur au reclassement · « ces corrections doivent ' +
            'transiter par le compte de résultat du nouvel exercice » (cadre conceptuel § 3.3.1.2.4).');
    }
    if (e.detenteurs.length > 0) {
        return `Cette écriture est déjà la contrepartie de ${e.detenteurs.join(' et ')} · désignez l’écriture de la correction.`;
    }
    if (e.mouvementApres) {
        return `Un mouvement de la créance est daté du ${e.mouvementApres}, après l’écriture de correction · annulez-le, ou datez la correction après lui.`;
    }
    if (e.revueApres) {
        return (`La dépréciation est revue à la clôture du ${e.revueApres}, après la date de l’écriture de correction · annulez cette ` +
            'revue, puis désignez la correction.');
    }
    if (e.reste < -0.005) {
        return `Le reste de la créance après tous ses mouvements est négatif (${fc(e.reste)}) · annulez d’abord le mouvement en trop.`;
    }
    if (!(e.reste > 0.005) && !(e.enPlace > 0.005)) {
        return 'La créance ne porte plus rien au 416 ni au 491 · il n’y a rien à corriger.';
    }
    if (Math.abs((0, exports.centimes)(e.credit416) - (0, exports.centimes)(e.reste)) > 0.005) {
        return (`L’écriture porte ${fc(e.credit416)} au crédit du 416 de la créance, qui en garde ${fc(e.reste)} · la correction solde ` +
            'exactement le reste de la créance, ni plus ni moins.');
    }
    if (Math.abs((0, exports.centimes)(e.debit491) - (0, exports.centimes)(e.enPlace)) > 0.005) {
        return (`L’écriture porte ${fc(e.debit491)} au débit du 491 de la créance, dont la dépréciation en place est de ${fc(e.enPlace)} · ` +
            'la correction reprend exactement cette dépréciation, sans quoi elle resterait au 491 sans créance.');
    }
    const horsGestion = e.autres.filter((a) => !a.gestion);
    if (horsGestion.length > 0) {
        return (`L’écriture touche ${horsGestion.map((a) => a.numero).join(', ')} · une correction par le résultat ne porte, hors le ` +
            '416 et le 491 de la créance, que des comptes de gestion (classes 6, 7 et 8) ; « on ne peut imputer directement sur les ' +
            'capitaux propres » (cadre conceptuel § 3.3.1.2.4).');
    }
    if (e.autres.length === 0)
        return 'L’écriture ne porte aucun compte de résultat · la correction transite par le compte de résultat.';
    const motif = (e.motif ?? '').trim();
    if (motif.length < exports.MOTIF_ANNULATION_MIN || motif.length > exports.MOTIF_ANNULATION_MAX) {
        return `Le motif de la correction est obligatoire (${exports.MOTIF_ANNULATION_MIN} à ${exports.MOTIF_ANNULATION_MAX} caractères).`;
    }
    return null;
}
//# sourceMappingURL=creances-douteuses.js.map