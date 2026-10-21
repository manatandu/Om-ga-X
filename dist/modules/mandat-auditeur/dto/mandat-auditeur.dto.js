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
exports.CloreMandatDto = exports.RefusProrogationDto = exports.EnregistrerMandatDto = void 0;
const class_validator_1 = require("class-validator");
const client_1 = require("@prisma/client");
class EnregistrerMandatDto {
}
exports.EnregistrerMandatDto = EnregistrerMandatDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(200),
    __metadata("design:type", String)
], EnregistrerMandatDto.prototype, "nom", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(120),
    __metadata("design:type", String)
], EnregistrerMandatDto.prototype, "inscriptionOrdre", void 0);
__decorate([
    (0, class_validator_1.IsEnum)(client_1.OrganeDesignationAuditeur),
    __metadata("design:type", String)
], EnregistrerMandatDto.prototype, "organeDesignation", void 0);
__decorate([
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], EnregistrerMandatDto.prototype, "dateDesignation", void 0);
__decorate([
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1900),
    (0, class_validator_1.Max)(2200),
    __metadata("design:type", Number)
], EnregistrerMandatDto.prototype, "premierExercice", void 0);
__decorate([
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.Max)(12),
    __metadata("design:type", Number)
], EnregistrerMandatDto.prototype, "nombreExercices", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.Max)(10),
    __metadata("design:type", Number)
], EnregistrerMandatDto.prototype, "rang", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], EnregistrerMandatDto.prototype, "mandatOrigineId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(['REMPLACEMENT', 'SUPPLEANT'], { message: 'La succession se déclare REMPLACEMENT ou SUPPLEANT.' }),
    __metadata("design:type", String)
], EnregistrerMandatDto.prototype, "natureSuccession", void 0);
class RefusProrogationDto {
}
exports.RefusProrogationDto = RefusProrogationDto;
__decorate([
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], RefusProrogationDto.prototype, "refus", void 0);
class CloreMandatDto {
}
exports.CloreMandatDto = CloreMandatDto;
__decorate([
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], CloreMandatDto.prototype, "finAnticipeeLe", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(500),
    __metadata("design:type", String)
], CloreMandatDto.prototype, "motifFin", void 0);
//# sourceMappingURL=mandat-auditeur.dto.js.map