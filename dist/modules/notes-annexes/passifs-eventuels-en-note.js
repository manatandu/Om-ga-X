"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TABLEAU_PASSIFS_EVENTUELS = void 0;
exports.notePassifsEventuelsDuDossier = notePassifsEventuelsDuDossier;
exports.lignesPassifsEventuels = lignesPassifsEventuels;
const client_1 = require("@prisma/client");
exports.TABLEAU_PASSIFS_EVENTUELS = {
    [client_1.JeuNotesAnnexes.SYSCOHADA_SYSTEME_NORMAL]: { code: '16C', sousTableau: 'PASSIF ÉVENTUEL' },
    [client_1.JeuNotesAnnexes.ASSOCIATIONS_ORDRES_PROFESSIONNELS]: { code: '18B' },
    [client_1.JeuNotesAnnexes.PROJETS_DEVELOPPEMENT]: null,
};
function notePassifsEventuelsDuDossier(dossier) {
    if (dossier.referentiel === client_1.Referentiel.SYSCOHADA) {
        return dossier.systemeComptableSyscohada === client_1.SystemeComptableSyscohada.MINIMAL_TRESORERIE
            ? null
            : 'NOTE 16C « Actifs et passifs éventuels »';
    }
    return dossier.jeuEtatsFinanciersSycebnl === client_1.JeuEtatsFinanciersSycebnl.ASSOCIATIONS_ORDRES_PROFESSIONNELS
        ? 'NOTE 18B « Actifs et passifs éventuels »'
        : null;
}
function lignesPassifsEventuels(registre, nombreDeColonnes) {
    return registre
        .filter((p) => p.statut === client_1.StatutProvision.PASSIF_EVENTUEL)
        .map((p) => {
        const elements = [
            p.incertitudes ? `Incertitudes : ${p.incertitudes}` : null,
            p.echeanceAttendue
                ? `Échéance attendue : ${p.echeanceAttendue.toLocaleDateString('fr-FR', { timeZone: 'UTC' })}`
                : 'Échéance attendue : non renseignée',
            p.remboursementAttendu !== null && p.remboursementAttendu !== undefined
                ? `Remboursement attendu : ${Number(p.remboursementAttendu).toFixed(2)}` +
                    `${p.remboursementTiers ? ` (${p.remboursementTiers})` : ''}` +
                    `${p.remboursementCertain ? ', certain' : ', non certain'}`
                : null,
            p.motifNonComptabilisation ? `Non comptabilisé : ${p.motifNonComptabilisation}` : null,
        ].filter((e) => e !== null);
        const saisie = Array.from({ length: nombreDeColonnes }, () => null);
        saisie[0] = elements.join(' · ');
        return {
            libelle: `Passif éventuel · ${p.objet} (registre des provisions)`,
            montantN: 0,
            estTotal: false,
            comptes: [],
            saisie,
            saisieVerrouillee: true,
        };
    });
}
//# sourceMappingURL=passifs-eventuels-en-note.js.map