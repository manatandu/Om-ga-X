import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { RoleUtilisateur } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { LicenceGuard } from '../licence/licence.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { AccesRolesCantonnes } from '../../common/decorators/acces-roles-cantonnes.decorator';
import { AuthenticatedUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { DetentionBienService } from './detention-bien.service';
import { LiberationBienDto, RemiseBienDto, SignatureRecuDto } from './dto/detention-bien.dto';

/**
 * LIGNE MICROFINA M4 · LE DÉTENTEUR D'UN BIEN. Commun aux deux référentiels ·
 * aucun texte ne le régit, aucune écriture n'en naît.
 *
 * LES DROITS (choix d'organisation, AUDCIF art. 69 · « l'entité détermine,
 * sous sa responsabilité, les procédures nécessaires ») :
 *  · LIRE · l'administrateur, le comptable et la lecture seule, comme le
 *    registre des immobilisations ;
 *  · ÉCRIRE (affecter, transférer, libérer, déclarer une signature) ·
 *    l'administrateur et le comptable, comme le registre du personnel ;
 *  · les deux RÔLES CANTONNÉS sont refusés en entier, lecture comprise. Le
 *    détenteur est un salarié NOMMÉ · l'aide-comptable n'a pas accès au
 *    registre du personnel (`roles-cantonnes.ts`, « ses données sont
 *    nominatives »). Le gestionnaire de paie n'a rien tant qu'une route ne
 *    l'ouvre pas, et il n'a pas le registre des immobilisations où choisir
 *    le bien · lui ouvrir ce module élargirait son périmètre au-delà du
 *    personnel et de la paie.
 */
@AccesRolesCantonnes({ aideComptable: false, gestionnairePaie: false })
@UseGuards(JwtAuthGuard, LicenceGuard, RolesGuard)
@Controller('immobilisations')
export class DetentionBienController {
  constructor(private readonly detentions: DetentionBienService) {}

  /** Le suivi sur une période · qui détenait quoi entre `du` et `au`. */
  @Roles(RoleUtilisateur.ADMIN_CABINET, RoleUtilisateur.COMPTABLE, RoleUtilisateur.LECTURE_SEULE)
  @Get('detentions/suivi')
  suivi(
    @CurrentUser() user: AuthenticatedUser,
    @Query('du') du?: string,
    @Query('au') au?: string,
    @Query('salarieId') salarieId?: string,
    @Query('immobilisationId') immobilisationId?: string,
  ) {
    return this.detentions.suivi(user.tenantId, { du, au, salarieId, immobilisationId });
  }

  /** Les salariés sous contrat à la date · identité seule. */
  @Roles(RoleUtilisateur.ADMIN_CABINET, RoleUtilisateur.COMPTABLE, RoleUtilisateur.LECTURE_SEULE)
  @Get('detentions/salaries')
  salaries(@CurrentUser() user: AuthenticatedUser, @Query('date') date?: string) {
    return this.detentions.salariesAffectables(user.tenantId, date);
  }

  @Roles(RoleUtilisateur.ADMIN_CABINET, RoleUtilisateur.COMPTABLE, RoleUtilisateur.LECTURE_SEULE)
  @Get('detentions/recus/:recuId')
  recu(@CurrentUser() user: AuthenticatedUser, @Param('recuId', ParseUUIDPipe) recuId: string) {
    return this.detentions.recu(user.tenantId, recuId);
  }

  @Roles(RoleUtilisateur.ADMIN_CABINET, RoleUtilisateur.COMPTABLE)
  @Post('detentions/recus/:recuId/signature')
  signature(
    @CurrentUser() user: AuthenticatedUser,
    @Param('recuId', ParseUUIDPipe) recuId: string,
    @Body() dto: SignatureRecuDto,
  ) {
    return this.detentions.declarerSignature(user.tenantId, user, recuId, dto);
  }

  @Roles(RoleUtilisateur.ADMIN_CABINET, RoleUtilisateur.COMPTABLE, RoleUtilisateur.LECTURE_SEULE)
  @Get(':id/detentions')
  historique(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.detentions.historique(user.tenantId, id);
  }

  @Roles(RoleUtilisateur.ADMIN_CABINET, RoleUtilisateur.COMPTABLE)
  @Post(':id/detentions/affectation')
  affecter(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: RemiseBienDto) {
    return this.detentions.affecter(user.tenantId, user, id, dto);
  }

  @Roles(RoleUtilisateur.ADMIN_CABINET, RoleUtilisateur.COMPTABLE)
  @Post(':id/detentions/transfert')
  transferer(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: RemiseBienDto) {
    return this.detentions.transferer(user.tenantId, user, id, dto);
  }

  @Roles(RoleUtilisateur.ADMIN_CABINET, RoleUtilisateur.COMPTABLE)
  @Post(':id/detentions/liberation')
  liberer(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: LiberationBienDto) {
    return this.detentions.liberer(user.tenantId, user, id, dto);
  }
}
