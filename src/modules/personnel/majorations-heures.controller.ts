import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { RoleUtilisateur } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { LicenceGuard } from '../licence/licence.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthenticatedUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { AccesRolesCantonnes } from '../../common/decorators/acces-roles-cantonnes.decorator';
import { MajorationsHeuresService } from './majorations-heures.service';
import { MajorationHeuresDto } from './dto/majorations.dto';

/**
 * LIGNE SAGE-L5, FONCTION 78, ÉTAPE 2 · les taux de majoration des heures,
 * déclarés avec leur source (Code du travail, art. 119, 120, e) et 124). Mêmes
 * droits que les barèmes de paie du dossier.
 */
@AccesRolesCantonnes({ aideComptable: false, gestionnairePaie: true })
@UseGuards(JwtAuthGuard, LicenceGuard, RolesGuard)
@Controller('personnel')
export class MajorationsHeuresController {
  constructor(private readonly majorations: MajorationsHeuresService) {}

  @Get('majorations-heures')
  @Roles(RoleUtilisateur.ADMIN_CABINET, RoleUtilisateur.COMPTABLE, RoleUtilisateur.LECTURE_SEULE)
  lister(@CurrentUser() user: AuthenticatedUser) {
    return this.majorations.lister(user.tenantId);
  }

  @Post('majorations-heures')
  @Roles(RoleUtilisateur.ADMIN_CABINET, RoleUtilisateur.COMPTABLE)
  creer(@CurrentUser() user: AuthenticatedUser, @Body() dto: MajorationHeuresDto) {
    return this.majorations.creer(user.tenantId, user.email, dto);
  }

  @Post('majorations-heures/:id/desactivation')
  @Roles(RoleUtilisateur.ADMIN_CABINET, RoleUtilisateur.COMPTABLE)
  desactiver(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.majorations.desactiver(user.tenantId, user.email, id);
  }
}
