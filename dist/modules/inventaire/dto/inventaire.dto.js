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
exports.EtablirPvCaisseDto = exports.CoupureDto = exports.EtablirProcesVerbalDto = exports.RattacherEcritureEcartDto = exports.ArbitrerEcartDto = exports.SaisirComptageDto = exports.CreerFicheDto = exports.AjouterMembreDto = exports.AjouterSousCommissionDto = exports.ModifierCampagneDto = exports.CreerCampagneDto = void 0;
const class_validator_1 = require("class-validator");
const class_transformer_1 = require("class-transformer");
const client_1 = require("@prisma/client");
class CreerCampagneDto {
}
exports.CreerCampagneDto = CreerCampagneDto;
__decorate([
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], CreerCampagneDto.prototype, "exerciceId", void 0);
__decorate([
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], CreerCampagneDto.prototype, "dateInventaire", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(200),
    __metadata("design:type", String)
], CreerCampagneDto.prototype, "libelle", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(20000),
    __metadata("design:type", String)
], CreerCampagneDto.prototype, "instructions", void 0);
class ModifierCampagneDto {
}
exports.ModifierCampagneDto = ModifierCampagneDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(200),
    __metadata("design:type", String)
], ModifierCampagneDto.prototype, "libelle", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(20000),
    __metadata("design:type", String)
], ModifierCampagneDto.prototype, "instructions", void 0);
class AjouterSousCommissionDto {
}
exports.AjouterSousCommissionDto = AjouterSousCommissionDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(200),
    __metadata("design:type", String)
], AjouterSousCommissionDto.prototype, "nom", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(300),
    __metadata("design:type", String)
], AjouterSousCommissionDto.prototype, "perimetre", void 0);
class AjouterMembreDto {
}
exports.AjouterMembreDto = AjouterMembreDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(200),
    __metadata("design:type", String)
], AjouterMembreDto.prototype, "nom", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(200),
    __metadata("design:type", String)
], AjouterMembreDto.prototype, "fonction", void 0);
__decorate([
    (0, class_validator_1.IsEnum)(client_1.RoleMembreInventaire),
    __metadata("design:type", String)
], AjouterMembreDto.prototype, "role", void 0);
class CreerFicheDto {
}
exports.CreerFicheDto = CreerFicheDto;
__decorate([
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], CreerFicheDto.prototype, "compteId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], CreerFicheDto.prototype, "sousCommissionId", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(300),
    __metadata("design:type", String)
], CreerFicheDto.prototype, "designation", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(200),
    __metadata("design:type", String)
], CreerFicheDto.prototype, "emplacement", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(50),
    __metadata("design:type", String)
], CreerFicheDto.prototype, "uniteMesure", void 0);
class SaisirComptageDto {
}
exports.SaisirComptageDto = SaisirComptageDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], SaisirComptageDto.prototype, "quantiteComptee", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], SaisirComptageDto.prototype, "valeurInventaire", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(200),
    __metadata("design:type", String)
], SaisirComptageDto.prototype, "referencePiece", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(200),
    __metadata("design:type", String)
], SaisirComptageDto.prototype, "emplacement", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], SaisirComptageDto.prototype, "sousCommissionId", void 0);
class ArbitrerEcartDto {
}
exports.ArbitrerEcartDto = ArbitrerEcartDto;
__decorate([
    (0, class_validator_1.IsEnum)(client_1.DecisionEcartInventaire),
    __metadata("design:type", String)
], ArbitrerEcartDto.prototype, "decision", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(200),
    __metadata("design:type", String)
], ArbitrerEcartDto.prototype, "responsable", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(5000),
    __metadata("design:type", String)
], ArbitrerEcartDto.prototype, "explication", void 0);
class RattacherEcritureEcartDto {
}
exports.RattacherEcritureEcartDto = RattacherEcritureEcartDto;
__decorate([
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], RattacherEcritureEcartDto.prototype, "ecritureId", void 0);
class EtablirProcesVerbalDto {
}
exports.EtablirProcesVerbalDto = EtablirProcesVerbalDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], EtablirProcesVerbalDto.prototype, "dateEtablissement", void 0);
class CoupureDto {
}
exports.CoupureDto = CoupureDto;
__decorate([
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.IsPositive)(),
    __metadata("design:type", Number)
], CoupureDto.prototype, "valeurUnitaire", void 0);
__decorate([
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.IsPositive)(),
    __metadata("design:type", Number)
], CoupureDto.prototype, "nombre", void 0);
class EtablirPvCaisseDto {
}
exports.EtablirPvCaisseDto = EtablirPvCaisseDto;
__decorate([
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], EtablirPvCaisseDto.prototype, "compteId", void 0);
__decorate([
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], EtablirPvCaisseDto.prototype, "sousCommissionId", void 0);
__decorate([
    (0, class_validator_1.Matches)(/^\d{4}-\d{2}-\d{2}$/, { message: 'La date du comptage s’écrit AAAA-MM-JJ, sans heure ni fuseau.' }),
    __metadata("design:type", String)
], EtablirPvCaisseDto.prototype, "dateComptage", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(20),
    __metadata("design:type", String)
], EtablirPvCaisseDto.prototype, "heureComptage", void 0);
__decorate([
    (0, class_validator_1.IsEnum)(client_1.ModeComparaisonCaisse),
    __metadata("design:type", String)
], EtablirPvCaisseDto.prototype, "modeComparaison", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", Object)
], EtablirPvCaisseDto.prototype, "deviseId", void 0);
__decorate([
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], EtablirPvCaisseDto.prototype, "especesComptees", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => CoupureDto),
    __metadata("design:type", Array)
], EtablirPvCaisseDto.prototype, "coupures", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], EtablirPvCaisseDto.prototype, "attestationEtablieLe", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(200),
    __metadata("design:type", String)
], EtablirPvCaisseDto.prototype, "attestationPar", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(5000),
    __metadata("design:type", String)
], EtablirPvCaisseDto.prototype, "observations", void 0);
//# sourceMappingURL=inventaire.dto.js.map