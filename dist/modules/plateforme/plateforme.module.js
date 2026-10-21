"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlateformeModule = void 0;
const common_1 = require("@nestjs/common");
const auth_module_1 = require("../auth/auth.module");
const facturation_module_1 = require("../facturation/facturation.module");
const abonnements_service_1 = require("./abonnements/abonnements.service");
const plateforme_service_1 = require("./plateforme.service");
const plateforme_controller_1 = require("./plateforme.controller");
const operateur_plateforme_guard_1 = require("./operateur-plateforme.guard");
const licences_sur_site_service_1 = require("./licences-sur-site.service");
const prisma_service_1 = require("../../common/prisma.service");
const courrier_module_1 = require("../courrier/courrier.module");
const tiers_module_1 = require("../tiers/tiers.module");
const comptabilite_module_1 = require("../comptabilite/comptabilite.module");
const garnissage_demonstration_service_1 = require("./garnissage-demonstration.service");
const courriels_editeur_service_1 = require("./abonnements/courriels-editeur.service");
const immobilisations_module_1 = require("../immobilisations/immobilisations.module");
const personnel_module_1 = require("../personnel/personnel.module");
const rapprochement_module_1 = require("../rapprochement/rapprochement.module");
const questionnaire_module_1 = require("../questionnaire/questionnaire.module");
let PlateformeModule = class PlateformeModule {
};
exports.PlateformeModule = PlateformeModule;
exports.PlateformeModule = PlateformeModule = __decorate([
    (0, common_1.Module)({
        imports: [
            auth_module_1.AuthModule,
            facturation_module_1.FacturationModule,
            courrier_module_1.CourrierModule,
            tiers_module_1.TiersModule,
            comptabilite_module_1.ComptabiliteModule,
            immobilisations_module_1.ImmobilisationsModule,
            personnel_module_1.PersonnelModule,
            rapprochement_module_1.RapprochementModule,
            questionnaire_module_1.QuestionnaireModule,
        ],
        controllers: [plateforme_controller_1.PlateformeController],
        providers: [
            plateforme_service_1.PlateformeService,
            abonnements_service_1.AbonnementsService,
            courriels_editeur_service_1.CourrielsEditeurService,
            garnissage_demonstration_service_1.GarnissageDemonstrationService,
            operateur_plateforme_guard_1.OperateurPlateformeGuard,
            { provide: licences_sur_site_service_1.LicencesSurSiteService, useFactory: (p) => new licences_sur_site_service_1.LicencesSurSiteService(p), inject: [prisma_service_1.PrismaService] },
        ],
    })
], PlateformeModule);
//# sourceMappingURL=plateforme.module.js.map