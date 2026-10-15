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
import { REGLE_PIECES_SECTION } from './pieces-jointes-section';

/**
 * LES DOCUMENTS DES SECTIONS ANALYTIQUES (ligne sage-l6, fonction n° 22),
 * dans Structure > Plans analytiques. Consultation ouverte comme les
 * sections ; dépôt, commentaire et retrait au cabinet qui tient le dossier
 * (admin et comptable) · joindre une convention est un geste courant, comme
 * la ventilation, pas une modification de la structure du plan.
 */
@UseGuards(JwtAuthGuard, LicenceGuard, RolesGuard)
@Controller()
export class PiecesJointesSectionController {
  constructor(private readonly pieces: PiecesJointesService) {}

  @Get('analytique/sections/:sectionId/pieces-jointes')
  lister(@CurrentUser() user: AuthenticatedUser, @Param('sectionId') sectionId: string) {
    return this.pieces.lister(user.tenantId, REGLE_PIECES_SECTION, sectionId);
  }

  @Roles(RoleUtilisateur.ADMIN_CABINET, RoleUtilisateur.COMPTABLE)
  @Post('analytique/sections/:sectionId/pieces-jointes')
  @RecevoirUnePiece()
  deposer(
    @CurrentUser() user: AuthenticatedUser,
    @Param('sectionId') sectionId: string,
    @UploadedFile() fichier: FichierRecu | undefined,
    @Body() dto: DeposerPieceJointeDto,
  ) {
    return this.pieces.deposer(user.tenantId, REGLE_PIECES_SECTION, sectionId, fichier, dto.commentaire, user.email);
  }

  @Get('pieces-jointes-sections/:id/fichier')
  async telecharger(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Res() res: Response) {
    servirLaPiece(res, await this.pieces.telecharger(user.tenantId, 'SECTION', id));
  }

  @Roles(RoleUtilisateur.ADMIN_CABINET, RoleUtilisateur.COMPTABLE)
  @Patch('pieces-jointes-sections/:id')
  commenter(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: CommentairePieceJointeDto) {
    return this.pieces.modifierCommentaire(user.tenantId, 'SECTION', id, dto.commentaire);
  }

  @Roles(RoleUtilisateur.ADMIN_CABINET, RoleUtilisateur.COMPTABLE)
  @Delete('pieces-jointes-sections/:id')
  retirer(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.pieces.retirer(user.tenantId, REGLE_PIECES_SECTION, id);
  }
}
