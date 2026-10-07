import { IsBoolean } from 'class-validator';
import { FacultatifNonNul } from '../../../common/facultatif-non-nul';

/**
 * LES GESTES QUI CHANGENT LA PÉRIODE D'UN EXERCICE (arrêt à la dissolution,
 * son annulation, rattachement à la liquidation) · `retirerActesDeLaPeriode`
 * est l'accord du cabinet pour retirer les actes calculés sur l'ancienne
 * période (relecture du 2026-10-07, bloquant 1 · AUDCIF art. 59). Absent, le
 * geste les nomme et refuse · jamais un retrait d'office.
 */
export class GesteDissolutionDto {
  @FacultatifNonNul('retirerActesDeLaPeriode vaut true ou false · omettez le champ pour ne rien retirer.')
  @IsBoolean()
  retirerActesDeLaPeriode?: boolean;
}
