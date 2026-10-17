"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.diagnostiquerTiers = diagnostiquerTiers;
const client_1 = require("@prisma/client");
const PRODUITS_SANS_TIERS_SYCEBNL = ['704'];
const CLASSE_CHARGE = '6';
const CLASSE_PRODUIT = '7';
const CLASSE_TIERS = '4';
const CLASSE_TRESORERIE = '5';
function citationDuReferentiel(referentiel) {
    return referentiel === client_1.Referentiel.SYCEBNL
        ? "SYCEBNL, fonctionnement du compte 40 · le compte est crédité des FACTURES par le débit de la classe 6 et " +
            'du compte 445, PUIS débité des RÈGLEMENTS par le crédit des comptes de trésorerie. Deux écritures.'
        : "Guide d'application du SYSCOHADA révisé, Partie 1 ch. 2 § 1.1 · « Recommandation SYSCOHADA (flux de " +
            'trésorerie) : contrepartie systématique = 401 pour les achats de biens/services (hors immobilisations) ; ' +
            '481 ou 404 pour les immobilisations. »';
}
function diagnostiquerTiers(lignes, referentiel) {
    const chargesDebitees = lignes.filter((l) => l.sens === 'DEBIT' && l.numero.startsWith(CLASSE_CHARGE));
    const produitsCredites = lignes
        .filter((l) => l.sens === 'CREDIT' && l.numero.startsWith(CLASSE_PRODUIT))
        .filter((l) => !(referentiel === client_1.Referentiel.SYCEBNL &&
        PRODUITS_SANS_TIERS_SYCEBNL.some((r) => l.numero.startsWith(r))));
    const aUnTiers = lignes.some((l) => l.numero.startsWith(CLASSE_TIERS) &&
        !(chargesDebitees.length > 0 && l.numero.startsWith('445')) &&
        !(produitsCredites.length > 0 && l.numero.startsWith('443')));
    const aUneTresorerie = lignes.some((l) => l.numero.startsWith(CLASSE_TRESORERIE));
    if (aUnTiers || !aUneTresorerie)
        return [];
    if (chargesDebitees.length === 0 && produitsCredites.length === 0)
        return [];
    const comptes = [...chargesDebitees, ...produitsCredites].map((l) => l.numero);
    const sens = chargesDebitees.length > 0 ? 'La CHARGE' : 'Le PRODUIT';
    return [
        `${sens} de ce modèle (${comptes.join(', ')}) est soldé DIRECTEMENT sur un compte de trésorerie, ` +
            "sans passer par un compte de tiers. Les deux référentiels demandent DEUX écritures : la facture, qui " +
            'crée la dette ou la créance sur le tiers, puis le règlement, qui la solde par la trésorerie. ' +
            citationDuReferentiel(referentiel) +
            " CE QUE CETTE ÉCRITURE COÛTE : le compte du tiers reste vide, et ni la balance âgée, ni l'échéancier, " +
            'ni le lettrage, ni la circularisation ne peuvent dire à qui cette somme est due ou due par qui. ' +
            "OmegaX N'EMPÊCHE PAS d'enregistrer ce modèle · il ne connaît pas la nature de votre opération, et " +
            'certaines se soldent légitimement sur la trésorerie (des frais bancaires que le relevé justifie seul, ' +
            'un don manuel reçu en numéraire). Vérifiez laquelle est la vôtre avant de vous en servir.',
    ];
}
//# sourceMappingURL=diagnostic-tiers.js.map