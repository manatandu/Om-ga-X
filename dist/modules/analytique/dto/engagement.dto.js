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
exports.CloreEngagementDto = exports.RattacherExecutionDto = exports.CreerEngagementDto = void 0;
const class_validator_1 = require("class-validator");
const client_1 = require("@prisma/client");
class CreerEngagementDto {
}
exports.CreerEngagementDto = CreerEngagementDto;
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreerEngagementDto.prototype, "exerciceId", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreerEngagementDto.prototype, "sectionId", void 0);
__decorate([
    (0, class_validator_1.IsEnum)(client_1.NatureEngagement),
    __metadata("design:type", String)
], CreerEngagementDto.prototype, "nature", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    __metadata("design:type", String)
], CreerEngagementDto.prototype, "reference", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    __metadata("design:type", String)
], CreerEngagementDto.prototype, "objet", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    __metadata("design:type", String)
], CreerEngagementDto.prototype, "beneficiaire", void 0);
__decorate([
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], CreerEngagementDto.prototype, "date", void 0);
__decorate([
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], CreerEngagementDto.prototype, "montant", void 0);
class RattacherExecutionDto {
}
exports.RattacherExecutionDto = RattacherExecutionDto;
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], RattacherExecutionDto.prototype, "ecritureId", void 0);
__decorate([
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], RattacherExecutionDto.prototype, "montant", void 0);
class CloreEngagementDto {
}
exports.CloreEngagementDto = CloreEngagementDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    __metadata("design:type", String)
], CloreEngagementDto.prototype, "motif", void 0);
//# sourceMappingURL=engagement.dto.js.map