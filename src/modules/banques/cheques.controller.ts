import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { RoleUtilisateur } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { LicenceGuard } from '../licence/licence.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { ReserveAuComptable } from '../../common/decorators/acces-roles-cantonnes.decorator';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { ChequesService } from './cheques.service';
import { AnnulerChequeDto, AnnulerNumeroDto, CreerChequierDto, EmettreChequeDto, RattacherPieceChequeDto } from './dto/cheques.dto';

/**
 * REGISTRE DES CHÈQUES ÉMIS (ligne microfina-m2, idée 9) · ouvert aux deux
 * référentiels (un chèque se tire de la même façon, et les souches font pièce
 * partout · CPCC, ch. 1 § 1.1.1). Le carnet reçu et l'émission suivent les
 * droits d'écriture ; l'annulation d'un chèque émis est réservée au comptable
 * (elle délie une pièce de paiement).
 */
@UseGuards(JwtAuthGuard, LicenceGuard, RolesGuard)
@Controller('cheques')
export class ChequesController {
  constructor(private readonly cheques: ChequesService) {}

  @Get('chequiers')
  chequiers(@CurrentUser() user: AuthenticatedUser) {
    return this.cheques.listerChequiers(user.tenantId);
  }

  @Post('chequiers')
  @Roles(RoleUtilisateur.ADMIN_CABINET, RoleUtilisateur.COMPTABLE)
  creerChequier(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreerChequierDto) {
    return this.cheques.creerChequier(user.tenantId, user.userId, dto);
  }

  @Delete('chequiers/:id')
  @Roles(RoleUtilisateur.ADMIN_CABINET, RoleUtilisateur.COMPTABLE)
  supprimerChequier(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.cheques.supprimerChequier(user.tenantId, id);
  }

  @Get()
  lister(@CurrentUser() user: AuthenticatedUser, @Query('chequierId') chequierId?: string, @Query('au') au?: string) {
    return this.cheques.lister(user.tenantId, chequierId || undefined, au || undefined);
  }

  @Get('chequiers/:id/pieces-proposees')
  piecesProposees(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Query('recherche') recherche?: string) {
    return this.cheques.piecesProposees(user.tenantId, id, recherche);
  }

  @Post()
  @Roles(RoleUtilisateur.ADMIN_CABINET, RoleUtilisateur.COMPTABLE)
  emettre(@CurrentUser() user: AuthenticatedUser, @Body() dto: EmettreChequeDto) {
    return this.cheques.emettre(user.tenantId, user.userId, dto);
  }

  @Patch(':id/piece')
  @Roles(RoleUtilisateur.ADMIN_CABINET, RoleUtilisateur.COMPTABLE)
  rattacherPiece(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: RattacherPieceChequeDto) {
    return this.cheques.rattacherPiece(user.tenantId, id, dto);
  }

  // DÉCLARÉE AVANT `:id/annulation` · Express prend la première route qui
  // correspond, et `numeros/annulation` se lisait comme l'annulation du
  // chèque d'identifiant « numeros » (vu sur vraie base, refus 400 du corps).
  @Post('numeros/annulation')
  @Roles(RoleUtilisateur.ADMIN_CABINET, RoleUtilisateur.COMPTABLE)
  annulerNumero(@CurrentUser() user: AuthenticatedUser, @Body() dto: AnnulerNumeroDto) {
    return this.cheques.annulerNumero(user.tenantId, user.userId, dto);
  }

  @Post(':id/annulation')
  @Roles(RoleUtilisateur.ADMIN_CABINET, RoleUtilisateur.COMPTABLE)
  @ReserveAuComptable()
  annuler(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: AnnulerChequeDto) {
    return this.cheques.annuler(user.tenantId, user.userId, id, dto);
  }
}
