import { IsEnum, IsInt, IsString, IsUUID, Max, MaxLength, Min, MinLength, ValidateIf, IsOptional } from 'class-validator';
import { JeuNotesAnnexes } from '@prisma/client';
import { FacultatifNonNul } from '../../../common/facultatif-non-nul';
import { MOTIF_RETRAIT_MAX, MOTIF_RETRAIT_MIN } from '../effectifs-seize-colonnes';

/**
 * Une CELLULE d'une rubrique de note renseignée hors comptabilité.
 *
 * Le DTO ne valide que la forme. Ce qui relève du texte officiel · la note
 * existe, la rubrique est bien en saisie, la colonne existe, et son type
 * commande texte ou montant · se vérifie dans le service, contre la
 * spécification (`NoteAnnexeService.celluleSaisissable`) : c'est la seule
 * source de vérité, et la dupliquer ici la ferait vieillir d'un côté.
 */
export class SaisirNoteDto {
  @IsUUID()
  exerciceId!: string;

  @IsEnum(JeuNotesAnnexes)
  jeu!: JeuNotesAnnexes;

  /** Code officiel de la note : « 18B », « 29B », « 16B bis ». */
  @IsString()
  @MinLength(1)
  codeNote!: string;

  /** Clé stable de la rubrique (RubriqueNote.cle), jamais son libellé. */
  @IsString()
  @MinLength(1)
  cleRubrique!: string;

  /** Rang de la colonne dans la note, à partir de 0. */
  @IsInt()
  @Min(0)
  colonne!: number;

  /**
   * Rang de LIGNE d'une rubrique répétable (une ligne par apporteur, par
   * entité, par produit), à partir de 0 · absent = 0. Refusé au-delà de 0 sur
   * une rubrique à ligne unique.
   */
  // FACULTATIF NE VEUT PAS DIRE NULLABLE · la colonne est NOT NULL, et un
  // `null` lu `?? 0` écraserait la première ligne de la liste.
  @FacultatifNonNul('Le rang de ligne se donne par un entier à partir de 0, ou s’omet pour la ligne unique · jamais null.')
  @IsInt()
  @Min(0)
  @Max(999)
  rang?: number;

  /**
   * Ce que le dossier écrit. `null` ou vide EFFACE la cellule · c'est ce que
   * rend un champ qu'on vide, et une cellule vidée ne doit pas rester
   * « renseignée à rien ».
   */
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  valeur?: string | null;
}

/**
 * RETRAIT D'UNE SAISIE AU FORMAT ANTÉRIEUR (notes 20B et 29B) · toute la
 * saisie à huit colonnes « (M / F) » de la note, une fois reportée dans les
 * seize colonnes. Le motif est exigé et part au journal d'audit.
 */
export class RetirerFormatAnterieurDto {
  @IsUUID()
  exerciceId!: string;

  @IsEnum(JeuNotesAnnexes)
  jeu!: JeuNotesAnnexes;

  @IsString()
  @MinLength(1)
  codeNote!: string;

  @IsString()
  @MinLength(MOTIF_RETRAIT_MIN, { message: `Le motif du retrait compte ${MOTIF_RETRAIT_MIN} caractères au moins.` })
  @MaxLength(MOTIF_RETRAIT_MAX, { message: `Le motif du retrait compte ${MOTIF_RETRAIT_MAX} caractères au plus.` })
  motif!: string;
}
