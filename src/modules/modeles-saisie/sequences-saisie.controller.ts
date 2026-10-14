import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { RoleUtilisateur } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { LicenceGuard } from '../licence/licence.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { SequencesSaisieService } from './sequences-saisie.service';
import { CreerSequenceSaisieDto, ModifierSequenceSaisieDto } from './dto/sequence-saisie.dto';

/**
 * LES SÉQUENCES DE SAISIE (ligne sage-l1, fonction 19) · Structure >
 * Paramètres de saisie. Mêmes droits que les modèles de saisie qu'elles
 * rangent · l'administrateur et le comptable les tiennent, tous les lisent.
 */
@UseGuards(JwtAuthGuard, LicenceGuard, RolesGuard)
@Controller('sequences-saisie')
export class SequencesSaisieController {
  constructor(private readonly service: SequencesSaisieService) {}

  @Get()
  async lister(@CurrentUser() user: AuthenticatedUser) {
    return this.service.lister(user.tenantId);
  }

  @Roles(RoleUtilisateur.ADMIN_CABINET, RoleUtilisateur.COMPTABLE)
  @Post()
  async creer(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreerSequenceSaisieDto) {
    return this.service.creer(user.tenantId, user.userId, dto.intitule);
  }

  @Roles(RoleUtilisateur.ADMIN_CABINET, RoleUtilisateur.COMPTABLE)
  @Patch(':id')
  async renommer(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: ModifierSequenceSaisieDto) {
    return this.service.renommer(user.tenantId, id, dto.intitule);
  }

  @Roles(RoleUtilisateur.ADMIN_CABINET, RoleUtilisateur.COMPTABLE)
  @Delete(':id')
  async supprimer(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.service.supprimer(user.tenantId, id);
  }
}
