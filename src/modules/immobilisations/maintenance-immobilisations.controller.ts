import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { RoleUtilisateur } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { LicenceGuard } from '../licence/licence.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthenticatedUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { EXERCICE_REQUIS } from '../../common/exercice-requis';
import { MaintenanceImmobilisationsService } from './maintenance-immobilisations.service';
import { ParametresRenumerotationDto } from './dto/maintenance-immobilisations.dto';

/**
 * RENUMÉROTATION ET MAINTENANCE DU REGISTRE (ligne sage-l4, fonction n° 73) ·
 * l'aperçu et la maintenance se lisent par tous ; la renumérotation touche la
 * STRUCTURE du registre (les numéros de tous les biens) · administrateur
 * seul, comme les autres gestes de structure.
 */
@UseGuards(JwtAuthGuard, LicenceGuard, RolesGuard)
@Controller('immobilisations')
export class MaintenanceImmobilisationsController {
  constructor(private readonly maintenance: MaintenanceImmobilisationsService) {}

  @Get('renumerotation')
  apercu(@CurrentUser() user: AuthenticatedUser, @Query() parametres: ParametresRenumerotationDto) {
    return this.maintenance.apercuRenumerotation(user.tenantId, parametres);
  }

  @Roles(RoleUtilisateur.ADMIN_CABINET)
  @Post('renumerotation')
  renumeroter(@CurrentUser() user: AuthenticatedUser, @Body() parametres: ParametresRenumerotationDto) {
    return this.maintenance.renumeroter(user.tenantId, parametres);
  }

  @Get('maintenance')
  lire(@CurrentUser() user: AuthenticatedUser, @Query('exerciceId', EXERCICE_REQUIS) exerciceId: string) {
    return this.maintenance.maintenance(user.tenantId, exerciceId);
  }
}
