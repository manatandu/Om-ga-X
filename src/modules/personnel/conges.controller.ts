import { Body, Controller, Get, Param, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';
import { RoleUtilisateur } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { LicenceGuard } from '../licence/licence.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthenticatedUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { AccesRolesCantonnes } from '../../common/decorators/acces-roles-cantonnes.decorator';
import { CongesService } from './conges.service';
import { AllocationCongeDto, AnnulationCongeDto, CongeSalarieDto, RepriseCongesDto } from './dto/conges.dto';

/**
 * LIGNE SAGE-L5, FONCTION 79 · les congés acquis chaque mois (Code du
 * travail, art. 140 à 145). Mêmes droits que le registre du personnel, dont
 * le compteur fait partie · données nominatives, fermées à l'aide-comptable,
 * ouvertes au gestionnaire de paie.
 */
@AccesRolesCantonnes({ aideComptable: false, gestionnairePaie: true })
@UseGuards(JwtAuthGuard, LicenceGuard, RolesGuard)
@Controller('personnel')
export class CongesController {
  constructor(private readonly conges: CongesService) {}

  @Get('salaries/:salarieId/conges')
  @Roles(RoleUtilisateur.ADMIN_CABINET, RoleUtilisateur.COMPTABLE, RoleUtilisateur.LECTURE_SEULE)
  compteur(@CurrentUser() user: AuthenticatedUser, @Param('salarieId') salarieId: string, @Query('ala') aLa?: string) {
    return this.conges.compteur(user.tenantId, salarieId, aLa || undefined);
  }

  @Get('salaries/:salarieId/conges/propositions')
  @Roles(RoleUtilisateur.ADMIN_CABINET, RoleUtilisateur.COMPTABLE, RoleUtilisateur.LECTURE_SEULE)
  propositions(@CurrentUser() user: AuthenticatedUser, @Param('salarieId') salarieId: string, @Query('du') du = '') {
    return this.conges.propositions(user.tenantId, salarieId, du);
  }

  @Get('salaries/:salarieId/conges/du-mois/:mois')
  @Roles(RoleUtilisateur.ADMIN_CABINET, RoleUtilisateur.COMPTABLE, RoleUtilisateur.LECTURE_SEULE)
  congesDuMois(@CurrentUser() user: AuthenticatedUser, @Param('salarieId') salarieId: string, @Param('mois') mois: string) {
    return this.conges.congesDuMois(user.tenantId, salarieId, mois);
  }

  @Put('salaries/:salarieId/conges/reprise')
  @Roles(RoleUtilisateur.ADMIN_CABINET, RoleUtilisateur.COMPTABLE)
  declarerReprise(@CurrentUser() user: AuthenticatedUser, @Param('salarieId') salarieId: string, @Body() dto: RepriseCongesDto) {
    return this.conges.declarerReprise(user.tenantId, user.email, salarieId, dto);
  }

  @Post('salaries/:salarieId/conges')
  @Roles(RoleUtilisateur.ADMIN_CABINET, RoleUtilisateur.COMPTABLE)
  creerConge(@CurrentUser() user: AuthenticatedUser, @Param('salarieId') salarieId: string, @Body() dto: CongeSalarieDto) {
    return this.conges.creerConge(user.tenantId, user.email, salarieId, dto);
  }

  @Patch('conges/:id/allocation')
  @Roles(RoleUtilisateur.ADMIN_CABINET, RoleUtilisateur.COMPTABLE)
  modifierAllocation(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: AllocationCongeDto) {
    return this.conges.modifierAllocation(user.tenantId, id, dto);
  }

  @Post('conges/:id/annulation')
  @Roles(RoleUtilisateur.ADMIN_CABINET, RoleUtilisateur.COMPTABLE)
  annulerConge(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: AnnulationCongeDto) {
    return this.conges.annulerConge(user.tenantId, user.email, id, dto.motif);
  }
}
