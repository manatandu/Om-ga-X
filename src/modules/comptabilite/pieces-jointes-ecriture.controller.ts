import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Res, UploadedFile, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { RoleUtilisateur } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { LicenceGuard } from '../licence/licence.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { EXERCICE_REQUIS } from '../../common/exercice-requis';
import { PiecesJointesService, type FichierRecu } from '../../common/pieces-jointes/pieces-jointes.service';
import { RecevoirUnePiece, servirLaPiece } from '../../common/pieces-jointes/recevoir-une-piece';
import { CommentairePieceJointeDto, DeposerPieceJointeDto } from '../../common/pieces-jointes/pieces-jointes.dto';
import { REGLE_PIECES_ECRITURE } from './pieces-jointes-ecriture';

/**
 * LES PIÈCES JUSTIFICATIVES DES ÉCRITURES (ligne sage-l6, fonction n° 22),
 * ouvertes depuis la saisie et depuis le journal. Lecture ouverte aux rôles
 * qui lisent les écritures ; dépôt, commentaire et retrait au cabinet qui
 * saisit (admin et comptable, l'aide-comptable compris, qui saisit aussi) ·
 * ce que la pièce permet (déposer, retirer) est jugé par sa règle
 * (`pieces-jointes-ecriture.ts`), jamais par le rôle.
 */
@UseGuards(JwtAuthGuard, LicenceGuard, RolesGuard)
@Controller()
export class PiecesJointesEcritureController {
  constructor(private readonly pieces: PiecesJointesService) {}

  @Get('ecritures/:ecritureId/pieces-jointes')
  lister(@CurrentUser() user: AuthenticatedUser, @Param('ecritureId') ecritureId: string) {
    return this.pieces.lister(user.tenantId, REGLE_PIECES_ECRITURE, ecritureId);
  }

  @Roles(RoleUtilisateur.ADMIN_CABINET, RoleUtilisateur.COMPTABLE)
  @Post('ecritures/:ecritureId/pieces-jointes')
  @RecevoirUnePiece()
  deposer(
    @CurrentUser() user: AuthenticatedUser,
    @Param('ecritureId') ecritureId: string,
    @UploadedFile() fichier: FichierRecu | undefined,
    @Body() dto: DeposerPieceJointeDto,
  ) {
    return this.pieces.deposer(user.tenantId, REGLE_PIECES_ECRITURE, ecritureId, fichier, dto.commentaire, user.email);
  }

  /** Les pièces d'écritures retirées au brouillard, gardées détachées. */
  @Get('pieces-jointes-ecritures/detachees')
  detachees(@CurrentUser() user: AuthenticatedUser) {
    return this.pieces.listerDetachees(user.tenantId);
  }

  /** Combien de pièces porte chaque écriture de l'exercice · pour la saisie et le journal. */
  @Get('pieces-jointes-ecritures/decompte')
  decompte(@CurrentUser() user: AuthenticatedUser, @Query('exerciceId', EXERCICE_REQUIS) exerciceId: string) {
    return this.pieces.decompteParEcriture(user.tenantId, exerciceId);
  }

  @Get('pieces-jointes-ecritures/:id/fichier')
  async telecharger(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Res() res: Response) {
    servirLaPiece(res, await this.pieces.telecharger(user.tenantId, 'ECRITURE', id));
  }

  @Roles(RoleUtilisateur.ADMIN_CABINET, RoleUtilisateur.COMPTABLE)
  @Patch('pieces-jointes-ecritures/:id')
  commenter(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: CommentairePieceJointeDto) {
    return this.pieces.modifierCommentaire(user.tenantId, 'ECRITURE', id, dto.commentaire);
  }

  @Roles(RoleUtilisateur.ADMIN_CABINET, RoleUtilisateur.COMPTABLE)
  @Delete('pieces-jointes-ecritures/:id')
  retirer(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.pieces.retirer(user.tenantId, REGLE_PIECES_ECRITURE, id);
  }
}
