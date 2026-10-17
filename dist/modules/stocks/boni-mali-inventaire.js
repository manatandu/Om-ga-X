"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.confronterInventaire = confronterInventaire;
exports.lignesDeLaRegularisation = lignesDeLaRegularisation;
const nomenclature_stocks_1 = require("./nomenclature-stocks");
const valorisation_stocks_1 = require("./valorisation-stocks");
function confronterInventaire(articles, referentiel, modeInventaire) {
    const differences = [];
    const sansDifference = [];
    const refus = [];
    if (modeInventaire === 'INTERMITTENT') {
        return {
            differences: [],
            sansDifference: [],
            refus: [
                {
                    articleId: null,
                    code: null,
                    motif: 'INVENTAIRE_INTERMITTENT',
                    explication: "Ce dossier tient un inventaire INTERMITTENT : il n'existe aucun inventaire comptable " +
                        'permanent à confronter au comptage, et donc ni boni ni mali. Les deux textes bornent ' +
                        "la règle dans la phrase qui la pose · « les différences constatées entre l'inventaire " +
                        'comptable PERMANENT et l\'inventaire physique » (AUDCIF Titre VII, compte 603) et ' +
                        '« par rapport à l\'inventaire permanent » (SYCEBNL Partie 2 ch. 3, comptes 31 à 36). ' +
                        "Ici le comptage EST le stock final, et il entre par l'écriture de variation · le " +
                        'porter deux fois gonflerait le stock du montant du comptage.',
                },
            ],
            totalBoni: 0,
            totalMali: 0,
        };
    }
    for (const a of articles) {
        const correspondance = (0, nomenclature_stocks_1.variationDuCompte)(a.compteNumero, referentiel);
        if (!correspondance) {
            const horsVariation = (0, nomenclature_stocks_1.motifHorsVariation)(a.compteNumero, referentiel);
            refus.push({
                articleId: a.articleId,
                code: a.code,
                motif: horsVariation ? 'HORS_VARIATION_AUTOMATIQUE' : 'PAS_UN_COMPTE_DE_STOCK',
                explication: horsVariation
                    ? `Le compte ${a.compteNumero} est hors de la variation automatique · ${horsVariation.motif} ` +
                        "L'écriture de régularisation se passe à la main."
                    : `Le compte ${a.compteNumero} ne porte aucun compte de variation dans le plan ` +
                        `${referentiel}. Un boni ou un mali d'inventaire a pour contrepartie le compte de ` +
                        'variation du stock, et lui seul : sans lui, il n\'y a rien à proposer.',
            });
            continue;
        }
        if (a.quantitePhysique === null || a.quantitePhysique === undefined) {
            refus.push({
                articleId: a.articleId,
                code: a.code,
                motif: 'QUANTITE_PHYSIQUE_ABSENTE',
                explication: `L'article ${a.code} n'a pas été compté. « Pas encore compté » n'est PAS zéro · lu ` +
                    "comme zéro, il produirait un mali égal à tout le stock de l'article, mis à la charge " +
                    "de l'entité, sur une écriture parfaitement équilibrée.",
            });
            continue;
        }
        const valorisation = (0, valorisation_stocks_1.valoriser)(a.mouvements, a.methode);
        if (valorisation.refus.length > 0) {
            refus.push({
                articleId: a.articleId,
                code: a.code,
                motif: 'MAGASIN_NON_VALORISABLE',
                explication: `La fiche de l'article ${a.code} ne se valorise pas · ` +
                    valorisation.refus.map((r) => r.explication).join(' ') +
                    " Tant qu'elle ne se valorise pas, l'écart avec le comptage ne se chiffre pas : le " +
                    'chiffrer sur une fiche incomplète produirait un montant plausible et faux.',
            });
            continue;
        }
        const quantiteComptable = valorisation.quantiteFinale;
        const ecart = arrondir(a.quantitePhysique - quantiteComptable, 3);
        if (ecart === 0) {
            sansDifference.push({ articleId: a.articleId, code: a.code, quantite: quantiteComptable });
            continue;
        }
        const sens = ecart > 0 ? 'BONI' : 'MALI';
        const cout = coutUnitaireDeLaDifference(a, valorisation, sens);
        if (cout === null) {
            refus.push({
                articleId: a.articleId,
                code: a.code,
                motif: 'COUT_DU_BONI_NON_FOURNI',
                explication: `L'article ${a.code} présente un BONI de ${ecart} ${a.uniteMesure} et il est suivi en ` +
                    "P.E.P.S. Aucune source lue ne dit à quelle COUCHE rattacher des unités que les livres " +
                    "n'avaient pas : le P.E.P.S. règle l'ordre des SORTIES, il ne dit rien de l'entrée d'un " +
                    'boni. Le coût unitaire est donc demandé, avec sa source · c\'est elle que le réviseur ' +
                    'demandera. En C.M.P.A.C.E., la question ne se pose pas : le magasin ne détient qu\'une ' +
                    'seule valeur unitaire à cette date, et le module la retient.',
            });
            continue;
        }
        differences.push({
            articleId: a.articleId,
            code: a.code,
            designation: a.designation,
            uniteMesure: a.uniteMesure,
            compteNumero: a.compteNumero,
            compteIntitule: a.compteIntitule,
            methode: a.methode,
            sens,
            quantiteComptable,
            quantitePhysique: a.quantitePhysique,
            ecartQuantite: ecart,
            coutUnitaireRetenu: cout.coutUnitaire,
            montant: arrondir(Math.abs(ecart) * cout.coutUnitaire, 2),
            fondementDuCout: cout.fondement,
            compteVariation: correspondance.variation,
            intituleVariation: correspondance.intituleVariation,
        });
    }
    return {
        differences,
        sansDifference,
        refus,
        totalBoni: arrondir(differences.filter((d) => d.sens === 'BONI').reduce((s, d) => s + d.montant, 0), 2),
        totalMali: arrondir(differences.filter((d) => d.sens === 'MALI').reduce((s, d) => s + d.montant, 0), 2),
    };
}
function coutUnitaireDeLaDifference(a, valorisation, sens) {
    if (sens === 'MALI') {
        const ecart = arrondir(valorisation.quantiteFinale - (a.quantitePhysique ?? 0), 3);
        const ordreSuivant = Math.max(0, ...a.mouvements.map((m) => m.ordre)) + 1;
        const rejoue = (0, valorisation_stocks_1.valoriser)([
            ...a.mouvements,
            {
                ordre: ordreSuivant,
                date: '9999-12-31',
                sens: 'SORTIE',
                quantite: ecart,
                cout: null,
            },
        ], a.methode);
        const sortie = rejoue.mouvements.find((m) => m.ordre === ordreSuivant);
        if (!sortie || rejoue.refus.length > 0)
            return null;
        return {
            coutUnitaire: arrondir(sortie.valeur / ecart, 6),
            fondement: a.methode === 'PEPS'
                ? "Sortie valorisée en P.E.P.S. · les unités manquantes consomment les couches les plus anciennes encore en stock, comme toute sortie."
                : "Sortie valorisée au coût moyen pondéré en vigueur à la date de l'inventaire.",
        };
    }
    if (a.methode === 'CMPACE') {
        if (!(valorisation.quantiteFinale > 0)) {
            return coutFourni(a);
        }
        return {
            coutUnitaire: arrondir(valorisation.valeurFinale / valorisation.quantiteFinale, 6),
            fondement: "Coût moyen pondéré en vigueur à la date de l'inventaire · en C.M.P.A.C.E. le magasin ne détient qu'une seule valeur unitaire, et c'est la méthode qui la fixe, non l'éditeur.",
        };
    }
    return coutFourni(a);
}
function coutFourni(a) {
    if (a.coutUnitaireBoni === null ||
        a.coutUnitaireBoni === undefined ||
        !(a.coutUnitaireBoni > 0) ||
        !a.sourceCoutBoni) {
        return null;
    }
    return {
        coutUnitaire: a.coutUnitaireBoni,
        fondement: `Coût unitaire déclaré par le cabinet · ${a.sourceCoutBoni}.`,
    };
}
function lignesDeLaRegularisation(differences) {
    const lignes = [];
    for (const d of differences) {
        const libelle = `${d.sens === 'BONI' ? "Boni" : 'Mali'} d'inventaire · ${d.code} ${d.designation}`;
        lignes.push({
            compte: d.compteNumero,
            intitule: d.compteIntitule,
            libelle,
            sens: d.sens === 'BONI' ? 'DEBIT' : 'CREDIT',
            montant: d.montant,
        });
        lignes.push({
            compte: d.compteVariation,
            intitule: d.intituleVariation,
            libelle,
            sens: d.sens === 'BONI' ? 'CREDIT' : 'DEBIT',
            montant: d.montant,
        });
    }
    return lignes;
}
function arrondir(n, decimales) {
    const f = 10 ** decimales;
    return Math.round(n * f) / f;
}
//# sourceMappingURL=boni-mali-inventaire.js.map