"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CONTREPARTIES_DEPRECIATION_SYSCOHADA = exports.RACINES_FONDS_PROJET = void 0;
exports.motifNonAmortissable = motifNonAmortissable;
exports.motifSansAmortissementProjet = motifSansAmortissementProjet;
exports.estCompteFondsProjet = estCompteFondsProjet;
exports.motifListeFondsProjetVide = motifListeFondsProjetVide;
exports.motifRefusSortieProjet = motifRefusSortieProjet;
exports.motifRefusCompteAmortissement = motifRefusCompteAmortissement;
exports.motifRefusCompteDepreciation = motifRefusCompteDepreciation;
exports.motifRefusContrepartieDepreciation = motifRefusContrepartieDepreciation;
exports.motifRefusContrepartieUsufruit = motifRefusContrepartieUsufruit;
exports.motifRefusDepreciationDivision20 = motifRefusDepreciationDivision20;
exports.motifRefusContrepartieCession = motifRefusContrepartieCession;
const client_1 = require("@prisma/client");
function motifNonAmortissable(numeroCompte, referentiel) {
    if (referentiel === client_1.Referentiel.SYCEBNL && numeroCompte.startsWith('20') && !numeroCompte.startsWith('2011')) {
        return (`Le compte ${numeroCompte} porte un bien reçu en don destiné à la vente · « Ils ne doivent pas être amortis ` +
            "mais la dépréciation doit être constatée en cas de perte de valeur » (SYCEBNL, Partie 2 ch. 3, classe 2). " +
            "Seul l'usufruit temporaire (2011) s'amortit.");
    }
    const texte = referentiel === client_1.Referentiel.SYSCOHADA ? 'AUDCIF, Titre VII, fiche du compte 28' : 'SYCEBNL, Partie 2 ch. 3, fiche du compte 28';
    if (/^2[567]/.test(numeroCompte)) {
        return (`Le compte ${numeroCompte} n'a aucun compte d'amortissement au plan · le compte 28 ne s'ouvre que sur les ` +
            `divisions 2${referentiel === client_1.Referentiel.SYCEBNL ? '0' : '1'} à 24 (${texte}). Une avance se solde, une ` +
            'immobilisation financière se déprécie au 29.');
    }
    if (/^22[235678]/.test(numeroCompte)) {
        return (`Le compte ${numeroCompte} porte un terrain que le plan ne fait pas amortir · le 282 ne s'ouvre que sur ` +
            `« 2824 travaux de mise en valeur des terrains » (${texte}), et la fiche du compte 22 ne le crédite que pour ` +
            "les terrains agricoles ou forestiers et les travaux de mise en valeur. La dépréciation (29) reste ouverte.");
    }
    return null;
}
function motifSansAmortissementProjet(jeu) {
    if (jeu !== client_1.JeuEtatsFinanciersSycebnl.PROJETS_DEVELOPPEMENT)
        return null;
    return ("Un projet de développement ne constate aucune dotation aux amortissements · ses états récapitulent « les " +
        "charges sans amortissement, ni dépréciation » (Acte uniforme SYCEBNL, art. 7 et 9 ; Guide, Application 8).");
}
exports.RACINES_FONDS_PROJET = ['162', '163', '164'];
function estCompteFondsProjet(numero) {
    return exports.RACINES_FONDS_PROJET.some((r) => numero.startsWith(r));
}
function motifListeFondsProjetVide(o) {
    if (!o.projet) {
        return "Le compte de fonds affectés ne sert qu'à la sortie d'un bien de projet de développement (SYCEBNL Partie 3 ch. 3 § 2.5).";
    }
    if (o.nombre > 0)
        return null;
    if (o.nonRetenus && o.nonRetenus > 0) {
        return (`Aucun compte de fonds affectés aux investissements (162, 163, 164) n'est retenu ni utilisé (${o.nonRetenus} au plan) · ` +
            'personnalisez dans Plan comptable celui qui a financé le bien, puis rouvrez la sortie (SYCEBNL Partie 3 ch. 3 § 2.5).');
    }
    if (o.inactifs > 0) {
        return (`Les comptes de fonds affectés aux investissements (162, 163, 164) du plan sont en sommeil (${o.inactifs}) · ` +
            'réactivez dans Plan comptable celui qui a financé le bien, puis rouvrez la sortie (SYCEBNL Partie 3 ch. 3 § 2.5).');
    }
    return ('Aucun compte de détail 162, 163 ou 164 au plan du dossier · ouvrez dans Plan comptable le fonds affecté aux ' +
        'investissements qui a financé le bien (bailleurs 162, État 163, autres organismes 164), puis rouvrez la sortie ' +
        '(SYCEBNL Partie 3 ch. 3 § 2.5).');
}
function motifRefusSortieProjet(o) {
    if (!o.projet) {
        return o.numeroCompteFonds
            ? "Le compte de fonds affectés ne sert qu'à la sortie d'un bien de projet de développement (SYCEBNL Partie 3 ch. 3 § 2.5)."
            : null;
    }
    if (!o.numeroCompteFonds) {
        return "Indiquez le compte de fonds affectés aux investissements (162, 163 ou 164) qui reprend le bien · « 162, 163, 164 Fonds affectés aux investissements » au débit, le bien au crédit (SYCEBNL Partie 3 ch. 3 § 2.5).";
    }
    if (!estCompteFondsProjet(o.numeroCompteFonds)) {
        return `Le compte ${o.numeroCompteFonds} n'est pas un fonds affecté aux investissements · seuls les comptes 162, 163 et 164 reprennent le bien (SYCEBNL Partie 3 ch. 3 § 2.5).`;
    }
    if (o.compteFondsEnSommeil) {
        return (`Le compte de fonds ${o.numeroCompteFonds} est en sommeil · réactivez-le dans Plan comptable, ou choisissez ` +
            'le fonds actif qui a financé le bien (SYCEBNL Partie 3 ch. 3 § 2.5).');
    }
    if (o.cumulAmorti > 0.005 || o.cumulDepreciation > 0.005) {
        return ("Ce bien porte un amortissement ou une dépréciation · les états d'un projet récapitulent « les charges sans " +
            "amortissement, ni dépréciation » (Acte uniforme SYCEBNL, art. 7 et 9), et la sortie du § 2.5 ne connaît que le " +
            'fonds et le bien. Contre-passez d\'abord ces écritures.');
    }
    return null;
}
function motifRefusDivision(referentiel, numeroBien, numeroCompte, racine) {
    if (referentiel !== client_1.Referentiel.SYSCOHADA)
        return null;
    const attendu = `${racine}${numeroBien.charAt(1)}`;
    if (numeroCompte.startsWith(attendu))
        return null;
    return (`Le compte ${numeroCompte} ne correspond pas à la division du bien (${numeroBien}) · attendu un ${attendu}. ` +
        '« Les comptes 28 et 29 ont été développés selon la structure des comptes de la classe 2 » (AUDCIF, Titre VII ch. 2).');
}
function motifRefusCompteAmortissement(referentiel, numeroBien, numeroCompte28) {
    return motifRefusDivision(referentiel, numeroBien, numeroCompte28, '28');
}
function motifRefusCompteDepreciation(referentiel, numeroBien, numeroCompte29) {
    return motifRefusDivision(referentiel, numeroBien, numeroCompte29, '29');
}
exports.CONTREPARTIES_DEPRECIATION_SYSCOHADA = {
    [client_1.SensDepreciation.DOTATION]: ['691', '697', '853'],
    [client_1.SensDepreciation.REPRISE]: ['791', '797', '863'],
};
function motifRefusContrepartieDepreciation(referentiel, sens, numeroContrepartie) {
    if (referentiel !== client_1.Referentiel.SYSCOHADA)
        return null;
    const admises = exports.CONTREPARTIES_DEPRECIATION_SYSCOHADA[sens];
    if (admises.some((r) => numeroContrepartie.startsWith(r)))
        return null;
    return (`Le compte ${numeroContrepartie} n'est pas une contrepartie de ${sens === client_1.SensDepreciation.DOTATION ? 'dotation' : 'reprise'} ` +
        `de dépréciation · la fiche du compte 29 (AUDCIF, Titre VII) nomme ${admises.join(', ')}.`);
}
function motifRefusContrepartieUsufruit(referentiel, numeroBien, sens, numeroContrepartie) {
    if (referentiel !== client_1.Referentiel.SYCEBNL || !numeroBien.startsWith('2011'))
        return null;
    const attendu = sens === client_1.SensDepreciation.DOTATION ? '6951' : '7951';
    if (numeroContrepartie.startsWith(attendu))
        return null;
    return (`L'usufruit temporaire se ${sens === client_1.SensDepreciation.DOTATION ? 'déprécie' : 'reprend'} au ${attendu}, ` +
        `pas au ${numeroContrepartie} (SYCEBNL Partie 3 ch. 2 § 2.3.2).`);
}
function motifRefusDepreciationDivision20(referentiel, numeroBien, sens, numeroCompte29, numeroContrepartie) {
    if (referentiel !== client_1.Referentiel.SYCEBNL || !numeroBien.startsWith('20'))
        return null;
    const usufruit = numeroBien.startsWith('2011');
    const attendu29 = usufruit ? '2901' : '2902';
    if (!numeroCompte29.startsWith(attendu29)) {
        return usufruit
            ? `L'usufruit temporaire se déprécie au 2901, pas au ${numeroCompte29} (SYCEBNL Partie 3 ch. 2 § 2.3.2).`
            : `Un bien destiné à la vente se déprécie au 2902, pas au ${numeroCompte29} (SYCEBNL Partie 3 ch. 2 § 2.2.2).`;
    }
    if (usufruit)
        return motifRefusContrepartieUsufruit(referentiel, numeroBien, sens, numeroContrepartie);
    const attendu = sens === client_1.SensDepreciation.DOTATION ? '6952' : '7952';
    if (numeroContrepartie.startsWith(attendu))
        return null;
    return (`Un bien destiné à la vente se ${sens === client_1.SensDepreciation.DOTATION ? 'déprécie' : 'reprend'} au ${attendu}, ` +
        `pas au ${numeroContrepartie} (SYCEBNL Partie 3 ch. 2 § ${sens === client_1.SensDepreciation.DOTATION ? '2.2.2' : '2.2.3'}).`);
}
function motifRefusContrepartieCession(referentiel, cessionCourante, numeroContrepartie) {
    if (referentiel !== client_1.Referentiel.SYSCOHADA)
        return null;
    if (!cessionCourante && numeroContrepartie.startsWith('41')) {
        return (`Une cession hors activités ordinaires ne se porte pas sur un compte client (${numeroContrepartie}) · « Les ` +
            "créances sur des tiers nées des opérations autres que la vente […] → 485 (Créances sur cessions " +
            "d'immobilisations) » (AUDCIF, Titre VII, fiche du compte 41, Exclusions).");
    }
    if (cessionCourante && numeroContrepartie.startsWith('485')) {
        return (`Une cession courante ne se porte pas au ${numeroContrepartie} · ses créances « constituent des créances ` +
            "rattachées au compte Client (compte 414) et sont débitées par le crédit du compte 754 » (AUDCIF, Titre VII, " +
            'fiche du compte 48).');
    }
    return null;
}
//# sourceMappingURL=comptes-du-bien.js.map