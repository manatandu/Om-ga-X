import { Body, Controller, Get, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { RoleUtilisateur } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { LicenceGuard } from '../licence/licence.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { ReserveAuComptable } from '../../common/decorators/acces-roles-cantonnes.decorator';
import { AuthenticatedUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { AnnulationSortieService } from './annulation-sortie.service';
import { AnnulerSortieDto } from './dto/annulation-sortie.dto';

/**
 * ANNULER LA SORTIE D'UN BIEN (ligne restes-immos-budgets, point 3) · l'aperçu
 * ouvert à tous, comme la fiche ; le geste au comptable seul
 * (`@ReserveAuComptable`) · il inscrit en négatif des écritures VALIDÉES,
 * comme l'annulation d'un traitement.
 */
@UseGuards(JwtAuthGuard, LicenceGuard, RolesGuard)
@Controller('immobilisations')
export class AnnulationSortieController {
  constructor(private readonly annulations: AnnulationSortieService) {}

  @Get(':id/annulation-sortie')
  apercu(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.annulations.apercu(user.tenantId, id);
  }

  @Roles(RoleUtilisateur.ADMIN_CABINET, RoleUtilisateur.COMPTABLE)
  @ReserveAuComptable()
  @Post(':id/annuler-sortie')
  annuler(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: AnnulerSortieDto) {
    return this.annulations.annuler(user.tenantId, user.userId, id, dto.motif);
  }
}
