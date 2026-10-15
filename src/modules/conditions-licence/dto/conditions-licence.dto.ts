import { Equals, IsInt, Matches, Min } from 'class-validator';
import { MOTIF_EMPREINTE } from '../empreinte';

/**
 * L'acceptation reçue · la version que l'administrateur a LUE et l'empreinte
 * de son texte, et la case qui dit qu'il l'a lue. La version se compare à celle en vigueur dans le service
 * (`motifRefusAcceptation`) · une page restée ouverte pendant un changement de
 * version ne fait pas accepter un texte que personne n'a lu.
 */
export class AccepterConditionsDto {
  @IsInt()
  @Min(1)
  version!: number;

  /**
   * L'empreinte SHA-256 du texte que l'écran a affiché, calculée sur le texte
   * de SON code (relecture M1) · comparée à celle que le service tient.
   */
  @Matches(MOTIF_EMPREINTE, { message: 'L’empreinte du texte lu doit compter 64 chiffres hexadécimaux.' })
  empreinte!: string;

  /**
   * L'empreinte de l'ABONNEMENT que l'écran a affiché (`empreinteCommande`,
   * second tour de relecture, M-a) · comparée sous le verrou à la commande
   * que le service relit. Un prix changé dans la console entre l'affichage et
   * le clic est refusé (Code du numérique, art. 55, al. 1er).
   */
  @Matches(MOTIF_EMPREINTE, { message: 'L’empreinte de l’abonnement affiché doit compter 64 chiffres hexadécimaux.' })
  empreinteCommande!: string;

  /** La case « J'ai lu les conditions » · l'acceptation est un acte exprès (Code civil, Livre III, art. 8, consentement). */
  @Equals(true, { message: 'Cochez la case qui dit avoir lu les conditions avant de les accepter.' })
  lu!: boolean;
}
