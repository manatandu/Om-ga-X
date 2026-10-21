"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ImmobilisationsModule = void 0;
const common_1 = require("@nestjs/common");
const immobilisation_service_1 = require("./immobilisation.service");
const immobilisation_controller_1 = require("./immobilisation.controller");
const degressif_controller_1 = require("./degressif.controller");
const degressif_service_1 = require("./degressif.service");
const licence_module_1 = require("../licence/licence.module");
const jwt_auth_module_1 = require("../auth/jwt-auth.module");
const comptabilite_module_1 = require("../comptabilite/comptabilite.module");
const location_acquisition_controller_1 = require("./location-acquisition/location-acquisition.controller");
const location_acquisition_service_1 = require("./location-acquisition/location-acquisition.service");
const reprise_subvention_controller_1 = require("./reprise-subvention.controller");
const reprise_subvention_service_1 = require("./reprise-subvention.service");
const subvention_rattachee_controller_1 = require("./subvention-rattachee.controller");
const subvention_rattachee_service_1 = require("./subvention-rattachee.service");
const reevaluation_bilan_controller_1 = require("./reevaluation-bilan.controller");
const reevaluation_bilan_service_1 = require("./reevaluation-bilan.service");
const demantelement_controller_1 = require("./demantelement.controller");
const demantelement_service_1 = require("./demantelement.service");
const annulation_traitement_controller_1 = require("./annulation-traitement.controller");
const annulation_traitement_service_1 = require("./annulation-traitement.service");
const fiche_immobilisation_controller_1 = require("./fiche-immobilisation.controller");
const fiche_immobilisation_service_1 = require("./fiche-immobilisation.service");
const creation_depuis_ecritures_controller_1 = require("./creation-depuis-ecritures.controller");
const maintenance_immobilisations_controller_1 = require("./maintenance-immobilisations.controller");
const maintenance_immobilisations_service_1 = require("./maintenance-immobilisations.service");
const creation_depuis_ecritures_service_1 = require("./creation-depuis-ecritures.service");
const pieces_jointes_module_1 = require("../../common/pieces-jointes/pieces-jointes.module");
const pieces_jointes_immobilisation_controller_1 = require("./pieces-jointes-immobilisation.controller");
let ImmobilisationsModule = class ImmobilisationsModule {
};
exports.ImmobilisationsModule = ImmobilisationsModule;
exports.ImmobilisationsModule = ImmobilisationsModule = __decorate([
    (0, common_1.Module)({
        imports: [licence_module_1.LicenceModule, jwt_auth_module_1.JwtAuthModule, comptabilite_module_1.ComptabiliteModule, pieces_jointes_module_1.PiecesJointesModule],
        controllers: [immobilisation_controller_1.ImmobilisationController, degressif_controller_1.DegressifController, location_acquisition_controller_1.LocationAcquisitionController, reprise_subvention_controller_1.RepriseSubventionController, subvention_rattachee_controller_1.SubventionRattacheeController, reevaluation_bilan_controller_1.ReevaluationBilanController, demantelement_controller_1.DemantelementController, annulation_traitement_controller_1.AnnulationTraitementController, fiche_immobilisation_controller_1.FicheImmobilisationController, creation_depuis_ecritures_controller_1.CreationDepuisEcrituresController, maintenance_immobilisations_controller_1.MaintenanceImmobilisationsController, pieces_jointes_immobilisation_controller_1.PiecesJointesImmobilisationController],
        providers: [immobilisation_service_1.ImmobilisationService, degressif_service_1.DegressifService, location_acquisition_service_1.LocationAcquisitionService, reprise_subvention_service_1.RepriseSubventionService, subvention_rattachee_service_1.SubventionRattacheeService, reevaluation_bilan_service_1.ReevaluationBilanService, demantelement_service_1.DemantelementService, annulation_traitement_service_1.AnnulationTraitementService, fiche_immobilisation_service_1.FicheImmobilisationService, creation_depuis_ecritures_service_1.CreationDepuisEcrituresService, maintenance_immobilisations_service_1.MaintenanceImmobilisationsService],
        exports: [immobilisation_service_1.ImmobilisationService],
    })
], ImmobilisationsModule);
//# sourceMappingURL=immobilisations.module.js.map