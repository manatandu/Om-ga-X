"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ventilerExercice = ventilerExercice;
const centimes = (x) => Math.round(x * 100) / 100;
const jour = (d) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
function ventilerExercice(lignes, datePriseEffet, dette, tauxPeriodique, exercice, optionLevee = null, garantieAppelee = null) {
    const debut = jour(exercice.dateDebut);
    const fin = jour(exercice.dateFin);
    const dansLExercice = (l) => jour(l.date) >= debut && jour(l.date) <= fin;
    const loyersEchus = lignes.filter((l) => dansLExercice(l) && (!l.option || optionLevee === true) && (!l.garantie || garantieAppelee === true));
    const optionNonDeclaree = lignes.some((l) => l.option && dansLExercice(l)) && optionLevee === null;
    const garantieNonDeclaree = lignes.some((l) => l.garantie && dansLExercice(l)) && garantieAppelee === null;
    const garantieNonAppelee = garantieAppelee === false ? centimes(lignes.filter((l) => l.garantie && dansLExercice(l)).reduce((s, l) => s + l.capital, 0)) : 0;
    const loyers = centimes(loyersEchus.reduce((s, l) => s + l.paiement, 0));
    const capital = centimes(loyersEchus.reduce((s, l) => s + l.capital, 0));
    const interets = centimes(loyers - capital);
    const passees = lignes.filter((l) => jour(l.date) <= fin);
    const derniere = passees[passees.length - 1];
    const suivante = lignes.find((l) => jour(l.date) > fin && !(l.option && optionLevee === false) && !(l.garantie && garantieAppelee === false));
    let interetsCourus = 0;
    if (suivante) {
        const depuis = derniere ? jour(derniere.date) : jour(datePriseEffet);
        const restant = derniere ? derniere.restant : dette;
        const ecoules = (fin - depuis) / 86_400_000;
        const periode = (jour(suivante.date) - depuis) / 86_400_000;
        if (periode > 0 && ecoules > 0 && restant > 0) {
            const fraction = Math.min(1, (ecoules + 1) / periode);
            interetsCourus = centimes(restant * (Math.pow(1 + tauxPeriodique, fraction) - 1));
        }
    }
    return {
        loyers,
        capital,
        interets,
        interetsCourus,
        rangs: loyersEchus.map((l) => l.rang),
        optionNonDeclaree,
        garantieNonDeclaree,
        garantieNonAppelee,
    };
}
//# sourceMappingURL=cloture-location-acquisition.js.map