import { IsString } from 'class-validator';

/**
 * LA FIN DE L'EXERCICE DE LIQUIDATION (décision par la loi du 2026-10-07,
 * point 2 · AUDCIF art. 7 al. 4) · un JOUR écrit AAAA-MM-JJ, lu par la règle
 * commune (`jourSaisiOuEffacement`) · une heure avec fuseau ou un jour absent
 * du calendrier est refusé en 400 nommé.
 */
export class FinLiquidationDto {
  @IsString()
  dateFin!: string;
}
