import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Res, UseGuards } from '@nestjs/common';
import { RoleUtilisateur } from '@prisma/client';
import { Response } from 'express';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { LicenceGuard } from '../../licence/licence.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../../../common/decorators/current-user.decorator';
import { ImpressionDiffereeService } from './impression-differee.service';
import { DemanderImpressionDto } from './dto/demander-impression.dto';

const TYPE_XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/**
 * L'IMPRESSION DIFFÉRÉE (ligne sage-l7, fonction 59) · Fichier > Impressions
 * différées. Demander et faire produire une édition est une LECTURE des
 * livres · ouverte à qui peut les exporter, lecture seule comprise, comme
 * l'impression du journal ; la demande n'est que sa trace numérotée et datée
 * (AUDCIF art. 22, 7°). Retirer un fichier rangé libère la place du dossier ·
 * le comptable ou l'administrateur.
 */
@UseGuards(JwtAuthGuard, LicenceGuard, RolesGuard)
@Controller('impressions-differees')
export class ImpressionsDiffereesController {
  constructor(private readonly service: ImpressionDiffereeService) {}

  @Get()
  async lister(@CurrentUser() user: AuthenticatedUser) {
    return this.service.lister(user.tenantId);
  }

  @Post()
  @Roles(RoleUtilisateur.ADMIN_CABINET, RoleUtilisateur.COMPTABLE, RoleUtilisateur.LECTURE_SEULE)
  async demander(@CurrentUser() user: AuthenticatedUser, @Body() dto: DemanderImpressionDto) {
    return this.service.demander(user.tenantId, user.userId, dto.nature, dto.criteres);
  }

  @Post('traiter')
  @Roles(RoleUtilisateur.ADMIN_CABINET, RoleUtilisateur.COMPTABLE, RoleUtilisateur.LECTURE_SEULE)
  async traiter(@CurrentUser() user: AuthenticatedUser) {
    return this.service.traiter(user.tenantId);
  }

  @Post(':id/retirer-fichier')
  @Roles(RoleUtilisateur.ADMIN_CABINET, RoleUtilisateur.COMPTABLE)
  async retirerFichier(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.retirerFichier(user.tenantId, id);
  }

  @Get(':id/fichier')
  async fichier(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string, @Res() res: Response) {
    const { nomFichier, contenu } = await this.service.fichier(user.tenantId, id);
    res.set({
      'Content-Type': TYPE_XLSX,
      'Content-Disposition': `attachment; filename="${nomFichier}"`,
      'Access-Control-Expose-Headers': 'Content-Disposition',
    });
    res.send(contenu);
  }
}
