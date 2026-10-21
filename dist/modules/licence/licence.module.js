"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LicenceModule = void 0;
const common_1 = require("@nestjs/common");
const licence_service_1 = require("./licence.service");
const licence_guard_1 = require("./licence.guard");
const licence_sur_site_service_1 = require("../sur-site/licence-sur-site.service");
let LicenceModule = class LicenceModule {
};
exports.LicenceModule = LicenceModule;
exports.LicenceModule = LicenceModule = __decorate([
    (0, common_1.Module)({
        providers: [
            licence_service_1.LicenceService,
            licence_guard_1.LicenceGuard,
            { provide: licence_sur_site_service_1.LicenceSurSiteService, useFactory: () => new licence_sur_site_service_1.LicenceSurSiteService() },
        ],
        exports: [licence_service_1.LicenceService, licence_guard_1.LicenceGuard, licence_sur_site_service_1.LicenceSurSiteService],
    })
], LicenceModule);
//# sourceMappingURL=licence.module.js.map