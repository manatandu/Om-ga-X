"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ISSUE_TRANSFERT = exports.HORS_SITUATION = exports.STATUTS_COMPTABLES = void 0;
exports.avecStatut = avecStatut;
exports.filtreDuStatut = filtreDuStatut;
exports.libelleDuStatut = libelleDuStatut;
exports.estJournalDeSituation = estJournalDeSituation;
exports.statutDeNaissance = statutDeNaissance;
exports.motifSituationNeSeValidePas = motifSituationNeSeValidePas;
exports.motifSimulationNonRattachable = motifSimulationNonRattachable;
exports.motifJournalDeSituationReserveALaSaisie = motifJournalDeSituationReserveALaSaisie;
exports.motifJournalDeSituationNonCloturable = motifJournalDeSituationNonCloturable;
exports.motifSituationHorsSequenceDuFichier = motifSituationHorsSequenceDuFichier;
exports.motifTransfertSansObjet = motifTransfertSansObjet;
exports.motifArriveeDeSituation = motifArriveeDeSituation;
exports.motifBrouillardHeriteNeSeValidePas = motifBrouillardHeriteNeSeValidePas;
exports.motifImpressionDeSituationNonNumerotee = motifImpressionDeSituationNonNumerotee;
const client_1 = require("@prisma/client");
exports.STATUTS_COMPTABLES = [client_1.StatutEcriture.BROUILLARD, client_1.StatutEcriture.VALIDEE];
exports.HORS_SITUATION = { statut: { not: client_1.StatutEcriture.SITUATION } };
function avecStatut(filtre) {
    return filtre.statut !== undefined ? filtre : { ...filtre, ...exports.HORS_SITUATION };
}
function filtreDuStatut(inclureBrouillard) {
    return inclureBrouillard ? exports.HORS_SITUATION : { statut: client_1.StatutEcriture.VALIDEE };
}
function libelleDuStatut(statut) {
    if (statut === client_1.StatutEcriture.VALIDEE)
        return 'Validée';
    if (statut === client_1.StatutEcriture.SITUATION)
        return 'Situation';
    return 'Brouillard';
}
function estJournalDeSituation(journal) {
    return journal.type === client_1.TypeJournal.SITUATION;
}
function statutDeNaissance(journal) {
    return estJournalDeSituation(journal) ? client_1.StatutEcriture.SITUATION : client_1.StatutEcriture.BROUILLARD;
}
const FONDEMENT = "(AUDCIF art. 19 · le livre-journal reçoit les mouvements de l'exercice ; art. 22, 1° · la validation ne porte que sur " +
    'les données relatives à une opération)';
function motifSituationNeSeValidePas(pieces) {
    return (`${pieces.length > 1 ? 'Les écritures' : "L'écriture"} ${pieces.join(', ')} ${pieces.length > 1 ? 'sont' : 'est'} ` +
        `${pieces.length > 1 ? 'des écritures' : 'une écriture'} de situation · ${pieces.length > 1 ? 'elles' : 'elle'} ` +
        `n'enregistre${pieces.length > 1 ? 'nt' : ''} aucune opération et n'entre${pieces.length > 1 ? 'nt' : ''} jamais au ` +
        `livre-journal ${FONDEMENT}. Pour passer l'opération, saisissez-la dans un journal ordinaire.`);
}
function motifSimulationNonRattachable(piece, acte) {
    return (`L'écriture ${piece} est une écriture de situation · elle n'enregistre aucune opération ${FONDEMENT} et ne ` +
        `justifie pas ${acte}. Désignez la pièce passée dans un journal ordinaire.`);
}
function motifJournalDeSituationReserveALaSaisie(code) {
    return (`Le journal ${code} est un journal de situation · il ne reçoit que des écritures saisies, qui n'entrent jamais ` +
        `au livre-journal ${FONDEMENT}. Une opération passée par un traitement doit l'être dans un journal ordinaire · ` +
        'choisissez-en un autre.');
}
function motifJournalDeSituationNonCloturable(code) {
    return (`Le journal ${code} est un journal de situation · il ne se clôture pas. La clôture informatique porte sur la ` +
        "chronologie des opérations enregistrées (AUDCIF art. 22, 3°), et ses écritures n'en enregistrent aucune. Une " +
        'clôture de période fige tous les autres journaux et le laisse ouvert.');
}
function motifSituationHorsSequenceDuFichier(code) {
    return (`Le journal ${code} est un journal de situation · il ne prend pas la numérotation continue pour le fichier, qui ` +
        "numérote les pièces du livre-journal (AUDCIF art. 17, 3°). Choisissez la numérotation continue par journal, " +
        'mensuelle ou manuelle.');
}
exports.ISSUE_TRANSFERT = 'transférez-la dans un journal ordinaire (Brouillard, « Transférer »), où elle se valide comme toute pièce · ' +
    'ses lignes, son lettrage, son pointage et ses liens aux modules restent tels quels';
function motifTransfertSansObjet(piece, statut, situation) {
    if (!situation) {
        return `L'écriture ${piece} n'est pas dans un journal de situation · le transfert ne sert qu'au brouillard qu'un tel journal a gardé.`;
    }
    if (statut === client_1.StatutEcriture.SITUATION) {
        return (`L'écriture ${piece} est une écriture de situation · elle n'enregistre aucune opération ${FONDEMENT} et ne se ` +
            "transfère pas. Pour passer l'opération, saisissez-la dans un journal ordinaire.");
    }
    if (statut === client_1.StatutEcriture.VALIDEE) {
        return (`L'écriture ${piece} est validée · elle est entrée au livre-journal et ne change plus de journal (AUDCIF ` +
            'art. 22, 2°). Le contrôle des écritures validées dans un journal de situation dit la voie de correction.');
    }
    return null;
}
function motifArriveeDeSituation(code) {
    return (`Le journal ${code} est un journal de situation · ses écritures ne se valident pas. Choisissez un journal ` +
        "ordinaire, celui où l'opération aurait dû être saisie.");
}
function motifBrouillardHeriteNeSeValidePas(pieces) {
    const plusieurs = pieces.length > 1;
    return (`${plusieurs ? 'Les écritures' : "L'écriture"} ${pieces.join(', ')} ${plusieurs ? 'sont restées' : 'est restée'} au ` +
        `brouillard dans un journal de situation · ${plusieurs ? 'elles ne se valident' : 'elle ne se valide'} pas dans ce ` +
        `journal ${FONDEMENT}. ${exports.ISSUE_TRANSFERT.charAt(0).toUpperCase()}${exports.ISSUE_TRANSFERT.slice(1)}.`);
}
function motifImpressionDeSituationNonNumerotee(code) {
    return (`Le journal ${code} est un journal de situation · son impression n'atteste aucune opération du livre-journal et ` +
        'ne prend pas de numéro dans la suite des impressions.');
}
//# sourceMappingURL=ecritures-de-situation.js.map