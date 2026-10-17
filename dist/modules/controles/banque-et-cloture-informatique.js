"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ENTREE_EN_VIGUEUR_SYCEBNL = exports.ENTREE_EN_VIGUEUR_AUDCIF_2017 = void 0;
exports.texteEnVigueurPourLExercice = texteEnVigueurPourLExercice;
exports.estCompteBancaireARapprocher = estCompteBancaireARapprocher;
exports.sourceFicheCompte52 = sourceFicheCompte52;
exports.sourceClotureInformatique = sourceClotureInformatique;
exports.compteFermeCouvert = compteFermeCouvert;
exports.releveCouvreLaCloture = releveCouvreLaCloture;
exports.comptesBancairesSansRapprochement = comptesBancairesSansRapprochement;
exports.finDeTroisMois = finDeTroisMois;
exports.periodeOuverte = periodeOuverte;
exports.dernierJourFige = dernierJourFige;
exports.premiereEcheanceDepassee = premiereEcheanceDepassee;
exports.journauxEnRetardDeClotureInformatique = journauxEnRetardDeClotureInformatique;
exports.estCompteDeVirementInterne = estCompteDeVirementInterne;
exports.sourceFicheCompte58 = sourceFicheCompte58;
exports.virementsInternesNonSoldes = virementsInternesNonSoldes;
const client_1 = require("@prisma/client");
const ajouter_mois_1 = require("../../common/ajouter-mois");
const echeance_1 = require("../../common/echeance");
exports.ENTREE_EN_VIGUEUR_AUDCIF_2017 = new Date('2018-01-01T00:00:00.000Z');
exports.ENTREE_EN_VIGUEUR_SYCEBNL = new Date('2024-01-01T00:00:00.000Z');
function texteEnVigueurPourLExercice(referentiel, dateDebut) {
    const borne = referentiel === client_1.Referentiel.SYCEBNL ? exports.ENTREE_EN_VIGUEUR_SYCEBNL : exports.ENTREE_EN_VIGUEUR_AUDCIF_2017;
    return (0, echeance_1.jourUtc)(dateDebut).getTime() >= borne.getTime();
}
function estCompteBancaireARapprocher(numero) {
    return numero.startsWith('52') && !numero.startsWith('526');
}
function sourceFicheCompte52(referentiel) {
    return referentiel === client_1.Referentiel.SYCEBNL
        ? "SYCEBNL, Partie 2 ch. 3, compte 52 ; AUDCIF art. 42, que l'art. 3 de l'Acte uniforme SYCEBNL n'exclut pas"
        : 'AUDCIF, Titre VII, compte 52 ; AUDCIF art. 42';
}
function sourceClotureInformatique(referentiel) {
    return referentiel === client_1.Referentiel.SYCEBNL
        ? "AUDCIF art. 22, 3°, que l'art. 3 de l'Acte uniforme SYCEBNL n'exclut pas"
        : 'AUDCIF art. 22, 3°';
}
const iso = (d) => d.toISOString().slice(0, 10);
const veille = (d) => new Date((0, echeance_1.jourUtc)(d).getTime() - 86_400_000);
const lendemain = (d) => new Date((0, echeance_1.jourUtc)(d).getTime() + 86_400_000);
const estNul = (montant) => Math.abs(montant) < 0.005;
function compteFermeCouvert(c, etat) {
    return (etat.dernierClos !== null &&
        etat.soldeDernierClos !== null &&
        estNul(etat.soldeDernierClos) &&
        (c.derniereLigne === null || (0, echeance_1.jourUtc)(etat.dernierClos).getTime() >= (0, echeance_1.jourUtc)(c.derniereLigne).getTime()) &&
        estNul(c.soldeCloture));
}
function releveCouvreLaCloture(etat, dateFin) {
    return etat.dernierClos !== null && (0, echeance_1.jourUtc)(etat.dernierClos).getTime() >= (0, echeance_1.jourUtc)(dateFin).getTime();
}
function comptesBancairesSansRapprochement(comptes, etats, dateFin, aujourdhui) {
    if (!(0, echeance_1.echeanceDepassee)(dateFin, aujourdhui))
        return [];
    const sans = [];
    for (const c of comptes) {
        if (!estCompteBancaireARapprocher(c.numero))
            continue;
        const etat = etats.get(c.compteId) ?? { dernierClos: null, soldeDernierClos: null, enCours: null };
        if (releveCouvreLaCloture(etat, dateFin) || compteFermeCouvert(c, etat))
            continue;
        const morceaux = [
            etat.dernierClos !== null
                ? `dernier rapprochement clos au relevé du ${iso(etat.dernierClos)}`
                : 'aucun rapprochement clos',
        ];
        if (etat.enCours !== null)
            morceaux.push(`rapprochement en cours au relevé du ${iso(etat.enCours)}, non clos`);
        sans.push({
            reference: `${c.numero} ${c.intitule}`,
            detail: morceaux.join(' · '),
            ...(etat.dernierClos !== null ? { date: iso(etat.dernierClos) } : {}),
        });
    }
    return sans;
}
function finDeTroisMois(debut) {
    const cible = (0, ajouter_mois_1.ajouterMois)((0, echeance_1.jourUtc)(debut), 3);
    return cible.getUTCDate() !== (0, echeance_1.jourUtc)(debut).getUTCDate() ? cible : veille(cible);
}
function periodeOuverte(dernierJourFige, dateDebut, dateFin) {
    const debutExercice = (0, echeance_1.jourUtc)(dateDebut);
    const finExercice = (0, echeance_1.jourUtc)(dateFin);
    const debut = dernierJourFige !== null && (0, echeance_1.jourUtc)(dernierJourFige).getTime() >= debutExercice.getTime()
        ? lendemain(dernierJourFige)
        : debutExercice;
    if (debut.getTime() > finExercice.getTime())
        return null;
    const finTroisMois = finDeTroisMois(debut);
    const finAuPlusTard = finTroisMois.getTime() < finExercice.getTime() ? finTroisMois : finExercice;
    const echeance = finDeTroisMois(lendemain(finAuPlusTard));
    return { debut, finAuPlusTard, echeance };
}
function dernierJourFige(journalId, clotures) {
    let dernier = null;
    for (const c of clotures) {
        const vise = c.granularite === client_1.GranulariteCloture.PERIODE ||
            (c.granularite === client_1.GranulariteCloture.TOTALE && c.journalId === journalId);
        if (!vise)
            continue;
        if (dernier === null || c.dateLimite.getTime() > dernier.getTime())
            dernier = c.dateLimite;
    }
    return dernier;
}
function premiereEcheanceDepassee(dateDebut, dateFin, aujourdhui) {
    const p = periodeOuverte(null, dateDebut, dateFin);
    return p !== null && (0, echeance_1.echeanceDepassee)(p.echeance, aujourdhui);
}
function journauxEnRetardDeClotureInformatique(journaux, clotures, dateDebut, dateFin, aujourdhui) {
    const enRetard = [];
    for (const j of [...journaux].sort((a, b) => a.code.localeCompare(b.code))) {
        const fige = dernierJourFige(j.journalId, clotures);
        const p = periodeOuverte(fige, dateDebut, dateFin);
        if (p === null || !(0, echeance_1.echeanceDepassee)(p.echeance, aujourdhui))
            continue;
        enRetard.push({
            reference: `Journal ${j.code}`,
            detail: (fige !== null && (0, echeance_1.jourUtc)(fige).getTime() >= (0, echeance_1.jourUtc)(dateDebut).getTime()
                ? `figé dans OmegaX jusqu'au ${iso(fige)}`
                : "aucune clôture de période ni totale posée dans OmegaX pour l'exercice") +
                ` · période ouverte depuis le ${iso(p.debut)}, à clôturer au plus tard le ${iso(p.echeance)}`,
            date: iso(p.echeance),
        });
    }
    return enRetard;
}
function estCompteDeVirementInterne(numero) {
    return numero.startsWith('585') || numero.startsWith('588');
}
function sourceFicheCompte58(referentiel) {
    return referentiel === client_1.Referentiel.SYCEBNL ? 'SYCEBNL, Partie 2 ch. 3, compte 58' : 'AUDCIF, Titre VII, compte 58';
}
const enFrancs = (centimes) => (Math.abs(centimes) / 100).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const decrireSolde = (centimes) => centimes === 0 ? 'nul' : `${centimes > 0 ? 'débiteur' : 'créditeur'} de ${enFrancs(centimes)}`;
function virementsInternesNonSoldes(comptes, dateFin, aujourdhui) {
    if (!(0, echeance_1.echeanceDepassee)(dateFin, aujourdhui))
        return [];
    return comptes
        .filter((c) => estCompteDeVirementInterne(c.numero))
        .filter((c) => c.soldeLivreJournalCentimes !== 0 || c.soldeToutesLignesCentimes !== 0)
        .sort((a, b) => a.numero.localeCompare(b.numero))
        .map((c) => {
        const lj = c.soldeLivreJournalCentimes;
        const tout = c.soldeToutesLignesCentimes;
        let detail = `solde ${decrireSolde(lj)} au livre-journal au ${iso(dateFin)}`;
        if (tout !== lj) {
            detail +=
                tout === 0
                    ? ' · nul en comptant le brouillard, la pièce qui le solde reste à valider'
                    : ` · ${decrireSolde(tout)} en comptant le brouillard et l'à-nouveau provisoire`;
        }
        return { reference: `${c.numero} ${c.intitule}`, detail, montant: lj / 100 };
    });
}
//# sourceMappingURL=banque-et-cloture-informatique.js.map