import { Body, Controller, Get, Param, Put, UseGuards } from '@nestjs/common';
import { RoleUtilisateur } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { LicenceGuard } from '../licence/licence.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthenticatedUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { AccesRolesCantonnes } from '../../common/decorators/acces-roles-cantonnes.decorator';
import { BilanSocialService } from './bilan-social.service';
import { BilanSocialDto } from './dto/bilan-social.dto';

/** Le bilan social de l'ONEM · mêmes droits que le registre du personnel. */
@AccesRolesCantonnes({ aideComptable: false, gestionnairePaie: true })
@UseGuards(JwtAuthGuard, LicenceGuard, RolesGuard)
@Controller('personnel/bilan-social')
export class BilanSocialController {
  constructor(private readonly service: BilanSocialService) {}

  @Get(':exercice')
  @Roles(RoleUtilisateur.ADMIN_CABINET, RoleUtilisateur.COMPTABLE, RoleUtilisateur.LECTURE_SEULE)
  lire(@CurrentUser() user: AuthenticatedUser, @Param('exercice') exercice: string) {
    return this.service.lire(user.tenantId, Number(exercice));
  }

  @Put(':exercice')
  @Roles(RoleUtilisateur.ADMIN_CABINET, RoleUtilisateur.COMPTABLE)
  enregistrer(@CurrentUser() user: AuthenticatedUser, @Param('exercice') exercice: string, @Body() dto: BilanSocialDto) {
    return this.service.enregistrer(user.tenantId, user.email, Number(exercice), dto);
  }
}
