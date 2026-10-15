import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { RoleUtilisateur } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { LicenceGuard } from '../licence/licence.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthenticatedUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { ModesReglementService } from './modes-reglement.service';
import { CreerModeReglementDto, ModifierModeReglementDto } from './modes-reglement.dto';

/**
 * LES MODES DE RÈGLEMENT (ligne sage-l2, fonction 1) · Structure >
 * Paramètres de saisie. Structure du plan des tiers, comme les modèles de
 * règlement · tenus par l'administrateur, lus par tous.
 */
@UseGuards(JwtAuthGuard, LicenceGuard, RolesGuard)
@Controller('modes-reglement')
export class ModesReglementController {
  constructor(private readonly modes: ModesReglementService) {}

  @Get()
  lister(@CurrentUser() user: AuthenticatedUser) {
    return this.modes.lister(user.tenantId);
  }

  @Roles(RoleUtilisateur.ADMIN_CABINET)
  @Post()
  creer(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreerModeReglementDto) {
    return this.modes.creer(user.tenantId, user.userId, dto);
  }

  /** Les modes usuels d'un geste · déclarée avant `:id`. */
  @Roles(RoleUtilisateur.ADMIN_CABINET)
  @Post('usuels')
  creerUsuels(@CurrentUser() user: AuthenticatedUser) {
    return this.modes.creerUsuels(user.tenantId, user.userId);
  }

  @Roles(RoleUtilisateur.ADMIN_CABINET)
  @Patch(':id')
  modifier(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: ModifierModeReglementDto) {
    return this.modes.modifier(user.tenantId, id, dto);
  }

  @Roles(RoleUtilisateur.ADMIN_CABINET)
  @Delete(':id')
  supprimer(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.modes.supprimer(user.tenantId, id);
  }
}
