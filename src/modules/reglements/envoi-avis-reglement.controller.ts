import { Controller, Param, Post, UseGuards } from '@nestjs/common';
import { RoleUtilisateur } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { LicenceGuard } from '../licence/licence.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthenticatedUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { EnvoiAvisReglementService } from './envoi-avis-reglement.service';

/**
 * ENVOYER LES AVIS DE RÈGLEMENT D'UN ORDRE PAR LA MESSAGERIE (ligne gl-saisie,
 * fonction 35) · écrits en file, aucun envoi tenté ici ; les mêmes rôles que
 * l'impression de l'ordre, qui les précède. Le personnel reste fermé à
 * l'aide-comptable, comme sur la lecture des ordres.
 */
@UseGuards(JwtAuthGuard, LicenceGuard, RolesGuard)
@Controller('ordres-virement')
export class EnvoiAvisReglementController {
  constructor(private readonly envoiAvis: EnvoiAvisReglementService) {}

  @Roles(RoleUtilisateur.ADMIN_CABINET, RoleUtilisateur.COMPTABLE)
  @Post(':id/avis-reglement/envoi')
  envoyer(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.envoiAvis.envoyer(user.tenantId, user.userId, id, user.role !== RoleUtilisateur.AIDE_COMPTABLE);
  }
}
