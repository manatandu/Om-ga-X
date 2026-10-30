/**
 * ÉTATS PERSONNALISÉS (point 20 de la comparaison Sage i7).
 *
 * Le catalogue Sage NOMME les « états libres personnalisables » sans les
 * décrire ; l'Édition pilotée décrit un historique « sur 5 ans des
 * indicateurs clés », et les états de gestion commerciale des « sélections »
 * nommées et sauvegardées. La définition est donc celle d'OmegaX, et l'écran
 * le dit · un état personnalisé n'est ni un état financier ni un document
 * déposé, il ne se substitue à aucun.
 *
 * UNE LIGNE EST SOIT UNE RUBRIQUE DE COMPTES, SOIT UN TOTAL.
 *  · rubrique · des racines (« 70 71 -709 »), une mesure et un sens. La
 *    racine se lit comme un compte Total · tout compte dont le numéro commence
 *    par elle. Le MOINS EST UNE EXCLUSION, « 70 -709 » se lit « 70 sauf 709 »,
 *    comme un comptable l'écrit · la lire comme une soustraction ajoutait les
 *    rabais au chiffre d'affaires au lieu de les écarter, sur une ligne au
 *    montant plausible (vu au premier jeu d'essai). Une racine citée deux fois
 *    est refusée, et il faut au moins une racine incluse ;
 *  · total · une combinaison signée de lignes PRÉCÉDENTES (« A+B-C »), jamais
 *    d'une ligne qui suit · sans quoi deux totaux pourraient se citer l'un
 *    l'autre.
 *
 * DEUX MESURES, ET CE N'EST PAS UN DÉTAIL.
 *  · SOLDE · report à-nouveau et mouvements, pour un compte de bilan ;
 *  · MOUVEMENT · les seuls mouvements de l'exercice, écritures de clôture
 *    exclues · pour une charge ou un produit, dont le solde est remis à zéro
 *    par la clôture et vaudrait donc zéro sur tout exercice clos.
 * Le SENS dit dans quel sens le montant se lit positif · « crédit » pour des
 * produits, faute de quoi un chiffre d'affaires s'afficherait négatif.
 */

export type Mesure = 'SOLDE' | 'MOUVEMENT';
export type Sens = 'DEBIT' | 'CREDIT';

export interface LigneDefinition {
  cle: string;
  libelle: string;
  /** Rubrique · « 70 71 -709 », le moins exclut. */
  racines?: string;
  mesure?: Mesure;
  sens?: Sens;
  /** Total · « A+B-C », clés de lignes précédentes. */
  total?: string;
}

export interface LigneBalanceEtat {
  numero: string;
  totalDebit: number;
  totalCredit: number;
  mouvementDebit: number;
  mouvementCredit: number;
}

interface Terme {
  signe: 1 | -1;
  valeur: string;
}

const lireTermes = (texte: string, motif: RegExp): Terme[] | null => {
  const termes: Terme[] = [];
  for (const brut of texte.replace(/([+-])/g, ' $1').split(/\s+/).filter(Boolean)) {
    const signe: 1 | -1 = brut.startsWith('-') ? -1 : 1;
    const valeur = brut.replace(/^[+-]/, '');
    if (!motif.test(valeur)) return null;
    termes.push({ signe, valeur });
  }
  return termes.length ? termes : null;
};

export const PLAFOND_LIGNES = 100;
export const PLAFOND_EXERCICES = 5;

/** Pourquoi la définition est refusée, ou null. Même règle à la porte et au calcul. */
export function motifRefusDefinition(lignes: LigneDefinition[]): string | null {
  if (lignes.length === 0) return "L'état doit porter au moins une ligne.";
  if (lignes.length > PLAFOND_LIGNES) return `Un état porte au plus ${PLAFOND_LIGNES} lignes.`;
  const vues = new Set<string>();
  for (const l of lignes) {
    if (!/^[A-Z][A-Z0-9_]{0,19}$/.test(l.cle)) return `Clé « ${l.cle} » · une lettre majuscule, puis lettres, chiffres ou _.`;
    if (vues.has(l.cle)) return `La clé ${l.cle} est employée deux fois.`;
    if (!l.libelle?.trim()) return `La ligne ${l.cle} n'a pas de libellé.`;
    const estTotal = !!l.total?.trim();
    const estRubrique = !!l.racines?.trim();
    if (estTotal === estRubrique) return `La ligne ${l.cle} est soit une rubrique de comptes, soit un total · pas les deux, ni aucun.`;
    if (estRubrique) {
      const termes = lireTermes(l.racines!, /^\d{1,13}$/);
      if (!termes) return `Ligne ${l.cle} · racines illisibles (« 70 71 -709 » attendu).`;
      const dejaVues = new Set<string>();
      for (const t of termes) {
        if (dejaVues.has(t.valeur)) return `Ligne ${l.cle} · la racine ${t.valeur} est citée deux fois.`;
        dejaVues.add(t.valeur);
      }
      if (!termes.some((t) => t.signe === 1)) return `Ligne ${l.cle} · au moins une racine incluse, un moins n'exclut que ce qu'une racine inclut.`;
      if (!l.mesure || !['SOLDE', 'MOUVEMENT'].includes(l.mesure)) return `Ligne ${l.cle} · mesure SOLDE ou MOUVEMENT attendue.`;
      if (!l.sens || !['DEBIT', 'CREDIT'].includes(l.sens)) return `Ligne ${l.cle} · sens DEBIT ou CREDIT attendu.`;
    } else {
      const termes = lireTermes(l.total!, /^[A-Z][A-Z0-9_]{0,19}$/);
      if (!termes) return `Ligne ${l.cle} · total illisible (« A+B-C » attendu).`;
      for (const t of termes) {
        if (!vues.has(t.valeur)) return `Ligne ${l.cle} · le total cite ${t.valeur}, qui n'est pas une ligne PRÉCÉDENTE.`;
      }
    }
    vues.add(l.cle);
  }
  return null;
}

/**
 * L'AIDE À LA FORMULE (ligne dossier-l9, fonction 100 · Sage X3, « éditeur de
 * formules ») · ce qu'une rubrique « 70 71 -709 » LIT dans le plan du
 * dossier, compte par compte, par la MÊME règle que le calcul (la racine la
 * plus longue décide, le moins exclut). Rien de nouveau n'est calculé · la
 * formule reste celle du moteur, l'aide dit seulement ce qu'elle prend.
 */
export interface LectureDesRacines {
  motif: string | null;
  /** Les comptes que la rubrique additionne. */
  inclus: string[];
  /** Les comptes qu'un moins écarte d'une racine incluse. */
  exclus: string[];
  /** Les racines qui ne trouvent aucun compte dans le plan · une faute de frappe, ou un compte non ouvert. */
  racinesSansCompte: string[];
}

export function lireLesRacines(racines: string, numeros: string[]): LectureDesRacines {
  const motif = motifRefusDefinition([{ cle: 'A', libelle: 'formule', racines, mesure: 'SOLDE', sens: 'DEBIT' }]);
  if (motif) return { motif: motif.replace(/^Ligne A · /, ''), inclus: [], exclus: [], racinesSansCompte: [] };
  const termes = lireTermes(racines, /.*/)!;
  const inclus: string[] = [];
  const exclus: string[] = [];
  for (const numero of numeros) {
    const t = termes.filter((x) => numero.startsWith(x.valeur)).sort((a, z) => z.valeur.length - a.valeur.length)[0];
    if (!t) continue;
    if (t.signe === 1) inclus.push(numero);
    else if (termes.some((x) => x.signe === 1 && numero.startsWith(x.valeur))) exclus.push(numero);
  }
  const racinesSansCompte = termes.filter((t) => !numeros.some((n) => n.startsWith(t.valeur))).map((t) => (t.signe === -1 ? `-${t.valeur}` : t.valeur));
  return { motif: null, inclus, exclus, racinesSansCompte };
}

/** Les montants d'une colonne (un exercice), ligne par ligne, arrondis au centime. */
export function calculerColonne(lignes: LigneDefinition[], balance: LigneBalanceEtat[]): Record<string, number> {
  const valeurs: Record<string, number> = {};
  // Zéro négatif ramené à zéro · il s'afficherait « -0,00 ».
  const arrondi = (n: number) => Math.round(n * 100) / 100 || 0;
  for (const l of lignes) {
    if (l.total?.trim()) {
      valeurs[l.cle] = arrondi(lireTermes(l.total, /.*/)!.reduce((s, t) => s + t.signe * (valeurs[t.valeur] ?? 0), 0));
      continue;
    }
    const termes = lireTermes(l.racines!, /.*/)!;
    let somme = 0;
    for (const b of balance) {
      // La racine la PLUS LONGUE décide · « 70 -709 » compte le 701 et écarte
      // le 7091, quel que soit l'ordre d'écriture.
      const t = termes.filter((x) => b.numero.startsWith(x.valeur)).sort((a, z) => z.valeur.length - a.valeur.length)[0];
      if (!t || t.signe === -1) continue;
      somme += l.mesure === 'MOUVEMENT' ? b.mouvementDebit - b.mouvementCredit : b.totalDebit - b.totalCredit;
    }
    valeurs[l.cle] = arrondi(l.sens === 'CREDIT' ? -somme : somme);
  }
  return valeurs;
}
