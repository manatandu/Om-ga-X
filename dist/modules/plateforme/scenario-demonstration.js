"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mouvementsBanque = mouvementsBanque;
exports.scenarioDemonstration = scenarioDemonstration;
const client_1 = require("@prisma/client");
const deux = (a, b, montant) => [
    { ...a, montant },
    { ...b, montant },
];
const SYCEBNL = {
    nomEntite: 'Association Santé pour Tous (démonstration)',
    activite: 'Démonstration · association fictive, toutes les données de ce dossier sont fictives',
    tiers: [
        { code: 'ADH001', nom: 'Membre Kabeya (fictif)', type: client_1.TypeTiers.ADHERENT },
        { code: 'ADH002', nom: 'Membre Mwamba (fictif)', type: client_1.TypeTiers.ADHERENT },
        { code: 'FRN001', nom: 'Papeterie du Centre (fictif)', type: client_1.TypeTiers.FOURNISSEUR },
        { code: 'FRN002', nom: 'Transports Lukusa (fictif)', type: client_1.TypeTiers.FOURNISSEUR },
    ],
    operations: [
        { jour: '01-15', journal: 'BQ', libelle: 'Don reçu · campagne de janvier', lignes: deux({ tresorerie: true, sens: 'DEBIT' }, { nature: '70410000', sens: 'CREDIT' }, 2_500_000) },
        { jour: '01-31', journal: 'OD', libelle: 'Appel de cotisation · Kabeya', lignes: deux({ tiers: 'ADH001', sens: 'DEBIT' }, { nature: '70100000', sens: 'CREDIT' }, 120_000) },
        { jour: '01-31', journal: 'OD', libelle: 'Appel de cotisation · Mwamba', lignes: deux({ tiers: 'ADH002', sens: 'DEBIT' }, { nature: '70100000', sens: 'CREDIT' }, 120_000) },
        { jour: '02-20', journal: 'BQ', libelle: 'Recouvrement de cotisation · Kabeya', lignes: deux({ tresorerie: true, sens: 'DEBIT' }, { tiers: 'ADH001', sens: 'CREDIT' }, 120_000) },
        { jour: '03-10', journal: 'ACH', libelle: 'Fournitures de bureau', reference: 'PC-2031', lignes: deux({ nature: '60110000', sens: 'DEBIT' }, { tiers: 'FRN001', sens: 'CREDIT' }, 450_000) },
        { jour: '03-25', journal: 'BQ', libelle: 'Règlement · Papeterie du Centre', reference: 'PC-2031', lignes: deux({ tiers: 'FRN001', sens: 'DEBIT' }, { tresorerie: true, sens: 'CREDIT' }, 450_000) },
        { jour: '04-30', journal: 'OD', libelle: 'Salaires d’avril · brut', lignes: [{ nature: '66110000', sens: 'DEBIT', montant: 800_000 }, { nature: '42200000', sens: 'CREDIT', montant: 800_000 }] },
        { jour: '05-12', journal: 'ACH', libelle: 'Transport de matériel médical', reference: 'TL-118', lignes: deux({ nature: '60110000', sens: 'DEBIT' }, { tiers: 'FRN002', sens: 'CREDIT' }, 300_000) },
        { jour: '06-15', journal: 'BQ', libelle: 'Don reçu · journée portes ouvertes', lignes: deux({ tresorerie: true, sens: 'DEBIT' }, { nature: '70410000', sens: 'CREDIT' }, 1_000_000) },
    ],
    immobilisations: [
        { jour: '02-05', designation: 'Ordinateurs du centre de santé (fictif)', numeroInventaire: 'INV-001', famille: 'INFORMATIQUE', valeur: 1_200_000 },
        { jour: '04-15', designation: 'Mobilier de la salle d’attente (fictif)', numeroInventaire: 'INV-002', famille: 'MOBILIER', valeur: 600_000 },
    ],
    salarie: {
        matricule: 'DEMO-001',
        nom: 'Ilunga (fictif)',
        prenoms: 'Grâce',
        sexe: client_1.SexeTravailleur.FEMININ,
        nationalite: 'Congolaise',
        natureTravail: 'Infirmière',
        type: client_1.TypeContratTravail.DUREE_INDETERMINEE,
        remunerationMensuelleFc: 800_000,
        moisBulletin: '05',
    },
    jourReleve: '03-31',
    questionnaire: 'Révision de l’exercice (démonstration)',
};
const SYSCOHADA = {
    nomEntite: 'Kivu Négoce SARL (démonstration)',
    activite: 'Démonstration · société fictive, toutes les données de ce dossier sont fictives',
    tiers: [
        { code: 'CLI001', nom: 'Boutique Mboka (fictif)', type: client_1.TypeTiers.CLIENT },
        { code: 'CLI002', nom: 'Hôtel du Lac (fictif)', type: client_1.TypeTiers.CLIENT },
        { code: 'FRN001', nom: 'Grossiste Import (fictif)', type: client_1.TypeTiers.FOURNISSEUR },
        { code: 'FRN002', nom: 'Transports Lukusa (fictif)', type: client_1.TypeTiers.FOURNISSEUR },
    ],
    operations: [
        { jour: '01-15', journal: 'ACH', libelle: 'Achat de marchandises', reference: 'GI-501', lignes: deux({ nature: '60110000', sens: 'DEBIT' }, { tiers: 'FRN001', sens: 'CREDIT' }, 3_000_000) },
        { jour: '01-20', journal: 'VEN', libelle: 'Vente de marchandises · Mboka', reference: 'F-0001', lignes: deux({ tiers: 'CLI001', sens: 'DEBIT' }, { nature: '70110000', sens: 'CREDIT' }, 4_200_000) },
        { jour: '02-10', journal: 'BQ', libelle: 'Encaissement · Mboka', reference: 'F-0001', lignes: deux({ tresorerie: true, sens: 'DEBIT' }, { tiers: 'CLI001', sens: 'CREDIT' }, 4_200_000) },
        { jour: '02-15', journal: 'BQ', libelle: 'Règlement · Grossiste Import', reference: 'GI-501', lignes: deux({ tiers: 'FRN001', sens: 'DEBIT' }, { tresorerie: true, sens: 'CREDIT' }, 3_000_000) },
        { jour: '03-05', journal: 'VEN', libelle: 'Prestation de services · Hôtel du Lac', reference: 'F-0002', lignes: deux({ tiers: 'CLI002', sens: 'DEBIT' }, { nature: '70610000', sens: 'CREDIT' }, 1_500_000) },
        { jour: '03-30', journal: 'BQ', libelle: 'Encaissement partiel · Hôtel du Lac', reference: 'F-0002', lignes: deux({ tresorerie: true, sens: 'DEBIT' }, { tiers: 'CLI002', sens: 'CREDIT' }, 1_000_000) },
        { jour: '04-10', journal: 'ACH', libelle: 'Transport de marchandises', reference: 'TL-204', lignes: deux({ nature: '60110000', sens: 'DEBIT' }, { tiers: 'FRN002', sens: 'CREDIT' }, 600_000) },
        { jour: '04-30', journal: 'OD', libelle: 'Salaires d’avril · brut', lignes: [{ nature: '66110000', sens: 'DEBIT', montant: 900_000 }, { nature: '42200000', sens: 'CREDIT', montant: 900_000 }] },
        { jour: '05-15', journal: 'VEN', libelle: 'Vente de marchandises · Hôtel du Lac', reference: 'F-0003', lignes: deux({ tiers: 'CLI002', sens: 'DEBIT' }, { nature: '70110000', sens: 'CREDIT' }, 2_000_000) },
    ],
    immobilisations: [
        { jour: '02-25', designation: 'Ordinateurs du bureau (fictif)', numeroInventaire: 'INV-001', famille: 'INFORMATIQUE', valeur: 800_000 },
        { jour: '04-20', designation: 'Mobilier du magasin (fictif)', numeroInventaire: 'INV-002', famille: 'MOBILIER', valeur: 500_000 },
    ],
    salarie: {
        matricule: 'DEMO-001',
        nom: 'Tshibanda (fictif)',
        prenoms: 'Patrick',
        sexe: client_1.SexeTravailleur.MASCULIN,
        nationalite: 'Congolaise',
        natureTravail: 'Magasinier',
        type: client_1.TypeContratTravail.DUREE_INDETERMINEE,
        remunerationMensuelleFc: 900_000,
        moisBulletin: '05',
    },
    jourReleve: '03-31',
    questionnaire: 'Révision de l’exercice (démonstration)',
};
function mouvementsBanque(s) {
    const ops = s.operations.flatMap((o) => o.lignes.filter((l) => 'tresorerie' in l).map((l) => ({ jour: o.jour, montant: l.sens === 'DEBIT' ? l.montant : -l.montant })));
    const immos = s.immobilisations.map((i) => ({ jour: i.jour, montant: -i.valeur }));
    return [...ops, ...immos].sort((a, b) => a.jour.localeCompare(b.jour));
}
function scenarioDemonstration(referentiel) {
    return referentiel === client_1.Referentiel.SYSCOHADA ? SYSCOHADA : SYCEBNL;
}
//# sourceMappingURL=scenario-demonstration.js.map