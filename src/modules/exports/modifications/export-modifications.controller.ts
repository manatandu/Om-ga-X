import { BadRequestException, Body, Controller, Get, Param, Post, Query, Res, UseGuards } from '@nestjs/common';
import { RoleUtilisateur } from '@prisma/client';
import { Response } from 'express';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { LicenceGuard } from '../../licence/licence.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { ReserveAuComptable } from '../../../common/decorators/acces-roles-cantonnes.decorator';
import { CurrentUser, AuthenticatedUser } from '../../../common/decorators/current-user.decorator';
import { ExportModificationsService } from './export-modifications.service';
import { ExporterEcrituresDto } from './dto/exporter-ecritures.dto';

const TYPE_XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** `inclureBrouillard` de l'aperçu · oui par défaut, comme le journal ; illisible, refusé. */
function brouillardOuRefus(valeur: string | undefined): boolean {
  if (valeur === undefined || valeur === '' || valeur === 'true') return true;
  if (valeur === 'false') return false;
  throw new BadRequestException('Paramètre inclureBrouillard · « true » ou « false ».');
}

/**
 * L'EXPORT DES SEULES MODIFICATIONS (ligne sage-l7, fonction 99) · Fichier >
 * Exporter les modifications. Lire la liste, l'aperçu et retélécharger un
 * fichier sont des lectures, ouvertes à qui lit le journal. PRODUIRE un export
 * avance le registre du dossier · ce qui part n'est plus « à envoyer » pour
 * personne ; c'est la transmission numérotée et datée que la receveuse cite
 * (AUDCIF art. 22, 7°), l'acte du comptable · ni lecture seule, ni
 * aide-comptable, comme la validation.
 */
@UseGuards(JwtAuthGuard, LicenceGuard, RolesGuard)
@Controller('exports-ecritures')
export class ExportModificationsController {
  constructor(private readonly service: ExportModificationsService) {}

  @Get()
  async lister(@CurrentUser() user: AuthenticatedUser) {
    return this.service.lister(user.tenantId);
  }

  @Get('apercu')
  async apercu(@CurrentUser() user: AuthenticatedUser, @Query('inclureBrouillard') inclureBrouillard?: string) {
    return this.service.apercu(user.tenantId, brouillardOuRefus(inclureBrouillard));
  }

  @Post()
  @Roles(RoleUtilisateur.ADMIN_CABINET, RoleUtilisateur.COMPTABLE)
  @ReserveAuComptable()
  async exporter(@CurrentUser() user: AuthenticatedUser, @Body() dto: ExporterEcrituresDto) {
    return this.service.exporter(user.tenantId, user.userId, dto.mode, dto.inclureBrouillard);
  }

  @Get(':id/fichier')
  async fichier(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Res() res: Response) {
    const { nomFichier, contenu } = await this.service.fichier(user.tenantId, id);
    res.set({
      'Content-Type': TYPE_XLSX,
      'Content-Disposition': `attachment; filename="${nomFichier}"`,
      'Access-Control-Expose-Headers': 'Content-Disposition',
    });
    res.send(contenu);
  }
}
