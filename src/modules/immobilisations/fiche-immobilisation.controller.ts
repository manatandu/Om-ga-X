import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, UseGuards } from '@nestjs/common';
import { RoleUtilisateur } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { LicenceGuard } from '../licence/licence.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthenticatedUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { FicheImmobilisationService } from './fiche-immobilisation.service';
import { ModifierImmobilisationDto } from './dto/fiche-immobilisation.dto';

/**
 * MODIFIER, SUPPRIMER OU DUPLIQUER LA FICHE D'UN BIEN (ligne sage-l4,
 * fonction n° 66, décision D7) · lectures ouvertes à tous ; modifier et
 * supprimer aux rôles qui créent un bien (administrateur, comptable), comme
 * `POST /immobilisations` · le serveur juge ce que la fiche admet.
 */
@UseGuards(JwtAuthGuard, LicenceGuard, RolesGuard)
@Controller('immobilisations')
export class FicheImmobilisationController {
  constructor(private readonly fiches: FicheImmobilisationService) {}

  @Get(':id/modification')
  etat(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.fiches.etat(user.tenantId, id);
  }

  @Get(':id/duplication')
  duplication(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.fiches.duplication(user.tenantId, id);
  }

  @Roles(RoleUtilisateur.ADMIN_CABINET, RoleUtilisateur.COMPTABLE)
  @Patch(':id')
  modifier(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ModifierImmobilisationDto) {
    return this.fiches.modifier(user.tenantId, user.userId, id, dto);
  }

  @Roles(RoleUtilisateur.ADMIN_CABINET, RoleUtilisateur.COMPTABLE)
  @Delete(':id')
  supprimer(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.fiches.supprimer(user.tenantId, id);
  }
}
