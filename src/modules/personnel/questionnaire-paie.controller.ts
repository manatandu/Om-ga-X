import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { RoleUtilisateur } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { LicenceGuard } from '../licence/licence.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthenticatedUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { AccesRolesCantonnes } from '../../common/decorators/acces-roles-cantonnes.decorator';
import { QuestionnairePaieService } from './questionnaire-paie.service';

/**
 * LIGNE SAGE-L5, FONCTION 85 · le questionnaire de paie se LIT ici · il
 * n'écrit rien par lui-même, les réponses passent par les routes existantes,
 * chacune avec ses droits. Mêmes droits de lecture que le registre.
 */
@AccesRolesCantonnes({ aideComptable: false, gestionnairePaie: true })
@UseGuards(JwtAuthGuard, LicenceGuard, RolesGuard)
@Controller('personnel')
export class QuestionnairePaieController {
  constructor(private readonly questionnaire: QuestionnairePaieService) {}

  @Get('questionnaire-paie')
  @Roles(RoleUtilisateur.ADMIN_CABINET, RoleUtilisateur.COMPTABLE, RoleUtilisateur.LECTURE_SEULE)
  lire(@CurrentUser() user: AuthenticatedUser, @Query('salarieId') salarieId?: string, @Query('mois') mois?: string) {
    return this.questionnaire.lire(user.tenantId, salarieId || undefined, mois || undefined);
  }
}
