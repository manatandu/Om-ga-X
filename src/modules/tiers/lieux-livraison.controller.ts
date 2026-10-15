import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { RoleUtilisateur } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { LicenceGuard } from '../licence/licence.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthenticatedUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { LieuxLivraisonService } from './lieux-livraison.service';
import { LieuLivraisonDto } from './dto/lieux-livraison.dto';

/**
 * Le volet « Lieux de livraison » de la fiche d'un client (ligne sage-l2,
 * fonction 31). Lu par tous, comme la fiche ; écrit par l'administrateur
 * seul, comme la structure du tiers et ses RIB.
 */
@UseGuards(JwtAuthGuard, LicenceGuard, RolesGuard)
@Controller()
export class LieuxLivraisonController {
  constructor(private readonly lieux: LieuxLivraisonService) {}

  @Get('tiers/:tiersId/lieux-livraison')
  lister(@CurrentUser() user: AuthenticatedUser, @Param('tiersId', ParseUUIDPipe) tiersId: string) {
    return this.lieux.lister(user.tenantId, tiersId);
  }

  @Roles(RoleUtilisateur.ADMIN_CABINET)
  @Post('tiers/:tiersId/lieux-livraison')
  creer(@CurrentUser() user: AuthenticatedUser, @Param('tiersId', ParseUUIDPipe) tiersId: string, @Body() dto: LieuLivraisonDto) {
    return this.lieux.creer(user.tenantId, tiersId, dto);
  }

  @Roles(RoleUtilisateur.ADMIN_CABINET)
  @Patch('lieux-livraison/:id')
  modifier(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: LieuLivraisonDto) {
    return this.lieux.modifier(user.tenantId, id, dto);
  }

  @Roles(RoleUtilisateur.ADMIN_CABINET)
  @Delete('lieux-livraison/:id')
  supprimer(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.lieux.supprimer(user.tenantId, id);
  }
}
