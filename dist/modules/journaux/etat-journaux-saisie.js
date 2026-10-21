"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.moisDeLExercice = moisDeLExercice;
exports.grilleJournauxSaisie = grilleJournauxSaisie;
const client_1 = require("@prisma/client");
const gel_cloture_1 = require("../exercice/gel-cloture");
const impressions_journal_1 = require("./impressions-journal");
const jour = (d) => d.toISOString().slice(0, 10);
function moisDeLExercice(dateDebut, dateFin) {
    const sortie = [];
    let curseur = new Date(Date.UTC(dateDebut.getUTCFullYear(), dateDebut.getUTCMonth(), 1));
    while (curseur <= dateFin) {
        const finMois = new Date(Date.UTC(curseur.getUTCFullYear(), curseur.getUTCMonth() + 1, 0));
        const debut = curseur < dateDebut ? dateDebut : curseur;
        sortie.push({ debut: jour(debut), fin: jour(finMois > dateFin ? dateFin : finMois) });
        curseur = new Date(Date.UTC(curseur.getUTCFullYear(), curseur.getUTCMonth() + 1, 1));
    }
    return sortie;
}
function figeJusquauDansLeMois(journalId, m, clotures) {
    const dates = clotures
        .filter((c) => c.granularite !== 'PARTIELLE' && (c.granularite === 'PERIODE' || c.journalId === journalId))
        .map((c) => jour(c.dateLimite))
        .filter((d) => d >= m.debut && d < m.fin)
        .sort();
    return dates.length ? dates[dates.length - 1] : null;
}
function grilleJournauxSaisie(journaux, mois, comptages, clotures, exerciceClos, impressions) {
    const cle = (journalId, date) => `${journalId}|${date.slice(0, 7)}`;
    const cumul = new Map();
    for (const c of comptages) {
        const k = cle(c.journalId, jour(c.date));
        const v = cumul.get(k) ?? { nombre: 0, brouillard: 0, provisoire: 0, situation: 0, nonImprime: 0 };
        v.nombre += c.nombre;
        if (c.estANouveauProvisoire)
            v.provisoire += c.nombre;
        else if (c.statut === client_1.StatutEcriture.BROUILLARD)
            v.brouillard += c.nombre;
        else if (c.statut === client_1.StatutEcriture.SITUATION)
            v.situation += c.nombre;
        else if (impressions &&
            c.statut === client_1.StatutEcriture.VALIDEE &&
            !(0, impressions_journal_1.jourCouvert)({ journalId: c.journalId, date: c.date, derniereValidation: c.derniereValidation ?? c.date }, impressions)) {
            v.nonImprime += c.nombre;
        }
        cumul.set(k, v);
    }
    return journaux.map((j) => ({
        journalId: j.id,
        cases: mois.map((m) => {
            const v = cumul.get(cle(j.id, m.debut)) ?? { nombre: 0, brouillard: 0, provisoire: 0, situation: 0, nonImprime: 0 };
            const journalSituation = j.type === 'SITUATION';
            const figeFin = (0, gel_cloture_1.motifLigneFigee)({ journalId: j.id, date: new Date(`${m.fin}T00:00:00.000Z`), exerciceClos, journalSituation }, clotures);
            const etat = figeFin
                ? 'CLOTURE'
                : v.nombre - v.provisoire === 0
                    ? 'VIDE'
                    : v.situation > 0
                        ? 'SITUATION'
                        : v.brouillard > 0
                            ? 'BROUILLARD'
                            : v.nonImprime > 0
                                ? 'NON_IMPRIME'
                                : 'JOURNAL';
            return {
                mois: m.debut.slice(0, 7),
                etat,
                nombreEcritures: v.nombre,
                enBrouillard: v.brouillard,
                aNouveauProvisoire: v.provisoire,
                figeJusquau: figeFin ? null : figeJusquauDansLeMois(j.id, m, journalSituation ? clotures.filter((c) => c.granularite !== 'PERIODE') : clotures),
            };
        }),
    }));
}
//# sourceMappingURL=etat-journaux-saisie.js.map