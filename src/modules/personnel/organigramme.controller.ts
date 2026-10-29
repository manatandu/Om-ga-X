import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { RoleUtilisateur } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { LicenceGuard } from '../licence/licence.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthenticatedUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { AccesRolesCantonnes } from '../../common/decorators/acces-roles-cantonnes.decorator';
import { OrganigrammeService } from './organigramme.service';
import { AnnulationRattachementDto, ModifierUniteOrganisationDto, RattachementUniteDto, UniteOrganisationDto } from './dto/organigramme.dto';

/**
 * LIGNE PAIE-SUITE · DÉPARTEMENTS ET DIRECTIONS · l'organigramme et les
 * rattachements datés. Mêmes droits que le registre du personnel (fermé à
 * l'aide-comptable, ouvert au gestionnaire de paie), dont ils font partie.
 */
@AccesRolesCantonnes({ aideComptable: false, gestionnairePaie: true })
@UseGuards(JwtAuthGuard, LicenceGuard, RolesGuard)
@Controller('personnel')
export class OrganigrammeController {
  constructor(private readonly service: OrganigrammeService) {}

  @Get('organigramme')
  @Roles(RoleUtilisateur.ADMIN_CABINET, RoleUtilisateur.COMPTABLE, RoleUtilisateur.LECTURE_SEULE)
  lister(@CurrentUser() user: AuthenticatedUser) {
    return this.service.lister(user.tenantId);
  }

  @Post('organigramme')
  @Roles(RoleUtilisateur.ADMIN_CABINET, RoleUtilisateur.COMPTABLE)
  creer(@CurrentUser() user: AuthenticatedUser, @Body() dto: UniteOrganisationDto) {
    return this.service.creer(user.tenantId, user.email, dto);
  }

  @Patch('organigramme/:id')
  @Roles(RoleUtilisateur.ADMIN_CABINET, RoleUtilisateur.COMPTABLE)
  modifier(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: ModifierUniteOrganisationDto) {
    return this.service.modifier(user.tenantId, id, dto);
  }

  @Delete('organigramme/:id')
  @Roles(RoleUtilisateur.ADMIN_CABINET, RoleUtilisateur.COMPTABLE)
  supprimer(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.service.supprimer(user.tenantId, id);
  }

  @Get('salaries/:salarieId/rattachements')
  @Roles(RoleUtilisateur.ADMIN_CABINET, RoleUtilisateur.COMPTABLE, RoleUtilisateur.LECTURE_SEULE)
  historique(@CurrentUser() user: AuthenticatedUser, @Param('salarieId') salarieId: string) {
    return this.service.historique(user.tenantId, salarieId);
  }

  @Post('salaries/:salarieId/rattachements')
  @Roles(RoleUtilisateur.ADMIN_CABINET, RoleUtilisateur.COMPTABLE)
  rattacher(@CurrentUser() user: AuthenticatedUser, @Param('salarieId') salarieId: string, @Body() dto: RattachementUniteDto) {
    return this.service.rattacher(user.tenantId, user.email, salarieId, dto);
  }

  @Post('rattachements/:id/annulation')
  @Roles(RoleUtilisateur.ADMIN_CABINET, RoleUtilisateur.COMPTABLE)
  annuler(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: AnnulationRattachementDto) {
    return this.service.annulerRattachement(user.tenantId, user.email, id, dto);
  }
}
