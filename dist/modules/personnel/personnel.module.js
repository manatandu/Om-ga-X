"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PersonnelModule = void 0;
const common_1 = require("@nestjs/common");
const personnel_service_1 = require("./personnel.service");
const personnel_controller_1 = require("./personnel.controller");
const licence_module_1 = require("../licence/licence.module");
const jwt_auth_module_1 = require("../auth/jwt-auth.module");
const comptabilite_module_1 = require("../comptabilite/comptabilite.module");
const comptabilisation_paie_service_1 = require("./comptabilisation-paie.service");
const avances_rubriques_controller_1 = require("./avances-rubriques.controller");
const avances_rubriques_service_1 = require("./avances-rubriques.service");
const baremes_paie_controller_1 = require("./baremes-paie.controller");
const baremes_paie_service_1 = require("./baremes-paie.service");
const conges_controller_1 = require("./conges.controller");
const conges_service_1 = require("./conges.service");
const absences_controller_1 = require("./absences.controller");
const absences_service_1 = require("./absences.service");
const majorations_heures_controller_1 = require("./majorations-heures.controller");
const majorations_heures_service_1 = require("./majorations-heures.service");
const reglements_module_1 = require("../reglements/reglements.module");
const paiement_salaires_controller_1 = require("./paiement-salaires.controller");
const paiement_salaires_service_1 = require("./paiement-salaires.service");
const ribs_salaries_service_1 = require("./ribs-salaries.service");
const repartitions_analytiques_paie_controller_1 = require("./repartitions-analytiques-paie.controller");
const repartitions_analytiques_paie_service_1 = require("./repartitions-analytiques-paie.service");
const questionnaire_paie_controller_1 = require("./questionnaire-paie.controller");
const questionnaire_paie_service_1 = require("./questionnaire-paie.service");
const pieces_jointes_module_1 = require("../../common/pieces-jointes/pieces-jointes.module");
const pieces_jointes_salarie_controller_1 = require("./pieces-jointes-salarie.controller");
let PersonnelModule = class PersonnelModule {
};
exports.PersonnelModule = PersonnelModule;
exports.PersonnelModule = PersonnelModule = __decorate([
    (0, common_1.Module)({
        imports: [licence_module_1.LicenceModule, jwt_auth_module_1.JwtAuthModule, comptabilite_module_1.ComptabiliteModule, reglements_module_1.ReglementsModule, pieces_jointes_module_1.PiecesJointesModule],
        controllers: [
            personnel_controller_1.PersonnelController,
            avances_rubriques_controller_1.AvancesRubriquesController,
            baremes_paie_controller_1.BaremesPaieController,
            conges_controller_1.CongesController,
            absences_controller_1.AbsencesController,
            majorations_heures_controller_1.MajorationsHeuresController,
            paiement_salaires_controller_1.PaiementSalairesController,
            repartitions_analytiques_paie_controller_1.RepartitionsAnalytiquesPaieController,
            questionnaire_paie_controller_1.QuestionnairePaieController,
            pieces_jointes_salarie_controller_1.PiecesJointesSalarieController,
        ],
        providers: [
            personnel_service_1.PersonnelService,
            comptabilisation_paie_service_1.ComptabilisationPaieService,
            avances_rubriques_service_1.AvancesRubriquesService,
            baremes_paie_service_1.BaremesPaieService,
            conges_service_1.CongesService,
            absences_service_1.AbsencesService,
            majorations_heures_service_1.MajorationsHeuresService,
            paiement_salaires_service_1.PaiementSalairesService,
            ribs_salaries_service_1.RibsSalariesService,
            repartitions_analytiques_paie_service_1.RepartitionsAnalytiquesPaieService,
            questionnaire_paie_service_1.QuestionnairePaieService,
        ],
        exports: [personnel_service_1.PersonnelService],
    })
], PersonnelModule);
//# sourceMappingURL=personnel.module.js.map