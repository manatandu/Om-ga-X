import { Body, Controller, Get, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { RoleUtilisateur } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { LicenceGuard } from '../licence/licence.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { ReserveAuComptable } from '../../common/decorators/acces-roles-cantonnes.decorator';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { ImputationsPaiementsService } from './imputations-paiements.service';
import { DeclarerImputationDto, RetirerImputationDto } from './dto/imputation-paiement.dto';

/**
 * L'IMPUTATION DÉCLARÉE D'UN PAIEMENT (Code civil, Livre III, art. 151 et 153 ;
 * décision par la loi du 2026-10-07, point 4). Lire le groupe est ouvert à
 * tous les rôles du dossier ; déclarer et retirer changent ce que la
 * déclaration de TVA date, ils sont réservés au comptable (et à
 * l'administrateur).
 */
@UseGuards(JwtAuthGuard, LicenceGuard, RolesGuard)
@Controller('imputations-paiements')
export class ImputationsPaiementsController {
  constructor(private readonly imputations: ImputationsPaiementsService) {}

  /** Le groupe de lettrage d'une ligne, ses factures, ses paiements et l'imputation retenue. */
  @Get('groupe/:ligneId')
  async groupe(@CurrentUser() user: AuthenticatedUser, @Param('ligneId', new ParseUUIDPipe()) ligneId: string) {
    return this.imputations.groupe(user.tenantId, ligneId);
  }

  // Déclarer change ce que la déclaration de TVA date, comme retirer · réservé
  // au comptable (relecture du 2026-10-07, M3).
  @Roles(RoleUtilisateur.ADMIN_CABINET, RoleUtilisateur.COMPTABLE)
  @ReserveAuComptable()
  @Post()
  async declarer(@CurrentUser() user: AuthenticatedUser, @Body() dto: DeclarerImputationDto) {
    return this.imputations.declarer(user.tenantId, user.userId, dto);
  }

  @Roles(RoleUtilisateur.ADMIN_CABINET, RoleUtilisateur.COMPTABLE)
  @ReserveAuComptable()
  @Post(':ligneReglementId/retirer')
  async retirer(
    @CurrentUser() user: AuthenticatedUser,
    @Param('ligneReglementId', new ParseUUIDPipe()) ligneReglementId: string,
    @Body() dto: RetirerImputationDto,
  ) {
    return this.imputations.retirer(user.tenantId, user.userId, ligneReglementId, dto);
  }
}
