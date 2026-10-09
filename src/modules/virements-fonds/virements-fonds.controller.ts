import { Body, Controller, Get, Param, Post, Query, Res, UploadedFile, UseFilters, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { RoleUtilisateur } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { LicenceGuard } from '../licence/licence.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { ReserveAuComptable } from '../../common/decorators/acces-roles-cantonnes.decorator';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { EXERCICE_REQUIS } from '../../common/exercice-requis';
import { RefusEnvoi } from '../tiers/documents-tiers.controller';
import { TAILLE_MAX_DOCUMENT, dispositionTelechargement } from '../tiers/documents-tiers';
import { VirementsFondsService } from './virements-fonds.service';
import { AnnulerVirementDto, CreerVirementDto } from './virements-fonds.dto';

/**
 * VIREMENT DE FONDS · Traitement > Tiers et trésorerie. Consultation ouverte
 * aux rôles du dossier ; le virement est une SAISIE (deux pièces au journal),
 * passé par le cabinet (admin et comptable) ; son annulation contre-passe des
 * pièces, geste du comptable (`@ReserveAuComptable`, comme la correction).
 */
@UseGuards(JwtAuthGuard, LicenceGuard, RolesGuard)
@Controller()
export class VirementsFondsController {
  constructor(private readonly virements: VirementsFondsService) {}

  @Get('virements-fonds')
  lister(@CurrentUser() user: AuthenticatedUser, @Query('exerciceId', EXERCICE_REQUIS) exerciceId: string) {
    return this.virements.lister(user.tenantId, exerciceId);
  }

  @Roles(RoleUtilisateur.ADMIN_CABINET, RoleUtilisateur.COMPTABLE)
  @Post('virements-fonds')
  creer(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreerVirementDto) {
    return this.virements.creer(user.tenantId, user.userId, dto);
  }

  @Roles(RoleUtilisateur.ADMIN_CABINET, RoleUtilisateur.COMPTABLE)
  @ReserveAuComptable()
  @Post('virements-fonds/:id/annuler')
  annuler(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: AnnulerVirementDto) {
    return this.virements.annuler(user.tenantId, user.userId, id, dto);
  }

  @Roles(RoleUtilisateur.ADMIN_CABINET, RoleUtilisateur.COMPTABLE)
  @Post('virements-fonds/:id/pieces')
  @UseFilters(RefusEnvoi)
  // Sans `dest` ni `storage`, multer garde le fichier EN MÉMOIRE · rien n'est
  // écrit sur le disque du conteneur, qui n'est pas persistant.
  @UseInterceptors(FileInterceptor('fichier', { limits: { fileSize: TAILLE_MAX_DOCUMENT, files: 1, fields: 2 } }))
  deposerPiece(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @UploadedFile() fichier: { originalname: string; buffer: Buffer } | undefined,
  ) {
    return this.virements.deposerPiece(user.tenantId, id, fichier, user.email);
  }

  @Get('pieces-virement-fonds/:id/fichier')
  async telechargerPiece(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Res() res: Response) {
    const piece = await this.virements.telechargerPiece(user.tenantId, id);
    res.set({
      'Content-Type': piece.typeMime,
      'Content-Disposition': dispositionTelechargement(piece.nomFichier),
      'X-Content-Type-Options': 'nosniff',
      'Access-Control-Expose-Headers': 'Content-Disposition',
    });
    res.send(Buffer.from(piece.contenu));
  }
}
