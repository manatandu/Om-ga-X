"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MAX_LIGNES_MODELE = exports.NATURES_MODELE = void 0;
exports.motifRefusModele = motifRefusModele;
exports.normaliserLignes = normaliserLignes;
const assiettes_paie_1 = require("./assiettes-paie");
const decimales_1 = require("../../common/decimales");
exports.NATURES_MODELE = [
    'SALAIRE_OU_TRAITEMENT',
    'COMMISSION',
    'INDEMNITE_DE_VIE_CHERE',
    'PRIME',
    'PARTICIPATION_AUX_BENEFICES',
    'GRATIFICATION_OU_MOIS_COMPLEMENTAIRE',
    'PRESTATION_SUPPLEMENTAIRE',
    'AVANTAGE_EN_NATURE',
    'ALLOCATION_OU_INDEMNITE_COMPENSATOIRE_DE_CONGE',
    'INDEMNITE_INCAPACITE_OU_ACCOUCHEMENT',
    ...assiettes_paie_1.HORS_REMUNERATION_ARTICLE_7,
];
exports.MAX_LIGNES_MODELE = 40;
function motifRefusModele(m, rubriques) {
    if (!m.nom?.trim())
        return 'Le nom du modèle est obligatoire.';
    if (m.deviseStipulation !== 'CDF' && m.deviseStipulation !== 'USD')
        return 'La devise du modèle est CDF ou USD.';
    const lignes = m.lignes ?? [];
    if (lignes.length === 0)
        return 'Un modèle porte au moins un élément.';
    if (lignes.length > exports.MAX_LIGNES_MODELE)
        return `Un modèle porte au plus ${exports.MAX_LIGNES_MODELE} éléments.`;
    for (const [i, l] of lignes.entries()) {
        const n = i + 1;
        if (!l.libelle?.trim())
            return `Élément ${n} · le libellé est obligatoire.`;
        if (l.rubriqueId) {
            const r = rubriques.find((x) => x.id === l.rubriqueId);
            if (!r)
                return `Élément ${n} · rubrique introuvable dans ce dossier.`;
            if (!r.actif)
                return `Élément ${n} · la rubrique est désactivée.`;
        }
        else if (!exports.NATURES_MODELE.includes(l.nature)) {
            return `Élément ${n} · nature inconnue.`;
        }
        if (l.montant !== undefined && l.montant !== null) {
            if (!Number.isFinite(l.montant) || l.montant < 0)
                return `Élément ${n} · le montant est positif ou nul.`;
            if ((0, decimales_1.nombreDeDecimales)(l.montant) > 2)
                return `Élément ${n} · deux décimales au plus.`;
        }
    }
    return null;
}
function normaliserLignes(lignes, rubriques) {
    return lignes.map((l) => {
        const r = l.rubriqueId ? rubriques.find((x) => x.id === l.rubriqueId) : undefined;
        return {
            nature: r ? r.nature : l.nature,
            libelle: l.libelle.trim(),
            rubriqueId: r ? r.id : null,
            montant: l.montant ?? null,
        };
    });
}
//# sourceMappingURL=modeles-bulletin.js.map