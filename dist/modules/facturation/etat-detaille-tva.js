"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.construireEtatDetaille = construireEtatDetaille;
const PERIODE = /^\d{4}-(0[1-9]|1[0-2])$/;
function construireEtatDetaille(periode, factures) {
    if (!PERIODE.test(periode)) {
        throw new Error(`Période « ${periode} » invalide · l’état détaillé accompagne une déclaration MENSUELLE (format AAAA-MM).`);
    }
    const lignes = [];
    const incompletudes = [];
    const facturesAnnulees = [];
    const [annee, mois] = periode.split('-').map(Number);
    const finExclue = Date.UTC(annee, mois, 1);
    const jour = (d) => d.toISOString().slice(0, 10);
    for (const f of factures) {
        if (f.annuleePar) {
            const dansLeMois = f.annuleePar.dateFacture.getTime() < finExclue;
            facturesAnnulees.push({
                numeroFacture: f.numeroSerie,
                dateFacture: jour(f.dateFacture),
                fournisseurNom: f.fournisseurNom,
                noteDeCredit: f.annuleePar.numeroSerie,
                dateNote: jour(f.annuleePar.dateFacture),
                montantHT: f.lignes.reduce((s, l) => s + l.prixHT, 0),
                tvaFacturee: f.lignes.reduce((s, l) => s + l.montantTva, 0),
                ecarteeDesTotaux: dansLeMois,
                motif: dansLeMois
                    ? `Barrée par la note de crédit « ${f.annuleePar.numeroSerie} » du ${jour(f.annuleePar.dateFacture)}, dans le mois · ` +
                        'elle n’ouvre aucune déduction pour cette période et sort des totaux (décret n° 011/42, art. 127).'
                    : `Barrée par la note de crédit « ${f.annuleePar.numeroSerie} » du ${jour(f.annuleePar.dateFacture)}, après le mois · ` +
                        'elle reste sur l’état, déductible quand la déclaration est partie ; la reprise se déclare au mois de la note ' +
                        '(décret n° 011/42, art. 127).',
            });
            if (dansLeMois)
                continue;
        }
        for (const l of f.lignes) {
            const montantTTC = l.prixHT + l.montantTva;
            lignes.push({
                fournisseurNom: f.fournisseurNom,
                fournisseurNumeroImpot: f.fournisseurNumeroImpot,
                numeroFacture: f.numeroSerie,
                dateFacture: f.dateFacture.toISOString().slice(0, 10),
                designation: l.designation,
                quantite: l.quantite,
                prixHT: l.prixHT,
                tvaFacturee: l.montantTva,
                montantTTC,
            });
            const manques = [];
            if (!f.fournisseurNumeroImpot || !f.fournisseurNumeroImpot.trim())
                manques.push('NUMERO_IMPOT_FOURNISSEUR');
            if (!f.fournisseurNom || !f.fournisseurNom.trim())
                manques.push('NOM_FOURNISSEUR');
            if (!l.designation || !l.designation.trim())
                manques.push('DESIGNATION');
            if (manques.length > 0) {
                incompletudes.push({ numeroFacture: f.numeroSerie, designation: l.designation, manques });
            }
        }
    }
    const totalHT = lignes.reduce((s, l) => s + l.prixHT, 0);
    const totalTva = lignes.reduce((s, l) => s + l.tvaFacturee, 0);
    return {
        periode,
        lignes,
        totalHT,
        totalTva,
        totalTTC: totalHT + totalTva,
        facturesAnnulees,
        incompletudes,
        complet: incompletudes.length === 0,
        voletImportations: {
            couvert: false,
            motif: 'Le second volet de l’art. 134 (importations) demande le numéro, la date et le montant de la déclaration de ' +
                'mise à la consommation ainsi que la valeur en douane. OmegaX ne tient aucune déclaration en douane : ces ' +
                'lignes sont à ajouter à la main sur l’imprimé de l’Administration. Et la lacune ne porte pas que sur ' +
                'l’IMPRIMÉ : le décret n° 23/10 du 3 mars 2023, art. 25, 2°, fait de cette même déclaration LE SUPPORT de la ' +
                'déduction en cas d’importation. Une TVA d’importation portée au compte 445 n’a donc, dans ce logiciel, ni sa ' +
                'pièce ni sa ligne d’état.',
        },
        source: 'O.-L. n° 10/001, art. 56 · décret n° 011/42, art. 134',
        consequenceDuDefaut: 'Le défaut de production de l’état détaillé entraîne la RÉINTÉGRATION D’OFFICE des déductions opérées, après ' +
            'mise en demeure non suivie de régularisation dans les cinq jours de sa réception (art. 56).',
    };
}
//# sourceMappingURL=etat-detaille-tva.js.map