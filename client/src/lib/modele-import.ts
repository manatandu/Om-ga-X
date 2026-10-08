import type { TypeImport } from './types';

/**
 * LE MODÈLE DE FICHIER D'IMPORT · un CSV d'en-têtes et d'exemples, que la
 * correspondance des colonnes reconnaît d'office (les en-têtes contiennent les
 * mots que l'analyse cherche). Les trois colonnes de la devise sont
 * FACULTATIVES (ligne AU3) · laissées vides, la ligne est en francs ; remplies,
 * la ligne garde sa devise, et la réévaluation de clôture la lit.
 */
const MODELES: Record<TypeImport, string[]> = {
  PLAN_COMPTES: ['Numéro de compte;Intitulé;Type', '41110000;Clients;Détail'],
  BALANCE: [
    'Numéro de compte;Intitulé;Solde débiteur;Solde créditeur;Montant en devise;Devise;Cours',
    '52110000;Banque en francs;800000;0;;;',
    '41110000;Client Kinshasa (USD);3200000;0;1500;USD;',
    '10110000;Capital;0;4000000;;;',
  ],
  ECRITURES: [
    'Date;Journal;Pièce;Référence;Numéro de compte;Libellé;Débit;Crédit;Montant en devise;Devise;Cours',
    '20/01/2026;BQ;1;REC1;52110000;Encaissement client;3200000;0;1500;USD;',
    '20/01/2026;BQ;1;REC1;41110000;Encaissement client;0;3200000;1500;USD;',
  ],
};

export function modeleImport(type: TypeImport): string {
  return MODELES[type].join('\n') + '\n';
}

export function nomModeleImport(type: TypeImport): string {
  return `modele-import-${type.toLowerCase().replace('_', '-')}.csv`;
}
