"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NATURES_PROPOSEES = exports.LIBELLES_NATURE_PIECE = exports.LIBELLES_OPERATION = exports.LIBELLES_SENS = exports.RACINE_585 = exports.COMPTE_DU_PLAN_585 = exports.COMPTES_DE_PASSAGE = exports.RACINES_TRESORERIE_EN_DEVISES = void 0;
exports.estUneCaisse = estUneCaisse;
exports.estTresorerieEnDevises = estTresorerieEnDevises;
exports.estAuCentime = estAuCentime;
exports.sensDuVirement = sensDuVirement;
exports.caisseEnJeu = caisseEnJeu;
exports.deLOperation = deLOperation;
exports.aLOperation = aLOperation;
exports.naturesProposees = naturesProposees;
exports.estUnJour = estUnJour;
exports.estNaturePiece = estNaturePiece;
exports.pieceJugee = pieceJugee;
exports.motifRefusVirement = motifRefusVirement;
exports.lignesDuVirement = lignesDuVirement;
const client_1 = require("@prisma/client");
function estUneCaisse(numeroCompte) {
    return numeroCompte.startsWith('57');
}
exports.RACINES_TRESORERIE_EN_DEVISES = {
    SYSCOHADA: ['5215', '5712', '5722', '5732'],
    SYCEBNL: ['5215', '572'],
};
function estTresorerieEnDevises(numeroCompte, referentiel) {
    return exports.RACINES_TRESORERIE_EN_DEVISES[referentiel].some((r) => numeroCompte.startsWith(r));
}
function estAuCentime(montant) {
    return Math.round(montant * 100) / 100 === montant;
}
function sensDuVirement(numeroOrigine, numeroDestination) {
    const o = estUneCaisse(numeroOrigine) ? 'CAISSE' : 'BANQUE';
    const d = estUneCaisse(numeroDestination) ? 'CAISSE' : 'BANQUE';
    return `${o}_${d}`;
}
function caisseEnJeu(sens) {
    return sens !== client_1.SensVirementFonds.BANQUE_BANQUE;
}
exports.COMPTES_DE_PASSAGE = {
    BANQUE_BANQUE: { rang: 1, intitule: 'Virements de fonds · banque vers banque' },
    BANQUE_CAISSE: { rang: 2, intitule: 'Virements de fonds · banque vers caisse' },
    CAISSE_BANQUE: { rang: 3, intitule: 'Virements de fonds · caisse vers banque' },
    CAISSE_CAISSE: { rang: 4, intitule: 'Virements de fonds · caisse vers caisse' },
};
exports.COMPTE_DU_PLAN_585 = '58500000';
exports.RACINE_585 = '585';
exports.LIBELLES_SENS = {
    BANQUE_BANQUE: 'banque vers banque',
    BANQUE_CAISSE: 'banque vers caisse',
    CAISSE_BANQUE: 'caisse vers banque',
    CAISSE_CAISSE: 'caisse vers caisse',
};
exports.LIBELLES_OPERATION = {
    SORTIE: 'sortie des fonds',
    ENTREE: 'entrée des fonds',
};
function deLOperation(operation) {
    return operation === client_1.OperationVirementFonds.SORTIE ? 'de la sortie des fonds' : "de l'entrée des fonds";
}
function aLOperation(operation) {
    return operation === client_1.OperationVirementFonds.SORTIE ? 'à la sortie des fonds' : "à l'entrée des fonds";
}
exports.LIBELLES_NATURE_PIECE = {
    BORDEREAU_VERSEMENT: 'Bordereau de versement',
    CHEQUE: 'Chèque',
    ORDRE_VIREMENT: 'Ordre de virement',
    AVIS_DEBIT_CREDIT: 'Avis de débit ou de crédit',
    BON_CAISSE: 'Bon de caisse',
    AUTRE: 'Autre pièce',
    BON_SORTIE_CAISSE: 'Bon de sortie de caisse',
    BON_ENTREE_CAISSE: "Bon d'entrée de caisse",
    AVIS_DEBIT: 'Avis de débit',
    AVIS_CREDIT: 'Avis de crédit',
    EXTRAIT_COMPTE: 'Extrait de compte',
    BORDEREAU_REMISE_CHEQUE: 'Bordereau de remise de chèque',
};
exports.NATURES_PROPOSEES = {
    CAISSE: {
        SORTIE: [client_1.NaturePieceVirement.BON_SORTIE_CAISSE, client_1.NaturePieceVirement.AUTRE],
        ENTREE: [client_1.NaturePieceVirement.BON_ENTREE_CAISSE, client_1.NaturePieceVirement.AUTRE],
    },
    BANQUE: {
        SORTIE: [
            client_1.NaturePieceVirement.ORDRE_VIREMENT,
            client_1.NaturePieceVirement.CHEQUE,
            client_1.NaturePieceVirement.AVIS_DEBIT,
            client_1.NaturePieceVirement.EXTRAIT_COMPTE,
            client_1.NaturePieceVirement.AUTRE,
        ],
        ENTREE: [
            client_1.NaturePieceVirement.BORDEREAU_VERSEMENT,
            client_1.NaturePieceVirement.BORDEREAU_REMISE_CHEQUE,
            client_1.NaturePieceVirement.AVIS_CREDIT,
            client_1.NaturePieceVirement.EXTRAIT_COMPTE,
            client_1.NaturePieceVirement.AUTRE,
        ],
    },
};
function naturesProposees(sens, operation) {
    const [origine, destination] = sens.split('_');
    return exports.NATURES_PROPOSEES[operation === client_1.OperationVirementFonds.SORTIE ? origine : destination][operation];
}
const CHAMPS_PIECE = ['nature', 'reference', 'date'];
const JOUR = /^\d{4}-\d{2}-\d{2}$/;
function estUnJour(texte) {
    if (!JOUR.test(texte))
        return false;
    const d = new Date(`${texte}T00:00:00.000Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === texte;
}
const NATURES_ADMISES = Object.values(client_1.NaturePieceVirement);
function estNaturePiece(v) {
    return NATURES_ADMISES.includes(v);
}
function pieceJugee(p) {
    if (!estNaturePiece(p.nature) || typeof p.reference !== 'string' || typeof p.date !== 'string')
        return null;
    const reference = p.reference.trim();
    if (!reference || reference.length > 100 || !estUnJour(p.date))
        return null;
    return { nature: p.nature, reference, date: p.date };
}
function motifRefusVirement(origine, destination, demande) {
    if (!origine || !destination)
        return 'Journal introuvable pour ce dossier.';
    for (const j of [origine, destination]) {
        if (j.type !== 'TRESORERIE') {
            return `Le journal ${j.code} n'est pas un journal de banque ou de caisse · un virement de fonds va d'un journal de trésorerie à un autre.`;
        }
        if (!j.estActif)
            return `Le journal ${j.code} est en sommeil · réactivez-le avant d'y passer un virement.`;
        if (!j.compteTresorerie)
            return `Le journal ${j.code} n'a pas de compte de trésorerie · rattachez-lui son compte dans Journaux.`;
    }
    if (origine.id === destination.id)
        return 'Le journal d’origine et le journal de destination sont le même · un virement va d’une trésorerie à une autre.';
    if (origine.compteTresorerie.id === destination.compteTresorerie.id) {
        return `Les deux journaux portent le même compte ${origine.compteTresorerie.numero} · un virement entre eux ne déplacerait rien.`;
    }
    if (!Number.isFinite(demande.montant) || demande.montant <= 0)
        return 'Le montant du virement doit être positif.';
    if (!estAuCentime(demande.montant))
        return 'Le montant se saisit au centime près.';
    if (!demande.objet.trim())
        return "L'objet du virement est exigé · il dit pourquoi les fonds changent de place.";
    for (const [piece, operation] of [
        [demande.sortie, client_1.OperationVirementFonds.SORTIE],
        [demande.entree, client_1.OperationVirementFonds.ENTREE],
    ]) {
        const deTrop = Object.keys(piece).filter((cle) => !CHAMPS_PIECE.includes(cle));
        if (deTrop.length) {
            return `La pièce ${deLOperation(operation)} ne porte que sa nature, sa référence et sa date · ${deTrop.join(', ')} n'y est pas admis.`;
        }
        if (!estNaturePiece(piece.nature))
            return `Choisissez la nature de la pièce ${deLOperation(operation)}.`;
        if (typeof piece.reference !== 'string' || !piece.reference.trim()) {
            return `La référence de la pièce ${deLOperation(operation)} est exigée · chaque écriture porte les références de la pièce qui l’appuie (AUDCIF art. 17, 5°).`;
        }
        if (piece.reference.trim().length > 100)
            return `La référence de la pièce ${deLOperation(operation)} se saisit en 100 caractères au plus.`;
        if (typeof piece.date !== 'string' || !estUnJour(piece.date))
            return `La date de la pièce ${deLOperation(operation)} se donne au jour (AAAA-MM-JJ).`;
    }
    const sortie = pieceJugee(demande.sortie);
    const entree = pieceJugee(demande.entree);
    if (entree.date < sortie.date) {
        return "L'entrée des fonds est datée avant leur sortie · chaque écriture prend la date de sa pièce (AUDCIF art. 16, al. 2), et les fonds n'arrivent pas avant d'être partis.";
    }
    const sens = sensDuVirement(origine.compteTresorerie.numero, destination.compteTresorerie.numero);
    for (const [piece, operation] of [
        [sortie, client_1.OperationVirementFonds.SORTIE],
        [entree, client_1.OperationVirementFonds.ENTREE],
    ]) {
        const admises = naturesProposees(sens, operation);
        if (!admises.includes(piece.nature)) {
            const tresorerie = (operation === client_1.OperationVirementFonds.SORTIE ? sens.split('_')[0] : sens.split('_')[1]) === 'CAISSE' ? 'caisse' : 'banque';
            return `La pièce ${deLOperation(operation)} d'une ${tresorerie} se choisit parmi · ${admises.map((n) => exports.LIBELLES_NATURE_PIECE[n]).join(', ')}.`;
        }
    }
    if (caisseEnJeu(sens) && !(demande.porteur ?? '').trim()) {
        return 'Une caisse est en jeu · nommez la personne qui a déposé ou retiré les espèces (porteur).';
    }
    return null;
}
function lignesDuVirement(entree) {
    const { compteOrigineId, compteDestinationId, comptePassageId, montant, libelle } = entree;
    return {
        origine: [
            { compteId: comptePassageId, debit: montant, credit: 0, libelle },
            { compteId: compteOrigineId, debit: 0, credit: montant, libelle },
        ],
        destination: [
            { compteId: compteDestinationId, debit: montant, credit: 0, libelle },
            { compteId: comptePassageId, debit: 0, credit: montant, libelle },
        ],
    };
}
//# sourceMappingURL=virement-fonds.js.map