import { Body, Controller, Get, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { Referentiel, RoleUtilisateur } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { LicenceGuard } from '../licence/licence.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { ReferentielGuard } from '../../common/guards/referentiel.guard';
import { ReferentielsAutorises } from '../../common/decorators/referentiels.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { ReserveAuComptable } from '../../common/decorators/acces-roles-cantonnes.decorator';
import { AuthenticatedUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { TransfertGroupeService } from './transfert-groupe.service';
import { AnnulationTransfertGroupeDto, TransfertGroupeDto } from './dto/transfert-groupe.dto';

/**
 * LIGNE SAGE-L4, N° 73 · le transfert d'un bien entre deux dossiers du
 * groupe. SYSCOHADA SEUL, refusé au serveur et pas seulement masqué ·
 * au SYCEBNL la fiche du compte 58 ne vise que la trésorerie, et rien ne
 * régit le passage d'un bien (question au suivi). Le geste passe deux pièces
 * dans deux comptabilités · réservé au comptable et à l'administrateur, comme
 * la liasse du groupe (`@ReserveAuComptable`).
 */
@UseGuards(JwtAuthGuard, LicenceGuard, RolesGuard, ReferentielGuard)
@ReferentielsAutorises(Referentiel.SYSCOHADA)
@Controller('immobilisations/transferts-groupe')
export class TransfertGroupeController {
  constructor(private readonly transferts: TransfertGroupeService) {}

  @Get()
  lister(@CurrentUser() user: AuthenticatedUser) {
    return this.transferts.lister(user.tenantId);
  }

  @Get('contexte')
  contexte(@CurrentUser() user: AuthenticatedUser) {
    return this.transferts.contexte(user.tenantId);
  }

  @Get('dossiers/:dossierId/biens')
  biens(@CurrentUser() user: AuthenticatedUser, @Param('dossierId', ParseUUIDPipe) dossierId: string) {
    return this.transferts.biens(user.tenantId, dossierId);
  }

  /** Lecture seule · rejoue les refus et rend les deux pièces sans rien écrire. */
  @Roles(RoleUtilisateur.ADMIN_CABINET, RoleUtilisateur.COMPTABLE)
  @ReserveAuComptable()
  @Post('apercu')
  apercu(@CurrentUser() user: AuthenticatedUser, @Body() dto: TransfertGroupeDto) {
    return this.transferts.apercu(user.tenantId, dto);
  }

  @Roles(RoleUtilisateur.ADMIN_CABINET, RoleUtilisateur.COMPTABLE)
  @ReserveAuComptable()
  @Post()
  transferer(@CurrentUser() user: AuthenticatedUser, @Body() dto: TransfertGroupeDto) {
    return this.transferts.transferer(user.tenantId, user.userId, user.email, dto);
  }

  @Roles(RoleUtilisateur.ADMIN_CABINET, RoleUtilisateur.COMPTABLE)
  @ReserveAuComptable()
  @Post(':transfertId/annulation')
  annuler(
    @CurrentUser() user: AuthenticatedUser,
    @Param('transfertId', ParseUUIDPipe) transfertId: string,
    @Body() dto: AnnulationTransfertGroupeDto,
  ) {
    return this.transferts.annuler(user.tenantId, user.userId, user.email, transfertId, dto.motif);
  }
}
