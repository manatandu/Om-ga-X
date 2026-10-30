/**
 * GESTION COMMERCIALE (ligne commercial-l8) · types servis par le serveur et
 * aides de lecture. Aucune règle comptable ici · les comptes, les taux, les
 * refus et les montants légaux viennent du serveur (`src/modules/commercial/`),
 * l'écran ne fait que les montrer.
 */

export interface ArticleCommercial {
  id: string;
  reference: string;
  designation: string;
  unite: string;
  compteVenteId: string | null;
  compteAchatId: string | null;
  tauxTvaId: string | null;
  exonere: boolean;
  prixVenteHT: number | null;
  prixAchatHT: number | null;
  articleStockId: string | null;
  modeArrondiId: string | null;
  actif: boolean;
  stocke: boolean;
  compteVente: { numero: string; intitule: string } | null;
  compteAchat: { numero: string; intitule: string } | null;
  tauxTva: { code: string; taux: number } | null;
  articleStock: { code: string; designation: string; uniteMesure: string } | null;
  modeArrondi: { intitule: string; methode: MethodeArrondi; pas: number } | null;
}

export interface ListeArticlesCommerciaux {
  total: number;
  plafond: number;
  tronque: boolean;
  articles: ArticleCommercial[];
}

export interface TarifClient {
  id: string;
  tiersId: string;
  prixHT: number | null;
  remisePourcent: number | null;
  tiers: { code: string; nom: string };
}

export interface ListeTarifs {
  total: number;
  tronque: boolean;
  tarifs: TarifClient[];
}

export interface PrixPropose {
  designation: string;
  unite: string;
  compteId: string | null;
  tauxTvaId: string | null;
  exonere: boolean;
  actif: boolean;
  prixUnitaireHT: number | null;
  remisePourcent: number;
  prixNetUnitaireHT: number | null;
  source: 'TARIF_CLIENT' | 'PRIX_DE_BASE' | 'AUCUN';
  /** Ce que la proposition doit dire · taux ou mode en sommeil, arrondi excessif. */
  avertissement?: string | null;
}

/**
 * Un nombre saisi au clavier · espaces et espaces insécables retirés, la
 * virgule lue comme point. Vide rend `null` (le champ efface), illisible rend
 * `undefined` (l'écran refuse avant l'envoi).
 */
export function lireNombre(saisie: string): number | null | undefined {
  const brut = saisie.replace(/[\s  ]/g, '');
  if (brut === '') return null;
  // « 500.000 » se lit cinq cents mille ou cinq cents · ambigu, refusé (même
  // règle que les conditions bancaires).
  if (/^\d{1,3}(\.\d{3})+$/.test(brut)) return undefined;
  const t = brut.replace(',', '.');
  const n = Number(t);
  return Number.isFinite(n) ? n : undefined;
}

/** Mode d'arrondi du prix proposé (fonction 94) · servi par `/commercial/modes-arrondi`. */
export type MethodeArrondi = 'PROCHE' | 'SUPERIEUR' | 'INFERIEUR';
export const LIBELLES_METHODES: Readonly<Record<MethodeArrondi, string>> = {
  PROCHE: 'Au plus proche',
  SUPERIEUR: 'Au supérieur',
  INFERIEUR: 'À l’inférieur',
};
export interface ModeArrondi {
  id: string;
  intitule: string;
  methode: MethodeArrondi;
  pas: number;
  actif: boolean;
}

/** Collaborateur et ses rôles (fonction 91) · servi par `/commercial/collaborateurs`. */
export const ROLES_COLLABORATEUR = ['vendeur', 'caissier', 'acheteur', 'controleur', 'financier', 'recouvrement'] as const;
export type RoleCollaborateur = (typeof ROLES_COLLABORATEUR)[number];
export const LIBELLES_ROLES: Readonly<Record<RoleCollaborateur, string>> = {
  vendeur: 'Vendeur',
  caissier: 'Caissier',
  acheteur: 'Acheteur',
  controleur: 'Contrôleur',
  financier: 'Financier',
  recouvrement: 'Recouvrement',
};
export type Collaborateur = {
  id: string;
  nom: string;
  prenom: string | null;
  fonction: string | null;
  telephone: string | null;
  email: string | null;
  actif: boolean;
  tiersRepresentes: number;
} & Record<RoleCollaborateur, boolean>;

export const nomCollaborateur = (c: { nom: string; prenom: string | null }) => [c.prenom, c.nom].filter(Boolean).join(' ');

/**
 * LE RÔLE QU'EXIGE LA REPRÉSENTATION D'UN TIERS · même règle que le serveur
 * (`commercial/collaborateurs.ts`, `roleExigePour`), qui refuse le reste.
 */
export function roleExigePour(type: string): RoleCollaborateur | null {
  if (type === 'CLIENT' || type === 'ADHERENT') return 'vendeur';
  if (type === 'FOURNISSEUR') return 'acheteur';
  return null;
}

/** L'encours d'un client (fonction 30) · servi par `/commercial/encours/:tiersId`, jamais recalculé ici. */
export interface EncoursClient {
  tiers: { code: string; nom: string; devise: string | null };
  encoursMaximum: number | null;
  soldeComptable: number | null;
  motifSolde: string | null;
  facturesNonComptabilisees: number;
  nombreFacturesNonComptabilisees: number;
  venteEnCours: number;
  encours: number | null;
  depassement: number | null;
  avertissement: string | null;
}

/**
 * LE MONTANT HORS TAXES PROPOSÉ D'UNE LIGNE · quantité × prix net unitaire,
 * au centime le plus proche. Une proposition · la ligne garde le montant qui
 * FIGURE sur la pièce, que le cabinet peut corriger.
 */
export function montantHTPropose(quantite: number, prixNetUnitaire: number): number {
  return Math.round(quantite * prixNetUnitaire * 100) / 100;
}

/**
 * LA TAXE PROPOSÉE D'UNE LIGNE (relecture indépendante, M1) · taux × montant
 * hors taxes, au centime le plus proche ; vide sur une ligne non imposable,
 * sans taux ou sans montant. Jamais héritée d'une ligne précédente.
 */
export function taxeProposee(montantHT: number | '', taux: number | '', imposable: boolean): number | '' {
  if (!imposable || montantHT === '' || taux === '') return '';
  return Math.round(montantHT * taux) / 100;
}

/**
 * LE COMPTE QUE LES ARTICLES D'UNE FACTURE PROPOSENT À SA PASSATION (mineur 9)
 * · celui de vente (ou d'achat) commun à TOUTES les lignes, chacune portant un
 * article connu ; sinon aucun, et le choix reste au cabinet.
 */
export function compteDesArticles(
  sens: 'VENTE' | 'ACHAT',
  lignes: readonly { articleId?: string | null }[],
  articles: readonly Pick<ArticleCommercial, 'id' | 'compteVenteId' | 'compteAchatId'>[] | null,
): string | null {
  if (!articles || !lignes.length) return null;
  const comptes = lignes.map((l) => {
    const a = l.articleId ? articles.find((x) => x.id === l.articleId) : undefined;
    return a ? (sens === 'VENTE' ? a.compteVenteId : a.compteAchatId) : null;
  });
  return comptes.every((c) => c && c === comptes[0]) ? comptes[0] : null;
}
