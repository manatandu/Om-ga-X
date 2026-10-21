"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RefusEnvoi = exports.REFUS_MULTER = void 0;
const common_1 = require("@nestjs/common");
exports.REFUS_MULTER = {
    'Too many files': 'Une seule pièce à la fois.',
    'Unexpected field': 'Le fichier doit être envoyé dans le champ « fichier ».',
    'Too many fields': "Trop de champs dans l'envoi · seuls le fichier et le commentaire sont attendus.",
    'Too many parts': "Trop de champs dans l'envoi · seuls le fichier et le commentaire sont attendus.",
    'Field value too long': "Un champ de l'envoi est trop long.",
    'Field name too long': "Un champ de l'envoi est trop long.",
    'Field name missing': "L'envoi est mal formé.",
};
const ENVOI_MAL_FORME = /^(Multipart: |Malformed part header|Unexpected end of )/;
let RefusEnvoi = class RefusEnvoi {
    catch(e, hote) {
        const reponse = hote.switchToHttp().getResponse();
        if (e instanceof common_1.PayloadTooLargeException) {
            reponse
                .status(413)
                .json({ statusCode: 413, message: 'Le fichier dépasse 5 Mo · réduisez-le ou numérisez-le en plus basse définition.' });
            return;
        }
        const traduit = exports.REFUS_MULTER[e.message] ?? (ENVOI_MAL_FORME.test(e.message) ? "L'envoi est mal formé ou interrompu · recommencez." : null);
        reponse.status(400).json(traduit ? { statusCode: 400, message: traduit } : e.getResponse());
    }
};
exports.RefusEnvoi = RefusEnvoi;
exports.RefusEnvoi = RefusEnvoi = __decorate([
    (0, common_1.Catch)(common_1.PayloadTooLargeException, common_1.BadRequestException)
], RefusEnvoi);
//# sourceMappingURL=refus-envoi.filter.js.map