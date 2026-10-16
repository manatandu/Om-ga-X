import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { RoleUtilisateur } from '@prisma/client';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { LicenceGuard } from '../../licence/licence.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../../../common/decorators/current-user.decorator';
import { ExtraitsPeriodeService } from './extraits-periode.service';
import { ImprimerExtraitDto } from './dto/imprimer-extrait.dto';

/**
 * LES EXTRAITS DE PÉRIODE IMPRIMÉS DE L'ÉCRAN (ligne export-periode). Imprimer
 * la balance ou le grand livre d'une période est une LECTURE · ouverte à qui
 * peut les lire, lecture seule comprise ; l'enregistrement n'en est que la
 * trace numérotée et datée (AUDCIF art. 22, 7°), comme l'impression du
 * journal (sage-l1, fonction 60).
 */
@UseGuards(JwtAuthGuard, LicenceGuard, RolesGuard)
@Controller('extraits-periode')
export class ExtraitsPeriodeController {
  constructor(private readonly extraits: ExtraitsPeriodeService) {}

  @Post('impression')
  @Roles(RoleUtilisateur.ADMIN_CABINET, RoleUtilisateur.COMPTABLE, RoleUtilisateur.LECTURE_SEULE)
  async imprimer(@CurrentUser() user: AuthenticatedUser, @Body() dto: ImprimerExtraitDto) {
    return this.extraits.imprimer(user.tenantId, user.userId, dto);
  }
}
