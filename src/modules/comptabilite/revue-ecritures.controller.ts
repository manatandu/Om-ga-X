import { Body, Controller, Delete, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { RoleUtilisateur } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { LicenceGuard } from '../licence/licence.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { ReserveAuComptable } from '../../common/decorators/acces-roles-cantonnes.decorator';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { RevueEcrituresService } from './revue-ecritures.service';
import { MarquerRevueDto } from './dto/revue-ecritures.dto';

/**
 * LA REVUE DES ÉCRITURES (ligne gl-saisie, fonction 64) · marquer revue et
 * retirer la marque, au comptable. Le filtre « revues / à revoir » se lit sur
 * le journal (`GET /ecritures?revue=oui|non`).
 */
@UseGuards(JwtAuthGuard, LicenceGuard, RolesGuard)
@Controller('revues-ecritures')
export class RevueEcrituresController {
  constructor(private readonly revues: RevueEcrituresService) {}

  @Post()
  @Roles(RoleUtilisateur.ADMIN_CABINET, RoleUtilisateur.COMPTABLE)
  @ReserveAuComptable()
  async marquer(@CurrentUser() user: AuthenticatedUser, @Body() dto: MarquerRevueDto) {
    return this.revues.marquer(user.tenantId, user.userId, dto.ecritureIds, dto.commentaire);
  }

  @Delete(':ecritureId')
  @Roles(RoleUtilisateur.ADMIN_CABINET, RoleUtilisateur.COMPTABLE)
  @ReserveAuComptable()
  async retirer(@CurrentUser() user: AuthenticatedUser, @Param('ecritureId', ParseUUIDPipe) ecritureId: string) {
    return this.revues.retirer(user.tenantId, ecritureId);
  }
}
