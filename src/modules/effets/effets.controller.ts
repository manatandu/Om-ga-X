import { BadRequestException, Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { RoleUtilisateur } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { LicenceGuard } from '../licence/licence.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { ReserveAuComptable } from '../../common/decorators/acces-roles-cantonnes.decorator';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { EXERCICE_REQUIS } from '../../common/exercice-requis';
import { EffetsService } from './effets.service';
import {
  AccepterEffetDto,
  AnnulerActeDto,
  BonAPayerDto,
  DateActeDto,
  DecompteEffetDto,
  EncaisserEffetDto,
  EscompterEffetDto,
  ImpayeEffetDto,
  PayerEffetDto,
  RemettreEffetDto,
} from './effets.dto';

/**
 * EFFETS DE COMMERCE · Traitement > Tiers et trésorerie (ligne sage-l3,
 * fonction 39). Chaque acte est une SAISIE (admin et comptable) ; l'annulation
 * d'un acte contre-passe une pièce, geste du comptable (`@ReserveAuComptable`,
 * comme la correction). Consultation ouverte aux rôles du dossier.
 */
@UseGuards(JwtAuthGuard, LicenceGuard, RolesGuard)
@Controller('effets')
export class EffetsController {
  constructor(private readonly effets: EffetsService) {}

  /** Les comptes d'un rôle sous les racines prescrites · liste `texte` (listes-de-comptes.ts). */
  @Get('comptes')
  comptes(@CurrentUser() user: AuthenticatedUser, @Query('role') role: string | undefined, @Query('sens') sens: string | undefined, @Query('numero') numero?: string) {
    return this.effets.comptes(user.tenantId, role, sens, numero);
  }

  @Get()
  lister(
    @CurrentUser() user: AuthenticatedUser,
    @Query('exerciceId', EXERCICE_REQUIS) exerciceId: string,
    @Query('sens') sens: string | undefined,
    @Query('statut') statut: string | undefined,
  ) {
    return this.effets.lister(user.tenantId, exerciceId, sens, statut);
  }

  @Get(':id')
  detail(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    if (!/^[0-9a-f-]{36}$/i.test(id)) throw new BadRequestException("L'identifiant de l'effet est exigé.");
    return this.effets.effet(user.tenantId, id);
  }

  @Roles(RoleUtilisateur.ADMIN_CABINET, RoleUtilisateur.COMPTABLE)
  @Post()
  accepter(@CurrentUser() user: AuthenticatedUser, @Body() dto: AccepterEffetDto) {
    return this.effets.accepter(user.tenantId, user.userId, dto);
  }

  @Roles(RoleUtilisateur.ADMIN_CABINET, RoleUtilisateur.COMPTABLE)
  @Post(':id/remettre')
  remettre(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: RemettreEffetDto) {
    return this.effets.remettre(user.tenantId, user.userId, id, dto);
  }

  @Roles(RoleUtilisateur.ADMIN_CABINET, RoleUtilisateur.COMPTABLE)
  @Post(':id/escompter')
  escompter(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: EscompterEffetDto) {
    return this.effets.escompter(user.tenantId, user.userId, id, dto);
  }

  @Roles(RoleUtilisateur.ADMIN_CABINET, RoleUtilisateur.COMPTABLE)
  @Post(':id/decompte')
  decompte(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: DecompteEffetDto) {
    return this.effets.decompte(user.tenantId, user.userId, id, dto);
  }

  @Roles(RoleUtilisateur.ADMIN_CABINET, RoleUtilisateur.COMPTABLE)
  @Post(':id/encaisser')
  encaisser(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: EncaisserEffetDto) {
    return this.effets.encaisser(user.tenantId, user.userId, id, dto);
  }

  @Roles(RoleUtilisateur.ADMIN_CABINET, RoleUtilisateur.COMPTABLE)
  @Post(':id/denouer')
  denouer(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: DateActeDto) {
    return this.effets.denouer(user.tenantId, user.userId, id, dto);
  }

  @Roles(RoleUtilisateur.ADMIN_CABINET, RoleUtilisateur.COMPTABLE)
  @Post(':id/impaye')
  impaye(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: ImpayeEffetDto) {
    return this.effets.impaye(user.tenantId, user.userId, id, dto);
  }

  @Roles(RoleUtilisateur.ADMIN_CABINET, RoleUtilisateur.COMPTABLE)
  @Post(':id/bon-a-payer')
  bonAPayer(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: BonAPayerDto) {
    return this.effets.bonAPayer(user.tenantId, user.userId, id, dto);
  }

  @Roles(RoleUtilisateur.ADMIN_CABINET, RoleUtilisateur.COMPTABLE)
  @Post(':id/payer')
  payer(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: PayerEffetDto) {
    return this.effets.payer(user.tenantId, user.userId, id, dto);
  }

  @Roles(RoleUtilisateur.ADMIN_CABINET, RoleUtilisateur.COMPTABLE)
  @ReserveAuComptable()
  @Post(':id/actes/:acteId/annuler')
  annulerActe(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Param('acteId') acteId: string, @Body() dto: AnnulerActeDto) {
    return this.effets.annulerActe(user.tenantId, user.userId, id, acteId, dto);
  }
}
