import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { RoleUtilisateur } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { LicenceGuard } from '../licence/licence.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthenticatedUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { AccesRolesCantonnes } from '../../common/decorators/acces-roles-cantonnes.decorator';
import { MissionsService } from './missions.service';
import { AnnulationMissionDto, FinMissionDto, FraisMissionDto, MissionSalarieDto } from './dto/missions.dto';

/**
 * LIGNE MICROFINA-M3, IDÉE 3 · ordres et frais de mission · mêmes droits que
 * le registre du personnel (données nominatives, fermées à l'aide-comptable,
 * ouvertes au gestionnaire de paie).
 */
@AccesRolesCantonnes({ aideComptable: false, gestionnairePaie: true })
@UseGuards(JwtAuthGuard, LicenceGuard, RolesGuard)
@Controller('personnel')
export class MissionsController {
  constructor(private readonly service: MissionsService) {}

  @Get('missions')
  @Roles(RoleUtilisateur.ADMIN_CABINET, RoleUtilisateur.COMPTABLE, RoleUtilisateur.LECTURE_SEULE)
  lister(@CurrentUser() user: AuthenticatedUser, @Query('salarieId') salarieId?: string) {
    return this.service.lister(user.tenantId, salarieId || undefined);
  }

  @Get('salaries/:salarieId/missions/mois/:mois')
  @Roles(RoleUtilisateur.ADMIN_CABINET, RoleUtilisateur.COMPTABLE, RoleUtilisateur.LECTURE_SEULE)
  duMois(@CurrentUser() user: AuthenticatedUser, @Param('salarieId') salarieId: string, @Param('mois') mois: string) {
    return this.service.duMois(user.tenantId, salarieId, mois);
  }

  @Post('salaries/:salarieId/missions')
  @Roles(RoleUtilisateur.ADMIN_CABINET, RoleUtilisateur.COMPTABLE)
  creer(@CurrentUser() user: AuthenticatedUser, @Param('salarieId') salarieId: string, @Body() dto: MissionSalarieDto) {
    return this.service.creer(user.tenantId, user.email, salarieId, dto);
  }

  @Post('missions/:id/frais')
  @Roles(RoleUtilisateur.ADMIN_CABINET, RoleUtilisateur.COMPTABLE)
  ajouterFrais(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: FraisMissionDto) {
    return this.service.ajouterFrais(user.tenantId, user.email, id, dto);
  }

  @Delete('missions/frais/:fraisId')
  @Roles(RoleUtilisateur.ADMIN_CABINET, RoleUtilisateur.COMPTABLE)
  retirerFrais(@CurrentUser() user: AuthenticatedUser, @Param('fraisId') fraisId: string) {
    return this.service.retirerFrais(user.tenantId, fraisId);
  }

  @Patch('missions/:id/fin')
  @Roles(RoleUtilisateur.ADMIN_CABINET, RoleUtilisateur.COMPTABLE)
  constaterFin(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: FinMissionDto) {
    return this.service.constaterFin(user.tenantId, id, dto);
  }

  @Post('missions/:id/annulation')
  @Roles(RoleUtilisateur.ADMIN_CABINET, RoleUtilisateur.COMPTABLE)
  annuler(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: AnnulationMissionDto) {
    return this.service.annuler(user.tenantId, id, dto);
  }
}
