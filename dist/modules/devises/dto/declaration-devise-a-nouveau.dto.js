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
exports.DeclarerDeviseANouveauDto = exports.PartDeclareeDto = void 0;
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const declaration_devise_a_nouveau_1 = require("../declaration-devise-a-nouveau");
class PartDeclareeDto {
}
exports.PartDeclareeDto = PartDeclareeDto;
__decorate([
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], PartDeclareeDto.prototype, "deviseId", void 0);
__decorate([
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.IsPositive)(),
    __metadata("design:type", Number)
], PartDeclareeDto.prototype, "montantDevise", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.IsPositive)(),
    __metadata("design:type", Number)
], PartDeclareeDto.prototype, "coursApplique", void 0);
__decorate([
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.IsPositive)(),
    __metadata("design:type", Number)
], PartDeclareeDto.prototype, "montant", void 0);
class DeclarerDeviseANouveauDto {
}
exports.DeclarerDeviseANouveauDto = DeclarerDeviseANouveauDto;
__decorate([
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], DeclarerDeviseANouveauDto.prototype, "ligneId", void 0);
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMaxSize)(declaration_devise_a_nouveau_1.PARTS_MAXIMUM),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => PartDeclareeDto),
    __metadata("design:type", Array)
], DeclarerDeviseANouveauDto.prototype, "parts", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(3, 500),
    __metadata("design:type", String)
], DeclarerDeviseANouveauDto.prototype, "source", void 0);
//# sourceMappingURL=declaration-devise-a-nouveau.dto.js.map