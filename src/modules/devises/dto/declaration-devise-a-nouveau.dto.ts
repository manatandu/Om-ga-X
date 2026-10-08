import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsNumber, IsOptional, IsPositive, IsString, IsUUID, Length, ValidateNested } from 'class-validator';
import { PARTS_MAXIMUM } from '../declaration-devise-a-nouveau';

/** Une part de la ligne · sa devise, son montant en devise, son cours, sa part en francs. */
export class PartDeclareeDto {
  @IsUUID()
  deviseId!: string;

  @IsNumber()
  @IsPositive()
  montantDevise!: number;

  /** Absent, il se déduit des deux montants (AUDCIF art. 52). */
  @IsOptional()
  @IsNumber()
  @IsPositive()
  coursApplique?: number;

  @IsNumber()
  @IsPositive()
  montant!: number;
}

/**
 * La devise d'une ligne d'à-nouveau (ligne AU3) · la ligne, ses parts (vide =
 * entièrement en francs) et la SOURCE, exigée · la pièce qui établit la
 * devise et le montant en devise.
 */
export class DeclarerDeviseANouveauDto {
  @IsUUID()
  ligneId!: string;

  @IsArray()
  @ArrayMaxSize(PARTS_MAXIMUM)
  @ValidateNested({ each: true })
  @Type(() => PartDeclareeDto)
  parts!: PartDeclareeDto[];

  @IsString()
  @Length(3, 500)
  source!: string;
}
