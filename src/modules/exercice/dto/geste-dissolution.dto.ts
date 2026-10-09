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

  /**
   * Second tour de relecture du paquet 1, BLOQUANT 2 · l'accord du cabinet
   * qu'une ouverture du premier jour, annulée par un négatif inscrit plus tard,
   * n'a pas été ressaisie (`issueOuvertureQuiSeDeplace`, AUDCIF art. 20,
   * al. 2 ; art. 34). Absent, le geste nomme le négatif et refuse.
   */
  @FacultatifNonNul('ouvertureAnnuleeNonRessaisie vaut true ou false · omettez le champ pour ne rien confirmer.')
  @IsBoolean()
  ouvertureAnnuleeNonRessaisie?: boolean;
}
