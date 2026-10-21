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
exports.FiltreRegistreDto = exports.AnnulerDonationDto = exports.SignerDonationDto = exports.ModifierDonationDto = exports.InscrireDonationDto = void 0;
const class_validator_1 = require("class-validator");
const class_transformer_1 = require("class-transformer");
const client_1 = require("@prisma/client");
class InscrireDonationDto {
}
exports.InscrireDonationDto = InscrireDonationDto;
__decorate([
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], InscrireDonationDto.prototype, "dateOperation", void 0);
__decorate([
    (0, class_validator_1.IsEnum)(client_1.NatureLiberalite),
    __metadata("design:type", String)
], InscrireDonationDto.prototype, "nature", void 0);
__decorate([
    (0, class_validator_1.IsEnum)(client_1.TypeDonateur),
    __metadata("design:type", String)
], InscrireDonationDto.prototype, "typeDonateur", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], InscrireDonationDto.prototype, "nom", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], InscrireDonationDto.prototype, "prenoms", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], InscrireDonationDto.prototype, "domicile", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], InscrireDonationDto.prototype, "denomination", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], InscrireDonationDto.prototype, "numeroImmatriculation", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], InscrireDonationDto.prototype, "numeroIdentificationFiscale", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], InscrireDonationDto.prototype, "adresseSiegeSocial", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], InscrireDonationDto.prototype, "adresseElectronique", void 0);
__decorate([
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.IsPositive)(),
    __metadata("design:type", Number)
], InscrireDonationDto.prototype, "montant", void 0);
__decorate([
    (0, class_validator_1.IsEnum)(client_1.ModeLiberation),
    __metadata("design:type", String)
], InscrireDonationDto.prototype, "modeLiberation", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], InscrireDonationDto.prototype, "designationNature", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)('4'),
    __metadata("design:type", String)
], InscrireDonationDto.prototype, "ecritureId", void 0);
class ModifierDonationDto {
}
exports.ModifierDonationDto = ModifierDonationDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ModifierDonationDto.prototype, "nom", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ModifierDonationDto.prototype, "prenoms", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ModifierDonationDto.prototype, "domicile", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ModifierDonationDto.prototype, "denomination", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ModifierDonationDto.prototype, "numeroImmatriculation", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ModifierDonationDto.prototype, "numeroIdentificationFiscale", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ModifierDonationDto.prototype, "adresseSiegeSocial", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ModifierDonationDto.prototype, "adresseElectronique", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ModifierDonationDto.prototype, "designationNature", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)('4'),
    __metadata("design:type", String)
], ModifierDonationDto.prototype, "ecritureId", void 0);
class SignerDonationDto {
}
exports.SignerDonationDto = SignerDonationDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], SignerDonationDto.prototype, "signeePar", void 0);
class AnnulerDonationDto {
}
exports.AnnulerDonationDto = AnnulerDonationDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], AnnulerDonationDto.prototype, "motifAnnulation", void 0);
class FiltreRegistreDto {
}
exports.FiltreRegistreDto = FiltreRegistreDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)('4'),
    __metadata("design:type", String)
], FiltreRegistreDto.prototype, "exerciceId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], FiltreRegistreDto.prototype, "recherche", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(({ value }) => value === true || value === 'true'),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], FiltreRegistreDto.prototype, "masquerAnnulees", void 0);
//# sourceMappingURL=donation.dto.js.map