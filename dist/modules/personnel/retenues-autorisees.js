"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RESERVE_LITTERAE_DATEES = exports.RESERVE_CESSION_SYNDICALE = exports.REPONSE_COTISATION_SYNDICALE = exports.SANCTION_ARTICLE_112 = exports.RETENUES_ARTICLE_112 = void 0;
exports.retenueAutorisee = retenueAutorisee;
exports.RETENUES_ARTICLE_112 = [
    {
        littera: 'a',
        libelle: 'retenues fiscales : taxe professionnelle',
        equivalentActuel: "l'impôt sur les rémunérations en vigueur, soit la retenue de l'article 119 de la loi n° 23/053 depuis le 1er janvier 2026",
    },
    {
        littera: 'b',
        libelle: "cotisation due à l'Institut National de Sécurité Sociale",
        equivalentActuel: "la quote-part ouvrière due à la CNSS, l'Institut ayant été remplacé par le décret n° 18/027 du 14 juillet 2018",
    },
    { littera: 'c', libelle: "retenues à titre d'avances", equivalentActuel: null },
    {
        littera: 'd',
        libelle: "retenues à titre d'indemnités compensatoires en cas de violation par le travailleur de l'obligation qui lui est faite par l'article 52",
        equivalentActuel: null,
    },
    {
        littera: 'e',
        libelle: "retenues en vue de constituer un cautionnement pour garantir l'exécution par le travailleur de l'obligation prévue à l'article 52",
        equivalentActuel: null,
    },
    { littera: 'f', libelle: 'retenues à titre de prêt', equivalentActuel: null },
    { littera: 'g', libelle: 'saisie-arrêt', equivalentActuel: null },
];
exports.SANCTION_ARTICLE_112 = "ARTICLE 112 · la liste est FERMÉE, et son dépassement est PÉNALEMENT SANCTIONNÉ. L'article 321 le vise " +
    "(amende n'excédant pas 20 000 Francs congolais constants) et l'article 328 b) le range parmi ceux dont " +
    "« l'amende est appliquée AUTANT DE FOIS QU'IL Y A DES TRAVAILLEURS CONCERNÉS par l'infraction ». Une " +
    "retenue illicite pratiquée sur les bulletins de cent travailleurs est donc cent amendes, quel que soit le " +
    "nombre de mois, dans la limite de cinquante fois le taux.";
exports.REPONSE_COTISATION_SYNDICALE = "LA COTISATION SYNDICALE NE SE RETIENT PAS SUR LA PAIE. L'article 279 impose à toute convention collective " +
    "de régler « les modalités de perception et de versement PAR LES TRAVAILLEURS des cotisations syndicales à " +
    "l'organisation professionnelle intéressée » · LE SUJET DU VERBE EST LE TRAVAILLEUR. Et une convention " +
    "collective ne peut pas y ajouter une retenue : l'article 274 lui interdit de déroger à l'ordre public, et " +
    "l'article 112 en est, puisqu'il frappe de nullité de plein droit ET qu'il est pénalement sanctionné par " +
    "travailleur concerné. L'article 279, lui, n'est dans aucune liste pénale.";
exports.RESERVE_CESSION_SYNDICALE = "LA VOIE QUI RESTE EST UNE CESSION, PAS UNE RETENUE. L'article 114 régit « la CESSION » de la rémunération " +
    "autant que la saisie, et l'employeur qui paie un cessionnaire EXÉCUTE une cession au lieu de pratiquer une " +
    "retenue. Qu'une cession au profit d'un syndicat soit admise est une LECTURE D'ÉDITEUR. Sa FORME, elle, est " +
    "fixée par l'AUPSRVE : déclaration du cédant EN PERSONNE AU GREFFE (art. 205), vérification de la quotité " +
    "par la juridiction et notification à l'employeur (art. 206), paiement du cessionnaire sur copie de la " +
    "déclaration (art. 207), fin dans les seuls cas de l'art. 212, dont aucun n'est une révocation par le seul " +
    "travailleur. Un paiement fait sur un simple écrit remis à l'employeur n'est pas une cession et relève de " +
    "l'article 112. La cession CONSOMME LA QUOTITÉ CESSIBLE, jamais une clause qui vaudrait pour tous. Vaut pour " +
    "les cessions engagées depuis l'entrée en vigueur de l'Acte uniforme (art. 337).";
exports.RESERVE_LITTERAE_DATEES = "Les litterae a) et b) se lisent avec les organismes et impôts actuels (la CNSS pour le b). Cette lecture " +
    "ne vaut JAMAIS pour une retenue que la liste n'a jamais prévue.";
function retenueAutorisee(littera) {
    const trouvee = exports.RETENUES_ARTICLE_112.find((r) => r.littera === littera) ?? null;
    if (!trouvee) {
        return {
            autorisee: false,
            retenue: null,
            refus: `Aucun litera de l'article 112 ne couvre cette retenue${littera ? ` (« ${littera} » proposé)` : ''}. ` +
                exports.SANCTION_ARTICLE_112,
        };
    }
    return { autorisee: true, retenue: trouvee, refus: null };
}
//# sourceMappingURL=retenues-autorisees.js.map