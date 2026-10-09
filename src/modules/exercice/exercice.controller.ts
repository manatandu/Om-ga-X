import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { LicenceGuard } from '../licence/licence.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { ExerciceService } from './exercice.service';
import { CreerExerciceDto } from './dto/creer-exercice.dto';
import { ClorePartielleDto, CloreTotaleDto, ClorePeriodeDto } from './dto/cloture.dto';
import { ArreterComptesDto } from './dto/arrete-comptes.dto';
import { ANouveauxProvisoiresDto } from './dto/a-nouveaux-provisoires.dto';
import { CloturerExerciceDto } from './dto/cloturer-exercice.dto';
import { Referentiel, RoleUtilisateur } from '@prisma/client';
import { ReferentielGuard } from '../../common/guards/referentiel.guard';
import { ReferentielsAutorises } from '../../common/decorators/referentiels.decorator';
import { FicheR2Dto } from './dto/fiche-r2.dto';
import { DatesPortefeuilleDto } from './dto/dates-portefeuille.dto';
import { FinLiquidationDto } from './dto/fin-liquidation.dto';
import { GesteDissolutionDto } from './dto/geste-dissolution.dto';
import { AccesRolesCantonnes } from '../../common/decorators/acces-roles-cantonnes.decorator';

@UseGuards(JwtAuthGuard, LicenceGuard, RolesGuard, ReferentielGuard)
@Controller('exercices')
export class ExerciceController {
  constructor(private readonly exerciceService: ExerciceService) {}

  // Le sélecteur d'exercice se charge à l'ouverture de toute fenêtre · la
  // liste ne porte aucun chiffre comptable.
  @AccesRolesCantonnes({ gestionnairePaie: true })
  @Get()
  async lister(@CurrentUser() user: AuthenticatedUser) {
    return this.exerciceService.lister(user.tenantId);
  }

  @Roles(RoleUtilisateur.ADMIN_CABINET)
  @Post()
  async creer(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreerExerciceDto) {
    return this.exerciceService.creer(user.tenantId, dto);
  }

  /**
   * NOUVEL EXERCICE AVEC REPORTS PROVISOIRES (Sage i7) · ouvre l'exercice
   * suivant s'il n'existe pas, y passe le report à-nouveau provisoire au
   * brouillard (relancé = remplacé), et reporte les budgets si demandé.
   */
  @Roles(RoleUtilisateur.ADMIN_CABINET)
  @Post(':id/a-nouveaux-provisoires')
  async aNouveauxProvisoires(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: ANouveauxProvisoiresDto,
  ) {
    return this.exerciceService.genererANouveauxProvisoires(user.tenantId, id, user.userId, {
      reporterBudgets: body?.reporterBudgets === true,
    });
  }

  /** Report des budgets des sections sur l'exercice suivant, sans rien écraser. */
  @Roles(RoleUtilisateur.ADMIN_CABINET)
  @Post(':id/reporter-budgets')
  async reporterBudgets(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.exerciceService.reporterBudgets(user.tenantId, id);
  }

  /** Clôture ANNUELLE : solde les charges/produits sur le résultat et génère le report à-nouveau réel. */
  @Roles(RoleUtilisateur.ADMIN_CABINET)
  @Post(':id/cloturer')
  async cloturer(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: CloturerExerciceDto) {
    return this.exerciceService.cloturer(user.tenantId, id, user.userId, dto ?? {});
  }

  /**
   * AU2 · L'APERÇU AVANT DE FIGER · le bilan d'ouverture déjà passé dans
   * l'exercice suivant, confronté compte par compte au bilan de clôture de
   * celui-ci. Lecture seule · l'écran sait avant la clôture s'il faudra
   * déclarer lequel fait foi.
   */
  @Get(':id/ouverture-suivante')
  async ouvertureSuivante(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.exerciceService.confrontationOuvertureSuivante(user.tenantId, id);
  }

  /**
   * DATE D'ARRÊTÉ DES COMPTES · la quatrième mention obligatoire de chaque
   * page publiée (AUDCIF Titre IX ch. 1 § 2.4), exigée « dans toute
   * publication des états financiers » par l'art. 23.
   *
   * ADMIN_CABINET seulement · l'arrêté est un acte des organes dirigeants, pas
   * une saisie comptable. C'est cette date qui ferme la fenêtre des événements
   * postérieurs et qui date le document opposable.
   */
  @Roles(RoleUtilisateur.ADMIN_CABINET)
  @Post(':id/arrete-comptes')
  async arreterComptes(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: ArreterComptesDto,
  ) {
    return this.exerciceService.arreterComptes(user.tenantId, id, dto);
  }

  /**
   * FICHE R2, cases ZN à ZS (AUDCIF Titre IX ch. 2) · faits déclarés par
   * exercice. SYSCOHADA seul · le SYCEBNL ne porte pas de fiche R2, et la
   * route se refuse au serveur, pas seulement à l'écran.
   */
  // Mêmes rôles que l'arrêté des comptes · un fait des organes de l'entité,
  // déclaré par l'administrateur du dossier, pas une saisie comptable.
  @Roles(RoleUtilisateur.ADMIN_CABINET)
  @ReferentielsAutorises(Referentiel.SYSCOHADA)
  @Post(':id/fiche-r2')
  async declarerFicheR2(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: FicheR2Dto) {
    return this.exerciceService.declarerFicheR2(user.tenantId, id, dto);
  }

  /**
   * ENTREPRISE DU PORTEFEUILLE DE L'ÉTAT · date de l'assemblée et date de
   * dépôt des états au ministère du Portefeuille (O.-L. n° 13/003, art. 112
   * et 113). SYSCOHADA seul, refusé au serveur ailleurs.
   */
  // Mêmes rôles que l'arrêté des comptes · un fait des organes de l'entité,
  // déclaré par l'administrateur du dossier, pas une saisie comptable.
  @Roles(RoleUtilisateur.ADMIN_CABINET)
  @ReferentielsAutorises(Referentiel.SYSCOHADA)
  @Post(':id/dates-portefeuille')
  async declarerDatesPortefeuille(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: DatesPortefeuilleDto,
  ) {
    return this.exerciceService.declarerDatesPortefeuille(user.tenantId, id, dto);
  }

  /**
   * ARRÊTER L'EXERCICE À LA DATE DE DISSOLUTION DÉCLARÉE (décision par la loi
   * du 2026-10-07, point 2 · loi n° 23/053, art. 12 al. 1 ; AUDCIF Titre VIII
   * ch. 40 § 2.1). ADMIN_CABINET · un acte sur les dates de l'exercice, comme
   * sa création. Ouvert aux deux référentiels, le service exigeant la
   * dissolution déclarée, qu'une société ou une coopérative seules portent.
   */
  @Roles(RoleUtilisateur.ADMIN_CABINET)
  @Post(':id/arreter-a-la-dissolution')
  async arreterALaDissolution(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: GesteDissolutionDto) {
    return this.exerciceService.arreterALaDissolution(user.tenantId, id, {
      retirerActesDeLaPeriode: dto.retirerActesDeLaPeriode === true,
      ouvertureAnnuleeNonRessaisie: dto.ouvertureAnnuleeNonRessaisie === true,
      userId: user.userId,
    });
  }

  /**
   * Annuler l'arrêt (constat 2 de la relecture · une dissolution mal datée
   * enfermait le dossier) · l'exercice retrouve son 31 décembre, les écritures
   * de la période lui reviennent. Même rôle que l'arrêt.
   */
  @Roles(RoleUtilisateur.ADMIN_CABINET)
  @Post(':id/annuler-arret-dissolution')
  async annulerArretDissolution(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: GesteDissolutionDto) {
    return this.exerciceService.annulerArretDissolution(user.tenantId, id, {
      retirerActesDeLaPeriode: dto.retirerActesDeLaPeriode === true,
      ouvertureAnnuleeNonRessaisie: dto.ouvertureAnnuleeNonRessaisie === true,
      userId: user.userId,
    });
  }

  /**
   * L'exercice ouvert qui suit une dissolution antérieure au premier exercice
   * tenu devient l'exercice de liquidation (constat 13, dossier repris).
   */
  @Roles(RoleUtilisateur.ADMIN_CABINET)
  @Post(':id/rattacher-a-la-liquidation')
  async rattacherALaLiquidation(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: GesteDissolutionDto) {
    return this.exerciceService.rattacherALaLiquidation(user.tenantId, id, {
      retirerActesDeLaPeriode: dto.retirerActesDeLaPeriode === true,
      ouvertureAnnuleeNonRessaisie: dto.ouvertureAnnuleeNonRessaisie === true,
      userId: user.userId,
    });
  }

  /** La fin de l'exercice de liquidation, reportée ou avancée tant qu'il est ouvert (AUDCIF art. 7 al. 4). */
  @Roles(RoleUtilisateur.ADMIN_CABINET)
  @Post(':id/fin-de-liquidation')
  async modifierFinDeLiquidation(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: FinLiquidationDto,
  ) {
    return this.exerciceService.modifierFinDeLiquidation(user.tenantId, id, dto);
  }

  @Get(':id/planning-cloture')
  async planningCloture(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.exerciceService.planningCloture(user.tenantId, id);
  }

  @Get(':id/clotures')
  async listerClotures(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.exerciceService.listerClotures(user.tenantId, id);
  }

  @Roles(RoleUtilisateur.ADMIN_CABINET)
  @Post(':id/clotures/partielle')
  async clorePartielle(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: ClorePartielleDto,
  ) {
    return this.exerciceService.clorePartielle(user.tenantId, id, user.userId, dto);
  }

  @Roles(RoleUtilisateur.ADMIN_CABINET)
  @Post(':id/clotures/totale')
  async cloreTotale(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: CloreTotaleDto) {
    return this.exerciceService.cloreTotale(user.tenantId, id, user.userId, dto);
  }

  @Roles(RoleUtilisateur.ADMIN_CABINET)
  @Post(':id/clotures/periode')
  async clorePeriode(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: ClorePeriodeDto) {
    return this.exerciceService.clorePeriode(user.tenantId, id, user.userId, dto);
  }

  @Roles(RoleUtilisateur.ADMIN_CABINET)
  @Post('clotures/:clotureId/annuler')
  async annulerCloture(@CurrentUser() user: AuthenticatedUser, @Param('clotureId') clotureId: string) {
    return this.exerciceService.annulerCloture(user.tenantId, clotureId, user.userId);
  }
}
