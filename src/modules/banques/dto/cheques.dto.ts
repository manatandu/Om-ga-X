import { IsBoolean, IsInt, IsNumber, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { FacultatifNonNul } from '../../../common/facultatif-non-nul';

/** Le carnet reçu de la banque · plage de numéros sur un RIB du dossier. */
export class CreerChequierDto {
  @IsString()
  ribId!: string;

  @IsInt()
  numeroDebut!: number;

  @IsInt()
  numeroFin!: number;

  /** Le nombre de chiffres imprimés sur le feuillet. */
  @IsInt()
  largeur!: number;

  @FacultatifNonNul('« barré » est vrai ou faux · omettez-le pour un carnet pré-barré.')
  @IsBoolean()
  barre?: boolean;

  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'La date de réception se donne au format AAAA-MM-JJ.' })
  dateReception!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  commentaire?: string | null;
}

/** Le chèque tiré · numéro, date, bénéficiaire, montant, et la pièce de la banque qui le porte (facultative). */
export class EmettreChequeDto {
  @IsString()
  chequierId!: string;

  @IsInt()
  numero!: number;

  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: "La date d'émission se donne au format AAAA-MM-JJ." })
  dateEmission!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(150)
  beneficiaire!: string;

  @IsNumber()
  montant!: number;

  @IsOptional()
  @IsString()
  ecritureId?: string;
}

export class RattacherPieceChequeDto {
  @IsString()
  ecritureId!: string;
}

export class AnnulerChequeDto {
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  motif!: string;
}

/** Un numéro jamais émis, annulé · feuillet gâché, perdu, chèque refait. */
export class AnnulerNumeroDto {
  @IsString()
  chequierId!: string;

  @IsInt()
  numero!: number;

  @IsString()
  @MinLength(3)
  @MaxLength(500)
  motif!: string;
}
