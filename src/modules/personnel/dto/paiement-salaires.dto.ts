import { ModePaiementSalaire } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { PLAFOND_COUPURES, PLAFOND_LIGNES_PAIEMENT } from '../paiement-salaires';

/**
 * LIGNE SAGE-L5, FONCTION 75 · le mode de paiement convenu (art. 98, al. 2).
 * `null` remet « pas encore dit » · la clé doit être envoyée, une absence
 * n'efface rien (le service le refuse).
 */
export class ModePaiementSalarieDto {
  @IsOptional()
  @IsEnum(ModePaiementSalaire)
  modePaiement?: ModePaiementSalaire | null;
}

/** La référence d'un salarié dans le paiement · le numéro du chèque. */
export class ReferencePaiementDto {
  @IsUUID()
  bulletinId!: string;

  @IsString()
  @MaxLength(60)
  reference!: string;
}

/**
 * PAYER LES SALAIRES DU MOIS · le cabinet choisit le mode, le journal, la
 * date et les bulletins ; les montants se relisent au serveur, jamais reçus.
 */
export class PaiementSalairesDto {
  @IsEnum(ModePaiementSalaire)
  mode!: ModePaiementSalaire;

  @IsUUID()
  exerciceId!: string;

  @IsUUID()
  journalId!: string;

  @IsDateString()
  date!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(PLAFOND_LIGNES_PAIEMENT)
  @IsUUID('all', { each: true })
  bulletinIds!: string[];

  /** Chèque · le numéro de chaque chèque. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(PLAFOND_LIGNES_PAIEMENT)
  @ValidateNested({ each: true })
  @Type(() => ReferencePaiementDto)
  references?: ReferencePaiementDto[];

  /** Espèces · les coupures déclarées pour le billetage (facultatif). */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(PLAFOND_COUPURES)
  @IsNumber({ maxDecimalPlaces: 2 }, { each: true })
  coupures?: number[];

  @IsOptional()
  @IsString()
  @MaxLength(190)
  libelle?: string;
}

export class AnnulationPaiementSalairesDto {
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  motif!: string;
}
