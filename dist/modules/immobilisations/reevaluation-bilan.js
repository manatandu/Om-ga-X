"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MOTIF_VALEUR_NETTE_NULLE = exports.MOTIF_ELEMENT_MONETAIRE = exports.MOTIF_DIVISION_20 = exports.MOTIF_DEPRECIE = exports.RACINES_ELEMENTS_MONETAIRES = exports.COMPTE_PROVISION_SPECIALE = exports.COMPTE_REPRISE_PROVISION_SPECIALE = void 0;
exports.natureReevaluable = natureReevaluable;
exports.estElementMonetaire = estElementMonetaire;
exports.estBienRecuDestineALaVente = estBienRecuDestineALaVente;
exports.compteEcart = compteEcart;
exports.produitCoefficients = produitCoefficients;
exports.coefficientApplique = coefficientApplique;
exports.reevaluerBien = reevaluerBien;
exports.lignesBien = lignesBien;
exports.anneesRestantes = anneesRestantes;
exports.supplementDotation = supplementDotation;
exports.partsDuSupplement = partsDuSupplement;
exports.imputationSurEcart = imputationSurEcart;
const EPSILON = 0.005;
const centimes = (x) => Math.round(x * 100) / 100;
exports.COMPTE_REPRISE_PROVISION_SPECIALE = '86100000';
exports.COMPTE_PROVISION_SPECIALE = '15400000';
function natureReevaluable(numeroCompte, referentiel) {
    if (/^2[234]/.test(numeroCompte))
        return 'CORPORELLE';
    if (/^2[67]/.test(numeroCompte))
        return 'FINANCIERE';
    if (referentiel === 'SYCEBNL' && /^20[234]/.test(numeroCompte))
        return 'CORPORELLE';
    if (referentiel === 'SYCEBNL' && numeroCompte.startsWith('205'))
        return 'FINANCIERE';
    return null;
}
exports.RACINES_ELEMENTS_MONETAIRES = ['2711', '2712', '2713', '2718', '272', '273', '275', '276', '277', '2781', '2782', '2784'];
function estElementMonetaire(numeroCompte) {
    return exports.RACINES_ELEMENTS_MONETAIRES.some((r) => numeroCompte.startsWith(r));
}
function estBienRecuDestineALaVente(numeroCompte, referentiel) {
    return referentiel === 'SYCEBNL' && /^20[2-5]/.test(numeroCompte);
}
function compteEcart(o) {
    if (o.neutraliteFiscale) {
        if (o.type !== 'LEGALE') {
            return {
                motif: "La provision spéciale de réévaluation (154) ne s'écrit que pour une réévaluation légale · la " +
                    'réévaluation libre crédite le 1062 (AUDCIF Titre VIII ch. 28 § 4.2.4.1 et § 4.3.1).',
            };
        }
        if (o.amortissable)
            return { compte: exports.COMPTE_PROVISION_SPECIALE };
    }
    if (o.referentiel === 'SYSCOHADA')
        return { compte: o.type === 'LEGALE' ? '10610000' : '10620000' };
    if (o.droitDeReprise === null || o.droitDeReprise === undefined) {
        return {
            motif: "Au SYCEBNL, l'écart se range selon que le bien est grevé ou non d'un droit de reprise (1061 sans, 1062 " +
                'avec · SYCEBNL Partie 2 ch. 2) · déclarez-le pour chaque bien réévalué.',
        };
    }
    const corporelle = o.nature === 'CORPORELLE';
    if (o.droitDeReprise)
        return { compte: corporelle ? '10621000' : '10622000' };
    return { compte: corporelle ? '10611000' : '10612000' };
}
exports.MOTIF_DEPRECIE = "Bien déprécié · « la dépréciation a pour objet de ramener la valeur comptable nette de l'élément à la valeur " +
    "actuelle à la date du bilan. En conséquence, l'élément ne saurait être réévalué à cette date » (AUDCIF Titre VIII " +
    'ch. 28 § 4.2.3). Il reste dans l’opération à sa valeur nette.';
exports.MOTIF_DIVISION_20 = 'Bien reçu en don ou legs et destiné à la vente (division 20) · inscrit à sa valeur actuelle par le crédit du ' +
    'fonds reporté (172) et déprécié au 2902 (SYCEBNL, fiche du compte 20 ; Partie 3 ch. 2). Le texte ne dit pas ' +
    'comment la réévaluation le traite · il reste dans l’opération à sa valeur, sans écart.';
exports.MOTIF_ELEMENT_MONETAIRE = 'Élément monétaire (prêt, créance, dépôt, cautionnement, intérêts courus) · la réévaluation ne vise que « un bien ou ' +
    'un élément non monétaire » (AUDCIF Titre VIII ch. 28 § 1.2), l’élément monétaire étant déjà « exprimé dans ' +
    'l’unité monétaire en vigueur » (§ 7.2.2.1) · il reste dans l’opération à sa valeur, sans valeur actuelle à déclarer.';
exports.MOTIF_VALEUR_NETTE_NULLE = 'Valeur nette nulle · le coefficient ne s’applique à rien. Un bien totalement amorti qui garde une valeur ' +
    'actuelle positive appelle un nouveau plan (ch. 28 § 4.2.2), que l’opération ne définit pas.';
function produitCoefficients(coefficients) {
    return coefficients.reduce((p, k) => p * k, 1);
}
const EPSILON_COEFFICIENT = 1e-9;
function coefficientApplique(o) {
    if (Math.abs(o.produitAnterieur - 1) <= EPSILON_COEFFICIENT)
        return { coefficient: o.coefficient };
    if (o.base !== 'ORIGINE' && o.base !== 'DERNIERE_REEVALUATION') {
        return {
            refus: `bien déjà réévalué (coefficients déjà appliqués · ${o.produitAnterieur.toFixed(6)}) · déclarez pour sa ` +
                'catégorie si le coefficient de l’arrêté court depuis l’acquisition ou depuis la dernière réévaluation. Le ' +
                'coefficient s’applique à la valeur nette inscrite, réévaluations antérieures comprises (AUDCIF Titre VIII ' +
                'ch. 28 § 4.2.1.1), et le texte ne dit pas ce que l’arrêté mesure (loi n° 23/053, art. 129).',
        };
    }
    if (o.base === 'DERNIERE_REEVALUATION')
        return { coefficient: o.coefficient };
    const converti = o.coefficient / o.produitAnterieur;
    if (converti < 1 - EPSILON_COEFFICIENT) {
        return {
            refus: `coefficient depuis l’acquisition ${o.coefficient} ÷ coefficients déjà appliqués ${o.produitAnterieur.toFixed(6)} = ` +
                `${converti.toFixed(6)}, inférieur à 1 · la valeur indiciaire serait sous la valeur nette inscrite, cas que ` +
                'le texte ne règle pas (AUDCIF Titre VIII ch. 28 § 4.2.1.1 et § 4.2.1.3).',
        };
    }
    return { coefficient: converti };
}
function reevaluerBien(bien, saisie, op) {
    const nature = natureReevaluable(bien.numeroCompte, op.referentiel);
    if (!nature)
        return { refus: `« ${bien.designation} » (${bien.numeroCompte}) n'est ni une immobilisation corporelle ni une immobilisation financière.` };
    const valeurNette = centimes(bien.valeurOrigine - bien.cumulAmortissements - bien.cumulDepreciation);
    const garde = (motif) => ({
        id: bien.id,
        designation: bien.designation,
        nature,
        valeurNetteAvant: valeurNette,
        coefficient: null,
        coefficientDeclare: null,
        produitAnterieur: produitCoefficients(bien.coefficientsAnterieurs),
        coefficientRetenu: 1,
        valeurReevaluee: valeurNette,
        brutApres: bien.valeurOrigine,
        amortissementsApres: bien.cumulAmortissements,
        valeurResiduelleApres: bien.valeurResiduelle,
        deltaBrut: 0,
        deltaAmortissements: 0,
        ecart: 0,
        compteEcart: null,
        motifNonReevalue: motif,
    });
    if (estBienRecuDestineALaVente(bien.numeroCompte, op.referentiel))
        return garde(exports.MOTIF_DIVISION_20);
    if (estElementMonetaire(bien.numeroCompte))
        return garde(exports.MOTIF_ELEMENT_MONETAIRE);
    if (bien.cumulDepreciation > EPSILON)
        return garde(exports.MOTIF_DEPRECIE);
    if (op.type === 'LEGALE' && valeurNette <= EPSILON)
        return garde(exports.MOTIF_VALEUR_NETTE_NULLE);
    const va = saisie.valeurActuelle;
    if (va === null || va === undefined || !Number.isFinite(va) || va < 0) {
        return {
            refus: `Valeur actuelle de « ${bien.designation} » non déclarée · la valeur réévaluée « ne peut, en aucun cas, ` +
                'dépasser sa juste valeur à la date prise en compte pour point de départ de la réévaluation, c’est-à-dire sa ' +
                'valeur actuelle » (AUDCIF art. 63), et la méthode indiciaire « n’échappe pas à la détermination des valeurs ' +
                'actuelles » (ch. 28 § 3.1.2).',
        };
    }
    if (valeurNette <= EPSILON) {
        if (op.type === 'LIBRE' && va > EPSILON) {
            return {
                refus: `« ${bien.designation} » est totalement amorti et vous lui déclarez une valeur actuelle de ${va.toFixed(2)} · ` +
                    '« un plan d’amortissement doit être défini » (ch. 28 § 4.2.2), ce que cette opération ne fait pas. ' +
                    'Déclarez sa valeur actuelle à zéro, ou réévaluez-le hors de ce module.',
            };
        }
        return garde(exports.MOTIF_VALEUR_NETTE_NULLE);
    }
    let coefficient = null;
    let coefficientDeclare = null;
    const produitAnterieur = produitCoefficients(bien.coefficientsAnterieurs);
    let valeurReevaluee;
    if (op.type === 'LEGALE') {
        const cle = saisie.categorie ?? '';
        const k = op.coefficients[cle];
        if (!cle || k === undefined || !Number.isFinite(k) || k <= 0) {
            return {
                refus: `Catégorie de « ${bien.designation} » sans coefficient déclaré · la valeur indiciaire est la valeur nette ` +
                    '« multipliée par le coefficient ou l’indice de l’année (correspondant à la catégorie de biens) » ' +
                    '(ch. 28 § 4.2.1.1), fixé par arrêté du Ministre des Finances (loi n° 23/053, art. 129).',
            };
        }
        const applique = coefficientApplique({ coefficient: k, base: op.bases[cle], produitAnterieur });
        if ('refus' in applique)
            return { refus: `« ${bien.designation} » · ${applique.refus}` };
        coefficientDeclare = k;
        coefficient = applique.coefficient;
        valeurReevaluee = Math.min(centimes(valeurNette * coefficient), centimes(va));
    }
    else {
        valeurReevaluee = centimes(va);
    }
    if (valeurReevaluee < valeurNette - EPSILON) {
        return {
            refus: `« ${bien.designation} » · la valeur retenue (${valeurReevaluee.toFixed(2)}) est inférieure à sa valeur nette ` +
                `(${valeurNette.toFixed(2)}). Une perte de valeur se constate par une dépréciation (AUDCIF Titre VIII ch. 12) ` +
                'avant la réévaluation, qui ne fait que substituer une valeur réévaluée à la valeur nette (art. 62 et 63).',
        };
    }
    const compte = compteEcart({
        referentiel: op.referentiel,
        type: op.type,
        neutraliteFiscale: op.neutraliteFiscale,
        nature,
        amortissable: bien.amortissable,
        droitDeReprise: saisie.droitDeReprise,
    });
    const ecart = centimes(valeurReevaluee - valeurNette);
    if ('motif' in compte && ecart > EPSILON)
        return { refus: compte.motif };
    const coefficientRetenu = valeurReevaluee / valeurNette;
    const valeurResiduelleApres = centimes(bien.valeurResiduelle * coefficientRetenu);
    const elimination = op.type === 'LIBRE' && op.methodeLibre === 'ELIMINATION';
    if (elimination && bien.amortissable && bien.planCommence && ecart > EPSILON) {
        if (!bien.lineaire) {
            return {
                refus: `« ${bien.designation} » n'est pas amorti en linéaire · la méthode 2 du § 4.3.1 répartit la nouvelle valeur ` +
                    'sur les annuités restantes, ce que le moteur ne fait qu’au linéaire. Retenez la méthode 1, qui donne les ' +
                    'mêmes annuités multipliées par le coefficient.',
            };
        }
        if (bien.anneesRestantes === null || bien.anneesRestantes < 1) {
            return {
                refus: `« ${bien.designation} » · la durée restant à courir n'est pas un nombre entier d'années (premier exercice ` +
                    'au prorata), et la méthode 2 la porterait mal. Retenez la méthode 1, qui donne les mêmes annuités ' +
                    'multipliées par le coefficient (§ 4.3.1).',
            };
        }
        return {
            id: bien.id,
            designation: bien.designation,
            nature,
            valeurNetteAvant: valeurNette,
            coefficient,
            coefficientDeclare,
            produitAnterieur,
            coefficientRetenu,
            valeurReevaluee,
            brutApres: valeurReevaluee,
            amortissementsApres: 0,
            valeurResiduelleApres,
            deltaBrut: centimes(valeurReevaluee - bien.valeurOrigine),
            deltaAmortissements: centimes(-bien.cumulAmortissements),
            ecart,
            compteEcart: 'compte' in compte ? compte.compte : null,
            motifNonReevalue: null,
        };
    }
    const amortissementsApres = centimes(bien.cumulAmortissements * coefficientRetenu);
    const brutApres = centimes(valeurReevaluee + amortissementsApres);
    return {
        id: bien.id,
        designation: bien.designation,
        nature,
        valeurNetteAvant: valeurNette,
        coefficient,
        coefficientDeclare,
        produitAnterieur,
        coefficientRetenu,
        valeurReevaluee,
        brutApres,
        amortissementsApres,
        valeurResiduelleApres,
        deltaBrut: centimes(brutApres - bien.valeurOrigine),
        deltaAmortissements: centimes(amortissementsApres - bien.cumulAmortissements),
        ecart,
        compteEcart: ecart > EPSILON && 'compte' in compte ? compte.compte : null,
        motifNonReevalue: ecart > EPSILON ? null : 'Valeur retenue égale à la valeur nette · aucun écart.',
    };
}
function lignesBien(r, methode) {
    if (r.ecart <= EPSILON)
        return [];
    const lignes = [];
    if (methode === 'ELIMINATION' && r.amortissementsApres === 0 && r.deltaAmortissements < -EPSILON) {
        const cumul = -r.deltaAmortissements;
        lignes.push({ role: 'AMORTISSEMENT', debit: cumul, credit: 0 }, { role: 'BIEN', debit: 0, credit: cumul });
        lignes.push({ role: 'BIEN', debit: r.ecart, credit: 0 }, { role: 'ECART', debit: 0, credit: r.ecart });
        return lignes;
    }
    if (r.deltaBrut > EPSILON)
        lignes.push({ role: 'BIEN', debit: r.deltaBrut, credit: 0 });
    if (r.deltaAmortissements > EPSILON)
        lignes.push({ role: 'AMORTISSEMENT', debit: 0, credit: r.deltaAmortissements });
    lignes.push({ role: 'ECART', debit: 0, credit: r.ecart });
    return lignes;
}
function anneesRestantes(o) {
    if (o.revision && o.revision.effet <= o.ouvertureSuivante) {
        const mois = (o.ouvertureSuivante.getUTCFullYear() - o.revision.effet.getUTCFullYear()) * 12 +
            (o.ouvertureSuivante.getUTCMonth() - o.revision.effet.getUTCMonth());
        if (mois % 12 !== 0)
            return null;
        const reste = o.revision.dureeResiduelleAns - mois / 12;
        return reste >= 1 ? reste : null;
    }
    const base = o.valeurOrigine - o.valeurResiduelle;
    if (!(o.dureeAns > 0) || base <= EPSILON)
        return null;
    const reste = (o.dureeAns * (o.valeurNette - o.valeurResiduelle)) / base;
    const entier = Math.round(reste);
    return Math.abs(reste - entier) < 1e-4 && entier >= 1 ? entier : null;
}
function supplementDotation(o) {
    if (o.coefficientRetenu <= 1 + 1e-9 || o.dotation <= EPSILON || o.resteProvision <= EPSILON)
        return 0;
    if (!(o.produitPosterieur > 0))
        return 0;
    return Math.min(centimes(o.resteProvision), centimes((o.dotation / o.produitPosterieur) * (1 - 1 / o.coefficientRetenu)));
}
function partsDuSupplement(dotation, chaine) {
    return chaine.map((op, i) => {
        const produitPosterieur = produitCoefficients(chaine.slice(i + 1).map((x) => x.coefficientRetenu));
        return {
            id: op.id,
            produitPosterieur,
            montant: op.provisionSpeciale
                ? supplementDotation({ dotation, coefficientRetenu: op.coefficientRetenu, produitPosterieur, resteProvision: op.resteProvision })
                : 0,
        };
    });
}
function imputationSurEcart(montant, ecarts) {
    let reste = centimes(montant);
    const parEcart = [];
    for (const e of ecarts) {
        if (reste <= EPSILON)
            break;
        if (!e.compteEcart.startsWith('106') || e.reste <= EPSILON)
            continue;
        const m = Math.min(reste, centimes(e.reste));
        parEcart.push({ id: e.id, compteEcart: e.compteEcart, montant: m });
        reste = centimes(reste - m);
    }
    return { parEcart, enCharge: reste };
}
//# sourceMappingURL=reevaluation-bilan.js.map