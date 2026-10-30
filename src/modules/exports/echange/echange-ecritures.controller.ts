import { BadRequestException, Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { EtatEcritureRecue, RoleUtilisateur } from '@prisma/client';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { LicenceGuard } from '../../licence/licence.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { ReserveAuComptable } from '../../../common/decorators/acces-roles-cantonnes.decorator';
import { CurrentUser, AuthenticatedUser } from '../../../common/decorators/current-user.decorator';
import { EchangeEcrituresService } from './echange-ecritures.service';
import { RecevoirEnvoiDto } from './dto/recevoir-envoi.dto';

/** L'état demandé à la liste des écritures reçues · absent, toutes ; illisible, refusé. */
function etatOuRefus(valeur: string | undefined): EtatEcritureRecue | undefined {
  if (valeur === undefined || valeur === '') return undefined;
  if ((Object.values(EtatEcritureRecue) as string[]).includes(valeur)) return valeur as EtatEcritureRecue;
  throw new BadRequestException(`État inconnu · ${Object.values(EtatEcritureRecue).join(', ')}.`);
}

/**
 * L'ÉCHANGE D'ÉCRITURES (ligne dossier-l9, fonction 102) · Fichier >
 * Échanger des écritures. Lire les réceptions et les écritures reçues est
 * une lecture, ouverte à qui lit le journal. RECEVOIR remplace et retire des
 * pièces du brouillard que d'autres ont pu saisir, et DÉTACHER prend une
 * écriture à son compte · des actes du comptable, comme la validation et
 * l'export des modifications (`@ReserveAuComptable`). L'aperçu n'écrit rien,
 * mais montre le sort de chaque pièce · réservé de même, pour que l'aide ne
 * soit pas lue comme une invitation à recevoir.
 */
@UseGuards(JwtAuthGuard, LicenceGuard, RolesGuard)
@Controller('echanges-ecritures')
export class EchangeEcrituresController {
  constructor(private readonly service: EchangeEcrituresService) {}

  @Get()
  async lister(@CurrentUser() user: AuthenticatedUser) {
    return this.service.lister(user.tenantId);
  }

  @Get('recues')
  async recues(@CurrentUser() user: AuthenticatedUser, @Query('etat') etat?: string) {
    return this.service.recues(user.tenantId, etatOuRefus(etat));
  }

  @Get(':id')
  async detail(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.detail(user.tenantId, id);
  }

  @Post('apercu')
  @Roles(RoleUtilisateur.ADMIN_CABINET, RoleUtilisateur.COMPTABLE)
  @ReserveAuComptable()
  async apercu(@CurrentUser() user: AuthenticatedUser, @Body() dto: RecevoirEnvoiDto) {
    return this.service.recevoir(user.tenantId, user.userId, dto, true);
  }

  @Post()
  @Roles(RoleUtilisateur.ADMIN_CABINET, RoleUtilisateur.COMPTABLE)
  @ReserveAuComptable()
  async recevoir(@CurrentUser() user: AuthenticatedUser, @Body() dto: RecevoirEnvoiDto) {
    return this.service.recevoir(user.tenantId, user.userId, dto, false);
  }

  @Post('recues/:id/detacher')
  @Roles(RoleUtilisateur.ADMIN_CABINET, RoleUtilisateur.COMPTABLE)
  @ReserveAuComptable()
  async detacher(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.detacher(user.tenantId, user.userId, id);
  }
}
