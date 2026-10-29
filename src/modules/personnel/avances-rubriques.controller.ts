import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { RoleUtilisateur } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { LicenceGuard } from '../licence/licence.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthenticatedUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { AccesRolesCantonnes, ReserveAuComptable } from '../../common/decorators/acces-roles-cantonnes.decorator';
import { AvancesRubriquesService } from './avances-rubriques.service';
import {
  AvanceSalaireDto,
  EtalementAvanceDto,
  FinSaisieArretDto,
  ModeleBulletinDto,
  ModifierRubriquePaieDto,
  RubriquePaieDto,
  VisaPlanEtalementDto,
} from './dto/personnel.dto';

/**
 * Rubriques de paie du cabinet et registre des avances · mêmes droits que le
 * registre du personnel, dont ils font partie (données nominatives, fermées à
 * l'aide-comptable, ouvertes au gestionnaire de paie).
 */
@AccesRolesCantonnes({ aideComptable: false, gestionnairePaie: true })
@UseGuards(JwtAuthGuard, LicenceGuard, RolesGuard)
@Controller('personnel')
export class AvancesRubriquesController {
  constructor(private readonly service: AvancesRubriquesService) {}

  @Get('rubriques')
  @Roles(RoleUtilisateur.ADMIN_CABINET, RoleUtilisateur.COMPTABLE, RoleUtilisateur.LECTURE_SEULE)
  listerRubriques(@CurrentUser() user: AuthenticatedUser) {
    return this.service.listerRubriques(user.tenantId);
  }

  @Post('rubriques')
  @Roles(RoleUtilisateur.ADMIN_CABINET, RoleUtilisateur.COMPTABLE)
  creerRubrique(@CurrentUser() user: AuthenticatedUser, @Body() dto: RubriquePaieDto) {
    return this.service.creerRubrique(user.tenantId, dto);
  }

  @Patch('rubriques/:id')
  @Roles(RoleUtilisateur.ADMIN_CABINET, RoleUtilisateur.COMPTABLE)
  modifierRubrique(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: ModifierRubriquePaieDto) {
    return this.service.modifierRubrique(user.tenantId, id, dto);
  }

  @Get('modeles-bulletin')
  @Roles(RoleUtilisateur.ADMIN_CABINET, RoleUtilisateur.COMPTABLE, RoleUtilisateur.LECTURE_SEULE)
  listerModeles(@CurrentUser() user: AuthenticatedUser) {
    return this.service.listerModeles(user.tenantId);
  }

  @Post('modeles-bulletin')
  @Roles(RoleUtilisateur.ADMIN_CABINET, RoleUtilisateur.COMPTABLE)
  creerModele(@CurrentUser() user: AuthenticatedUser, @Body() dto: ModeleBulletinDto) {
    return this.service.creerModele(user.tenantId, user.email, dto);
  }

  @Delete('modeles-bulletin/:id')
  @Roles(RoleUtilisateur.ADMIN_CABINET, RoleUtilisateur.COMPTABLE)
  supprimerModele(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.service.supprimerModele(user.tenantId, id);
  }

  @Get('avances')
  @Roles(RoleUtilisateur.ADMIN_CABINET, RoleUtilisateur.COMPTABLE, RoleUtilisateur.LECTURE_SEULE)
  listerAvances(
    @CurrentUser() user: AuthenticatedUser,
    @Query('salarieId') salarieId?: string,
    @Query('moisDePaie') moisDePaie?: string,
  ) {
    return this.service.listerAvances(user.tenantId, user.userId, salarieId || undefined, moisDePaie || undefined);
  }

  /** Ligne microfina-m3, idée 6 · le plan d'étalement, déclaré ou retiré. */
  @Patch('avances/:id/etalement')
  @Roles(RoleUtilisateur.ADMIN_CABINET, RoleUtilisateur.COMPTABLE)
  modifierEtalement(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: EtalementAvanceDto) {
    return this.service.modifierEtalement(user.tenantId, user.userId, id, dto);
  }

  /**
   * Ligne paie-suite · viser le plan d'étalement (`visa-plan-etalement.ts`) ·
   * l'administrateur ou le comptable autre que l'auteur, refusé aux deux rôles
   * cantonnés · le gestionnaire de paie prépare les retenues, il ne vise pas
   * ce que le bulletin proposera, comme pour le RIB d'un salarié.
   */
  @Post('avances/:id/viser-plan')
  @Roles(RoleUtilisateur.ADMIN_CABINET, RoleUtilisateur.COMPTABLE)
  @ReserveAuComptable()
  viserPlan(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: VisaPlanEtalementDto) {
    return this.service.viserPlan(user.tenantId, id, user.userId, dto.saisiLeLu);
  }

  @Post('salaries/:salarieId/avances')
  @Roles(RoleUtilisateur.ADMIN_CABINET, RoleUtilisateur.COMPTABLE)
  creerAvance(@CurrentUser() user: AuthenticatedUser, @Param('salarieId') salarieId: string, @Body() dto: AvanceSalaireDto) {
    return this.service.creerAvance(user.tenantId, user.email, user.userId, salarieId, dto);
  }

  /** Mainlevée d'une saisie-arrêt (AUPSRVE, art. 201) · déclarée une fois. */
  @Patch('avances/:id/fin')
  @Roles(RoleUtilisateur.ADMIN_CABINET, RoleUtilisateur.COMPTABLE)
  terminerSaisie(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: FinSaisieArretDto) {
    return this.service.terminerSaisie(user.tenantId, id, dto);
  }

  @Delete('avances/:id')
  @Roles(RoleUtilisateur.ADMIN_CABINET, RoleUtilisateur.COMPTABLE)
  supprimerAvance(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.service.supprimerAvance(user.tenantId, id);
  }
}
