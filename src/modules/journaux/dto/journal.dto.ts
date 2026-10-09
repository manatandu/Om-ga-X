import { IsBoolean, IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID, Length, MaxLength } from 'class-validator';
import { FacultatifNonNul } from '../../../common/facultatif-non-nul';
import { NumerotationPiece, TypeJournal } from '@prisma/client';

export class CreerJournalDto {
  // 6 caractères max côté frontend (JournauxPage) · imposé ici aussi pour
  // qu'un appel direct à l'API ne puisse pas contourner cette limite.
  @IsString()
  @Length(1, 6)
  code!: string;

  @IsString()
  intitule!: string;

  @IsEnum(TypeJournal)
  type!: TypeJournal;

  @IsOptional()
  @IsUUID()
  compteTresorerieId?: string;

  /**
   * OUVRIR LE COMPTE PROPRE DU JOURNAL sous ce compte du plan (décision de
   * Manasse du 2026-10-09) · au lieu d'un compte existant, jamais avec lui.
   */
  @FacultatifNonNul("Le compte du plan sous lequel ouvrir le compte du journal · omettez le champ pour choisir un compte existant.")
  @IsUUID('all', { message: 'Compte du plan inconnu' })
  ouvrirCompteSousId?: string;

  /** Numéro du compte ouvert · OmegaX le propose, le cabinet le garde ou le remplace. */
  @FacultatifNonNul("Un numéro de compte choisi est un numéro · omettez le champ pour garder celui qu'OmegaX propose.")
  @IsString({ message: 'Le numéro de compte choisi est une suite de chiffres' })
  @IsNotEmpty({ message: "Un numéro de compte choisi ne peut pas être vide · omettez le champ pour garder celui qu'OmegaX propose." })
  // La plage de `Tenant.longueurCompte` (3 à 13) · au-delà, aucun dossier ne l'admet.
  @MaxLength(13, { message: 'Un numéro de compte compte au plus 13 chiffres' })
  numeroCompte?: string;

  @IsOptional()
  @IsEnum(NumerotationPiece)
  numerotation?: NumerotationPiece;

  /** Contrepartie de trésorerie générée à chaque ligne (journaux de trésorerie seulement). */
  @IsOptional()
  @IsBoolean()
  contrepartieChaqueLigne?: boolean;
}

/** Le compte du plan sous lequel un journal ouvrirait son compte. */
export class CompteDuJournalProposeDto {
  @IsUUID('all', { message: 'Compte du plan inconnu' })
  sousId!: string;
}

export class ModifierJournalDto {
  @IsOptional()
  @IsString()
  intitule?: string;

  @IsOptional()
  @IsUUID()
  compteTresorerieId?: string;

  @IsOptional()
  @IsEnum(NumerotationPiece)
  numerotation?: NumerotationPiece;

  @IsOptional()
  @IsBoolean()
  estActif?: boolean;

  /** Contrepartie de trésorerie générée à chaque ligne (journaux de trésorerie seulement). */
  @IsOptional()
  @IsBoolean()
  contrepartieChaqueLigne?: boolean;
}
