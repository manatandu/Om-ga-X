import { Body, Controller, Get, Param, Post, Query, Res, UseGuards } from '@nestjs/common';
import { RoleUtilisateur } from '@prisma/client';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { LicenceGuard } from '../licence/licence.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthenticatedUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { AccesRolesCantonnes } from '../../common/decorators/acces-roles-cantonnes.decorator';
import { TYPE_XLSX } from '../exports/envoi-en-flux';
import { FicheIndividuelleService } from './fiche-individuelle.service';
import { ImportPersonnelService } from './import-personnel.service';
import { FichierPersonnelDto } from './dto/import-personnel.dto';

/**
 * LIGNE PAIE-SUITE · fiche individuelle et cumuls (89) · mêmes droits que le
 * registre du personnel (fermé à l'aide-comptable, ouvert au gestionnaire de
 * paie), dont elle fait partie.
 */
@AccesRolesCantonnes({ aideComptable: false, gestionnairePaie: true })
@UseGuards(JwtAuthGuard, LicenceGuard, RolesGuard)
@Controller('personnel')
export class PersonnelSuiteController {
  constructor(
    private readonly fiches: FicheIndividuelleService,
    private readonly imports: ImportPersonnelService,
  ) {}

  @Get('salaries/:salarieId/fiche-individuelle')
  @Roles(RoleUtilisateur.ADMIN_CABINET, RoleUtilisateur.COMPTABLE, RoleUtilisateur.LECTURE_SEULE)
  fiche(@CurrentUser() user: AuthenticatedUser, @Param('salarieId') salarieId: string, @Query('annee') annee?: string) {
    return this.fiches.fiche(user.tenantId, salarieId, annee);
  }

  /** La même fiche en Excel · le classeur se construit EN ENTIER avant le premier octet, un refus rend son motif. */
  @Get('salaries/:salarieId/fiche-individuelle/excel')
  @Roles(RoleUtilisateur.ADMIN_CABINET, RoleUtilisateur.COMPTABLE, RoleUtilisateur.LECTURE_SEULE)
  async ficheExcel(
    @CurrentUser() user: AuthenticatedUser,
    @Param('salarieId') salarieId: string,
    @Query('annee') annee: string | undefined,
    @Res() res: Response,
  ) {
    const c = await this.fiches.excel(user.tenantId, salarieId, annee);
    res.set({
      'Content-Type': TYPE_XLSX,
      'Content-Disposition': `attachment; filename="${c.nomFichier}"`,
      'Access-Control-Expose-Headers': 'Content-Disposition',
    });
    res.send(c.buffer);
  }

  // ---- 82 · import du personnel ------------------------------------------

  @Get('import/modele')
  @Roles(RoleUtilisateur.ADMIN_CABINET, RoleUtilisateur.COMPTABLE, RoleUtilisateur.LECTURE_SEULE)
  async modeleImport(@Res() res: Response) {
    const buffer = await this.imports.modele();
    res.set({
      'Content-Type': TYPE_XLSX,
      'Content-Disposition': 'attachment; filename="modele-import-personnel.xlsx"',
      'Access-Control-Expose-Headers': 'Content-Disposition',
    });
    res.send(buffer);
  }

  /** La simulation · chaque ligne jugée par les règles de la saisie, rien d'écrit. */
  @Post('import/simulation')
  @Roles(RoleUtilisateur.ADMIN_CABINET, RoleUtilisateur.COMPTABLE)
  async simulerImport(@CurrentUser() user: AuthenticatedUser, @Body() dto: FichierPersonnelDto) {
    const { jugees: _interne, ...simulation } = await this.imports.simuler(user.tenantId, dto.nomFichier, dto.contenuBase64);
    return simulation;
  }

  /** L'import · la simulation rejouée, tout ou rien. */
  @Post('import')
  @Roles(RoleUtilisateur.ADMIN_CABINET, RoleUtilisateur.COMPTABLE)
  importer(@CurrentUser() user: AuthenticatedUser, @Body() dto: FichierPersonnelDto) {
    return this.imports.importer(user.tenantId, user.userId, dto.nomFichier, dto.contenuBase64);
  }
}
