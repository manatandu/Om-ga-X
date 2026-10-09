/**
 * LE NUMÉRO DU COMPTE PRINCIPAL D'UN TIERS À CRÉER (décision de Manasse du
 * 2026-10-09, « Choisi à la création ») · le serveur propose le premier
 * numéro libre sous le collectif (`GET /tiers/numero-propose`), la fenêtre le
 * préremplit, le cabinet le garde ou le remplace. Le serveur seul juge le
 * numéro choisi (`motifRefusNumeroChoisi`) · l'écran ne recopie pas ses
 * règles.
 */
export interface NumeroPropose {
  /** Nul quand rien ne peut s'ouvrir · `motif` dit pourquoi. */
  numero: string | null;
  collectif: string | null;
  longueur: number;
  motif: string | null;
}

/**
 * CE QUI PART AVEC LA CRÉATION · rien quand le champ est vide ou garde la
 * proposition, et le serveur prend alors le premier numéro libre au moment
 * même de la création. Envoyer la proposition intacte la rendrait
 * « choisie » · prise entre-temps par une autre saisie, elle serait refusée
 * au lieu de céder au numéro suivant, que personne n'a demandé de garder.
 */
export function numeroAEnvoyer(saisi: string, propose: NumeroPropose | null): string | undefined {
  const numero = saisi.trim();
  if (numero === '') return undefined;
  if (propose?.numero && numero === propose.numero) return undefined;
  return numero;
}
