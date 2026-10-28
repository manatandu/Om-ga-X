import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { RoleUtilisateur } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { LicenceGuard } from '../licence/licence.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { ReserveAuComptable } from '../../common/decorators/acces-roles-cantonnes.decorator';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { COMPTE_FACULTATIF } from '../../common/compte-du-dossier';
import { ArretesCaisseService } from './arretes-caisse.service';
import { AnnulerArreteCaisseDto, CreerPlafondEncaisseDto, EtablirArreteCaisseDto } from './dto/arrete-caisse.dto';

/**
 * ARRÊTÉ DE CAISSE ET PLAFOND D'ENCAISSE (ligne microfina-m2, idée 5) ·
 * OUVERTS AUX DEUX RÉFÉRENTIELS · la fiche du compte 57 est la même dans les
 * deux plans, et ses éléments de contrôle (« procès-verbaux de caisse […]
 * bordereaux de situation journalière ») aussi. Établir un arrêté est un acte
 * de saisie ; l'annuler est réservé au comptable ; le plafond est une
 * structure du dossier, à l'administrateur.
 */
@UseGuards(JwtAuthGuard, LicenceGuard, RolesGuard)
@Controller('caisses')
export class ArretesCaisseController {
  constructor(private readonly arretes: ArretesCaisseService) {}

  @Get('situation')
  situation(@CurrentUser() user: AuthenticatedUser, @Query('jour') jour: string) {
    return this.arretes.situation(user.tenantId, jour ?? '');
  }

  @Get('arretes')
  lister(@CurrentUser() user: AuthenticatedUser, @Query('compteId', COMPTE_FACULTATIF) compteId?: string) {
    return this.arretes.lister(user.tenantId, compteId);
  }

  @Get('arretes/apercu')
  apercu(@CurrentUser() user: AuthenticatedUser, @Query('compteId') compteId: string, @Query('jour') jour: string) {
    return this.arretes.apercu(user.tenantId, compteId ?? '', jour ?? '');
  }

  @Post('arretes')
  @Roles(RoleUtilisateur.ADMIN_CABINET, RoleUtilisateur.COMPTABLE)
  etablir(@CurrentUser() user: AuthenticatedUser, @Body() dto: EtablirArreteCaisseDto) {
    return this.arretes.etablir(user.tenantId, user.userId, dto);
  }

  @Post('arretes/:id/annulation')
  @Roles(RoleUtilisateur.ADMIN_CABINET, RoleUtilisateur.COMPTABLE)
  @ReserveAuComptable()
  annuler(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: AnnulerArreteCaisseDto) {
    return this.arretes.annuler(user.tenantId, user.userId, id, dto);
  }

  @Get('plafonds')
  plafonds(@CurrentUser() user: AuthenticatedUser, @Query('compteId') compteId: string) {
    return this.arretes.listerPlafonds(user.tenantId, compteId ?? '');
  }

  @Post('plafonds')
  @Roles(RoleUtilisateur.ADMIN_CABINET)
  creerPlafond(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreerPlafondEncaisseDto) {
    return this.arretes.creerPlafond(user.tenantId, user.userId, dto);
  }

  @Delete('plafonds/:id')
  @Roles(RoleUtilisateur.ADMIN_CABINET)
  retirerPlafond(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.arretes.retirerPlafond(user.tenantId, id);
  }
}
