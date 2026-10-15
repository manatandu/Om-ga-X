import { Equals, IsInt, Min } from 'class-validator';

/**
 * L'acceptation reçue · la version que l'administrateur a LUE, et la case qui
 * dit qu'il l'a lue. La version se compare à celle en vigueur dans le service
 * (`motifRefusAcceptation`) · une page restée ouverte pendant un changement de
 * version ne fait pas accepter un texte que personne n'a lu.
 */
export class AccepterConditionsDto {
  @IsInt()
  @Min(1)
  version!: number;

  /** La case « J'ai lu les conditions » · l'acceptation est un acte exprès (Code civil, Livre III, art. 8, consentement). */
  @Equals(true, { message: 'Cochez la case qui dit avoir lu les conditions avant de les accepter.' })
  lu!: boolean;
}
