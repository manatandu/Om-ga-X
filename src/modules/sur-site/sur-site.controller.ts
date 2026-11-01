import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { RoleUtilisateur } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { normaliserCourriel } from '../../common/courriel';
import { AuthService } from '../auth/auth.service';
import { RegisterDto } from '../auth/dto/register.dto';
import { AdministrateurInstallationGuard } from './administrateur-installation.guard';
import { LicenceSurSiteService } from './licence-sur-site.service';
import { SauvegardeSurSiteService } from './sauvegarde-sur-site.service';
import { CopieExterneDto, DeposerLicenceDto, ReinitialiserCompteSurSiteDto } from './sur-site.dto';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';

/**
 * L'INSTALLATION SUR SITE · deux routes publiques et deux réservées.
 *
 * L'état et le dépôt de la licence sont PUBLICS, et c'est voulu : à la
 * première installation aucun compte n'existe, et c'est l'écran d'ouverture
 * qui montre l'empreinte du poste puis reçoit le fichier. Rien de ce qu'ils
 * rendent n'est une donnée d'un dossier.
 *
 * Les sauvegardes, elles, sont réservées à l'administrateur du DOSSIER
 * D'INSTALLATION (audit final F44) · une copie est la base de tous les
 * dossiers du poste, et le rôle d'administrateur d'un seul ne suffit pas.
 * Elles ne sont PAS derrière `LicenceGuard` · une licence expirée ne doit
 * jamais empêcher un client de sauvegarder ses propres données. Même parti
 * que la restitution du dossier. La création des dossiers suivants passe par
 * la même porte, l'inscription publique ne servant qu'au premier.
 */
@Controller('sur-site')
export class SurSiteController {
  constructor(
    private readonly licence: LicenceSurSiteService,
    private readonly sauvegardes: SauvegardeSurSiteService,
    private readonly auth: AuthService,
  ) {}

  @Get('etat')
  async etat() {
    const e = this.licence.etat();
    if (!e.surSite) return { surSite: false };
    const c = e.contenu;
    return {
      surSite: true,
      // L'écran d'ouverture ne propose la création qu'au poste neuf · le
      // serveur la refuse de toute façon ensuite (audit final F44).
      premierDossierAttendu: await this.auth.premierDossierAttendu(),
      statut: e.statut,
      motif: e.motif,
      empreinte: e.empreinte,
      dateVersion: e.dateVersion,
      licence: c
        ? { numero: c.numero, titulaire: c.titulaire, emiseLe: c.emiseLe, finMaintenance: c.finMaintenance, expiration: c.expiration, dossiersMax: c.dossiersMax }
        : null,
    };
  }

  @Throttle({ default: { ttl: 3_600_000, limit: 20 } })
  @Post('licence')
  async deposer(@Body() dto: DeposerLicenceDto) {
    this.licence.deposer(dto.contenu);
    return this.etat();
  }

  @UseGuards(JwtAuthGuard, RolesGuard, AdministrateurInstallationGuard)
  @Roles(RoleUtilisateur.ADMIN_CABINET)
  @Get('sauvegardes')
  lister() {
    return { dossier: this.sauvegardes.dossier, copies: this.sauvegardes.lister(), copieExterne: this.sauvegardes.copieExterne() };
  }

  @UseGuards(JwtAuthGuard, RolesGuard, AdministrateurInstallationGuard)
  @Roles(RoleUtilisateur.ADMIN_CABINET)
  @Post('sauvegardes/copie-externe')
  copieExterne(@Body() dto: CopieExterneDto) {
    return this.sauvegardes.definirCopieExterne(dto.dossier ?? null, dto.phrase ?? null);
  }

  @UseGuards(JwtAuthGuard, RolesGuard, AdministrateurInstallationGuard)
  @Roles(RoleUtilisateur.ADMIN_CABINET)
  @Post('sauvegardes')
  sauvegarder() {
    return this.sauvegardes.lancer();
  }

  /**
   * Un dossier de plus sur l'installation · par le même pipeline que
   * l'inscription (plafond de la licence compris), mais SANS session · celui
   * qui le crée reste dans son dossier, et le jeton du nouvel administrateur
   * ne lui est jamais rendu.
   */
  /**
   * RÉINITIALISER UN COMPTE DU POSTE (ligne multi-dossiers, second tour,
   * BLOQUANT 1) · sur site, aucun opérateur de la plateforme · l'administrateur
   * de l'installation, qui tient le poste et sa base, en tient lieu ·
   * mot de passe tiré au sort, second facteur levé, sessions fermées. Avec une
   * messagerie, le mot de passe part au seul titulaire ; sans elle, il est
   * rendu ICI, à lui seul, qui le remet en main propre (`AuthService`).
   */
  @Throttle({ default: { ttl: 3_600_000, limit: 30 } })
  @UseGuards(JwtAuthGuard, RolesGuard, AdministrateurInstallationGuard)
  @Roles(RoleUtilisateur.ADMIN_CABINET)
  @Post('comptes/reinitialiser')
  reinitialiserCompte(@CurrentUser() user: AuthenticatedUser, @Body() dto: ReinitialiserCompteSurSiteDto) {
    return this.auth.reinitialiserCompteSurSite(dto.email, user.userId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard, AdministrateurInstallationGuard)
  @Roles(RoleUtilisateur.ADMIN_CABINET)
  @Post('dossiers')
  async creerDossier(@Body() dto: RegisterDto) {
    const r = await this.auth.register(dto);
    return { dossier: r.tenant.nom, email: normaliserCourriel(dto.email) };
  }
}
