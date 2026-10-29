/**
 * CRÉER UN MODÈLE DE SAISIE DEPUIS LA PIÈCE EN COURS (ligne gl-saisie,
 * fonction 15 · Sage i7, « Créer un modèle » depuis la saisie). La pièce
 * tapée se range en modèle par la route des modèles (`POST /modeles-saisie`),
 * qui garde ses règles (`fonctions-modele.ts`, diagnostic des tiers) · aucune
 * règle à part ici, seulement la traduction des lignes.
 *
 * LA TRADUCTION, ligne par ligne, dans l'ordre de la pièce.
 *  · une ligne de TAXE (portant un taux) devient « Calculer » avec son taux,
 *    sauf en tête, où rien ne la précède ;
 *  · la DERNIÈRE ligne qui n'est pas une taxe devient « Équilibrer » si le
 *    cabinet le demande (le cas courant · la charge se saisit, la taxe se
 *    calcule, le fournisseur équilibre) ;
 *  · toute autre ligne se « Saisit », avec son montant si le cabinet choisit
 *    de le figer (un loyer, un abonnement), sans montant sinon.
 * Un modèle pose les comptes et le sens · le montant n'est figé qu'à la
 * demande, une pièce ordinaire changeant de montant d'une fois à l'autre.
 */
export interface LigneDeLaPiece {
  compteId: string;
  libelle: string;
  debit: number;
  credit: number;
  tauxTvaId?: string;
}

export interface LigneDuModele {
  compteId: string;
  sens: 'DEBIT' | 'CREDIT';
  libelle?: string;
  montant?: number;
  fonction: 'SAISIR' | 'CALCULER' | 'EQUILIBRER';
  tauxTvaId?: string;
}

export interface ChoixDuModele {
  garderLesMontants: boolean;
  derniereEquilibre: boolean;
}

export const LONGUEUR_LIBELLE_LIGNE = 200;

export function lignesDuModele(lignes: LigneDeLaPiece[], choix: ChoixDuModele): LigneDuModele[] {
  const estTaxe = (l: LigneDeLaPiece, i: number) => !!l.tauxTvaId && i > 0;
  let derniere = -1;
  if (choix.derniereEquilibre) {
    for (let i = lignes.length - 1; i >= 0; i--) {
      if (!estTaxe(lignes[i], i)) {
        derniere = i;
        break;
      }
    }
  }
  return lignes.map((l, i) => {
    const sens: 'DEBIT' | 'CREDIT' = l.debit > 0 ? 'DEBIT' : 'CREDIT';
    const libelle = l.libelle.trim() ? l.libelle.trim().slice(0, LONGUEUR_LIBELLE_LIGNE) : undefined;
    if (estTaxe(l, i)) return { compteId: l.compteId, sens, libelle, fonction: 'CALCULER', tauxTvaId: l.tauxTvaId };
    if (i === derniere) return { compteId: l.compteId, sens, libelle, fonction: 'EQUILIBRER' };
    const montant = Math.round((l.debit > 0 ? l.debit : l.credit) * 100) / 100;
    return { compteId: l.compteId, sens, libelle, fonction: 'SAISIR', ...(choix.garderLesMontants ? { montant } : {}) };
  });
}

/** Ce qui empêche la création, avant tout envoi · le serveur garde ses propres refus. */
export function motifRefusModeleDepuisPiece(intitule: string, lignes: LigneDeLaPiece[]): string | null {
  if (lignes.length < 2) return 'Un modèle porte au moins deux lignes · la pièce en cours n’en a pas assez.';
  const t = intitule.trim();
  if (t.length < 2) return 'Donnez un intitulé au modèle (deux caractères au moins).';
  if (t.length > 120) return 'L’intitulé du modèle tient en 120 caractères au plus.';
  return null;
}
