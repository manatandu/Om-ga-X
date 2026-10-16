import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { RoleUtilisateur } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { LicenceGuard } from '../licence/licence.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthenticatedUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { ModelesImpressionService } from './modeles-impression.service';
import { CreerModeleImpressionDto, ModifierModeleImpressionDto } from './dto/modeles-impression.dto';

/**
 * LES MODÈLES D'IMPRESSION DES TIERS (ligne sage-l2, fonction 27) ·
 * Structure > Paramètres de saisie. Structure du plan des tiers, comme les
 * modèles et les modes de règlement · tenus par l'administrateur, lus par
 * tous.
 */
@UseGuards(JwtAuthGuard, LicenceGuard, RolesGuard)
@Controller('modeles-impression')
export class ModelesImpressionController {
  constructor(private readonly modeles: ModelesImpressionService) {}

  @Get()
  lister(@CurrentUser() user: AuthenticatedUser) {
    return this.modeles.lister(user.tenantId);
  }

  @Roles(RoleUtilisateur.ADMIN_CABINET)
  @Post()
  creer(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreerModeleImpressionDto) {
    return this.modeles.creer(user.tenantId, user.userId, dto);
  }

  @Roles(RoleUtilisateur.ADMIN_CABINET)
  @Patch(':id')
  modifier(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ModifierModeleImpressionDto) {
    return this.modeles.modifier(user.tenantId, id, dto);
  }

  @Roles(RoleUtilisateur.ADMIN_CABINET)
  @Delete(':id')
  supprimer(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.modeles.supprimer(user.tenantId, id);
  }
}
