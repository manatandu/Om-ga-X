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
exports.ImprimerJournalDto = void 0;
const class_validator_1 = require("class-validator");
class ImprimerJournalDto {
}
exports.ImprimerJournalDto = ImprimerJournalDto;
__decorate([
    (0, class_validator_1.IsUUID)('all', { message: 'Exercice inconnu' }),
    __metadata("design:type", String)
], ImprimerJournalDto.prototype, "exerciceId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)('all', { message: 'Journal inconnu' }),
    __metadata("design:type", Object)
], ImprimerJournalDto.prototype, "journalId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)({}, { message: 'La date de début de la période imprimée est illisible.' }),
    __metadata("design:type", String)
], ImprimerJournalDto.prototype, "dateDebut", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)({}, { message: 'La date de fin de la période imprimée est illisible.' }),
    __metadata("design:type", String)
], ImprimerJournalDto.prototype, "dateFin", void 0);
//# sourceMappingURL=impression-journal.dto.js.map