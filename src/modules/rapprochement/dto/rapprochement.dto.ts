import { Transform, Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { enEntier } from '../../../common/audit/filtre-journal-audit.dto';
import { FENETRE_JOURS_MAX } from '../releve-bancaire';

/**
 * LA FENÊTRE DE DATES DES PROPOSITIONS (paquet 1, B9) · FACULTATIVE.
 *
 * `ParseIntPipe({ optional: true })` ne suffisait pas · le ValidationPipe
 * global (`transform: true`) convertit d'abord le paramètre ABSENT en nombre,
 * `Number(undefined)` rend NaN, et le pipe le refusait en 400 « numeric
 * string is expected » · l'appel sans fenêtre, que le service sert pourtant
 * avec son défaut (`FENETRE_JOURS_DEFAUT`, quinze jours, convention d'OmegaX,
 * aucun texte ne la fixe), ne passait jamais. Absente, la fenêtre prend ce
 * défaut, celui de l'écran ; illisible ou hors de la plage que l'écran
 * propose (0 à 120 jours), elle est refusée par un 400 qui la NOMME. Au-delà,
 * la date bornée par la fenêtre sortait du calendrier et la lecture tombait
 * en 500.
 */
export class PropositionsRapprochementDto {
  @IsOptional()
  @Transform(enEntier)
  @IsInt({ message: `Fenêtre de dates illisible · un nombre entier de jours, de 0 à ${FENETRE_JOURS_MAX}, est attendu.` })
  @Min(0, { message: `Fenêtre de dates illisible · un nombre entier de jours, de 0 à ${FENETRE_JOURS_MAX}, est attendu.` })
  @Max(FENETRE_JOURS_MAX, {
    message: `Fenêtre de dates hors limite · ${FENETRE_JOURS_MAX} jours au plus, comme à l'écran.`,
  })
  fenetreJours?: number;
}

export class OuvrirRapprochementDto {
  @IsUUID('4')
  compteId!: string;

  @IsDateString()
  dateReleve!: string;

  @IsNumber()
  soldeReleve!: number;
}

export class PointerDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  ligneIds!: string[];
}

const TAILLE_MAX_BASE64 = 11_000_000;

/**
 * Relevé bancaire importé · même voie d'entrée que les autres imports (fichier
 * en base64 dans le corps JSON, CSV ou XLSX).
 */
export class ImporterReleveDto {
  @IsString()
  nomFichier!: string;

  @IsString()
  @MaxLength(TAILLE_MAX_BASE64, { message: 'Fichier trop volumineux (8 Mo maximum)' })
  contenuBase64!: string;

  /** Colonnes désignées par le cabinet quand l'en-tête n'est pas reconnu. */
  @IsOptional()
  @IsObject()
  colonnes?: Record<string, string>;
}

export class CorrespondanceDto {
  @IsUUID('4')
  ligneReleveId!: string;

  // Peut être vide quand la correspondance ne réunit que des en-cours
  // d'ouverture · le service exige au moins une ligne au total.
  @IsArray()
  @IsUUID('4', { each: true })
  ligneEcritureIds!: string[];

  /** En-cours d'ouverture de la chaîne, pointés comme des lignes du compte. */
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  encoursIds?: string[];
}

export class ConfirmerCorrespondancesDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CorrespondanceDto)
  correspondances!: CorrespondanceDto[];
}

/**
 * SOLDE DE DÉPART du premier rapprochement d'un compte, lu sur le relevé ·
 * dans le sens du solde du relevé (positif = avoir en banque), à l'ouverture
 * de la date de départ.
 */
export class DeclarerDepartDto {
  @IsNumber()
  soldeDepart!: number;

  @IsDateString()
  dateDepart!: string;
}

/**
 * EN-COURS D'OUVERTURE · une opération du livre antérieure à la date de
 * départ, que la banque n'avait pas encore passée. Le sens est celui du
 * compte 52 · DEBIT pour une entrée (remise non encore créditée), CREDIT pour
 * une sortie (chèque émis non encore présenté).
 */
export class DeclarerEncoursDto {
  @IsString()
  @MaxLength(200)
  libelle!: string;

  @IsDateString()
  date!: string;

  @IsNumber()
  montant!: number;

  @IsIn(['DEBIT', 'CREDIT'])
  sens!: 'DEBIT' | 'CREDIT';
}

export class PointerEncoursDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  encoursIds!: string[];
}

/** Réouverture d'un rapprochement clos · le motif reste sur la ligne. */
export class RouvrirRapprochementDto {
  @IsString()
  @MaxLength(500)
  motif!: string;
}
