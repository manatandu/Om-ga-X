import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { RoleUtilisateur } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { LicenceGuard } from '../licence/licence.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthenticatedUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { AccesRolesCantonnes } from '../../common/decorators/acces-roles-cantonnes.decorator';
import { SuiviPersonnelService } from './suivi-personnel.service';
import {
  AccordDemandeCongeDto,
  AnnulationFormationDto,
  DemandeCongeDto,
  EcheancierDto,
  FormationDto,
  ParticipantsFormationDto,
  RealisationFormationDto,
  RefusDemandeCongeDto,
  ReparationDemandeCongeDto,
} from './dto/suivi-personnel.dto';

/**
 * LIGNE MICROFINA-M3, LOT 2 · demandes de congé, échéancier des contrats,
 * formation, déclaration annuelle de la main-d'œuvre · mêmes droits que le
 * registre du personnel (fermé à l'aide-comptable, ouvert au gestionnaire de
 * paie).
 */
@AccesRolesCantonnes({ aideComptable: false, gestionnairePaie: true })
@UseGuards(JwtAuthGuard, LicenceGuard, RolesGuard)
@Controller('personnel')
export class SuiviPersonnelController {
  constructor(private readonly service: SuiviPersonnelService) {}

  @Get('demandes-conge')
  @Roles(RoleUtilisateur.ADMIN_CABINET, RoleUtilisateur.COMPTABLE, RoleUtilisateur.LECTURE_SEULE)
  listerDemandes(@CurrentUser() user: AuthenticatedUser, @Query('salarieId') salarieId?: string) {
    return this.service.listerDemandes(user.tenantId, salarieId || undefined);
  }

  @Post('salaries/:salarieId/demandes-conge')
  @Roles(RoleUtilisateur.ADMIN_CABINET, RoleUtilisateur.COMPTABLE)
  creerDemande(@CurrentUser() user: AuthenticatedUser, @Param('salarieId') salarieId: string, @Body() dto: DemandeCongeDto) {
    return this.service.creerDemande(user.tenantId, user.email, salarieId, dto);
  }

  @Post('demandes-conge/:id/accord')
  @Roles(RoleUtilisateur.ADMIN_CABINET, RoleUtilisateur.COMPTABLE)
  accorder(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: AccordDemandeCongeDto) {
    return this.service.accorder(user.tenantId, user.email, id, dto);
  }

  @Post('demandes-conge/:id/reparation')
  @Roles(RoleUtilisateur.ADMIN_CABINET, RoleUtilisateur.COMPTABLE)
  reparer(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: ReparationDemandeCongeDto) {
    return this.service.reparerDemandeSansConge(user.tenantId, user.email, id, dto);
  }

  @Post('demandes-conge/:id/refus')
  @Roles(RoleUtilisateur.ADMIN_CABINET, RoleUtilisateur.COMPTABLE)
  refuser(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: RefusDemandeCongeDto) {
    return this.service.refuser(user.tenantId, user.email, id, dto);
  }

  @Post('demandes-conge/:id/retrait')
  @Roles(RoleUtilisateur.ADMIN_CABINET, RoleUtilisateur.COMPTABLE)
  retirer(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: RefusDemandeCongeDto) {
    return this.service.retirer(user.tenantId, user.email, id, dto);
  }

  @Get('demandes-conge/:id/titre')
  @Roles(RoleUtilisateur.ADMIN_CABINET, RoleUtilisateur.COMPTABLE, RoleUtilisateur.LECTURE_SEULE)
  titre(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.service.titre(user.tenantId, id);
  }

  @Get('echeancier-contrats')
  @Roles(RoleUtilisateur.ADMIN_CABINET, RoleUtilisateur.COMPTABLE, RoleUtilisateur.LECTURE_SEULE)
  echeancier(@CurrentUser() user: AuthenticatedUser, @Query() q: EcheancierDto) {
    return this.service.echeancier(user.tenantId, q.horizon);
  }

  @Get('formations')
  @Roles(RoleUtilisateur.ADMIN_CABINET, RoleUtilisateur.COMPTABLE, RoleUtilisateur.LECTURE_SEULE)
  listerFormations(@CurrentUser() user: AuthenticatedUser, @Query('annee') annee?: string) {
    return this.service.listerFormations(user.tenantId, annee && /^\d{4}$/.test(annee) ? Number(annee) : undefined);
  }

  @Post('formations')
  @Roles(RoleUtilisateur.ADMIN_CABINET, RoleUtilisateur.COMPTABLE)
  creerFormation(@CurrentUser() user: AuthenticatedUser, @Body() dto: FormationDto) {
    return this.service.creerFormation(user.tenantId, user.email, dto);
  }

  @Post('formations/:id/participants')
  @Roles(RoleUtilisateur.ADMIN_CABINET, RoleUtilisateur.COMPTABLE)
  inscrire(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: ParticipantsFormationDto) {
    return this.service.inscrire(user.tenantId, id, dto);
  }

  @Delete('formations/:id/participants/:salarieId')
  @Roles(RoleUtilisateur.ADMIN_CABINET, RoleUtilisateur.COMPTABLE)
  desinscrire(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Param('salarieId') salarieId: string) {
    return this.service.desinscrire(user.tenantId, id, salarieId);
  }

  @Post('formations/:id/realisation')
  @Roles(RoleUtilisateur.ADMIN_CABINET, RoleUtilisateur.COMPTABLE)
  realiser(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: RealisationFormationDto) {
    return this.service.realiser(user.tenantId, id, dto);
  }

  @Post('formations/:id/annulation')
  @Roles(RoleUtilisateur.ADMIN_CABINET, RoleUtilisateur.COMPTABLE)
  annulerFormation(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: AnnulationFormationDto) {
    return this.service.annulerFormation(user.tenantId, id, dto);
  }

  @Get('declaration-main-oeuvre/:annee')
  @Roles(RoleUtilisateur.ADMIN_CABINET, RoleUtilisateur.COMPTABLE, RoleUtilisateur.LECTURE_SEULE)
  declarationMainOeuvre(@CurrentUser() user: AuthenticatedUser, @Param('annee') annee: string) {
    return this.service.declarationMainOeuvre(user.tenantId, Number(annee));
  }

  // Arrêté n° 006/CAB/PVPM/ETPS/2010 · le formulaire d'un mouvement, rempli depuis le registre.
  @Get('contrats/:contratId/declaration-mouvement')
  @Roles(RoleUtilisateur.ADMIN_CABINET, RoleUtilisateur.COMPTABLE, RoleUtilisateur.LECTURE_SEULE)
  declarationMouvement(@CurrentUser() user: AuthenticatedUser, @Param('contratId') contratId: string, @Query('motif') motif: string) {
    return this.service.declarationMouvement(user.tenantId, contratId, motif ?? '');
  }

  // Arrêté n° 008/CAB/PVPM/ETPS/2010 · la déclaration d'ouverture, de fermeture ou de changement.
  @Get('declaration-etablissement')
  @Roles(RoleUtilisateur.ADMIN_CABINET, RoleUtilisateur.COMPTABLE, RoleUtilisateur.LECTURE_SEULE)
  declarationEtablissement(@CurrentUser() user: AuthenticatedUser, @Query('nature') nature?: string, @Query('date') date?: string) {
    return this.service.declarationEtablissement(user.tenantId, nature || undefined, date || undefined);
  }
}
