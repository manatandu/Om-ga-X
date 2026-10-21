"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CONDITIONS_PROPRES = void 0;
exports.comptesCourtTerme = comptesCourtTerme;
exports.motifRefusCompteCourtTerme = motifRefusCompteCourtTerme;
exports.motifRefusCompteLongTerme = motifRefusCompteLongTerme;
exports.motifRefusHorizon = motifRefusHorizon;
exports.horizonAJuger = horizonAJuger;
exports.avertissementHorizon = avertissementHorizon;
exports.clesInconnues = clesInconnues;
exports.conditionsPropresManquantes = conditionsPropresManquantes;
const client_1 = require("@prisma/client");
function comptesCourtTerme(referentiel) {
    const exploitation = { compte: '4991', intitule: "Provisions pour risques à court terme sur opérations d'exploitation", dotation: '6591', reprise: '7591' };
    const hao = { compte: '4998', intitule: 'Provisions pour risques à court terme sur opérations H.A.O.', dotation: '839', reprise: '849' };
    const tresorerie = { compte: '599', intitule: 'Provisions pour risques à court terme à caractère financier', dotation: '679', reprise: '779' };
    if (referentiel === client_1.Referentiel.SYCEBNL)
        return [exploitation, hao, tresorerie];
    return [
        exploitation,
        { compte: '4997', intitule: 'Provisions pour risques à court terme sur opérations financières', dotation: '6791', reprise: '7791' },
        hao,
        tresorerie,
    ];
}
function motifRefusCompteCourtTerme(referentiel, numero) {
    const admis = comptesCourtTerme(referentiel);
    if (admis.some((c) => numero.startsWith(c.compte)))
        return null;
    return (`Une provision à moins d'un an se porte au ${admis.map((c) => c.compte).join(', ')}, jamais au ${numero} · ` +
        (referentiel === client_1.Referentiel.SYCEBNL
            ? "SYCEBNL, fiche du compte 19, exclusions (« les provisions correspondant à des risques à moins d'un an (utiliser 499) »)."
            : "AUDCIF, Titre VII, fiche du compte 49 (« dette probable à moins d'un an ») et tableau synoptique du ch. 18."));
}
function motifRefusCompteLongTerme(numero) {
    if (!numero.startsWith('499') && !numero.startsWith('599'))
        return null;
    return (`Le ${numero} porte les provisions à moins d'un an · une provision à plus d'un an se porte au 19 (AUDCIF, ` +
        'Titre VII, fiche du compte 49, exclusions ; SYCEBNL, fiche du compte 19). Déclarez la ligne « à moins d’un an » ou choisissez le 19.');
}
function motifRefusHorizon(courtTerme, echeance, finExercice) {
    if (!echeance)
        return null;
    const unAn = new Date(finExercice);
    unAn.setUTCFullYear(unAn.getUTCFullYear() + 1);
    const dansLAnnee = echeance.getTime() <= unAn.getTime();
    if (courtTerme && !dansLAnnee) {
        return "L'échéance attendue est à plus d'un an de la clôture · la provision n'est pas à court terme, elle se porte au 19.";
    }
    if (!courtTerme && dansLAnnee) {
        return ("L'échéance attendue tombe dans l'année qui suit la clôture · la provision est à court terme et se porte au 499 " +
            'ou au 599 (fiches des comptes 19 et 49). Déclarez-la « à moins d’un an ».');
    }
    return null;
}
function horizonAJuger(statut, montantCloture) {
    if (statut === 'PASSIF_EVENTUEL' || statut === 'ECARTEE' || statut === 'SOLDEE')
        return false;
    return Math.abs(montantCloture) > 0.005;
}
function avertissementHorizon(courtTerme, echeance, finExercice) {
    if (!motifRefusHorizon(courtTerme, echeance, finExercice))
        return null;
    return courtTerme
        ? "L'échéance attendue est désormais à plus d'un an de la clôture · ligne à reclasser au 19 à la clôture (fiches des comptes 19 et 49)."
        : "L'échéance attendue tombe désormais dans l'année qui suit la clôture · ligne à reclasser au 499 (ou au 599) à la clôture (fiches des comptes 19 et 49).";
}
exports.CONDITIONS_PROPRES = {
    [client_1.NatureProvision.RESTRUCTURATION]: [
        {
            cle: 'PLAN_DETAILLE',
            libelle: "Un plan détaillé est formalisé à la clôture · activité concernée, principaux sites, localisation, fonction et nombre approximatif du personnel indemnisé, dépenses, date de mise en œuvre",
            source: 'AUDCIF Titre VIII ch. 18 § 4.1.1',
        },
        {
            cle: 'ATTENTE_FONDEE',
            libelle: 'Les personnes concernées ont une attente fondée · mise en œuvre commencée ou annonce publique claire du plan',
            source: 'AUDCIF Titre VIII ch. 18 § 4.1.1',
        },
        {
            cle: 'MISE_EN_OEUVRE_RAPPROCHEE',
            libelle: 'La mise en œuvre et l’achèvement sont programmés au plus tôt, toute modification importante du plan est improbable',
            source: 'AUDCIF Titre VIII ch. 18 § 4.1.1',
        },
        {
            cle: 'ACCORD_IRREVOCABLE',
            libelle: "S'il s'agit de la revente d'une branche d'activité, un accord de vente irrévocable existe à la clôture (sinon, sans objet)",
            source: 'AUDCIF Titre VIII ch. 18 § 4.1',
        },
        {
            cle: 'DEPENSES_DIRECTES',
            libelle: "Le montant respecte le § 4.1.2 · « Une provision pour restructuration ne doit inclure que les dépenses directement " +
                "liées à la restructuration, sans tenir compte des charges liées aux activités poursuivies par l'entité. La " +
                "provision pour restructuration n'inclut pas les coûts : de reconversion ou une délocalisation du personnel " +
                "conservé ; de marketing ; ou de charges liées à la conduite future de l'activité. De même, les pertes futures " +
                "identifiables jusqu'à la date de restructuration ne peuvent pas faire l'objet de provision, sauf si elles " +
                "concernent un contrat déficitaire. Les profits attendus sur la sortie des actifs ne sont pas pris en compte dans " +
                "l'évaluation d'une provision pour restructuration, même s'ils correspondent à l'aboutissement de la " +
                'restructuration. »',
            source: 'AUDCIF Titre VIII ch. 18 § 4.1.2',
        },
    ],
    [client_1.NatureProvision.CONTRAT_DEFICITAIRE]: [
        {
            cle: 'COUTS_EXCEDENT_AVANTAGES',
            libelle: "Les coûts inévitables d'exécution du contrat excèdent les avantages économiques attendus",
            source: 'AUDCIF Titre VIII ch. 18 § 4.3',
        },
        {
            cle: 'PLUS_FAIBLE_COUT',
            libelle: "Le montant est le plus faible du coût d'exécution et de l'indemnisation ou pénalité de défaut d'exécution",
            source: 'AUDCIF Titre VIII ch. 18 § 4.3',
        },
        {
            cle: 'PERTES_DE_VALEUR_D_ABORD',
            libelle: 'Les pertes de valeur des actifs dédiés au contrat sont comptabilisées avant la provision',
            source: 'AUDCIF Titre VIII ch. 18 § 4.3',
        },
    ],
    [client_1.NatureProvision.DEMENAGEMENT]: [
        {
            cle: 'BAIL_ROMPU',
            libelle: "Une obligation existe à la clôture, formalisée par la rupture d'un bail ou son non-renouvellement, de la volonté du bailleur ou de l'entité",
            source: 'AUDCIF Titre VIII ch. 18 § 4.10',
        },
        {
            cle: 'SORTIE_AU_PROFIT_DU_BAILLEUR',
            libelle: 'La sortie de ressources est au profit du bailleur · dédit, loyers des locaux inoccupés, remise en état des locaux, déménagement des biens qui ne seront plus réutilisés',
            source: 'AUDCIF Titre VIII ch. 18 § 4.10',
        },
        {
            cle: 'HORS_BIENS_REUTILISES',
            libelle: 'Le montant exclut le déménagement des biens qui seront réutilisés · il ne se comptabilise qu’une fois la prestation effectuée',
            source: 'AUDCIF Titre VIII ch. 18 § 4.10',
        },
    ],
};
function clesInconnues(nature, conditions) {
    if (!conditions)
        return [];
    const admises = new Set((exports.CONDITIONS_PROPRES[nature] ?? []).map((c) => c.cle));
    return Object.keys(conditions).filter((k) => !admises.has(k));
}
function conditionsPropresManquantes(nature, conditions) {
    return (exports.CONDITIONS_PROPRES[nature] ?? []).filter((c) => conditions?.[c.cle] !== true).map((c) => `${c.libelle} (${c.source})`);
}
//# sourceMappingURL=court-terme-et-conditions.js.map