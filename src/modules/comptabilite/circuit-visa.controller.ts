import { Body, Controller, Get, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { RoleUtilisateur } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { LicenceGuard } from '../licence/licence.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { ReserveAuComptable } from '../../common/decorators/acces-roles-cantonnes.decorator';
import { CircuitVisaService } from './circuit-visa.service';
import { RetirerVisasDto, ViserEcrituresDto } from './dto/circuit-visa.dto';

/**
 * LE CIRCUIT DE VISA AVANT VALIDATION (ligne microfina-m1, idée 1 ·
 * `circuit-visa.ts`). Viser est un geste de CONTRÔLE, comme valider · il est
 * réservé à l'administrateur et au comptable, retiré à l'aide-comptable et au
 * gestionnaire de paie (`@ReserveAuComptable`). Le refus de viser sa propre
 * pièce vit dans le service · le rôle dit qui peut viser, l'auteur du dernier
 * contenu dit ce que celui-ci peut viser.
 */
@UseGuards(JwtAuthGuard, LicenceGuard, RolesGuard)
@Controller('circuit-visa')
export class CircuitVisaController {
  constructor(private readonly circuit: CircuitVisaService) {}

  @Roles(RoleUtilisateur.ADMIN_CABINET, RoleUtilisateur.COMPTABLE)
  @ReserveAuComptable()
  @Post('ecritures')
  viser(@CurrentUser() user: AuthenticatedUser, @Body() dto: ViserEcrituresDto) {
    return this.circuit.viserEcritures(user.tenantId, user.userId, dto.pieces);
  }

  @Roles(RoleUtilisateur.ADMIN_CABINET, RoleUtilisateur.COMPTABLE)
  @ReserveAuComptable()
  @Post('ecritures/retrait')
  retirer(@CurrentUser() user: AuthenticatedUser, @Body() dto: RetirerVisasDto) {
    return this.circuit.retirerVisas(user.tenantId, { userId: user.userId, role: user.role }, dto.ecritureIds);
  }

  @Roles(RoleUtilisateur.ADMIN_CABINET, RoleUtilisateur.COMPTABLE)
  @ReserveAuComptable()
  @Post('factures/:id')
  viserFacture(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.circuit.viserFacture(user.tenantId, user.userId, id);
  }

  /** La fiche d'imputation · une LECTURE, ouverte à qui lit les écritures. */
  @Get('ecritures/:id/fiche')
  fiche(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.circuit.ficheImputation(user.tenantId, id);
  }
}
