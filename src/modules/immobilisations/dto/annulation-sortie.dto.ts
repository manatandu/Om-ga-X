import { IsString, MaxLength, MinLength } from 'class-validator';

/**
 * L'annulation de la sortie d'un bien (ligne restes-immos-budgets, point 3) ·
 * le motif est gardé avec l'historique et au journal d'audit (AUDCIF art. 20,
 * al. 2), rejugé au service.
 */
export class AnnulerSortieDto {
  @IsString({ message: "Indiquez le motif de l'annulation." })
  @MinLength(3, { message: "Indiquez le motif de l'annulation (trois caractères au moins)." })
  @MaxLength(500, { message: "Le motif de l'annulation ne dépasse pas cinq cents caractères." })
  motif!: string;
}
