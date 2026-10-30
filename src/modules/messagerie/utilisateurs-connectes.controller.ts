import { Controller, Get, UseGuards } from '@nestjs/common';
import { RoleUtilisateur } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { LicenceGuard } from '../licence/licence.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { MessagerieService } from './messagerie.service';

/**
 * LES UTILISATEURS CONNECTÉS (ligne dossier-l9, fonction 95) · Fichier >
 * Utilisateurs connectés, à l'administrateur du dossier seul, comme les
 * autorisations d'accès. Une lecture · la déconnexion passe par la route
 * qui existe (`POST /utilisateurs/:id/deconnecter`).
 */
@UseGuards(JwtAuthGuard, LicenceGuard, RolesGuard)
@Controller('utilisateurs-connectes')
export class UtilisateursConnectesController {
  constructor(private readonly service: MessagerieService) {}

  @Get()
  @Roles(RoleUtilisateur.ADMIN_CABINET)
  lister(@CurrentUser() user: AuthenticatedUser) {
    return this.service.utilisateursConnectes(user.tenantId);
  }
}
