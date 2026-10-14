import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { RoleUtilisateur } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { LicenceGuard } from '../licence/licence.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthenticatedUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { CreationDepuisEcrituresService } from './creation-depuis-ecritures.service';
import { CreerDepuisEcritureDto } from './dto/creation-depuis-ecritures.dto';

/**
 * CRÉER LES BIENS À PARTIR DES ÉCRITURES DÉJÀ PASSÉES (ligne sage-l4,
 * fonction n° 68) · la liste se lit par tous ; la création aux rôles qui
 * créent un bien (administrateur, comptable), comme `POST /immobilisations`.
 */
@UseGuards(JwtAuthGuard, LicenceGuard, RolesGuard)
@Controller('immobilisations')
export class CreationDepuisEcrituresController {
  constructor(private readonly creation: CreationDepuisEcrituresService) {}

  @Get('ecritures-a-transformer')
  lignes(@CurrentUser() user: AuthenticatedUser) {
    return this.creation.lignes(user.tenantId);
  }

  @Roles(RoleUtilisateur.ADMIN_CABINET, RoleUtilisateur.COMPTABLE)
  @Post('depuis-ecriture')
  creer(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreerDepuisEcritureDto) {
    return this.creation.creer(user.tenantId, user.userId, dto);
  }
}
