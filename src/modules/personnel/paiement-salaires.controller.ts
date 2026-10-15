import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { RoleUtilisateur } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { LicenceGuard } from '../licence/licence.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthenticatedUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { AccesRolesCantonnes, ReserveAuComptable } from '../../common/decorators/acces-roles-cantonnes.decorator';
import { RibTiersDto } from '../tiers/dto/ribs-tiers.dto';
import { RibsSalariesService } from './ribs-salaries.service';
import { PaiementSalairesService } from './paiement-salaires.service';
import { AnnulationPaiementSalairesDto, ModePaiementSalarieDto, PaiementSalairesDto } from './dto/paiement-salaires.dto';

/** `?coupures=20000,10000,5000` · une valeur illisible est refusée par la règle des coupures, jamais ignorée. */
const lireCoupures = (texte: string | undefined): number[] | undefined =>
  texte === undefined || texte.trim() === '' ? undefined : texte.split(',').map((v) => Number(v.trim()));

/**
 * LIGNE SAGE-L5, FONCTION 75 · LE PAIEMENT DU SALARIÉ ET LE PAIEMENT DES
 * SALAIRES. Mêmes droits que le registre du personnel (données nominatives ·
 * fermé à l'aide-comptable, ouvert au gestionnaire de paie), et trois gestes
 * resserrés · les COORDONNÉES BANCAIRES à l'administrateur seul (une
 * structure, comme les RIB des tiers), le PAIEMENT et son ANNULATION au
 * comptable (ils écrivent au livre-journal, comme la passation de la paie).
 */
@AccesRolesCantonnes({ aideComptable: false, gestionnairePaie: true })
@UseGuards(JwtAuthGuard, LicenceGuard, RolesGuard)
@Controller('personnel')
export class PaiementSalairesController {
  constructor(
    private readonly ribs: RibsSalariesService,
    private readonly paiements: PaiementSalairesService,
  ) {}

  @Get('salaries/:salarieId/paiement')
  @Roles(RoleUtilisateur.ADMIN_CABINET, RoleUtilisateur.COMPTABLE, RoleUtilisateur.LECTURE_SEULE)
  lire(@CurrentUser() user: AuthenticatedUser, @Param('salarieId') salarieId: string) {
    return this.ribs.lire(user.tenantId, salarieId);
  }

  @Post('salaries/:salarieId/mode-paiement')
  @Roles(RoleUtilisateur.ADMIN_CABINET, RoleUtilisateur.COMPTABLE)
  definirMode(@CurrentUser() user: AuthenticatedUser, @Param('salarieId') salarieId: string, @Body() dto: ModePaiementSalarieDto) {
    return this.ribs.definirMode(user.tenantId, salarieId, dto.modePaiement);
  }

  @Post('salaries/:salarieId/ribs')
  @Roles(RoleUtilisateur.ADMIN_CABINET)
  creerRib(@CurrentUser() user: AuthenticatedUser, @Param('salarieId') salarieId: string, @Body() dto: RibTiersDto) {
    return this.ribs.creer(user.tenantId, salarieId, dto);
  }

  @Patch('ribs-salaries/:id')
  @Roles(RoleUtilisateur.ADMIN_CABINET)
  modifierRib(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: RibTiersDto) {
    return this.ribs.modifier(user.tenantId, id, dto);
  }

  @Delete('ribs-salaries/:id')
  @Roles(RoleUtilisateur.ADMIN_CABINET)
  supprimerRib(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.ribs.supprimer(user.tenantId, id);
  }

  @Get('paiement-salaires/:mois')
  @Roles(RoleUtilisateur.ADMIN_CABINET, RoleUtilisateur.COMPTABLE, RoleUtilisateur.LECTURE_SEULE)
  proposition(@CurrentUser() user: AuthenticatedUser, @Param('mois') mois: string, @Query('coupures') coupures?: string) {
    return this.paiements.proposition(user.tenantId, mois, lireCoupures(coupures));
  }

  // PAYER ÉCRIT AU LIVRE-JOURNAL · réservé au comptable, comme la passation.
  @Post('paiement-salaires/:mois')
  @ReserveAuComptable()
  @Roles(RoleUtilisateur.ADMIN_CABINET, RoleUtilisateur.COMPTABLE)
  payer(@CurrentUser() user: AuthenticatedUser, @Param('mois') mois: string, @Body() dto: PaiementSalairesDto) {
    return this.paiements.payer(user.tenantId, user.userId, user.email, mois, dto);
  }

  @Post('paiements-salaires/:id/annulation')
  @ReserveAuComptable()
  @Roles(RoleUtilisateur.ADMIN_CABINET, RoleUtilisateur.COMPTABLE)
  annuler(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: AnnulationPaiementSalairesDto) {
    return this.paiements.annuler(user.tenantId, user.userId, user.email, id, dto);
  }
}
