import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';
import { RoleUtilisateur } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { LicenceGuard } from '../licence/licence.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { ArticlesCommerciauxService } from './articles.service';
import {
  CreerArticleCommercialDto,
  ListerArticlesDto,
  ModifierArticleCommercialDto,
  PoserTarifClientDto,
  PropositionPrixDto,
} from './dto/articles.dto';

/**
 * ARTICLES ET TARIFS (ligne commercial-l8, étape a) · une STRUCTURE, ouverte
 * aux deux référentiels · une association peut vendre « à titre accessoire »
 * (loi n° 004/2001, art. 1er) et achète comme tout le monde, et l'article ne
 * porte qu'un compte de la classe que chaque plan fixe. Tenue par
 * l'administrateur et le comptable, comme les fiches du magasin ; la lecture
 * est ouverte. MASQUER N'EST PAS REFUSER (`tenant/modules-optionnels.ts`,
 * décision de Manasse du 2026-09-28) · le menu ne montre ces fenêtres qu'au
 * dossier qui a activé la gestion commerciale, la route reste ouverte comme
 * celles des devis et du magasin.
 */
@UseGuards(JwtAuthGuard, LicenceGuard, RolesGuard)
@Controller('commercial')
export class ArticlesCommerciauxController {
  constructor(private readonly articles: ArticlesCommerciauxService) {}

  @Get('articles')
  lister(@CurrentUser() user: AuthenticatedUser, @Query() q: ListerArticlesDto) {
    return this.articles.lister(user.tenantId, q);
  }

  // DÉCLARÉE AVANT `articles/:id` · Express prend la première route qui
  // correspond, et « proposition-prix » se lirait comme un identifiant.
  @Get('articles-proposition-prix')
  proposition(@CurrentUser() user: AuthenticatedUser, @Query() q: PropositionPrixDto) {
    return this.articles.propositionPrix(user.tenantId, q.articleId, q.tiersId, q.sens ?? 'VENTE');
  }

  @Get('articles/:id')
  lire(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.articles.lire(user.tenantId, id);
  }

  @Post('articles')
  @Roles(RoleUtilisateur.ADMIN_CABINET, RoleUtilisateur.COMPTABLE)
  creer(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreerArticleCommercialDto) {
    return this.articles.creer(user.tenantId, user.userId, dto);
  }

  @Patch('articles/:id')
  @Roles(RoleUtilisateur.ADMIN_CABINET, RoleUtilisateur.COMPTABLE)
  modifier(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: ModifierArticleCommercialDto) {
    return this.articles.modifier(user.tenantId, id, dto);
  }

  @Delete('articles/:id')
  @Roles(RoleUtilisateur.ADMIN_CABINET, RoleUtilisateur.COMPTABLE)
  supprimer(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.articles.supprimer(user.tenantId, id);
  }

  @Get('articles/:id/tarifs')
  tarifs(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.articles.tarifsDeLArticle(user.tenantId, id);
  }

  @Put('tarifs')
  @Roles(RoleUtilisateur.ADMIN_CABINET, RoleUtilisateur.COMPTABLE)
  poserTarif(@CurrentUser() user: AuthenticatedUser, @Body() dto: PoserTarifClientDto) {
    return this.articles.poserTarif(user.tenantId, user.userId, dto);
  }

  @Delete('tarifs/:id')
  @Roles(RoleUtilisateur.ADMIN_CABINET, RoleUtilisateur.COMPTABLE)
  retirerTarif(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.articles.retirerTarif(user.tenantId, id);
  }
}
