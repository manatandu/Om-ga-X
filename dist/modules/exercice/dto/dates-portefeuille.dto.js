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
exports.DatesPortefeuilleDto = void 0;
const class_validator_1 = require("class-validator");
class DatesPortefeuilleDto {
}
exports.DatesPortefeuilleDto = DatesPortefeuilleDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateIf)((o) => o.dateAssembleeGenerale !== '' && o.dateAssembleeGenerale !== null),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", Object)
], DatesPortefeuilleDto.prototype, "dateAssembleeGenerale", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateIf)((o) => o.dateDepotEtatsPortefeuille !== '' && o.dateDepotEtatsPortefeuille !== null),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", Object)
], DatesPortefeuilleDto.prototype, "dateDepotEtatsPortefeuille", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateIf)((o) => o.dateTransmissionPvPortefeuille !== '' && o.dateTransmissionPvPortefeuille !== null),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", Object)
], DatesPortefeuilleDto.prototype, "dateTransmissionPvPortefeuille", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateIf)((o) => o.dateDeclarationDividendeEtat !== '' && o.dateDeclarationDividendeEtat !== null),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", Object)
], DatesPortefeuilleDto.prototype, "dateDeclarationDividendeEtat", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateIf)((o) => o.dateNotePerceptionDividende !== '' && o.dateNotePerceptionDividende !== null),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", Object)
], DatesPortefeuilleDto.prototype, "dateNotePerceptionDividende", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateIf)((o) => o.datePaiementDividendeEtat !== '' && o.datePaiementDividendeEtat !== null),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", Object)
], DatesPortefeuilleDto.prototype, "datePaiementDividendeEtat", void 0);
//# sourceMappingURL=dates-portefeuille.dto.js.map