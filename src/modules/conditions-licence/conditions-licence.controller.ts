import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { RoleUtilisateur } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { ConditionsLicenceService } from './conditions-licence.service';
import { AccepterConditionsDto } from './dto/conditions-licence.dto';

/**
 * LES CONDITIONS DE LICENCE D'UN DOSSIER · leur état, et leur acceptation.
 *
 * HORS DE `LicenceGuard`, comme la restitution · un dossier dont la licence
 * est échue reste en lecture seule, et c'est souvent à ce moment que le
 * client relit et accepte les conditions pour repartir. Fermer l'acceptation
 * derrière l'échéance enfermerait le geste qui la lève.
 *
 * LE TEXTE LUI-MÊME N'A PAS DE ROUTE · il est dans l'interface
 * (`conditions-de-licence.ts`, importé des deux côtés), public, et une page
 * publique ne dépend pas de la santé du serveur pour dire un contrat.
 */
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('conditions-licence')
export class ConditionsLicenceController {
  constructor(private readonly conditions: ConditionsLicenceService) {}

  /** Ouvert à tout utilisateur du dossier · chacun peut savoir ce que son dossier a accepté. */
  @Get()
  etat(@CurrentUser() user: AuthenticatedUser) {
    return this.conditions.etat(user.tenantId);
  }

  /**
   * L'ADMINISTRATEUR DU DOSSIER SEUL · c'est lui qui agit pour le client
   * (article 1er des conditions). Le comptable tient les livres, il n'engage
   * pas l'entité dans un contrat.
   */
  @Roles(RoleUtilisateur.ADMIN_CABINET)
  @Post('acceptation')
  accepter(@CurrentUser() user: AuthenticatedUser, @Body() dto: AccepterConditionsDto) {
    return this.conditions.accepter(user.tenantId, { userId: user.userId, email: user.email }, dto.version, dto.empreinte, dto.empreinteCommande);
  }

  /** Renvoyer l'accusé de réception d'une acceptation · l'administrateur du dossier, comme l'acceptation. */
  @Roles(RoleUtilisateur.ADMIN_CABINET)
  @Post('accuse')
  renvoyerAccuse(@CurrentUser() user: AuthenticatedUser) {
    return this.conditions.renvoyerAccuse(user.tenantId, { userId: user.userId, email: user.email });
  }
}
