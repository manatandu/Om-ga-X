import { NatureModeleImpression } from '@prisma/client';
import { IsEnum, IsString, MaxLength } from 'class-validator';
import { FacultatifNonNul } from '../../../common/facultatif-non-nul';
import { LONGUEUR_INTITULE_MODELE, LONGUEUR_TEXTE_MODELE } from '../modeles-impression';

/**
 * UN MODÈLE D'IMPRESSION (ligne sage-l2, fonction 27) · nature, intitulé,
 * texte. Le jeton {document}, les jetons admis et l'unicité de l'intitulé
 * sont jugés par le service (`tiers/modeles-impression.ts`).
 */
export class CreerModeleImpressionDto {
  @IsEnum(NatureModeleImpression, { message: 'Nature de modèle inconnue · extrait de compte, avis de règlement ou rappel.' })
  nature!: NatureModeleImpression;

  @IsString()
  @MaxLength(LONGUEUR_INTITULE_MODELE, { message: `L'intitulé du modèle tient en ${LONGUEUR_INTITULE_MODELE} caractères au plus.` })
  intitule!: string;

  @IsString()
  @MaxLength(LONGUEUR_TEXTE_MODELE, { message: `Le texte du modèle tient en ${LONGUEUR_TEXTE_MODELE} caractères au plus.` })
  texte!: string;
}

/**
 * LA NATURE NE CHANGE PAS · un modèle d'avis de règlement devenu rappel
 * habillerait, chez les tiers qui l'ont choisi, une autre lettre que celle
 * pour laquelle on l'a posé. Il se recrée dans l'autre nature.
 */
export class ModifierModeleImpressionDto {
  @FacultatifNonNul("L'intitulé du modèle ne s'efface pas.")
  @IsString()
  @MaxLength(LONGUEUR_INTITULE_MODELE, { message: `L'intitulé du modèle tient en ${LONGUEUR_INTITULE_MODELE} caractères au plus.` })
  intitule?: string;

  @FacultatifNonNul("Le texte du modèle ne s'efface pas.")
  @IsString()
  @MaxLength(LONGUEUR_TEXTE_MODELE, { message: `Le texte du modèle tient en ${LONGUEUR_TEXTE_MODELE} caractères au plus.` })
  texte?: string;
}
