import { Controller, Get, Param, ParseUUIDPipe, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { LicenceGuard } from '../licence/licence.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { EXERCICE_REQUIS } from '../../common/exercice-requis';
import { InterrogationCompteService } from './interrogation-compte.service';

/**
 * INTERROGER LE COMPTE DEPUIS LA SAISIE (ligne gl-saisie, fonction 13) · une
 * LECTURE, ouverte aux rôles qui lisent les livres, comme le grand livre du
 * compte. Le compte d'un autre dossier est introuvable (404), l'exercice est
 * requis et jugé au dossier par son porteur.
 */
@UseGuards(JwtAuthGuard, LicenceGuard, RolesGuard)
@Controller('interrogation-compte')
export class InterrogationCompteController {
  constructor(private readonly interrogation: InterrogationCompteService) {}

  @Get(':compteId')
  async interroger(
    @CurrentUser() user: AuthenticatedUser,
    @Param('compteId', ParseUUIDPipe) compteId: string,
    @Query('exerciceId', EXERCICE_REQUIS) exerciceId: string,
  ) {
    return this.interrogation.interroger(user.tenantId, compteId, exerciceId);
  }
}
