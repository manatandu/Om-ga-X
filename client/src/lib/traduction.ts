/**
 * LA LANGUE DE L'INTERFACE (ligne dossier-l9, fonction 96 · Sage X3, langues
 * d'accès). Le français est la langue de l'application · l'anglais n'est
 * qu'une AIDE DE LECTURE du CADRE (barre de menus, boutons des fenêtres,
 * barre d'état), choisie par chacun pour lui-même dans ses préférences.
 *
 * CE QUI NE SE TRADUIT JAMAIS, ET POURQUOI · la comptabilité se tient en
 * français (loi n° 23/053, art. 141, 1° · « de tenir leur comptabilité en
 * français » ; AUDCIF art. 17, 1° · « dans la langue officielle », que
 * l'art. 3 du SYCEBNL n'écarte pas ; Constitution, art. 1er · « Sa langue
 * officielle est le français »). Plan de comptes, intitulés, libellés,
 * pièces, livres, états financiers, notes annexes et documents remis restent
 * en français. Les MESSAGES DU SERVEUR aussi · un refus cite son article mot
 * pour mot, et une traduction en ferait une paraphrase, que ce dépôt
 * s'interdit (CLAUDE.md, § 6, « texte CITÉ, jamais reformulé »).
 *
 * L'ANGLAIS N'EST PAS ENCORE PROPOSÉ · le contrat de licence en vigueur dit
 * l'interface « en français, seule langue proposée » (art. 3). Le serveur ne
 * propose donc que le français (`LANGUES_PROPOSEES`, src/modules/
 * notifications/notifications.ts) et refuse l'anglais · ce module et sa
 * table attendent la version du contrat qui l'ouvrira, décision de l'éditeur.
 *
 * LA CLÉ EST LE TEXTE FRANÇAIS LUI-MÊME · le menu s'écrit en français dans
 * AppShell.tsx, comme avant, et se traduit au RENDU (MenuBar.tsx). Un texte
 * sans traduction s'affiche en français, jamais vide · et
 * `traduction.spec.ts` exige que chaque libellé écrit du menu en ait une.
 */

export type LangueInterface = 'FR' | 'EN';

export const LANGUES_INTERFACE: ReadonlyArray<{
  code: LangueInterface;
  libelle: string;
}> = [
  { code: 'FR', libelle: 'Français' },
  { code: 'EN', libelle: 'English' },
];

/** L'anglais du cadre, par texte français. */
export const TRADUCTIONS_EN: Readonly<Record<string, string>> = {
  // Les menus.
  Fichier: 'File',
  Structure: 'Setup',
  Traitement: 'Processing',
  État: 'Reports',
  Fenêtre: 'Window',
  '?': '?',
  // Fichier.
  'Nouveau fichier comptable…': 'New accounting file…',
  'Ouvrir un autre dossier…': 'Open another file…',
  "Autorisations d'accès": 'Access rights',
  "Journal d'audit": 'Audit trail',
  'Utilisateurs connectés': 'Connected users',
  'Importer des données…': 'Import data…',
  'Restituer le dossier complet…': 'Return the complete file…',
  'Exporter les modifications…': 'Export changes…',
  'Échanger des écritures…': 'Exchange entries…',
  'Impressions différées': 'Deferred printing',
  'Courriers sortants': 'Outgoing mail',
  'Imprimer la fenêtre…': 'Print window…',
  'Console de l’éditeur': 'Publisher console',
  'Mon compte…': 'My account…',
  'Préférences…': 'Preferences…',
  Messages: 'Messages',
  Notifications: 'Notifications',
  'Fermer le dossier (déconnexion)': 'Close the file (sign out)',
  // Structure.
  'Plan comptable': 'Chart of accounts',
  'Plan des tiers': 'Third parties',
  'Codes journaux': 'Journal codes',
  'Plans analytiques': 'Analytical plans',
  'Taux de taxes': 'Tax rates',
  Banques: 'Banks',
  Libellés: 'Standard labels',
  'Modèles de saisie': 'Entry templates',
  'Paramètres de saisie': 'Entry settings',
  'Séquences de saisie': 'Entry sequences',
  'Modes de règlement': 'Payment methods',
  "Modèles d'impression": 'Print templates',
  'Types de remise': 'Deposit types',
  'Conditions bancaires': 'Bank terms',
  'Taux de référence': 'Reference rates',
  'Bailleurs et subventions': 'Donors and grants',
  'Bailleurs de fonds': 'Donors',
  'Dossier de subvention': 'Grant file',
  Immobilisations: 'Fixed assets',
  'Registre du personnel': 'Staff register',
  'Dossier et entité': 'File and entity',
  'Paramètres du dossier': 'File settings',
  'Mandat du contrôleur des comptes': 'Auditor’s mandate',
  'Accord-cadre (Ministère du Plan)': 'Framework agreement (Ministry of Planning)',
  'Checklist de constitution': 'Incorporation checklist',
  'Devises et réévaluation': 'Currencies and revaluation',
  // Traitement.
  'Saisie des journaux': 'Journal entry',
  Brouillard: 'Draft entries',
  'Interrogation et lettrage': 'Inquiry and matching',
  'Tiers et trésorerie': 'Third parties and cash',
  'Règlement des tiers': 'Third-party payments',
  'Virement de fonds': 'Funds transfer',
  'Remises en banque': 'Bank deposits',
  'Effets de commerce': 'Bills of exchange',
  'Extraits bancaires': 'Bank statements',
  'Financements et placements': 'Financing and investments',
  'Rapprochement bancaire': 'Bank reconciliation',
  'Rappel et relevé': 'Reminders and statements',
  'Chèques émis': 'Cheques issued',
  'Arrêté de caisse': 'Cash count',
  'Créances douteuses ou litigieuses': 'Doubtful or disputed receivables',
  'Régularisations et abonnements': 'Accruals and recurring entries',
  'Saisie des OD analytiques': 'Analytical adjustments',
  Ventes: 'Sales',
  Facturation: 'Invoicing',
  'Devis et commande client': 'Quotes and customer orders',
  'Bons de commande fournisseur': 'Supplier purchase orders',
  Stocks: 'Inventory',
  'Magasin et fiches de stock': 'Store and stock cards',
  'Variation des stocks': 'Change in inventory',
  "Consignation d'emballages": 'Packaging deposits',
  'Inventaire physique': 'Physical count',
  'Paie du mois': 'Monthly payroll',
  "Fin d'exercice…": 'Year end…',
  Clôture: 'Closing',
  'Affectation du résultat': 'Allocation of profit',
  // État.
  'Livres comptables': 'Accounting books',
  Journal: 'Journal',
  'Grand livre des comptes': 'General ledger',
  'Balance des comptes': 'Trial balance',
  'Balance auxiliaire': 'Subsidiary balance',
  'Balance âgée': 'Aged balance',
  'Balance en monnaie fonctionnelle': 'Balance in functional currency',
  'Balance agrégée du groupe': 'Group aggregated balance',
  'Justificatif de solde': 'Balance support',
  'Évolution des soldes': 'Balance trends',
  'Analyse des comptes': 'Account analysis',
  'Palmarès et analyse des journaux': 'Account ranking and journal analysis',
  'États financiers': 'Financial statements',
  'Notes annexes': 'Notes to the accounts',
  'États IFRS': 'IFRS statements',
  'Périmètre de consolidation': 'Consolidation scope',
  'États analytiques et budgétaires': 'Analytical and budget reports',
  'États personnalisés': 'Custom reports',
  'Simulateur budgétaire': 'Budget simulator',
  'Comptabilité de gestion': 'Management accounting',
  'Suivi et prévision': 'Monitoring and forecast',
  'Échéancier de trésorerie': 'Cash schedule',
  'Tableau de bord': 'Dashboard',
  Fiscalité: 'Taxation',
  'Déclaration de TVA': 'VAT return',
  'Retenues et échéancier fiscal': 'Withholdings and tax calendar',
  'Résultat fiscal et impôt sur les bénéfices': 'Taxable profit and income tax',
  'Exonérations douanières et fiscales': 'Customs and tax exemptions',
  'Déclarations et registres': 'Returns and registers',
  'Documents obligatoires': 'Mandatory documents',
  'Registre des donateurs': 'Donor register',
  'Registre des engagements de dépense': 'Spending commitments register',
  'Contrôle et révision': 'Control and review',
  'Analyse et contrôles': 'Analysis and controls',
  'Dossier de révision': 'Review file',
  'Questionnaire de révision': 'Review questionnaire',
  Circularisation: 'Confirmations',
  'Registre des faiblesses': 'Weaknesses register',
  'Registre des provisions pour risques et charges': 'Provisions register',
  'Concordance des modules': 'Module reconciliation',
  // Fenêtre.
  'Réorganiser (cascade)': 'Arrange (cascade)',
  'Actualiser la fenêtre active': 'Refresh active window',
  "Tout fermer · revenir à l'accueil": 'Close all · back to home',
  // ?
  'Aller à une fonction… (F7)': 'Go to a function… (F7)',
  'Questions fréquentes': 'Frequently asked questions',
  'Contrat de licence': 'Licence agreement',
  'Politique de confidentialité': 'Privacy policy',
  'À propos d’OmegaX': 'About OmegaX',
  // Les boutons des fenêtres et la barre d'état.
  Réduire: 'Minimise',
  Agrandir: 'Maximise',
  Restaurer: 'Restore',
  Fermer: 'Close',
  Accueil: 'Home',
  Administrateur: 'Administrator',
  Comptable: 'Accountant',
  'Lecture seule': 'Read only',
  'Aide-comptable': 'Accounting assistant',
  'Gestionnaire de paie': 'Payroll manager',
};

/** Le texte dans la langue choisie · sans traduction, le français, jamais vide. */
export function traduire(texte: string, langue: LangueInterface): string {
  if (langue !== 'EN') return texte;
  return TRADUCTIONS_EN[texte] ?? texte;
}

/** L'attribut `lang` d'un élément du cadre · le lecteur d'écran prononce l'anglais en anglais. */
export function attributLang(langue: LangueInterface): 'fr' | 'en' {
  return langue === 'EN' ? 'en' : 'fr';
}
