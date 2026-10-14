import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { RoleUtilisateur } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { LicenceGuard } from '../licence/licence.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { EXERCICE_REQUIS } from '../../common/exercice-requis';
import { ImpressionsJournalService } from './impressions-journal.service';
import { ImprimerJournalDto } from './dto/impression-journal.dto';

/**
 * LES IMPRESSIONS DU JOURNAL (ligne sage-l1, fonction 60). Imprimer le
 * journal est une LECTURE · ouverte à qui peut lire le journal, lecture seule
 * comprise ; l'enregistrement n'est que sa trace (AUDCIF art. 22, 7°).
 */
@UseGuards(JwtAuthGuard, LicenceGuard, RolesGuard)
@Controller('impressions-journal')
export class ImpressionsJournalController {
  constructor(private readonly impressions: ImpressionsJournalService) {}

  @Get()
  async lister(@CurrentUser() user: AuthenticatedUser, @Query('exerciceId', EXERCICE_REQUIS) exerciceId: string) {
    return this.impressions.lister(user.tenantId, exerciceId);
  }

  @Post()
  @Roles(RoleUtilisateur.ADMIN_CABINET, RoleUtilisateur.COMPTABLE, RoleUtilisateur.LECTURE_SEULE)
  async imprimer(@CurrentUser() user: AuthenticatedUser, @Body() dto: ImprimerJournalDto) {
    return this.impressions.imprimer(user.tenantId, user.userId, dto);
  }
}
