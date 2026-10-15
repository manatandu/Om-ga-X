import { Body, Controller, Delete, Get, Param, Patch, Post, Res, UploadedFile, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { RoleUtilisateur } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { LicenceGuard } from '../licence/licence.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { PiecesJointesService, type FichierRecu } from '../../common/pieces-jointes/pieces-jointes.service';
import { RecevoirUnePiece, servirLaPiece } from '../../common/pieces-jointes/recevoir-une-piece';
import { CommentairePieceJointeDto, DeposerPieceJointeDto } from '../../common/pieces-jointes/pieces-jointes.dto';
import { REGLE_PIECES_IMMOBILISATION } from './pieces-jointes-immobilisation';

/**
 * LES DOCUMENTS DE LA FICHE D'UN BIEN (ligne sage-l6, fonction n° 22), sur la
 * fiche, dans Structure > Immobilisations. Consultation ouverte comme la
 * fiche ; dépôt, commentaire et retrait au cabinet (admin et comptable),
 * comme les autres gestes de la fiche.
 */
@UseGuards(JwtAuthGuard, LicenceGuard, RolesGuard)
@Controller()
export class PiecesJointesImmobilisationController {
  constructor(private readonly pieces: PiecesJointesService) {}

  @Get('immobilisations/:immobilisationId/pieces-jointes')
  lister(@CurrentUser() user: AuthenticatedUser, @Param('immobilisationId') immobilisationId: string) {
    return this.pieces.lister(user.tenantId, REGLE_PIECES_IMMOBILISATION, immobilisationId);
  }

  @Roles(RoleUtilisateur.ADMIN_CABINET, RoleUtilisateur.COMPTABLE)
  @Post('immobilisations/:immobilisationId/pieces-jointes')
  @RecevoirUnePiece()
  deposer(
    @CurrentUser() user: AuthenticatedUser,
    @Param('immobilisationId') immobilisationId: string,
    @UploadedFile() fichier: FichierRecu | undefined,
    @Body() dto: DeposerPieceJointeDto,
  ) {
    return this.pieces.deposer(user.tenantId, REGLE_PIECES_IMMOBILISATION, immobilisationId, fichier, dto.commentaire, user.email);
  }

  @Get('pieces-jointes-immobilisations/:id/fichier')
  async telecharger(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Res() res: Response) {
    servirLaPiece(res, await this.pieces.telecharger(user.tenantId, 'IMMOBILISATION', id));
  }

  @Roles(RoleUtilisateur.ADMIN_CABINET, RoleUtilisateur.COMPTABLE)
  @Patch('pieces-jointes-immobilisations/:id')
  commenter(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: CommentairePieceJointeDto) {
    return this.pieces.modifierCommentaire(user.tenantId, 'IMMOBILISATION', id, dto.commentaire);
  }

  @Roles(RoleUtilisateur.ADMIN_CABINET, RoleUtilisateur.COMPTABLE)
  @Delete('pieces-jointes-immobilisations/:id')
  retirer(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.pieces.retirer(user.tenantId, REGLE_PIECES_IMMOBILISATION, id);
  }
}
