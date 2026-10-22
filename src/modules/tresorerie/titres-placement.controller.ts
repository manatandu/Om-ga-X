import { BadRequestException, Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { RoleUtilisateur } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { LicenceGuard } from '../licence/licence.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { ReserveAuComptable } from '../../common/decorators/acces-roles-cantonnes.decorator';
import { AuthenticatedUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { EXERCICE_REQUIS } from '../../common/exercice-requis';
import { TitresPlacementService } from './titres-placement.service';
import { AnnulerTitreDto, EvaluationTitreDto, MouvementTitreDto, TitrePlacementDto } from './titres-placement.dto';

const identifiant = (id: string, objet: string) => {
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new BadRequestException(`L'identifiant ${objet} est exigé.`);
  return id;
};

/**
 * TITRES DE PLACEMENT ET PARTS D'OPCVM · Traitement > Tiers et trésorerie,
 * fenêtre Financements et placements (ligne sage-l3, fonction 47, décision
 * D16). Ouvrir un titre, l'acquérir, le céder, le revoir à la clôture sont
 * des SAISIES (admin et comptable) ; l'annulation contre-passe une pièce,
 * geste du comptable (`@ReserveAuComptable`). Consultation ouverte.
 */
@UseGuards(JwtAuthGuard, LicenceGuard, RolesGuard)
@Controller('titres-placement')
export class TitresPlacementController {
  constructor(private readonly service: TitresPlacementService) {}

  /** Les comptes d'un rôle sous le 50 · liste `texte` (listes-de-comptes.ts). */
  @Get('comptes')
  comptes(@CurrentUser() user: AuthenticatedUser, @Query('role') role: string | undefined, @Query('numero') numero?: string) {
    return this.service.comptes(user.tenantId, role, numero);
  }

  @Get()
  lister(@CurrentUser() user: AuthenticatedUser, @Query('exerciceId', EXERCICE_REQUIS) exerciceId: string) {
    return this.service.lister(user.tenantId, exerciceId);
  }

  @Roles(RoleUtilisateur.ADMIN_CABINET, RoleUtilisateur.COMPTABLE)
  @Post()
  creer(@CurrentUser() user: AuthenticatedUser, @Body() dto: TitrePlacementDto) {
    return this.service.creerTitre(user.tenantId, user.userId, dto);
  }

  @Roles(RoleUtilisateur.ADMIN_CABINET, RoleUtilisateur.COMPTABLE)
  @Delete(':id')
  retirer(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.service.retirerTitre(user.tenantId, identifiant(id, 'du titre'));
  }

  @Roles(RoleUtilisateur.ADMIN_CABINET, RoleUtilisateur.COMPTABLE)
  @Post(':id/acquisitions')
  acquerir(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: MouvementTitreDto) {
    return this.service.acquerir(user.tenantId, user.userId, identifiant(id, 'du titre'), dto);
  }

  @Roles(RoleUtilisateur.ADMIN_CABINET, RoleUtilisateur.COMPTABLE)
  @Post(':id/cessions')
  ceder(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: MouvementTitreDto) {
    return this.service.ceder(user.tenantId, user.userId, identifiant(id, 'du titre'), dto);
  }

  @Roles(RoleUtilisateur.ADMIN_CABINET, RoleUtilisateur.COMPTABLE)
  @Post(':id/revues')
  evaluer(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: EvaluationTitreDto) {
    return this.service.evaluer(user.tenantId, user.userId, identifiant(id, 'du titre'), dto);
  }

  @Roles(RoleUtilisateur.ADMIN_CABINET, RoleUtilisateur.COMPTABLE)
  @ReserveAuComptable()
  @Post(':id/mouvements/:mouvementId/annuler')
  annulerMouvement(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Param('mouvementId') mouvementId: string, @Body() dto: AnnulerTitreDto) {
    return this.service.annulerMouvement(user.tenantId, user.userId, identifiant(id, 'du titre'), identifiant(mouvementId, 'du mouvement'), dto);
  }

  @Roles(RoleUtilisateur.ADMIN_CABINET, RoleUtilisateur.COMPTABLE)
  @ReserveAuComptable()
  @Post(':id/revues/:revueId/annuler')
  annulerRevue(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Param('revueId') revueId: string, @Body() dto: AnnulerTitreDto) {
    return this.service.annulerEvaluation(user.tenantId, user.userId, identifiant(id, 'du titre'), identifiant(revueId, 'de la revue'), dto);
  }
}
