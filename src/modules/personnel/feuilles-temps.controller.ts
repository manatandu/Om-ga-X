import { Body, Controller, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { RoleUtilisateur } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { LicenceGuard } from '../licence/licence.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthenticatedUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { AccesRolesCantonnes } from '../../common/decorators/acces-roles-cantonnes.decorator';
import { FeuillesTempsService } from './feuilles-temps.service';
import { AnnulationFeuilleTempsDto, CompteurHeuresDto, FeuilleTempsDto, JoursFeuilleTempsDto } from './dto/feuilles-temps.dto';

/**
 * LIGNE SAGE-L5, FONCTION 78, RESTE · les feuilles de temps et les compteurs
 * libres d'heures (Code du travail, art. 119, 121, 124). Mêmes droits que le
 * registre du personnel · les heures d'une personne, fermées à
 * l'aide-comptable, ouvertes au gestionnaire de paie.
 */
@AccesRolesCantonnes({ aideComptable: false, gestionnairePaie: true })
@UseGuards(JwtAuthGuard, LicenceGuard, RolesGuard)
@Controller('personnel')
export class FeuillesTempsController {
  constructor(private readonly feuilles: FeuillesTempsService) {}

  @Get('compteurs-heures')
  @Roles(RoleUtilisateur.ADMIN_CABINET, RoleUtilisateur.COMPTABLE, RoleUtilisateur.LECTURE_SEULE)
  listerCompteurs(@CurrentUser() user: AuthenticatedUser) {
    return this.feuilles.listerCompteurs(user.tenantId);
  }

  @Post('compteurs-heures')
  @Roles(RoleUtilisateur.ADMIN_CABINET, RoleUtilisateur.COMPTABLE)
  creerCompteur(@CurrentUser() user: AuthenticatedUser, @Body() dto: CompteurHeuresDto) {
    return this.feuilles.creerCompteur(user.tenantId, user.email, dto);
  }

  @Post('compteurs-heures/:id/desactivation')
  @Roles(RoleUtilisateur.ADMIN_CABINET, RoleUtilisateur.COMPTABLE)
  desactiverCompteur(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.feuilles.desactiverCompteur(user.tenantId, user.email, id);
  }

  @Get('salaries/:salarieId/feuilles-temps')
  @Roles(RoleUtilisateur.ADMIN_CABINET, RoleUtilisateur.COMPTABLE, RoleUtilisateur.LECTURE_SEULE)
  lister(@CurrentUser() user: AuthenticatedUser, @Param('salarieId') salarieId: string) {
    return this.feuilles.lister(user.tenantId, salarieId);
  }

  @Get('salaries/:salarieId/feuilles-temps/mois/:mois')
  @Roles(RoleUtilisateur.ADMIN_CABINET, RoleUtilisateur.COMPTABLE, RoleUtilisateur.LECTURE_SEULE)
  duMois(@CurrentUser() user: AuthenticatedUser, @Param('salarieId') salarieId: string, @Param('mois') mois: string) {
    return this.feuilles.duMois(user.tenantId, salarieId, mois);
  }

  @Post('salaries/:salarieId/feuilles-temps')
  @Roles(RoleUtilisateur.ADMIN_CABINET, RoleUtilisateur.COMPTABLE)
  creer(@CurrentUser() user: AuthenticatedUser, @Param('salarieId') salarieId: string, @Body() dto: FeuilleTempsDto) {
    return this.feuilles.creer(user.tenantId, user.email, salarieId, dto);
  }

  @Get('feuilles-temps/:id')
  @Roles(RoleUtilisateur.ADMIN_CABINET, RoleUtilisateur.COMPTABLE, RoleUtilisateur.LECTURE_SEULE)
  detail(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.feuilles.detail(user.tenantId, id);
  }

  @Put('feuilles-temps/:id/jours')
  @Roles(RoleUtilisateur.ADMIN_CABINET, RoleUtilisateur.COMPTABLE)
  enregistrerJours(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: JoursFeuilleTempsDto) {
    return this.feuilles.enregistrerJours(user.tenantId, user.email, id, dto);
  }

  @Post('feuilles-temps/:id/annulation')
  @Roles(RoleUtilisateur.ADMIN_CABINET, RoleUtilisateur.COMPTABLE)
  annuler(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: AnnulationFeuilleTempsDto) {
    return this.feuilles.annuler(user.tenantId, user.email, id, dto.motif);
  }
}
