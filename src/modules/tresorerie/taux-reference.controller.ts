import { BadRequestException, Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { RoleUtilisateur } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { LicenceGuard } from '../licence/licence.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthenticatedUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { OperationsTresorerieService } from './operations-tresorerie.service';
import { CoursTauxDto, TauxReferenceDto } from './operations-tresorerie.dto';

const identifiant = (id: string, objet: string) => {
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new BadRequestException(`L'identifiant ${objet} est exigé.`);
  return id;
};

/**
 * TAUX DE RÉFÉRENCE · Structure > Paramètres de saisie (ligne sage-l3,
 * fonction 47) · une STRUCTURE, écrite par l'administrateur ; un cours se
 * DÉCLARE par l'administrateur ou le comptable, avec sa source, comme le
 * cours d'une devise.
 */
@UseGuards(JwtAuthGuard, LicenceGuard, RolesGuard)
@Controller('taux-reference')
export class TauxReferenceController {
  constructor(private readonly service: OperationsTresorerieService) {}

  @Get()
  lister(@CurrentUser() user: AuthenticatedUser) {
    return this.service.taux(user.tenantId);
  }

  @Roles(RoleUtilisateur.ADMIN_CABINET)
  @Post()
  creer(@CurrentUser() user: AuthenticatedUser, @Body() dto: TauxReferenceDto) {
    return this.service.creerTaux(user.tenantId, dto);
  }

  @Roles(RoleUtilisateur.ADMIN_CABINET)
  @Delete(':id')
  retirer(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.service.retirerTaux(user.tenantId, identifiant(id, 'du taux'));
  }

  @Roles(RoleUtilisateur.ADMIN_CABINET, RoleUtilisateur.COMPTABLE)
  @Post(':id/cours')
  ajouterCours(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: CoursTauxDto) {
    return this.service.ajouterCours(user.tenantId, user.userId, identifiant(id, 'du taux'), dto);
  }

  @Roles(RoleUtilisateur.ADMIN_CABINET)
  @Delete(':id/cours/:coursId')
  retirerCours(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Param('coursId') coursId: string) {
    return this.service.retirerCours(user.tenantId, identifiant(id, 'du taux'), identifiant(coursId, 'du cours'));
  }
}
