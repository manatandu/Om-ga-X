import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsNumber, IsString, Matches, MaxLength, MinLength, ValidateNested } from 'class-validator';
import { FacultatifNonNul } from '../../../common/facultatif-non-nul';

/** Une ligne du bon · une désignation sur une ligne budgétaire. */
export class LigneBonCommandeDto {
  @IsString()
  @MinLength(1)
  @MaxLength(300)
  designation!: string;

  @IsNumber()
  quantite!: number;

  @IsNumber()
  prixUnitaire!: number;

  /** La taxe PRÉVUE sur la facture · saisie, aucun taux deviné ; zéro si aucune. */
  @FacultatifNonNul('La taxe prévue est un montant · omettez-la pour zéro, jamais null.')
  @IsNumber()
  montantTva?: number;

  /** La ligne budgétaire (règle (a) · « suivant la nomenclature budgétaire du projet »). */
  @IsString()
  sectionId!: string;
}

/** Le brouillon · rien n'est engagé avant la remise. */
export class CreerBonCommandeDto {
  @IsString()
  exerciceId!: string;

  @IsString()
  tiersId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(300)
  objet!: string;

  // CENT LIGNES AU PLUS · convention d'OmegaX, une borne contre un corps sans fin.
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => LigneBonCommandeDto)
  lignes!: LigneBonCommandeDto[];
}

/** La retouche d'un brouillon · même corps, lignes remplacées en entier. */
export class ModifierBonCommandeDto {
  @IsString()
  tiersId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(300)
  objet!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => LigneBonCommandeDto)
  lignes!: LigneBonCommandeDto[];
}

/** La remise au fournisseur · c'est elle qui engage (« remis aux fournisseurs »). */
export class RemettreBonCommandeDto {
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'La date de remise se donne au jour (AAAA-MM-JJ).' })
  dateRemise!: string;
}

export class PartExecutionDto {
  @IsString()
  sectionId!: string;

  @IsNumber()
  montant!: number;
}

/** La facture d'achat qui exécute le bon, et la part de chaque ligne budgétaire. */
export class ExecuterBonCommandeDto {
  @IsString()
  factureId!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => PartExecutionDto)
  parts!: PartExecutionDto[];
}

export class CloreBonCommandeDto {
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  motif!: string;
}
