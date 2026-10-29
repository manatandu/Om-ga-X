import { Allow } from 'class-validator';

/**
 * Le corps du bilan social · jugé en entier par `motifRefusSaisie`
 * (`bilan-social.ts`) · `@Allow()` le déclare au pipe global, sans quoi
 * `forbidNonWhitelisted` refusait la saisie entière.
 */
export class BilanSocialDto {
  @Allow()
  lignes!: unknown;

  @Allow()
  commentaire!: unknown;

  /** L'instant d'enregistrement de la version lue par l'écran, ou null. */
  @Allow()
  lu!: unknown;
}
