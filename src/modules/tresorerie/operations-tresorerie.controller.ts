import { BadRequestException, Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { RoleUtilisateur } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { LicenceGuard } from '../licence/licence.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { ReserveAuComptable } from '../../common/decorators/acces-roles-cantonnes.decorator';
import { AuthenticatedUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { EXERCICE_REQUIS } from '../../common/exercice-requis';
import { OperationsTresorerieService } from './operations-tresorerie.service';
import { AnnulerActeTresorerieDto, ContrePasserDto, EcheanceOperationDto, OperationTresorerieDto, RegulariserDto } from './operations-tresorerie.dto';

const identifiant = (id: string, objet: string) => {
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new BadRequestException(`L'identifiant ${objet} est exigé.`);
  return id;
};

/**
 * FINANCEMENTS ET PLACEMENTS · Traitement > Tiers et trésorerie (ligne
 * sage-l3, fonction 47). Chaque acte est une SAISIE (admin et comptable) ;
 * l'annulation contre-passe une pièce, geste du comptable
 * (`@ReserveAuComptable`, comme la correction). Consultation ouverte.
 */
@UseGuards(JwtAuthGuard, LicenceGuard, RolesGuard)
@Controller('operations-tresorerie')
export class OperationsTresorerieController {
  constructor(private readonly service: OperationsTresorerieService) {}

  /** Les comptes d'un rôle sous les racines des fiches · liste `texte` (listes-de-comptes.ts). */
  @Get('comptes')
  comptes(@CurrentUser() user: AuthenticatedUser, @Query('type') type: string | undefined, @Query('role') role: string | undefined, @Query('numero') numero?: string) {
    return this.service.comptes(user.tenantId, type, role, numero);
  }

  @Get()
  lister(@CurrentUser() user: AuthenticatedUser, @Query('exerciceId', EXERCICE_REQUIS) exerciceId: string) {
    return this.service.lister(user.tenantId, exerciceId);
  }

  @Get(':id')
  detail(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.service.operation(user.tenantId, identifiant(id, "de l'opération"));
  }

  @Roles(RoleUtilisateur.ADMIN_CABINET, RoleUtilisateur.COMPTABLE)
  @Post()
  creer(@CurrentUser() user: AuthenticatedUser, @Body() dto: OperationTresorerieDto) {
    return this.service.creer(user.tenantId, user.userId, dto);
  }

  @Roles(RoleUtilisateur.ADMIN_CABINET, RoleUtilisateur.COMPTABLE)
  @Post(':id/regulariser')
  regulariser(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: RegulariserDto) {
    return this.service.regulariser(user.tenantId, user.userId, identifiant(id, "de l'opération"), dto);
  }

  @Roles(RoleUtilisateur.ADMIN_CABINET, RoleUtilisateur.COMPTABLE)
  @Post(':id/contre-passer')
  contrePasser(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: ContrePasserDto) {
    return this.service.contrePasser(user.tenantId, user.userId, identifiant(id, "de l'opération"), dto);
  }

  @Roles(RoleUtilisateur.ADMIN_CABINET, RoleUtilisateur.COMPTABLE)
  @Post(':id/echeance')
  echeance(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: EcheanceOperationDto) {
    return this.service.echeance(user.tenantId, user.userId, identifiant(id, "de l'opération"), dto);
  }

  @Roles(RoleUtilisateur.ADMIN_CABINET, RoleUtilisateur.COMPTABLE)
  @ReserveAuComptable()
  @Post(':id/actes/:acteId/annuler')
  annulerActe(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Param('acteId') acteId: string, @Body() dto: AnnulerActeTresorerieDto) {
    return this.service.annulerActe(user.tenantId, user.userId, identifiant(id, "de l'opération"), identifiant(acteId, "de l'acte"), dto);
  }
}
