import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Put, UseGuards } from '@nestjs/common';
import { RoleUtilisateur } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { LicenceGuard } from '../licence/licence.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { AccesRolesCantonnes } from '../../common/decorators/acces-roles-cantonnes.decorator';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { PreferencesService } from './preferences.service';
import { ReglerPreferencesDto } from './dto/regler-preferences.dto';

/** Chacun règle ses préférences et lit ses notifications · aucun acte sur le dossier. */
const TOUS = Object.values(RoleUtilisateur);

/**
 * LES PRÉFÉRENCES ET LES NOTIFICATIONS DE CHACUN (ligne dossier-l9, fonctions
 * 96 et 100) · Fichier > Personnaliser, Mon compte (langue), Notifications.
 * Ouvertes à tous les rôles, gestionnaire de paie compris, route par route
 * (`roles-cantonnes.spec.ts`).
 */
@UseGuards(JwtAuthGuard, LicenceGuard, RolesGuard)
@Controller('preferences')
export class PreferencesController {
  constructor(private readonly service: PreferencesService) {}

  @Get()
  @AccesRolesCantonnes({ gestionnairePaie: true })
  lire(@CurrentUser() user: AuthenticatedUser) {
    return this.service.lire(user.tenantId, user.userId);
  }

  @Put()
  @Roles(...TOUS)
  @AccesRolesCantonnes({ gestionnairePaie: true })
  regler(@CurrentUser() user: AuthenticatedUser, @Body() dto: ReglerPreferencesDto) {
    return this.service.regler(user.tenantId, user.userId, dto);
  }
}

@UseGuards(JwtAuthGuard, LicenceGuard, RolesGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly service: PreferencesService) {}

  @Get()
  @AccesRolesCantonnes({ gestionnairePaie: true })
  lister(@CurrentUser() user: AuthenticatedUser) {
    return this.service.notifications(user.tenantId, user.userId);
  }

  @Get('non-lues')
  @AccesRolesCantonnes({ gestionnairePaie: true })
  nonLues(@CurrentUser() user: AuthenticatedUser) {
    return this.service.nonLues(user.tenantId, user.userId);
  }

  @Post('tout-lu')
  @Roles(...TOUS)
  @AccesRolesCantonnes({ gestionnairePaie: true })
  toutLu(@CurrentUser() user: AuthenticatedUser) {
    return this.service.toutLu(user.tenantId, user.userId);
  }

  @Post(':id/lue')
  @Roles(...TOUS)
  @AccesRolesCantonnes({ gestionnairePaie: true })
  marquerLue(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.marquerLue(user.tenantId, user.userId, id);
  }
}
