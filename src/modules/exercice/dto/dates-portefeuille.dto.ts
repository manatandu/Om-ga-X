import { IsDateString, IsOptional, ValidateIf } from 'class-validator';

/**
 * ASSEMBLÉE ET PORTEFEUILLE DE L'ÉTAT · O.-L. n° 13/003, art. 112 et 113 ;
 * LPF art. 13 bis pour l'assemblée (décision par la loi du 2026-10-04,
 * point 1). Un champ absent reste tel quel ; `null` ou la chaîne vide efface
 * la date déclarée. La date est lue par `jourSaisiOuEffacement`
 * (`tenant/date-effacable.ts`) · un jour absent du calendrier (« 2026-02-30 »)
 * ou illisible (« 20270101 ») est refusé en 400, jamais reporté en silence.
 */
export class DatesPortefeuilleDto {
  /** Assemblée générale ordinaire statuant sur les comptes de l'exercice (art. 112 ; LPF art. 13 bis). */
  @IsOptional()
  @ValidateIf((o: DatesPortefeuilleDto) => o.dateAssembleeGenerale !== '' && o.dateAssembleeGenerale !== null)
  @IsDateString()
  dateAssembleeGenerale?: string | null;

  /** Dépôt des états financiers au ministère du Portefeuille (art. 113). */
  @IsOptional()
  @ValidateIf((o: DatesPortefeuilleDto) => o.dateDepotEtatsPortefeuille !== '' && o.dateDepotEtatsPortefeuille !== null)
  @IsDateString()
  dateDepotEtatsPortefeuille?: string | null;

  /** Communication du procès-verbal à l'Administration des recettes non fiscales (art. 112). */
  @IsOptional()
  @ValidateIf(
    (o: DatesPortefeuilleDto) => o.dateTransmissionPvPortefeuille !== '' && o.dateTransmissionPvPortefeuille !== null,
  )
  @IsDateString()
  dateTransmissionPvPortefeuille?: string | null;
}
