"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CHAMPS_A_EFFET = exports.CHAMPS_LIBRES = void 0;
exports.champsAEffetDemandes = champsAEffetDemandes;
exports.libelleUsage = libelleUsage;
exports.exerciceClosQuiPorteLaFiche = exerciceClosQuiPorteLaFiche;
exports.motifRefusModificationAEffet = motifRefusModificationAEffet;
exports.motifRefusSuppression = motifRefusSuppression;
exports.propositionDeDuplication = propositionDeDuplication;
exports.CHAMPS_LIBRES = ['designation', 'numeroInventaire', 'natureFiscaleCle'];
exports.CHAMPS_A_EFFET = [
    'compteImmobilisationId',
    'compteContrepartieId',
    'dateAcquisition',
    'dateMiseEnService',
    'valeurOrigine',
    'valeurResiduelle',
    'dureeAmortissementAns',
    'modeAmortissement',
    'unitesOeuvrePrevues',
    'uniteOeuvreLibelle',
    'amortissementAnterieur',
];
function champsAEffetDemandes(dto) {
    return exports.CHAMPS_A_EFFET.filter((c) => dto[c] !== undefined);
}
const LIBELLES_USAGES = {
    'DotationAmortissement.immobilisationId': 'dotations',
    'DepreciationImmobilisation.immobilisationId': 'dépréciations',
    'RevisionPlanAmortissement.immobilisationId': 'révisions du plan',
    'AmortissementDerogatoire.immobilisationId': 'amortissements dérogatoires',
    'LigneReevaluationBilan.immobilisationId': 'réévaluations',
    'RepriseSubventionImmobilisation.immobilisationId': 'reprises de subvention',
    'SubventionImmobilisation.immobilisationId': 'subventions rattachées',
    'ConsommationUniteOeuvre.immobilisationId': "relevés d'unités d'œuvre",
    'CoutEmpruntIncorpore.immobilisationId': "coûts d'emprunt incorporés",
    'MouvementDemantelement.immobilisationId': 'mouvements du démantèlement',
    'ReclassementImmobilisation.immobilisationId': 'reclassements',
    'FicheInventaire.immobilisationId': "fiches d'inventaire",
    'ContratLocationAcquisition.immobilisationId': 'contrat de location-acquisition',
    'Immobilisation.immobilisationPrincipaleId': 'composants rattachés',
    'Immobilisation.composantRemplaceId': 'composant qui le remplace',
    'AnnulationTraitementImmobilisation.immobilisationId': 'annulations de traitements',
};
function libelleUsage(u) {
    return `${LIBELLES_USAGES[`${u.modele}.${u.champ}`] ?? u.modele} (${u.nombre})`;
}
function exerciceClosQuiPorteLaFiche(p) {
    const creee = p.ficheCreeeLe.getTime();
    for (const e of p.clos) {
        if (e.clotures.some((h) => h.getTime() > creee))
            return e.dateFin;
        if (e.clotures.length === 0 && (p.debutDuJournal === null || p.debutDuJournal.getTime() > creee))
            return e.dateFin;
    }
    return null;
}
function motifExerciceClosQuiLaPorte(cloture, geste) {
    return geste === 'modifier'
        ? `L’exercice clos le ${cloture} a porté ce bien à ses états (note des immobilisations, livre d’inventaire, AUDCIF ` +
            'art. 19) · valeur, compte, dates et plan ne se modifient plus depuis la fiche ; une erreur d’un exercice clos se ' +
            'corrige dans l’exercice en cours (AUDCIF art. 20, al. 3 et 4). Le compte se change par un reclassement, la durée ' +
            'et le mode par une révision du plan.'
        : `L’exercice clos le ${cloture} a porté ce bien à ses états (note des immobilisations, livre d’inventaire, AUDCIF ` +
            'art. 19) · la fiche ne se supprime plus. Un bien qui n’existe plus se sort (mise au rebut, destruction, vol).';
}
function motifRefusModificationAEffet(e) {
    if (e.sortie) {
        return 'Le bien est sorti · sa fiche ne se modifie plus que pour sa désignation, son numéro d’inventaire et sa nature.';
    }
    if (e.autresEcritures.length > 0) {
        return (`La fiche porte déjà ${e.autresEcritures.join(', ')} · valeur, compte, dates et plan ne se modifient plus depuis la ` +
            'fiche (AUDCIF art. 22, 2°). Le compte se change par un reclassement, la durée et le mode par une révision du plan.');
    }
    if (e.neeDUneEcriturePassee) {
        const issue = e.usages.length > 0 || e.annulationsRetenant > 0 || e.acquisition?.exerciceClos || e.exerciceClosQuiLaPorte
            ? 'La durée et le mode se changent par une révision du plan, le compte par un reclassement.'
            : 'Pour un autre plan, retirez la fiche (l’écriture reste au journal) et recréez-la depuis la même ligne ; ' +
                'une mise en service différée se pose par « Mettre en service ».';
        return (`La fiche est née d’une écriture déjà passée au journal (pièce n° ${e.acquisition?.numeroPiece ?? '·'}) · valeur, compte ` +
            `et date d’acquisition sont ceux de sa ligne, la fiche ne les retouche pas. ${issue}`);
    }
    if (e.acquisition?.validee) {
        return (`L’écriture d’acquisition (pièce n° ${e.acquisition.numeroPiece ?? '·'}) est validée · valeur, compte, dates et plan ne ` +
            'se retouchent plus depuis la fiche (AUDCIF art. 22, 2°). Le compte se change par un reclassement, la durée et le mode ' +
            'par une révision du plan.');
    }
    if (e.acquisition?.exerciceClos) {
        return 'L’écriture d’acquisition est dans un exercice clôturé · la fiche ne se modifie plus (AUDCIF art. 20, al. 3).';
    }
    if (e.exerciceClosQuiLaPorte)
        return motifExerciceClosQuiLaPorte(e.exerciceClosQuiLaPorte, 'modifier');
    if (e.usages.length > 0) {
        return (`Des traitements ont lu cette fiche · ${e.usages.map(libelleUsage).join(', ')}. Ils ont été calculés sur les valeurs ` +
            'actuelles · annulez-les d’abord (onglet Traitements, du plus récent au plus ancien), puis modifiez la fiche.');
    }
    if (e.origineParticuliere) {
        return `La fiche est née ${e.origineParticuliere} · la modification ne rejoue pas cette opération. Supprimez la fiche et refaites l’opération.`;
    }
    if (e.motifLignesTenues)
        return e.motifLignesTenues;
    return null;
}
function motifRefusSuppression(e) {
    if (e.sortie)
        return 'Le bien est sorti · sa fiche et son écriture de sortie restent au registre (AUDCIF art. 22, 2°).';
    if (e.autresEcritures.length > 0) {
        return `La fiche porte ${e.autresEcritures.join(', ')} · elle ne se supprime plus (AUDCIF art. 22, 2°).`;
    }
    if (e.neeDUneEcriturePassee) {
        if (e.acquisition?.exerciceClos) {
            return 'L’écriture dont la fiche est née est dans un exercice clôturé · le bien figure à ses états, la fiche ne se retire plus.';
        }
        if (e.exerciceClosQuiLaPorte) {
            return `L’exercice clos le ${e.exerciceClosQuiLaPorte} a porté ce bien à ses états (AUDCIF art. 19) · la fiche ne se retire plus.`;
        }
    }
    else if (e.acquisition?.validee) {
        return (`L’écriture d’acquisition (pièce n° ${e.acquisition.numeroPiece ?? '·'}) est validée · la fiche ne se supprime plus ` +
            '(AUDCIF art. 22, 2°). Un bien qui n’existe plus se sort (mise au rebut, destruction, vol).');
    }
    if (e.acquisition?.exerciceClos)
        return 'L’écriture d’acquisition est dans un exercice clôturé · la fiche ne se supprime plus.';
    if (e.exerciceClosQuiLaPorte)
        return motifExerciceClosQuiLaPorte(e.exerciceClosQuiLaPorte, 'supprimer');
    if (e.renouvelle) {
        return (`La fiche est née du renouvellement de « ${e.renouvelle} » et en porte la trace (AUDCIF Titre VIII ch. 4 § 4.1) · ` +
            'supprimée, le composant remplacé resterait sorti sans ce qui le remplace. Corrigez-la par la modification tant que ' +
            'son écriture d’acquisition est au brouillard.');
    }
    if (e.usages.length > 0) {
        return `La fiche est utilisée · ${e.usages.map(libelleUsage).join(', ')}. Annulez ou retirez d’abord ces usages.`;
    }
    if (e.annulationsRetenant > 0) {
        return (`${e.annulationsRetenant} traitement(s) annulé(s) de ce bien gardent leur écriture et son négatif au journal · la fiche qui ` +
            'les retient ne se supprime pas (AUDCIF art. 22, 2°).');
    }
    if ((e.documents ?? 0) > 0) {
        return `La fiche porte ${e.documents} document(s) joint(s) · retirez-les d’abord, depuis l’onglet Documents de la fiche.`;
    }
    if (e.motifLignesTenues && !e.neeDUneEcriturePassee)
        return e.motifLignesTenues;
    return null;
}
function propositionDeDuplication(f) {
    return {
        designation: `${f.designation} (copie)`.slice(0, 200),
        compteImmobilisationId: f.compteImmobilisationId,
        natureFiscaleCle: f.natureFiscaleCle,
        lieuId: f.lieuId,
        valeurOrigine: f.valeurOrigine,
        valeurResiduelle: f.valeurResiduelle,
        dureeAmortissementAns: f.dureeAmortissementAns,
        modeAmortissement: f.modeAmortissement,
        unitesOeuvrePrevues: f.unitesOeuvrePrevues,
        uniteOeuvreLibelle: f.uniteOeuvreLibelle,
    };
}
//# sourceMappingURL=fiche-immobilisation.js.map