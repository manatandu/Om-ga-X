import { Body, Controller, Get, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { RoleUtilisateur } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { LicenceGuard } from '../licence/licence.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { AccesRolesCantonnes } from '../../common/decorators/acces-roles-cantonnes.decorator';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { MessagerieService } from './messagerie.service';
import { EnvoyerMessageDto } from './dto/envoyer-message.dto';

/** Tout utilisateur du dossier écrit, lit et retire SES messages · aucun acte sur le dossier. */
const TOUS = Object.values(RoleUtilisateur);

/**
 * LA MESSAGERIE INTERNE (ligne dossier-l9, fonction 95) · Fichier > Messages.
 * Ouverte à tous les rôles, gestionnaire de paie compris (route par route,
 * `roles-cantonnes.spec.ts`) · chacun n'y lit que les messages qu'il a
 * envoyés ou reçus, jamais ceux d'un autre, administrateur compris.
 */
@UseGuards(JwtAuthGuard, LicenceGuard, RolesGuard)
@Controller('messages')
export class MessagerieController {
  constructor(private readonly service: MessagerieService) {}

  @Get('recus')
  @AccesRolesCantonnes({ gestionnairePaie: true })
  recus(@CurrentUser() user: AuthenticatedUser) {
    return this.service.recus(user.tenantId, user.userId);
  }

  @Get('envoyes')
  @AccesRolesCantonnes({ gestionnairePaie: true })
  envoyes(@CurrentUser() user: AuthenticatedUser) {
    return this.service.envoyes(user.tenantId, user.userId);
  }

  @Get('non-lus')
  @AccesRolesCantonnes({ gestionnairePaie: true })
  nonLus(@CurrentUser() user: AuthenticatedUser) {
    return this.service.nonLus(user.tenantId, user.userId);
  }

  @Get('destinataires')
  @AccesRolesCantonnes({ gestionnairePaie: true })
  destinataires(@CurrentUser() user: AuthenticatedUser) {
    return this.service.destinataires(user.tenantId, user.userId);
  }

  @Get(':id')
  @AccesRolesCantonnes({ gestionnairePaie: true })
  lire(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.lire(user.tenantId, user.userId, id);
  }

  @Post()
  @Roles(...TOUS)
  @AccesRolesCantonnes({ gestionnairePaie: true })
  envoyer(@CurrentUser() user: AuthenticatedUser, @Body() dto: EnvoyerMessageDto) {
    return this.service.envoyer(user.tenantId, user.userId, dto);
  }

  @Post(':id/lu')
  @Roles(...TOUS)
  @AccesRolesCantonnes({ gestionnairePaie: true })
  marquerLu(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.marquerLu(user.tenantId, user.userId, id);
  }

  @Post(':id/retirer')
  @Roles(...TOUS)
  @AccesRolesCantonnes({ gestionnairePaie: true })
  retirer(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.retirer(user.tenantId, user.userId, id);
  }
}
