"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.JournauxModule = void 0;
const common_1 = require("@nestjs/common");
const journal_service_1 = require("./journal.service");
const analyse_journaux_service_1 = require("./analyse-journaux.service");
const journal_controller_1 = require("./journal.controller");
const impressions_journal_controller_1 = require("./impressions-journal.controller");
const impressions_journal_service_1 = require("./impressions-journal.service");
const licence_module_1 = require("../licence/licence.module");
const jwt_auth_module_1 = require("../auth/jwt-auth.module");
let JournauxModule = class JournauxModule {
};
exports.JournauxModule = JournauxModule;
exports.JournauxModule = JournauxModule = __decorate([
    (0, common_1.Module)({
        imports: [licence_module_1.LicenceModule, jwt_auth_module_1.JwtAuthModule],
        controllers: [journal_controller_1.JournalController, impressions_journal_controller_1.ImpressionsJournalController],
        providers: [journal_service_1.JournalService, analyse_journaux_service_1.AnalyseJournauxService, impressions_journal_service_1.ImpressionsJournalService],
        exports: [journal_service_1.JournalService, analyse_journaux_service_1.AnalyseJournauxService, impressions_journal_service_1.ImpressionsJournalService],
    })
], JournauxModule);
//# sourceMappingURL=journaux.module.js.map