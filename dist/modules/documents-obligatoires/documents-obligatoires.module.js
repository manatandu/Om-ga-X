"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DocumentsObligatoiresModule = void 0;
const common_1 = require("@nestjs/common");
const livre_inventaire_service_1 = require("./livre-inventaire.service");
const rapport_activite_service_1 = require("./rapport-activite.service");
const manuel_procedures_service_1 = require("./manuel-procedures.service");
const documents_obligatoires_controller_1 = require("./documents-obligatoires.controller");
const licence_module_1 = require("../licence/licence.module");
const jwt_auth_module_1 = require("../auth/jwt-auth.module");
const etats_financiers_module_1 = require("../etats-financiers/etats-financiers.module");
const registre_donateurs_module_1 = require("../registre-donateurs/registre-donateurs.module");
const etats_financiers_syscohada_module_1 = require("../etats-financiers-syscohada/etats-financiers-syscohada.module");
let DocumentsObligatoiresModule = class DocumentsObligatoiresModule {
};
exports.DocumentsObligatoiresModule = DocumentsObligatoiresModule;
exports.DocumentsObligatoiresModule = DocumentsObligatoiresModule = __decorate([
    (0, common_1.Module)({
        imports: [licence_module_1.LicenceModule, jwt_auth_module_1.JwtAuthModule, etats_financiers_module_1.EtatsFinanciersModule, registre_donateurs_module_1.RegistreDonateursModule, etats_financiers_syscohada_module_1.EtatsFinanciersSyscohadaModule],
        controllers: [documents_obligatoires_controller_1.DocumentsObligatoiresController],
        providers: [livre_inventaire_service_1.LivreInventaireService, rapport_activite_service_1.RapportActiviteService, manuel_procedures_service_1.ManuelProceduresService],
        exports: [livre_inventaire_service_1.LivreInventaireService, rapport_activite_service_1.RapportActiviteService, manuel_procedures_service_1.ManuelProceduresService],
    })
], DocumentsObligatoiresModule);
//# sourceMappingURL=documents-obligatoires.module.js.map