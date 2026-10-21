"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.estContigu = estContigu;
exports.motifSuivantNonContigu = motifSuivantNonContigu;
exports.motifCreationNonContigue = motifCreationNonContigue;
const JOUR_MS = 86_400_000;
function memeJour(a, b) {
    return a.toISOString().slice(0, 10) === b.toISOString().slice(0, 10);
}
function jour(d) {
    const iso = d.toISOString().slice(0, 10);
    return `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
}
function estContigu(dateFin, debutSuivant) {
    return memeJour(new Date(dateFin.getTime() + JOUR_MS), debutSuivant);
}
function motifSuivantNonContigu(dateFin, suivant) {
    const lendemain = new Date(dateFin.getTime() + JOUR_MS);
    return (`Aucun exercice ne commence le ${jour(lendemain)}, lendemain de la clôture · le prochain exercice du dossier ` +
        `commence le ${jour(suivant.dateDebut)}. Le bilan d'ouverture d'un exercice doit correspondre au bilan de ` +
        "clôture de l'exercice précédent (AUDCIF art. 34 ; SYCEBNL art. 16, 4°) · créez d'abord l'exercice qui " +
        `commence le ${jour(lendemain)}.`);
}
function motifCreationNonContigue(dateDebut, dateFin, precedent, suivant) {
    if (!precedent && !suivant)
        return null;
    if (precedent && estContigu(precedent.dateFin, dateDebut))
        return null;
    if (suivant && estContigu(dateFin, suivant.dateDebut))
        return null;
    const voisin = precedent
        ? `l'exercice précédent finit le ${jour(precedent.dateFin)}`
        : `l'exercice suivant commence le ${jour(suivant.dateDebut)}`;
    return (`Cet exercice ne touche aucun exercice du dossier · ${voisin}. Les exercices se suivent sans interruption, ` +
        "le bilan d'ouverture de chacun correspondant au bilan de clôture du précédent (AUDCIF art. 34 ; SYCEBNL " +
        'art. 16, 4°) · créez d’abord les exercices intermédiaires.');
}
//# sourceMappingURL=exercice-contigu.js.map