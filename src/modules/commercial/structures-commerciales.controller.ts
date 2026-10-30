import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { RoleUtilisateur } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { LicenceGuard } from '../licence/licence.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { StructuresCommercialesService } from './structures-commerciales.service';
import { CollaborateurDto, ModeArrondiDto, ModifierCollaborateurDto, ModifierModeArrondiDto } from './dto/structures.dto';

/**
 * MODES D'ARRONDI (fonction 94) ET COLLABORATEURS (fonction 91) · des
 * STRUCTURES de la gestion commerciale, tenues par l'administrateur seul,
 * comme le plan des tiers (décision de Manasse du 2026-09-26) ; la lecture
 * est ouverte, la saisie d'un tiers en a besoin. Ouvertes aux deux
 * référentiels, comme les articles.
 */
@UseGuards(JwtAuthGuard, LicenceGuard, RolesGuard)
@Controller('commercial')
export class StructuresCommercialesController {
  constructor(private readonly structures: StructuresCommercialesService) {}

  @Get('modes-arrondi')
  listerModes(@CurrentUser() user: AuthenticatedUser) {
    return this.structures.listerModes(user.tenantId);
  }

  @Post('modes-arrondi')
  @Roles(RoleUtilisateur.ADMIN_CABINET)
  creerMode(@CurrentUser() user: AuthenticatedUser, @Body() dto: ModeArrondiDto) {
    return this.structures.creerMode(user.tenantId, user.userId, dto);
  }

  @Patch('modes-arrondi/:id')
  @Roles(RoleUtilisateur.ADMIN_CABINET)
  modifierMode(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: ModifierModeArrondiDto) {
    return this.structures.modifierMode(user.tenantId, id, dto);
  }

  @Delete('modes-arrondi/:id')
  @Roles(RoleUtilisateur.ADMIN_CABINET)
  supprimerMode(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.structures.supprimerMode(user.tenantId, id);
  }

  @Get('collaborateurs')
  listerCollaborateurs(@CurrentUser() user: AuthenticatedUser) {
    return this.structures.listerCollaborateurs(user.tenantId);
  }

  @Post('collaborateurs')
  @Roles(RoleUtilisateur.ADMIN_CABINET)
  creerCollaborateur(@CurrentUser() user: AuthenticatedUser, @Body() dto: CollaborateurDto) {
    return this.structures.creerCollaborateur(user.tenantId, user.userId, dto);
  }

  @Patch('collaborateurs/:id')
  @Roles(RoleUtilisateur.ADMIN_CABINET)
  modifierCollaborateur(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: ModifierCollaborateurDto) {
    return this.structures.modifierCollaborateur(user.tenantId, id, dto);
  }

  @Delete('collaborateurs/:id')
  @Roles(RoleUtilisateur.ADMIN_CABINET)
  supprimerCollaborateur(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.structures.supprimerCollaborateur(user.tenantId, id);
  }
}
