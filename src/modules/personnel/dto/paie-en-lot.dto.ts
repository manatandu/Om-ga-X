import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import type { RegimeSalarial } from '../bareme-irpp';
import { BORNES_PARAMETRES_PAIE, NATURES_EMPLOYEUR_INPP, REGIMES_SALARIAUX_DECLARES } from '../paie-en-lot';

/**
 * LIGNE PAIE-LOT · DÉCLARER les paramètres de paie du dossier. Chaque colonne
 * admet `null`, et `null` veut dire « pas encore dit » (effacement) · c'est
 * pourquoi `@IsOptional()` est juste ici (§ 9, facultatif et nullable). Un
 * champ absent laisse la valeur en place.
 */
export class ParametresPaieDto {
  @IsOptional()
  @IsIn(NATURES_EMPLOYEUR_INPP as unknown as string[])
  natureEmployeurInpp?: 'PUBLIC' | 'PRIVE' | null;

  @IsOptional()
  @IsIn(REGIMES_SALARIAUX_DECLARES as unknown as string[])
  regimeSalarial?: RegimeSalarial | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(BORNES_PARAMETRES_PAIE.effectifMax)
  effectifInpp?: number | null;

  @IsOptional()
  @IsInt()
  @Min(BORNES_PARAMETRES_PAIE.joursMin)
  @Max(BORNES_PARAMETRES_PAIE.joursMax)
  joursPayes?: number | null;
}
