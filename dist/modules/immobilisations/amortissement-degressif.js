"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.COMPTES_DEROGATOIRE = exports.TAUX_PREMIERE_ANNUITE_EXCEPTIONNELLE = exports.SEUIL_PRORATA_EXPORT_ARTICLE_36 = exports.CATEGORIES_ARTICLE_31 = void 0;
exports.coefficientDegressif = coefficientDegressif;
exports.motifRegimeAnterieurDegressif = motifRegimeAnterieurDegressif;
exports.avertissementsDureeFiscale = avertissementsDureeFiscale;
exports.prorataExport = prorataExport;
exports.motifRefusDeclarationExceptionnel = motifRefusDeclarationExceptionnel;
exports.motifRefusOptionDegressif = motifRefusOptionDegressif;
exports.planFiscalDegressif = planFiscalDegressif;
exports.derogatoireDeLExercice = derogatoireDeLExercice;
const mois_entre_1 = require("../../common/mois-entre");
const entree_en_vigueur_loi_23_053_1 = require("../../common/entree-en-vigueur-loi-23-053");
const bareme_fiscal_1 = require("./bareme-fiscal");
exports.CATEGORIES_ARTICLE_31 = [
    { cle: 'MATERIEL_INDUSTRIEL', libelle: "Matériels et outillages utilisés pour des opérations industrielles de fabrication, de transformation, d'extraction ou de transport, à l'exclusion des véhicules de tourisme" },
    { cle: 'MANUTENTION_LEVAGE', libelle: 'Matériels de manutention ou de levage, à l’exclusion des chariots métalliques mis à la disposition des clients des magasins' },
    { cle: 'INSTALLATIONS_ENERGIE', libelle: 'Installations productrices de vapeur, chaleur, énergie et froid industriel' },
    { cle: 'INSTALLATIONS_SECURITE', libelle: 'Installations de sécurité' },
    { cle: 'MEDICO_SOCIAL', libelle: 'Installations à caractère médico-social, à l’exclusion des installations purement sociales, d’ordre sportif ou uniquement consacrées à l’organisation des loisirs' },
    { cle: 'MACHINES_DE_BUREAU', libelle: 'Machines de bureau, à l’exclusion de tout autre matériel et du mobilier de bureau' },
    { cle: 'RECHERCHE', libelle: 'Matériel et outillage utilisés à des opérations de recherche scientifique ou technique' },
    { cle: 'MAGASINAGE_STOCKAGE', libelle: 'Installations de magasinage et de stockage, à l’exclusion des locaux servant à l’exercice de la profession' },
    { cle: 'HOTELLERIE', libelle: 'Immeubles et matériels des entreprises hôtelières, à l’exclusion des biens d’équipement des entreprises exerçant uniquement l’activité de restaurateur ou de cafetier' },
    { cle: 'AGRICULTURE_ELEVAGE', libelle: 'Machines agricoles et installations d’élevage, à l’exception des bâtiments et des terrains' },
];
function coefficientDegressif(dureeFiscaleAns) {
    if (!Number.isInteger(dureeFiscaleAns) || dureeFiscaleAns < 4 || dureeFiscaleAns > 20)
        return null;
    if (dureeFiscaleAns === 4)
        return 1.5;
    if (dureeFiscaleAns <= 6)
        return 2;
    return 2.5;
}
function motifRegimeAnterieurDegressif(dateMiseEnService) {
    if (!dateMiseEnService || dateMiseEnService.getTime() >= entree_en_vigueur_loi_23_053_1.ENTREE_EN_VIGUEUR_LOI_23_053.getTime())
        return null;
    return ('Bien mis en service avant le 1er janvier 2026 · le dégressif de la loi n° 23/053 (art. 31 à 35) et le barème de ' +
        "l'arrêté n° 013/2025 ne s'appliquent qu'à compter de cette date (loi, art. 153 ; arrêté, art. 6). Le régime antérieur " +
        "(O.-L. n° 69/009, art. 43 ter D et suivants) n'est pas calculé par OmegaX, qui ne prolonge ni ne recommence le plan " +
        'sous la loi nouvelle. La reprise du solde du dérogatoire déjà passé reste ouverte.');
}
function avertissementsDureeFiscale(o) {
    const nature = o.natureFiscaleCle ? (0, bareme_fiscal_1.natureDuBareme)(o.natureFiscaleCle) : undefined;
    if (!nature || o.dureeFiscaleAns == null)
        return [];
    const libelle = `« ${nature.designation} » (${nature.cle})`;
    const dansLesBornes = (a) => a >= 4 && a <= 20;
    if (!dansLesBornes(nature.dureeAns) && dansLesBornes(o.dureeFiscaleAns)) {
        return [
            `Le barème fixe ${nature.dureeAns} ans pour ${libelle} (arrêté n° 013/2025, art. 2), hors des quatre à vingt ans ` +
                `de la loi n° 23/053, art. 32, 1° · la durée déclarée de ${o.dureeFiscaleAns} ans fait seule entrer le bien au ` +
                "dégressif, et l'écart se justifie lors du contrôle, sous peine de rejet (arrêté, art. 4).",
        ];
    }
    if (o.dureeFiscaleAns < nature.dureeAns) {
        return [
            `Durée fiscale déclarée (${o.dureeFiscaleAns} ans) plus courte que celle du barème pour ${libelle} ` +
                `(${nature.dureeAns} ans, arrêté n° 013/2025, art. 2) · ce taux dérogatoire se justifie lors du contrôle, ` +
                'sous peine de rejet (arrêté, art. 4).',
        ];
    }
    return [];
}
exports.SEUIL_PRORATA_EXPORT_ARTICLE_36 = 0.2;
function prorataExport(d) {
    return d.chiffreAffairesExportHt / d.chiffreAffairesTotalHt;
}
function motifRefusDeclarationExceptionnel(d) {
    if (d.activiteIndustrielle !== true) {
        return "L'amortissement exceptionnel est réservé aux « entreprises industrielles qui fabriquent des produits ouvrés ou semi-ouvrés » (loi n° 23/053, art. 36) · le cabinet doit l'attester.";
    }
    const exp = d.chiffreAffairesExportHt;
    const tot = d.chiffreAffairesTotalHt;
    if (exp == null || tot == null || !(tot > 0) || exp < 0) {
        return "Le prorata de l'art. 36 se calcule sur le chiffre d'affaires hors taxes à l'exportation et le total hors taxes de l'année de mise en service · saisissez les deux montants.";
    }
    if (exp > tot)
        return "Le chiffre d'affaires à l'exportation ne peut pas dépasser le total du chiffre d'affaires.";
    if (!d.source?.trim()) {
        return "Indiquez la source des chiffres d'affaires (déclaration, états financiers de l'année de mise en service) · le prorata se justifie lors du contrôle.";
    }
    const prorata = prorataExport({ chiffreAffairesExportHt: exp, chiffreAffairesTotalHt: tot });
    if (prorata < exports.SEUIL_PRORATA_EXPORT_ARTICLE_36) {
        return `Prorata à l'exportation de ${(prorata * 100).toFixed(2)} %, sous les 20 % de la loi n° 23/053, art. 36 · le dégressif reste ouvert, pas l'exceptionnel.`;
    }
    return null;
}
function motifRefusOptionDegressif(o) {
    if (o.referentiel !== 'SYSCOHADA') {
        return "Le dégressif est une option de l'impôt sur les sociétés (loi n° 23/053, art. 31) · un dossier SYCEBNL n'y est pas soumis.";
    }
    if (o.personnePhysique && !o.exceptionnel) {
        return '« Les sociétés peuvent opter » (art. 31) · une entreprise individuelle ou un entreprenant n’est pas une société.';
    }
    if (o.exceptionnel) {
        const refus = motifRefusDeclarationExceptionnel(o.exceptionnel);
        if (refus)
            return refus;
    }
    const anterieur = motifRegimeAnterieurDegressif(o.dateMiseEnService);
    if (anterieur)
        return anterieur;
    if (o.numeroCompteImmobilisation.startsWith('21')) {
        return 'Les immobilisations incorporelles sont exclues du dégressif (art. 32, 2°).';
    }
    if (!exports.CATEGORIES_ARTICLE_31.some((c) => c.cle === o.categorie)) {
        return "La catégorie de l'art. 31 est obligatoire · la liste est limitative, et c'est la qualification du cabinet, qu'aucun numéro de compte ne donne.";
    }
    if (o.bienNeuf !== true)
        return "Le dégressif ne s'applique qu'aux biens NEUFS (art. 31) · le cabinet doit l'attester.";
    if (o.dureeFiscaleAns == null || coefficientDegressif(o.dureeFiscaleAns) === null) {
        return 'La durée normale d’utilisation fiscale (arrêté n° 013/2025) doit être de quatre à vingt ans, en années entières (art. 32, 1°).';
    }
    if (o.amortissementAnterieur > 0) {
        return "Un bien repris avec un amortissement antérieur n'a pas de plan fiscal connu depuis sa mise en service · l'option ne se reconstitue pas.";
    }
    if (o.dotationsPassees > 0) {
        return "L'option se prend avant la première dotation · le plan fiscal part de la mise en service (art. 33 et 34), et les annuités d'exercices déjà dotés ne se rattrapent pas.";
    }
    return null;
}
const arrondi = (n) => Math.round(n * 100) / 100;
function periodesImposables(e) {
    const periodes = [];
    let debut = e.dateDebut;
    while (debut <= e.dateFin) {
        const finAnnee = new Date(Date.UTC(debut.getUTCFullYear(), 11, 31));
        periodes.push({ dateDebut: debut, dateFin: finAnnee < e.dateFin ? finAnnee : e.dateFin });
        debut = new Date(Date.UTC(debut.getUTCFullYear() + 1, 0, 1));
    }
    return periodes;
}
exports.TAUX_PREMIERE_ANNUITE_EXCEPTIONNELLE = 0.6;
function planFiscalDegressif(p) {
    const coef = coefficientDegressif(p.dureeFiscaleAns);
    if (coef === null || !(p.base > 0) || !p.dateMiseEnService)
        return [];
    const taux = (1 / p.dureeFiscaleAns) * coef;
    const mes = new Date(Date.UTC(p.dateMiseEnService.getUTCFullYear(), p.dateMiseEnService.getUTCMonth(), 1));
    const lignes = [];
    let vr = p.base;
    let premiere = true;
    for (const e of [...p.exercices].sort((a, b) => a.dateDebut.getTime() - b.dateDebut.getTime())) {
        if (e.dateFin < mes)
            continue;
        if (vr <= 0.005)
            break;
        const vrDebut = vr;
        let annuiteExercice = 0;
        let mode = 'DEGRESSIF';
        for (const periode of periodesImposables(e)) {
            if (periode.dateFin < mes || vr <= 0.005)
                continue;
            let annuite;
            if (premiere && p.exceptionnel) {
                annuite = vr * exports.TAUX_PREMIERE_ANNUITE_EXCEPTIONNELLE;
                mode = 'EXCEPTIONNEL_ART_38';
                premiere = false;
            }
            else if (premiere) {
                const mois = Math.max(0, (0, mois_entre_1.moisEntre)(mes > periode.dateDebut ? mes : periode.dateDebut, periode.dateFin));
                annuite = vr * taux * (mois / 12);
                premiere = false;
            }
            else {
                const ecoules = Math.max(0, (0, mois_entre_1.moisEntre)(mes, periode.dateDebut) - 1) / 12;
                const restantes = p.dureeFiscaleAns - ecoules;
                const degressive = vr * taux;
                const lineaire = restantes <= 1 ? vr : vr / restantes;
                const garde = mode === 'EXCEPTIONNEL_ART_38';
                if (degressive < lineaire) {
                    annuite = lineaire;
                    if (!garde)
                        mode = 'LINEAIRE_ART_35';
                }
                else {
                    annuite = degressive;
                    if (!garde)
                        mode = 'DEGRESSIF';
                }
            }
            annuite = arrondi(Math.min(annuite, vr));
            annuiteExercice = arrondi(annuiteExercice + annuite);
            vr = arrondi(vr - annuite);
        }
        lignes.push({ exerciceId: e.id, valeurResiduelleDebut: arrondi(vrDebut), annuite: annuiteExercice, mode });
    }
    return lignes;
}
function derogatoireDeLExercice(annuiteFiscale, dotationComptable, cumulAnterieur) {
    const ecart = arrondi(annuiteFiscale - dotationComptable);
    if (ecart >= 0)
        return { dotation: ecart, reprise: 0, excedentAReintegrer: 0 };
    const reprise = arrondi(Math.min(-ecart, Math.max(0, cumulAnterieur)));
    return { dotation: 0, reprise, excedentAReintegrer: arrondi(-ecart - reprise) };
}
exports.COMPTES_DEROGATOIRE = { amortissementsDerogatoires: '15100000', dotationsHao: '85100000', reprisesHao: '86100000' };
//# sourceMappingURL=amortissement-degressif.js.map