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
  actif: boolean;
  stocke: boolean;
  compteVente: { numero: string; intitule: string } | null;
  compteAchat: { numero: string; intitule: string } | null;
  tauxTva: { code: string; taux: number } | null;
  articleStock: { code: string; designation: string; uniteMesure: string } | null;
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
  prixUnitaireHT: number | null;
  remisePourcent: number;
  source: 'TARIF_CLIENT' | 'PRIX_DE_BASE' | 'AUCUN';
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
