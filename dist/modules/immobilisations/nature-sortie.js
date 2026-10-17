"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LIBELLES_NATURE_SORTIE = exports.NATURES_SORTIE = void 0;
exports.motifRefusNatureSortie = motifRefusNatureSortie;
exports.motifRefusPieceSortie = motifRefusPieceSortie;
exports.libelleSortie = libelleSortie;
exports.NATURES_SORTIE = [
    'VENTE',
    'ECHANGE',
    'MISE_AU_REBUT',
    'DESTRUCTION',
    'VOL',
    'DISPARITION',
    'REMISE_GRATUITE',
    'RESTITUTION',
];
exports.LIBELLES_NATURE_SORTIE = {
    VENTE: 'vente',
    ECHANGE: 'échange',
    MISE_AU_REBUT: 'mise au rebut',
    DESTRUCTION: 'destruction',
    VOL: 'vol',
    DISPARITION: 'disparition',
    REMISE_GRATUITE: 'remise gratuite',
    RESTITUTION: 'restitution',
};
function motifRefusNatureSortie(c) {
    if (!exports.NATURES_SORTIE.includes(c.nature))
        return 'Nature de sortie inconnue.';
    if (c.nature === 'ECHANGE') {
        return c.depuisEchange
            ? null
            : "Un échange se passe par le geste « Échanger », qui fait entrer le bien reçu dans la même opération · " +
                'déclaré en sortie seule, le bien remis sortirait sans contrepartie.';
    }
    if (c.type === 'CESSION') {
        return c.nature === 'VENTE'
            ? null
            : `Une cession avec prix est une vente · la ${exports.LIBELLES_NATURE_SORTIE[c.nature]} se déclare en mise hors service, sans prix.`;
    }
    if (c.nature === 'VENTE') {
        return 'Une vente porte un prix de cession (compte 82) · déclarez-la en cession.';
    }
    if (c.nature === 'REMISE_GRATUITE' && !c.projetDeveloppement) {
        return "La remise gratuite par le bailleur est propre à la fin d'un projet de développement (SYCEBNL Partie 3 ch. 3 § 2.5.2).";
    }
    if (c.nature === 'RESTITUTION' && !c.projetDeveloppement && !c.usufruit) {
        return ("La restitution vise le bien rendu au bailleur à la fin d'un projet de développement (SYCEBNL Partie 3 ch. 3 " +
            "§ 2.5.3) ou l'usufruit temporaire rétrocédé au donateur (Partie 3 ch. 2 § 2.3.2).");
    }
    return null;
}
function motifRefusPieceSortie(reference, date) {
    if (!reference || reference.trim().length === 0) {
        return 'La sortie exige la référence de sa pièce justificative · procès-verbal, facture de vente ou décision (AUDCIF art. 17, 3° et 5°).';
    }
    if (!date || Number.isNaN(date.getTime())) {
        return 'La pièce justificative de la sortie doit être datée (AUDCIF art. 17, 3°).';
    }
    return null;
}
function libelleSortie(opts) {
    const base = opts.type === 'CESSION' ? 'Cession' : 'Mise hors service';
    const nature = opts.nature ? ` (${exports.LIBELLES_NATURE_SORTIE[opts.nature]})` : '';
    return `${opts.projet ? 'Fin de projet · ' : ''}${base}${nature} · ${opts.designation}`;
}
//# sourceMappingURL=nature-sortie.js.map