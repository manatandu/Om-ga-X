import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';
import { ControleEntreprise } from '@prisma/client';

/**
 * FICHE R2 · cases ZN à ZS (AUDCIF Titre IX ch. 2 ; décision par la loi du
 * 2026-10-04, point 5). SYSCOHADA seul, par exercice.
 *
 * Un champ ABSENT laisse la case telle quelle ; `null` l'efface (« non
 * renseignée » à l'impression). Les colonnes sont nullables · voir
 * `common/facultatif-non-nul.ts` pour la règle inverse.
 */
export class FicheR2Dto {
  /** ZN · nombre entier déclaré, au moins zéro. */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1_000_000)
  nombreEtablissementsPays?: number | null;

  /** ZO · seuls les établissements hors du pays qui tiennent une comptabilité distincte. */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1_000_000)
  nombreEtablissementsHorsPays?: number | null;

  /** ZP · une année à quatre chiffres. */
  @IsOptional()
  @IsInt()
  @Min(1000)
  @Max(9999)
  premiereAnneeExercicePays?: number | null;

  /** ZQ / ZQ / ZS · une seule réponse, ou null (pas encore dit). */
  @IsOptional()
  @IsEnum(ControleEntreprise)
  controleEntreprise?: ControleEntreprise | null;
}
