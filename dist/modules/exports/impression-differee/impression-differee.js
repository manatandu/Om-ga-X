"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MOTIF_NON_RANGEE = exports.MOTIF_INTERROMPUE = exports.PLAFOND_IMPRESSIONS_LISTEES = exports.DELAI_PRODUCTION_MS = void 0;
exports.criteresOuMotif = criteresOuMotif;
exports.libelleDemande = libelleDemande;
exports.motifEchecDe = motifEchecDe;
exports.estInterrompue = estInterrompue;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
exports.DELAI_PRODUCTION_MS = 30 * 60 * 1000;
exports.PLAFOND_IMPRESSIONS_LISTEES = 50;
exports.MOTIF_INTERROMPUE = "Production non terminée dans le délai de requête du serveur · rien n'a été rangé, demandez l'édition de nouveau.";
exports.MOTIF_NON_RANGEE = "Le livre a été produit, mais son fichier n'a pas pu être rangé · rien n'est gardé, demandez l'édition de nouveau.";
const JOUR = /^\d{4}-\d{2}-\d{2}$/;
function jourOuNull(valeur, nom) {
    if (valeur === undefined || valeur === null || valeur === '')
        return null;
    if (typeof valeur !== 'string' || !JOUR.test(valeur) || Number.isNaN(Date.parse(`${valeur}T00:00:00Z`))) {
        return { motif: `${nom} illisible · une date AAAA-MM-JJ est attendue.` };
    }
    return valeur;
}
function criteresOuMotif(nature, brut) {
    const exerciceId = brut.exerciceId;
    if (typeof exerciceId !== 'string' || exerciceId.trim() === '') {
        return { motif: "L'exercice de l'édition est exigé." };
    }
    if (nature === client_1.NatureImpressionDifferee.JOURNAL) {
        const journalId = brut.journalId;
        if (journalId !== undefined && journalId !== null && journalId !== '' && typeof journalId !== 'string') {
            return { motif: 'Journal illisible.' };
        }
        const debut = jourOuNull(brut.dateDebut, 'Date de début');
        if (debut !== null && typeof debut === 'object')
            return debut;
        const fin = jourOuNull(brut.dateFin, 'Date de fin');
        if (fin !== null && typeof fin === 'object')
            return fin;
        if (debut && fin && debut > fin)
            return { motif: 'La date de début suit la date de fin.' };
        if (brut.inclureBrouillard !== undefined && typeof brut.inclureBrouillard !== 'boolean') {
            return { motif: 'Brouillard compris · oui ou non.' };
        }
        return {
            criteres: {
                exerciceId,
                journalId: typeof journalId === 'string' && journalId !== '' ? journalId : null,
                dateDebut: debut,
                dateFin: fin,
                inclureBrouillard: brut.inclureBrouillard !== false,
            },
        };
    }
    if (nature === client_1.NatureImpressionDifferee.GRAND_LIVRE) {
        const format = brut.format ?? 'fpm';
        if (format !== 'fpm' && format !== 'plat') {
            return { motif: 'Présentation du grand livre inconnue · « fpm » (présentation du cabinet) ou « plat ».' };
        }
        return { criteres: { exerciceId, format } };
    }
    if (brut.grandsLivres !== undefined && typeof brut.grandsLivres !== 'boolean') {
        return { motif: 'Grands livres de la balance · oui ou non.' };
    }
    return { criteres: { exerciceId, grandsLivres: brut.grandsLivres !== false } };
}
const NOMS = {
    JOURNAL: 'Journal',
    GRAND_LIVRE: 'Grand livre',
    BALANCE: 'Balance',
};
const enFrancais = (iso) => {
    const [a, m, j] = iso.slice(0, 10).split('-');
    return `${j}/${m}/${a}`;
};
function libelleDemande(nature, criteres, exercice, journal) {
    const morceaux = [
        NOMS[nature],
        `exercice du ${enFrancais(exercice.dateDebut.toISOString())} au ${enFrancais(exercice.dateFin.toISOString())}`,
    ];
    if (nature === client_1.NatureImpressionDifferee.JOURNAL) {
        const c = criteres;
        morceaux.push(journal ? `journal ${journal.code}` : 'tous les journaux');
        if (c.dateDebut || c.dateFin) {
            morceaux.push(`${c.dateDebut ? `du ${enFrancais(c.dateDebut)}` : ''}${c.dateDebut && c.dateFin ? ' ' : ''}${c.dateFin ? `au ${enFrancais(c.dateFin)}` : ''}`);
        }
        morceaux.push(c.inclureBrouillard ? 'brouillard compris' : 'livre-journal seul');
    }
    else if (nature === client_1.NatureImpressionDifferee.GRAND_LIVRE) {
        morceaux.push(criteres.format === 'plat' ? 'livre à plat' : 'présentation du cabinet');
    }
    else {
        morceaux.push(criteres.grandsLivres ? 'avec les grands livres' : 'balance seule');
    }
    return morceaux.join(' · ');
}
function motifEchecDe(erreur) {
    if (erreur instanceof common_1.HttpException) {
        const reponse = erreur.getResponse();
        if (typeof reponse === 'string')
            return reponse;
        const message = reponse.message;
        if (Array.isArray(message))
            return message.join(', ');
        if (typeof message === 'string')
            return message;
        return erreur.message;
    }
    return "La production a échoué sur une erreur inattendue du serveur, consignée · rien n'a été rangé, demandez l'édition de nouveau.";
}
function estInterrompue(etat, commenceLe, maintenant) {
    return etat === client_1.EtatImpressionDifferee.EN_COURS && commenceLe !== null && maintenant.getTime() - commenceLe.getTime() > exports.DELAI_PRODUCTION_MS;
}
//# sourceMappingURL=impression-differee.js.map