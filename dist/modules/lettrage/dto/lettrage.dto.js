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
exports.ConfirmerPreLettrageDto = exports.GroupePreLettrageDto = exports.DelettrerDto = exports.VerrouillerLettrageDto = exports.ReconduireLettrageDto = exports.CompleterLettrageDto = exports.LettrerDto = void 0;
const class_validator_1 = require("class-validator");
const lettre_choisie_1 = require("../lettre-choisie");
const class_transformer_1 = require("class-transformer");
const client_1 = require("@prisma/client");
class LettrerDto {
}
exports.LettrerDto = LettrerDto;
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMinSize)(2),
    (0, class_validator_1.IsUUID)('4', { each: true }),
    __metadata("design:type", Array)
], LettrerDto.prototype, "ligneIds", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], LettrerDto.prototype, "autoriserPartiel", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Matches)(lettre_choisie_1.FORMAT_LETTRE_CHOISIE, { message: lettre_choisie_1.MOTIF_FORMAT_LETTRE }),
    __metadata("design:type", String)
], LettrerDto.prototype, "lettre", void 0);
class CompleterLettrageDto {
}
exports.CompleterLettrageDto = CompleterLettrageDto;
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMinSize)(1),
    (0, class_validator_1.IsUUID)('4', { each: true }),
    __metadata("design:type", Array)
], CompleterLettrageDto.prototype, "ligneIds", void 0);
class ReconduireLettrageDto {
}
exports.ReconduireLettrageDto = ReconduireLettrageDto;
__decorate([
    (0, class_validator_1.IsUUID)('4'),
    __metadata("design:type", String)
], ReconduireLettrageDto.prototype, "lettrageId", void 0);
class VerrouillerLettrageDto {
}
exports.VerrouillerLettrageDto = VerrouillerLettrageDto;
__decorate([
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], VerrouillerLettrageDto.prototype, "verrouille", void 0);
class DelettrerDto {
}
exports.DelettrerDto = DelettrerDto;
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], DelettrerDto.prototype, "lettre", void 0);
class GroupePreLettrageDto {
}
exports.GroupePreLettrageDto = GroupePreLettrageDto;
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMinSize)(2),
    (0, class_validator_1.IsUUID)('4', { each: true }),
    __metadata("design:type", Array)
], GroupePreLettrageDto.prototype, "ligneIds", void 0);
__decorate([
    (0, class_validator_1.IsEnum)(client_1.OrigineLettrage),
    __metadata("design:type", String)
], GroupePreLettrageDto.prototype, "origine", void 0);
class ConfirmerPreLettrageDto {
}
exports.ConfirmerPreLettrageDto = ConfirmerPreLettrageDto;
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMinSize)(1),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => GroupePreLettrageDto),
    __metadata("design:type", Array)
], ConfirmerPreLettrageDto.prototype, "groupes", void 0);
//# sourceMappingURL=lettrage.dto.js.map