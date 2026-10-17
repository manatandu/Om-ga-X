"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MODES_USUELS = exports.LIBELLES_NATURES = exports.PLAFOND_MODES_REGLEMENT = exports.ENTREE_EN_VIGUEUR_ART_59_BIS = exports.SEUIL_ART_59_BIS = exports.NATURES_ADMISES_ART_59_BIS = void 0;
exports.motifRefusIdentiteMode = motifRefusIdentiteMode;
exports.natureLueSurLeCompte = natureLueSurLeCompte;
exports.avertissementArt59Bis = avertissementArt59Bis;
const client_1 = require("@prisma/client");
exports.NATURES_ADMISES_ART_59_BIS = new Set([
    client_1.NatureModeReglement.CHEQUE,
    client_1.NatureModeReglement.VIREMENT,
    client_1.NatureModeReglement.CARTE_BANCAIRE,
]);
exports.SEUIL_ART_59_BIS = 1_000_000;
exports.ENTREE_EN_VIGUEUR_ART_59_BIS = new Date(Date.UTC(2013, 4, 27));
exports.PLAFOND_MODES_REGLEMENT = 30;
exports.LIBELLES_NATURES = {
    ESPECES: 'Espèces',
    CHEQUE: 'Chèque',
    VIREMENT: 'Virement',
    CARTE_BANCAIRE: 'Carte bancaire',
    MONNAIE_ELECTRONIQUE: 'Monnaie électronique',
    EFFET_DE_COMMERCE: 'Effet de commerce',
    PRELEVEMENT: 'Prélèvement',
    AUTRE: 'Autre',
};
exports.MODES_USUELS = [
    { code: 'ESP', intitule: 'Espèces', nature: client_1.NatureModeReglement.ESPECES },
    { code: 'CHQ', intitule: 'Chèque', nature: client_1.NatureModeReglement.CHEQUE },
    { code: 'VIR', intitule: 'Virement bancaire', nature: client_1.NatureModeReglement.VIREMENT },
    { code: 'CB', intitule: 'Carte bancaire', nature: client_1.NatureModeReglement.CARTE_BANCAIRE },
    { code: 'MEL', intitule: 'Monnaie électronique', nature: client_1.NatureModeReglement.MONNAIE_ELECTRONIQUE },
];
function motifRefusIdentiteMode(code, intitule) {
    const c = code.trim();
    if (!/^[A-Za-z0-9_-]{1,10}$/.test(c)) {
        return 'Le code d’un mode de règlement compte de 1 à 10 caractères, lettres, chiffres, tiret ou souligné, sans espace.';
    }
    const i = intitule.trim();
    if (i.length === 0)
        return 'L’intitulé du mode de règlement est obligatoire.';
    if (i.length > 35)
        return 'L’intitulé d’un mode de règlement compte au plus 35 caractères.';
    return null;
}
function natureLueSurLeCompte(numeroTresorerie) {
    if (!numeroTresorerie)
        return null;
    if (numeroTresorerie.startsWith('57'))
        return client_1.NatureModeReglement.ESPECES;
    if (numeroTresorerie.startsWith('55'))
        return client_1.NatureModeReglement.MONNAIE_ELECTRONIQUE;
    return null;
}
function avertissementArt59Bis(p) {
    if (p.sens !== 'FOURNISSEUR')
        return null;
    if (p.dossierAssujetti === false)
        return null;
    if (p.nature === null || exports.NATURES_ADMISES_ART_59_BIS.has(p.nature))
        return null;
    if (p.date.getTime() < exports.ENTREE_EN_VIGUEUR_ART_59_BIS.getTime())
        return null;
    const auSeuil = (f) => Math.round(f.montant * 100) >= exports.SEUIL_ART_59_BIS * 100;
    const visees = p.factures.filter(auSeuil);
    const conditionnelles = (p.sousCondition ?? []).filter(auSeuil);
    const nonJugees = p.nonJugees ?? [];
    if (visees.length + conditionnelles.length + nonJugees.length === 0)
        return null;
    const fmt = (x) => x.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const mode = exports.LIBELLES_NATURES[p.nature].toLowerCase();
    const payePar = p.source === 'COMPTE' ? 'en caisse ou en monnaie électronique (compte du journal)' : `par ${mode}`;
    const phrases = [];
    const nommees = [
        ...visees.map((f) => `${f.reference} (${fmt(f.montant)})`),
        ...conditionnelles.map((f) => `${f.reference} (${fmt(f.montant)}, si ses lignes au compte sont les échéances d’une même facture)`),
    ];
    if (nommees.length > 0) {
        phrases.push(`${p.compte} · ${nommees.join(', ')} ` +
            `${nommees.length > 1 ? 'sont des transactions' : 'est une transaction'} d’au moins ${fmt(exports.SEUIL_ART_59_BIS)} FC, ` +
            `payée${nommees.length > 1 ? 's' : ''} ${payePar} · ` +
            'entre assujettis, l’O.-L. n° 10/001, art. 59 bis, veut un paiement par chèque, par virement ou par carte bancaire, ' +
            'et l’art. 74 bis retire alors le droit à déduction de la TVA supportée. Si le fournisseur est assujetti, ' +
            'la TVA de ces factures n’est pas déductible ; OmegaX ne la retire pas de la déclaration.');
    }
    if (nonJugees.length > 0) {
        phrases.push(`${p.compte} · ${nonJugees.map((f) => `${f.reference} (${fmt(f.montant)} réglés)`).join(', ')} · ` +
            'facture d’origine non retrouvée (à-nouveau au solde, bilan d’ouverture ou pièce introuvable) · seuil de ' +
            `l’art. 59 bis non jugé. Payée ${payePar}, une facture d’au moins ${fmt(exports.SEUIL_ART_59_BIS)} FC entre ` +
            'assujettis perdrait le droit à déduction de sa TVA (art. 74 bis) · vérifiez son montant sur la pièce.');
    }
    if (p.nature !== client_1.NatureModeReglement.ESPECES) {
        phrases.push(`Réserve · ${p.source === 'COMPTE' ? 'ce mode' : `le mode « ${exports.LIBELLES_NATURES[p.nature].toLowerCase()} »`} n’est pas ` +
            'nommé par l’art. 59 bis, qui ne cite que le chèque, le virement et la carte bancaire · averti faute de texte ' +
            'qui l’admette, sans qu’OmegaX tranche qu’il y déroge.');
    }
    return phrases.join(' ');
}
//# sourceMappingURL=modes-reglement.js.map