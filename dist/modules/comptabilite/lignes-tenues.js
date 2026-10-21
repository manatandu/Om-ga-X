"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.motifLignesTenues = motifLignesTenues;
const ligne_lettree_1 = require("../lettrage/ligne-lettree");
const ISSUE_RAPPROCHEMENT_CLOS = 'Un rapprochement encore en cours se dépointe directement ; clos, seul l’administrateur le rouvre (« Rouvrir le rapprochement », ' +
    'le dernier clos du compte seulement, motif exigé), puis la ligne se dépointe.';
const ISSUE_LETTRAGE_FIGE = 'Une ligne figée par une clôture totale, de période ou d’exercice ne se délettre plus · ces clôtures sont définitives. ' +
    'Exercice clôturé · l’erreur relève du report à nouveau (AUDCIF art. 20, al. 3). Exercice encore ouvert · l’inscription en ' +
    'négatif reste due dans l’exercice (art. 20, al. 2), au premier jour non clôturé (art. 22, 4°), mais OmegaX ne l’inscrit pas ' +
    'sur une ligne lettrée, hors les gestes des créances douteuses, qui l’inscrivent à côté de leur lettrage figé · saisissez ' +
    'vous-même l’écriture en négatif, au premier jour non clôturé.';
function motifLignesTenues(lignes, objet, geste, issue = '', groupeTolere = null) {
    const toleres = new Set(groupeTolere === null ? [] : typeof groupeTolere === 'string' ? [groupeTolere] : groupeTolere);
    const lettrees = lignes.filter((l) => (0, ligne_lettree_1.estTenueParUnLettrage)(l) && !(l.lettrageId !== null && toleres.has(l.lettrageId)));
    if (lettrees.length > 0) {
        return (`${lettrees.length} ligne(s) de ${objet} sont lettrées (${[...new Set(lettrees.map(ligne_lettree_1.designationLettrage))].join(', ')}). ` +
            `Le lettrage affirme que ces lignes sont soldées entre elles ; ${geste} sans délettrer laisserait cette ` +
            `affirmation en place, devenue fausse. Délettrez-les d’abord${issue}. ${ISSUE_LETTRAGE_FIGE}`);
    }
    const pointees = lignes.filter((l) => l.rapprochementId);
    if (pointees.length > 0) {
        return (`${pointees.length} ligne(s) de ${objet} sont pointées dans un rapprochement bancaire. Le pointage ` +
            `affirme la concordance avec un relevé ; dépointez-les d’abord${issue}. ${ISSUE_RAPPROCHEMENT_CLOS}`);
    }
    return null;
}
//# sourceMappingURL=lignes-tenues.js.map