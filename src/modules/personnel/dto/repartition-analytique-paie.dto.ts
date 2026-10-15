import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsNumber, IsString, IsUUID, Matches, Max, MaxLength, Min, MinLength, ValidateNested } from 'class-validator';
import { PLAFOND_LIGNES_REPARTITION } from '../ventilation-analytique-paie';

/**
 * LIGNE SAGE-L5, FONCTION 88 · une section et sa part. La somme à 100 %, la
 * section Détail et active du plan se jugent au service
 * (`motifRefusRepartition`), sur la version entière.
 */
export class LigneRepartitionAnalytiqueDto {
  @IsUUID()
  sectionId!: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(100)
  pourcentage!: number;
}

/** Une répartition, à partir d'un mois de paie · vide, le salarié ne se répartit plus sur ce plan. */
export class RepartitionAnalytiquePaieDto {
  @IsUUID()
  planId!: string;

  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, { message: "Mois d'effet illisible · la forme attendue est AAAA-MM." })
  moisEffet!: string;

  @IsArray()
  @ArrayMaxSize(PLAFOND_LIGNES_REPARTITION)
  @ValidateNested({ each: true })
  @Type(() => LigneRepartitionAnalytiqueDto)
  lignes!: LigneRepartitionAnalytiqueDto[];
}

export class RetraitRepartitionAnalytiqueDto {
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  motif!: string;
}
