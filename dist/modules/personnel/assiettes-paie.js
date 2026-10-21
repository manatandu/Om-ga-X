"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NATURES_FOURNIES_EN_NATURE = exports.RESOLUTION_TAUX_LEGAL_ALLOCATIONS = exports.PLAFOND_LOGEMENT_POUR_CENT = exports.IMMUNITES_ARTICLE_69 = exports.HORS_REMUNERATION_ARTICLE_7 = void 0;
exports.explicationTauxLegalNonChiffre = explicationTauxLegalNonChiffre;
exports.assietteSociale = assietteSociale;
exports.assiettes = assiettes;
exports.assiettesExactes = assiettesExactes;
const au_centime_1 = require("./au-centime");
const decimal_exact_1 = require("../../common/decimal-exact");
exports.HORS_REMUNERATION_ARTICLE_7 = [
    'SOINS_DE_SANTE',
    'LOGEMENT_OU_SON_INDEMNITE',
    'ALLOCATIONS_FAMILIALES_LEGALES',
    'INDEMNITE_DE_TRANSPORT',
    'FRAIS_DE_VOYAGE_OU_AVANTAGE_DE_FONCTION',
];
exports.IMMUNITES_ARTICLE_69 = [
    {
        nature: 'ALLOCATIONS_FAMILIALES_LEGALES',
        point: 'article 69, 1',
        forme: 'PLAFOND',
        texte: "« les indemnités ou allocations familiales réellement accordées aux employés dans la mesure où elles ne dépassent pas les taux légaux »",
        conditionNonVerifiableParLeLogiciel: false,
    },
    {
        nature: 'LOGEMENT_OU_SON_INDEMNITE',
        point: 'article 69, 8, a)',
        forme: 'CONDITION',
        texte: "« pour autant que l'indemnité de logement ne dépasse 30 % de la rémunération »",
        conditionNonVerifiableParLeLogiciel: false,
    },
    {
        nature: 'INDEMNITE_DE_TRANSPORT',
        point: 'article 69, 8, b)',
        forme: 'CONDITION',
        texte: "« l'indemnité journalière de transport soit égale au coût du billet pratiqué localement avec un maximum de six courses de taxi pour les cadres et six courses de bus pour les autres membres du personnel. Dans tous les cas, la réalité et la nécessité du transport alloué à l'employé doivent être démontrées »",
        conditionNonVerifiableParLeLogiciel: true,
    },
    {
        nature: 'SOINS_DE_SANTE',
        point: 'article 69, 8, c)',
        forme: 'CONDITION',
        texte: "« les frais médicaux soient justifiés par les documents probants »",
        conditionNonVerifiableParLeLogiciel: true,
    },
];
exports.PLAFOND_LOGEMENT_POUR_CENT = 30;
exports.RESOLUTION_TAUX_LEGAL_ALLOCATIONS = "ARTICLE 69, 1 · le « taux légal » qui borne l'immunité est celui de la COLONNE 19 des annexes du décret " +
    "n° 25/22, converti au mois par le multiplicateur de l'article 7 et multiplié par le nombre d'enfants " +
    "bénéficiaires. Ce n'est PAS le montant de 8 100 FC de l'article 3 de l'arrêté ministériel n° 137/2018 : " +
    "celui-là est une prestation SERVIE DIRECTEMENT PAR LA CAISSE (art. 4 du même arrêté, art. 1er de " +
    "l'arrêté n° 143/2018), que l'employeur n'accorde pas et qui n'entre donc jamais dans le revenu " +
    "professionnel de l'article 68. L'article 69, 1 ne vise que ce qui est « RÉELLEMENT ACCORDÉ AUX EMPLOYÉS ».";
exports.NATURES_FOURNIES_EN_NATURE = [
    'LOGEMENT_OU_SON_INDEMNITE',
    'INDEMNITE_DE_TRANSPORT',
    'SOINS_DE_SANTE',
];
function explicationTauxLegalNonChiffre(immunite, nonCalcule) {
    const regle = `L'${immunite.point} de la loi n° 23/053 immunise ${immunite.texte}. Ce « taux légal » est ` +
        "l'allocation familiale journalière par enfant de la colonne 19 de la grille du SMIG du mois (décret " +
        "n° 25/22), multipliée par les jours ouvrant droit (vingt-six pour un mois entier) et par le nombre " +
        "d'enfants bénéficiaires.";
    if (nonCalcule?.cause === 'ENFANTS_BENEFICIAIRES_NON_RENSEIGNES') {
        return (`${regle} Le nombre d'enfants bénéficiaires n'est pas renseigné, et le plafond ne se place donc pas. ` +
            "Renseignez le nombre d'enfants bénéficiaires des allocations familiales (il ne se confond pas avec les " +
            "personnes à charge de l'impôt).");
    }
    if (nonCalcule?.cause === 'MOIS_SANS_GRILLE_DU_SMIG') {
        return (`${regle} OmegaX n'a aucune grille du SMIG pour ce mois de paie. ${nonCalcule.raison} Le plafond ne ` +
            "se calcule donc pas. Saisissez le taux légal du mois, montant mensuel pour l'ensemble des enfants " +
            "bénéficiaires, tiré du barème qui régissait cette paie.");
    }
    return (`${regle} Le nombre d'enfants bénéficiaires n'est pas renseigné, ou OmegaX n'a aucune grille du SMIG pour ` +
        "ce mois de paie · le plafond ne se place donc pas. Renseignez le nombre d'enfants bénéficiaires ; pour un " +
        "mois qu'aucune grille ne couvre, saisissez le taux légal du mois.");
}
const estHorsRemuneration = (nature) => exports.HORS_REMUNERATION_ARTICLE_7.includes(nature);
const MOTIF_HORS_REMUNERATION = {
    SOINS_DE_SANTE: 'les soins de santé',
    LOGEMENT_OU_SON_INDEMNITE: "l'indemnité de logement ou le logement en nature",
    ALLOCATIONS_FAMILIALES_LEGALES: 'les allocations familiales légales',
    INDEMNITE_DE_TRANSPORT: "l'indemnité de transport",
    FRAIS_DE_VOYAGE_OU_AVANTAGE_DE_FONCTION: "les frais de voyage ainsi que les avantages accordés exclusivement en vue de faciliter au travailleur l'accomplissement de ses fonctions",
};
function assietteSociale(elements) {
    const { montant, horsRemuneration } = assietteSocialeExacte(elements);
    return { montantFc: (0, decimal_exact_1.versNombre)(montant), horsRemuneration };
}
function assietteSocialeExacte(elements) {
    const horsRemuneration = [];
    let montant = decimal_exact_1.ZERO;
    for (const element of elements) {
        if (estHorsRemuneration(element.nature)) {
            horsRemuneration.push({
                libelle: element.libelle,
                montantFc: element.montantFc,
                motif: "Article 7, point 8 du Code du travail · ne sont pas éléments de la rémunération " +
                    `${MOTIF_HORS_REMUNERATION[element.nature]}. L'exclusion ne porte aucune condition.`,
            });
            continue;
        }
        montant = (0, decimal_exact_1.plus)(montant, (0, decimal_exact_1.depuisNombre)(element.montantFc));
    }
    return { montant, horsRemuneration };
}
function assiettes(elements, parametres = {}) {
    const { retenuesArticle71Fc, ...reste } = parametres;
    return assiettesExactes(elements, {
        ...reste,
        retenuesArticle71: (0, decimal_exact_1.depuisNombre)(retenuesArticle71Fc ?? 0),
    }).verdict;
}
function assiettesExactes(elements, parametres = {}) {
    const sociale = assietteSocialeExacte(elements);
    const socialeFc = (0, decimal_exact_1.versNombre)(sociale.montant);
    const sortsFiscaux = [];
    const abstentions = [];
    const reserves = [];
    let brutFiscal = decimal_exact_1.ZERO;
    const ajouterImposable = (fc) => {
        brutFiscal = (0, decimal_exact_1.plus)(brutFiscal, (0, decimal_exact_1.depuisNombre)(fc));
    };
    let indetermine = false;
    const estLigneLogement = (e) => e.remboursementDeDepenseProfessionnelleEffective !== true && e.nature === 'LOGEMENT_OU_SON_INDEMNITE';
    const totalLogementFc = elements.filter(estLigneLogement).reduce((t, e) => t + e.montantFc, 0);
    let tauxLegalRestantFc = parametres.tauxLegalAllocationsFamilialesFc ?? null;
    for (const element of elements) {
        if (element.remboursementDeDepenseProfessionnelleEffective === true) {
            sortsFiscaux.push({
                libelle: element.libelle,
                montantFc: element.montantFc,
                imposableFc: 0,
                motif: "Article 68, 1 · sont imposables les traitements et indemnités « qui ne représentent pas le remboursement de dépenses professionnelles effectives ». Le caractère effectif est qualifié par le cabinet.",
            });
            continue;
        }
        const immunite = exports.IMMUNITES_ARTICLE_69.find((i) => i.nature === element.nature);
        if (!immunite) {
            ajouterImposable(element.montantFc);
            sortsFiscaux.push({
                libelle: element.libelle,
                montantFc: element.montantFc,
                imposableFc: element.montantFc,
                motif: "Article 68 · imposable. L'article 69 ferme sa liste d'immunités, et cette nature n'y figure pas.",
            });
            continue;
        }
        if (immunite.forme === 'PLAFOND') {
            const tauxLegal = parametres.tauxLegalAllocationsFamilialesFc;
            if (tauxLegal === undefined || tauxLegal === null) {
                indetermine = true;
                abstentions.push({
                    motif: 'TAUX_LEGAL_ALLOCATIONS_FAMILIALES_NON_FOURNI',
                    libelle: element.libelle,
                    montantFc: element.montantFc,
                    explication: explicationTauxLegalNonChiffre(immunite, parametres.tauxLegalAllocationsNonCalcule ?? null),
                });
                sortsFiscaux.push({
                    libelle: element.libelle,
                    montantFc: element.montantFc,
                    imposableFc: null,
                    motif: `${immunite.point} · plafond non chiffrable, voir l'abstention.`,
                });
                continue;
            }
            const plafondRestantFc = (0, au_centime_1.auCentime)(Math.max(0, tauxLegalRestantFc ?? tauxLegal));
            const immunise = Math.min(element.montantFc, (0, au_centime_1.auCentime)(Math.min(element.montantFc, plafondRestantFc)));
            tauxLegalRestantFc = (0, au_centime_1.auCentime)(plafondRestantFc - immunise);
            const excedent = (0, au_centime_1.auCentime)(element.montantFc - immunise);
            ajouterImposable(excedent);
            sortsFiscaux.push({
                libelle: element.libelle,
                montantFc: element.montantFc,
                imposableFc: excedent,
                motif: `${immunite.point} · ${immunite.texte}. Taux légal retenu : ${tauxLegal.toFixed(2)} FC. ` +
                    (excedent > 0
                        ? `Seul l'excédent de ${excedent.toFixed(2)} FC est imposable.`
                        : "L'allocation est entièrement immunisée."),
            });
            continue;
        }
        if (immunite.conditionNonVerifiableParLeLogiciel) {
            const atteste = element.conditionArticle69Attestee;
            if (atteste === undefined || atteste === null) {
                indetermine = true;
                abstentions.push({
                    motif: 'CONDITION_ARTICLE_69_NON_ATTESTEE',
                    libelle: element.libelle,
                    montantFc: element.montantFc,
                    explication: `${immunite.point} n'immunise que ${immunite.texte}. Cette condition n'est dans aucun livre comptable : ` +
                        "elle se constate sur pièces, et le cabinet l'atteste. Sans attestation, OmegaX ne l'immunise pas de lui-même et ne l'impose pas non plus.",
                });
                sortsFiscaux.push({
                    libelle: element.libelle,
                    montantFc: element.montantFc,
                    imposableFc: null,
                    motif: `${immunite.point} · condition non attestée, voir l'abstention.`,
                });
                continue;
            }
            const imposableFc = atteste ? 0 : element.montantFc;
            ajouterImposable(imposableFc);
            sortsFiscaux.push({
                libelle: element.libelle,
                montantFc: element.montantFc,
                imposableFc,
                motif: atteste
                    ? `${immunite.point} · condition attestée par le cabinet, l'immunité joue.`
                    : `${immunite.point} · condition NON remplie, l'immunité ne joue pas. Le montant entier est imposable (${immunite.forme.toLowerCase()}, non plafond).`,
            });
            continue;
        }
        const remunerationCentimes = (0, au_centime_1.enCentimes)(socialeFc);
        const conditionRemplie = (0, au_centime_1.enCentimes)(totalLogementFc) * 100 <= remunerationCentimes * exports.PLAFOND_LOGEMENT_POUR_CENT;
        const plafondMillimes = remunerationCentimes * exports.PLAFOND_LOGEMENT_POUR_CENT / 10;
        const plafondFc = plafondMillimes / 1000;
        const plafondAffiche = Number.isInteger(plafondMillimes / 10) ? plafondFc.toFixed(2) : plafondFc.toFixed(3);
        const imposableFc = conditionRemplie ? 0 : element.montantFc;
        ajouterImposable(imposableFc);
        sortsFiscaux.push({
            libelle: element.libelle,
            montantFc: element.montantFc,
            imposableFc,
            motif: `${immunite.point} · ${immunite.texte}. Indemnité de logement du mois, toutes lignes : ${totalLogementFc.toFixed(2)} FC, ` +
                `plafond de comparaison : ${plafondAffiche} FC. ` +
                (conditionRemplie
                    ? "La condition est remplie, l'immunité joue tout entière."
                    : "La condition n'est PAS remplie, et le point est écrit « pour autant que », non « dans la limite de » : l'immunité ne joue pas du tout, le montant entier est imposable."),
        });
        reserves.push("BASE DES 30 % · l'article 69, 8, a) dit « de la rémunération » sans la définir. OmegaX la prend au sens de " +
            "l'article 7, point 8 du Code du travail, qui en exclut justement le logement, soit " +
            `${socialeFc.toFixed(2)} FC. Une lecture qui y inclurait le logement élargirait le plafond.`);
    }
    const retenues71 = (0, decimal_exact_1.maximum)(decimal_exact_1.ZERO, parametres.retenuesArticle71 ?? decimal_exact_1.ZERO);
    const retenuesArticle71Fc = (0, decimal_exact_1.versNombre)(retenues71);
    const assietteFiscaleBruteFc = indetermine ? null : (0, decimal_exact_1.versNombre)(brutFiscal);
    const quotePartNonChiffree = parametres.quotePartOuvriereNonChiffree ?? null;
    const motifAssietteNetteNonChiffree = assietteFiscaleBruteFc !== null && quotePartNonChiffree
        ? "Base fiscale nette NON CHIFFRÉE · elle est nette des versements « réellement effectués à titre définitif » " +
            "à une caisse de pension officielle (loi n° 23/053, art. 70 et 71), et la quote-part ouvrière de la CNSS " +
            `ne l'est pas · ${quotePartNonChiffree} L'impôt et le net ne se chiffrent donc pas non plus.`
        : null;
    const netteExacte = assietteFiscaleBruteFc === null || motifAssietteNetteNonChiffree !== null
        ? null
        : (0, decimal_exact_1.maximum)(decimal_exact_1.ZERO, (0, decimal_exact_1.moins)(brutFiscal, retenues71));
    const assietteFiscaleNetteFc = netteExacte === null ? null : (0, decimal_exact_1.versNombre)(netteExacte);
    if (retenuesArticle71Fc > 0) {
        reserves.push("ARTICLE 71 · les retenues déduites sont « les versements réellement effectués à titre définitif, soit à des " +
            "caisses de pension officielles, soit obligatoirement sous le patronage de l'employeur ». La quote-part " +
            "ouvrière de la CNSS y entre, le régime général de la loi n° 16/009 étant une caisse de pension officielle. " +
            "Les cotisations patronales n'y entrent pas : elles ne sont pas retenues sur le revenu du travailleur.");
    }
    return {
        verdict: {
            assietteSocialeFc: socialeFc,
            horsRemuneration: sociale.horsRemuneration,
            assietteFiscaleBruteFc,
            sortsFiscaux,
            retenuesArticle71Fc,
            assietteFiscaleNetteFc,
            motifAssietteNetteNonChiffree,
            abstentions,
            reserves: [...new Set(reserves)],
        },
        socialeExacte: sociale.montant,
        netteExacte,
    };
}
//# sourceMappingURL=assiettes-paie.js.map