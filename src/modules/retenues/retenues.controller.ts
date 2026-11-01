import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { LicenceGuard } from '../licence/licence.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { RetenuesService } from './retenues.service';
import { EXERCICE_REQUIS } from '../../common/exercice-requis';
import { AccesRolesCantonnes } from '../../common/decorators/acces-roles-cantonnes.decorator';

@UseGuards(JwtAuthGuard, LicenceGuard, RolesGuard)
@Controller('retenues')
export class RetenuesController {
  constructor(private readonly retenues: RetenuesService) {}

  /**
   * Registre des retenues à la source et des cotisations sociales.
   *
   * OUVERT EN LECTURE AU GESTIONNAIRE DE PAIE (ligne paie-declarations, gel
   * levé par Manasse le 2026-11-01) · ce qu'il retient sur la paie (quote-part
   * ouvrière, impôt, INPP, ONEM) se reverse aux échéances que ce registre
   * date ; lui fermer la lecture le laissait payer sans savoir quand reverser.
   * Les deux routes sont des LECTURES · aucun geste d'écriture n'est ouvert,
   * et la liste fermée de `roles-cantonnes.spec.ts` les tient route par route.
   */
  @Get('registre')
  @AccesRolesCantonnes({ gestionnairePaie: true })
  async registre(
    @CurrentUser() user: AuthenticatedUser,
    @Query('exerciceId', EXERCICE_REQUIS) exerciceId: string,
    @Query('dateReference') dateReference?: string,
  ) {
    return this.retenues.registre(user.tenantId, { exerciceId, dateReference });
  }

  /** Échéancier fiscal et social · les prochaines dates de reversement. */
  @Get('echeancier')
  @AccesRolesCantonnes({ gestionnairePaie: true })
  async echeancier(
    @CurrentUser() user: AuthenticatedUser,
    @Query('exerciceId', EXERCICE_REQUIS) exerciceId: string,
    @Query('dateReference') dateReference?: string,
  ) {
    return this.retenues.echeancierFiscal(user.tenantId, { exerciceId, dateReference });
  }
}
