"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FiltrePannes = void 0;
exports.statutDe = statutDe;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const telemetrie_serveur_1 = require("./telemetrie-serveur");
let FiltrePannes = class FiltrePannes extends core_1.BaseExceptionFilter {
    catch(exception, hote) {
        if (hote.getType() === 'http') {
            const statut = statutDe(exception);
            if (statut >= 500) {
                const requete = hote.switchToHttp().getRequest();
                const motif = typeof requete?.route?.path === 'string' ? requete.route.path : requete?.path ?? '/';
                (0, telemetrie_serveur_1.signalerPanneServeur)(exception, {
                    route: motif,
                    methode: requete?.method,
                    statut: String(statut),
                    code_prisma: codePrisma(exception),
                });
            }
        }
        super.catch(exception, hote);
    }
};
exports.FiltrePannes = FiltrePannes;
exports.FiltrePannes = FiltrePannes = __decorate([
    (0, common_1.Catch)()
], FiltrePannes);
function statutDe(exception) {
    if (exception instanceof common_1.HttpException)
        return exception.getStatus();
    const e = exception;
    if (e && typeof e.statusCode === 'number' && e.message)
        return e.statusCode;
    return 500;
}
function codePrisma(exception) {
    const code = exception?.code;
    return typeof code === 'string' && /^P\d{4}$/.test(code) ? code : undefined;
}
//# sourceMappingURL=filtre-pannes.js.map