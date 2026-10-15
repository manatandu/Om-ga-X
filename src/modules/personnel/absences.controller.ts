import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { RoleUtilisateur } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { LicenceGuard } from '../licence/licence.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthenticatedUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { AccesRolesCantonnes } from '../../common/decorators/acces-roles-cantonnes.decorator';
import { AbsencesService } from './absences.service';
import { AbsenceSalarieDto, AnnulationAbsenceDto, IndemniteCaisseDto } from './dto/absences.dto';

/**
 * LIGNE SAGE-L5, FONCTION 78 · les absences du salarié (Code du travail,
 * art. 57, 93, 105, 106, 130, 146). Mêmes droits que le registre du
 * personnel · données nominatives (certificats médicaux), fermées à
 * l'aide-comptable, ouvertes au gestionnaire de paie.
 */
@AccesRolesCantonnes({ aideComptable: false, gestionnairePaie: true })
@UseGuards(JwtAuthGuard, LicenceGuard, RolesGuard)
@Controller('personnel')
export class AbsencesController {
  constructor(private readonly absences: AbsencesService) {}

  @Get('absences/catalogue')
  @Roles(RoleUtilisateur.ADMIN_CABINET, RoleUtilisateur.COMPTABLE, RoleUtilisateur.LECTURE_SEULE)
  catalogue() {
    return this.absences.catalogue();
  }

  @Get('salaries/:salarieId/absences')
  @Roles(RoleUtilisateur.ADMIN_CABINET, RoleUtilisateur.COMPTABLE, RoleUtilisateur.LECTURE_SEULE)
  lister(@CurrentUser() user: AuthenticatedUser, @Param('salarieId') salarieId: string) {
    return this.absences.lister(user.tenantId, salarieId);
  }

  @Get('salaries/:salarieId/absences/mois/:mois')
  @Roles(RoleUtilisateur.ADMIN_CABINET, RoleUtilisateur.COMPTABLE, RoleUtilisateur.LECTURE_SEULE)
  duMois(
    @CurrentUser() user: AuthenticatedUser,
    @Param('salarieId') salarieId: string,
    @Param('mois') mois: string,
    @Query('moyenne') moyenne?: string,
  ) {
    return this.absences.duMois(user.tenantId, salarieId, mois, moyenne);
  }

  @Post('salaries/:salarieId/absences')
  @Roles(RoleUtilisateur.ADMIN_CABINET, RoleUtilisateur.COMPTABLE)
  creer(@CurrentUser() user: AuthenticatedUser, @Param('salarieId') salarieId: string, @Body() dto: AbsenceSalarieDto) {
    return this.absences.creer(user.tenantId, user.email, salarieId, dto);
  }

  @Post('absences/:id/annulation')
  @Roles(RoleUtilisateur.ADMIN_CABINET, RoleUtilisateur.COMPTABLE)
  annuler(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: AnnulationAbsenceDto) {
    return this.absences.annuler(user.tenantId, user.email, id, dto.motif);
  }

  @Post('absences/:id/indemnites-caisse')
  @Roles(RoleUtilisateur.ADMIN_CABINET, RoleUtilisateur.COMPTABLE)
  declarerIndemniteCaisse(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: IndemniteCaisseDto) {
    return this.absences.declarerIndemniteCaisse(user.tenantId, user.email, id, dto);
  }

  @Post('indemnites-caisse/:id/annulation')
  @Roles(RoleUtilisateur.ADMIN_CABINET, RoleUtilisateur.COMPTABLE)
  annulerIndemniteCaisse(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: AnnulationAbsenceDto) {
    return this.absences.annulerIndemniteCaisse(user.tenantId, user.email, id, dto.motif);
  }
}
