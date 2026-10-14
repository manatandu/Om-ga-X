import { Type } from 'class-transformer';
import { IsIn, IsInt, IsString, Max, MaxLength, Min } from 'class-validator';

/**
 * LA RENUMÉROTATION DES BIENS (ligne sage-l4, fonction n° 73) · les mêmes
 * paramètres pour l'aperçu (requête) et la confirmation (corps) · le plan est
 * rejoué par le serveur, jamais reçu. Les bornes sont celles du service
 * (`motifRefusParametres`), qui les redit en refus nommé.
 */
export class ParametresRenumerotationDto {
  @IsString()
  @MaxLength(20)
  prefixe!: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(99_999_999)
  premierNumero!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(8)
  largeur!: number;

  @IsIn(['ACQUISITION', 'COMPTE'])
  ordre!: 'ACQUISITION' | 'COMPTE';

  @IsIn(['EN_SERVICE', 'SANS_NUMERO'])
  perimetre!: 'EN_SERVICE' | 'SANS_NUMERO';
}
