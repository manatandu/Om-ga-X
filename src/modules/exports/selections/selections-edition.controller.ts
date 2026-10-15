import { BadRequestException, Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, Put, Query, UseGuards } from '@nestjs/common';
import { EditionSelection, RoleUtilisateur } from '@prisma/client';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { LicenceGuard } from '../../licence/licence.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../../../common/decorators/current-user.decorator';
import { SelectionsEditionService } from './selections-edition.service';
import { CreerSelectionEditionDto, RemplacerSelectionEditionDto } from './dto/selection-edition.dto';

function editionOuRefus(valeur: string | undefined): EditionSelection {
  if (valeur && (Object.values(EditionSelection) as string[]).includes(valeur)) return valeur as EditionSelection;
  throw new BadRequestException('Édition inconnue · JOURNAL ou IMPRESSION_DIFFEREE.');
}

/**
 * LES SÉLECTIONS ENREGISTRÉES (ligne sage-l7, fonction 59) · les rappeler est
 * une lecture ; les enregistrer, remplacer ou supprimer touche ce que tout le
 * dossier rappelle · ni lecture seule, ni gestionnaire de paie.
 */
@UseGuards(JwtAuthGuard, LicenceGuard, RolesGuard)
@Controller('selections-edition')
export class SelectionsEditionController {
  constructor(private readonly service: SelectionsEditionService) {}

  @Get()
  async lister(@CurrentUser() user: AuthenticatedUser, @Query('edition') edition?: string) {
    return this.service.lister(user.tenantId, editionOuRefus(edition));
  }

  @Post()
  @Roles(RoleUtilisateur.ADMIN_CABINET, RoleUtilisateur.COMPTABLE)
  async creer(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreerSelectionEditionDto) {
    return this.service.creer(user.tenantId, user.userId, dto.edition, dto.nom, dto.criteres);
  }

  @Put(':id')
  @Roles(RoleUtilisateur.ADMIN_CABINET, RoleUtilisateur.COMPTABLE)
  async remplacer(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: RemplacerSelectionEditionDto) {
    return this.service.remplacer(user.tenantId, id, dto.criteres);
  }

  @Delete(':id')
  @Roles(RoleUtilisateur.ADMIN_CABINET, RoleUtilisateur.COMPTABLE)
  async supprimer(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.supprimer(user.tenantId, id);
  }
}
