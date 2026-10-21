"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RESERVE_TVA = void 0;
exports.lignesDeLaConsignation = lignesDeLaConsignation;
exports.lignesDuDenouement = lignesDuDenouement;
const nomenclature_emballages_1 = require("./nomenclature-emballages");
function lignesDeLaConsignation(c, referentiel) {
    if (!(c.montant > 0)) {
        return {
            lignes: [],
            refus: {
                motif: 'MONTANT_NON_POSITIF',
                explication: 'Une consignation porte le montant FACTURÉ à ce titre, strictement positif. Le sens de ' +
                    "l'opération est déjà dit par ÉMISE ou REÇUE · un montant négatif l'inverserait sans le " +
                    'dire.',
            },
            reserves: [],
        };
    }
    const role = c.sens === 'EMISE' ? 'DETTE_CONSIGNATION' : 'CREANCE_CONSIGNATION';
    const compte = (0, nomenclature_emballages_1.compteDuRole)(role, referentiel);
    const libelle = `Consignation · ${c.designation}`;
    const lignes = c.sens === 'EMISE'
        ? [
            { compte: c.compteTiers, intitule: c.intituleTiers, libelle, sens: 'DEBIT', montant: c.montant },
            { compte: compte.numero, intitule: compte.intitule, libelle, sens: 'CREDIT', montant: c.montant },
        ]
        : [
            { compte: compte.numero, intitule: compte.intitule, libelle, sens: 'DEBIT', montant: c.montant },
            { compte: c.compteTiers, intitule: c.intituleTiers, libelle, sens: 'CREDIT', montant: c.montant },
        ];
    return { lignes, refus: null, reserves: [exports.RESERVE_TVA] };
}
function lignesDuDenouement(c, mode, referentiel, prixDeReprise) {
    const dette = (0, nomenclature_emballages_1.compteDuRole)(c.sens === 'EMISE' ? 'DETTE_CONSIGNATION' : 'CREANCE_CONSIGNATION', referentiel);
    const reserves = [exports.RESERVE_TVA];
    if (mode === 'RESTITUTION') {
        const libelle = `Restitution · ${c.designation}`;
        return {
            lignes: c.sens === 'EMISE'
                ? [
                    { compte: dette.numero, intitule: dette.intitule, libelle, sens: 'DEBIT', montant: c.montant },
                    { compte: c.compteTiers, intitule: c.intituleTiers, libelle, sens: 'CREDIT', montant: c.montant },
                ]
                : [
                    { compte: c.compteTiers, intitule: c.intituleTiers, libelle, sens: 'DEBIT', montant: c.montant },
                    { compte: dette.numero, intitule: dette.intitule, libelle, sens: 'CREDIT', montant: c.montant },
                ],
            refus: null,
            reserves,
        };
    }
    if (mode === 'CONSERVATION') {
        const libelle = `Conservation · ${c.designation}`;
        if (c.sens === 'EMISE' && c.nature === 'MATERIEL') {
            const produit = (0, nomenclature_emballages_1.compteDuRole)('PRODUIT_CESSION_IMMO', referentiel);
            const vnc = (0, nomenclature_emballages_1.compteDuRole)('VALEUR_COMPTABLE_CESSION', referentiel);
            return {
                lignes: [],
                refus: {
                    motif: 'CESSION_IMMOBILISATION_HORS_MODULE',
                    explication: `La conservation par le client d'un MATÉRIEL consigné est une CESSION ` +
                        `D'IMMOBILISATION : la fiche du compte 41 route le ${dette.numero} vers le compte ` +
                        `${produit.numero} « ${produit.intitule} », mais elle ne décrit que le sort de la ` +
                        `dette de consignation, pas celui du bien. Une cession sort aussi la VALEUR ` +
                        `COMPTABLE NETTE au ${vnc.numero} et décomptabilise l'immobilisation, ce que cette ` +
                        `fiche ne dit pas. Passer ici la seule contrepartie de produit laisserait le matériel ` +
                        `AU BILAN pendant que son prix de cession est enregistré · l'écriture s'équilibrerait, ` +
                        `la balance boucherait, et l'actif comme le résultat seraient surévalués de la valeur ` +
                        `nette du bien. La cession se passe dans le module des immobilisations, qui tient le ` +
                        `plan d'amortissement et la dépréciation ; le ${dette.numero} s'y solde en règlement ` +
                        `du prix.`,
                },
                reserves,
            };
        }
        if (c.sens === 'EMISE') {
            const produit = (0, nomenclature_emballages_1.compteDuRole)('BONI_SUR_EMBALLAGES', referentiel);
            return {
                lignes: [
                    { compte: dette.numero, intitule: dette.intitule, libelle, sens: 'DEBIT', montant: c.montant },
                    { compte: produit.numero, intitule: produit.intitule, libelle, sens: 'CREDIT', montant: c.montant },
                ],
                refus: null,
                reserves,
            };
        }
        const role = c.nature === 'EMBALLAGE' ? 'ACHAT_EMBALLAGE_RECUPERABLE' : 'MATERIEL_EMBALLAGE';
        const destination = (0, nomenclature_emballages_1.compteDuRole)(role, referentiel);
        return {
            lignes: [
                {
                    compte: destination.numero,
                    intitule: destination.intitule,
                    libelle,
                    sens: 'DEBIT',
                    montant: c.montant,
                    ...(c.nature === 'MATERIEL' ? { reserve: nomenclature_emballages_1.RESERVE_DESCENTE } : {}),
                },
                { compte: dette.numero, intitule: dette.intitule, libelle, sens: 'CREDIT', montant: c.montant },
            ],
            refus: null,
            reserves,
        };
    }
    if (prixDeReprise === null || prixDeReprise === undefined) {
        return {
            lignes: [],
            refus: {
                motif: 'PRIX_DE_REPRISE_MANQUANT',
                explication: "Une reprise sous le prix de consignation suppose le PRIX REPRIS, et il ne se déduit de " +
                    "rien · c'est lui qui décide du montant de l'écart. Sans lui, le mali et le boni ne se " +
                    'chiffrent pas.',
            },
            reserves,
        };
    }
    if (!(prixDeReprise >= 0) || prixDeReprise >= c.montant) {
        return {
            lignes: [],
            refus: {
                motif: 'PRIX_DE_REPRISE_NON_INFERIEUR',
                explication: `Le prix repris (${prixDeReprise}) n'est pas INFÉRIEUR au montant de la consignation ` +
                    `(${c.montant}). Les deux fiches ne décrivent l'écart que « en cas de reprise pour un ` +
                    "montant INFÉRIEUR à celui de la consignation » · une reprise au même prix est une " +
                    'RESTITUTION, et aucune source lue ne traite la reprise à un prix supérieur.',
            },
            reserves,
        };
    }
    const ecart = arrondir(c.montant - prixDeReprise, 2);
    const libelle = `Reprise sous le prix de consignation · ${c.designation}`;
    if (c.sens === 'EMISE') {
        const boni = (0, nomenclature_emballages_1.compteDuRole)('BONI_SUR_EMBALLAGES', referentiel);
        return {
            lignes: [
                { compte: dette.numero, intitule: dette.intitule, libelle, sens: 'DEBIT', montant: c.montant },
                { compte: c.compteTiers, intitule: c.intituleTiers, libelle, sens: 'CREDIT', montant: prixDeReprise },
                { compte: boni.numero, intitule: boni.intitule, libelle, sens: 'CREDIT', montant: ecart },
            ],
            refus: null,
            reserves,
        };
    }
    const mali = (0, nomenclature_emballages_1.compteDuRole)('MALI_SUR_EMBALLAGES', referentiel);
    return {
        lignes: [
            { compte: c.compteTiers, intitule: c.intituleTiers, libelle, sens: 'DEBIT', montant: prixDeReprise },
            { compte: mali.numero, intitule: mali.intitule, libelle, sens: 'DEBIT', montant: ecart },
            { compte: dette.numero, intitule: dette.intitule, libelle, sens: 'CREDIT', montant: c.montant },
        ],
        refus: null,
        reserves,
    };
}
exports.RESERVE_TVA = "Aucune ligne de TVA n'est proposée. Les fiches des comptes 40 et 41 décrivent l'écriture ligne " +
    "à ligne et ne mentionnent aucune taxe, ni à la consignation ni à son dénouement, et le régime " +
    "de TVA d'une consignation n'est tranché nulle part dans le corpus lu. Si l'opération est " +
    'taxable, la ligne se saisit à la main.';
function arrondir(n, decimales) {
    const f = 10 ** decimales;
    return Math.round(n * f) / f;
}
//# sourceMappingURL=consignation.js.map