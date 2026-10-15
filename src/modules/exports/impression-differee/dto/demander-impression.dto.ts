import { NatureImpressionDifferee } from '@prisma/client';
import { IsEnum, IsObject } from 'class-validator';

/**
 * Une demande d'impression différée · le livre, et ses critères, que le
 * service relit un à un (`criteresOuMotif`) · ce qui n'est pas un critère du
 * livre demandé n'est jamais gardé.
 */
export class DemanderImpressionDto {
  @IsEnum(NatureImpressionDifferee, { message: 'Livre inconnu · JOURNAL, GRAND_LIVRE ou BALANCE.' })
  nature!: NatureImpressionDifferee;

  @IsObject({ message: 'Les critères de l’édition sont exigés.' })
  criteres!: Record<string, unknown>;
}
