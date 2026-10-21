"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.creditsQuiSortentUnBien = creditsQuiSortentUnBien;
exports.motifRefusLigneACreer = motifRefusLigneACreer;
exports.avertissementsLigneACreer = avertissementsLigneACreer;
exports.confirmationPremierJour = confirmationPremierJour;
const client_1 = require("@prisma/client");
const ecritures_de_situation_1 = require("../comptabilite/ecritures-de-situation");
const compte_du_bien_1 = require("./compte-du-bien");
const contrepartie_acquisition_1 = require("./contrepartie-acquisition");
const immobilisation_en_cours_1 = require("./immobilisation-en-cours");
function creditsQuiSortentUnBien(referentiel, numeroCompteDuBien, credits) {
    return [
        ...new Set(credits.filter((c) => c.startsWith('28') ||
            c.startsWith('29') ||
            c.startsWith('106') ||
            c.startsWith('154') ||
            ((0, compte_du_bien_1.estCompteDeBien)(referentiel, c) && !(0, contrepartie_acquisition_1.contrepartieAcquisitionAdmise)(referentiel, numeroCompteDuBien, c)))),
    ];
}
function motifRefusLigneACreer(l) {
    if (l.dejaRattacheeA)
        return `Cette ligne a déjà fait naître la fiche « ${l.dejaRattacheeA} » · une ligne, un bien.`;
    if (l.estANouveau) {
        return "Ligne d'à-nouveau · le bien est au bilan d'ouverture · créez sa fiche en bien repris (Nouvelle immobilisation, « Bien repris »), sans écriture.";
    }
    if (l.exerciceClos) {
        return "L'écriture est dans un exercice clôturé · le bien est au bilan d'ouverture de l'exercice ouvert · créez sa fiche en bien repris, sans écriture.";
    }
    if (l.statutEcriture === 'SITUATION')
        return (0, ecritures_de_situation_1.motifSimulationNonRattachable)('de cette ligne', "la naissance d'un bien");
    if (l.statutEcriture !== 'VALIDEE') {
        return "L'écriture est au brouillard · validez-la d'abord (AUDCIF art. 22, 2°), ou créez le bien par « Nouvelle immobilisation », qui passe son écriture.";
    }
    if (!(l.debit > 0))
        return 'Seule une ligne au débit fait entrer un bien.';
    if (!(0, compte_du_bien_1.estCompteDeBien)(l.referentiel, l.numeroCompte)) {
        return `Le ${l.numeroCompte} n'est pas un compte de bien (21 à 24${l.referentiel === client_1.Referentiel.SYCEBNL ? ', et 20' : ''}).`;
    }
    if ((0, immobilisation_en_cours_1.estCompteEnCours)(l.numeroCompte)) {
        return `Le ${l.numeroCompte} est un compte en cours · la fiche d'un bien en cours tient son compte définitif et son en-cours, qu'une ligne ne dit pas.`;
    }
    if (l.acquisitionDuModule)
        return `L'écriture est l'acquisition que le module a passée pour « ${l.acquisitionDuModule} ».`;
    if (l.autresModules.length > 0) {
        return `L'écriture est tenue par ${l.autresModules.join(', ')} · elle n'est pas une acquisition à reprendre.`;
    }
    if (l.corrigeeParLaPiece !== null) {
        return (`L'écriture a été inscrite en négatif par la pièce n° ${l.corrigeeParLaPiece} (AUDCIF art. 20, al. 2) · elle ne porte ` +
            "plus de bien. La ligne exacte est celle de la pièce passée à sa place.");
    }
    if (l.negatifSurUnCompteDeBien) {
        return ("La pièce inscrit en négatif une ligne d'un compte de bien · c'est une correction ou une réimputation, pas une " +
            "acquisition. Si elle déplace un bien entre deux comptes, inscrivez-la en négatif (Corriger), créez la fiche depuis la " +
            "ligne d'origine, puis reclassez le bien depuis sa fiche · le reclassement du module passe et retient son écriture.");
    }
    const sortants = creditsQuiSortentUnBien(l.referentiel, l.numeroCompte, l.credits);
    if (sortants.length > 0) {
        return (`La pièce crédite ${sortants.join(', ')} · un amortissement, une dépréciation, un écart de réévaluation ou un autre ` +
            "compte de bien ne sont pas la contrepartie d'une acquisition (fiches des comptes 21 à 24). C'est une reprise de bilan " +
            "d'ouverture (le bien se crée en bien repris, avec son amortissement antérieur, sans écriture), un reclassement ou une " +
            "réévaluation (passés par la fiche du bien, qui retient leur écriture).");
    }
    if (l.lignesDeBien > 1 && l.fondsAuCredit.length > 0) {
        return (`L'écriture porte ${l.lignesDeBien} biens et crédite un fonds (${l.fondsAuCredit.join(', ')}) · sa reprise ne se ` +
            'répartirait pas entre eux. Corrigez la pièce au journal en une pièce par bien (inscription en négatif puis ' +
            'écriture exacte, AUDCIF art. 20, al. 2), puis créez chaque fiche depuis sa pièce.');
    }
    return null;
}
function avertissementsLigneACreer(l) {
    const sortants = new Set(creditsQuiSortentUnBien(l.referentiel, l.numeroCompte, l.credits));
    const avertissements = [...new Set(l.credits)]
        .filter((c) => !sortants.has(c))
        .map((c) => (0, contrepartie_acquisition_1.motifRefusContrepartie)(l.referentiel, l.numeroCompte, c))
        .filter((m) => !!m);
    if (l.memeMontantEnNegatifAilleurs !== null) {
        avertissements.push(`La pièce n° ${l.memeMontantEnNegatifAilleurs} inscrit le même montant en négatif à ce compte · si elle réimpute ou ` +
            "corrige cette ligne, le bien ne naît pas d'elle.");
    }
    return avertissements;
}
function confirmationPremierJour(l) {
    if (!l.premierJourHorsAchats)
        return null;
    return (`La pièce est du premier jour de l'exercice, au journal ${l.premierJourHorsAchats} · s'il s'agit de la reprise du bilan ` +
        "d'ouverture, le bien est repris · créez sa fiche en bien repris (Nouvelle immobilisation, « Bien repris »), avec son " +
        "amortissement antérieur, sans écriture. Confirmez seulement une acquisition faite ce jour-là.");
}
//# sourceMappingURL=creation-depuis-ecritures.js.map