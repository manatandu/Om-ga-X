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
exports.DeclarerVentilationDisponibilitesDto = exports.LigneVentilationDisponibiliteDto = exports.DeclarerProvisionOuvertureDto = exports.RetirerContrePassationManuelleDto = exports.MotifAttestationEtatDto = exports.DeclarerContrePassationManuelleDto = exports.AnnulerReevaluationDto = exports.ExtournerReevaluationDto = exports.ReevaluerDto = exports.PoserCoursDto = exports.ModifierDeviseDto = exports.CreerDeviseDto = void 0;
const class_transformer_1 = require("class-transformer");
const facultatif_non_nul_1 = require("../../../common/facultatif-non-nul");
const class_validator_1 = require("class-validator");
class CreerDeviseDto {
}
exports.CreerDeviseDto = CreerDeviseDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(3, 3, { message: 'Le code devise est un code ISO à trois lettres (USD, EUR…)' }),
    __metadata("design:type", String)
], CreerDeviseDto.prototype, "code", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreerDeviseDto.prototype, "intitule", void 0);
class ModifierDeviseDto {
}
exports.ModifierDeviseDto = ModifierDeviseDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ModifierDeviseDto.prototype, "intitule", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], ModifierDeviseDto.prototype, "estActive", void 0);
class PoserCoursDto {
}
exports.PoserCoursDto = PoserCoursDto;
__decorate([
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], PoserCoursDto.prototype, "date", void 0);
__decorate([
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0.000001),
    __metadata("design:type", Number)
], PoserCoursDto.prototype, "cours", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], PoserCoursDto.prototype, "source", void 0);
class ReevaluerDto {
}
exports.ReevaluerDto = ReevaluerDto;
__decorate([
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], ReevaluerDto.prototype, "exerciceId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], ReevaluerDto.prototype, "dateReevaluation", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], ReevaluerDto.prototype, "positionGlobale", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], ReevaluerDto.prototype, "simulation", void 0);
class ExtournerReevaluationDto {
}
exports.ExtournerReevaluationDto = ExtournerReevaluationDto;
__decorate([
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], ExtournerReevaluationDto.prototype, "exerciceSuivantId", void 0);
__decorate([
    (0, facultatif_non_nul_1.FacultatifNonNul)('La contre-passation intégrale est demandée ou non · omettez le champ pour ne rien demander.'),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], ExtournerReevaluationDto.prototype, "integrale", void 0);
class AnnulerReevaluationDto {
}
exports.AnnulerReevaluationDto = AnnulerReevaluationDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(3, 500),
    __metadata("design:type", String)
], AnnulerReevaluationDto.prototype, "motif", void 0);
class DeclarerContrePassationManuelleDto {
}
exports.DeclarerContrePassationManuelleDto = DeclarerContrePassationManuelleDto;
__decorate([
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], DeclarerContrePassationManuelleDto.prototype, "ecritureId", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(3, 500),
    __metadata("design:type", String)
], DeclarerContrePassationManuelleDto.prototype, "motif", void 0);
class MotifAttestationEtatDto {
}
exports.MotifAttestationEtatDto = MotifAttestationEtatDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(10, 500, { message: "Le motif de l'attestation compte de 10 à 500 caractères" }),
    __metadata("design:type", String)
], MotifAttestationEtatDto.prototype, "motif", void 0);
class RetirerContrePassationManuelleDto {
}
exports.RetirerContrePassationManuelleDto = RetirerContrePassationManuelleDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(3, 500),
    __metadata("design:type", String)
], RetirerContrePassationManuelleDto.prototype, "motif", void 0);
class DeclarerProvisionOuvertureDto {
}
exports.DeclarerProvisionOuvertureDto = DeclarerProvisionOuvertureDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(3, 4, { message: 'Le compte de provision est une racine (194, 4991 ou 4997)' }),
    __metadata("design:type", String)
], DeclarerProvisionOuvertureDto.prototype, "compteProvision", void 0);
__decorate([
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], DeclarerProvisionOuvertureDto.prototype, "montant", void 0);
__decorate([
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], DeclarerProvisionOuvertureDto.prototype, "dateReference", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(1, 2000, { message: 'La source du montant déclaré est exigée' }),
    __metadata("design:type", String)
], DeclarerProvisionOuvertureDto.prototype, "source", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(0, 2000),
    __metadata("design:type", String)
], DeclarerProvisionOuvertureDto.prototype, "motif", void 0);
__decorate([
    (0, facultatif_non_nul_1.FacultatifNonNul)('La contestation de la provision du module est vraie ou fausse · omettez le champ pour ne rien contester.'),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], DeclarerProvisionOuvertureDto.prototype, "provisionModuleContestee", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(0, 2000),
    __metadata("design:type", String)
], DeclarerProvisionOuvertureDto.prototype, "motifContestation", void 0);
class LigneVentilationDisponibiliteDto {
}
exports.LigneVentilationDisponibiliteDto = LigneVentilationDisponibiliteDto;
__decorate([
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], LigneVentilationDisponibiliteDto.prototype, "compteId", void 0);
__decorate([
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], LigneVentilationDisponibiliteDto.prototype, "deviseId", void 0);
__decorate([
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], LigneVentilationDisponibiliteDto.prototype, "ecart", void 0);
class DeclarerVentilationDisponibilitesDto {
}
exports.DeclarerVentilationDisponibilitesDto = DeclarerVentilationDisponibilitesDto;
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMinSize)(1, { message: "Déclarez l'écart d'au moins une devise." }),
    (0, class_validator_1.ArrayMaxSize)(200),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => LigneVentilationDisponibiliteDto),
    __metadata("design:type", Array)
], DeclarerVentilationDisponibilitesDto.prototype, "ventilation", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(3, 2000, { message: 'La source de la ventilation est exigée (pièce, relevé, calcul du cabinet).' }),
    __metadata("design:type", String)
], DeclarerVentilationDisponibilitesDto.prototype, "source", void 0);
//# sourceMappingURL=devises.dto.js.map