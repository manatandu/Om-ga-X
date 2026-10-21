"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AccepterConditionsDto = void 0;
const class_validator_1 = require("class-validator");
const empreinte_1 = require("../empreinte");
class AccepterConditionsDto {
}
exports.AccepterConditionsDto = AccepterConditionsDto;
__decorate([
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], AccepterConditionsDto.prototype, "version", void 0);
__decorate([
    (0, class_validator_1.Matches)(empreinte_1.MOTIF_EMPREINTE, { message: 'L’empreinte du texte lu doit compter 64 chiffres hexadécimaux.' }),
    __metadata("design:type", String)
], AccepterConditionsDto.prototype, "empreinte", void 0);
__decorate([
    (0, class_validator_1.Matches)(empreinte_1.MOTIF_EMPREINTE, { message: 'L’empreinte de l’abonnement affiché doit compter 64 chiffres hexadécimaux.' }),
    __metadata("design:type", String)
], AccepterConditionsDto.prototype, "empreinteCommande", void 0);
__decorate([
    (0, class_validator_1.Equals)(true, { message: 'Cochez la case qui dit avoir lu les conditions avant de les accepter.' }),
    __metadata("design:type", Boolean)
], AccepterConditionsDto.prototype, "lu", void 0);
//# sourceMappingURL=conditions-licence.dto.js.map