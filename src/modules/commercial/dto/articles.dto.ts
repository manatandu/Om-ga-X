import { IsBoolean, IsIn, IsNumber, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { FacultatifNonNul } from '../../../common/facultatif-non-nul';

/**
 * Article commercial (ligne commercial-l8, étape a). Les champs facultatifs
 * dont la colonne admet `null` s'effacent par `null` à la modification ·
 * compte de vente ou d'achat, taux, prix de base, fiche de stock.
 */
export class CreerArticleCommercialDto {
  @IsString() @MinLength(1) @MaxLength(18) reference!: string;
  @IsString() @MinLength(1) @MaxLength(120) designation!: string;
  @IsString() @MinLength(1) @MaxLength(20) unite!: string;
  @IsOptional() @IsUUID() compteVenteId?: string | null;
  @IsOptional() @IsUUID() compteAchatId?: string | null;
  @IsOptional() @IsUUID() tauxTvaId?: string | null;
  @FacultatifNonNul('Une opération est exonérée ou ne l’est pas · omettez le champ, ou portez false.') @IsBoolean() exonere?: boolean;
  @IsOptional() @IsNumber() prixVenteHT?: number | null;
  @IsOptional() @IsNumber() prixAchatHT?: number | null;
  @IsOptional() @IsUUID() articleStockId?: string | null;
}

export class ModifierArticleCommercialDto {
  @FacultatifNonNul('La désignation ne s’efface pas · omettez le champ pour la garder.') @IsString() @MinLength(1) @MaxLength(120) designation?: string;
  @FacultatifNonNul('L’unité ne s’efface pas · omettez le champ pour la garder.') @IsString() @MinLength(1) @MaxLength(20) unite?: string;
  @IsOptional() @IsUUID() compteVenteId?: string | null;
  @IsOptional() @IsUUID() compteAchatId?: string | null;
  @IsOptional() @IsUUID() tauxTvaId?: string | null;
  @FacultatifNonNul('Une opération est exonérée ou ne l’est pas · omettez le champ, ou portez false.') @IsBoolean() exonere?: boolean;
  @IsOptional() @IsNumber() prixVenteHT?: number | null;
  @IsOptional() @IsNumber() prixAchatHT?: number | null;
  @IsOptional() @IsUUID() articleStockId?: string | null;
  @FacultatifNonNul('Un article est actif ou en sommeil · omettez le champ, ou portez true ou false.') @IsBoolean() actif?: boolean;
}

export class ListerArticlesDto {
  @IsOptional() @IsString() @MaxLength(60) recherche?: string;
  /** « oui » pour les seuls actifs, la liste de choix d'une pièce. */
  @IsOptional() @IsString() actifs?: string;
}

/** Un tarif propre à un client · posé ou remplacé pour le couple (article, client). */
export class PoserTarifClientDto {
  @IsUUID() articleId!: string;
  @IsUUID() tiersId!: string;
  @IsOptional() @IsNumber() prixHT?: number | null;
  @IsOptional() @IsNumber() remisePourcent?: number | null;
}

export class PropositionPrixDto {
  @IsUUID() articleId!: string;
  @IsOptional() @IsUUID() tiersId?: string;
  @IsOptional() @IsIn(['VENTE', 'ACHAT']) sens?: 'VENTE' | 'ACHAT';
}
