import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { RoleUtilisateur } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { LicenceGuard } from '../licence/licence.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthenticatedUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { OrdresVirementService } from './ordres-virement.service';
import { AnnulerOrdreDto, ListerOrdresDto } from './ordres-virement.dto';

/**
 * LE PERSONNEL EST FERMÉ À L'AIDE-COMPTABLE, lecture comprise
 * (common/guards/roles-cantonnes.ts) · un ordre qui paie des salaires nomme
 * chaque salarié et son net (ligne sage-l5, fonction 75).
 */
const personnelOuvert = (user: AuthenticatedUser) => user.role !== RoleUtilisateur.AIDE_COMPTABLE;

/**
 * Les ordres de virement, onglet de la fenêtre Règlement des tiers. Lus par
 * tous ; imprimer et annuler reviennent au cabinet qui tient le dossier, comme
 * le règlement lui-même. Aucune route de création ici · l'ordre naît avec ses
 * pièces (POST /reglements).
 */
@UseGuards(JwtAuthGuard, LicenceGuard, RolesGuard)
@Controller('ordres-virement')
export class OrdresVirementController {
  constructor(private readonly ordres: OrdresVirementService) {}

  /** Filtrable par état (`?statut=A_IMPRIMER`), un état inconnu étant un 400. */
  @Get()
  lister(@CurrentUser() user: AuthenticatedUser, @Query() filtre: ListerOrdresDto) {
    return this.ordres.lister(user.tenantId, filtre.statut, personnelOuvert(user));
  }

  @Get(':id')
  detail(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.ordres.detail(user.tenantId, id, personnelOuvert(user));
  }

  /** Les avis de règlement de l'ordre (ligne sage-l2, fonction 27) · une lecture, rien n'est écrit. */
  @Get(':id/avis-reglement')
  avisReglement(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.ordres.avisReglement(user.tenantId, id, personnelOuvert(user));
  }

  @Roles(RoleUtilisateur.ADMIN_CABINET, RoleUtilisateur.COMPTABLE)
  @Post(':id/impression')
  imprimer(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.ordres.imprimer(user.tenantId, id, user.email, personnelOuvert(user));
  }

  @Roles(RoleUtilisateur.ADMIN_CABINET, RoleUtilisateur.COMPTABLE)
  @Post(':id/annulation')
  annuler(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: AnnulerOrdreDto) {
    return this.ordres.annuler(user.tenantId, id, user.email, dto.motif, personnelOuvert(user));
  }
}
