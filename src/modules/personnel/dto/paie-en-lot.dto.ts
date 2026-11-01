import { IsIn, IsInt, IsOptional, Matches, Max, Min } from 'class-validator';
import { BORNES_PARAMETRES_PAIE, MOIS_AAAA_MM, NATURES_EMPLOYEUR_INPP, REGIMES_SALARIAUX_DU_DOSSIER, type RegimeSalarialDuDossier } from '../paie-en-lot';

/**
 * LIGNE PAIE-LOT · DÉCLARER les paramètres de paie du dossier. Chaque colonne
 * admet `null`, et `null` veut dire « pas encore dit » (effacement) · c'est
 * pourquoi `@IsOptional()` est juste ici (§ 9, facultatif et nullable). Un
 * champ absent laisse la valeur en place.
 *
 * NATURE ET EFFECTIF INPP SE DÉCLARENT ENSEMBLE AVEC LEUR MOIS D'EFFET
 * (`inppDepuisMois`, AAAA-MM) · le taux dépend du mois (décision T5), et une
 * déclaration sans date s'appliquerait à des mois qu'elle ne régit pas. Le
 * service exige les trois ensemble ; la base le tient aussi (CHECK).
 */
export class ParametresPaieDto {
  @IsOptional()
  @IsIn(NATURES_EMPLOYEUR_INPP as unknown as string[])
  natureEmployeurInpp?: 'PUBLIC' | 'PRIVE' | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(BORNES_PARAMETRES_PAIE.effectifMax)
  effectifInpp?: number | null;

  @IsOptional()
  @Matches(MOIS_AAAA_MM, { message: "Le mois d'effet de la déclaration INPP se lit AAAA-MM." })
  inppDepuisMois?: string | null;

  /** Au dossier, seulement ce qui qualifie l'employeur (art. 121, al. 2) · le personnel domestique se déclare au salarié. */
  @IsOptional()
  @IsIn(REGIMES_SALARIAUX_DU_DOSSIER as unknown as string[], {
    message: "Au dossier, le régime est le barème ou celui des salariés d'une micro-entreprise · le personnel domestique se déclare à la simulation du salarié.",
  })
  regimeSalarial?: RegimeSalarialDuDossier | null;
}
