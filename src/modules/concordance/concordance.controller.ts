import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { LicenceGuard } from '../licence/licence.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { EXERCICE_REQUIS } from '../../common/exercice-requis';
import { ConcordanceService } from './concordance.service';

/**
 * LA CONCORDANCE DES MODULES AVEC LA COMPTABILITÉ (ligne microfina-m1,
 * idée 12) · une LECTURE, et rien d'autre · aucune route n'écrit, et aucune
 * ne le fera (`concordance.ts`). Ouverte à qui lit les états ; les rôles
 * cantonnés en restent fermés par défaut (`roles-cantonnes.ts`).
 */
@UseGuards(JwtAuthGuard, LicenceGuard, RolesGuard)
@Controller('concordance')
export class ConcordanceController {
  constructor(private readonly concordance: ConcordanceService) {}

  @Get()
  lire(@CurrentUser() user: AuthenticatedUser, @Query('exerciceId', EXERCICE_REQUIS) exerciceId: string) {
    return this.concordance.concordance(user.tenantId, exerciceId);
  }
}
