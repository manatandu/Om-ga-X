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
exports.RattacherEcritureConsignationDto = exports.DenouerConsignationDto = exports.CreerConsignationDto = void 0;
const class_validator_1 = require("class-validator");
const client_1 = require("@prisma/client");
class CreerConsignationDto {
}
exports.CreerConsignationDto = CreerConsignationDto;
__decorate([
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], CreerConsignationDto.prototype, "tiersId", void 0);
__decorate([
    (0, class_validator_1.IsEnum)(client_1.SensConsignation),
    __metadata("design:type", String)
], CreerConsignationDto.prototype, "sens", void 0);
__decorate([
    (0, class_validator_1.IsEnum)(client_1.NatureObjetConsigne),
    __metadata("design:type", String)
], CreerConsignationDto.prototype, "nature", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    (0, class_validator_1.MaxLength)(200),
    __metadata("design:type", String)
], CreerConsignationDto.prototype, "designation", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)({ maxDecimalPlaces: 3 }),
    (0, class_validator_1.IsPositive)(),
    __metadata("design:type", Number)
], CreerConsignationDto.prototype, "quantite", void 0);
__decorate([
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], CreerConsignationDto.prototype, "dateConsignation", void 0);
__decorate([
    (0, class_validator_1.IsNumber)({ maxDecimalPlaces: 2 }),
    (0, class_validator_1.IsPositive)(),
    __metadata("design:type", Number)
], CreerConsignationDto.prototype, "montant", void 0);
class DenouerConsignationDto {
}
exports.DenouerConsignationDto = DenouerConsignationDto;
__decorate([
    (0, class_validator_1.IsIn)(['RESTITUTION', 'CONSERVATION', 'REPRISE_PRIX_INFERIEUR']),
    __metadata("design:type", String)
], DenouerConsignationDto.prototype, "mode", void 0);
__decorate([
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], DenouerConsignationDto.prototype, "dateDenouement", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)({ maxDecimalPlaces: 2 }),
    __metadata("design:type", Number)
], DenouerConsignationDto.prototype, "prixDeReprise", void 0);
class RattacherEcritureConsignationDto {
}
exports.RattacherEcritureConsignationDto = RattacherEcritureConsignationDto;
__decorate([
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], RattacherEcritureConsignationDto.prototype, "ecritureId", void 0);
//# sourceMappingURL=consignation.dto.js.map