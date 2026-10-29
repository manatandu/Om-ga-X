import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { LicenceGuard } from '../licence/licence.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { EXERCICE_REQUIS } from '../../common/exercice-requis';
import { EcheancesTiersService } from './echeances-tiers.service';

/**
 * LES ÉCHÉANCES PROCHES DES TIERS (ligne gl-saisie, fonction 34) · une
 * lecture, servie au tableau de bord. L'exercice est requis et jugé au
 * dossier par son porteur.
 */
@UseGuards(JwtAuthGuard, LicenceGuard, RolesGuard)
@Controller('echeances-tiers')
export class EcheancesTiersController {
  constructor(private readonly echeances: EcheancesTiersService) {}

  @Get()
  async proches(@CurrentUser() user: AuthenticatedUser, @Query('exerciceId', EXERCICE_REQUIS) exerciceId: string) {
    return this.echeances.echeancesProches(user.tenantId, exerciceId);
  }
}
