"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuditContexteInterceptor = void 0;
const common_1 = require("@nestjs/common");
const rxjs_1 = require("rxjs");
const contexte_audit_1 = require("./contexte-audit");
let AuditContexteInterceptor = class AuditContexteInterceptor {
    intercept(contexte, suite) {
        const requete = contexte.switchToHttp().getRequest();
        const utilisateur = requete?.user;
        if (!utilisateur?.email)
            return suite.handle();
        const acteur = {
            acteurId: utilisateur.userId,
            acteurEmail: utilisateur.email,
            tenantId: utilisateur.tenantId,
            adresseIp: requete.ip,
            journauxAutorises: utilisateur.role !== 'ADMIN_CABINET' && utilisateur.restreindreJournaux
                ? (utilisateur.journauxAutorises ?? [])
                : null,
        };
        return new rxjs_1.Observable((observateur) => {
            (0, contexte_audit_1.dansContexteAudit)(acteur, () => {
                suite.handle().subscribe(observateur);
            });
        });
    }
};
exports.AuditContexteInterceptor = AuditContexteInterceptor;
exports.AuditContexteInterceptor = AuditContexteInterceptor = __decorate([
    (0, common_1.Injectable)()
], AuditContexteInterceptor);
//# sourceMappingURL=audit-contexte.interceptor.js.map