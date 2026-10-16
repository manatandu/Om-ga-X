import { BadRequestException, Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, Put, Query, UseGuards } from '@nestjs/common';
import { EditionModele, RoleUtilisateur } from '@prisma/client';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { LicenceGuard } from '../../licence/licence.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../../../common/decorators/current-user.decorator';
import { ModelesEditionService } from './modeles-edition.service';
import { CreerModeleEditionDto, RemplacerModeleEditionDto } from './dto/modele-edition.dto';

function editionOuRefus(valeur: string | undefined): EditionModele {
  if (valeur && (Object.values(EditionModele) as string[]).includes(valeur)) return valeur as EditionModele;
  throw new BadRequestException('Édition inconnue · PLAN_COMPTABLE, PLAN_TIERS ou PLAN_ANALYTIQUE.');
}

/**
 * LES MODÈLES D'ÉDITION (ligne sage-l7, fonction 59) · les lire est une
 * lecture ; les enregistrer, remplacer ou supprimer touche ce que tout le
 * dossier imprime · ni lecture seule, ni gestionnaire de paie.
 */
@UseGuards(JwtAuthGuard, LicenceGuard, RolesGuard)
@Controller('modeles-edition')
export class ModelesEditionController {
  constructor(private readonly service: ModelesEditionService) {}

  @Get()
  async lister(@CurrentUser() user: AuthenticatedUser, @Query('edition') edition?: string) {
    return this.service.lister(user.tenantId, editionOuRefus(edition));
  }

  @Post()
  @Roles(RoleUtilisateur.ADMIN_CABINET, RoleUtilisateur.COMPTABLE)
  async creer(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreerModeleEditionDto) {
    return this.service.creer(user.tenantId, user.userId, dto.edition, dto);
  }

  @Put(':id')
  @Roles(RoleUtilisateur.ADMIN_CABINET, RoleUtilisateur.COMPTABLE)
  async remplacer(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: RemplacerModeleEditionDto) {
    return this.service.remplacer(user.tenantId, id, dto);
  }

  @Delete(':id')
  @Roles(RoleUtilisateur.ADMIN_CABINET, RoleUtilisateur.COMPTABLE)
  async supprimer(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.supprimer(user.tenantId, id);
  }
}
