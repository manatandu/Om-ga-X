"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NATURES_ANNULABLES = void 0;
exports.actesQuiEnDependent = actesQuiEnDependent;
exports.motifRefusAnnulation = motifRefusAnnulation;
exports.motifRefusMotifAnnulation = motifRefusMotifAnnulation;
exports.rendreEcartImpute = rendreEcartImpute;
exports.etatDuPlanApres = etatDuPlanApres;
exports.valeurResiduelleAvant = valeurResiduelleAvant;
exports.NATURES_ANNULABLES = [
    'DOTATION',
    'DEPRECIATION',
    'REVISION_PLAN',
    'DEROGATOIRE',
    'REEVALUATION',
    'REPRISE_SUBVENTION',
    'REPRISE_PROVISION_REEVALUATION',
];
const DEPENDANTS = {
    DOTATION: {
        DOTATION: { strict: false },
        DEPRECIATION: { strict: false },
        REVISION_PLAN: { strict: true },
        DEROGATOIRE: { strict: false },
        DEROGATOIRE_SOLDE: { strict: false },
        REEVALUATION: { strict: false },
        REPRISE_SUBVENTION: { strict: false },
        REPRISE_PROVISION_REEVALUATION: { strict: false },
        SORTIE: { strict: false },
        RECLASSEMENT: { strict: false },
        REMPLACEMENT_IMPREVU: { strict: false },
    },
    DEPRECIATION: {
        DOTATION: { strict: true },
        DEPRECIATION: { strict: false },
        REVISION_PLAN: { strict: true },
        DEROGATOIRE: { strict: true },
        REEVALUATION: { strict: false },
        REPRISE_SUBVENTION: { strict: false },
        SORTIE: { strict: false },
        RECLASSEMENT: { strict: false },
        TRANSFERT_DEPRECIATION: { strict: false },
        REMPLACEMENT_IMPREVU: { strict: false },
    },
    REVISION_PLAN: {
        DOTATION: { strict: false },
        DEPRECIATION: { strict: false },
        REVISION_PLAN: { strict: false },
        DEROGATOIRE: { strict: false },
        REEVALUATION: { strict: false },
        REPRISE_SUBVENTION: { strict: false },
        REPRISE_PROVISION_REEVALUATION: { strict: false },
        SORTIE: { strict: false },
        RECLASSEMENT: { strict: false },
        REMPLACEMENT_IMPREVU: { strict: false },
    },
    DEROGATOIRE: {
        DEROGATOIRE: { strict: false },
        DEROGATOIRE_SOLDE: { strict: false },
        REPRISE_SUBVENTION: { strict: false },
        SORTIE: { strict: false },
    },
    REEVALUATION: {
        DOTATION: { strict: true },
        DEPRECIATION: { strict: false },
        REVISION_PLAN: { strict: false },
        REEVALUATION: { strict: false },
        REPRISE_SUBVENTION: { strict: false },
        REPRISE_PROVISION_REEVALUATION: { strict: true },
        SORTIE: { strict: false },
        RECLASSEMENT: { strict: false },
        REMPLACEMENT_IMPREVU: { strict: false },
    },
    REPRISE_SUBVENTION: {
        REPRISE_SUBVENTION: { strict: false },
        REDUCTION_SUBVENTION: { strict: false },
        SORTIE: { strict: false },
    },
    REPRISE_PROVISION_REEVALUATION: {
        REPRISE_PROVISION_REEVALUATION: { strict: false },
        SORTIE: { strict: false },
    },
};
const DEPENDANTS_SOLDE_DEROGATOIRE = {
    DEROGATOIRE: { strict: false },
    DEROGATOIRE_SOLDE: { strict: false },
    SORTIE: { strict: false },
};
function estPosterieur(a, b, strict) {
    const fa = a.exerciceFin.getTime();
    const fb = b.exerciceFin.getTime();
    if (fb > fa)
        return true;
    if (strict)
        return false;
    return fb === fa && b.creeLe.getTime() > a.creeLe.getTime();
}
function actesQuiEnDependent(cible, actes) {
    const nature = cible.nature;
    const table = cible.soldeDerogatoire ? DEPENDANTS_SOLDE_DEROGATOIRE : DEPENDANTS[nature];
    if (!table)
        return [];
    return actes.filter((b) => {
        if (b.id === cible.id && b.nature === cible.nature)
            return false;
        const regle = table[b.nature];
        if (!regle)
            return false;
        if (b.nature === 'SORTIE')
            return !(cible.nature === 'REPRISE_SUBVENTION' && cible.repriseALaSortie);
        return estPosterieur(cible, b, regle.strict);
    });
}
const NON_ANNULABLES = new Set(['SORTIE', 'RECLASSEMENT', 'TRANSFERT_DEPRECIATION', 'REMPLACEMENT_IMPREVU', 'REDUCTION_SUBVENTION']);
function motifRefusAnnulation(entree) {
    if (entree.exerciceClos) {
        return ("L'exercice de ce traitement est clôturé · son erreur ne se corrige plus par inscription en négatif, qui ne vaut que " +
            "pour l'erreur « commise et découverte sur l'exercice en cours » (AUDCIF art. 20, al. 2). Significative, elle se " +
            'corrige par ajustement du report à nouveau (al. 3) ; dans tous les cas, elle fait l’objet d’une information dans les ' +
            'Notes annexes (al. 4).');
    }
    if (entree.transfertMiseEnService) {
        return ('Ce mouvement transfère la dépréciation du bien en cours à son compte définitif, à la mise en service · il fait partie ' +
            'de ce geste et ne s’annule pas seul.');
    }
    if (entree.revisionDeReevaluation) {
        return ('Cette révision a été posée par la réévaluation libre (méthode 2, AUDCIF Titre VIII ch. 28 § 4.3.2) · elle s’annule ' +
            'avec la réévaluation, jamais seule.');
    }
    if (entree.dependants.length > 0) {
        const premier = [...entree.dependants].sort((a, b) => b.exerciceFin.getTime() - a.exerciceFin.getTime() || b.creeLe.getTime() - a.creeLe.getTime())[0];
        const liste = entree.dependants
            .slice(0, 5)
            .map((a) => `${a.libelle}${a.bien ? ` (${a.bien})` : ''}`)
            .join(' ; ');
        const reste = entree.dependants.length > 5 ? ` et ${entree.dependants.length - 5} autre(s)` : '';
        const bloquants = entree.dependants.filter((a) => NON_ANNULABLES.has(a.nature));
        const issue = bloquants.length > 0
            ? ` ${bloquants.map((a) => a.libelle).join(' ; ')} ne s’annule pas dans OmegaX · la correction passe alors par une ` +
                'écriture en négatif saisie par le cabinet, avec son motif (AUDCIF art. 20, al. 2).'
            : ` Annulez d’abord le plus récent (${premier.libelle}${premier.bien ? `, ${premier.bien}` : ''}), puis celui-ci.`;
        return (`Un traitement postérieur a lu le résultat de celui-ci · ${liste}${reste}. L’annuler seul laisserait ces actes ` +
            `calculés sur un montant que le journal ne porte plus, sans qu’aucun total ne le signale.${issue}`);
    }
    return null;
}
function motifRefusMotifAnnulation(motif) {
    const m = (motif ?? '').trim();
    if (m.length < 3)
        return "Indiquez le motif de l'annulation (trois caractères au moins) · il est gardé avec l'acte et au journal d'audit.";
    if (m.length > 500)
        return "Le motif de l'annulation ne dépasse pas cinq cents caractères.";
    return null;
}
function rendreEcartImpute(lignes, montant) {
    let reste = Math.round(montant * 100);
    const rendu = [];
    for (const l of [...lignes].reverse()) {
        if (reste <= 0)
            break;
        const dispo = Math.round(l.ecartImpute * 100);
        if (dispo <= 0)
            continue;
        const pris = Math.min(dispo, reste);
        rendu.push({ id: l.id, montant: pris / 100 });
        reste -= pris;
    }
    return reste === 0 ? rendu : null;
}
function etatDuPlanApres(revisionsRestantes) {
    const derniere = [...revisionsRestantes].sort((a, b) => b.creeLe.getTime() - a.creeLe.getTime())[0];
    if (!derniere || derniere.nature === 'RETROACTIVE')
        return { dateEffetRevisionPlan: null, dureeResiduelleRevisee: null };
    return { dateEffetRevisionPlan: derniere.ouvertureSuivante ?? derniere.ouvertureExercice, dureeResiduelleRevisee: derniere.dureeApresAns };
}
function valeurResiduelleAvant(gardee, actuelle) {
    if (gardee !== null)
        return gardee;
    return Math.abs(actuelle) < 0.005 ? 0 : null;
}
//# sourceMappingURL=annulation-traitement.js.map