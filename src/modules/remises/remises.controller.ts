import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { RoleUtilisateur } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { LicenceGuard } from '../licence/licence.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { ReserveAuComptable } from '../../common/decorators/acces-roles-cantonnes.decorator';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { EXERCICE_REQUIS } from '../../common/exercice-requis';
import { RemisesService } from './remises.service';
import { AnnulerRemiseDto, AvisCreditDto, CreerTypeRemiseDto, ImpayeDto, ModifierTypeRemiseDto, RecevoirValeurDto, RemettreDto } from './remises.dto';

/**
 * REMISES EN BANQUE · Traitement > Tiers et trésorerie (ligne sage-l3,
 * fonction 40). Les TYPES de remise sont une structure (administrateur) ;
 * réception, bordereau, avis de crédit et impayé sont des SAISIES (admin et
 * comptable) ; les annulations contre-passent des pièces, geste du comptable
 * (`@ReserveAuComptable`, comme la correction). Consultation ouverte aux rôles
 * du dossier.
 */
@UseGuards(JwtAuthGuard, LicenceGuard, RolesGuard)
@Controller('remises')
export class RemisesController {
  constructor(private readonly remises: RemisesService) {}

  @Get('types')
  types(@CurrentUser() user: AuthenticatedUser) {
    return this.remises.typesDeRemise(user.tenantId);
  }

  @Roles(RoleUtilisateur.ADMIN_CABINET)
  @Post('types')
  creerType(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreerTypeRemiseDto) {
    return this.remises.creerType(user.tenantId, user.userId, dto);
  }

  @Roles(RoleUtilisateur.ADMIN_CABINET)
  @Patch('types/:id')
  modifierType(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: ModifierTypeRemiseDto) {
    return this.remises.modifierType(user.tenantId, id, dto);
  }

  /** Les comptes d'un rôle sous la racine prescrite · liste `texte` (listes-de-comptes.ts). */
  @Get('comptes')
  comptes(
    @CurrentUser() user: AuthenticatedUser,
    @Query('role') role: string | undefined,
    @Query('nature') nature: string | undefined,
    @Query('compteTiersId') compteTiersId: string | undefined,
  ) {
    return this.remises.comptes(user.tenantId, role, nature, compteTiersId);
  }

  @Get('valeurs')
  valeurs(@CurrentUser() user: AuthenticatedUser, @Query('exerciceId', EXERCICE_REQUIS) exerciceId: string, @Query('statut') statut: string | undefined) {
    return this.remises.valeurs(user.tenantId, exerciceId, statut);
  }

  @Roles(RoleUtilisateur.ADMIN_CABINET, RoleUtilisateur.COMPTABLE)
  @Post('valeurs')
  recevoir(@CurrentUser() user: AuthenticatedUser, @Body() dto: RecevoirValeurDto) {
    return this.remises.recevoir(user.tenantId, user.userId, dto);
  }

  @Roles(RoleUtilisateur.ADMIN_CABINET, RoleUtilisateur.COMPTABLE)
  @ReserveAuComptable()
  @Post('valeurs/:id/annuler')
  annulerReception(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: AnnulerRemiseDto) {
    return this.remises.annulerReception(user.tenantId, user.userId, id, dto);
  }

  @Roles(RoleUtilisateur.ADMIN_CABINET, RoleUtilisateur.COMPTABLE)
  @Post('valeurs/:id/impaye')
  impaye(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: ImpayeDto) {
    return this.remises.impaye(user.tenantId, user.userId, id, dto);
  }

  @Roles(RoleUtilisateur.ADMIN_CABINET, RoleUtilisateur.COMPTABLE)
  @ReserveAuComptable()
  @Post('valeurs/:id/impaye/annuler')
  annulerImpaye(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: AnnulerRemiseDto) {
    return this.remises.annulerImpaye(user.tenantId, user.userId, id, dto);
  }

  @Get()
  lister(@CurrentUser() user: AuthenticatedUser, @Query('exerciceId', EXERCICE_REQUIS) exerciceId: string) {
    return this.remises.remises(user.tenantId, exerciceId);
  }

  @Get(':id')
  detail(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.remises.remise(user.tenantId, id);
  }

  @Roles(RoleUtilisateur.ADMIN_CABINET, RoleUtilisateur.COMPTABLE)
  @Post()
  remettre(@CurrentUser() user: AuthenticatedUser, @Body() dto: RemettreDto) {
    return this.remises.remettre(user.tenantId, user.userId, dto);
  }

  @Roles(RoleUtilisateur.ADMIN_CABINET, RoleUtilisateur.COMPTABLE)
  @Post(':id/impression')
  impression(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.remises.impression(user.tenantId, user.userId, id);
  }

  @Roles(RoleUtilisateur.ADMIN_CABINET, RoleUtilisateur.COMPTABLE)
  @Post(':id/avis-credit')
  avisCredit(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: AvisCreditDto) {
    return this.remises.avisCredit(user.tenantId, user.userId, id, dto);
  }

  @Roles(RoleUtilisateur.ADMIN_CABINET, RoleUtilisateur.COMPTABLE)
  @ReserveAuComptable()
  @Post(':id/annuler')
  annulerRemise(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: AnnulerRemiseDto) {
    return this.remises.annulerRemise(user.tenantId, user.userId, id, dto);
  }

  @Roles(RoleUtilisateur.ADMIN_CABINET, RoleUtilisateur.COMPTABLE)
  @ReserveAuComptable()
  @Post(':id/avis-credit/annuler')
  annulerAvisCredit(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: AnnulerRemiseDto) {
    return this.remises.annulerAvisCredit(user.tenantId, user.userId, id, dto);
  }
}
