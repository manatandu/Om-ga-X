"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const filtre_pannes_1 = require("./common/telemetrie/filtre-pannes");
const audit_contexte_interceptor_1 = require("./common/audit/audit-contexte.interceptor");
const journal_audit_module_1 = require("./common/audit/journal-audit.module");
const config_1 = require("@nestjs/config");
const throttler_1 = require("@nestjs/throttler");
const validate_env_1 = require("./config/validate-env");
const prisma_module_1 = require("./common/prisma.module");
const sante_controller_1 = require("./common/sante.controller");
const tenant_module_1 = require("./modules/tenant/tenant.module");
const licence_module_1 = require("./modules/licence/licence.module");
const auth_module_1 = require("./modules/auth/auth.module");
const comptes_module_1 = require("./modules/comptes/comptes.module");
const exercice_module_1 = require("./modules/exercice/exercice.module");
const comptabilite_module_1 = require("./modules/comptabilite/comptabilite.module");
const etats_financiers_module_1 = require("./modules/etats-financiers/etats-financiers.module");
const etats_financiers_syscohada_module_1 = require("./modules/etats-financiers-syscohada/etats-financiers-syscohada.module");
const utilisateurs_module_1 = require("./modules/utilisateurs/utilisateurs.module");
const journaux_module_1 = require("./modules/journaux/journaux.module");
const lettrage_module_1 = require("./modules/lettrage/lettrage.module");
const tiers_module_1 = require("./modules/tiers/tiers.module");
const tva_module_1 = require("./modules/tva/tva.module");
const rapprochement_module_1 = require("./modules/rapprochement/rapprochement.module");
const immobilisations_module_1 = require("./modules/immobilisations/immobilisations.module");
const exports_module_1 = require("./modules/exports/exports.module");
const bailleurs_module_1 = require("./modules/bailleurs/bailleurs.module");
const notes_annexes_module_1 = require("./modules/notes-annexes/notes-annexes.module");
const registre_donateurs_module_1 = require("./modules/registre-donateurs/registre-donateurs.module");
const documents_obligatoires_module_1 = require("./modules/documents-obligatoires/documents-obligatoires.module");
const operations_specifiques_module_1 = require("./modules/operations-specifiques/operations-specifiques.module");
const analytique_module_1 = require("./modules/analytique/analytique.module");
const import_module_1 = require("./modules/import/import.module");
const controles_module_1 = require("./modules/controles/controles.module");
const regularisation_module_1 = require("./modules/regularisation/regularisation.module");
const devises_module_1 = require("./modules/devises/devises.module");
const stock_module_1 = require("./modules/stocks/stock.module");
const personnel_module_1 = require("./modules/personnel/personnel.module");
const emballages_module_1 = require("./modules/emballages/emballages.module");
const affectation_module_1 = require("./modules/affectation/affectation.module");
const relances_module_1 = require("./modules/relances/relances.module");
const reglements_module_1 = require("./modules/reglements/reglements.module");
const virements_fonds_module_1 = require("./modules/virements-fonds/virements-fonds.module");
const retenues_module_1 = require("./modules/retenues/retenues.module");
const exonerations_module_1 = require("./modules/exonerations/exonerations.module");
const inventaire_module_1 = require("./modules/inventaire/inventaire.module");
const circularisation_module_1 = require("./modules/circularisation/circularisation.module");
const faiblesses_module_1 = require("./modules/faiblesses/faiblesses.module");
const mandat_auditeur_module_1 = require("./modules/mandat-auditeur/mandat-auditeur.module");
const conditions_licence_module_1 = require("./modules/conditions-licence/conditions-licence.module");
const accord_cadre_module_1 = require("./modules/accord-cadre/accord-cadre.module");
const consolidation_module_1 = require("./modules/consolidation/consolidation.module");
const ifrs_module_1 = require("./modules/ifrs/ifrs.module");
const facturation_module_1 = require("./modules/facturation/facturation.module");
const commercial_module_1 = require("./modules/commercial/commercial.module");
const constitution_module_1 = require("./modules/constitution/constitution.module");
const questionnaire_module_1 = require("./modules/questionnaire/questionnaire.module");
const monnaie_fonctionnelle_module_1 = require("./modules/monnaie-fonctionnelle/monnaie-fonctionnelle.module");
const provisions_module_1 = require("./modules/provisions/provisions.module");
const creances_douteuses_module_1 = require("./modules/creances-douteuses/creances-douteuses.module");
const fiscalite_module_1 = require("./modules/fiscalite/fiscalite.module");
const plateforme_module_1 = require("./modules/plateforme/plateforme.module");
const groupe_module_1 = require("./modules/groupe/groupe.module");
const modeles_saisie_module_1 = require("./modules/modeles-saisie/modeles-saisie.module");
const banques_module_1 = require("./modules/banques/banques.module");
const etats_personnalises_module_1 = require("./modules/etats-personnalises/etats-personnalises.module");
const simulations_module_1 = require("./modules/simulations/simulations.module");
const courrier_module_1 = require("./modules/courrier/courrier.module");
const sur_site_module_1 = require("./modules/sur-site/sur-site.module");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            journal_audit_module_1.JournalAuditModule,
            config_1.ConfigModule.forRoot({ isGlobal: true, validate: validate_env_1.validateEnv }),
            throttler_1.ThrottlerModule.forRoot({
                throttlers: [{ ttl: 60_000, limit: 300 }],
                errorMessage: 'Trop de tentatives depuis cette adresse · patientez une minute puis réessayez.',
            }),
            prisma_module_1.PrismaModule,
            tenant_module_1.TenantModule,
            licence_module_1.LicenceModule,
            auth_module_1.AuthModule,
            comptes_module_1.ComptesModule,
            exercice_module_1.ExerciceModule,
            journaux_module_1.JournauxModule,
            comptabilite_module_1.ComptabiliteModule,
            lettrage_module_1.LettrageModule,
            tiers_module_1.TiersModule,
            tva_module_1.TvaModule,
            rapprochement_module_1.RapprochementModule,
            immobilisations_module_1.ImmobilisationsModule,
            etats_financiers_module_1.EtatsFinanciersModule,
            etats_financiers_syscohada_module_1.EtatsFinanciersSyscohadaModule,
            exports_module_1.ExportsModule,
            utilisateurs_module_1.UtilisateursModule,
            bailleurs_module_1.BailleursModule,
            notes_annexes_module_1.NotesAnnexesModule,
            registre_donateurs_module_1.RegistreDonateursModule,
            documents_obligatoires_module_1.DocumentsObligatoiresModule,
            operations_specifiques_module_1.OperationsSpecifiquesModule,
            analytique_module_1.AnalytiqueModule,
            import_module_1.ImportModule,
            controles_module_1.ControlesModule,
            regularisation_module_1.RegularisationModule,
            devises_module_1.DevisesModule,
            affectation_module_1.AffectationModule,
            stock_module_1.StockModule,
            personnel_module_1.PersonnelModule,
            emballages_module_1.EmballagesModule,
            relances_module_1.RelancesModule,
            reglements_module_1.ReglementsModule,
            virements_fonds_module_1.VirementsFondsModule,
            retenues_module_1.RetenuesModule,
            exonerations_module_1.ExonerationsModule,
            inventaire_module_1.InventaireModule,
            circularisation_module_1.CircularisationModule,
            faiblesses_module_1.FaiblessesModule,
            mandat_auditeur_module_1.MandatAuditeurModule,
            conditions_licence_module_1.ConditionsLicenceModule,
            accord_cadre_module_1.AccordCadreModule,
            consolidation_module_1.ConsolidationModule,
            ifrs_module_1.IfrsModule,
            facturation_module_1.FacturationModule,
            commercial_module_1.CommercialModule,
            constitution_module_1.ConstitutionModule,
            questionnaire_module_1.QuestionnaireModule,
            monnaie_fonctionnelle_module_1.MonnaieFonctionnelleModule,
            provisions_module_1.ProvisionsModule,
            creances_douteuses_module_1.CreancesDouteusesModule,
            fiscalite_module_1.FiscaliteModule,
            plateforme_module_1.PlateformeModule,
            groupe_module_1.GroupeModule,
            modeles_saisie_module_1.ModelesSaisieModule,
            banques_module_1.BanquesModule,
            etats_personnalises_module_1.EtatsPersonnalisesModule,
            simulations_module_1.SimulationsModule,
            courrier_module_1.CourrierModule,
            sur_site_module_1.SurSiteModule,
        ],
        controllers: [sante_controller_1.SanteController],
        providers: [
            { provide: core_1.APP_GUARD, useClass: throttler_1.ThrottlerGuard },
            { provide: core_1.APP_INTERCEPTOR, useClass: audit_contexte_interceptor_1.AuditContexteInterceptor },
            { provide: core_1.APP_FILTER, useClass: filtre_pannes_1.FiltrePannes },
        ],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map