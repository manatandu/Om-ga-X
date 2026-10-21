"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LIBELLE_FONDEMENT = void 0;
exports.ventilerPrixGlobal = ventilerPrixGlobal;
exports.ventilerFondsDeCommerce = ventilerFondsDeCommerce;
const centimes = (x) => Math.round(x * 100) / 100;
exports.LIBELLE_FONDEMENT = {
    ACTE: "montants portés à l'acte",
    VALEURS_ATTRIBUABLES: 'au prorata des valeurs attribuables (AUDCIF art. 38, 1er tiret)',
    COMPARAISON_TERRAINS_NUS: 'terrain par comparaison avec des terrains nus, bâtiment par différence (AUDCIF Titre VIII ch. 11 § 1.7.1, 1.)',
    COUT_RECONSTRUCTION: 'bâtiment au coût de reconstruction, terrain par différence (AUDCIF Titre VIII ch. 11 § 1.7.1, 2.)',
    PRIX_DE_MARCHE: 'par référence à un prix de marché, le reste par différence (AUDCIF art. 38, 2e tiret)',
    FORFAIT: 'de façon forfaitaire, le reste par différence (AUDCIF art. 38, 2e tiret)',
};
const estTerrain = (n) => n.startsWith('22');
const estBatiment = (n) => n.startsWith('23');
function ventilerPrixGlobal(o) {
    const { prix, fondement, elements } = o;
    if (!(prix > 0))
        return { motif: 'Le prix global est positif.' };
    if (elements.length < 2) {
        return { motif: "Un prix global se ventile entre au moins deux biens · un bien seul s'enregistre à son coût (AUDCIF art. 38)." };
    }
    const ensembleImmobilier = elements.some((e) => estTerrain(e.numeroCompte)) && elements.some((e) => estBatiment(e.numeroCompte));
    if (ensembleImmobilier && !['ACTE', 'COMPARAISON_TERRAINS_NUS', 'COUT_RECONSTRUCTION'].includes(fondement)) {
        return {
            motif: "Un terrain acquis avec son bâtiment se ventile selon l'acte notarié, sinon par comparaison avec des terrains nus, à défaut au coût de reconstruction du bâtiment, par ordre de priorité (AUDCIF Titre VIII ch. 11 § 1.7.1).",
        };
    }
    const differences = elements.filter((e) => e.parDifference);
    const valorises = elements.filter((e) => !e.parDifference);
    if (valorises.some((e) => !(Number(e.montant) > 0))) {
        return { motif: 'Chaque bien valorisé porte un montant positif.' };
    }
    const somme = centimes(valorises.reduce((t, e) => t + Number(e.montant), 0));
    if (fondement === 'ACTE' || fondement === 'VALEURS_ATTRIBUABLES') {
        if (differences.length > 0) {
            return { motif: "Aucun bien ne se valorise par différence quand chacun a son montant · la différence est la méthode de l'art. 38, 2e tiret." };
        }
        if (fondement === 'ACTE') {
            if (somme !== centimes(prix)) {
                return { motif: `Les montants de l'acte totalisent ${somme.toFixed(2)} et le prix global ${centimes(prix).toFixed(2)} · ils doivent être égaux.` };
            }
            return { montants: elements.map((e) => centimes(Number(e.montant))) };
        }
        let reparti = 0;
        const montants = elements.map((e, i) => {
            const part = i === elements.length - 1 ? centimes(prix - reparti) : centimes((prix * Number(e.montant)) / somme);
            reparti = centimes(reparti + part);
            return part;
        });
        if (montants.some((m) => !(m > 0)))
            return { motif: 'La ventilation au prorata laisse un bien sans coût.' };
        return { montants };
    }
    if (differences.length !== 1) {
        return { motif: 'Un seul bien se valorise par différence, les autres directement (AUDCIF art. 38, 2e tiret).' };
    }
    const reste = centimes(prix - somme);
    if (!(reste > 0)) {
        return {
            motif: `Les valeurs directes (${somme.toFixed(2)}) atteignent ou dépassent le prix global (${centimes(prix).toFixed(2)}) · le bien valorisé par différence n'aurait aucun coût.`,
        };
    }
    const parDiff = differences[0];
    if (fondement === 'COMPARAISON_TERRAINS_NUS') {
        if (!valorises.every((e) => estTerrain(e.numeroCompte)) || !estBatiment(parDiff.numeroCompte)) {
            return { motif: 'Par comparaison avec des terrains nus, le terrain (22) se valorise et le bâtiment (23) prend la différence (AUDCIF Titre VIII ch. 11 § 1.7.1, 1.).' };
        }
    }
    if (fondement === 'COUT_RECONSTRUCTION') {
        if (!valorises.every((e) => estBatiment(e.numeroCompte)) || !estTerrain(parDiff.numeroCompte)) {
            return { motif: 'Au coût de reconstruction, le bâtiment (23) se valorise et le terrain (22) prend la différence (AUDCIF Titre VIII ch. 11 § 1.7.1, 2.).' };
        }
        if (!o.motifSansComparaison?.trim()) {
            return {
                motif: "Le coût de reconstruction ne vient qu'« à défaut » de la comparaison avec des terrains nus · dites pourquoi aucune transaction comparable n'a pu être retenue (AUDCIF Titre VIII ch. 11 § 1.7.1).",
            };
        }
    }
    return { montants: elements.map((e) => (e.parDifference ? reste : centimes(Number(e.montant)))) };
}
function ventilerFondsDeCommerce(o) {
    if (o.referentiel !== 'SYSCOHADA') {
        return {
            motif: "Le fonds commercial (215) et le droit au bail (216) n'existent qu'au plan SYSCOHADA · le SYCEBNL n'en ouvre aucun, et l'association ne se livre à des opérations commerciales qu'à titre accessoire (loi n° 004/2001, art. 1er).",
        };
    }
    if (!(o.prix > 0))
        return { motif: 'Le prix global est positif.' };
    for (const e of o.elements) {
        if (e.numeroCompte.startsWith('215')) {
            return { motif: "Le fonds commercial est l'élément résiduel · il ne se saisit pas, il se calcule (AUDCIF Titre VIII ch. 2 § 7.2.1)." };
        }
        if (!/^2[1-4]/.test(e.numeroCompte)) {
            return { motif: `Le compte ${e.numeroCompte} n'est pas une immobilisation incorporelle ou corporelle (21 à 24) · un élément du fonds va à sa nature.` };
        }
        if (!(e.montant > 0))
            return { motif: 'Chaque élément séparable porte une valeur positive.' };
    }
    for (const s of o.stocks) {
        if (!/^3[0-8]/.test(s.numeroCompte)) {
            return { motif: `Le compte ${s.numeroCompte} n'est pas un compte de stock (classe 3, hors dépréciations 39).` };
        }
        if (!(s.montant > 0))
            return { motif: 'Chaque stock repris porte une valeur positive.' };
    }
    const somme = centimes([...o.elements, ...o.stocks].reduce((t, e) => t + e.montant, 0));
    const reste = centimes(o.prix - somme);
    if (reste < 0) {
        return {
            motif: `Les éléments séparables et les stocks (${somme.toFixed(2)}) dépassent le prix (${centimes(o.prix).toFixed(2)}) · leurs valeurs sont à revoir, aucun fonds commercial négatif ne s'inscrit.`,
        };
    }
    if (o.elements.length === 0 && reste === 0) {
        return { motif: "Aucun élément immobilisé ni fonds commercial · une reprise de stocks seule n'est pas une acquisition d'immobilisation." };
    }
    return { fondsCommercial: reste };
}
//# sourceMappingURL=ventilation-prix-global.js.map