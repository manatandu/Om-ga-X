import { ModeAmortissement } from '@prisma/client';
import { IsDateString, IsEnum, IsInt, IsNumber, IsOptional, IsPositive, IsString, IsUUID, Matches, Max, MaxLength, Min, ValidateIf } from 'class-validator';
import { FacultatifNonNul } from '../../../common/facultatif-non-nul';

/**
 * LA MODIFICATION D'UNE FICHE DE BIEN (ligne sage-l4, fonction n° 66) · un
 * champ ABSENT reste inchangé. Les colonnes qui n'admettent pas `null` le
 * refusent en 400 nommé (`FacultatifNonNul`) ; numéro d'inventaire, nature
 * et date de mise en service s'effacent par `null`. Les champs à effet ne
 * passent que si la fiche les admet (`motifRefusModificationAEffet`), et
 * alors par les contrôles mêmes de la création (`preparerFiche`).
 */
export class ModifierImmobilisationDto {
  @FacultatifNonNul('La désignation ne s’efface pas · omettez le champ pour la garder.')
  @IsString()
  @MaxLength(500)
  @Matches(/\S/, { message: 'Indiquez une désignation.' })
  designation?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  numeroInventaire?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  natureFiscaleCle?: string | null;

  /** Ligne immos, n° 71 · `null` efface le numéro de série. */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  numeroSerie?: string | null;

  @FacultatifNonNul('Le compte du bien ne s’efface pas · omettez le champ pour le garder.')
  @IsUUID('4')
  compteImmobilisationId?: string;

  @FacultatifNonNul('La contrepartie ne s’efface pas · omettez le champ pour la garder.')
  @IsUUID('4')
  compteContrepartieId?: string;

  @FacultatifNonNul("La date d'acquisition ne s’efface pas · omettez le champ pour la garder.")
  @IsDateString()
  dateAcquisition?: string;

  /** `null` · le bien n'est pas encore mis en service (AUDCIF art. 45). */
  @ValidateIf((_o, v) => v !== undefined && v !== null)
  @IsDateString()
  dateMiseEnService?: string | null;

  @FacultatifNonNul('La valeur d’origine ne s’efface pas · omettez le champ pour la garder.')
  @IsNumber()
  @IsPositive()
  valeurOrigine?: number;

  @FacultatifNonNul('La valeur résiduelle ne s’efface pas · 0 pour aucune.')
  @IsNumber()
  @Min(0)
  valeurResiduelle?: number;

  @FacultatifNonNul('La durée ne s’efface pas · omettez le champ pour la garder.')
  @IsInt()
  @Min(1)
  @Max(100)
  dureeAmortissementAns?: number;

  @FacultatifNonNul('Le mode ne s’efface pas · omettez le champ pour le garder.')
  @IsEnum(ModeAmortissement)
  modeAmortissement?: ModeAmortissement;

  @FacultatifNonNul('Le total d’unités prévues ne s’efface pas · omettez le champ pour le garder.')
  @IsNumber()
  @IsPositive()
  unitesOeuvrePrevues?: number;

  @FacultatifNonNul('L’unité ne s’efface pas · omettez le champ pour la garder.')
  @IsString()
  @MaxLength(60)
  uniteOeuvreLibelle?: string;

  @FacultatifNonNul('L’amortissement déjà pratiqué ne s’efface pas · 0 pour aucun.')
  @IsNumber()
  @Min(0)
  amortissementAnterieur?: number;
}

