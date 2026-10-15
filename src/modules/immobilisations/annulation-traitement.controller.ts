import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { RoleUtilisateur } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { LicenceGuard } from '../licence/licence.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { ReserveAuComptable } from '../../common/decorators/acces-roles-cantonnes.decorator';
import { AuthenticatedUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { AnnulationTraitementService } from './annulation-traitement.service';
import { AnnulerTraitementDto } from './dto/annulation-traitement.dto';

/**
 * ANNULER UNE DOTATION OU UN TRAITEMENT D'IMMOBILISATION (ligne sage-l4,
 * fonction n° 67) · lecture ouverte à tous, comme la fiche du bien ; le geste
 * au comptable seul (`@ReserveAuComptable`) · il inscrit en négatif une
 * écriture VALIDÉE, comme l'annulation d'une revue de créance douteuse ou
 * d'une réévaluation des devises.
 */
@UseGuards(JwtAuthGuard, LicenceGuard, RolesGuard)
@Controller('immobilisations')
export class AnnulationTraitementController {
  constructor(private readonly annulations: AnnulationTraitementService) {}

  @Get('annulations-traitements')
  historique(@CurrentUser() user: AuthenticatedUser, @Query('immobilisationId') immobilisationId?: string) {
    return this.annulations.annulations(user.tenantId, immobilisationId || undefined);
  }

  @Get(':id/traitements')
  traitements(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.annulations.traitementsDuBien(user.tenantId, id);
  }

  @Roles(RoleUtilisateur.ADMIN_CABINET, RoleUtilisateur.COMPTABLE)
  @ReserveAuComptable()
  @Post('traitements/annulation')
  annuler(@CurrentUser() user: AuthenticatedUser, @Body() dto: AnnulerTraitementDto) {
    return this.annulations.annuler(user.tenantId, user.userId, dto);
  }
}
