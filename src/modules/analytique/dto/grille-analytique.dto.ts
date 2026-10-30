import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsNumber, IsUUID, Max, Min, ValidateNested } from 'class-validator';
import { PLAFOND_LIGNES_GRILLE } from '../grille-analytique';

/**
 * LIGNE ANALYTIQUE, FONCTION N° 48 · une section et sa part. La somme à
 * 100 %, la section Détail et active du plan se jugent au service
 * (`motifRefusGrille`), sur la grille entière. Les messages sont écrits en
 * français · les défauts de class-validator parlent anglais.
 */
export class LigneGrilleAnalytiqueDto {
  @IsUUID('all', { message: 'Section illisible.' })
  sectionId!: string;

  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'Pourcentage illisible (deux décimales au plus).' })
  @Min(0.01, { message: 'Un pourcentage est strictement positif.' })
  @Max(100, { message: 'Un pourcentage est au plus 100.' })
  pourcentage!: number;
}

/** La grille d'un compte sur un plan · elle remplace la précédente du même couple. */
export class PoserGrilleAnalytiqueDto {
  @IsUUID('all', { message: 'Compte illisible.' })
  compteId!: string;

  @IsUUID('all', { message: 'Axe analytique illisible.' })
  planId!: string;

  @IsArray({ message: 'Les lignes de la grille sont une liste.' })
  @ArrayMinSize(1, { message: 'Une grille porte au moins une section · pour ne plus en avoir, retirez-la.' })
  @ArrayMaxSize(PLAFOND_LIGNES_GRILLE, { message: `Une grille porte au plus ${PLAFOND_LIGNES_GRILLE} sections.` })
  @ValidateNested({ each: true })
  @Type(() => LigneGrilleAnalytiqueDto)
  lignes!: LigneGrilleAnalytiqueDto[];
}
