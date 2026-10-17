"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.METHODES_INVENTAIRE_INTERMITTENT = exports.METHODES_INVENTAIRE_PERMANENT = exports.METHODES_ADMISES = void 0;
exports.valoriser = valoriser;
exports.methodeCompatible = methodeCompatible;
exports.sortiesAuDelaDuStock = sortiesAuDelaDuStock;
exports.METHODES_ADMISES = ['PEPS', 'CMPACE', 'CMP_PERIODE_STOCKAGE'];
exports.METHODES_INVENTAIRE_PERMANENT = ['PEPS', 'CMPACE'];
exports.METHODES_INVENTAIRE_INTERMITTENT = ['CMP_PERIODE_STOCKAGE'];
function valoriser(mouvementsBruts, methode) {
    const refus = [];
    if (methode === 'CMP_PERIODE_STOCKAGE') {
        return {
            methode,
            mouvements: [],
            quantiteFinale: 0,
            valeurFinale: 0,
            totalEntrees: 0,
            totalSorties: 0,
            refus: [
                {
                    ordre: null,
                    motif: 'METHODE_NON_IMPLEMENTEE',
                    explication: "Le coût moyen de PÉRIODE DE STOCKAGE n'est pas calculé par OmegaX. Le glossaire le " +
                        "définit ainsi : « on calcule la DATE D'ENTRÉE MOYENNE du stock existant en fin " +
                        "d'exercice, on en déduit le coût unitaire moyen d'entrée à cette date ». Il faudrait " +
                        "l'historique des entrées d'un dossier qui, tenant un inventaire intermittent, n'en " +
                        'saisit aucune. Inventer une pondération rendrait un chiffre plausible et hors du ' +
                        'texte. Cette méthode se calcule hors du logiciel, et sa mention en Notes annexes ' +
                        'reste due.',
                },
            ],
        };
    }
    const mouvements = [...mouvementsBruts].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0) || a.ordre - b.ordre);
    const couches = [];
    let quantite = 0;
    let valeur = 0;
    let totalEntrees = 0;
    let totalSorties = 0;
    const valorises = [];
    for (const m of mouvements) {
        if (!(m.quantite > 0)) {
            refus.push({
                ordre: m.ordre,
                motif: 'QUANTITE_NON_POSITIVE',
                explication: 'Un mouvement de magasin porte une quantité strictement positive · son SENS dit déjà ' +
                    "s'il entre ou s'il sort. Une quantité négative inverserait le sens sans le dire.",
            });
            continue;
        }
        if (m.sens === 'ENTREE') {
            if (m.cout === null) {
                refus.push({
                    ordre: m.ordre,
                    motif: 'ENTREE_SANS_COUT',
                    explication: "Une entrée en magasin porte son COÛT D'ACQUISITION ou son coût de production · " +
                        "c'est lui qui alimente la valeur du stock, et rien d'autre ne peut le fournir.",
                });
                continue;
            }
            if (m.cout < 0) {
                refus.push({
                    ordre: m.ordre,
                    motif: 'ENTREE_COUT_NEGATIF',
                    explication: "Le coût d'une entrée ne peut pas être négatif. Les rabais, remises et ristournes se " +
                        "DÉDUISENT du coût d'acquisition (AUDCIF Titre VII ch. 3) · ils ne se saisissent pas " +
                        'comme une entrée de signe inverse.',
                });
                continue;
            }
            couches.push({ quantite: m.quantite, coutUnitaire: m.cout / m.quantite });
            quantite += m.quantite;
            valeur += m.cout;
            totalEntrees += m.cout;
            valorises.push({ ...m, valeur: m.cout, quantiteApres: quantite, valeurApres: valeur });
            continue;
        }
        if (m.cout !== null) {
            refus.push({
                ordre: m.ordre,
                motif: 'SORTIE_AVEC_COUT_IMPOSE',
                explication: "La valeur d'une sortie se CALCULE, elle ne se saisit pas. Les trois méthodes admises " +
                    'reposent sur « un correct raccordement des sorties aux entrées » (AUDCIF Titre VI, ' +
                    'Valorisation des biens fongibles) · un coût imposé à la main rompt ce raccordement, et ' +
                    "le stock cesse d'être la différence de ce qui est entré et de ce qui est sorti.",
            });
            continue;
        }
        if (m.quantite > quantite) {
            refus.push({
                ordre: m.ordre,
                motif: 'SORTIE_SUPERIEURE_AU_STOCK',
                explication: `Cette sortie porte sur ${m.quantite} unités alors que le magasin n'en détient que ` +
                    `${quantite} à cette date. Un stock est un ACTIF : il ne descend pas sous zéro. La ` +
                    "sortie est antérieure à une entrée non saisie, ou la quantité est fausse.",
            });
            continue;
        }
        let sortie;
        if (m.quantite === quantite) {
            sortie = valeur;
            couches.length = 0;
        }
        else if (methode === 'PEPS') {
            let reste = m.quantite;
            sortie = 0;
            while (reste > 0) {
                const couche = couches[0];
                const prise = Math.min(reste, couche.quantite);
                sortie += prise * couche.coutUnitaire;
                couche.quantite -= prise;
                reste -= prise;
                if (couche.quantite === 0)
                    couches.shift();
            }
        }
        else {
            sortie = (valeur / quantite) * m.quantite;
            const restant = quantite - m.quantite;
            const coutMoyen = (valeur - sortie) / restant;
            couches.length = 0;
            couches.push({ quantite: restant, coutUnitaire: coutMoyen });
        }
        quantite -= m.quantite;
        valeur -= sortie;
        totalSorties += sortie;
        valorises.push({ ...m, valeur: sortie, quantiteApres: quantite, valeurApres: valeur });
    }
    return {
        methode,
        mouvements: valorises,
        quantiteFinale: quantite,
        valeurFinale: valeur,
        totalEntrees,
        totalSorties,
        refus,
    };
}
function methodeCompatible(methode, inventaire) {
    return inventaire === 'PERMANENT'
        ? exports.METHODES_INVENTAIRE_PERMANENT.includes(methode)
        : exports.METHODES_INVENTAIRE_INTERMITTENT.includes(methode);
}
function sortiesAuDelaDuStock(mouvements) {
    const quantites = mouvements.map((m) => m.sens === 'SORTIE' ? { ...m, cout: null } : { ...m, cout: Math.max(0, m.cout ?? 0) });
    return valoriser(quantites, 'PEPS').refus.filter((r) => r.motif === 'SORTIE_SUPERIEURE_AU_STOCK');
}
//# sourceMappingURL=valorisation-stocks.js.map