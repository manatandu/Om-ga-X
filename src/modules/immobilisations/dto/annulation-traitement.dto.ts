import { IsIn, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { NATURES_ANNULABLES, NatureTraitement } from '../annulation-traitement';

/**
 * L'annulation d'un traitement d'immobilisation (ligne sage-l4, fonction
 * n° 67) · la nature dit la table, l'identifiant l'enregistrement, le motif
 * est gardé avec l'acte et au journal d'audit (AUDCIF art. 20, al. 2).
 */
export class AnnulerTraitementDto {
  @IsIn(NATURES_ANNULABLES as readonly string[])
  nature!: NatureTraitement;

  @IsUUID()
  acteId!: string;

  @IsString()
  @MinLength(3)
  @MaxLength(500)
  motif!: string;
}
