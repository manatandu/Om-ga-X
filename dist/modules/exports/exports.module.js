"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExportsModule = void 0;
const common_1 = require("@nestjs/common");
const export_service_1 = require("./export.service");
const export_fpm_service_1 = require("./export-fpm.service");
const export_controller_1 = require("./export.controller");
const restitution_controller_1 = require("./restitution/restitution.controller");
const restitution_service_1 = require("./restitution/restitution.service");
const licence_module_1 = require("../licence/licence.module");
const jwt_auth_module_1 = require("../auth/jwt-auth.module");
const comptabilite_module_1 = require("../comptabilite/comptabilite.module");
const etats_financiers_module_1 = require("../etats-financiers/etats-financiers.module");
const notes_annexes_module_1 = require("../notes-annexes/notes-annexes.module");
const registre_donateurs_module_1 = require("../registre-donateurs/registre-donateurs.module");
const documents_obligatoires_module_1 = require("../documents-obligatoires/documents-obligatoires.module");
const etats_financiers_syscohada_module_1 = require("../etats-financiers-syscohada/etats-financiers-syscohada.module");
const immobilisations_module_1 = require("../immobilisations/immobilisations.module");
const controles_module_1 = require("../controles/controles.module");
const export_modifications_controller_1 = require("./modifications/export-modifications.controller");
const export_modifications_service_1 = require("./modifications/export-modifications.service");
const impression_differee_controller_1 = require("./impression-differee/impression-differee.controller");
const impression_differee_service_1 = require("./impression-differee/impression-differee.service");
const selections_edition_controller_1 = require("./selections/selections-edition.controller");
const selections_edition_service_1 = require("./selections/selections-edition.service");
const modeles_edition_controller_1 = require("./modeles-edition/modeles-edition.controller");
const modeles_edition_service_1 = require("./modeles-edition/modeles-edition.service");
const extraits_periode_service_1 = require("./extraits-periode/extraits-periode.service");
let ExportsModule = class ExportsModule {
};
exports.ExportsModule = ExportsModule;
exports.ExportsModule = ExportsModule = __decorate([
    (0, common_1.Module)({
        imports: [
            licence_module_1.LicenceModule,
            jwt_auth_module_1.JwtAuthModule,
            comptabilite_module_1.ComptabiliteModule,
            etats_financiers_module_1.EtatsFinanciersModule,
            etats_financiers_syscohada_module_1.EtatsFinanciersSyscohadaModule,
            notes_annexes_module_1.NotesAnnexesModule,
            registre_donateurs_module_1.RegistreDonateursModule,
            documents_obligatoires_module_1.DocumentsObligatoiresModule,
            immobilisations_module_1.ImmobilisationsModule,
            controles_module_1.ControlesModule,
        ],
        controllers: [
            export_controller_1.ExportController,
            restitution_controller_1.RestitutionController,
            export_modifications_controller_1.ExportModificationsController,
            impression_differee_controller_1.ImpressionsDiffereesController,
            selections_edition_controller_1.SelectionsEditionController,
            modeles_edition_controller_1.ModelesEditionController,
        ],
        providers: [
            export_service_1.ExportService,
            export_fpm_service_1.ExportFpmService,
            restitution_service_1.RestitutionService,
            export_modifications_service_1.ExportModificationsService,
            impression_differee_service_1.ImpressionDiffereeService,
            selections_edition_service_1.SelectionsEditionService,
            modeles_edition_service_1.ModelesEditionService,
            extraits_periode_service_1.ExtraitsPeriodeService,
        ],
        exports: [export_service_1.ExportService],
    })
], ExportsModule);
//# sourceMappingURL=exports.module.js.map