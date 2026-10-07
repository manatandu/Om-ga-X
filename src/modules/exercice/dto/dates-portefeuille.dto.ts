import { IsDateString, IsOptional } from 'class-validator';

/**
 * ENTREPRISE DU PORTEFEUILLE DE L'ÉTAT · O.-L. n° 13/003, art. 112 et 113
 * (décision par la loi du 2026-10-04, point 1). Un champ absent reste tel
 * quel ; `null` efface la date déclarée.
 */
export class DatesPortefeuilleDto {
  /** Assemblée générale ordinaire statuant sur les résultats (art. 112). */
  @IsOptional()
  @IsDateString()
  dateAssembleeGenerale?: string | null;

  /** Dépôt des états financiers au ministère du Portefeuille (art. 113). */
  @IsOptional()
  @IsDateString()
  dateDepotEtatsPortefeuille?: string | null;
}
