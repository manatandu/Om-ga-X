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
exports.ClorerRegistreDto = exports.EscaladerDto = exports.ReporterDto = exports.SuivreDto = exports.ReponseDirectionDto = exports.CommuniquerDto = exports.QualifierDto = exports.AjouterFaiblesseDto = exports.CreerRegistreFaiblessesDto = void 0;
const class_validator_1 = require("class-validator");
const client_1 = require("@prisma/client");
class CreerRegistreFaiblessesDto {
}
exports.CreerRegistreFaiblessesDto = CreerRegistreFaiblessesDto;
__decorate([
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], CreerRegistreFaiblessesDto.prototype, "exerciceId", void 0);
__decorate([
    (0, class_validator_1.IsEnum)(client_1.OrigineFaiblesse),
    __metadata("design:type", String)
], CreerRegistreFaiblessesDto.prototype, "origine", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(200),
    __metadata("design:type", String)
], CreerRegistreFaiblessesDto.prototype, "libelle", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(200),
    __metadata("design:type", String)
], CreerRegistreFaiblessesDto.prototype, "emetteur", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], CreerRegistreFaiblessesDto.prototype, "dateLettre", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(120),
    __metadata("design:type", String)
], CreerRegistreFaiblessesDto.prototype, "referenceLettre", void 0);
class AjouterFaiblesseDto {
}
exports.AjouterFaiblesseDto = AjouterFaiblesseDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(40),
    __metadata("design:type", String)
], AjouterFaiblesseDto.prototype, "reference", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(300),
    __metadata("design:type", String)
], AjouterFaiblesseDto.prototype, "intitule", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(10000),
    __metadata("design:type", String)
], AjouterFaiblesseDto.prototype, "description", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(10000),
    __metadata("design:type", String)
], AjouterFaiblesseDto.prototype, "effetPotentiel", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(10000),
    __metadata("design:type", String)
], AjouterFaiblesseDto.prototype, "recommandation", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsString)({ each: true }),
    __metadata("design:type", Array)
], AjouterFaiblesseDto.prototype, "indicateursA7", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(client_1.QualificationFaiblesse),
    __metadata("design:type", String)
], AjouterFaiblesseDto.prototype, "qualification", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(200),
    __metadata("design:type", String)
], AjouterFaiblesseDto.prototype, "constatePar", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], AjouterFaiblesseDto.prototype, "echeanceRemediation", void 0);
class QualifierDto {
}
exports.QualifierDto = QualifierDto;
__decorate([
    (0, class_validator_1.IsEnum)(client_1.QualificationFaiblesse),
    __metadata("design:type", String)
], QualifierDto.prototype, "qualification", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(10000),
    __metadata("design:type", String)
], QualifierDto.prototype, "justification", void 0);
class CommuniquerDto {
}
exports.CommuniquerDto = CommuniquerDto;
__decorate([
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], CommuniquerDto.prototype, "communiqueeLe", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(300),
    __metadata("design:type", String)
], CommuniquerDto.prototype, "communiqueeA", void 0);
class ReponseDirectionDto {
}
exports.ReponseDirectionDto = ReponseDirectionDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(10000),
    __metadata("design:type", String)
], ReponseDirectionDto.prototype, "reponseDirection", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(200),
    __metadata("design:type", String)
], ReponseDirectionDto.prototype, "reponseDirectionPar", void 0);
class SuivreDto {
}
exports.SuivreDto = SuivreDto;
__decorate([
    (0, class_validator_1.IsEnum)(client_1.StatutFaiblesse),
    __metadata("design:type", String)
], SuivreDto.prototype, "statut", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(10000),
    __metadata("design:type", String)
], SuivreDto.prototype, "verificationCabinet", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(10000),
    __metadata("design:type", String)
], SuivreDto.prototype, "motifNonRemediation", void 0);
class ReporterDto {
}
exports.ReporterDto = ReporterDto;
__decorate([
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], ReporterDto.prototype, "registreCibleId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(40),
    __metadata("design:type", String)
], ReporterDto.prototype, "reference", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(10000),
    __metadata("design:type", String)
], ReporterDto.prototype, "communicationReconduite", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(10000),
    __metadata("design:type", String)
], ReporterDto.prototype, "motifNonRemediation", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], ReporterDto.prototype, "echeanceRemediation", void 0);
class EscaladerDto {
}
exports.EscaladerDto = EscaladerDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(10000),
    __metadata("design:type", String)
], EscaladerDto.prototype, "motif", void 0);
class ClorerRegistreDto {
}
exports.ClorerRegistreDto = ClorerRegistreDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(10000),
    __metadata("design:type", String)
], ClorerRegistreDto.prototype, "motifCloture", void 0);
//# sourceMappingURL=faiblesses.dto.js.map