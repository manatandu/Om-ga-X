import { ClasseCompte, TypeCompteDetailTotal, TypeTiers } from '@prisma/client';
import { prixNetArrondi, type MethodeArrondi } from './arrondi';

/**
 * LIGNE commercial-l8 · RÈGLES PURES DES ARTICLES ET DES TARIFS.
 *
 * Aucun numéro de compte n'est écrit ici · le compte de vente et le compte
 * d'achat se CHOISISSENT dans le plan du dossier, et seule leur CLASSE est
 * jugée, parce que c'est elle que les deux textes fixent : la vente se passe
 * en classe 7 (AUDCIF Titre VII, compte 70, « crédité du montant des
 * facturations hors taxes » ; SYCEBNL Partie 2 ch. 3, classe 7), l'achat en
 * classe 6 (compte 60, « le montant des factures d'achat »). Le 603 n'est pas
 * un compte d'achat · le Titre VII l'écarte du compte 60 (« Achats (sauf
 * 603) »), il porte la variation des stocks. Un numéro, deux plans · la
 * classe suffit, sans table servie à l'autre référentiel.
 */

export interface CompteJuge {
  numero: string;
  classe: ClasseCompte;
  typeCompte: TypeCompteDetailTotal;
  estActif: boolean;
}

function exigerImputation(c: CompteJuge, role: string): string | null {
  if (c.typeCompte !== TypeCompteDetailTotal.DETAIL) {
    return `Le compte ${c.numero} est un en-tête de division · le compte ${role} d'un article est un compte d'imputation, que la pièce débitera ou créditera.`;
  }
  if (!c.estActif) return `Le compte ${c.numero} est en sommeil · rouvrez-le dans Plan comptable avant de le donner à un article.`;
  return null;
}

/** Le compte de vente · classe 7, compte d'imputation actif. */
export function motifRefusCompteVente(c: CompteJuge): string | null {
  if (c.classe !== ClasseCompte.CLASSE_7) {
    return `Le compte ${c.numero} n'est pas un compte de produit (classe 7) · la vente se passe au crédit d'un compte de la classe 7 (AUDCIF Titre VII, compte 70 ; SYCEBNL, Partie 2 ch. 3).`;
  }
  return exigerImputation(c, 'de vente');
}

/** Le compte d'achat · classe 6 hors 603, compte d'imputation actif. */
export function motifRefusCompteAchat(c: CompteJuge): string | null {
  if (c.classe !== ClasseCompte.CLASSE_6) {
    return `Le compte ${c.numero} n'est pas un compte de charge (classe 6) · l'achat se passe au débit d'un compte de la classe 6 (AUDCIF Titre VII, compte 60). Un bien durable s'acquiert par les immobilisations.`;
  }
  if (c.numero.startsWith('603')) {
    return `Le compte ${c.numero} porte la variation des stocks · le Titre VII l'écarte des achats (« COMPTE 60 : Achats (sauf 603) »).`;
  }
  return exigerImputation(c, "d'achat");
}

/** Un montant hors taxes · positif ou nul, au centime. */
export function motifRefusPrix(prix: number | null | undefined, libelle: string): string | null {
  if (prix === null || prix === undefined) return null;
  if (!Number.isFinite(prix) || prix < 0) return `Le ${libelle} est un montant positif ou nul.`;
  if (Math.round(prix * 100) !== Number((prix * 100).toFixed(6))) return `Le ${libelle} se saisit au centime.`;
  return null;
}

/**
 * LA REMISE · un pourcentage déduit sur la facture, au moins 0 et moins de
 * 100 · cent pour cent ferait une livraison gratuite, qui n'est pas une
 * remise mais un don (et se traite comme tel).
 */
export function motifRefusRemise(remise: number | null | undefined): string | null {
  if (remise === null || remise === undefined) return null;
  if (!Number.isFinite(remise) || remise < 0 || remise >= 100) {
    return 'La remise est un pourcentage d’au moins 0 et de moins de 100 · une remise de cent pour cent ferait une livraison gratuite, qui n’est pas une vente.';
  }
  if (Math.round(remise * 100) !== Number((remise * 100).toFixed(6))) return 'La remise se saisit à deux décimales au plus.';
  return null;
}

/** Un tarif se pose pour un client · un fournisseur ou un salarié n'achète pas au dossier. */
export function motifRefusTiersDuTarif(type: TypeTiers): string | null {
  if (type === TypeTiers.CLIENT || type === TypeTiers.ADHERENT) return null;
  return 'Un tarif propre se pose pour un client (ou un adhérent qui achète) · ce tiers n’en est pas un.';
}

/**
 * L'UNITÉ D'UN ARTICLE STOCKÉ EST CELLE DE SA FICHE DE STOCK · une livraison
 * de « 3 cartons » sortirait trois unités d'une fiche tenue à la pièce, et le
 * magasin ne vaudrait plus le comptage.
 */
export function motifRefusUniteStockee(unite: string, uniteFiche: string): string | null {
  if (unite.trim().toLocaleLowerCase('fr') === uniteFiche.trim().toLocaleLowerCase('fr')) return null;
  return `L’unité de l’article (« ${unite} ») doit être celle de sa fiche de stock (« ${uniteFiche} ») · une livraison sortirait sinon du magasin une quantité dans une autre unité que celle qui est comptée.`;
}

export type SourcePrix = 'TARIF_CLIENT' | 'PRIX_DE_BASE' | 'AUCUN';

/**
 * LE PRIX PROPOSÉ À LA LIGNE · le prix propre au client s'il en a un, sinon
 * le prix de base de l'article ; la remise du client s'y ajoute dans les deux
 * cas. PROPOSÉ, jamais imposé · la ligne garde le prix que le cabinet porte,
 * celui que les parties ont convenu (AUDCG art. 263). Sans prix, rien n'est
 * deviné et la source le dit.
 *
 * LE PRIX NET UNITAIRE (prix moins la remise) est arrondi au mode de l'article
 * (fonction 94, `arrondi.ts`), sinon au centime le plus proche · c'est lui que
 * la quantité multiplie pour le montant hors taxes de la ligne, celui qui
 * FIGURE sur la facture et fait la base de la taxe (O.-L. n° 10/001, art. 29).
 */
export function prixPropose(
  base: number | null,
  tarif: { prixHT: number | null; remisePourcent: number | null } | null,
  mode: { methode: MethodeArrondi; pas: number } | null = null,
): { prixUnitaireHT: number | null; remisePourcent: number; prixNetUnitaireHT: number | null; source: SourcePrix; avertissement: string | null } {
  const propre = tarif?.prixHT ?? null;
  const prix = propre ?? base;
  const remisePourcent = tarif?.remisePourcent ?? 0;
  const net = prix === null ? null : prixNetArrondi(prix, remisePourcent, mode);
  return {
    prixUnitaireHT: prix,
    remisePourcent,
    prixNetUnitaireHT: net,
    source: propre !== null ? 'TARIF_CLIENT' : base !== null ? 'PRIX_DE_BASE' : 'AUCUN',
    avertissement: prix === null || net === null ? null : motifArrondiExcessif(prix, net),
  };
}

/**
 * L'ARRONDI QUI DÉFAIT LE PRIX SE DIT (relecture indépendante, mineur 3) · un
 * pas au supérieur qui porte le prix net au-dessus du prix brut fait payer au
 * client plus que le prix convenu sans remise, un pas à l'inférieur qui le
 * ramène à zéro fait une livraison gratuite. Proposé quand même, jamais
 * imposé · la ligne garde le prix que le cabinet porte (AUDCG art. 263).
 */
export function motifArrondiExcessif(prix: number, net: number): string | null {
  if (prix > 0 && net === 0) return 'L’arrondi ramène le prix net à zéro · revoyez le pas du mode d’arrondi, ou portez le prix à la main.';
  if (Math.round(net * 100) > Math.round(prix * 100)) {
    return `L’arrondi porte le prix net (${net.toLocaleString('fr-FR')}) au-dessus du prix sans remise (${prix.toLocaleString('fr-FR')}) · revoyez le pas du mode d’arrondi, ou portez le prix à la main.`;
  }
  return null;
}
