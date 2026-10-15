import { Body, Controller, Delete, Get, Param, Patch, Post, Res, UploadedFile, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { RoleUtilisateur } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { LicenceGuard } from '../licence/licence.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { AccesRolesCantonnes } from '../../common/decorators/acces-roles-cantonnes.decorator';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { PiecesJointesService, type FichierRecu } from '../../common/pieces-jointes/pieces-jointes.service';
import { RecevoirUnePiece, servirLaPiece } from '../../common/pieces-jointes/recevoir-une-piece';
import { CommentairePieceJointeDto, DeposerPieceJointeDto } from '../../common/pieces-jointes/pieces-jointes.dto';
import { REGLE_PIECES_SALARIE } from './pieces-jointes-salarie';

/**
 * LES DOCUMENTS DE LA FICHE D'UN SALARIÉ (ligne sage-l6, fonction n° 22), dans
 * le registre du personnel. AUX DROITS DU REGISTRE · données nominatives
 * (contrat, pièce d'identité, certificat), le module du gestionnaire de paie,
 * fermé à l'aide-comptable (voir `roles-cantonnes.ts`) ; lecture au réviseur
 * comme le registre, dépôt, commentaire et retrait au cabinet qui le tient.
 */
@AccesRolesCantonnes({ aideComptable: false, gestionnairePaie: true })
@UseGuards(JwtAuthGuard, LicenceGuard, RolesGuard)
@Controller('personnel')
export class PiecesJointesSalarieController {
  constructor(private readonly pieces: PiecesJointesService) {}

  @Get('salaries/:salarieId/pieces-jointes')
  @Roles(RoleUtilisateur.ADMIN_CABINET, RoleUtilisateur.COMPTABLE, RoleUtilisateur.LECTURE_SEULE)
  lister(@CurrentUser() user: AuthenticatedUser, @Param('salarieId') salarieId: string) {
    return this.pieces.lister(user.tenantId, REGLE_PIECES_SALARIE, salarieId);
  }

  @Post('salaries/:salarieId/pieces-jointes')
  @Roles(RoleUtilisateur.ADMIN_CABINET, RoleUtilisateur.COMPTABLE)
  @RecevoirUnePiece()
  deposer(
    @CurrentUser() user: AuthenticatedUser,
    @Param('salarieId') salarieId: string,
    @UploadedFile() fichier: FichierRecu | undefined,
    @Body() dto: DeposerPieceJointeDto,
  ) {
    return this.pieces.deposer(user.tenantId, REGLE_PIECES_SALARIE, salarieId, fichier, dto.commentaire, user.email);
  }

  @Get('pieces-jointes/:id/fichier')
  @Roles(RoleUtilisateur.ADMIN_CABINET, RoleUtilisateur.COMPTABLE, RoleUtilisateur.LECTURE_SEULE)
  async telecharger(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Res() res: Response) {
    servirLaPiece(res, await this.pieces.telecharger(user.tenantId, 'SALARIE', id));
  }

  @Patch('pieces-jointes/:id')
  @Roles(RoleUtilisateur.ADMIN_CABINET, RoleUtilisateur.COMPTABLE)
  commenter(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: CommentairePieceJointeDto) {
    return this.pieces.modifierCommentaire(user.tenantId, 'SALARIE', id, dto.commentaire);
  }

  @Delete('pieces-jointes/:id')
  @Roles(RoleUtilisateur.ADMIN_CABINET, RoleUtilisateur.COMPTABLE)
  retirer(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.pieces.retirer(user.tenantId, REGLE_PIECES_SALARIE, id);
  }
}
