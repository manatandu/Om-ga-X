import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsNumber, IsUUID, Max, Min, ValidateNested } from 'class-validator';
import { PLAFOND_LIGNES_GRILLE } from '../grille-analytique';

/**
 * LIGNE ANALYTIQUE, FONCTION N° 48 · une section et sa part. La somme à
 * 100 %, la section Détail et active du plan se jugent au service
 * (`motifRefusGrille`), sur la grille entière.
 */
export class LigneGrilleAnalytiqueDto {
  @IsUUID()
  sectionId!: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(100)
  pourcentage!: number;
}

/** La grille d'un compte sur un plan · elle remplace la précédente du même couple. */
export class PoserGrilleAnalytiqueDto {
  @IsUUID()
  compteId!: string;

  @IsUUID()
  planId!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(PLAFOND_LIGNES_GRILLE)
  @ValidateNested({ each: true })
  @Type(() => LigneGrilleAnalytiqueDto)
  lignes!: LigneGrilleAnalytiqueDto[];
}
