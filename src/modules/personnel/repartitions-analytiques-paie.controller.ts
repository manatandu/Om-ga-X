import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { RoleUtilisateur } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { LicenceGuard } from '../licence/licence.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthenticatedUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { AccesRolesCantonnes } from '../../common/decorators/acces-roles-cantonnes.decorator';
import { RepartitionsAnalytiquesPaieService } from './repartitions-analytiques-paie.service';
import { OrganigrammeService } from './organigramme.service';
import { RepartitionAnalytiquePaieDto, RetraitRepartitionAnalytiqueDto } from './dto/repartition-analytique-paie.dto';

/**
 * LIGNE SAGE-L5, FONCTION 88 · LA RÉPARTITION ANALYTIQUE DU SALARIÉ. Mêmes
 * droits que le registre du personnel (fermé à l'aide-comptable, ouvert au
 * gestionnaire de paie) · la passation du mois, qui l'applique, reste au
 * comptable (`@ReserveAuComptable()` de la paie du mois).
 */
@AccesRolesCantonnes({ aideComptable: false, gestionnairePaie: true })
@UseGuards(JwtAuthGuard, LicenceGuard, RolesGuard)
@Controller('personnel')
export class RepartitionsAnalytiquesPaieController {
  constructor(
    private readonly repartitions: RepartitionsAnalytiquesPaieService,
    private readonly organigramme: OrganigrammeService,
  ) {}

  /**
   * La répartition du salarié, et (ligne paie-suite) la section que son unité
   * de l'organigramme PROPOSE · l'écran la préremplit, jamais la déclare.
   */
  @Get('salaries/:salarieId/repartitions-analytiques')
  @Roles(RoleUtilisateur.ADMIN_CABINET, RoleUtilisateur.COMPTABLE, RoleUtilisateur.LECTURE_SEULE)
  async lire(@CurrentUser() user: AuthenticatedUser, @Param('salarieId') salarieId: string) {
    const lu = await this.repartitions.lire(user.tenantId, salarieId);
    return { ...lu, propositionOrganigramme: await this.organigramme.propositionAnalytique(user.tenantId, salarieId) };
  }

  @Post('salaries/:salarieId/repartitions-analytiques')
  @Roles(RoleUtilisateur.ADMIN_CABINET, RoleUtilisateur.COMPTABLE)
  declarer(
    @CurrentUser() user: AuthenticatedUser,
    @Param('salarieId') salarieId: string,
    @Body() dto: RepartitionAnalytiquePaieDto,
  ) {
    return this.repartitions.declarer(user.tenantId, user.userId, salarieId, dto);
  }

  @Post('repartitions-analytiques/:id/retrait')
  @Roles(RoleUtilisateur.ADMIN_CABINET, RoleUtilisateur.COMPTABLE)
  retirer(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: RetraitRepartitionAnalytiqueDto) {
    return this.repartitions.retirer(user.tenantId, user.userId, id, dto.motif);
  }
}
