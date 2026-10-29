import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { LicenceGuard } from '../licence/licence.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { TenantService } from './tenant.service';
import {
  ModifierCoordonneesDto,
  ModifierFormeJuridiqueDto,
  ModifierFormeSyscohadaDto,
  ModifierIdentiteDto,
  ModifierDoubleRegardDto,
  ModifierVisaRibsDto,
  ModifierVisaPlansEtalementDto,
  ModifierCircuitVisaDto,
  ModifierRefusClotureNonImprimeDto,
  ModifierCreationCompteEnSaisieDto,
  ModifierSeuilEcartReglementDto,
  ModifierModulesDto,
  ModifierJeuEtatsDto,
  ModifierLongueurCompteDto,
  ModifierMethodeCotisationsDto,
  ModifierMethodeInventaireStocksDto,
  ModifierRegimeDto,
  ModifierSystemeSyscohadaDto,
} from './dto/parametres-dossier.dto';
import { RoleUtilisateur } from '@prisma/client';

/**
 * Structure > Paramètres du dossier. Consultation ouverte aux trois rôles
 * (le jeu d'états conditionne ce que voit le comptable), modification
 * réservée à l'admin comme pour les autres éléments de structure.
 */
@UseGuards(JwtAuthGuard, LicenceGuard, RolesGuard)
@Controller('dossier')
export class TenantController {
  constructor(private readonly tenantService: TenantService) {}

  /** État des étapes du démarrage guidé · voir TenantService.demarrage. */
  @Get('demarrage')
  async demarrage(@CurrentUser() user: AuthenticatedUser) {
    return this.tenantService.demarrage(user.tenantId);
  }

  @Get('parametres')
  async parametres(@CurrentUser() user: AuthenticatedUser) {
    return this.tenantService.parametres(user.tenantId);
  }

  @Patch('jeu-etats-financiers')
  @Roles(RoleUtilisateur.ADMIN_CABINET)
  async modifierJeuEtats(@CurrentUser() user: AuthenticatedUser, @Body() dto: ModifierJeuEtatsDto) {
    return this.tenantService.modifierJeuEtatsFinanciers(user.tenantId, dto.jeuEtatsFinanciersSycebnl);
  }

  /** Pendant SYSCOHADA du jeu d'états · voir le service. */
  @Patch('systeme-syscohada')
  @Roles(RoleUtilisateur.ADMIN_CABINET)
  async modifierSystemeSyscohada(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ModifierSystemeSyscohadaDto,
  ) {
    return this.tenantService.modifierSystemeSyscohada(user.tenantId, dto.systemeComptableSyscohada);
  }

  /**
   * Raison sociale et coordonnées · l'adresse composée ici s'imprime en tête
   * de chaque état financier, elle doit pouvoir être corrigée.
   */
  @Patch('coordonnees')
  @Roles(RoleUtilisateur.ADMIN_CABINET)
  async modifierCoordonnees(@CurrentUser() user: AuthenticatedUser, @Body() dto: ModifierCoordonneesDto) {
    return this.tenantService.modifierCoordonnees(user.tenantId, dto);
  }

  @Patch('identite')
  @Roles(RoleUtilisateur.ADMIN_CABINET)
  async modifierIdentite(@CurrentUser() user: AuthenticatedUser, @Body() dto: ModifierIdentiteDto) {
    return this.tenantService.modifierIdentite(user.tenantId, dto);
  }

  @Patch('forme-juridique')
  @Roles(RoleUtilisateur.ADMIN_CABINET)
  async modifierFormeJuridique(@CurrentUser() user: AuthenticatedUser, @Body() dto: ModifierFormeJuridiqueDto) {
    return this.tenantService.modifierFormeJuridique(user.tenantId, dto.formeJuridique, dto.droitEtranger);
  }

  /**
   * Forme juridique OHADA · voir TenantService.modifierFormeSyscohada. Route
   * distincte de `forme-juridique` plutôt qu'un champ de plus sur celle-ci :
   * les deux listes n'ont aucune valeur commune, et un DTO qui accepterait les
   * deux enums laisserait passer le croisement que le service refuse.
   */
  @Patch('forme-syscohada')
  @Roles(RoleUtilisateur.ADMIN_CABINET)
  async modifierFormeSyscohada(@CurrentUser() user: AuthenticatedUser, @Body() dto: ModifierFormeSyscohadaDto) {
    return this.tenantService.modifierFormeSyscohada(user.tenantId, dto.formeJuridiqueSyscohada, dto.dateEffetTransformation);
  }

  /**
   * Régime de TVA et effectif permanent · voir TenantService.modifierRegime.
   * Réservé à l'administrateur du dossier comme les autres paramètres : ces
   * deux données commandent des règles fiscales et légales, pas un affichage.
   */
  @Patch('regime')
  @Roles(RoleUtilisateur.ADMIN_CABINET)
  async modifierRegime(@CurrentUser() user: AuthenticatedUser, @Body() dto: ModifierRegimeDto) {
    return this.tenantService.modifierRegime(user.tenantId, dto);
  }

  /**
   * Fait générateur des cotisations et du droit d'entrée · voir
   * `TenantService.modifierMethodeCotisations`. Réservé à l'administrateur du
   * dossier : ce choix commande les écritures de cotisation de tous les
   * exercices et une mention obligatoire en notes annexes (§ 5.4.2.1), ce
   * n'est pas un réglage d'affichage.
   */
  @Patch('methode-cotisations')
  @Roles(RoleUtilisateur.ADMIN_CABINET)
  async modifierMethodeCotisations(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ModifierMethodeCotisationsDto,
  ) {
    return this.tenantService.modifierMethodeCotisations(user.tenantId, dto.methodeCotisations);
  }

  /**
   * Mode de tenue des stocks · voir
   * `TenantService.modifierMethodeInventaireStocks`. Réservé à
   * l'administrateur du dossier : le choix commande l'écriture de variation de
   * chaque clôture, ce n'est pas un réglage d'affichage.
   */
  @Patch('methode-inventaire-stocks')
  @Roles(RoleUtilisateur.ADMIN_CABINET)
  async modifierMethodeInventaireStocks(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ModifierMethodeInventaireStocksDto,
  ) {
    return this.tenantService.modifierMethodeInventaireStocks(
      user.tenantId,
      dto.methodeInventaireStocks,
    );
  }

  /**
   * Double regard à la validation · voir `TenantService.modifierDoubleRegard`.
   *
   * Réservé à l'administrateur du dossier, et ce n'est pas un réglage
   * d'affichage : le champ commande QUI peut faire entrer une pièce au
   * livre-journal, franchissement que l'AUDCIF art. 22, 2° rend irréversible
   * (« l'irréversibilité des traitements interdise toute suppression, addition
   * ou modification ultérieure »).
   *
   * AUCUN `@ReferentielsAutorises`, et c'est délibéré · à écrire, pour qu'un
   * relecteur ne prenne pas l'absence pour un oubli. L'obligation atteint les
   * deux référentiels, par l'AUDCIF art. 69 d'un côté et le SYCEBNL art. 16, 2)
   * de l'autre.
   */
  /**
   * Longueur maximale des numéros de compte du dossier · réservée à
   * l'administrateur du cabinet comme les autres paramètres de structure. Le
   * refus de descendre sous les comptes déjà ouverts vit dans le service, pas
   * ici : la route reste ouverte à un appel direct (CLAUDE.md § 6).
   */
  @Patch('longueur-compte')
  @Roles(RoleUtilisateur.ADMIN_CABINET)
  async modifierLongueurCompte(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ModifierLongueurCompteDto,
  ) {
    return this.tenantService.modifierLongueurCompte(user.tenantId, dto.longueurCompte);
  }

  @Patch('double-regard')
  @Roles(RoleUtilisateur.ADMIN_CABINET)
  async modifierDoubleRegard(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ModifierDoubleRegardDto,
  ) {
    return this.tenantService.modifierDoubleRegard(user.tenantId, dto.doubleRegardValidation);
  }

  /** Visa des RIB par un second utilisateur · voir `tiers/visa-rib.ts`. */
  @Patch('visa-ribs')
  @Roles(RoleUtilisateur.ADMIN_CABINET)
  async modifierVisaRibs(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ModifierVisaRibsDto,
  ) {
    return this.tenantService.modifierVisaRibs(user.tenantId, dto.visaRibs);
  }

  /** Ligne paie-suite · visa des plans d'étalement · voir `personnel/visa-plan-etalement.ts`. */
  @Patch('visa-plans-etalement')
  @Roles(RoleUtilisateur.ADMIN_CABINET)
  async modifierVisaPlansEtalement(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ModifierVisaPlansEtalementDto,
  ) {
    return this.tenantService.modifierVisaPlansEtalement(user.tenantId, dto.visaPlansEtalement);
  }

  /** Circuit de visa avant validation · voir `comptabilite/circuit-visa.ts`. */
  @Patch('circuit-visa')
  @Roles(RoleUtilisateur.ADMIN_CABINET)
  async modifierCircuitVisa(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ModifierCircuitVisaDto,
  ) {
    return this.tenantService.modifierCircuitVisa(user.tenantId, dto.circuitVisa);
  }

  /** Création d'un compte pendant la saisie · ligne sage-l1, fonction 14. */
  @Patch('creation-compte-en-saisie')
  @Roles(RoleUtilisateur.ADMIN_CABINET)
  async modifierCreationCompteEnSaisie(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ModifierCreationCompteEnSaisieDto,
  ) {
    return this.tenantService.modifierCreationCompteEnSaisie(user.tenantId, dto.creationCompteEnSaisie);
  }

  /** Seuil de l'écart de règlement · ligne sage-l2, fonction 36. */
  @Patch('seuil-ecart-reglement')
  @Roles(RoleUtilisateur.ADMIN_CABINET)
  async modifierSeuilEcartReglement(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ModifierSeuilEcartReglementDto,
  ) {
    return this.tenantService.modifierSeuilEcartReglement(user.tenantId, dto.seuilEcartReglement);
  }

  /** Refus de clôturer un journal non imprimé · ligne sage-l1, fonction 60. */
  @Patch('refus-cloture-non-imprime')
  @Roles(RoleUtilisateur.ADMIN_CABINET)
  async modifierRefusClotureNonImprime(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ModifierRefusClotureNonImprimeDto,
  ) {
    return this.tenantService.modifierRefusClotureNonImprime(user.tenantId, dto.refusClotureJournalNonImprime);
  }

  /** Modules affichés · voir `tenant/modules-optionnels.ts`. */
  @Patch('modules')
  @Roles(RoleUtilisateur.ADMIN_CABINET)
  async modifierModules(@CurrentUser() user: AuthenticatedUser, @Body() dto: ModifierModulesDto) {
    return this.tenantService.modifierModules(user.tenantId, dto.modulesActives);
  }
}
