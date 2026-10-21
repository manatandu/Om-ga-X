"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.motifRefusDateReception = motifRefusDateReception;
exports.dateDeValeurComptable = dateDeValeurComptable;
exports.libelleDeFacture = libelleDeFacture;
exports.avertissementExerciceDeLaFacture = avertissementExerciceDeLaFacture;
const jour = (d) => d.toISOString().slice(0, 10);
const fr = (d) => {
    const [a, m, j] = jour(d).split('-');
    return `${j}/${m}/${a}`;
};
function motifRefusDateReception(p, aujourdhui) {
    if (!p.dateReception)
        return null;
    if (p.sens === 'VENTE') {
        return ('Une facture de vente est émise par le dossier · sa date de valeur comptable est celle de son émission ' +
            '(AUDCIF art. 16, al. 2), elle ne porte pas de date de réception.');
    }
    if (jour(p.dateReception) < jour(p.dateFacture)) {
        return (`La date de réception (${fr(p.dateReception)}) est antérieure à la date de la facture (${fr(p.dateFacture)}) · ` +
            'une pièce ne se reçoit pas avant d’avoir été établie.');
    }
    if (jour(p.dateReception) > jour(aujourdhui)) {
        return `La date de réception (${fr(p.dateReception)}) est postérieure à aujourd’hui · une pièce se déclare reçue une fois parvenue.`;
    }
    return null;
}
function dateDeValeurComptable(p) {
    if (p.sens === 'VENTE')
        return { date: p.dateFacture };
    if (!p.dateReception) {
        return {
            refus: 'La date de réception de la facture n’est pas renseignée · une pièce d’origine externe s’enregistre à la ' +
                'date de sa réception (AUDCIF art. 16, al. 2). Déclarez la date à laquelle la facture est parvenue au dossier.',
        };
    }
    return { date: p.dateReception };
}
function libelleDeFacture(nature, numeroSerie, dateFacture, contrepartieNom) {
    return `${nature === 'NOTE_DE_CREDIT' ? 'Note de crédit' : 'Facture'} ${numeroSerie} du ${fr(dateFacture)} · ${contrepartieNom}`.slice(0, 250);
}
function avertissementExerciceDeLaFacture(dateFacture, dateEcriture, exerciceDeLaFacture) {
    if (!exerciceDeLaFacture)
        return null;
    if (jour(dateEcriture) <= jour(exerciceDeLaFacture.dateFin))
        return null;
    return (`La facture est datée du ${fr(dateFacture)} et a été reçue le ${fr(dateEcriture)} · l’écriture est passée dans ` +
        'l’exercice de la réception (AUDCIF art. 16, al. 2). Si les biens ou services appartiennent à l’exercice ' +
        `clos le ${fr(exerciceDeLaFacture.dateFin)}, ils s’y constatent à la clôture par le compte 408 (factures non ` +
        'parvenues), contre-passé à l’ouverture.');
}
//# sourceMappingURL=date-reception.js.map