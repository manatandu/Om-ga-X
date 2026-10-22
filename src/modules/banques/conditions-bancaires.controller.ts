import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { RoleUtilisateur } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { LicenceGuard } from '../licence/licence.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthenticatedUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { ConditionsBancairesService } from './conditions-bancaires.service';
import { AutorisationFinancementDto, ConditionsBancairesDto, LectureConditionsDto, UnionComptesBancairesDto } from './dto/conditions-bancaires.dto';

/**
 * CONDITIONS BANCAIRES, AUTORISATIONS, UNIONS (ligne sage-l3, fonction 46) ·
 * des STRUCTURES, comme les banques et leurs RIB · lues par tous, écrites par
 * l'administrateur seul. Rien n'y passe au journal.
 */
@UseGuards(JwtAuthGuard, LicenceGuard, RolesGuard)
@Controller('conditions-bancaires')
export class ConditionsBancairesController {
  constructor(private readonly service: ConditionsBancairesService) {}

  @Get()
  lister(@CurrentUser() user: AuthenticatedUser, @Query() q: LectureConditionsDto) {
    if (q.au) {
      const t = Date.parse(`${q.au}T00:00:00.000Z`);
      if (Number.isNaN(t) || new Date(t).toISOString().slice(0, 10) !== q.au) throw new BadRequestException('La date de lecture doit être un jour (AAAA-MM-JJ).');
    }
    return this.service.lister(user.tenantId, q.au);
  }

  @Roles(RoleUtilisateur.ADMIN_CABINET)
  @Post('ribs/:ribId/conditions')
  declarerConditions(@CurrentUser() user: AuthenticatedUser, @Param('ribId') ribId: string, @Body() dto: ConditionsBancairesDto) {
    return this.service.declarerConditions(user.tenantId, user.userId, ribId, dto);
  }

  @Roles(RoleUtilisateur.ADMIN_CABINET)
  @Delete('conditions/:id')
  retirerConditions(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.service.retirerConditions(user.tenantId, id);
  }

  @Roles(RoleUtilisateur.ADMIN_CABINET)
  @Post('ribs/:ribId/autorisations')
  declarerAutorisation(@CurrentUser() user: AuthenticatedUser, @Param('ribId') ribId: string, @Body() dto: AutorisationFinancementDto) {
    return this.service.declarerAutorisation(user.tenantId, user.userId, ribId, dto);
  }

  @Roles(RoleUtilisateur.ADMIN_CABINET)
  @Delete('autorisations/:id')
  retirerAutorisation(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.service.retirerAutorisation(user.tenantId, id);
  }

  @Roles(RoleUtilisateur.ADMIN_CABINET)
  @Post('unions')
  creerUnion(@CurrentUser() user: AuthenticatedUser, @Body() dto: UnionComptesBancairesDto) {
    return this.service.creerUnion(user.tenantId, dto);
  }

  @Roles(RoleUtilisateur.ADMIN_CABINET)
  @Patch('unions/:id')
  modifierUnion(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: UnionComptesBancairesDto) {
    return this.service.modifierUnion(user.tenantId, id, dto);
  }

  @Roles(RoleUtilisateur.ADMIN_CABINET)
  @Delete('unions/:id')
  supprimerUnion(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.service.supprimerUnion(user.tenantId, id);
  }
}
