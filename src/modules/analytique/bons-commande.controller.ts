import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';
import { Referentiel, RoleUtilisateur } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { LicenceGuard } from '../licence/licence.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { ReferentielGuard } from '../../common/guards/referentiel.guard';
import { ReferentielsAutorises } from '../../common/decorators/referentiels.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { EXERCICE_REQUIS } from '../../common/exercice-requis';
import { BonsCommandeService } from './bons-commande.service';
import {
  CloreBonCommandeDto,
  CreerBonCommandeDto,
  ExecuterBonCommandeDto,
  ModifierBonCommandeDto,
  RemettreBonCommandeDto,
} from './dto/bon-commande.dto';

/**
 * BONS DE COMMANDE FOURNISSEUR (ligne microfina-m2, idée 2) · SYCEBNL SEUL,
 * route par route, comme le registre des engagements · la colonne Engagement
 * n'existe qu'au tableau d'exécution budgétaire des EBNL (Guide d'application,
 * ch. 7, Application 22), et l'écran ne sert pas l'entrée au SYSCOHADA
 * (`referentielsApplicables`). Tenir un bon est un acte de SAISIE · il suit
 * les droits d'écriture du registre (administrateur et comptable).
 */
@UseGuards(JwtAuthGuard, LicenceGuard, RolesGuard, ReferentielGuard)
@Controller('bons-commande')
export class BonsCommandeController {
  constructor(private readonly bons: BonsCommandeService) {}

  @Get()
  @ReferentielsAutorises(Referentiel.SYCEBNL)
  lister(@CurrentUser() user: AuthenticatedUser, @Query('exerciceId', EXERCICE_REQUIS) exerciceId: string) {
    return this.bons.lister(user.tenantId, exerciceId);
  }

  @Get(':id')
  @ReferentielsAutorises(Referentiel.SYCEBNL)
  detail(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.bons.detail(user.tenantId, id);
  }

  @Get(':id/factures-executables')
  @ReferentielsAutorises(Referentiel.SYCEBNL)
  facturesExecutables(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Query('recherche') recherche?: string) {
    return this.bons.facturesExecutables(user.tenantId, id, recherche);
  }

  @Post()
  @ReferentielsAutorises(Referentiel.SYCEBNL)
  @Roles(RoleUtilisateur.ADMIN_CABINET, RoleUtilisateur.COMPTABLE)
  creer(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreerBonCommandeDto) {
    return this.bons.creer(user.tenantId, user.userId, dto);
  }

  @Put(':id')
  @ReferentielsAutorises(Referentiel.SYCEBNL)
  @Roles(RoleUtilisateur.ADMIN_CABINET, RoleUtilisateur.COMPTABLE)
  modifier(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: ModifierBonCommandeDto) {
    return this.bons.modifier(user.tenantId, id, dto);
  }

  @Delete(':id')
  @ReferentielsAutorises(Referentiel.SYCEBNL)
  @Roles(RoleUtilisateur.ADMIN_CABINET, RoleUtilisateur.COMPTABLE)
  supprimer(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.bons.supprimer(user.tenantId, id);
  }

  @Post(':id/remise')
  @ReferentielsAutorises(Referentiel.SYCEBNL)
  @Roles(RoleUtilisateur.ADMIN_CABINET, RoleUtilisateur.COMPTABLE)
  remettre(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: RemettreBonCommandeDto) {
    return this.bons.remettre(user.tenantId, user.userId, id, dto);
  }

  @Post(':id/executions')
  @ReferentielsAutorises(Referentiel.SYCEBNL)
  @Roles(RoleUtilisateur.ADMIN_CABINET, RoleUtilisateur.COMPTABLE)
  executer(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: ExecuterBonCommandeDto) {
    return this.bons.executer(user.tenantId, user.userId, id, dto);
  }

  @Delete(':id/executions/:factureId')
  @ReferentielsAutorises(Referentiel.SYCEBNL)
  @Roles(RoleUtilisateur.ADMIN_CABINET, RoleUtilisateur.COMPTABLE)
  retirerFacture(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Param('factureId') factureId: string) {
    return this.bons.retirerFacture(user.tenantId, id, factureId);
  }

  @Patch(':id/cloture')
  @ReferentielsAutorises(Referentiel.SYCEBNL)
  @Roles(RoleUtilisateur.ADMIN_CABINET, RoleUtilisateur.COMPTABLE)
  clore(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: CloreBonCommandeDto) {
    return this.bons.clore(user.tenantId, user.userId, id, dto);
  }

  @Patch(':id/reouverture')
  @ReferentielsAutorises(Referentiel.SYCEBNL)
  @Roles(RoleUtilisateur.ADMIN_CABINET, RoleUtilisateur.COMPTABLE)
  rouvrir(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.bons.rouvrir(user.tenantId, id);
  }
}
